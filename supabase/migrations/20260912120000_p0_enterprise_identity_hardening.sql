-- P0 enterprise hardening: bind every privileged operation to auth.uid().

ALTER TABLE public.system_users ADD COLUMN IF NOT EXISTS auth_user_id UUID;

UPDATE public.system_users su
SET auth_user_id = au.id
FROM auth.users au
WHERE su.auth_user_id IS NULL
  AND (
    CASE WHEN COALESCE(au.raw_user_meta_data->>'system_user_id', '') ~ '^[0-9]+$'
      THEN (au.raw_user_meta_data->>'system_user_id')::BIGINT = su.id ELSE FALSE END
    OR LOWER(au.email) = LOWER(su.login)
    OR LOWER(au.email) = LOWER(su.login || '@centrum.local')
  );

CREATE UNIQUE INDEX IF NOT EXISTS system_users_auth_user_id_uidx
  ON public.system_users(auth_user_id) WHERE auth_user_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.mes_current_system_user_id()
RETURNS BIGINT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
  SELECT su.id FROM public.system_users su WHERE su.auth_user_id = auth.uid() LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.mes_current_system_user_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mes_current_system_user_id() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.rpc_current_user_profile()
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE v_profile JSONB;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  SELECT jsonb_build_object(
    'id', su.id, 'login', su.login, 'first_name', su.first_name, 'last_name', su.last_name,
    'position', su.position, 'access_rights', su.access_rights, 'department', su.department,
    'shift', su.shift, 'notification_settings', su.notification_settings, 'avatar', su.avatar,
    'last_seen', su.last_seen, 'shift_calendar', su.shift_calendar
  ) INTO v_profile FROM public.system_users su WHERE su.auth_user_id = auth.uid();
  IF v_profile IS NULL THEN RAISE EXCEPTION 'MES profile is not linked to this account' USING ERRCODE = '42501'; END IF;
  RETURN v_profile;
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_current_user_profile() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_current_user_profile() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.trg_sync_system_user_to_auth()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, extensions AS $$
DECLARE v_auth_user_id UUID;
BEGIN
  IF NEW.password IS NOT NULL AND NEW.password <> '' THEN
    PERFORM public.sync_system_user_to_auth(NEW.login);
    SELECT au.id INTO v_auth_user_id FROM auth.users au
    WHERE LOWER(au.email) = LOWER(CASE WHEN POSITION('@' IN NEW.login) > 0 THEN NEW.login ELSE NEW.login || '@centrum.local' END)
    LIMIT 1;
    IF v_auth_user_id IS NOT NULL THEN UPDATE public.system_users SET auth_user_id = v_auth_user_id WHERE id = NEW.id; END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_touch_user_presence(p_user_id BIGINT DEFAULT NULL)
RETURNS TIMESTAMPTZ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE v_caller_id BIGINT := public.mes_current_system_user_id(); v_now TIMESTAMPTZ := NOW();
BEGIN
  IF v_caller_id IS NULL OR (p_user_id IS NOT NULL AND p_user_id <> v_caller_id) THEN
    RAISE EXCEPTION 'Cannot update another user presence' USING ERRCODE = '42501';
  END IF;
  UPDATE public.system_users SET last_seen = v_now WHERE id = v_caller_id;
  RETURN v_now;
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_touch_user_presence(BIGINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_touch_user_presence(BIGINT) TO authenticated, service_role;

-- Disable caller-controlled signatures and expose auth-bound wrappers.
REVOKE ALL ON FUNCTION public.rpc_admin_upsert_user(BIGINT, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rpc_admin_delete_user(BIGINT, BIGINT) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.rpc_admin_upsert_user(p_user_payload JSONB)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, extensions AS $$
DECLARE v_caller_id BIGINT := public.mes_current_system_user_id();
BEGIN
  IF v_caller_id IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  RETURN public.rpc_admin_upsert_user(v_caller_id, p_user_payload);
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_admin_delete_user(p_target_user_id BIGINT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, extensions AS $$
DECLARE v_caller_id BIGINT := public.mes_current_system_user_id();
BEGIN
  IF v_caller_id IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  RETURN public.rpc_admin_delete_user(v_caller_id, p_target_user_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_admin_import_users(p_user_payloads JSONB)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, extensions AS $$
DECLARE
  v_caller_id BIGINT := public.mes_current_system_user_id();
  v_caller_rights JSONB; v_payload JSONB; v_result JSONB; v_results JSONB := '[]'::JSONB;
BEGIN
  SELECT access_rights INTO v_caller_rights FROM public.system_users WHERE id = v_caller_id;
  IF v_caller_id IS NULL OR NOT (COALESCE((v_caller_rights->>'admin')::BOOLEAN, FALSE) OR COALESCE((v_caller_rights->>'director')::BOOLEAN, FALSE)) THEN
    RAISE EXCEPTION 'Administrator rights required' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(p_user_payloads) <> 'array' OR jsonb_array_length(p_user_payloads) > 500 THEN
    RAISE EXCEPTION 'Expected an array of at most 500 users' USING ERRCODE = '22023';
  END IF;
  FOR v_payload IN SELECT value FROM jsonb_array_elements(p_user_payloads) LOOP
    v_result := public.rpc_admin_upsert_user(v_caller_id, v_payload);
    IF COALESCE((v_result->>'success')::BOOLEAN, FALSE) IS NOT TRUE THEN
      RAISE EXCEPTION 'User import failed: %', COALESCE(v_result->>'error', 'unknown error');
    END IF;
    v_results := v_results || jsonb_build_array(v_result->'data');
  END LOOP;
  RETURN jsonb_build_object('success', TRUE, 'count', jsonb_array_length(v_results), 'data', v_results);
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_admin_upsert_user(JSONB) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rpc_admin_delete_user(BIGINT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rpc_admin_import_users(JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_admin_upsert_user(JSONB) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_admin_delete_user(BIGINT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_admin_import_users(JSONB) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.verify_user_password(TEXT, TEXT) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON TABLE public.system_users FROM anon, authenticated;
GRANT SELECT (id, first_name, last_name, position, access_rights) ON public.system_users TO anon;
GRANT SELECT (id, login, first_name, last_name, position, access_rights, department, shift, notification_settings, avatar, last_seen, shift_calendar, auth_user_id)
  ON public.system_users TO authenticated;
GRANT UPDATE (last_seen) ON public.system_users TO authenticated;

ALTER TABLE public.system_users ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE p RECORD; BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'system_users'
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON public.system_users', p.policyname); END LOOP;
END $$;
CREATE POLICY system_users_authenticated_directory ON public.system_users FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY system_users_public_call_directory ON public.system_users FOR SELECT TO anon USING (TRUE);
CREATE POLICY system_users_own_presence ON public.system_users FOR UPDATE TO authenticated
  USING (auth_user_id = auth.uid()) WITH CHECK (auth_user_id = auth.uid());

REVOKE ALL ON TABLE public.security_audit_events FROM anon, authenticated;
ALTER TABLE public.security_audit_events ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE p RECORD; BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'security_audit_events'
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON public.security_audit_events', p.policyname); END LOOP;
END $$;

-- Abort atomically instead of silently locking out partially migrated accounts.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.system_users WHERE auth_user_id IS NULL) THEN
    RAISE EXCEPTION 'P0 migration aborted: one or more system users are not linked to auth.users';
  END IF;
END $$;
