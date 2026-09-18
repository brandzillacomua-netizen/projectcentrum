-- Preflight for fix_vkya_rpc_500
SELECT count(*) FROM pg_proc WHERE proname = 'vkya_classification_queue_changes';
