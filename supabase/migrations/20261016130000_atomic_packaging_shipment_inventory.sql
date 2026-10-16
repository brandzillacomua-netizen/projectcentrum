-- rollout-contract: v1
-- risk: medium
-- transaction: transactional
-- preflight: supabase/diagnostics/20261016130000_atomic_packaging_shipment_inventory_preflight.sql
-- postcondition: supabase/diagnostics/20261016130000_atomic_packaging_shipment_inventory_postcondition.sql
-- rollback: supabase/rollbacks/20261016130000_atomic_packaging_shipment_inventory_rollback.sql
SET lock_timeout = '5s';
SET statement_timeout = '60s';

BEGIN;

-- Consume all packaging reservations and mark the shipment in one transaction.
create or replace function public.complete_packaging_shipment(
  p_order_id uuid,
  p_task_ids uuid[],
  p_shipping_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_task_count integer;
  v_locked_task_count integer;
  v_inventory record;
  v_slip_number bigint;
  v_completed_requests integer := 0;
  v_deducted_qty numeric := 0;
  v_all_shipped boolean := false;
begin
  if auth.uid() is null or not exists (
    select 1
    from public.system_users su
    where su.auth_user_id = auth.uid()
      and (
        coalesce((su.access_rights->>'shipping')::boolean, false)
        or coalesce((su.access_rights->>'admin')::boolean, false)
        or coalesce((su.access_rights->>'director')::boolean, false)
      )
  ) then
    raise exception 'Shipping permission required' using errcode = '42501';
  end if;

  if p_order_id is null or coalesce(cardinality(p_task_ids), 0) = 0 then
    raise exception 'order_id and task_ids are required' using errcode = '22004';
  end if;

  select count(distinct ids.task_id) into v_task_count
  from unnest(p_task_ids) as ids(task_id);

  perform 1
  from public.tasks t
  where t.id = any(p_task_ids)
  order by t.id
  for update;

  select count(*) into v_locked_task_count
  from public.tasks t
  where t.id = any(p_task_ids)
    and t.order_id = p_order_id
    and (
      coalesce((t.plan_snapshot #>> '{_metadata,is_packaged}')::boolean, false)
      or coalesce((t.plan_snapshot #>> '{_metadata,is_shipped}')::boolean, false)
    );

  if v_locked_task_count <> v_task_count then
    raise exception 'Shipment contains an unknown, foreign, or unpackaged task' using errcode = 'P0001';
  end if;

  select nullif(t.plan_snapshot #>> '{_metadata,packing_slip_number}', '')::bigint
  into v_slip_number
  from public.tasks t
  where t.id = any(p_task_ids)
    and (t.plan_snapshot #>> '{_metadata,packing_slip_number}') ~ '^[0-9]+$'
  order by t.id
  limit 1;

  if v_slip_number is null then
    v_slip_number := public.mes_next_packing_slip_number();
  end if;

  -- A logical issue may be split over multiple physical inventory rows.
  perform 1
  from public.inventory i
  where exists (
    select 1
    from public.material_requests mr
    where mr.inventory_id = i.id
      and mr.task_id = any(p_task_ids)
      and mr.status = 'issued'
      and mr.details ilike '%ЗАПИТ НА КОМПЛЕКТУВАННЯ%'
      and mr.details not ilike '%лист%'
      and mr.details not ilike '%sheet%'
      and mr.details not ilike '%фрез%'
  )
  order by i.id
  for update;

  for v_inventory in
    select i.id, i.total_qty, sum(mr.quantity)::numeric as qty
    from public.material_requests mr
    join public.inventory i on i.id = mr.inventory_id
    where mr.task_id = any(p_task_ids)
      and mr.status = 'issued'
      and mr.details ilike '%ЗАПИТ НА КОМПЛЕКТУВАННЯ%'
      and mr.details not ilike '%лист%'
      and mr.details not ilike '%sheet%'
      and mr.details not ilike '%фрез%'
    group by i.id, i.total_qty
    order by i.id
  loop
    if coalesce(v_inventory.total_qty, 0) < v_inventory.qty then
      raise exception 'Недостатньо залишку для завершення відвантаження: inventory %, доступно %, потрібно %',
        v_inventory.id, coalesce(v_inventory.total_qty, 0), v_inventory.qty;
    end if;

    update public.inventory
    set total_qty = total_qty - v_inventory.qty,
        updated_at = now()
    where id = v_inventory.id;
    v_deducted_qty := v_deducted_qty + v_inventory.qty;
  end loop;

  update public.material_requests mr
  set status = 'completed'
  where mr.task_id = any(p_task_ids)
    and mr.status = 'issued'
    and mr.details ilike '%ЗАПИТ НА КОМПЛЕКТУВАННЯ%'
    and mr.details not ilike '%лист%'
    and mr.details not ilike '%sheet%'
    and mr.details not ilike '%фрез%';
  get diagnostics v_completed_requests = row_count;

  update public.tasks t
  set plan_snapshot = jsonb_set(
    coalesce(t.plan_snapshot, '{}'::jsonb),
    '{_metadata}',
    coalesce(t.plan_snapshot->'_metadata', '{}'::jsonb)
      || coalesce(p_shipping_metadata, '{}'::jsonb)
      || jsonb_build_object(
        'is_shipped', true,
        'shipped_at', coalesce(
          p_shipping_metadata->>'shipped_at',
          t.plan_snapshot #>> '{_metadata,shipped_at}',
          now()::text
        ),
        'packing_slip_number', v_slip_number
      ),
    true
  )
  where t.id = any(p_task_ids);

  select bool_and(coalesce((t.plan_snapshot #>> '{_metadata,is_shipped}')::boolean, false))
  into v_all_shipped
  from public.tasks t
  where t.order_id = p_order_id;

  if coalesce(v_all_shipped, false) then
    update public.orders set status = 'shipped' where id = p_order_id;
  end if;

  return jsonb_build_object(
    'success', true,
    'packing_slip_number', v_slip_number,
    'completed_requests', v_completed_requests,
    'deducted_qty', v_deducted_qty,
    'order_shipped', coalesce(v_all_shipped, false)
  );
end;
$$;

revoke all on function public.complete_packaging_shipment(uuid, uuid[], jsonb) from public, anon;
grant execute on function public.complete_packaging_shipment(uuid, uuid[], jsonb) to authenticated;

COMMIT;
