-- Migration: RPC Void Order Atomic
-- rollout-contract: v1
-- risk: low
-- transaction: transactional
-- preflight: supabase/diagnostics/20260915000002_rpc_void_order_atomic_preflight.sql
-- postcondition: supabase/diagnostics/20260915000002_rpc_void_order_atomic_postcondition.sql
-- rollback: supabase/rollbacks/20260915000002_rpc_void_order_atomic_rollback.sql

SET lock_timeout = '5s';
SET statement_timeout = '15s';

BEGIN;

-- 1. Drop the incorrect bigint implementation from 20260915000001
DROP FUNCTION IF EXISTS public.rpc_super_delete_order(bigint);

-- 2. Create the true UUID implementation with soft-delete and compensating ledger
CREATE OR REPLACE FUNCTION public.rpc_void_order_atomic(
  p_order_id uuid,
  p_reason text,
  p_idempotency_key text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $body$
DECLARE
  v_auth_uid uuid := auth.uid();
  v_caller_role text;
  v_order_status text;
  v_task_ids uuid[];
  v_card_ids uuid[];
  v_res record;
  v_mat record;
BEGIN
  
  IF v_auth_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  
  -- Role check: verify if user is admin, director, or has specific delete_order rights
  SELECT (access_rights->>'admin')::text INTO v_caller_role FROM public.system_users WHERE auth_user_id = v_auth_uid LIMIT 1;
  IF v_caller_role IS DISTINCT FROM 'true' THEN
    SELECT (access_rights->>'director')::text INTO v_caller_role FROM public.system_users WHERE auth_user_id = v_auth_uid LIMIT 1;
    IF v_caller_role IS DISTINCT FROM 'true' THEN
      SELECT (access_rights->>'delete_order')::text INTO v_caller_role FROM public.system_users WHERE auth_user_id = v_auth_uid LIMIT 1;
      IF v_caller_role IS DISTINCT FROM 'true' THEN
        RAISE EXCEPTION 'Insufficient permissions to void orders' USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;

  -- Idempotency Check
  IF EXISTS (SELECT 1 FROM public.security_audit_events WHERE action = 'void_order' AND resource_id = p_order_id::text AND details->>'idempotency_key' = p_idempotency_key) THEN
    RETURN; -- Silent success if already processed
  END IF;
  
  -- Audit Log
  INSERT INTO public.security_audit_events (actor_id, action, resource_id, details)
  VALUES (v_auth_uid, 'void_order', p_order_id::text, jsonb_build_object('reason', p_reason, 'idempotency_key', p_idempotency_key));

  -- Lock the order
  SELECT status INTO v_order_status FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order % not found', p_order_id USING ERRCODE = 'P0002';
  END IF;

  IF v_order_status IN ('shipped', 'completed', 'voided') THEN
    RAISE EXCEPTION 'Cannot void order in status: %', v_order_status USING ERRCODE = 'P0001';
  END IF;

  -- Gather and lock tasks
  SELECT array_agg(id) INTO v_task_ids FROM public.tasks WHERE order_id = p_order_id FOR UPDATE;
  IF v_task_ids IS NULL THEN v_task_ids := array[]::uuid[]; END IF;

  -- Gather and lock work cards
  SELECT array_agg(id) INTO v_card_ids FROM public.work_cards 
  WHERE order_id = p_order_id OR (array_length(v_task_ids, 1) > 0 AND task_id = ANY(v_task_ids))
  FOR UPDATE;
  IF v_card_ids IS NULL THEN v_card_ids := array[]::uuid[]; END IF;

  -- Revert BZ reservations atomically with stable ordering
  FOR v_res IN 
    SELECT id, operation_id FROM public.bz_inventory_reservations 
    WHERE status = 'allocated' AND (order_id = p_order_id OR (array_length(v_task_ids, 1) > 0 AND task_id = ANY(v_task_ids)))
    ORDER BY id ASC
    FOR UPDATE
  LOOP
    UPDATE public.bz_inventory_reservations SET status = 'released' WHERE id = v_res.id;
  END LOOP;

  -- Revert Material Requests (Inventory) atomically with stable ordering
  FOR v_mat IN
    SELECT mr.id, mr.inventory_id, mr.quantity, i.total_qty, i.reserved_qty
    FROM public.material_requests mr
    JOIN public.inventory i ON mr.inventory_id = i.id
    WHERE mr.status = 'reserved' AND (mr.order_id = p_order_id OR (array_length(v_task_ids, 1) > 0 AND mr.task_id = ANY(v_task_ids)))
    ORDER BY mr.inventory_id ASC 
    FOR UPDATE
  LOOP
    IF v_mat.reserved_qty - v_mat.quantity < 0 THEN
      RAISE EXCEPTION 'Inventory invariant violation: reserved_qty % < quantity % for inventory %', v_mat.reserved_qty, v_mat.quantity, v_mat.inventory_id;
    END IF;
    UPDATE public.inventory SET reserved_qty = reserved_qty - v_mat.quantity WHERE id = v_mat.inventory_id;
    UPDATE public.material_requests SET status = 'voided' WHERE id = v_mat.id;
  END LOOP;

  -- Apply soft deletes (void)
  IF array_length(v_card_ids, 1) > 0 THEN
    UPDATE public.work_cards SET status = 'voided' WHERE id = ANY(v_card_ids);
  END IF;

  IF array_length(v_task_ids, 1) > 0 THEN
    UPDATE public.tasks SET status = 'voided' WHERE id = ANY(v_task_ids);
  END IF;

  UPDATE public.orders SET status = 'voided' WHERE id = p_order_id;

END;
$body$;

REVOKE ALL ON FUNCTION public.rpc_void_order_atomic(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_void_order_atomic(uuid, text, text) TO authenticated;

COMMIT;
