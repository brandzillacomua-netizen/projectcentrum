-- Rollback for rpc_void_order_atomic
BEGIN;
DROP FUNCTION IF EXISTS public.rpc_void_order_atomic(uuid, text, text);
COMMIT;
