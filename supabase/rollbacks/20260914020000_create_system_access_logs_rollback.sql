-- Rollback: Remove System Access Logs Table and Audit Logging RPC
DROP FUNCTION IF EXISTS public.rpc_log_security_event(TEXT, TEXT, TEXT, TEXT);
DROP TABLE IF EXISTS public.system_access_logs CASCADE;
