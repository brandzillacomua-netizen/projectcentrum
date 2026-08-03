-- One bounded server-side aggregation for the MES monthly report.
-- Source rows never leave PostgreSQL; the client receives only report-ready JSON.

create index if not exists idx_work_card_history_completed_monthly_report
  on public.work_card_history (completed_at, card_id)
  include (qty_completed, scrap_qty, cutters_used, stage_name)
  where completed_at is not null;

create index if not exists idx_work_card_history_created_monthly_report
  on public.work_card_history (created_at, card_id)
  include (qty_completed, scrap_qty, cutters_used, stage_name)
  where completed_at is null;

create index if not exists idx_tasks_order_batch_monthly_report
  on public.tasks (order_id, batch_index, id);

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
  ), month_activity as materialized (
    select t.order_id, t.batch_index, t.id as task_id, wc.id as card_id, h.id as history_id,
           coalesce(h.completed_at, h.created_at) as activity_at,
           coalesce(h.qty_completed, 0)::numeric as qty_completed,
           coalesce(h.scrap_qty, 0)::numeric as scrap_qty,
           coalesce(h.cutters_used, 0)::numeric as cutters_used,
           lower(btrim(coalesce(h.stage_name, ''))) as stage_name
      from bounds b
      join public.work_card_history h
        on (h.completed_at >= b.from_at and h.completed_at < b.to_at)
        or (h.completed_at is null and h.created_at >= b.from_at and h.created_at < b.to_at)
      join public.work_cards wc on wc.id = h.card_id
      join public.tasks t on t.id = wc.task_id
      join public.orders o on o.id = t.order_id
       and upper(btrim(o.order_num::text)) !~ '^ВБ'
  ), qualified_groups as materialized (
    select distinct order_id, batch_index from month_activity
  ), target_tasks as materialized (
    select t.id, t.order_id, t.batch_index
      from public.tasks t
      join qualified_groups q on q.order_id = t.order_id
       and q.batch_index is not distinct from t.batch_index
  ), activity_totals as (
    select a.order_id, a.batch_index,
           min(a.activity_at) as first_activity,
           max(a.activity_at) as last_activity,
           count(distinct a.card_id)::bigint as card_count,
           sum(a.qty_completed) filter (where a.stage_name in ('приймка', 'completed', 'склад бз', 'сгп', 'пакування', 'пакування/сгп')) as produced_qty,
           sum(a.scrap_qty) as scrap_qty,
           sum(a.cutters_used) filter (where a.stage_name in ('розкрій', 'розкрій (перезмінка)')) as cutters_used
      from month_activity a
     group by a.order_id, a.batch_index
  ), request_materials as materialized (
    select tt.order_id, tt.batch_index,
           case
             when lower(coalesce(n.name, mr.details, '')) like '%фрез%' then 'cutters'
             when lower(coalesce(n.name, mr.details, '')) like '%лист%'
               or n.type in ('raw', 'material') then 'sheets'
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
    -- Issued sheet/other requests are factual warehouse consumption. Cutter
    -- consumption is taken from operator history to avoid counting issued and
    -- used cutters twice.
    select order_id, batch_index, category, name, quantity
      from request_materials where category <> 'cutters'
    union all
    select order_id, batch_index, 'cutters', 'Фрези (фактичне використання)', coalesce(cutters_used, 0)
      from activity_totals where coalesce(cutters_used, 0) > 0
  ), grouped_materials as materialized (
    select order_id, batch_index, category, name, sum(quantity)::numeric as quantity
      from actual_materials
     where quantity <> 0
     group by order_id, batch_index, category, name
  ), naryad_rows as materialized (
    select q.order_id, q.batch_index, o.order_num::text, o.customer::text,
           concat(o.order_num, case when q.batch_index is not null then '/' || q.batch_index::text else '' end) as naryad_number,
           a.first_activity, a.last_activity, a.card_count,
           coalesce(a.produced_qty, 0)::numeric as produced_qty,
           coalesce(a.scrap_qty, 0)::numeric as scrap_qty,
           coalesce(a.cutters_used, 0)::numeric as cutters_used,
           coalesce((select jsonb_agg(jsonb_build_object(
             'category', m.category, 'name', m.name, 'quantity', m.quantity, 'unit', 'шт'
           ) order by case m.category when 'sheets' then 1 when 'cutters' then 2 else 3 end, m.name)
             from grouped_materials m
            where m.order_id = q.order_id and m.batch_index is not distinct from q.batch_index), '[]'::jsonb) as materials
      from qualified_groups q
      join public.orders o on o.id = q.order_id
      join activity_totals a on a.order_id = q.order_id and a.batch_index is not distinct from q.batch_index
  ), material_summary as materialized (
    select category, name, sum(quantity)::numeric as quantity,
           count(*)::bigint as naryad_count
      from grouped_materials
     group by category, name
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
      'naryad_count', t.naryad_count,
      'card_count', t.card_count,
      'produced_qty', t.produced_qty,
      'scrap_qty', t.scrap_qty,
      'cutters_used', t.cutters_used,
      'scrap_rate', case when t.produced_qty + t.scrap_qty > 0
        then round(t.scrap_qty * 100 / (t.produced_qty + t.scrap_qty), 2) else 0 end
    ),
    'naryads', coalesce((select jsonb_agg(to_jsonb(n) order by n.last_activity desc, n.order_num) from naryad_rows n), '[]'::jsonb),
    'materials', coalesce((select jsonb_agg(jsonb_build_object(
      'category', m.category, 'name', m.name, 'quantity', m.quantity,
      'naryad_count', m.naryad_count, 'unit', 'шт'
    ) order by case m.category when 'sheets' then 1 when 'cutters' then 2 else 3 end, m.quantity desc, m.name) from material_summary m), '[]'::jsonb)
  )
  from totals t;
$monthly_report$;

revoke all on function public.mes_monthly_report(date) from public;
grant execute on function public.mes_monthly_report(date) to authenticated, service_role;

comment on function public.mes_monthly_report(date) is
  'Bounded calendar-month MES report. Returns only aggregated naryad, material, cutter and scrap data.';
