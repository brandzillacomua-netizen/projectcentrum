-- Postcondition for rpc_reserve_material_atomic
SELECT count(*) FROM pg_proc WHERE proname = 'rpc_reserve_material_atomic';
