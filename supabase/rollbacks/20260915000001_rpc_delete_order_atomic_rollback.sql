-- Rollback for rpc_delete_order_atomic
BEGIN;
DROP FUNCTION IF EXISTS public.rpc_super_delete_order(bigint);
COMMIT;
