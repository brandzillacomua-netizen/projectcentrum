-- migration 20260918000000_rpc_single_factory_handovers_atomic.sql

BEGIN;

SET lock_timeout = '3s';
SET statement_timeout = '10s';

-- 1. Atomic Handover from Shop 1 Task to Shop 2 Task
CREATE OR REPLACE FUNCTION public.rpc_handover_task_to_shop2_atomic(
  p_task_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $body$
DECLARE
  v_task record;
  v_shop2_task record;
  v_arrivals jsonb := '[]'::jsonb;
  v_nom_id text;
  v_nom_name text;
  v_unit text;
  v_produced_s1 numeric;
  v_stock_start numeric;
  v_total_move numeric;
  v_snap_need numeric;
  v_move_semi numeric;
  v_move_bz numeric;
  v_dec_semi numeric;
  v_dec_wip numeric;
  v_take numeric;
  v_rem numeric;
  v_s1_inv record;
  v_s2_inv record;
  v_doc_id uuid;
  v_doc_num text;
BEGIN
  -- Lock task
  SELECT * INTO v_task FROM public.tasks WHERE id = p_task_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task % not found', p_task_id USING ERRCODE = 'P0002';
  END IF;

  -- If task is already completed, return idempotent success
  IF v_task.status = 'completed' THEN
    RETURN jsonb_build_object('success', true, 'already_completed', true);
  END IF;

  -- Mark task completed
  UPDATE public.tasks 
  SET status = 'completed', completed_at = now() 
  WHERE id = p_task_id;

  v_doc_num := 'T-S1-S2-' || right(extract(epoch from now())::text, 6);

  -- Process snapshot parts if present
  IF v_task.plan_snapshot IS NOT NULL THEN
    FOR v_nom_id IN 
      SELECT key FROM jsonb_object_keys(v_task.plan_snapshot) AS key 
      WHERE key NOT IN ('_metadata', 'materialSummary')
      ORDER BY key ASC
    LOOP
      SELECT name, unit INTO v_nom_name, v_unit FROM public.nomenclatures_v2 WHERE id::text = v_nom_id LIMIT 1;
      IF v_nom_name IS NULL THEN v_nom_name := 'Деталь'; END IF;
      IF v_unit IS NULL THEN v_unit := 'шт'; END IF;

      -- Calculate quantity produced in Shop 1 vs Stock
      SELECT COALESCE(SUM(quantity), 0) INTO v_produced_s1 
      FROM public.work_cards 
      WHERE task_id = p_task_id AND status = 'completed' AND nomenclature_id::text = v_nom_id AND (operation IS NULL OR operation <> 'Склад БЗ');

      SELECT COALESCE(SUM(quantity), 0) INTO v_stock_start 
      FROM public.work_cards 
      WHERE task_id = p_task_id AND status = 'completed' AND nomenclature_id::text = v_nom_id AND operation = 'Склад БЗ';

      v_total_move := v_produced_s1 + v_stock_start;

      IF v_total_move > 0 THEN
        v_snap_need := COALESCE((v_task.plan_snapshot->v_nom_id->>'need')::numeric, 0);
        v_move_semi := LEAST(v_total_move, v_snap_need);
        v_move_bz := GREATEST(0, v_total_move - v_move_semi);

        v_arrivals := v_arrivals || jsonb_build_object(
          'id', v_nom_id,
          'name', v_nom_name,
          'semi', v_move_semi,
          'bz', v_move_bz
        );

        -- Decrease Shop 1 stock
        IF v_produced_s1 > 0 THEN
          v_dec_semi := LEAST(v_produced_s1, v_snap_need);
          v_dec_wip := GREATEST(0, v_produced_s1 - v_dec_semi);

          IF v_dec_semi > 0 THEN
            UPDATE public.inventory 
            SET total_qty = GREATEST(0, total_qty - v_dec_semi) 
            WHERE nomenclature_id::text = v_nom_id AND type = 'semi' AND (warehouse = 'production' OR warehouse IS NULL);
          END IF;

          IF v_dec_wip > 0 THEN
            v_rem := v_dec_wip;
            SELECT * INTO v_s1_inv FROM public.inventory WHERE nomenclature_id::text = v_nom_id AND type = 'wip_bz' LIMIT 1 FOR UPDATE;
            IF FOUND THEN
              v_take := LEAST(v_s1_inv.total_qty, v_rem);
              UPDATE public.inventory SET total_qty = GREATEST(0, total_qty - v_take) WHERE id = v_s1_inv.id;
              v_rem := v_rem - v_take;
            END IF;
            IF v_rem > 0 THEN
              UPDATE public.inventory SET total_qty = GREATEST(0, total_qty - v_rem) WHERE nomenclature_id::text = v_nom_id AND type = 'bz';
            END IF;
          END IF;
        END IF;

        -- Increase Shop 2 stock (semi_shop2)
        IF v_move_semi > 0 THEN
          SELECT * INTO v_s2_inv FROM public.inventory WHERE nomenclature_id::text = v_nom_id AND type = 'semi_shop2' LIMIT 1 FOR UPDATE;
          IF FOUND THEN
            UPDATE public.inventory SET total_qty = total_qty + v_move_semi WHERE id = v_s2_inv.id;
          ELSE
            INSERT INTO public.inventory (nomenclature_id, name, total_qty, type, unit, reserved_qty, warehouse)
            VALUES (v_nom_id::uuid, v_nom_name, v_move_semi, 'semi_shop2', v_unit, 0, 'production');
          END IF;
        END IF;

        -- Increase Shop 2 stock (bz_shop2)
        IF v_move_bz > 0 THEN
          SELECT * INTO v_s2_inv FROM public.inventory WHERE nomenclature_id::text = v_nom_id AND type = 'bz_shop2' LIMIT 1 FOR UPDATE;
          IF FOUND THEN
            UPDATE public.inventory SET total_qty = total_qty + v_move_bz WHERE id = v_s2_inv.id;
          ELSE
            INSERT INTO public.inventory (nomenclature_id, name, total_qty, type, unit, reserved_qty, warehouse)
            VALUES (v_nom_id::uuid, v_nom_name, v_move_bz, 'bz_shop2', v_unit, 0, 'production');
          END IF;
        END IF;
      END IF;
    END LOOP;
  END IF;

  -- Create internal transfer reception document
  INSERT INTO public.reception_docs (doc_num, type, status, order_id, details)
  VALUES (v_doc_num, 'internal_transfer', 'completed', v_task.order_id, v_arrivals::text)
  RETURNING id INTO v_doc_id;

  -- Find and activate existing Shop 2 task if exists
  IF v_task.order_id IS NOT NULL THEN
    SELECT * INTO v_shop2_task FROM public.tasks 
    WHERE order_id = v_task.order_id AND step ILIKE '%Пресування%' AND batch_index IS NOT DISTINCT FROM v_task.batch_index 
    LIMIT 1 FOR UPDATE;

    IF FOUND THEN
      UPDATE public.tasks 
      SET status = 'in-progress',
          plan_snapshot = jsonb_set(COALESCE(plan_snapshot, '{}'::jsonb), '{arrivals}', v_arrivals)
      WHERE id = v_shop2_task.id;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'task_id', p_task_id,
    'doc_id', v_doc_id,
    'arrivals', v_arrivals
  );
