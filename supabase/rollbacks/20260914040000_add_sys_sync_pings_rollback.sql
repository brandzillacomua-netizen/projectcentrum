-- Rollback for add_sys_sync_pings
BEGIN;
DROP TABLE IF EXISTS public.sys_sync_pings CASCADE;
DROP FUNCTION IF EXISTS public.fn_sys_sync_ping();
COMMIT;
