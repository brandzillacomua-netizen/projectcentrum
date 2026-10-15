-- ═══════════════════════════════════════════════════════════════════════════
-- FIX: rpc_generate_shop2_cards_atomic — buffer scope parity with UI
-- Проблема: UI («Вільно для РК») зараховує до батьківського наряду буферні картки
--   довипусків (-Д1, -Д2 …) та картки з legacy nomenclature_id. RPC шукав тільки
--   order_id = p_order_id і nomenclature_id = p_nomenclature_id, тому повертав
--   «Недостатньо вільних заготовок у буфері Цеху №2» при наявному залишку.
-- Рішення: клієнт передає точний scope (p_source_order_ids, p_source_nomenclature_ids).
-- Без цих параметрів поведінка ідентична попередній версії.
-- ═══════════════════════════════════════════════════════════════════════════

SET lock_timeout = '5s';
SET statement_timeout = '30s';

BEGIN;

DROP FUNCTION IF EXISTS public.rpc_generate_shop2_cards_atomic(UUID, UUID, JSONB, NUMERIC, TEXT);

CREATE OR REPLACE FUNCTION public.rpc_generate_shop2_cards_atomic(
  p_order_id UUID,
  p_nomenclature_id UUID,
  p_cards_payload JSONB,
  p_total_qty_to_deduct NUMERIC,
  p_user_id TEXT DEFAULT NULL,
  p_source_order_ids UUID[] DEFAULT NULL,
  p_source_nomenclature_ids UUID[] DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_rpc_version CONSTANT TEXT := '2026-10-15.shop2_scope_v2';
  v_total_avail NUMERIC := 0;
  v_remaining_deduction NUMERIC := 0;
  v_buf_rec RECORD;
  v_card_avail NUMERIC;
  v_to_deduct NUMERIC;
  v_item JSONB;
  v_created_cards JSONB := '[]'::JSONB;
  v_new_card RECORD;
  v_qty NUMERIC;
  v_card_info TEXT;
  v_nom_ids UUID[];
  v_order_ids UUID[];
BEGIN
  IF p_nomenclature_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'nomenclature_id є обов''язковим');
  END IF;

  IF p_cards_payload IS NULL OR jsonb_array_length(p_cards_payload) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Масив p_cards_payload не може бути порожнім');
  END IF;

  -- Scope номенклатури: канонічний ID + legacy ID, які UI зводить до нього
  v_nom_ids := array_append(COALESCE(p_source_nomenclature_ids, ARRAY[]::UUID[]), p_nomenclature_id);

  -- Scope нарядів: батьківський наряд + його довипуски (якщо передано)
  IF p_source_order_ids IS NOT NULL AND cardinality(p_source_order_ids) > 0 THEN
    v_order_ids := p_source_order_ids;
    IF p_order_id IS NOT NULL THEN
      v_order_ids := array_append(v_order_ids, p_order_id);
    END IF;
  ELSIF p_order_id IS NOT NULL THEN
    v_order_ids := ARRAY[p_order_id];
  ELSE
    v_order_ids := NULL; -- без наряду: весь буфер деталі
  END IF;

  -- 1. Блокування рядків буфера та розрахунок доступності (в одному кроці)
  PERFORM 1
  FROM public.work_cards
  WHERE nomenclature_id = ANY(v_nom_ids)
    AND (v_order_ids IS NULL OR order_id = ANY(v_order_ids) OR order_id IS NULL)
    AND (status = 'at-shop2-buffer' OR is_rework = true)
  FOR UPDATE;

  SELECT COALESCE(SUM(GREATEST(0, quantity - COALESCE(used_in_shop2_qty, 0))), 0)
  INTO v_total_avail
  FROM public.work_cards
  WHERE nomenclature_id = ANY(v_nom_ids)
    AND (v_order_ids IS NULL OR order_id = ANY(v_order_ids) OR order_id IS NULL)
    AND (status = 'at-shop2-buffer' OR is_rework = true);

  IF p_total_qty_to_deduct > 0 AND v_total_avail < p_total_qty_to_deduct THEN
    RETURN jsonb_build_object(
      'success', false,
      'conflict', true,
      'error', format('Недостатньо вільних заготовок у буфері Цеху №2 (доступно %s, потрібно %s)', v_total_avail, p_total_qty_to_deduct),
      'available', v_total_avail,
      'required', p_total_qty_to_deduct,
      'rpc_version', v_rpc_version
    );
  END IF;

  -- 2. Списання з буферних карток (спочатку власний наряд, потім довипуски, потім без наряду)
  IF p_total_qty_to_deduct > 0 THEN
    v_remaining_deduction := p_total_qty_to_deduct;

    FOR v_buf_rec IN
      SELECT id, quantity, COALESCE(used_in_shop2_qty, 0) AS used
      FROM public.work_cards
      WHERE nomenclature_id = ANY(v_nom_ids)
        AND (v_order_ids IS NULL OR order_id = ANY(v_order_ids) OR order_id IS NULL)
        AND (status = 'at-shop2-buffer' OR is_rework = true)
      ORDER BY
        CASE
          WHEN p_order_id IS NOT NULL AND order_id = p_order_id THEN 0
          WHEN order_id IS NOT NULL THEN 1
          ELSE 2
        END,
        created_at ASC
    LOOP
      v_card_avail := GREATEST(0, v_buf_rec.quantity - v_buf_rec.used);

      IF v_card_avail > 0 THEN
        v_to_deduct := LEAST(v_card_avail, v_remaining_deduction);

        UPDATE public.work_cards
        SET used_in_shop2_qty = v_buf_rec.used + v_to_deduct,
            updated_at = NOW()
        WHERE id = v_buf_rec.id;

        v_remaining_deduction := v_remaining_deduction - v_to_deduct;
        EXIT WHEN v_remaining_deduction <= 0;
      END IF;
    END LOOP;
  END IF;

  -- 3. Створення нових робочих карток Цеху №2
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_cards_payload)
  LOOP
    v_qty := (v_item->>'quantity')::NUMERIC;
    v_card_info := COALESCE(v_item->>'card_info', '');

    INSERT INTO public.work_cards (
      task_id, order_id, nomenclature_id, operation, machine, quantity,
      card_info, status, completed_at, is_rework
    ) VALUES (
      (v_item->>'task_id')::UUID,
      (v_item->>'order_id')::UUID,
      p_nomenclature_id,
      COALESCE(v_item->>'operation', 'Пресування'),
      COALESCE(v_item->>'machine', 'Не вказано'),
      v_qty,
      v_card_info,
      COALESCE(v_item->>'status', 'new'),
      CASE WHEN (v_item->>'completed_at') IS NOT NULL THEN (v_item->>'completed_at')::TIMESTAMPTZ ELSE NULL END,
      COALESCE((v_item->>'is_rework')::BOOLEAN, false)
    )
    RETURNING * INTO v_new_card;

    INSERT INTO public.work_card_history (
      card_id, task_id, nomenclature_id, stage_name, operator_name, card_info,
      qty_at_start, qty_completed, scrap_qty, cutters_used, started_at, completed_at,
      shift_name, manager_name, machine_name
    ) VALUES (
      v_new_card.id, v_new_card.task_id, v_new_card.nomenclature_id, v_new_card.operation,
      COALESCE(p_user_id, 'Система (Цех №2)'),
      v_card_info || ' [SHOP2_BATCH_GENERATION]',
      v_new_card.quantity, 0, 0, 0, NOW(), NULL,
      'Зміна 1', p_user_id, v_new_card.machine
    );

    v_created_cards := v_created_cards || jsonb_build_object(
      'id', v_new_card.id,
      'task_id', v_new_card.task_id,
      'order_id', v_new_card.order_id,
      'nomenclature_id', v_new_card.nomenclature_id,
      'operation', v_new_card.operation,
      'machine', v_new_card.machine,
      'quantity', v_new_card.quantity,
      'card_info', v_new_card.card_info,
      'status', v_new_card.status,
      'created_at', v_new_card.created_at
    );
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'deducted_qty', p_total_qty_to_deduct,
    'created_count', jsonb_array_length(v_created_cards),
    'cards', v_created_cards,
    'rpc_version', v_rpc_version
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_generate_shop2_cards_atomic(UUID, UUID, JSONB, NUMERIC, TEXT, UUID[], UUID[])
  TO authenticated, service_role;

COMMIT;
