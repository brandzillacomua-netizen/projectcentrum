-- ==============================================================================
-- Migration: Atomic Inventory Deduction RPC
-- Eliminates lost updates and race conditions during simultaneous warehouse scans.
-- ==============================================================================

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

  -- Lock the target inventory row with FOR UPDATE
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

-- Permissions
REVOKE ALL ON FUNCTION public.rpc_deduct_inventory_atomic(uuid, numeric, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_deduct_inventory_atomic(uuid, numeric, numeric) TO anon, authenticated;
