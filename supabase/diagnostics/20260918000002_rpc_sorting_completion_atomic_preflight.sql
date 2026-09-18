-- Preflight for rpc_sorting_completion_atomic
SELECT count(*) FROM pg_proc WHERE proname = 'rpc_submit_sorting_complete_atomic';
