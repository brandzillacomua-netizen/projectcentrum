-- Rollback for rpc_single_factory_handovers_atomic
BEGIN;
DROP FUNCTION IF EXISTS public.rpc_handover_task_to_shop2_atomic(uuid);
DROP FUNCTION IF EXISTS public.rpc_handover_to_sgp_atomic(uuid);
COMMIT;
