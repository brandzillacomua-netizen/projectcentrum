-- Lazy, single-naryad drilldown for the monthly report. This keeps the main
-- report cheap: detail rows are aggregated only when a user expands a naryad.

create index if not exists idx_cutter_usage_events_task_created_report
  on public.cutter_usage_events (task_id, created_at)
  include (nomenclature_id, quantity);

create or replace function public.mes_monthly_naryad_detail(
  p_month date,
  p_order_id uuid,
  p_batch_index integer default null
)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $monthly_naryad_detail$
  with bounds as materialized (
    select date_trunc('month', coalesce(p_month, current_date)::timestamp) at time zone 'Europe/Kyiv' as from_at,
           (date_trunc('month', coalesce(p_month, current_date)::timestamp) + interval '1 month') at time zone 'Europe/Kyiv' as to_at
  ), target_tasks as materialized (
    select t.id, t.plan_snapshot
      from public.tasks t
      join public.orders o on o.id = t.order_id
       and upper(btrim(o.order_num::text)) !~ '^ВБ'
     where t.order_id = p_order_id
       and t.batch_index is not distinct from p_batch_index
  ), group_snapshot as materialized (
    select tt.plan_snapshot
      from target_tasks tt
     where tt.plan_snapshot is not null
     order by tt.id
     limit 1
  ), planned_details as materialized (
    select part.key::uuid as nomenclature_id,
           coalesce((part.value->>'need')::numeric, (part.value->>'plan')::numeric, 0) as planned_qty,
           coalesce((part.value->>'stock')::numeric, 0) as bz_qty,
           coalesce(nullif(part.value->>'name', ''), n.name, 'Деталь без назви') as name
      from group_snapshot gs
      cross join lateral (
        select entry.key, entry.value
          from jsonb_each(gs.plan_snapshot) entry
         where entry.key ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
           and jsonb_typeof(entry.value) = 'object'
      ) part
      left join public.nomenclatures n on n.id = part.key::uuid
  ), month_history as materialized (
    select h.nomenclature_id, lower(btrim(coalesce(h.stage_name, ''))) as stage_name,
           coalesce(h.qty_completed, 0)::numeric as qty_completed,
           coalesce(h.scrap_qty, 0)::numeric as scrap_qty,
           coalesce(h.cutters_used, 0)::numeric as cutters_used
      from bounds b
      join public.work_cards wc on wc.task_id in (select id from target_tasks)
      join public.work_card_history h on h.card_id = wc.id
       and ((h.completed_at >= b.from_at and h.completed_at < b.to_at)
         or (h.completed_at is null and h.created_at >= b.from_at and h.created_at < b.to_at))
  ), actual_details as materialized (
    select h.nomenclature_id,
           sum(h.scrap_qty)::numeric as scrap_qty,
           sum(h.qty_completed) filter (where h.stage_name in ('склад бз', 'склад bz'))::numeric as actual_bz_qty
      from month_history h
     where h.nomenclature_id is not null
     group by h.nomenclature_id
  ), detail_rows as materialized (
    select p.nomenclature_id, p.name, p.planned_qty, p.bz_qty,
           coalesce(a.actual_bz_qty, 0)::numeric as actual_bz_qty,
           coalesce(a.scrap_qty, 0)::numeric as scrap_qty
      from planned_details p
      left join actual_details a on a.nomenclature_id = p.nomenclature_id
  ), cutter_rows as materialized (
    select n.name, sum(cue.quantity)::numeric as quantity
      from bounds b
      join public.cutter_usage_events cue
        on cue.created_at >= b.from_at and cue.created_at < b.to_at
      join target_tasks tt on tt.id = cue.task_id
      join public.nomenclatures n on n.id = cue.nomenclature_id
     group by n.name
  ), cutter_totals as (
    select coalesce(sum(h.cutters_used) filter (where h.stage_name in ('розкрій', 'розкрій (перезмінка)')), 0)::numeric as history_total,
           coalesce((select sum(c.quantity) from cutter_rows c), 0)::numeric as detailed_total
      from month_history h
  ), final_cutters as (
    select c.name, c.quantity from cutter_rows c
    union all
    select 'Без деталізації', t.history_total - t.detailed_total
      from cutter_totals t
     where t.history_total > t.detailed_total
  )
  select jsonb_build_object(
    'details', coalesce((select jsonb_agg(jsonb_build_object(
      'nomenclature_id', d.nomenclature_id, 'name', d.name,
      'planned_qty', d.planned_qty, 'bz_qty', d.bz_qty,
      'actual_bz_qty', d.actual_bz_qty, 'scrap_qty', d.scrap_qty
    ) order by d.name) from detail_rows d), '[]'::jsonb),
    'cutters', coalesce((select jsonb_agg(jsonb_build_object(
      'name', c.name, 'quantity', c.quantity
    ) order by c.quantity desc, c.name) from final_cutters c), '[]'::jsonb)
  );
$monthly_naryad_detail$;

revoke all on function public.mes_monthly_naryad_detail(date, uuid, integer) from public;
grant execute on function public.mes_monthly_naryad_detail(date, uuid, integer) to authenticated, service_role;

comment on function public.mes_monthly_naryad_detail(date, uuid, integer) is
  'Lazy monthly naryad drilldown: planned details, BZ, scrap and factual cutter types.';
