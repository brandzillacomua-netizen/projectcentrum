-- ═══════════════════════════════════════════════════════════════════════════
-- 🚀 ENTERPRISE HIGH-LOAD MIGRATION: ATOMIC INVENTORY & QC SCRAP OPERATIONS
-- База даних: CRM КУЛИЦЯ / MES CENTRUM
-- Процедури:
--   1. rpc_increment_inventory_stock (ACID списання/зарахування залишків)
--   2. rpc_deduct_inventory_atomic (Атомарна видача сировини зі складу)
--   3. rpc_qc_scrap_atomic (Атомарний скрап, контроль браку ВКЯ та списання)
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. АТОМАРНЕ ЗБІЛЬШЕННЯ / ЗАРАХУВАННЯ ЗАЛИШКІВ СКЛАДУ
CREATE OR REPLACE FUNCTION rpc_increment_inventory_stock(
  p_nomenclature_id UUID,
  p_qty NUMERIC,
  p_type TEXT DEFAULT 'scrap_ready',
  p_item_name TEXT DEFAULT 'Деталь',
  p_unit TEXT DEFAULT 'шт'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_inv_id UUID;
  v_old_qty NUMERIC := 0;
  v_new_qty NUMERIC := 0;
  v_nom_name TEXT;
  v_nom_unit TEXT;
BEGIN
  IF p_nomenclature_id IS NULL OR p_qty IS NULL OR p_qty <= 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid nomenclature_id or non-positive quantity'
    );
  END IF;

  -- Транзакційне блокування рядка складу (FOR UPDATE)
  SELECT id, total_qty INTO v_inv_id, v_old_qty
  FROM inventory
  WHERE nomenclature_id = p_nomenclature_id AND type = p_type
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    v_new_qty := COALESCE(v_old_qty, 0) + p_qty;
    UPDATE inventory
    SET total_qty = v_new_qty,
        updated_at = NOW()
    WHERE id = v_inv_id;

    RETURN jsonb_build_object(
      'success', true,
      'id', v_inv_id,
      'prev_qty', v_old_qty,
      'new_qty', v_new_qty,
      'action', 'updated'
    );
  ELSE
    SELECT name, unit INTO v_nom_name, v_nom_unit
    FROM nomenclatures
    WHERE id = p_nomenclature_id;

    INSERT INTO inventory (
      nomenclature_id,
      name,
      unit,
      total_qty,
      type,
      warehouse,
      updated_at
    ) VALUES (
      p_nomenclature_id,
      COALESCE(p_item_name, v_nom_name, 'Деталь'),
      COALESCE(p_unit, v_nom_unit, 'шт'),
      p_qty,
      p_type,
      'operational',
      NOW()
    )
    RETURNING id, total_qty INTO v_inv_id, v_new_qty;

    RETURN jsonb_build_object(
      'success', true,
      'id', v_inv_id,
      'prev_qty', 0,
      'new_qty', v_new_qty,
      'action', 'inserted'
    );
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION rpc_increment_inventory_stock(UUID, NUMERIC, TEXT, TEXT, TEXT) TO anon, authenticated, service_role;

-- 2. АТОМАРНЕ СПИСАННЯ СИРОВИНИ ТА ЗНЯТТЯ РЕЗЕРВІВ
CREATE OR REPLACE FUNCTION rpc_deduct_inventory_atomic(
  p_inventory_id UUID,
  p_deduct_total NUMERIC DEFAULT 0,
  p_release_reserved NUMERIC DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_inv RECORD;
  v_new_total NUMERIC;
  v_new_reserved NUMERIC;
BEGIN
  IF p_inventory_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'inventory_id is required');
  END IF;

  SELECT * INTO v_inv
  FROM public.inventory
  WHERE id = p_inventory_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Inventory row not found');
  END IF;

  v_new_total := GREATEST(0, COALESCE(v_inv.total_qty, 0) - COALESCE(p_deduct_total, 0));
  v_new_reserved := GREATEST(0, COALESCE(v_inv.reserved_qty, 0) - COALESCE(p_release_reserved, 0));

  UPDATE public.inventory
  SET total_qty = v_new_total,
      reserved_qty = v_new_reserved,
      updated_at = NOW()
  WHERE id = p_inventory_id;

  RETURN jsonb_build_object(
    'success', true,
    'id', p_inventory_id,
    'prev_total', v_inv.total_qty,
    'new_total', v_new_total,
    'prev_reserved', v_inv.reserved_qty,
    'new_reserved', v_new_reserved
  );
