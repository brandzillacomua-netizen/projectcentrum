-- ═══════════════════════════════════════════════════════════════════════════
-- 🚀 ENTERPRISE HIGH-LOAD MIGRATION: ATOMIC QC SCRAP DEDUCTION
-- Процедура: rpc_qc_scrap_atomic (ACID Scrap Deduction + History + Inventory)
-- Версія: 2026-09-05.qc_scrap_v1
-- База даних: CRM КУЛИЦЯ / MES CENTRUM
-- Запустити в Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════
--
-- УНІФІКУЄ 3 МОДУЛІ В ЄДИНУ ТРАНЗАКЦІЮ:
--   1. Shop 1 Terminal (handleQCScrapOverride)
--   2. Brak Module / ВКЯ (handleQCScrapOverride)
--   3. Shop 2 Terminal (handleQCScrapOverride)
--
-- ГАРАНТІЇ АТОМАРНОСТІ:
--   • Замок рядка картки (SELECT ... FOR UPDATE)
--   • Списання кількості картки (якщо залишок 0 -> status = completed)
--   • Фіксація запису в work_card_history (scrap_qty, причина, коментар, інспектор)
--   • Зарахування браку на оперативний склад (inventory type = 'scrap_ready')
--   • Нульовий ризик втрати матеріалів/грошей при обриві Wi-Fi
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION rpc_qc_scrap_atomic(
  p_card_id UUID,
  p_scrap_qty NUMERIC,
  p_history_data JSONB,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rpc_version CONSTANT TEXT := '2026-09-05.qc_scrap_v1';
  v_current_card RECORD;
  v_new_qty NUMERIC;
  v_target_status TEXT;
  v_inventory_id UUID;
  v_existing_inv_qty NUMERIC;
  v_final_card_info TEXT;
BEGIN
  -- 1. Транзакційне блокування рядка картки (SELECT ... FOR UPDATE)
  SELECT * INTO v_current_card
  FROM work_cards
  WHERE id = p_card_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Card not found',
      'rpc_version', v_rpc_version
    );
  END IF;

  -- 2. Валідація кількості браку
  IF p_scrap_qty <= 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Scrap quantity must be greater than 0',
      'rpc_version', v_rpc_version
    );
  END IF;

  IF p_scrap_qty > v_current_card.quantity THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Scrap quantity cannot exceed current card quantity',
      'current_quantity', v_current_card.quantity,
      'scrap_qty', p_scrap_qty,
      'rpc_version', v_rpc_version
    );
  END IF;

  -- 3. Idempotency Barrier (Exact Retry)
  IF p_idempotency_key IS NOT NULL AND EXISTS (
    SELECT 1 FROM work_card_history
    WHERE card_id = p_card_id
      AND card_info LIKE '%[IDEMPOTENCY_KEY:' || p_idempotency_key || ']%'
  ) THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_processed', true,
      'reason', 'idempotent_replay',
      'card_id', p_card_id,
      'idempotency_key', p_idempotency_key,
      'rpc_version', v_rpc_version,
      'message', 'Це списання браку вже було успішно зафіксовано раніше'
    );
  END IF;

  -- 4. Розрахунок нового залишку деталей та статусу
  v_new_qty := GREATEST(0, v_current_card.quantity - p_scrap_qty);
  v_target_status := CASE WHEN v_new_qty = 0 THEN 'completed' ELSE v_current_card.status END;

  -- 5. Атомарне оновлення картки
  UPDATE work_cards
  SET
    quantity = v_new_qty,
    status = v_target_status,
    completed_at = CASE WHEN v_new_qty = 0 THEN COALESCE(completed_at, NOW()) ELSE completed_at END
  WHERE id = p_card_id;

  -- 6. Запис в історію з вшитим idempotency key
  v_final_card_info := COALESCE(p_history_data->>'card_info', '');
  IF p_idempotency_key IS NOT NULL AND v_final_card_info NOT LIKE '%[IDEMPOTENCY_KEY:%' THEN
    v_final_card_info := TRIM(v_final_card_info || ' [IDEMPOTENCY_KEY:' || p_idempotency_key || ']');
  END IF;

  INSERT INTO work_card_history (
    card_id,
    nomenclature_id,
    stage_name,
    operator_name,
    card_info,
    qty_at_start,
    qty_completed,
    scrap_qty,
    started_at,
    completed_at,
    is_archived_scrap,
    shift_name,
    manager_name,
    machine_name,
    qc_scrap_reason,
    qc_scrap_comment
  ) VALUES (
    p_card_id,
    COALESCE((p_history_data->>'nomenclature_id')::UUID, v_current_card.nomenclature_id),
    COALESCE(p_history_data->>'stage_name', 'Контроль ВКЯ'),
    COALESCE(p_history_data->>'operator_name', 'Не вказано'),
    v_final_card_info,
    v_current_card.quantity,
    v_new_qty,
    p_scrap_qty,
    COALESCE((p_history_data->>'started_at')::TIMESTAMPTZ, NOW()),
    NOW(),
    true,
    COALESCE(p_history_data->>'shift_name', v_current_card.shift_name),
    COALESCE(p_history_data->>'manager_name', v_current_card.manager_name),
    COALESCE(p_history_data->>'machine_name', v_current_card.machine),
    p_history_data->>'qc_scrap_reason',
    p_history_data->>'qc_scrap_comment'
  );

  -- 7. Атомарне зарахування браку на оперативний склад (inventory type = 'scrap_ready')
  IF v_current_card.nomenclature_id IS NOT NULL THEN
    SELECT id, total_qty INTO v_inventory_id, v_existing_inv_qty
    FROM inventory
    WHERE nomenclature_id = v_current_card.nomenclature_id 
      AND type = 'scrap_ready'
    LIMIT 1
    FOR UPDATE;

    IF FOUND THEN
      UPDATE inventory
      SET
        total_qty = COALESCE(v_existing_inv_qty, 0) + p_scrap_qty,
        updated_at = NOW()
      WHERE id = v_inventory_id;
    ELSE
      DECLARE
        v_nom_name TEXT;
        v_nom_unit TEXT;
      BEGIN
        SELECT name, unit INTO v_nom_name, v_nom_unit
        FROM nomenclatures
        WHERE id = v_current_card.nomenclature_id;

        INSERT INTO inventory (
          nomenclature_id,
          name,
          unit,
          total_qty,
          type,
          warehouse,
          updated_at
        ) VALUES (
          v_current_card.nomenclature_id,
          COALESCE(v_nom_name, 'Деталь'),
          COALESCE(v_nom_unit, 'шт'),
          p_scrap_qty,
          'scrap_ready',
          'operational',
          NOW()
        );
      END;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'card_id', p_card_id,
    'new_quantity', v_new_qty,
    'scrap_qty', p_scrap_qty,
    'status', v_target_status,
    'rpc_version', v_rpc_version
  );
END;
$$;
