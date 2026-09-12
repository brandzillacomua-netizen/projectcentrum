-- Contract phase: apply only after the RPC-based client is deployed and verified.

DO $$
BEGIN
  IF to_regprocedure('public.rpc_public_machine_call_context(uuid)') IS NULL
    OR to_regprocedure('public.rpc_public_create_machine_call(uuid,text,text,bigint)') IS NULL THEN
    RAISE EXCEPTION 'Public machine-call RPCs must exist before contract phase';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.mes_can_resolve_machine_call()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.system_users AS su
    WHERE su.auth_user_id = auth.uid()
      AND (
        su.access_rights @> ANY (ARRAY[
          '{"master": true}'::JSONB,
          '{"foreman": true}'::JSONB,
          '{"foreman2": true}'::JSONB,
          '{"engineer": true}'::JSONB,
          '{"brak": true}'::JSONB,
          '{"machines": true}'::JSONB,
          '{"admin": true}'::JSONB,
          '{"director": true}'::JSONB
        ])
        OR COALESCE(su.position, '') ILIKE ANY (
          ARRAY['%майстер%', '%інженер%', '%вкя%', '%якост%', '%начальник%']
        )
      )
  )
$$;

REVOKE ALL ON FUNCTION public.mes_can_resolve_machine_call() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mes_can_resolve_machine_call() TO authenticated, service_role;

ALTER TABLE public.machine_calls ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE p RECORD;
BEGIN
  FOR p IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'machine_calls'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.machine_calls', p.policyname);
  END LOOP;
END;
$$;

CREATE POLICY machine_calls_authenticated_read
  ON public.machine_calls FOR SELECT TO authenticated
  USING (public.mes_current_system_user_id() IS NOT NULL);

CREATE POLICY machine_calls_authorized_resolve
  ON public.machine_calls FOR UPDATE TO authenticated
  USING (public.mes_can_resolve_machine_call())
  WITH CHECK (public.mes_can_resolve_machine_call());

REVOKE ALL PRIVILEGES ON TABLE public.machine_calls FROM anon, authenticated;
GRANT SELECT ON TABLE public.machine_calls TO authenticated;
GRANT UPDATE (status, resolved_at, resolved_by) ON TABLE public.machine_calls TO authenticated;

DROP POLICY IF EXISTS "Allow public read on machines" ON public.machines;
DROP POLICY IF EXISTS "Allow public call creation on machine_calls" ON public.machine_calls;
DROP POLICY IF EXISTS "Allow public basic profile reads for calls" ON public.system_users;
DROP POLICY IF EXISTS system_users_public_call_directory ON public.system_users;

REVOKE ALL PRIVILEGES ON TABLE public.machines FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public.machine_calls FROM anon;
REVOKE SELECT (id, first_name, last_name, position, access_rights) ON public.system_users FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public.system_users FROM anon;

