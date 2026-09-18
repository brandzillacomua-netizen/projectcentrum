-- Postcondition for rpc_delete_order_atomic
SELECT count(*) FROM pg_proc WHERE proname = 'rpc_super_delete_order';
