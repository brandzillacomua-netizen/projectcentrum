-- Rollback for rpc_reserve_material_atomic
BEGIN;
DROP FUNCTION IF EXISTS public.rpc_reserve_material_atomic(uuid, numeric, text, text);
COMMIT;
