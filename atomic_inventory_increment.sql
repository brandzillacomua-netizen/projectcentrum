-- ═══════════════════════════════════════════════════════════════════════════
-- 🚀 ENTERPRISE MIGRATION: ATOMIC INVENTORY INCREMENT (ACID SCRAP & STOCK)
-- Процедура: rpc_increment_inventory_stock
-- Версія: 2026-09-05.inventory_inc_v1
-- База даних: CRM КУЛИЦЯ / MES CENTRUM
-- Запустити в Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

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

  -- 1. Транзакційне блокування рядка складу (FOR UPDATE)
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
    -- 2. Якщо запис відсутній, підтягуємо найменування та одиницю з nomenclatures
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
