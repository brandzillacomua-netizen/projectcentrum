-- rollout-contract: v1
-- risk: medium
-- transaction: transactional
-- preflight: supabase/diagnostics/20261016090000_fix_packaging_sgp_id_reservations_preflight.sql
-- postcondition: supabase/diagnostics/20261016090000_fix_packaging_sgp_id_reservations_postcondition.sql
-- rollback: supabase/rollbacks/20261016090000_fix_packaging_sgp_id_reservations_rollback.sql
SET lock_timeout = '5s';
SET statement_timeout = '60s';

BEGIN;

-- Manual SGP issue: resolve inventory strictly by nomenclature_id. Names are not
-- an accounting key and are intentionally not used here.
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
  if v_req.nomenclature_id is null then
    return jsonb_build_object('success', false, 'message', 'У запиті відсутній ID номенклатури');
  end if;

  v_qty := coalesce(v_req.quantity, 0);
  if v_qty <= 0 then
    return jsonb_build_object('success', false, 'message', 'Кількість запиту має бути більшою за нуль');
  end if;

  select * into v_inv
  from public.inventory i
  where i.nomenclature_id = v_req.nomenclature_id
    and (i.pocket_owner is null or i.pocket_owner = 'Не вказано')
    and lower(coalesce(i.type, '')) in ('finished', 'part', 'product', 'bz', 'bz_shop2', 'wip_bz', 'semi', 'semi_shop2')
    and coalesce(i.total_qty, 0) - coalesce(i.reserved_qty, 0) >= v_qty
  order by
    case when i.id = v_req.inventory_id then 0 else 1 end,
    (coalesce(i.total_qty, 0) - coalesce(i.reserved_qty, 0)) desc,
    i.id
  limit 1
  for update;

  if v_inv.id is null then
    return jsonb_build_object('success', false, 'message', 'Недостатньо вільного залишку СГП за ID номенклатури');
  end if;

  v_available := greatest(0, coalesce(v_inv.total_qty, 0) - coalesce(v_inv.reserved_qty, 0));
  update public.material_requests
  set status = 'issued',
      inventory_id = v_inv.id,
      details = coalesce(details, '') || ' [ВИДАНО СГП: ' || coalesce(nullif(trim(p_issuer_name), ''), 'Комірник СГП') || ' ' || to_char(now(), 'DD.MM.YYYY HH24:MI') || ']'
  where id = p_request_id;

  return jsonb_build_object(
    'success', true,
    'message', 'Позицію видано та зарезервовано для пакування',
    'inventory_id', v_inv.id,
    'available_before', v_available,
    'reserved_qty', v_qty
  );
end;
$$;

grant execute on function public.issue_packaging_request_from_sgp(uuid, text) to authenticated;
grant execute on function public.issue_packaging_request_from_sgp(uuid, text) to service_role;

-- Restore system-created initial SGP allocations that the previous repair could
-- classify as ordinary pending requests. The task snapshot is the authoritative
-- source of the initially allocated quantity; inventory is linked strictly by ID.
with initial_allocations as (
  select
    mr.id as request_id,
    (
      select i.id
      from public.inventory i
      where i.nomenclature_id = mr.nomenclature_id
        and (i.pocket_owner is null or i.pocket_owner = 'Не вказано')
        and lower(coalesce(i.type, '')) in ('finished', 'part', 'product', 'bz', 'bz_shop2', 'wip_bz', 'semi', 'semi_shop2')
      order by (coalesce(i.total_qty, 0) - coalesce(i.reserved_qty, 0)) desc, i.id
      limit 1
    ) as inventory_id
  from public.material_requests mr
  join public.tasks t on t.id = mr.task_id
  where mr.status in ('pending', 'issued')
    and coalesce(t.step, '') <> 'Пакування'
    and mr.details ilike '%[PACKAGING_SOURCE:SGP]%'
    and coalesce((t.plan_snapshot -> (mr.nomenclature_id::text) ->> 'stock')::numeric, 0) >= coalesce(mr.quantity, 0)
)
update public.material_requests mr
set status = 'issued',
    inventory_id = ia.inventory_id
from initial_allocations ia
where mr.id = ia.request_id
  and ia.inventory_id is not null;

-- Existing follow-up requests created with the full plan are reduced by the
-- quantity already allocated automatically when the order was created.
with corrected as (
  select
    mr.id,
    greatest(
      0,
      coalesce((t.plan_snapshot -> (mr.nomenclature_id::text) ->> 'need')::numeric, mr.quantity)
      - coalesce((t.plan_snapshot -> (mr.nomenclature_id::text) ->> 'stock')::numeric, 0)
      - coalesce((
          select sum(other.quantity)
          from public.material_requests other
          where other.task_id = mr.task_id
            and other.nomenclature_id = mr.nomenclature_id
            and other.status in ('issued', 'completed')
        ), 0)
    ) as corrected_qty
  from public.material_requests mr
  join public.tasks t on t.id = mr.task_id
  where mr.status in ('pending', 'processing')
    and t.step = 'Пакування'
    and mr.details ilike '%[PACKAGING_SOURCE:SGP]%'
)
update public.material_requests mr
set quantity = corrected.corrected_qty,
    status = case when corrected.corrected_qty > 0 then mr.status else 'cancelled' end
from corrected
where mr.id = corrected.id
  and mr.quantity is distinct from corrected.corrected_qty;

COMMIT;
