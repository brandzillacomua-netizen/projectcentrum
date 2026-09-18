-- Rollback for optimize_fulfillment_indexes
BEGIN;
DROP INDEX IF EXISTS idx_tasks_is_packaged;
DROP INDEX IF EXISTS idx_tasks_is_shipped;
DROP INDEX IF EXISTS idx_tasks_status_packaged;
COMMIT;
