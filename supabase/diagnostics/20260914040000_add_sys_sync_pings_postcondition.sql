-- Postcondition for add_sys_sync_pings
SELECT count(*) FROM pg_tables WHERE schemaname = 'public' AND tablename = 'sys_sync_pings';
