-- A naryad belongs to the calendar month in which its first task was created,
-- not to every month in which somebody performed an operation. Its factual
-- work period and totals may therefore extend beyond the selected month.

create index if not exists idx_tasks_created_order_batch_monthly_report
  on public.tasks (created_at, order_id, batch_index, id);

create or replace function public.mes_monthly_report(p_month date)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $monthly_report$
  with bounds as materialized (
    select date_trunc('month', coalesce(p_month, current_date)::timestamp) at time zone 'Europe/Kyiv' as from_at,
           (date_trunc('month', coalesce(p_month, current_date)::timestamp) + interval '1 month') at time zone 'Europe/Kyiv' as to_at
  ), qualified_groups as materialized (
    select distinct t.order_id, t.batch_index
      from bounds b
      join public.tasks t on t.created_at >= b.from_at and t.created_at < b.to_at
      join public.orders o on o.id = t.order_id
       and upper(btrim(o.order_num::text)) !~ '^ВБ'
     where not exists (
       select 1 from public.tasks earlier
        where earlier.order_id = t.order_id
          and earlier.batch_index is not distinct from t.batch_index
          and earlier.created_at < b.from_at
     )
  ), target_tasks as materialized (
    select t.id, t.order_id, t.batch_index
      from public.tasks t
      join qualified_groups q on q.order_id = t.order_id
       and q.batch_index is not distinct from t.batch_index
  ), naryad_activity as materialized (
    select tt.order_id, tt.batch_index, wc.id as card_id,
           coalesce(h.completed_at, h.created_at) as activity_at,
           coalesce(h.qty_completed, 0)::numeric as qty_completed,
           coalesce(h.scrap_qty, 0)::numeric as scrap_qty,
           coalesce(h.cutters_used, 0)::numeric as cutters_used,
           lower(btrim(coalesce(h.stage_name, ''))) as stage_name
      from target_tasks tt
      join public.work_cards wc on wc.task_id = tt.id
      join public.work_card_history h on h.card_id = wc.id
  ), activity_totals as materialized (
    select q.order_id, q.batch_index,
           min(a.activity_at) as first_activity,
           max(a.activity_at) as last_activity,
           count(distinct a.card_id)::bigint as card_count,
           coalesce(sum(a.qty_completed) filter (where a.stage_name in ('приймка', 'completed', 'склад бз', 'сгп', 'пакування', 'пакування/сгп')), 0)::numeric as produced_qty,
           coalesce(sum(a.scrap_qty), 0)::numeric as scrap_qty,
           coalesce(sum(a.cutters_used) filter (where a.stage_name in ('розкрій', 'розкрій (перезмінка)')), 0)::numeric as cutters_used
      from qualified_groups q
      left join naryad_activity a on a.order_id = q.order_id
       and a.batch_index is not distinct from q.batch_index
     group by q.order_id, q.batch_index
  ), request_materials as materialized (
    select tt.order_id, tt.batch_index,
           case
             when lower(coalesce(n.name, mr.details, '')) like '%фрез%' then 'cutters'
             when lower(coalesce(n.name, mr.details, '')) like '%лист%' or n.type in ('raw', 'material') then 'sheets'
             else 'other'
           end as category,
           coalesce(nullif(btrim(n.name), ''), nullif(btrim(mr.details), ''), 'Матеріал без назви') as name,
           sum(coalesce(mr.quantity, 0))::numeric as quantity
      from target_tasks tt
      join public.material_requests mr on mr.task_id = tt.id
      left join public.nomenclatures n on n.id = mr.nomenclature_id
     where mr.status in ('issued', 'completed')
     group by tt.order_id, tt.batch_index, category,
              coalesce(nullif(btrim(n.name), ''), nullif(btrim(mr.details), ''), 'Матеріал без назви')
  ), actual_materials as materialized (
    select order_id, batch_index, category, name, quantity
      from request_materials where category <> 'cutters'
    union all
    select order_id, batch_index, 'cutters', 'Фрези (фактичне використання)', cutters_used
      from activity_totals where cutters_used > 0
  ), grouped_materials as materialized (
    select order_id, batch_index, category, name, sum(quantity)::numeric as quantity
      from actual_materials where quantity <> 0
     group by order_id, batch_index, category, name
  ), naryad_rows as materialized (
    select q.order_id, q.batch_index, o.order_num::text, o.customer::text,
           concat(o.order_num, case when q.batch_index is not null then '/' || q.batch_index::text else '' end) as naryad_number,
           a.first_activity, a.last_activity, a.card_count,
           a.produced_qty, a.scrap_qty, a.cutters_used,
           coalesce((select jsonb_agg(jsonb_build_object(
             'category', m.category, 'name', m.name, 'quantity', m.quantity, 'unit', 'шт'
           ) order by case m.category when 'sheets' then 1 when 'cutters' then 2 else 3 end, m.name)
             from grouped_materials m where m.order_id = q.order_id
              and m.batch_index is not distinct from q.batch_index), '[]'::jsonb) as materials
      from qualified_groups q
      join public.orders o on o.id = q.order_id
      join activity_totals a on a.order_id = q.order_id
       and a.batch_index is not distinct from q.batch_index
  ), material_summary as materialized (
    select category, name, sum(quantity)::numeric as quantity, count(*)::bigint as naryad_count
      from grouped_materials group by category, name
  ), totals as (
    select count(*)::bigint as naryad_count,
           coalesce(sum(card_count), 0)::bigint as card_count,
           coalesce(sum(produced_qty), 0)::numeric as produced_qty,
           coalesce(sum(scrap_qty), 0)::numeric as scrap_qty,
           coalesce(sum(cutters_used), 0)::numeric as cutters_used
      from naryad_rows
  )
  select jsonb_build_object(
    'month', to_char((select from_at from bounds) at time zone 'Europe/Kyiv', 'YYYY-MM'),
    'generated_at', clock_timestamp(),
    'summary', jsonb_build_object(
      'naryad_count', t.naryad_count, 'card_count', t.card_count,
      'produced_qty', t.produced_qty, 'scrap_qty', t.scrap_qty,
      'cutters_used', t.cutters_used,
      'scrap_rate', case when t.produced_qty + t.scrap_qty > 0
        then round(t.scrap_qty * 100 / (t.produced_qty + t.scrap_qty), 2) else 0 end
    ),
    'naryads', coalesce((select jsonb_agg(to_jsonb(n) order by
      (select min(t.created_at) from public.tasks t where t.order_id = n.order_id
        and t.batch_index is not distinct from n.batch_index) asc,
      n.order_num, n.batch_index
    ) from naryad_rows n), '[]'::jsonb),
    'materials', coalesce((select jsonb_agg(jsonb_build_object(
      'category', m.category, 'name', m.name, 'quantity', m.quantity,
      'naryad_count', m.naryad_count, 'unit', 'шт'
    ) order by case m.category when 'sheets' then 1 when 'cutters' then 2 else 3 end, m.quantity desc, m.name) from material_summary m), '[]'::jsonb)
  ) from totals t;
