begin;

-- Data corrections are intentionally retained. Restore the previous function
-- body by reapplying the immediately preceding migration when rollback is needed.
-- The callable signature remains in place so clients are not broken.

commit;
