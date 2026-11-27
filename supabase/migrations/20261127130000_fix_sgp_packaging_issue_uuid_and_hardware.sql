-- Fix issue_packaging_request_from_sgp parameter type (bigint -> uuid)
-- and allow SGP / hardware items (rubber, screws, standoffs) to be issued.
SET lock_timeout = '5s';
SET statement_timeout = '60s';

BEGIN;

CREATE OR REPLACE FUNCTION public.normalize_sgp_identity(p_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT translate(
    regexp_replace(lower(trim(coalesce(p_value, ''))), '[[:space:]_-]+', '-', 'g'),
    'авекмнорстх',
    'abekmhopctx'
  );
$$;

DROP FUNCTION IF EXISTS public.issue_packaging_request_from_sgp(bigint, text);

CREATE OR REPLACE FUNCTION public.issue_packaging_request_from_sgp(
  p_request_id uuid,
  p_issuer_name text DEFAULT 'Комірник СГП'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_req public.material_requests%ROWTYPE;
  v_req_name text;
  v_inv public.inventory%ROWTYPE;
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
BEGIN
  SELECT * INTO v_req
  FROM public.material_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Запит не знайдено');
  END IF;
  IF v_req.status IN ('issued', 'completed') THEN
    RETURN jsonb_build_object('success', true, 'message', 'Запит вже видано');
  END IF;
  IF v_req.status NOT IN ('pending', 'processing') THEN
    RETURN jsonb_build_object('success', false, 'message', 'Запит не очікує видачі');
  END IF;
  IF coalesce(v_req.quantity, 0) <= 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Кількість запиту має бути більшою за нуль');
  END IF;

  SELECT n.name INTO v_req_name
  FROM public.nomenclatures_v2 n
  WHERE n.id = v_req.nomenclature_id;

  IF nullif(trim(coalesce(v_req_name, '')), '') IS NULL THEN
    SELECT i.name INTO v_req_name
    FROM public.inventory i
    WHERE i.nomenclature_id = v_req.nomenclature_id
    ORDER BY coalesce(i.total_qty, 0) DESC, i.id
    LIMIT 1;
  END IF;

  -- Lock all contributing rows before checking the total.
  FOR v_inv IN
    SELECT i.*
    FROM public.inventory i
    WHERE (i.pocket_owner IS NULL OR i.pocket_owner = 'Не вказано')
      AND (
        lower(coalesce(i.type, '')) IN ('finished', 'part', 'product', 'bz', 'bz_shop2', 'wip_bz', 'semi', 'semi_shop2')
        OR (
          lower(coalesce(i.type, '')) IN ('hardware', 'fastener', 'mount')
          AND lower(coalesce(i.warehouse, '')) IN ('sgp', 'production')
        )
      )
      AND (
        i.nomenclature_id = v_req.nomenclature_id
        OR (
          nullif(trim(coalesce(v_req_name, '')), '') IS NOT NULL
          AND public.normalize_sgp_identity(i.name) = public.normalize_sgp_identity(v_req_name)
        )
      )
    ORDER BY
      CASE WHEN i.id = v_req.inventory_id THEN 0 ELSE 1 END,
      CASE WHEN lower(coalesce(i.warehouse, '')) = 'sgp' THEN 0 ELSE 1 END,
      greatest(0, coalesce(i.total_qty, 0) - coalesce(i.reserved_qty, 0)) DESC,
      i.id
    FOR UPDATE
  LOOP
    v_available := greatest(0, coalesce(v_inv.total_qty, 0) - coalesce(v_inv.reserved_qty, 0));
    IF v_available > 0 THEN
      v_total_available := v_total_available + v_available;
      v_candidates := v_candidates || jsonb_build_array(jsonb_build_object(
        'inventory_id', v_inv.id,
        'available', v_available
      ));
    END IF;
  END LOOP;

  IF v_total_available < v_req.quantity THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Недостатньо залишку СГП: доступно ' || v_total_available || ' шт, потрібно ' || v_req.quantity || ' шт',
      'available', v_total_available,
      'required', v_req.quantity
    );
  END IF;

  v_issuer := coalesce(nullif(trim(p_issuer_name), ''), 'Комірник СГП');
  v_marker := '[ВИДАНО СГП: ' || v_issuer || ' ' || to_char(now(), 'DD.MM.YYYY HH24:MI') || ']';
  v_remaining := v_req.quantity;

  FOR v_candidate IN SELECT value FROM jsonb_array_elements(v_candidates)
  LOOP
    EXIT WHEN v_remaining <= 0;
    v_inventory_id := (v_candidate->>'inventory_id')::uuid;
    v_available := (v_candidate->>'available')::numeric;
    v_take := least(v_available, v_remaining);

    IF v_first THEN
      UPDATE public.material_requests
      SET status = 'issued',
          quantity = v_take,
          inventory_id = v_inventory_id,
          details = coalesce(details, '') || ' ' || v_marker
      WHERE id = v_req.id;
      v_first := false;
    ELSE
      INSERT INTO public.material_requests (
        order_id, task_id, nomenclature_id, quantity, status, inventory_id,
        category, target_warehouse, details
      ) VALUES (
        v_req.order_id, v_req.task_id, v_req.nomenclature_id, v_take, 'issued', v_inventory_id,
        v_req.category, v_req.target_warehouse,
        coalesce(v_req.details, '') || ' [ЧАСТКОВА ВИДАЧА ЄДИНОГО ЗАЛИШКУ] ' || v_marker
      );
    END IF;

    v_allocations := v_allocations || jsonb_build_array(jsonb_build_object(
      'inventory_id', v_inventory_id,
      'quantity', v_take
    ));
    v_remaining := v_remaining - v_take;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Позицію видано з єдиного логічного залишку СГП',
    'available_before', v_total_available,
    'reserved_qty', v_req.quantity,
    'allocations', v_allocations
  );
END;
$$;

REVOKE ALL ON FUNCTION public.issue_packaging_request_from_sgp(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.issue_packaging_request_from_sgp(uuid, text) TO authenticated, service_role;

COMMIT;
