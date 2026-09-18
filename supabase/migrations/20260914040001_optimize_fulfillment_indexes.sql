-- Migration: Optimize fulfillment queue queries with expression indexes on tasks plan_snapshot
-- rollout-contract: v1
-- risk: low
-- transaction: transactional
-- preflight: supabase/diagnostics/20260914040001_optimize_fulfillment_indexes_preflight.sql
-- postcondition: supabase/diagnostics/20260914040001_optimize_fulfillment_indexes_postcondition.sql
-- rollback: supabase/rollbacks/20260914040001_optimize_fulfillment_indexes_rollback.sql

SET lock_timeout = '5s';
SET statement_timeout = '10s';

BEGIN;

-- Expression index for ready-to-package tasks
CREATE INDEX IF NOT EXISTS idx_tasks_is_packaged
ON public.tasks (((plan_snapshot->_metadata->>'is_packaged')));

-- Expression index for ready-to-ship tasks
CREATE INDEX IF NOT EXISTS idx_tasks_is_shipped
ON public.tasks (((plan_snapshot->_metadata->>'is_shipped')));

-- Composite expression index for fast status + packaging filtering
CREATE INDEX IF NOT EXISTS idx_tasks_status_packaged
ON public.tasks (status, ((plan_snapshot->_metadata->>'is_packaged')));

COMMIT;
