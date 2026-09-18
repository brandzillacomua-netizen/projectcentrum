-- Preflight check for telemetry retention migration
SELECT count(*) FROM pg_proc WHERE proname = 'rpc_cleanup_system_telemetry';
