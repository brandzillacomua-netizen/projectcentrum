-- Migration: Telemetry Data Retention & Auto-Prune Procedure
-- rollout-contract: v1
-- risk: low
-- transaction: transactional
-- preflight: supabase/diagnostics/20260918120000_sys_sync_pings_retention_cron_preflight.sql
-- postcondition: supabase/diagnostics/20260918120000_sys_sync_pings_retention_cron_postcondition.sql
-- rollback: supabase/rollbacks/20260918120000_sys_sync_pings_retention_cron_rollback.sql

SET lock_timeout = '5s';
SET statement_timeout = '30s';

BEGIN;

-- 1. Create Telemetry Cleanup Procedure
CREATE OR REPLACE FUNCTION public.rpc_cleanup_system_telemetry()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_pings_deleted integer := 0;
  v_logs_deleted integer := 0;
BEGIN
  -- Delete network sync pings older than 7 days
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'sys_sync_pings') THEN
    DELETE FROM public.sys_sync_pings
    WHERE created_at < (now() - interval '7 days');
    GET DIAGNOSTICS v_pings_deleted = ROW_COUNT;
  END IF;

  -- Delete system access logs older than 90 days
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'system_access_logs') THEN
    DELETE FROM public.system_access_logs
    WHERE created_at < (now() - interval '90 days');
    GET DIAGNOSTICS v_logs_deleted = ROW_COUNT;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'pings_deleted', v_pings_deleted,
    'logs_deleted', v_logs_deleted,
    'executed_at', now()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_cleanup_system_telemetry() TO authenticated, service_role;

-- 2. Schedule nightly pg_cron job at 03:00 AM if pg_cron is enabled
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'auto-telemetry-cleanup',
      '0 3 * * *', -- At 03:00 AM every night
      'SELECT public.rpc_cleanup_system_telemetry();'
    );
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'pg_cron extension not active or schedule already exists: %', SQLERRM;
END;
$$;

COMMIT;
