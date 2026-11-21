-- Detailed stock formation & movement breakdown RPC for Operational Warehouse (CO)

create or replace function public.get_operational_stock_history(
  p_inventory_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $stock_hist$
declare
  v_inv public.inventory%rowtype;
  v_nom_id uuid;
  v_receptions jsonb;
  v_manual_issues jsonb;
  v_adjustments jsonb;
  v_active_reserves jsonb;
  v_completed_requests jsonb;
begin
  select * into v_inv from public.inventory where id = p_inventory_id;
  if not found then
    raise exception 'Позицію складу не знайдено';
  end if;

  v_nom_id := v_inv.nomenclature_id;

  -- 1. Receptions (Прихід на склад)
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', d.id,
        'created_at', d.created_at,
        'status', d.status,
        'source_warehouse', d.source_warehouse,
        'target_warehouse', d.target_warehouse,
        'order_num', o.order_num,
        'qty', case
          when coalesce(item ->> 'qty', item ->> 'quantity', item ->> 'needed', '') ~ '^[0-9]+([.,][0-9]+)?$'
            then replace(coalesce(item ->> 'qty', item ->> 'quantity', item ->> 'needed'), ',', '.')::numeric
          else 0
        end
      )
      order by d.created_at desc
    ),
    '[]'::jsonb
  )
  into v_receptions
  from public.reception_docs d
  cross join lateral jsonb_array_elements(coalesce(d.items, '[]'::jsonb)) as item
  left join public.orders o on o.id = d.order_id
  where d.status in ('completed', 'shipped')
    and (
      v_inv.warehouse is null
      or d.target_warehouse = v_inv.warehouse
      or (v_inv.warehouse = 'operational' and d.target_warehouse is null)
    )
    and (
      (v_nom_id is not null and (item ->> 'nomenclature_id') = v_nom_id::text)
      or (v_nom_id is null and lower(trim(coalesce(item ->> 'name', ''))) = lower(trim(coalesce(v_inv.name, ''))))
    );

  -- 2. Manual warehouse issues (Ручна видача)
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', m.id,
        'created_at', m.created_at,
        'quantity', m.quantity,
        'unit', m.unit,
        'stock_before', m.stock_before,
        'stock_after', m.stock_after,
        'issued_by_name', m.issued_by_name,
        'source_module', m.source_module
      )
      order by m.created_at desc
    ),
    '[]'::jsonb
  )
  into v_manual_issues
  from public.manual_inventory_issues m
  where v_nom_id is not null and m.nomenclature_id = v_nom_id;

  -- 3. Manual adjustments (+/- корекції)
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', a.id,
        'created_at', a.created_at,
        'action', a.action,
        'delta_qty', a.delta_qty,
        'qty_before', a.qty_before,
        'qty_after', a.qty_after,
        'reason', a.reason,
        'actor_name', a.actor_name
      )
      order by a.created_at desc
    ),
    '[]'::jsonb
  )
  into v_adjustments
  from public.inventory_manual_adjustments a
  where a.inventory_id = p_inventory_id
     or (v_nom_id is not null and a.nomenclature_id = v_nom_id);

  -- 4. Active reserves (Заброньовано зараз під наряди)
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', mr.id,
        'created_at', mr.created_at,
        'quantity', mr.quantity,
        'order_num', o.order_num,
        'customer', o.customer,
        'details', mr.details
      )
      order by mr.created_at desc
    ),
    '[]'::jsonb
  )
  into v_active_reserves
  from public.material_requests mr
  left join public.orders o on o.id = mr.order_id
  where mr.inventory_id = p_inventory_id
    and mr.status = 'issued';

  -- 5. Completed requests (Списано по нарядах)
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', mr.id,
        'created_at', mr.created_at,
        'quantity', mr.quantity,
        'order_num', o.order_num,
        'customer', o.customer,
        'details', mr.details
      )
      order by mr.created_at desc
    ),
    '[]'::jsonb
  )
  into v_completed_requests
  from (
    select *
    from public.material_requests mr
    where mr.inventory_id = p_inventory_id
      and mr.status = 'completed'
    order by mr.created_at desc
    limit 100
  ) mr
  left join public.orders o on o.id = mr.order_id;

  return jsonb_build_object(
    'item', jsonb_build_object(
      'id', v_inv.id,
      'name', v_inv.name,
      'unit', coalesce(v_inv.unit, 'шт'),
      'warehouse', v_inv.warehouse,
      'total_qty', coalesce(v_inv.total_qty, 0),
      'reserved_qty', coalesce(v_inv.reserved_qty, 0),
      'available_qty', greatest(coalesce(v_inv.total_qty, 0) - coalesce(v_inv.reserved_qty, 0), 0)
    ),
    'receptions', v_receptions,
    'manual_issues', v_manual_issues,
    'adjustments', v_adjustments,
    'active_reserves', v_active_reserves,
    'completed_requests', v_completed_requests
  );
end;
$stock_hist$;

revoke all on function public.get_operational_stock_history(uuid) from public;
grant execute on function public.get_operational_stock_history(uuid) to anon, authenticated;

notify pgrst, 'reload schema';
