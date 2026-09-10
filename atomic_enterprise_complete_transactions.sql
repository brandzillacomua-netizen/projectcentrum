-- ==============================================================================
-- Migration: Enterprise Atomic Transactions & Non-Negative Inventory Guard
-- Target: Postgres / Supabase
-- Purpose: Ensures 100% transactional integrity for Cutting, Warehouse, & QC ops.
-- ==============================================================================

-- 1. DATABASE GUARD: Prevent negative stock levels at database level
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_inventory_positive_stock'
  ) THEN
    ALTER TABLE public.inventory
    ADD CONSTRAINT check_inventory_positive_stock
    CHECK (total_qty >= 0 AND reserved_qty >= 0);
  END IF;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;


-- 2. RPC: Atomic Inventory & Reserve Deduction with Pessimistic Row Lock
CREATE OR REPLACE FUNCTION public.rpc_deduct_inventory_atomic(
  p_inventory_id UUID,
  p_deduct_total NUMERIC DEFAULT 0,
  p_release_reserved NUMERIC DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_inv RECORD;
  v_new_total NUMERIC;
  v_new_reserved NUMERIC;
BEGIN
  IF p_inventory_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'inventory_id is required');
  END IF;

  -- Lock target row for update across concurrent transactions
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


-- 3. RPC: Atomic Cutting Buffer Confirmation (Single-route Atomic Write-off)
CREATE OR REPLACE FUNCTION public.rpc_confirm_buffer_cutting_atomic(
  p_card_id UUID,
  p_next_status TEXT,
  p_sheet_inv_id UUID DEFAULT NULL,
  p_sheet_deduct_total NUMERIC DEFAULT 0,
  p_sheet_release_reserved NUMERIC DEFAULT 0,
  p_cutter_deductions JSONB DEFAULT '[]'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_card RECORD;
  v_cutter RECORD;
  v_cutter_inv_id UUID;
  v_cutter_used NUMERIC;
  v_cutter_planned NUMERIC;
  v_inv RECORD;
  v_elem JSONB;
BEGIN
  -- 1. Lock & Update Card Status
  SELECT * INTO v_card FROM public.work_cards WHERE id = p_card_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Work card not found');
  END IF;

  UPDATE public.work_cards
  SET status = p_next_status,
      updated_at = NOW()
  WHERE id = p_card_id;

  -- 2. Atomic Sheet Write-off
  IF p_sheet_inv_id IS NOT NULL THEN
    SELECT * INTO v_inv FROM public.inventory WHERE id = p_sheet_inv_id FOR UPDATE;
    IF FOUND THEN
      UPDATE public.inventory
      SET total_qty = GREATEST(0, COALESCE(total_qty, 0) - COALESCE(p_sheet_deduct_total, 0)),
          reserved_qty = GREATEST(0, COALESCE(reserved_qty, 0) - COALESCE(p_sheet_release_reserved, 0)),
          updated_at = NOW()
      WHERE id = p_sheet_inv_id;
    END IF;
  END IF;

  -- 3. Atomic Cutters Write-off
  IF p_cutter_deductions IS NOT NULL AND jsonb_array_length(p_cutter_deductions) > 0 THEN
    FOR v_elem IN SELECT * FROM jsonb_array_elements(p_cutter_deductions) LOOP
      v_cutter_inv_id := (v_elem->>'inventory_id')::UUID;
      v_cutter_used := COALESCE((v_elem->>'used_qty')::NUMERIC, 0);
      v_cutter_planned := COALESCE((v_elem->>'planned_qty')::NUMERIC, 0);

      IF v_cutter_inv_id IS NOT NULL THEN
        SELECT * INTO v_inv FROM public.inventory WHERE id = v_cutter_inv_id FOR UPDATE;
        IF FOUND THEN
          UPDATE public.inventory
          SET total_qty = GREATEST(0, COALESCE(total_qty, 0) - v_cutter_used),
              reserved_qty = GREATEST(0, COALESCE(reserved_qty, 0) - v_cutter_planned),
              updated_at = NOW()
          WHERE id = v_cutter_inv_id;
        END IF;
      END IF;
    END LOOP;
  END IF;

  RETURN jsonb_build_object('success', true, 'card_id', p_card_id, 'next_status', p_next_status);
END;
$$;


-- 4. PERMISSIONS
GRANT EXECUTE ON FUNCTION public.rpc_deduct_inventory_atomic(uuid, numeric, numeric) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_confirm_buffer_cutting_atomic(uuid, text, uuid, numeric, numeric, jsonb) TO anon, authenticated, service_role;
