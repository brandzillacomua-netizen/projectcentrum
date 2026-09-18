-- migration 20260918000002_rpc_sorting_completion_atomic.sql

BEGIN;

SET lock_timeout = '3s';
SET statement_timeout = '10s';

-- Atomic Sorting Completion Function
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
  v_arrivals jsonb;
  v_match_idx integer;
BEGIN
  -- Lock card
  SELECT * INTO v_card FROM public.work_cards WHERE id = p_card_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Card % not found', p_card_id USING ERRCODE = 'P0002';
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
    v_card_need := GREATEST(0, v_card.quantity - v_card_bz);
  END IF;

  v_actual_need := LEAST(v_total_good, v_card_need);
  v_actual_bz := GREATEST(0, v_total_good - v_actual_need);

  -- 1. Decrease Shop 1 semi inventory
  IF v_actual_need > 0 AND v_nom_id IS NOT NULL THEN
    UPDATE public.inventory 
    SET total_qty = GREATEST(0, total_qty - v_actual_need) 
    WHERE nomenclature_id = v_nom_id AND type = 'semi' AND (warehouse = 'production' OR warehouse IS NULL);
  END IF;

  -- 2. Decrease Shop 1 wip_bz / bz inventory
  IF v_actual_bz > 0 AND v_nom_id IS NOT NULL THEN
    v_rem := v_actual_bz;
    SELECT * INTO v_s1_inv FROM public.inventory WHERE nomenclature_id = v_nom_id AND type = 'wip_bz' LIMIT 1 FOR UPDATE;
    IF FOUND THEN
      v_take := LEAST(v_s1_inv.total_qty, v_rem);
      UPDATE public.inventory SET total_qty = GREATEST(0, total_qty - v_take) WHERE id = v_s1_inv.id;
      v_rem := v_rem - v_take;
    END IF;
    IF v_rem > 0 THEN
      UPDATE public.inventory SET total_qty = GREATEST(0, total_qty - v_rem) WHERE nomenclature_id = v_nom_id AND type = 'bz';
    END IF;
  END IF;

  -- 3. Increase Shop 2 semi_shop2 inventory
  IF v_actual_need > 0 AND v_nom_id IS NOT NULL THEN
    SELECT * INTO v_s2_inv FROM public.inventory WHERE nomenclature_id = v_nom_id AND type = 'semi_shop2' LIMIT 1 FOR UPDATE;
    IF FOUND THEN
      UPDATE public.inventory SET total_qty = total_qty + v_actual_need WHERE id = v_s2_inv.id;
    ELSE
      INSERT INTO public.inventory (nomenclature_id, name, total_qty, type, unit, reserved_qty, warehouse)
      VALUES (v_nom_id, v_nom_name, v_actual_need, 'semi_shop2', v_unit, 0, 'production');
    END IF;
  END IF;

  -- 4. Increase Shop 2 bz_shop2 inventory
  IF v_actual_bz > 0 AND v_nom_id IS NOT NULL THEN
    SELECT * INTO v_s2_inv FROM public.inventory WHERE nomenclature_id = v_nom_id AND type = 'bz_shop2' LIMIT 1 FOR UPDATE;
    IF FOUND THEN
      UPDATE public.inventory SET total_qty = total_qty + v_actual_bz WHERE id = v_s2_inv.id;
    ELSE
      INSERT INTO public.inventory (nomenclature_id, name, total_qty, type, unit, reserved_qty, warehouse)
      VALUES (v_nom_id, v_nom_name, v_actual_bz, 'bz_shop2', v_unit, 0, 'production');
    END IF;
  END IF;

  -- 5. Increase scrap_ready if scrap occurred
  IF p_scrap_qty > 0 AND v_nom_id IS NOT NULL THEN
    SELECT * INTO v_scrap_inv FROM public.inventory WHERE nomenclature_id = v_nom_id AND type = 'scrap_ready' LIMIT 1 FOR UPDATE;
    IF FOUND THEN
      UPDATE public.inventory SET total_qty = total_qty + p_scrap_qty WHERE id = v_scrap_inv.id;
    ELSE
      INSERT INTO public.inventory (nomenclature_id, name, total_qty, type, unit, reserved_qty, warehouse)
      VALUES (v_nom_id, v_nom_name, p_scrap_qty, 'scrap_ready', v_unit, 0, 'production');
    END IF;
  END IF;

  -- 6. Update work card to at-shop2-buffer
  UPDATE public.work_cards
  SET status = 'at-shop2-buffer',
      operation = 'Сортування',
      quantity = v_total_good + GREATEST(0, p_rework_qty),
      used_in_shop2_qty = GREATEST(0, p_rework_qty),
      completed_at = now()
  WHERE id = p_card_id;

  -- 7. Find Shop 2 task and update task arrivals
  IF v_card.order_id IS NOT NULL THEN
    SELECT id INTO v_shop2_task_id FROM public.tasks 
    WHERE order_id = v_card.order_id AND step ILIKE '%ЦЕХ №2%' AND status <> 'completed' 
    LIMIT 1;
  END IF;

  -- 8. Create rework card if rework quantity > 0
  IF p_rework_qty > 0 THEN
    INSERT INTO public.work_cards (task_id, order_id, nomenclature_id, operation, quantity, status, card_info)
    VALUES (
      COALESCE(v_shop2_task_id, v_card.task_id),
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
    v_card.quantity, v_total_good, GREATEST(0, p_scrap_qty), v_card.started_at, now(), p_shift_name
  );

  RETURN jsonb_build_object(
    'success', true,
    'card_id', p_card_id,
    'good_qty', v_total_good,
    'scrap_qty', GREATEST(0, p_scrap_qty),
    'rework_qty', GREATEST(0, p_rework_qty)
  );
END;
$body$;

GRANT EXECUTE ON FUNCTION public.rpc_submit_sorting_complete_atomic(uuid, numeric, numeric, numeric, text, text) TO authenticated;

COMMIT;
