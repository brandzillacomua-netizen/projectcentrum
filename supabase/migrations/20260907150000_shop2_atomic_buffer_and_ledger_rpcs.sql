-- ═══════════════════════════════════════════════════════════════════════════
-- 🚀 ENTERPRISE SHOP 2: ATOMIC BUFFER ALLOCATION & MATERIAL BALANCE LEDGER
-- Процедури:
--   1. rpc_generate_shop2_cards_atomic (Атомарна генерація РК та списання буфера)
--   2. rpc_get_shop2_buffer_summary   (Бекенд-агрегат матеріального балансу)
-- Версія: 2026-09-07.shop2_enterprise_v1
-- База даних: CRM КУЛИЦЯ / MES CENTRUM
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. DROP EXISTING VERSIONS IF ANY
DROP FUNCTION IF EXISTS rpc_generate_shop2_cards_atomic(UUID, UUID, JSONB, NUMERIC, TEXT);
DROP FUNCTION IF EXISTS rpc_get_shop2_buffer_summary(UUID[]);

-- ═══════════════════════════════════════════════════════════════════════════
-- ПРОЦЕДУРА 1: rpc_generate_shop2_cards_atomic
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION rpc_generate_shop2_cards_atomic(
  p_order_id UUID,
  p_nomenclature_id UUID,
  p_cards_payload JSONB,
  p_total_qty_to_deduct NUMERIC,
  p_user_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rpc_version CONSTANT TEXT := '2026-09-07.shop2_enterprise_v1';
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
BEGIN
  -- Валідація вхідних параметрів
  IF p_nomenclature_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'nomenclature_id є обов''язковим');
  END IF;

  IF p_cards_payload IS NULL OR jsonb_array_length(p_cards_payload) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Масив p_cards_payload не може бути порожнім');
  END IF;

  -- 1. БЛОКУВАННЯ РЯДКІВ БУФЕРА (SELECT ... FOR UPDATE) ТА РОЗРАХУНОК ДОСТУПНОСТІ
  SELECT COALESCE(SUM(GREATEST(0, quantity - COALESCE(used_in_shop2_qty, 0))), 0)
  INTO v_total_avail
  FROM work_cards
  WHERE nomenclature_id = p_nomenclature_id
    AND (p_order_id IS NULL OR order_id = p_order_id OR order_id IS NULL)
    AND (status = 'at-shop2-buffer' OR is_rework = true);

  IF p_total_qty_to_deduct > 0 AND v_total_avail < p_total_qty_to_deduct THEN
    RETURN jsonb_build_object(
      'success', false,
      'conflict', true,
      'error', 'Недостатньо вільних заготовок у буфері Цеху №2',
      'available', v_total_avail,
      'required', p_total_qty_to_deduct,
      'rpc_version', v_rpc_version
    );
  END IF;

  -- 2. СПИСАННЯ КІЛЬКОСТІ З БУФЕРНИХ КАРТОК
  IF p_total_qty_to_deduct > 0 THEN
    v_remaining_deduction := p_total_qty_to_deduct;

    FOR v_buf_rec IN
      SELECT id, quantity, COALESCE(used_in_shop2_qty, 0) AS used
      FROM work_cards
      WHERE nomenclature_id = p_nomenclature_id
        AND (p_order_id IS NULL OR order_id = p_order_id OR order_id IS NULL)
        AND (status = 'at-shop2-buffer' OR is_rework = true)
      ORDER BY
        CASE WHEN p_order_id IS NOT NULL AND order_id = p_order_id THEN 0 ELSE 1 END,
        created_at ASC
      FOR UPDATE
    LOOP
      v_card_avail := GREATEST(0, v_buf_rec.quantity - v_buf_rec.used);

      IF v_card_avail > 0 THEN
        v_to_deduct := LEAST(v_card_avail, v_remaining_deduction);

        UPDATE work_cards
        SET used_in_shop2_qty = v_buf_rec.used + v_to_deduct,
            updated_at = NOW()
        WHERE id = v_buf_rec.id;

        v_remaining_deduction := v_remaining_deduction - v_to_deduct;
        IF v_remaining_deduction <= 0 THEN
          EXIT;
        END IF;
      END IF;
    END LOOP;
  END IF;

  -- 3. СТВОРЕННЯ НОВИХ РОБОЧИХ КАРТОК ЦЕХУ №2
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_cards_payload)
  LOOP
    v_qty := (v_item->>'quantity')::NUMERIC;
    v_card_info := COALESCE(v_item->>'card_info', '');

    INSERT INTO work_cards (
      task_id,
      order_id,
      nomenclature_id,
      operation,
      machine,
      quantity,
      card_info,
      status,
      completed_at,
      is_rework
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

    -- Запис в аудит історії
    INSERT INTO work_card_history (
      card_id,
      task_id,
      nomenclature_id,
      stage_name,
      operator_name,
      card_info,
      qty_at_start,
      qty_completed,
      scrap_qty,
      cutters_used,
      started_at,
      completed_at,
      shift_name,
      manager_name,
      machine_name
    ) VALUES (
      v_new_card.id,
      v_new_card.task_id,
      v_new_card.nomenclature_id,
      v_new_card.operation,
      COALESCE(p_user_id, 'Система (Цех №2)'),
      v_card_info || ' [SHOP2_BATCH_GENERATION]',
      v_new_card.quantity,
      0,
      0,
      0,
      NOW(),
      NULL,
      'Зміна 1',
      p_user_id,
      v_new_card.machine
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

-- ═══════════════════════════════════════════════════════════════════════════
-- ПРОЦЕДУРА 2: rpc_get_shop2_buffer_summary
-- Агрегація матеріального балансу Цеху №2 безпосередньо в базі даних
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION rpc_get_shop2_buffer_summary(
  p_order_ids UUID[] DEFAULT NULL
)
RETURNS TABLE (
  nomenclature_id UUID,
  order_id UUID,
  total_received NUMERIC,
  available_qty NUMERIC,
  used_in_shop2_qty NUMERIC,
  in_progress_qty NUMERIC,
  shop2_scrap_qty NUMERIC,
  packaging_yield_qty NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH buffer_cards AS (
    SELECT
      c.nomenclature_id,
      c.order_id,
      SUM(COALESCE(c.quantity, 0)) AS buf_total_rec,
      SUM(GREATEST(0, COALESCE(c.quantity, 0) - COALESCE(c.used_in_shop2_qty, 0))) AS buf_avail,
      SUM(COALESCE(c.used_in_shop2_qty, 0)) AS buf_used
    FROM work_cards c
    WHERE c.status = 'at-shop2-buffer'
      AND (p_order_ids IS NULL OR c.order_id = ANY(p_order_ids))
    GROUP BY c.nomenclature_id, c.order_id
  ),
  shop2_active_cards AS (
    SELECT
      c.nomenclature_id,
      c.order_id,
      SUM(CASE 
        WHEN c.status IN ('new', 'in-progress', 'waiting-cutters', 'waiting-materials', 'waiting-buffer', 'at-buffer') 
             AND NOT (c.operation ILIKE '%пакування%' OR c.operation ILIKE '%сгп%')
        THEN COALESCE(c.quantity, 0) 
        ELSE 0 
      END) AS shop2_wip,
      SUM(COALESCE(c.scrap_qty, 0)) AS shop2_scrap,
      SUM(CASE 
        WHEN c.status = 'completed' OR (c.operation ILIKE '%пакування%' OR c.operation ILIKE '%сгп%')
        THEN COALESCE(c.quantity, 0) 
        ELSE 0 
      END) AS shop2_completed
    FROM work_cards c
    WHERE (p_order_ids IS NULL OR c.order_id = ANY(p_order_ids))
      AND (
        c.operation ILIKE '%пресування%' OR 
        c.operation ILIKE '%фарбування%' OR 
        c.operation ILIKE '%маляр%' OR 
        c.operation ILIKE '%доопрацювання%' OR 
        c.operation ILIKE '%пакування%' OR 
        c.operation ILIKE '%сгп%' OR 
        c.card_info LIKE '%[SHOP:2]%' OR 
        c.card_info LIKE '%[ЦЕХ №2]%' OR 
        c.card_info LIKE '%[ЦЕХ 2]%'
      )
    GROUP BY c.nomenclature_id, c.order_id
  ),
  combined_keys AS (
    SELECT b.nomenclature_id, b.order_id FROM buffer_cards b
    UNION
    SELECT s.nomenclature_id, s.order_id FROM shop2_active_cards s
  )
  SELECT
    k.nomenclature_id,
    k.order_id,
    COALESCE(b.buf_total_rec, 0)::NUMERIC AS total_received,
    COALESCE(b.buf_avail, 0)::NUMERIC AS available_qty,
    COALESCE(b.buf_used, 0)::NUMERIC AS used_in_shop2_qty,
    COALESCE(s.shop2_wip, 0)::NUMERIC AS in_progress_qty,
    COALESCE(s.shop2_scrap, 0)::NUMERIC AS shop2_scrap_qty,
    GREATEST(
      COALESCE(s.shop2_completed, 0),
      GREATEST(0, COALESCE(b.buf_used, 0) - COALESCE(s.shop2_wip, 0) - COALESCE(s.shop2_scrap, 0))
    )::NUMERIC AS packaging_yield_qty
  FROM combined_keys k
  LEFT JOIN buffer_cards b 
    ON b.nomenclature_id = k.nomenclature_id 
   AND (b.order_id = k.order_id OR (b.order_id IS NULL AND k.order_id IS NULL))
  LEFT JOIN shop2_active_cards s 
    ON s.nomenclature_id = k.nomenclature_id 
   AND (s.order_id = k.order_id OR (s.order_id IS NULL AND k.order_id IS NULL));
END;
$$;
