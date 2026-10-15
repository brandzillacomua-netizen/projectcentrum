-- rollout-contract: v1
-- risk: medium
-- transaction: transactional
-- preflight: supabase/diagnostics/20261016110000_unify_sgp_logical_stock_preflight.sql
-- postcondition: supabase/diagnostics/20261016110000_unify_sgp_logical_stock_postcondition.sql
-- rollback: supabase/rollbacks/20261016110000_unify_sgp_logical_stock_rollback.sql
SET lock_timeout = '5s';
SET statement_timeout = '60s';

BEGIN;

create or replace function public.normalize_sgp_identity(p_value text)
returns text
language sql
immutable
parallel safe
as $$
  select translate(
    regexp_replace(lower(trim(coalesce(p_value, ''))), '[[:space:]_-]+', '-', 'g'),
    'авекмнорстх',
    'abekmhopctx'
  );
$$;

-- Treat every SGP inventory row belonging to the same nomenclature identity as
-- one logical balance. Reservations can be distributed across several internal
-- rows, but the operation is atomic and remains one request to the user.
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
  v_req_name text;
  v_inv public.inventory%rowtype;
  v_candidates jsonb := '[]'::jsonb;
  v_candidate jsonb;
  v_allocations jsonb := '[]'::jsonb;
  v_total_available numeric := 0;
  v_remaining numeric;
  v_available numeric;
  v_take numeric;
  v_inventory_id uuid;
  v_first boolean := true;
  v_issuer text;
  v_marker text;
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
  if coalesce(v_req.quantity, 0) <= 0 then
    return jsonb_build_object('success', false, 'message', 'Кількість запиту має бути більшою за нуль');
  end if;

  select n.name into v_req_name
  from public.nomenclatures_v2 n
  where n.id = v_req.nomenclature_id;

  if nullif(trim(coalesce(v_req_name, '')), '') is null then
    select i.name into v_req_name
    from public.inventory i
    where i.nomenclature_id = v_req.nomenclature_id
    order by coalesce(i.total_qty, 0) desc, i.id
    limit 1;
  end if;

  -- Lock all contributing rows before checking the total. This prevents two
  -- workers from issuing the same logical stock concurrently.
  for v_inv in
    select i.*
    from public.inventory i
    where (i.pocket_owner is null or i.pocket_owner = 'Не вказано')
      and lower(coalesce(i.type, '')) in ('finished', 'part', 'product', 'bz', 'bz_shop2', 'wip_bz', 'semi', 'semi_shop2')
      and (
        i.nomenclature_id = v_req.nomenclature_id
        or (
          nullif(trim(coalesce(v_req_name, '')), '') is not null
          and public.normalize_sgp_identity(i.name) = public.normalize_sgp_identity(v_req_name)
        )
      )
    order by
      case when i.id = v_req.inventory_id then 0 else 1 end,
      greatest(0, coalesce(i.total_qty, 0) - coalesce(i.reserved_qty, 0)) desc,
      i.id
    for update
  loop
    v_available := greatest(0, coalesce(v_inv.total_qty, 0) - coalesce(v_inv.reserved_qty, 0));
    if v_available > 0 then
      v_total_available := v_total_available + v_available;
      v_candidates := v_candidates || jsonb_build_array(jsonb_build_object(
        'inventory_id', v_inv.id,
        'available', v_available
      ));
    end if;
  end loop;

  if v_total_available < v_req.quantity then
    return jsonb_build_object(
      'success', false,
      'message', 'Недостатньо залишку СГП: доступно ' || v_total_available || ' шт, потрібно ' || v_req.quantity || ' шт',
      'available', v_total_available,
      'required', v_req.quantity
    );
  end if;

  v_issuer := coalesce(nullif(trim(p_issuer_name), ''), 'Комірник СГП');
  v_marker := '[ВИДАНО СГП: ' || v_issuer || ' ' || to_char(now(), 'DD.MM.YYYY HH24:MI') || ']';
  v_remaining := v_req.quantity;

  for v_candidate in select value from jsonb_array_elements(v_candidates)
  loop
    exit when v_remaining <= 0;
    v_inventory_id := (v_candidate->>'inventory_id')::uuid;
    v_available := (v_candidate->>'available')::numeric;
    v_take := least(v_available, v_remaining);

    if v_first then
      update public.material_requests
      set status = 'issued',
          quantity = v_take,
          inventory_id = v_inventory_id,
          details = coalesce(details, '') || ' ' || v_marker
      where id = v_req.id;
      v_first := false;
    else
      insert into public.material_requests (
        order_id, task_id, nomenclature_id, quantity, status, inventory_id,
        category, target_warehouse, details
      ) values (
        v_req.order_id, v_req.task_id, v_req.nomenclature_id, v_take, 'issued', v_inventory_id,
        v_req.category, v_req.target_warehouse,
        coalesce(v_req.details, '') || ' [ЧАСТКОВА ВИДАЧА ЄДИНОГО ЗАЛИШКУ] ' || v_marker
      );
    end if;

    v_allocations := v_allocations || jsonb_build_array(jsonb_build_object(
      'inventory_id', v_inventory_id,
      'quantity', v_take
    ));
    v_remaining := v_remaining - v_take;
  end loop;

  return jsonb_build_object(
    'success', true,
    'message', 'Позицію видано з єдиного логічного залишку СГП',
    'available_before', v_total_available,
    'reserved_qty', v_req.quantity,
    'allocations', v_allocations
  );
end;
$$;

grant execute on function public.issue_packaging_request_from_sgp(uuid, text) to authenticated;
grant execute on function public.issue_packaging_request_from_sgp(uuid, text) to service_role;

COMMIT;
