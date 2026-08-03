-- Enrich the monthly KPI summary with the production and cutter plans while
-- keeping the report as one bounded database call.

alter function public.mes_monthly_report(date)
  rename to mes_monthly_report_without_plan_kpis;

create function public.mes_monthly_report(p_month date)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $monthly_report_with_plan_kpis$
  with base as materialized (
    select public.mes_monthly_report_without_plan_kpis(p_month) as value
  ), report_groups as materialized (
    select (row.value->>'order_id')::uuid as order_id,
           nullif(row.value->>'batch_index', '')::integer as batch_index
      from base b
      cross join lateral jsonb_array_elements(coalesce(b.value->'naryads', '[]'::jsonb)) row(value)
  ), target_tasks as materialized (
    select t.id, t.order_id, t.batch_index, t.plan_snapshot
      from public.tasks t
      join report_groups g on g.order_id = t.order_id
       and g.batch_index is not distinct from t.batch_index
  ), group_snapshots as materialized (
    select distinct on (t.order_id, t.batch_index)
           t.order_id, t.batch_index, t.plan_snapshot
      from target_tasks t
     where t.plan_snapshot is not null
     order by t.order_id, t.batch_index, t.id
  ), production_plan as (
    select coalesce(sum(coalesce(
             nullif(part.value->>'need', '')::numeric,
             nullif(part.value->>'plan', '')::numeric,
             0
           )), 0)::numeric as quantity
      from group_snapshots gs
      cross join lateral jsonb_each(gs.plan_snapshot) part(key, value)
     where part.key ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
       and jsonb_typeof(part.value) = 'object'
  ), cutter_plan as (
    select coalesce(sum(coalesce(mr.quantity, 0)), 0)::numeric as quantity
      from target_tasks tt
      join public.material_requests mr on mr.task_id = tt.id
      left join public.nomenclatures n on n.id = mr.nomenclature_id
     where lower(coalesce(n.name, mr.details, '')) like '%фрез%'
  )
  select jsonb_set(
           b.value,
           '{summary}',
           coalesce(b.value->'summary', '{}'::jsonb) || jsonb_build_object(
             'planned_qty', pp.quantity,
             'planned_cutters', cp.quantity
           ),
           true
         )
    from base b cross join production_plan pp cross join cutter_plan cp;
$monthly_report_with_plan_kpis$;

revoke all on function public.mes_monthly_report(date) from public;
grant execute on function public.mes_monthly_report(date) to authenticated, service_role;

revoke all on function public.mes_monthly_report_without_plan_kpis(date) from public;
grant execute on function public.mes_monthly_report_without_plan_kpis(date) to authenticated, service_role;

comment on function public.mes_monthly_report(date) is
  'Monthly MES report with product names and planned production/cutter KPI totals.';