END;
$body$;

-- 2. Atomic Handover from Work Card to SGP (Finished Stock)
CREATE OR REPLACE FUNCTION public.rpc_handover_to_sgp_atomic(
  p_card_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $body$
DECLARE
  v_card record;
  v_total_qty numeric;
  v_nom_id uuid;
  v_nom_name text;
  v_unit text;
  v_finished_qty numeric;
  v_bz_qty numeric;
  v_inv_sgp record;
  v_rem_deduct numeric;
  v_take numeric;
  v_s2_row record;
BEGIN
  -- Lock work card
  SELECT * INTO v_card FROM public.work_cards WHERE id = p_card_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Card % not found', p_card_id USING ERRCODE = 'P0002';
  END IF;

  -- Idempotent check
  IF v_card.status = 'completed' THEN
    RETURN jsonb_build_object('success', true, 'already_completed', true);
  END IF;

  v_total_qty := COALESCE(v_card.quantity, 0);
  v_nom_id := v_card.nomenclature_id;
  
  SELECT name, unit INTO v_nom_name, v_unit FROM public.nomenclatures_v2 WHERE id = v_nom_id LIMIT 1;
  IF v_nom_name IS NULL THEN v_nom_name := 'Готова продукція'; END IF;
  IF v_unit IS NULL THEN v_unit := 'шт'; END IF;

  v_finished_qty := v_total_qty;
  v_bz_qty := 0;

  -- 1. Deduct total_qty from Shop 2 buffers (semi_shop2, bz_shop2)
  v_rem_deduct := v_total_qty;
  IF v_rem_deduct > 0 AND v_nom_id IS NOT NULL THEN
    FOR v_s2_row IN 
      SELECT * FROM public.inventory 
      WHERE nomenclature_id = v_nom_id AND type IN ('semi_shop2', 'bz_shop2')
      ORDER BY CASE WHEN type = 'semi_shop2' THEN 1 ELSE 2 END ASC
      FOR UPDATE
    LOOP
      v_take := LEAST(v_s2_row.total_qty, v_rem_deduct);
      IF v_take > 0 THEN
        UPDATE public.inventory SET total_qty = GREATEST(0, total_qty - v_take) WHERE id = v_s2_row.id;
        v_rem_deduct := v_rem_deduct - v_take;
      END IF;
      EXIT WHEN v_rem_deduct <= 0;
    END LOOP;
  END IF;

  -- 2. Add finishedQty to SGP finished inventory
  IF v_finished_qty > 0 AND v_nom_id IS NOT NULL THEN
    SELECT * INTO v_inv_sgp FROM public.inventory 
    WHERE nomenclature_id = v_nom_id AND type = 'finished' AND warehouse = 'sgp' 
    LIMIT 1 FOR UPDATE;

    IF FOUND THEN
      UPDATE public.inventory SET total_qty = total_qty + v_finished_qty, updated_at = now() WHERE id = v_inv_sgp.id;
    ELSE
      INSERT INTO public.inventory (nomenclature_id, name, unit, total_qty, reserved_qty, type, warehouse, updated_at)
      VALUES (v_nom_id, v_nom_name, v_unit, v_finished_qty, 0, 'finished', 'sgp', now());
    END IF;
  END IF;

  -- 3. Update work card to completed status
  UPDATE public.work_cards 
  SET status = 'completed',
      operation = 'Пакування/СГП',
      completed_at = now(),
      card_info = ('[ЦЕХ №2] [NEED:' || v_finished_qty || '] [BZ:' || v_bz_qty || '] ' || COALESCE(card_info, ''))
  WHERE id = p_card_id;

  -- 4. Record work card history
  INSERT INTO public.work_card_history (card_id, nomenclature_id, stage_name, operator_name, qty_at_start, qty_completed, scrap_qty, completed_at)
  VALUES (p_card_id, v_nom_id, 'Пакування/СГП', 'Система (ТЕРМІНАЛ)', v_total_qty, v_total_qty, 0, now());

  RETURN jsonb_build_object(
    'success', true,
    'card_id', p_card_id,
    'finished_qty', v_finished_qty
  );
END;
$body$;

GRANT EXECUTE ON FUNCTION public.rpc_handover_task_to_shop2_atomic(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_handover_to_sgp_atomic(uuid) TO authenticated;

COMMIT;
