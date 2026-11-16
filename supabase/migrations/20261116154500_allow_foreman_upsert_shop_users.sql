-- Allow Shop 2 / Shop 1 Foremen (who have module access `shop2_foreman` / `shop1_foreman`)
-- to create and edit staff within their own shop without requiring full admin/settings rights.
-- Privileged flags (`settings`, `admin`, `director`) remain restricted to full admins.

CREATE OR REPLACE FUNCTION public.rpc_admin_upsert_user(
  p_admin_id BIGINT,
  p_user_payload JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_admin_record RECORD;
  v_target_record RECORD;
  v_is_admin BOOLEAN := false;
  v_is_shop2_foreman BOOLEAN := false;
  v_is_shop1_foreman BOOLEAN := false;
  v_can_manage_target BOOLEAN := false;
  v_target_id BIGINT;
  v_incoming_login TEXT;
  v_raw_password TEXT;
  v_hashed_password TEXT;
  v_result JSONB;
  v_existing_id BIGINT;
  v_target_dept TEXT;
  v_payload_dept TEXT;
  v_safe_rights JSONB;
BEGIN
  IF p_user_payload IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User payload cannot be empty');
  END IF;

  v_target_id := NULLIF(p_user_payload->>'id', '')::BIGINT;
  v_incoming_login := TRIM(LOWER(COALESCE(p_user_payload->>'login', '')));
  v_raw_password := NULLIF(p_user_payload->>'password', '');
  v_payload_dept := COALESCE(p_user_payload->>'department', '');

  -- Перевірка прав викликача
  IF p_admin_id IS NOT NULL THEN
    SELECT * INTO v_admin_record
    FROM public.system_users
    WHERE id = p_admin_id;

    IF FOUND THEN
      v_is_admin := (
        v_admin_record.access_rights->>'settings' = 'true' OR 
        v_admin_record.access_rights->>'admin' = 'true' OR 
        v_admin_record.access_rights->>'director' = 'true' OR
        v_admin_record.position ILIKE '%адмін%' OR
        v_admin_record.position ILIKE '%admin%' OR
        v_admin_record.login = 'admin@workshop.local'
      );

      v_is_shop2_foreman := (v_admin_record.access_rights->>'shop2_foreman' = 'true');
      v_is_shop1_foreman := (
        v_admin_record.access_rights->>'shop1_foreman' = 'true' OR
        v_admin_record.access_rights->>'foreman' = 'true'
      );
    END IF;
  ELSE
    v_is_admin := verify_mes_session_or_app();
  END IF;

  v_can_manage_target := v_is_admin;

  -- Якщо не повний адмін, перевіряємо чи начальник цеху редагує/створює працівника свого цеху
  IF NOT v_is_admin THEN
    IF v_target_id IS NULL THEN
      IF v_is_shop2_foreman AND v_payload_dept ~* 'цех\s*№?\s*2' THEN
        v_can_manage_target := true;
      ELSIF v_is_shop1_foreman AND v_payload_dept ~* 'цех\s*№?\s*1' THEN
        v_can_manage_target := true;
      END IF;
    ELSE
      SELECT department INTO v_target_record FROM public.system_users WHERE id = v_target_id;
      v_target_dept := COALESCE(v_target_record.department, '');
      IF v_is_shop2_foreman AND v_target_dept ~* 'цех\s*№?\s*2' AND (v_payload_dept = '' OR v_payload_dept ~* 'цех\s*№?\s*2') THEN
        v_can_manage_target := true;
      ELSIF v_is_shop1_foreman AND v_target_dept ~* 'цех\s*№?\s*1' AND (v_payload_dept = '' OR v_payload_dept ~* 'цех\s*№?\s*1') THEN
        v_can_manage_target := true;
      END IF;
    END IF;
  END IF;

  -- Перевірка дозволу на дію
  IF v_target_id IS NULL AND NOT v_can_manage_target THEN
    INSERT INTO public.security_audit_events (event_type, table_name, payload, severity)
    VALUES ('UNAUTHORIZED_USER_CREATE_ATTEMPT', 'system_users', 
            jsonb_build_object('caller_id', p_admin_id, 'payload', p_user_payload - 'password'), 'CRITICAL');
    RETURN jsonb_build_object('success', false, 'error', 'У вас немає прав на створення користувачів цього цеху');
  END IF;

  IF v_target_id IS NOT NULL AND NOT v_can_manage_target AND (p_admin_id IS NULL OR p_admin_id <> v_target_id) THEN
    INSERT INTO public.security_audit_events (event_type, table_name, payload, severity)
    VALUES ('UNAUTHORIZED_USER_UPDATE_ATTEMPT', 'system_users', 
            jsonb_build_object('caller_id', p_admin_id, 'target_id', v_target_id), 'CRITICAL');
    RETURN jsonb_build_object('success', false, 'error', 'У вас немає прав на зміну даних цього користувача');
  END IF;

  -- Хешування пароля при потребі
  IF v_raw_password IS NOT NULL AND v_raw_password <> '••••••••' THEN
    IF v_raw_password LIKE '$2a$%' OR v_raw_password LIKE '$2b$%' THEN
      v_hashed_password := v_raw_password;
    ELSE
      v_hashed_password := crypt(v_raw_password, gen_salt('bf', 8));
    END IF;
  END IF;

  -- Безпечна фільтрація прав доступу для не-адмінів (заборона видачі settings/admin/director)
  IF p_user_payload ? 'access_rights' THEN
    IF v_is_admin THEN
      v_safe_rights := p_user_payload->'access_rights';
    ELSE
      v_safe_rights := (p_user_payload->'access_rights') - 'settings' - 'admin' - 'director';
    END IF;
  END IF;

  -- ── СЦЕНАРІЙ 1: ОНОВЛЕННЯ ІСНУЮЧОГО КОРИСТУВАЧА ──
  IF v_target_id IS NOT NULL THEN
    IF v_incoming_login <> '' THEN
      SELECT id INTO v_existing_id
      FROM public.system_users
      WHERE LOWER(login) = v_incoming_login AND id <> v_target_id
      LIMIT 1;

      IF FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Користувач з таким логіном вже зареєстрований');
      END IF;
    END IF;

    UPDATE public.system_users
    SET
      first_name = COALESCE(p_user_payload->>'first_name', first_name),
      last_name = COALESCE(p_user_payload->>'last_name', last_name),
      position = CASE WHEN v_can_manage_target THEN COALESCE(p_user_payload->>'position', position) ELSE position END,
      department = CASE WHEN v_can_manage_target THEN COALESCE(p_user_payload->>'department', department) ELSE department END,
      shift = CASE WHEN v_can_manage_target THEN COALESCE(p_user_payload->>'shift', shift) ELSE shift END,
      access_rights = CASE 
        WHEN v_can_manage_target AND (p_user_payload ? 'access_rights') THEN v_safe_rights
        ELSE access_rights 
      END,
      notification_settings = CASE 
        WHEN p_user_payload ? 'notification_settings' THEN (p_user_payload->'notification_settings')
        ELSE notification_settings 
      END,
      shift_calendar = CASE 
        WHEN p_user_payload ? 'shift_calendar' THEN (p_user_payload->'shift_calendar')
        ELSE shift_calendar 
      END,
      avatar = COALESCE(p_user_payload->>'avatar', avatar),
      password = COALESCE(v_hashed_password, password)
    WHERE id = v_target_id
    RETURNING jsonb_build_object(
      'id', id,
      'login', login,
      'first_name', first_name,
      'last_name', last_name,
      'position', position,
      'access_rights', access_rights,
      'department', department,
      'shift', shift,
      'notification_settings', notification_settings,
      'avatar', avatar,
      'last_seen', last_seen,
      'shift_calendar', shift_calendar
    ) INTO v_result;

    IF v_result IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Користувача не знайдено');
    END IF;

    INSERT INTO public.security_audit_events (event_type, table_name, payload, severity)
    VALUES ('USER_UPDATED', 'system_users', 
            jsonb_build_object('target_id', v_target_id, 'updated_by', p_admin_id, 'password_changed', (v_hashed_password IS NOT NULL)), 
            'INFO');

    RETURN jsonb_build_object('success', true, 'data', v_result, 'action', 'updated');

  -- ── СЦЕНАРІЙ 2: СТВОРЕННЯ НОВОГО КОРИСТУВАЧА ──
  ELSE
    IF v_incoming_login = '' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Логін обов''язковий для створення облікового запису');
    END IF;

    SELECT id INTO v_existing_id
    FROM public.system_users
    WHERE LOWER(login) = v_incoming_login
    LIMIT 1;

    IF FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Користувач з таким логіном вже зареєстрований');
    END IF;

    IF v_hashed_password IS NULL THEN
      v_hashed_password := crypt('Centrum2026!' || gen_random_uuid()::text, gen_salt('bf', 8));
    END IF;

    INSERT INTO public.system_users (
      login,
      password,
      first_name,
      last_name,
      position,
      access_rights,
      department,
      shift,
      notification_settings,
      avatar,
      shift_calendar
    ) VALUES (
      v_incoming_login,
      v_hashed_password,
      COALESCE(p_user_payload->>'first_name', ''),
      COALESCE(p_user_payload->>'last_name', ''),
      COALESCE(p_user_payload->>'position', 'Співробітник'),
      COALESCE(v_safe_rights, '{"operator": true}'::jsonb),
      COALESCE(p_user_payload->>'department', 'Виробництво'),
      COALESCE(p_user_payload->>'shift', 'Зміна 1'),
      COALESCE(p_user_payload->'notification_settings', '{}'::jsonb),
      COALESCE(p_user_payload->>'avatar', ''),
      COALESCE(p_user_payload->'shift_calendar', '{}'::jsonb)
    )
    RETURNING jsonb_build_object(
      'id', id,
      'login', login,
      'first_name', first_name,
      'last_name', last_name,
      'position', position,
      'access_rights', access_rights,
      'department', department,
      'shift', shift,
      'notification_settings', notification_settings,
      'avatar', avatar,
      'last_seen', last_seen,
      'shift_calendar', shift_calendar
    ) INTO v_result;

    INSERT INTO public.security_audit_events (event_type, table_name, payload, severity)
    VALUES ('USER_CREATED', 'system_users', 
            jsonb_build_object('created_id', v_result->>'id', 'login', v_incoming_login, 'created_by', p_admin_id), 
            'INFO');

    RETURN jsonb_build_object('success', true, 'data', v_result, 'action', 'created');
  END IF;
END;
$$;

