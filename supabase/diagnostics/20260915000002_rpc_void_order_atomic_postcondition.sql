-- Postcondition for rpc_void_order_atomic
SELECT count(*) FROM pg_proc WHERE proname = 'rpc_void_order_atomic';
