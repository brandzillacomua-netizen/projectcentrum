-- Migration: Fix Sorting Completion Resilience
-- Fixes rpc_submit_sorting_complete_atomic to use best-effort inventory deduction for semi/wip_bz/bz stock,
-- guards against uq_inventory_sgp_nom_finished unique constraint violations during Shop 2 inventory updates,
-- and ensures mes_private.accounting_receipts table exists / is queried safely.

SET lock_timeout = '3s';
SET statement_timeout = '10s';

BEGIN;

-- Ensure mes_private schema and accounting_receipts table exist
CREATE SCHEMA IF NOT EXISTS mes_private;
CREATE TABLE IF NOT EXISTS mes_private.accounting_receipts (
  operation text NOT NULL,
  operation_key text NOT NULL,
  payload jsonb NOT NULL,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (operation, operation_key)
);

CREATE OR REPLACE FUNCTION public.rpc_submit_sorting_complete_atomic(
  p_card_id uuid,
  p_good_qty numeric,
  p_scrap_qty numeric,
  p_rework_qty numeric,
  p_operator_name text,
  p_shift_name text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $body$
DECLARE
  v_card record;
  v_nom_id uuid;
  v_nom_name text;
  v_unit text;
  v_total_good numeric;
  v_card_bz numeric;
  v_card_need numeric;
  v_actual_need numeric;
  v_actual_bz numeric;
  v_rem numeric;
  v_take numeric;
  v_s1_inv record;
  v_s2_inv record;
  v_scrap_inv record;
  v_shop2_task_id uuid;
  v_shop2_task record;
  v_arrivals jsonb := '[]'::jsonb;
  v_match_idx integer := -1;
  v_receipt record;
  v_payload jsonb := jsonb_build_object('good', p_good_qty, 'scrap', p_scrap_qty, 'rework', p_rework_qty);
  v_result jsonb;
  v_target_task_id uuid := NULL;
BEGIN
  IF p_good_qty IS NULL OR p_scrap_qty IS NULL OR p_rework_qty IS NULL OR
    p_good_qty::text IN ('NaN','Infinity','-Infinity') OR p_scrap_qty::text IN ('NaN','Infinity','-Infinity') OR
    p_rework_qty::text IN ('NaN','Infinity','-Infinity') OR LEAST(p_good_qty, p_scrap_qty, p_rework_qty) < 0 THEN
    RAISE EXCEPTION 'Invalid sorting quantities' USING ERRCODE = '22023';
  END IF;

  -- Lock card
  SELECT * INTO v_card FROM public.work_cards WHERE id = p_card_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Card % not found', p_card_id USING ERRCODE = 'P0002';
  END IF;

  -- Check accounting receipt for idempotency if table exists
  IF to_regclass('mes_private.accounting_receipts') IS NOT NULL THEN
    BEGIN
      EXECUTE 'SELECT payload, result FROM mes_private.accounting_receipts WHERE operation = $1 AND operation_key = $2'
        INTO v_receipt USING 'sorting', p_card_id::text;
      IF v_receipt.result IS NOT NULL THEN
        IF v_receipt.payload IS DISTINCT FROM v_payload THEN 
          RAISE EXCEPTION 'Sorting already completed with different quantities' USING ERRCODE = 'P0001'; 
        END IF;
        RETURN v_receipt.result;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  IF v_card.status IN ('completed', 'at-shop2-buffer') THEN
    RETURN jsonb_build_object('success', true, 'already_sorted', true, 'card_id', p_card_id);
  END IF;

  IF p_good_qty + p_scrap_qty + p_rework_qty <> COALESCE(v_card.quantity, 0) THEN
    RAISE EXCEPTION 'Sorting quantities (% good + % scrap + % rework) do not equal card total %',
      p_good_qty, p_scrap_qty, p_rework_qty, COALESCE(v_card.quantity, 0) USING ERRCODE = 'P0001';
  END IF;

  v_nom_id := v_card.nomenclature_id;
  SELECT name, unit INTO v_nom_name, v_unit FROM public.nomenclatures_v2 WHERE id = v_nom_id LIMIT 1;
  IF v_nom_name IS NULL THEN v_nom_name := 'Деталь'; END IF;
  IF v_unit IS NULL THEN v_unit := 'шт'; END IF;

  v_total_good := GREATEST(0, p_good_qty);

  -- Calculate need vs bz breakdown
  v_card_bz := COALESCE(v_card.buffer_qty, 0);
  IF v_card_bz <= 0 THEN
    v_card_bz := COALESCE((substring(v_card.card_info from '\[BZ:([0-9]+)\]'))::numeric, 0);
  END IF;

  v_card_need := COALESCE((substring(v_card.card_info from '\[REQ:([0-9]+)\]'))::numeric, 0);
  IF v_card_need <= 0 THEN
    v_card_need := COALESCE((substring(v_card.card_info from '\[NEED:([0-9]+)\]'))::numeric, 0);
  END IF;
  IF v_card_need <= 0 THEN
    v_card_need := GREATEST(0, COALESCE(v_card.quantity, 0) - v_card_bz);
  END IF;

  v_actual_need := LEAST(v_total_good, v_card_need);
  v_actual_bz := GREATEST(0, v_total_good - v_actual_need);

  -- 1. Best-effort deduction of Shop 1 semi inventory (never throws if stock is lower)
  IF v_actual_need > 0 AND v_nom_id IS NOT NULL THEN
    UPDATE public.inventory 
    SET total_qty = GREATEST(0, COALESCE(total_qty, 0) - v_actual_need),
        updated_at = NOW()
    WHERE nomenclature_id = v_nom_id AND type = 'semi' AND (warehouse = 'production' OR warehouse IS NULL);
  END IF;

  -- 2. Best-effort deduction of Shop 1 wip_bz / bz inventory
  IF v_actual_bz > 0 AND v_nom_id IS NOT NULL THEN
    v_rem := v_actual_bz;
    SELECT * INTO v_s1_inv FROM public.inventory WHERE nomenclature_id = v_nom_id AND type = 'wip_bz' LIMIT 1 FOR UPDATE;
    IF FOUND THEN
      v_take := LEAST(COALESCE(v_s1_inv.total_qty, 0), v_rem);
      UPDATE public.inventory SET total_qty = GREATEST(0, COALESCE(total_qty, 0) - v_take), updated_at = NOW() WHERE id = v_s1_inv.id;
      v_rem := v_rem - v_take;
    END IF;
    IF v_rem > 0 THEN
      UPDATE public.inventory SET total_qty = GREATEST(0, COALESCE(total_qty, 0) - v_rem), updated_at = NOW() WHERE nomenclature_id = v_nom_id AND type = 'bz';
    END IF;
  END IF;

  -- 3. Increase Shop 2 semi_shop2 inventory
  -- Resilient against uq_inventory_sgp_nom_finished by checking existing SGP or production inventory rows
  IF v_actual_need > 0 AND v_nom_id IS NOT NULL THEN
    SELECT * INTO v_s2_inv FROM public.inventory 
    WHERE nomenclature_id = v_nom_id 
      AND (
        type = 'semi_shop2'
        OR (warehouse = 'sgp' AND pocket_owner IS NULL AND type IN ('finished', 'bz', 'bz_shop2', 'wip_bz', 'semi', 'semi_shop2', 'part', 'product'))
      )
    ORDER BY (CASE WHEN type = 'semi_shop2' THEN 0 ELSE 1 END), updated_at DESC NULLS LAST 
    LIMIT 1 FOR UPDATE;

    IF FOUND THEN
      UPDATE public.inventory SET total_qty = COALESCE(total_qty, 0) + v_actual_need, updated_at = NOW() WHERE id = v_s2_inv.id;
    ELSE
      BEGIN
        INSERT INTO public.inventory (nomenclature_id, name, total_qty, type, unit, reserved_qty, warehouse, updated_at)
        VALUES (v_nom_id, v_nom_name, v_actual_need, 'semi_shop2', v_unit, 0, 'production', NOW());
      EXCEPTION WHEN unique_violation THEN
        UPDATE public.inventory 
        SET total_qty = COALESCE(total_qty, 0) + v_actual_need, updated_at = NOW()
        WHERE nomenclature_id = v_nom_id 
          AND (
            (warehouse = 'sgp' AND pocket_owner IS NULL AND type IN ('finished', 'bz', 'bz_shop2', 'wip_bz', 'semi', 'semi_shop2', 'part', 'product'))
            OR type = 'semi_shop2'
          );
      END;
    END IF;
  END IF;

  -- 4. Increase Shop 2 bz_shop2 inventory
  -- Resilient against uq_inventory_sgp_nom_finished
  IF v_actual_bz > 0 AND v_nom_id IS NOT NULL THEN
    SELECT * INTO v_s2_inv FROM public.inventory 
    WHERE nomenclature_id = v_nom_id 
      AND (
        type = 'bz_shop2'
        OR (warehouse = 'sgp' AND pocket_owner IS NULL AND type IN ('finished', 'bz', 'bz_shop2', 'wip_bz', 'semi', 'semi_shop2', 'part', 'product'))
      )
    ORDER BY (CASE WHEN type = 'bz_shop2' THEN 0 ELSE 1 END), updated_at DESC NULLS LAST 
    LIMIT 1 FOR UPDATE;

    IF FOUND THEN
      UPDATE public.inventory SET total_qty = COALESCE(total_qty, 0) + v_actual_bz, updated_at = NOW() WHERE id = v_s2_inv.id;
    ELSE
      BEGIN
        INSERT INTO public.inventory (nomenclature_id, name, total_qty, type, unit, reserved_qty, warehouse, updated_at)
        VALUES (v_nom_id, v_nom_name, v_actual_bz, 'bz_shop2', v_unit, 0, 'production', NOW());
      EXCEPTION WHEN unique_violation THEN
        UPDATE public.inventory 
        SET total_qty = COALESCE(total_qty, 0) + v_actual_bz, updated_at = NOW()
        WHERE nomenclature_id = v_nom_id 
          AND (
            (warehouse = 'sgp' AND pocket_owner IS NULL AND type IN ('finished', 'bz', 'bz_shop2', 'wip_bz', 'semi', 'semi_shop2', 'part', 'product'))
            OR type = 'bz_shop2'
          );
      END;
    END IF;
  END IF;

  -- 5. Increase scrap_ready if scrap occurred
  IF p_scrap_qty > 0 AND v_nom_id IS NOT NULL THEN
    SELECT * INTO v_scrap_inv FROM public.inventory WHERE nomenclature_id = v_nom_id AND type = 'scrap_ready' LIMIT 1 FOR UPDATE;
    IF FOUND THEN
      UPDATE public.inventory SET total_qty = COALESCE(total_qty, 0) + p_scrap_qty, updated_at = NOW() WHERE id = v_scrap_inv.id;
    ELSE
      BEGIN
        INSERT INTO public.inventory (nomenclature_id, name, total_qty, type, unit, reserved_qty, warehouse, updated_at)
        VALUES (v_nom_id, v_nom_name, p_scrap_qty, 'scrap_ready', v_unit, 0, 'production', NOW());
      EXCEPTION WHEN unique_violation THEN
        UPDATE public.inventory SET total_qty = COALESCE(total_qty, 0) + p_scrap_qty, updated_at = NOW() WHERE nomenclature_id = v_nom_id AND type = 'scrap_ready';
      END;
    END IF;
  END IF;

  -- 6. Update work card to at-shop2-buffer
  UPDATE public.work_cards
  SET status = 'at-shop2-buffer',
      operation = 'Сортування',
      quantity = v_total_good + GREATEST(0, p_rework_qty),
      used_in_shop2_qty = GREATEST(0, p_rework_qty),
      completed_at = NOW(),
      updated_at = NOW()
  WHERE id = p_card_id;

  -- 7. Find Shop 2 task and update task arrivals
  IF v_card.order_id IS NOT NULL THEN
    SELECT * INTO v_shop2_task FROM public.tasks 
    WHERE order_id = v_card.order_id AND step ILIKE '%ЦЕХ №2%' AND status <> 'completed' 
    LIMIT 1 FOR UPDATE;

    IF FOUND THEN
      v_shop2_task_id := v_shop2_task.id;
      v_arrivals := COALESCE(v_shop2_task.plan_snapshot->'arrivals', '[]'::jsonb);
      v_match_idx := -1;
      IF jsonb_typeof(v_arrivals) = 'array' THEN
        FOR i IN 0..jsonb_array_length(v_arrivals)-1 LOOP
          IF (v_arrivals->i->>'id') = v_nom_id::text THEN
            v_match_idx := i;
            EXIT;
          END IF;
        END LOOP;
      ELSE
        v_arrivals := '[]'::jsonb;
      END IF;

      IF v_match_idx >= 0 THEN
        v_arrivals := jsonb_set(
          v_arrivals,
          ARRAY[v_match_idx::text],
          jsonb_build_object(
            'id', v_nom_id::text,
            'name', v_nom_name,
            'semi', COALESCE((v_arrivals->v_match_idx->>'semi')::numeric, 0) + v_actual_need,
            'bz', COALESCE((v_arrivals->v_match_idx->>'bz')::numeric, 0) + v_actual_bz
          )
        );
      ELSE
        v_arrivals := v_arrivals || jsonb_build_object(
          'id', v_nom_id::text,
          'name', v_nom_name,
          'semi', v_actual_need,
          'bz', v_actual_bz
        );
      END IF;

      UPDATE public.tasks 
      SET status = 'in-progress',
          plan_snapshot = jsonb_set(COALESCE(plan_snapshot, '{}'::jsonb), '{arrivals}', v_arrivals)
      WHERE id = v_shop2_task_id;
    END IF;
  END IF;

  -- Determine valid task_id for rework card
  IF v_shop2_task_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.tasks WHERE id = v_shop2_task_id) THEN
    v_target_task_id := v_shop2_task_id;
  ELSIF v_card.task_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.tasks WHERE id = v_card.task_id) THEN
    v_target_task_id := v_card.task_id;
  END IF;

  -- 8. Create rework card if rework quantity > 0
  IF p_rework_qty > 0 THEN
    INSERT INTO public.work_cards (task_id, order_id, nomenclature_id, operation, quantity, status, card_info)
    VALUES (
      v_target_task_id,
      v_card.order_id,
      v_nom_id,
      'Доопрацювання',
      p_rework_qty,
      'new',
      '[ЦЕХ №2] Автоматично з Сортування'
    );
  END IF;

  -- 9. Insert work card history entry
  INSERT INTO public.work_card_history (
    card_id, nomenclature_id, stage_name, operator_name, 
    qty_at_start, qty_completed, scrap_qty, started_at, completed_at, shift_name
  )
  VALUES (
    p_card_id, v_nom_id, 'Сортування', COALESCE(p_operator_name, 'Сортування'),
    v_card.quantity, v_total_good, GREATEST(0, p_scrap_qty), v_card.started_at, NOW(), p_shift_name
  );

  v_result := jsonb_build_object(
    'success', true,
    'card_id', p_card_id,
    'good_qty', v_total_good,
    'scrap_qty', GREATEST(0, p_scrap_qty),
    'rework_qty', GREATEST(0, p_rework_qty)
  );

  -- Record receipt safely if table exists
  IF to_regclass('mes_private.accounting_receipts') IS NOT NULL THEN
    BEGIN
      EXECUTE 'INSERT INTO mes_private.accounting_receipts(operation, operation_key, payload, result) VALUES ($1, $2, $3, $4) ON CONFLICT (operation, operation_key) DO UPDATE SET result = EXCLUDED.result'
        USING 'sorting', p_card_id::text, v_payload, v_result;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  RETURN v_result;
END;
$body$;

GRANT EXECUTE ON FUNCTION public.rpc_submit_sorting_complete_atomic(uuid, numeric, numeric, numeric, text, text) TO authenticated, service_role, anon;

COMMIT;


