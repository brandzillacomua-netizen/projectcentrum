-- Rollback script for monthly partition cron migration
BEGIN;
DROP FUNCTION IF EXISTS rpc_create_monthly_partitions();
COMMIT;
