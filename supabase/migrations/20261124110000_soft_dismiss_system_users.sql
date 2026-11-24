-- Soft-dismissal for system_users:
-- Keeps employee records intact for all historical reports while blocking login/sessions
-- and hiding dismissed staff from active terminal operator pickers.

SET lock_timeout = '5s';
SET statement_timeout = '60s';

BEGIN;

ALTER TABLE public.system_users
  ADD COLUMN IF NOT EXISTS is_dismissed BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS dismissed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dismissed_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_system_users_is_dismissed
  ON public.system_users (is_dismissed);

CREATE OR REPLACE FUNCTION public.rpc_current_user_profile()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_row public.system_users%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT su.* INTO v_row
  FROM public.system_users su
  WHERE su.auth_user_id = auth.uid()
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'MES profile is not linked to this account' USING ERRCODE = '42501';
  END IF;

  IF COALESCE(v_row.is_dismissed, false) THEN
    RAISE EXCEPTION 'Обліковий запис звільнено та деактивовано' USING ERRCODE = '42501';
  END IF;

  RETURN jsonb_build_object(
    'id', v_row.id,
    'login', v_row.login,
    'first_name', v_row.first_name,
    'last_name', v_row.last_name,
    'position', v_row.position,
    'access_rights', v_row.access_rights,
    'department', v_row.department,
    'shift', v_row.shift,
    'notification_settings', v_row.notification_settings,
    'avatar', v_row.avatar,
    'last_seen', v_row.last_seen,
    'shift_calendar', v_row.shift_calendar,
    'is_dismissed', COALESCE(v_row.is_dismissed, false),
    'dismissed_at', v_row.dismissed_at,
    'dismissed_reason', v_row.dismissed_reason
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_current_user_profile() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_current_user_profile() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.rpc_admin_set_user_dismissed(
  p_user_id BIGINT,
  p_dismissed BOOLEAN,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_caller_id BIGINT := public.mes_current_system_user_id();
  v_caller public.system_users%ROWTYPE;
  v_target public.system_users%ROWTYPE;
  v_is_admin BOOLEAN := false;
  v_is_shop1_foreman BOOLEAN := false;
  v_is_shop2_foreman BOOLEAN := false;
  v_can_manage BOOLEAN := false;
  v_updated public.system_users%ROWTYPE;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Не вказано користувача');
  END IF;

  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Необхідна авторизація');
  END IF;

  IF p_dismissed AND v_caller_id = p_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Не можна звільнити власний обліковий запис');
  END IF;

  SELECT * INTO v_caller FROM public.system_users WHERE id = v_caller_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Профіль адміністратора не знайдено');
  END IF;

  v_is_admin := COALESCE((
    COALESCE(v_caller.access_rights->>'settings', '') = 'true' OR
    COALESCE(v_caller.access_rights->>'admin', '') = 'true' OR
    COALESCE(v_caller.access_rights->>'director', '') = 'true' OR
    COALESCE(v_caller.position, '') ILIKE '%адмін%' OR
    COALESCE(v_caller.position, '') ILIKE '%admin%' OR
    COALESCE(v_caller.login, '') = 'admin@workshop.local'
  ), false);

  v_is_shop2_foreman := COALESCE(v_caller.access_rights->>'shop2_foreman' = 'true', false);
  v_is_shop1_foreman := COALESCE((
    COALESCE(v_caller.access_rights->>'shop1_foreman', '') = 'true' OR
    COALESCE(v_caller.access_rights->>'foreman', '') = 'true'
  ), false);

  SELECT * INTO v_target FROM public.system_users WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Працівника не знайдено');
  END IF;

  v_can_manage := v_is_admin
    OR (v_is_shop2_foreman AND COALESCE(v_target.department, '') ILIKE '%цех%2%')
    OR (v_is_shop1_foreman AND COALESCE(v_target.department, '') ILIKE '%цех%1%');

  IF NOT v_can_manage THEN
    RETURN jsonb_build_object('success', false, 'error', 'У вас немає прав для зміни статусу цього працівника');
  END IF;

  UPDATE public.system_users
  SET
    is_dismissed = COALESCE(p_dismissed, false),
    dismissed_at = CASE WHEN COALESCE(p_dismissed, false) THEN now() ELSE NULL END,
    dismissed_reason = CASE WHEN COALESCE(p_dismissed, false) THEN nullif(btrim(p_reason), '') ELSE NULL END
  WHERE id = p_user_id
  RETURNING * INTO v_updated;

  RETURN jsonb_build_object(
    'success', true,
    'data', jsonb_build_object(
      'id', v_updated.id,
      'login', v_updated.login,
      'first_name', v_updated.first_name,
      'last_name', v_updated.last_name,
      'position', v_updated.position,
      'access_rights', v_updated.access_rights,
      'department', v_updated.department,
      'shift', v_updated.shift,
      'notification_settings', v_updated.notification_settings,
      'avatar', v_updated.avatar,
      'last_seen', v_updated.last_seen,
      'shift_calendar', v_updated.shift_calendar,
      'is_dismissed', COALESCE(v_updated.is_dismissed, false),
      'dismissed_at', v_updated.dismissed_at,
      'dismissed_reason', v_updated.dismissed_reason
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_admin_set_user_dismissed(BIGINT, BOOLEAN, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_admin_set_user_dismissed(BIGINT, BOOLEAN, TEXT) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
