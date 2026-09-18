-- Rollback for telemetry retention migration
BEGIN;
DROP FUNCTION IF EXISTS public.rpc_cleanup_system_telemetry();
COMMIT;