$monthly_report$;

revoke all on function public.mes_monthly_report(date) from public;
grant execute on function public.mes_monthly_report(date) to authenticated, service_role;

comment on function public.mes_monthly_report(date) is
  'Monthly MES report assigned by first naryad task creation month; factual work period may cross month boundaries.';

-- Drilldown follows the same ownership rule: once the naryad is selected, show
-- its complete lifecycle rather than cutting detail totals at month-end.
create or replace function public.mes_monthly_naryad_detail(
  p_month date, p_order_id uuid, p_batch_index integer default null
)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $monthly_naryad_detail$
  with target_tasks as materialized (
    select t.id, t.plan_snapshot
      from public.tasks t
      join public.orders o on o.id = t.order_id and upper(btrim(o.order_num::text)) !~ '^ВБ'
     where t.order_id = p_order_id and t.batch_index is not distinct from p_batch_index
  ), group_snapshot as materialized (
    select plan_snapshot from target_tasks where plan_snapshot is not null order by id limit 1
  ), planned_details as materialized (
    select part.key::uuid as nomenclature_id,
           coalesce((part.value->>'need')::numeric, (part.value->>'plan')::numeric, 0) as planned_qty,
           coalesce((part.value->>'stock')::numeric, 0) as bz_qty,
           coalesce(nullif(part.value->>'name', ''), n.name, 'Деталь без назви') as name
      from group_snapshot gs
      cross join lateral (
        select e.key, e.value from jsonb_each(gs.plan_snapshot) e
         where e.key ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
           and jsonb_typeof(e.value) = 'object'
      ) part
      left join public.nomenclatures n on n.id = part.key::uuid
  ), all_history as materialized (
    select h.nomenclature_id, lower(btrim(coalesce(h.stage_name, ''))) as stage_name,
           coalesce(h.qty_completed, 0)::numeric as qty_completed,
           coalesce(h.scrap_qty, 0)::numeric as scrap_qty,
           coalesce(h.cutters_used, 0)::numeric as cutters_used
      from public.work_cards wc
      join public.work_card_history h on h.card_id = wc.id
     where wc.task_id in (select id from target_tasks)
  ), actual_details as materialized (
    select nomenclature_id, sum(scrap_qty)::numeric as scrap_qty,
           sum(qty_completed) filter (where stage_name in ('склад бз', 'склад bz'))::numeric as actual_bz_qty
      from all_history where nomenclature_id is not null group by nomenclature_id
  ), detail_rows as materialized (
    select p.nomenclature_id, p.name, p.planned_qty, p.bz_qty,
           coalesce(a.actual_bz_qty, 0)::numeric as actual_bz_qty,
           coalesce(a.scrap_qty, 0)::numeric as scrap_qty
      from planned_details p left join actual_details a on a.nomenclature_id = p.nomenclature_id
  ), cutter_rows as materialized (
    select n.name, sum(cue.quantity)::numeric as quantity
      from public.cutter_usage_events cue
      join target_tasks tt on tt.id = cue.task_id
      join public.nomenclatures n on n.id = cue.nomenclature_id
     group by n.name
  ), cutter_totals as (
    select coalesce(sum(cutters_used) filter (where stage_name in ('розкрій', 'розкрій (перезмінка)')), 0)::numeric as history_total,
           coalesce((select sum(quantity) from cutter_rows), 0)::numeric as detailed_total
      from all_history
  ), final_cutters as (
    select name, quantity from cutter_rows
    union all
    select 'Без деталізації', history_total - detailed_total from cutter_totals where history_total > detailed_total
  )
  select jsonb_build_object(
    'details', coalesce((select jsonb_agg(jsonb_build_object(
      'nomenclature_id', d.nomenclature_id, 'name', d.name, 'planned_qty', d.planned_qty,
      'bz_qty', d.bz_qty, 'actual_bz_qty', d.actual_bz_qty, 'scrap_qty', d.scrap_qty
    ) order by d.name) from detail_rows d), '[]'::jsonb),
    'cutters', coalesce((select jsonb_agg(jsonb_build_object('name', c.name, 'quantity', c.quantity)
      order by c.quantity desc, c.name) from final_cutters c), '[]'::jsonb)
  );
$monthly_naryad_detail$;

revoke all on function public.mes_monthly_naryad_detail(date, uuid, integer) from public;
grant execute on function public.mes_monthly_naryad_detail(date, uuid, integer) to authenticated, service_role;
