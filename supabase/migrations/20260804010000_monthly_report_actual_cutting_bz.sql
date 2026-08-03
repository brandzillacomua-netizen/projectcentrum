-- Factual +BZ created by cutting, not BZ stock consumed by a naryad.
-- Full replacement is deliberate: pg_get_functiondef formatting differs
-- between PostgreSQL versions, so text-patching a deployed function is brittle.

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
  with target_tasks as materialized (
    select t.id, t.plan_snapshot
      from public.tasks t
      join public.orders o on o.id = t.order_id
       and upper(btrim(o.order_num::text)) !~ '^ВБ'
     where t.order_id = p_order_id
       and t.batch_index is not distinct from p_batch_index
  ), group_snapshot as materialized (
    select plan_snapshot
      from target_tasks
     where plan_snapshot is not null
     order by id
     limit 1
  ), planned_details as materialized (
    select part.key::uuid as nomenclature_id,
           coalesce((part.value->>'need')::numeric, (part.value->>'plan')::numeric, 0) as planned_qty,
           coalesce(nullif(part.value->>'name', ''), n.name, 'Деталь без назви') as name
      from group_snapshot gs
      cross join lateral (
        select e.key, e.value
          from jsonb_each(gs.plan_snapshot) e
         where e.key ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
           and jsonb_typeof(e.value) = 'object'
      ) part
      left join public.nomenclatures n on n.id = part.key::uuid
  ), all_history as materialized (
    select h.nomenclature_id,
           lower(btrim(coalesce(h.stage_name, ''))) as stage_name,
           coalesce(h.qty_completed, 0)::numeric as qty_completed,
           coalesce(h.scrap_qty, 0)::numeric as scrap_qty,
           coalesce(h.cutters_used, 0)::numeric as cutters_used,
           h.card_info
      from public.work_cards wc
      join public.work_card_history h on h.card_id = wc.id
     where wc.task_id in (select id from target_tasks)
  ), actual_details as materialized (
    select nomenclature_id,
           sum(scrap_qty)::numeric as scrap_qty,
           sum(qty_completed) filter (where stage_name = 'розкрій')::numeric as actual_cut_qty,
           sum(greatest(
             qty_completed - coalesce(
               nullif(substring(card_info from '\[REQ:([0-9]+)\]'), '')::numeric,
               qty_completed
             ),
             0
           )) filter (where stage_name = 'розкрій')::numeric as actual_bz_qty
      from all_history
     where nomenclature_id is not null
     group by nomenclature_id
  ), detail_rows as materialized (
    select p.nomenclature_id, p.name, p.planned_qty,
           coalesce(a.actual_cut_qty, 0)::numeric as actual_cut_qty,
           greatest(coalesce(a.actual_cut_qty, 0) - p.planned_qty, 0)::numeric as actual_bz_qty,
           coalesce(a.scrap_qty, 0)::numeric as scrap_qty
      from planned_details p
      left join actual_details a on a.nomenclature_id = p.nomenclature_id
  ), cutter_rows as materialized (
    select n.name, sum(cue.quantity)::numeric as quantity
      from public.cutter_usage_events cue
      join target_tasks tt on tt.id = cue.task_id
      join public.nomenclatures n on n.id = cue.nomenclature_id
     group by n.name
  ), cutter_totals as (
    select coalesce(sum(cutters_used) filter (
             where stage_name in ('розкрій', 'розкрій (перезмінка)')
           ), 0)::numeric as history_total,
           coalesce((select sum(quantity) from cutter_rows), 0)::numeric as detailed_total
      from all_history
  ), final_cutters as (
    select name, quantity from cutter_rows
    union all
    select 'Без деталізації', history_total - detailed_total
      from cutter_totals
     where history_total > detailed_total
  )
  select jsonb_build_object(
    'details', coalesce((
      select jsonb_agg(jsonb_build_object(
        'nomenclature_id', d.nomenclature_id,
        'name', d.name,
        'planned_qty', d.planned_qty,
        'actual_cut_qty', d.actual_cut_qty,
        'actual_bz_qty', d.actual_bz_qty,
        'scrap_qty', d.scrap_qty
      ) order by d.name)
      from detail_rows d
    ), '[]'::jsonb),
    'cutters', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', c.name,
        'quantity', c.quantity
      ) order by c.quantity desc, c.name)
      from final_cutters c
    ), '[]'::jsonb)
  );
$monthly_naryad_detail$;

revoke all on function public.mes_monthly_naryad_detail(date, uuid, integer) from public;
grant execute on function public.mes_monthly_naryad_detail(date, uuid, integer)
  to authenticated, service_role;

comment on function public.mes_monthly_naryad_detail(date, uuid, integer) is
  'Naryad drilldown with factual +BZ: completed cutting quantity after scrap minus per-card REQ.';
