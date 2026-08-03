-- Add factual cut quantity to an already deployed drilldown without relying on
-- pg_get_functiondef text formatting. qty_completed is already net of scrap.

alter function public.mes_monthly_naryad_detail(date, uuid, integer)
  rename to mes_monthly_naryad_detail_without_cut_fact;

create function public.mes_monthly_naryad_detail(
  p_month date,
  p_order_id uuid,
  p_batch_index integer default null
)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $monthly_detail_with_cut_fact$
  with base as materialized (
    select public.mes_monthly_naryad_detail_without_cut_fact(
      p_month, p_order_id, p_batch_index
    ) as value
  ), target_tasks as materialized (
    select t.id
      from public.tasks t
     where t.order_id = p_order_id
       and t.batch_index is not distinct from p_batch_index
  ), actual as materialized (
    select h.nomenclature_id, sum(coalesce(h.qty_completed, 0))::numeric as quantity
      from public.work_cards wc
      join public.work_card_history h on h.card_id = wc.id
     where wc.task_id in (select id from target_tasks)
       and lower(btrim(coalesce(h.stage_name, ''))) = 'розкрій'
     group by h.nomenclature_id
  ), enriched_details as (
    select coalesce(jsonb_agg(
      detail.value || jsonb_build_object(
        'actual_cut_qty', coalesce(a.quantity, 0),
        'actual_bz_qty', greatest(coalesce(a.quantity, 0) - coalesce((detail.value->>'planned_qty')::numeric, 0), 0)
      )
      order by detail.ordinality
    ), '[]'::jsonb) as value
      from base b
      cross join lateral jsonb_array_elements(coalesce(b.value->'details', '[]'::jsonb))
        with ordinality as detail(value, ordinality)
      left join actual a on a.nomenclature_id::text = detail.value->>'nomenclature_id'
  )
  select jsonb_set(b.value, '{details}', e.value, true)
    from base b cross join enriched_details e;
$monthly_detail_with_cut_fact$;

revoke all on function public.mes_monthly_naryad_detail(date, uuid, integer) from public;
grant execute on function public.mes_monthly_naryad_detail(date, uuid, integer)
  to authenticated, service_role;

revoke all on function public.mes_monthly_naryad_detail_without_cut_fact(date, uuid, integer) from public;
grant execute on function public.mes_monthly_naryad_detail_without_cut_fact(date, uuid, integer)
  to authenticated, service_role;

comment on function public.mes_monthly_naryad_detail(date, uuid, integer) is
  'Naryad drilldown with FACT = net completed cutting quantity, including reissue cards.';
