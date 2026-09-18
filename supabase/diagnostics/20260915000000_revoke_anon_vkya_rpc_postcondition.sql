-- Postcondition for revoke_anon_vkya_rpc
SELECT count(*) FROM pg_proc WHERE proname = 'vkya_classification_queue_changes';
