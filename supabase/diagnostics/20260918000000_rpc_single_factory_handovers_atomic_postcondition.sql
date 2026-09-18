-- Postcondition for rpc_single_factory_handovers_atomic
SELECT count(*) FROM pg_proc WHERE proname IN ('rpc_handover_task_to_shop2_atomic', 'rpc_handover_to_sgp_atomic');
