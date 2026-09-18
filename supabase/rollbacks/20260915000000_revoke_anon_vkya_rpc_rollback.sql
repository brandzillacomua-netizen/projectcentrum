-- Rollback for revoke_anon_vkya_rpc
BEGIN;
GRANT EXECUTE ON FUNCTION public.vkya_classification_queue_changes(bigint) TO anon;
COMMIT;
