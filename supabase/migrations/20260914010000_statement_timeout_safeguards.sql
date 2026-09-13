-- Migration: Statement Timeout Safeguards & Enterprise Statement Timeout Controls
-- rollout-contract: v1
-- risk: low
-- transaction: transactional
-- preflight: supabase/diagnostics/20260914010000_statement_timeout_safeguards_preflight.sql
-- postcondition: supabase/diagnostics/20260914010000_statement_timeout_safeguards_postcondition.sql
-- rollback: supabase/rollbacks/20260914010000_statement_timeout_safeguards_rollback.sql

SET lock_timeout = '5s';
SET statement_timeout = '10s';

BEGIN;

SET search_path = '';

DO $$
BEGIN
  ALTER ROLE authenticated SET statement_timeout = '8000ms';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not set statement_timeout on role authenticated: %', SQLERRM;
END $$;

COMMIT;
