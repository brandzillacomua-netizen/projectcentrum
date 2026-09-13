-- Migration: Create System Access Logs Table and Audit Logging RPC
-- rollout-contract: v1
-- risk: low
-- transaction: transactional
-- preflight: supabase/diagnostics/20260914020000_create_system_access_logs_preflight.sql
-- postcondition: supabase/diagnostics/20260914020000_create_system_access_logs_postcondition.sql
-- rollback: supabase/rollbacks/20260914020000_create_system_access_logs_rollback.sql

SET lock_timeout = '5s';
SET statement_timeout = '10s';

BEGIN;

SET search_path = '';

CREATE TABLE IF NOT EXISTS public.system_access_logs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id BIGINT REFERENCES public.system_users(id) ON DELETE SET NULL,
  user_login TEXT NOT NULL,
  user_name TEXT,
  action_type TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'auth',
  ip_address TEXT,
  details TEXT,
  status TEXT NOT NULL DEFAULT 'success'
);

CREATE INDEX IF NOT EXISTS idx_system_access_logs_created_at ON public.system_access_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_access_logs_user_login ON public.system_access_logs (user_login);

ALTER TABLE public.system_access_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS system_access_logs_authenticated_select ON public.system_access_logs;
CREATE POLICY system_access_logs_authenticated_select ON public.system_access_logs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.system_users su
      WHERE su.auth_user_id = auth.uid()
        AND (
          (su.access_rights->>'director')::boolean = TRUE
          OR (su.access_rights->>'settings')::boolean = TRUE
        )
    )
  );

DROP POLICY IF EXISTS system_access_logs_authenticated_insert ON public.system_access_logs;
CREATE POLICY system_access_logs_authenticated_insert ON public.system_access_logs
  FOR INSERT TO authenticated
  WITH CHECK (TRUE);

GRANT SELECT, INSERT ON public.system_access_logs TO authenticated;

-- RPC helper for client modules to record real security audit events
CREATE OR REPLACE FUNCTION public.rpc_log_security_event(
  p_action_type TEXT,
  p_category TEXT DEFAULT 'auth',
  p_details TEXT DEFAULT NULL,
  p_status TEXT DEFAULT 'success'
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id BIGINT;
  v_caller_login TEXT;
  v_caller_name TEXT;
  v_log_id BIGINT;
BEGIN
  SELECT su.id, su.login, TRIM(COALESCE(su.first_name, '') || ' ' || COALESCE(su.last_name, ''))
  INTO v_caller_id, v_caller_login, v_caller_name
  FROM public.system_users su
  WHERE su.auth_user_id = auth.uid()
  LIMIT 1;

  IF v_caller_login IS NULL THEN
    v_caller_login := 'anonymous';
    v_caller_name := 'Гість';
  END IF;

  INSERT INTO public.system_access_logs (
    user_id, user_login, user_name, action_type, category, details, status
  ) VALUES (
    v_caller_id, v_caller_login, v_caller_name, p_action_type, p_category, p_details, p_status
  ) RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_log_security_event(TEXT, TEXT, TEXT, TEXT) TO authenticated;

COMMIT;
