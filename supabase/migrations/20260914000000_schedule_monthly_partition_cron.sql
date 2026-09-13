-- Migration: Schedule Monthly Partition Cron
-- rollout-contract: v1
-- risk: low
-- transaction: transactional
-- preflight: supabase/diagnostics/20260914000000_schedule_monthly_partition_cron_preflight.sql
-- postcondition: supabase/diagnostics/20260914000000_schedule_monthly_partition_cron_postcondition.sql
-- rollback: supabase/rollbacks/20260914000000_schedule_monthly_partition_cron_rollback.sql

SET lock_timeout = '5s';
SET statement_timeout = '30s';

BEGIN;

CREATE OR REPLACE FUNCTION rpc_create_monthly_partitions()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_curr_date date := date_trunc('month', CURRENT_DATE);
  v_target_date date;
  v_next_date date;
  v_partition_name text;
  v_sql text;
  v_created_count integer := 0;
  i integer;
BEGIN
  -- Ensure partitions exist for current month + 3 months ahead
  FOR i IN 0..3 LOOP
    v_target_date := v_curr_date + (i || ' month')::interval;
    v_next_date := v_target_date + '1 month'::interval;
    v_partition_name := 'work_card_history_' || to_char(v_target_date, 'YYYY_MM');

    -- Check if partition table exists in public schema
    IF NOT EXISTS (
      SELECT 1 
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' 
        AND c.relname = v_partition_name
    ) THEN
      v_sql := format(
        'CREATE TABLE IF NOT EXISTS public.%I PARTITION OF public.work_card_history FOR VALUES FROM (%L) TO (%L);',
        v_partition_name,
        to_char(v_target_date, 'YYYY-MM-01'),
        to_char(v_next_date, 'YYYY-MM-01')
      );
      EXECUTE v_sql;
      v_created_count := v_created_count + 1;
    END IF;
  END LOOP;

  RETURN format('Monthly partition maintenance executed cleanly. Created %s new partitions.', v_created_count);
END;
$$;

-- Grant execution to authenticated & service_role
GRANT EXECUTE ON FUNCTION rpc_create_monthly_partitions() TO authenticated, service_role;

-- Conditionally schedule pg_cron task if extension is available
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'auto-monthly-partitions',
      '0 0 1 * *', -- At 00:00 on day-of-month 1
      'SELECT rpc_create_monthly_partitions();'
    );
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'pg_cron extension not active or schedule already exists: %', SQLERRM;
END;
$$;

COMMIT;
