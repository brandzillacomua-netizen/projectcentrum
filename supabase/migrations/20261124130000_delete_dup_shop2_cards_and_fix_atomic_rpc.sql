-- 1. Delete the 3 duplicate un-deducted 1100pc Фарбування cards (#C062463F, #7B06DF24, #7326FB6A)
-- 2. Re-install the 7-parameter atomic rpc_generate_shop2_cards_atomic so buffer deduction & card creation are strictly atomic.

SET lock_timeout = '5s';
SET statement_timeout = '60s';

BEGIN;

DELETE FROM public.work_cards
WHERE lower(right(id::text, 8)) IN ('c062463f', '7b06df24', '7326fb6a')
  AND operation = 'Фарбування'
  AND quantity = 1100
  AND status = 'new';

DROP FUNCTION IF EXISTS public.rpc_generate_shop2_cards_atomic(UUID, UUID, JSONB, NUMERIC, TEXT);
DROP FUNCTION IF EXISTS public.rpc_generate_shop2_cards_atomic(UUID, UUID, JSONB, NUMERIC, TEXT, UUID[], UUID[]);

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
  v_total_avail NUMERIC := 0;
  v_remaining_deduction NUMERIC;
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

  v_nom_ids := array_append(COALESCE(p_source_nomenclature_ids, ARRAY[]::UUID[]), p_nomenclature_id);

  IF p_source_order_ids IS NOT NULL AND cardinality(p_source_order_ids) > 0 THEN
    v_order_ids := p_source_order_ids;
    IF p_order_id IS NOT NULL THEN
      v_order_ids := array_append(v_order_ids, p_order_id);
    END IF;
  ELSIF p_order_id IS NOT NULL THEN
    v_order_ids := ARRAY[p_order_id];
  ELSE
    v_order_ids := NULL;
  END IF;

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
      'required', p_total_qty_to_deduct
    );
  END IF;

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

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_cards_payload)
  LOOP
    v_qty := (v_item->>'quantity')::NUMERIC;
    v_card_info := COALESCE(v_item->>'card_info', '');

    INSERT INTO public.work_cards (
      task_id, order_id, nomenclature_id, operation, machine, quantity,
      card_info, status, completed_at, is_rework
    ) VALUES (
      NULLIF(v_item->>'task_id', '')::UUID,
      NULLIF(v_item->>'order_id', '')::UUID,
      p_nomenclature_id,
      COALESCE(v_item->>'operation', 'Пресування'),
      COALESCE(v_item->>'machine', 'Не вказано'),
      v_qty,
      v_card_info,
      COALESCE(v_item->>'status', 'new'),
      CASE WHEN NULLIF(v_item->>'completed_at', '') IS NOT NULL THEN (v_item->>'completed_at')::TIMESTAMPTZ ELSE NULL END,
      COALESCE((v_item->>'is_rework')::BOOLEAN, false)
    )
    RETURNING * INTO v_new_card;

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
    'cards', v_created_cards,
    'deducted_qty', p_total_qty_to_deduct
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_generate_shop2_cards_atomic(UUID, UUID, JSONB, NUMERIC, TEXT, UUID[], UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_generate_shop2_cards_atomic(UUID, UUID, JSONB, NUMERIC, TEXT, UUID[], UUID[]) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
