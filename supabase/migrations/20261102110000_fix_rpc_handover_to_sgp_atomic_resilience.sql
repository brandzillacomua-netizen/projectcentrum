-- Migration: Fix rpc_handover_to_sgp_atomic resilience against uq_inventory_sgp_nom_finished
-- rollout-contract: v1
-- risk: low
-- transaction: transactional

SET lock_timeout = '5s';
SET statement_timeout = '30s';

BEGIN;

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
  IF auth.uid() IS NULL OR public.mes_current_system_user_id() IS NULL THEN
    RAISE EXCEPTION 'Authentication required or MES profile is not linked' USING ERRCODE = '42501';
  END IF;

  -- 1. Lock work card
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
  IF v_nom_name IS NULL THEN
    SELECT name, unit INTO v_nom_name, v_unit FROM public.nomenclatures WHERE id = v_nom_id LIMIT 1;
  END IF;
  IF v_nom_name IS NULL THEN v_nom_name := 'Готова продукція'; END IF;
  IF v_unit IS NULL THEN v_unit := 'шт'; END IF;

  IF v_total_qty <= 0 OR v_total_qty::text IN ('NaN','Infinity','-Infinity') OR v_nom_id IS NULL THEN 
    RAISE EXCEPTION 'Invalid card quantity or nomenclature'; 
  END IF;
  v_finished_qty := v_total_qty;
  v_bz_qty := 0;

  -- Concurrency lock per nomenclature to serialize SGP inventory updates and avoid race conditions
  PERFORM pg_advisory_xact_lock(hashtextextended('sgp-handover:' || v_nom_id::text, 0));

  -- 2. Deduct total_qty from Shop 2 buffers (semi_shop2, bz_shop2) on best-effort basis
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

  -- Best-effort: do not block handover if Shop 2 buffer tracking had a discrepancy

  -- 3. Add finishedQty to SGP finished inventory (resilient against uq_inventory_sgp_nom_finished)
  IF v_finished_qty > 0 AND v_nom_id IS NOT NULL THEN
    SELECT * INTO v_inv_sgp FROM public.inventory 
    WHERE nomenclature_id = v_nom_id 
      AND warehouse = 'sgp'
      AND pocket_owner IS NULL
      AND type IN ('finished', 'bz', 'bz_shop2', 'wip_bz', 'semi', 'semi_shop2', 'part', 'product')
    ORDER BY CASE WHEN type = 'finished' THEN 1 ELSE 2 END ASC, updated_at DESC NULLS LAST
    LIMIT 1 FOR UPDATE;

    IF FOUND THEN
      UPDATE public.inventory 
      SET total_qty = total_qty + v_finished_qty,
          type = 'finished',
          updated_at = now() 
      WHERE id = v_inv_sgp.id;
    ELSE
      BEGIN
        INSERT INTO public.inventory (nomenclature_id, name, unit, total_qty, reserved_qty, type, warehouse, updated_at)
        VALUES (v_nom_id, v_nom_name, v_unit, v_finished_qty, 0, 'finished', 'sgp', now());
      EXCEPTION WHEN unique_violation THEN
        UPDATE public.inventory 
        SET total_qty = total_qty + v_finished_qty,
            type = 'finished',
            updated_at = now() 
        WHERE nomenclature_id = v_nom_id 
          AND warehouse = 'sgp' 
          AND pocket_owner IS NULL 
          AND type IN ('finished', 'bz', 'bz_shop2', 'wip_bz', 'semi', 'semi_shop2', 'part', 'product');
      END;
    END IF;
  END IF;

  -- 4. Update work card to completed status
  UPDATE public.work_cards 
  SET status = 'completed',
      operation = 'Пакування/СГП',
      completed_at = now(),
      card_info = ('[ЦЕХ №2] [NEED:' || v_finished_qty || '] [BZ:' || v_bz_qty || '] ' || COALESCE(card_info, ''))
  WHERE id = p_card_id;

  -- 5. Record work card history
  INSERT INTO public.work_card_history (card_id, nomenclature_id, stage_name, operator_name, qty_at_start, qty_completed, scrap_qty, completed_at)
  VALUES (p_card_id, v_nom_id, 'Пакування/СГП', 'Система (ТЕРМІНАЛ)', v_total_qty, v_total_qty, 0, now());

  RETURN jsonb_build_object(
    'success', true,
    'card_id', p_card_id,
    'finished_qty', v_finished_qty
  );
END;
$body$;

REVOKE ALL ON FUNCTION public.rpc_handover_to_sgp_atomic(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_handover_to_sgp_atomic(uuid) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;

