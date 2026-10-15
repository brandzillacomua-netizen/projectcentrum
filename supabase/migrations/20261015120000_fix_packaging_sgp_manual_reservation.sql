-- rollout-contract: v1
-- risk: medium
-- transaction: transactional
-- preflight: supabase/diagnostics/20261015120000_fix_packaging_sgp_manual_reservation_preflight.sql
-- postcondition: supabase/diagnostics/20261015120000_fix_packaging_sgp_manual_reservation_postcondition.sql
-- rollback: supabase/rollbacks/20261015120000_fix_packaging_sgp_manual_reservation_rollback.sql
SET lock_timeout = '5s';
SET statement_timeout = '60s';

BEGIN;

-- Packaging requests must be confirmed by an SGP employee. Confirmation reserves
-- stock for packaging; physical stock is deducted only when packaging is completed.
drop function if exists public.issue_packaging_request_from_sgp(bigint, text);

create or replace function public.issue_packaging_request_from_sgp(
  p_request_id uuid,
  p_issuer_name text default 'Комірник СГП'
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_req public.material_requests%rowtype;
  v_inv public.inventory%rowtype;
  v_qty numeric;
  v_available numeric;
begin
  select * into v_req
  from public.material_requests
  where id = p_request_id
  for update;

  if not found then
    return jsonb_build_object('success', false, 'message', 'Запит не знайдено');
  end if;

  if v_req.status in ('issued', 'completed') then
    return jsonb_build_object('success', true, 'message', 'Запит вже видано');
  end if;

  if v_req.status not in ('pending', 'processing') then
    return jsonb_build_object('success', false, 'message', 'Запит не очікує видачі');
  end if;

  v_qty := coalesce(v_req.quantity, 0);
  if v_qty <= 0 then
    return jsonb_build_object('success', false, 'message', 'Кількість запиту має бути більшою за нуль');
  end if;

  if v_req.inventory_id is not null then
    select * into v_inv
    from public.inventory
    where id = v_req.inventory_id and warehouse = 'sgp'
    for update;
  elsif v_req.nomenclature_id is not null then
    select * into v_inv
    from public.inventory
    where nomenclature_id = v_req.nomenclature_id and warehouse = 'sgp'
    order by (coalesce(total_qty, 0) - coalesce(reserved_qty, 0)) desc, id
    limit 1
    for update;
  end if;

  if v_inv.id is null then
    return jsonb_build_object('success', false, 'message', 'Не знайдено залишок цієї позиції на СГП');
  end if;

  v_available := greatest(0, coalesce(v_inv.total_qty, 0) - coalesce(v_inv.reserved_qty, 0));
  if v_available < v_qty then
    return jsonb_build_object(
      'success', false,
      'message', format('Недостатньо вільного залишку СГП: доступно %s шт, потрібно %s шт', v_available, v_qty)
    );
  end if;

  update public.material_requests
  set status = 'issued',
      inventory_id = v_inv.id,
      details = coalesce(details, '') || ' [ВИДАНО СГП: ' || coalesce(nullif(trim(p_issuer_name), ''), 'Комірник СГП') || ' ' || to_char(now(), 'DD.MM.YYYY HH24:MI') || ']'
  where id = p_request_id;

  -- trg_reconcile_inventory_reserve recalculates inventory.reserved_qty after
  -- this status change. total_qty intentionally remains unchanged here.
  return jsonb_build_object(
    'success', true,
    'message', 'Позицію видано та зарезервовано для пакування',
    'inventory_id', v_inv.id,
    'reserved_qty', v_qty
  );
end;
$$;

grant execute on function public.issue_packaging_request_from_sgp(uuid, text) to authenticated;
grant execute on function public.issue_packaging_request_from_sgp(uuid, text) to service_role;

-- Repair requests that the old client marked as issued without linking stock or
-- recording an actual SGP employee action. Legitimate initial task reservations
-- have inventory_id populated and are intentionally preserved.
update public.material_requests
set status = 'pending'
where status = 'issued'
  and inventory_id is null
  and (
    details ilike '%[PACKAGING_SOURCE:SGP]%'
    or details ilike '%[PACKAGING_SOURCE:BZ]%'
  )
  and details not ilike '%[ВИДАНО СГП:%';

COMMIT;
