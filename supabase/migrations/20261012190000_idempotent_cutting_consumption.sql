-- rollout-contract: v1
-- risk: high
-- transaction: transactional
-- preflight: supabase/diagnostics/20261012190000_idempotent_cutting_consumption_preflight.sql
-- postcondition: supabase/diagnostics/20261012190000_idempotent_cutting_consumption_postcondition.sql
-- rollback: supabase/rollbacks/20261012190000_idempotent_cutting_consumption_rollback.sql
SET lock_timeout = '5s';
SET statement_timeout = '60s';

begin;

create table if not exists mes_private.cutting_consumption_receipts (
  card_id uuid not null,
  consumption_key text not null,
  inventory_id uuid not null,
  payload jsonb not null,
  result jsonb not null,
  consumed_at timestamptz not null default clock_timestamp(),
  primary key (card_id, consumption_key)
);

revoke all on table mes_private.cutting_consumption_receipts from public, anon, authenticated;

create or replace function public.rpc_consume_cutting_inventory_once(
  p_card_id uuid,
  p_consumption_key text,
  p_inventory_id uuid,
  p_deduct_total numeric,
  p_release_reserved numeric,
  p_request_allocations jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $consume$
declare
  v_inventory public.inventory%rowtype;
  v_receipt mes_private.cutting_consumption_receipts%rowtype;
  v_payload jsonb;
  v_result jsonb;
  v_allocation jsonb;
  v_request_id uuid;
  v_allocate numeric;
  v_request_qty numeric;
  v_new_total numeric;
  v_new_reserved numeric;
  v_card_status text;
  v_card_operation text;
  v_card_task_id uuid;
  v_allocated numeric := 0;
begin
  if auth.uid() is null or public.mes_current_system_user_id() is null then
    raise exception 'Authentication required or MES profile is not linked' using errcode = '42501';
  end if;
  if p_card_id is null or nullif(trim(p_consumption_key), '') is null or p_inventory_id is null then
    raise exception 'card_id, consumption_key and inventory_id are required' using errcode = '22004';
  end if;
  if p_deduct_total is null or p_release_reserved is null
     or p_deduct_total < 0 or p_release_reserved < 0
     or p_deduct_total::text in ('NaN','Infinity','-Infinity')
     or p_release_reserved::text in ('NaN','Infinity','-Infinity') then
    raise exception 'Invalid cutting consumption quantity' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(p_request_allocations, '[]'::jsonb)) <> 'array' then
    raise exception 'request_allocations must be an array' using errcode = '22023';
  end if;

  v_payload := jsonb_build_object(
    'inventory_id', p_inventory_id,
    'deduct_total', p_deduct_total,
    'release_reserved', p_release_reserved,
    'request_allocations', coalesce(p_request_allocations, '[]'::jsonb)
  );

  perform pg_advisory_xact_lock(hashtextextended('cutting-consumption:' || p_card_id::text || ':' || p_consumption_key, 0));

  select * into v_receipt
  from mes_private.cutting_consumption_receipts
  where card_id = p_card_id and consumption_key = p_consumption_key;

  if found then
    -- Reservation rows have already been reduced by the first successful call,
    -- so their derived release/allocation payload can be smaller on a retry.
    -- The immutable consumption facts must still match exactly.
    if (v_receipt.payload->>'inventory_id') is distinct from p_inventory_id::text
       or (v_receipt.payload->>'deduct_total')::numeric is distinct from p_deduct_total then
      raise exception 'Cutting consumption retry has different quantities for card % and key %', p_card_id, p_consumption_key;
    end if;
    return v_receipt.result || jsonb_build_object('replayed', true);
  end if;

  select status, operation, task_id into v_card_status, v_card_operation, v_card_task_id
  from public.work_cards
  where id = p_card_id
  for update;

  if not found then
    raise exception 'Work card % not found', p_card_id using errcode = 'P0002';
  end if;
  if v_card_operation is distinct from 'Розкрій' or v_card_status is distinct from 'in-progress' then
    raise exception 'Cutting card % is not active (operation %, status %)', p_card_id, v_card_operation, v_card_status using errcode = 'P0001';
  end if;

  select * into v_inventory
  from public.inventory
  where id = p_inventory_id
  for update;

  if not found then
    raise exception 'Inventory row % not found', p_inventory_id using errcode = 'P0002';
  end if;
  if lower(coalesce(v_inventory.warehouse, 'operational')) not in ('operational', 'склад оперативний') then
    raise exception 'Inventory row % does not belong to operational warehouse', p_inventory_id using errcode = 'P0001';
  end if;
  if p_deduct_total > coalesce(v_inventory.total_qty, 0) then
    raise exception 'Insufficient stock: available %, requested %', v_inventory.total_qty, p_deduct_total using errcode = 'P0001';
  end if;

  v_new_total := coalesce(v_inventory.total_qty, 0) - p_deduct_total;
  v_new_reserved := greatest(0, coalesce(v_inventory.reserved_qty, 0) - p_release_reserved);

  update public.inventory
  set total_qty = v_new_total,
      reserved_qty = v_new_reserved,
      updated_at = clock_timestamp()
  where id = p_inventory_id;

  for v_allocation in select value from jsonb_array_elements(coalesce(p_request_allocations, '[]'::jsonb))
  loop
    v_request_id := nullif(v_allocation->>'id', '')::uuid;
    v_allocate := greatest(0, coalesce((v_allocation->>'quantity')::numeric, 0));
    if v_request_id is null or v_allocate <= 0 then continue; end if;
    v_allocated := v_allocated + v_allocate;
    if v_allocated > p_release_reserved then
      raise exception 'Request allocations exceed released reservation';
    end if;

    select quantity into v_request_qty
    from public.material_requests
    where id = v_request_id
      and (card_id = p_card_id or task_id = v_card_task_id)
    for update;

    if found then
      update public.material_requests
      set quantity = greatest(0, coalesce(v_request_qty, 0) - v_allocate),
          status = case when greatest(0, coalesce(v_request_qty, 0) - v_allocate) = 0 then 'completed' else status end,
          updated_at = clock_timestamp()
      where id = v_request_id;
    end if;
  end loop;

  v_result := jsonb_build_object(
    'success', true,
    'replayed', false,
    'card_id', p_card_id,
    'consumption_key', p_consumption_key,
    'inventory_id', p_inventory_id,
    'deducted_total', p_deduct_total,
    'released_reserved', p_release_reserved,
    'new_total', v_new_total,
    'new_reserved', v_new_reserved
  );

  insert into mes_private.cutting_consumption_receipts(card_id, consumption_key, inventory_id, payload, result)
  values (p_card_id, p_consumption_key, p_inventory_id, v_payload, v_result);

  return v_result;
end;
$consume$;

revoke all on function public.rpc_consume_cutting_inventory_once(uuid,text,uuid,numeric,numeric,jsonb) from public;
grant execute on function public.rpc_consume_cutting_inventory_once(uuid,text,uuid,numeric,numeric,jsonb) to authenticated, service_role;

notify pgrst, 'reload schema';

commit;
