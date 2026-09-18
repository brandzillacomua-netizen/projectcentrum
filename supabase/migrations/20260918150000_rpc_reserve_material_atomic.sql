-- Migration: RPC Atomic Material Reservation
-- rollout-contract: v1
-- risk: low
-- transaction: transactional
-- preflight: supabase/diagnostics/20260918150000_rpc_reserve_material_atomic_preflight.sql
-- postcondition: supabase/diagnostics/20260918150000_rpc_reserve_material_atomic_postcondition.sql
-- rollback: supabase/rollbacks/20260918150000_rpc_reserve_material_atomic_rollback.sql

SET lock_timeout = '5s';
SET statement_timeout = '15s';

BEGIN;

CREATE OR REPLACE FUNCTION public.rpc_reserve_material_atomic(
  p_inventory_id uuid,
  p_qty numeric,
  p_action text, -- 'reserve' | 'release' | 'deduct'
  p_idempotency_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $body$
DECLARE
  v_inv record;
  v_new_reserved numeric;
  v_new_total numeric;
BEGIN
  IF p_qty <= 0 THEN
    RAISE EXCEPTION 'Quantity must be positive' USING ERRCODE = 'P0001';
  END IF;

  -- 1. Row Lock
  SELECT * INTO v_inv FROM public.inventory WHERE id = p_inventory_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inventory item % not found', p_inventory_id USING ERRCODE = 'P0002';
  END IF;

  IF p_action = 'reserve' THEN
    v_new_reserved := v_inv.reserved_qty + p_qty;
    IF v_new_reserved > v_inv.total_qty THEN
      RAISE EXCEPTION 'Insufficient stock to reserve. Total: %, Current Reserved: %, Requested: %', 
        v_inv.total_qty, v_inv.reserved_qty, p_qty USING ERRCODE = 'P0003';
    END IF;

    UPDATE public.inventory
    SET reserved_qty = v_new_reserved,
        updated_at = now()
    WHERE id = p_inventory_id;

  ELSIF p_action = 'release' THEN
    v_new_reserved := GREATEST(0, v_inv.reserved_qty - p_qty);

    UPDATE public.inventory
    SET reserved_qty = v_new_reserved,
        updated_at = now()
    WHERE id = p_inventory_id;

  ELSIF p_action = 'deduct' THEN
    v_new_total := GREATEST(0, v_inv.total_qty - p_qty);
    v_new_reserved := GREATEST(0, v_inv.reserved_qty - p_qty);

    UPDATE public.inventory
    SET total_qty = v_new_total,
        reserved_qty = v_new_reserved,
        updated_at = now()
    WHERE id = p_inventory_id;

  ELSE
    RAISE EXCEPTION 'Invalid action: %', p_action USING ERRCODE = 'P0001';
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'inventory_id', p_inventory_id,
    'action', p_action,
    'total_qty', COALESCE(v_new_total, v_inv.total_qty),
    'reserved_qty', v_new_reserved
  );
END;
$body$;

GRANT EXECUTE ON FUNCTION public.rpc_reserve_material_atomic(uuid, numeric, text, text) TO authenticated;

COMMIT;
