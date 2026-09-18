-- Rollback for rpc_sorting_completion_atomic
BEGIN;
DROP FUNCTION IF EXISTS public.rpc_submit_sorting_complete_atomic(uuid, numeric, numeric, numeric, text, text);
COMMIT;
