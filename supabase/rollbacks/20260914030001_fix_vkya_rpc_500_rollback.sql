-- Rollback for fix_vkya_rpc_500
BEGIN;
DROP FUNCTION IF EXISTS public.vkya_classification_queue_changes(bigint);
COMMIT;
