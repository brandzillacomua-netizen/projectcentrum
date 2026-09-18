-- Postcondition for optimize_fulfillment_indexes
SELECT count(*) FROM pg_indexes WHERE indexname = 'idx_tasks_is_packaged';