END;
$$;

GRANT EXECUTE ON FUNCTION rpc_deduct_inventory_atomic(UUID, NUMERIC, NUMERIC) TO anon, authenticated, service_role;

-- 3. АТОМАРНИЙ СПИСАННЯ БРАКУ В ЦЕХУ ТА ВІДДІЛІ КОНТРОЛЮ (ВКЯ)
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
  v_rpc_version CONSTANT TEXT := '2026-09-06.qc_scrap_v1';
  v_current_card RECORD;
  v_new_qty NUMERIC;
  v_target_status TEXT;
  v_inventory_id UUID;
  v_existing_inv_qty NUMERIC;
  v_final_card_info TEXT;
BEGIN
  -- Транзакційне блокування рядка картки
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

  IF p_scrap_qty <= 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Scrap quantity must be greater than 0',
      'rpc_version', v_rpc_version
    );
  END IF;

  v_new_qty := GREATEST(0, COALESCE(v_current_card.quantity, 0) - p_scrap_qty);
  v_target_status := CASE WHEN v_new_qty <= 0 THEN 'completed' ELSE v_current_card.status END;

  -- Оновлення кількості картки
  UPDATE work_cards
  SET
    quantity = v_new_qty,
    status = v_target_status,
    updated_at = NOW()
  WHERE id = p_card_id;

  -- Фіксація запису в історію
  IF p_history_data IS NOT NULL THEN
    v_final_card_info := COALESCE(p_history_data->>'card_info', '');
    IF p_idempotency_key IS NOT NULL AND v_final_card_info NOT LIKE '%[IDEMPOTENCY_KEY:%' THEN
      v_final_card_info := TRIM(v_final_card_info || ' [IDEMPOTENCY_KEY:' || p_idempotency_key || ']');
    END IF;

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
      started_at,
      completed_at,
      shift_name,
      manager_name,
      machine_name
    ) VALUES (
      p_card_id,
      COALESCE((p_history_data->>'task_id')::UUID, v_current_card.task_id),
      COALESCE((p_history_data->>'nomenclature_id')::UUID, v_current_card.nomenclature_id),
      COALESCE(p_history_data->>'stage_name', v_current_card.operation),
      COALESCE(p_history_data->>'operator_name', 'Не вказано'),
      v_final_card_info,
      COALESCE(v_current_card.quantity, 0),
      0,
      p_scrap_qty,
      (p_history_data->>'started_at')::TIMESTAMPTZ,
      COALESCE((p_history_data->>'completed_at')::TIMESTAMPTZ, NOW()),
      p_history_data->>'shift_name',
      p_history_data->>'manager_name',
      p_history_data->>'machine_name'
    );
  END IF;

  -- Зарахування браку на оперативний склад scrap_ready
  IF v_current_card.nomenclature_id IS NOT NULL THEN
    PERFORM rpc_increment_inventory_stock(
      v_current_card.nomenclature_id,
      p_scrap_qty,
      'scrap_ready',
      'Брак деталі',
      'шт'
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'card_id', p_card_id,
    'prev_qty', v_current_card.quantity,
    'new_qty', v_new_qty,
    'status', v_target_status,
    'scrap_logged', p_scrap_qty,
    'rpc_version', v_rpc_version
  );
END;
$$;

GRANT EXECUTE ON FUNCTION rpc_qc_scrap_atomic(UUID, NUMERIC, JSONB, TEXT) TO anon, authenticated, service_role;
