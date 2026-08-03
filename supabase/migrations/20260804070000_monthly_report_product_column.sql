-- Add product names to each monthly naryad without rebuilding or rescanning the
-- report implementation. The wrapper enriches the already aggregated JSON.

alter function public.mes_monthly_report(date)
  rename to mes_monthly_report_without_products;

create function public.mes_monthly_report(p_month date)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $monthly_report_with_products$
  with base as materialized (
    select public.mes_monthly_report_without_products(p_month) as value
  ), enriched_naryads as (
    select coalesce(jsonb_agg(
      naryad.value || jsonb_build_object(
        'product_name', coalesce(products.name, '—')
      ) order by naryad.ordinality
    ), '[]'::jsonb) as value
      from base b
      cross join lateral jsonb_array_elements(coalesce(b.value->'naryads', '[]'::jsonb))
        with ordinality as naryad(value, ordinality)
      left join lateral (
        select string_agg(distinct n.name, ', ' order by n.name) as name
          from public.order_items oi
          join public.nomenclatures n on n.id = oi.nomenclature_id
         where oi.order_id = (naryad.value->>'order_id')::uuid
      ) products on true
  )
  select jsonb_set(b.value, '{naryads}', e.value, true)
    from base b cross join enriched_naryads e;
$monthly_report_with_products$;

revoke all on function public.mes_monthly_report(date) from public;
grant execute on function public.mes_monthly_report(date) to authenticated, service_role;

revoke all on function public.mes_monthly_report_without_products(date) from public;
grant execute on function public.mes_monthly_report_without_products(date) to authenticated, service_role;

comment on function public.mes_monthly_report(date) is
  'Monthly MES report enriched with product names from order items.';
