-- Fix for admin rights check in rpc_admin_upsert_user and rpc_admin_delete_user
-- The UI uses 'settings' instead of 'admin' in access_rights, and checks position for 'адмін'.

CREATE OR REPLACE FUNCTION rpc_admin_upsert_user(
  p_admin_id BIGINT,
  p_user_payload JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin_record RECORD;
  v_is_admin BOOLEAN := false;
  v_target_id BIGINT;
  v_incoming_login TEXT;
  v_raw_password TEXT;
  v_hashed_password TEXT;
  v_result JSONB;
  v_existing_id BIGINT;
BEGIN
  IF p_user_payload IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User payload cannot be empty');
  END IF;

  v_target_id := NULLIF(p_user_payload->>'id', '')::BIGINT;
  v_incoming_login := TRIM(LOWER(COALESCE(p_user_payload->>'login', '')));
  v_raw_password := NULLIF(p_user_payload->>'password', '');

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
    END IF;
  ELSE
    -- Для перехідного періоду: якщо admin_id не передано, але сесія валідна через додаток
    v_is_admin := verify_mes_session_or_app();
  END IF;

  -- Перевірка дозволу на дію:
  -- Тільки адмін/директор може створювати нових користувачів або редагувати чужі профілі
  IF v_target_id IS NULL AND NOT v_is_admin THEN
    INSERT INTO public.security_audit_events (event_type, table_name, payload, severity)
    VALUES ('UNAUTHORIZED_USER_CREATE_ATTEMPT', 'system_users', 
            jsonb_build_object('caller_id', p_admin_id, 'payload', p_user_payload - 'password'), 'CRITICAL');
    RETURN jsonb_build_object('success', false, 'error', 'Лише адміністратор або директор може додавати користувачів');
  END IF;

  IF v_target_id IS NOT NULL AND NOT v_is_admin AND (p_admin_id IS NULL OR p_admin_id <> v_target_id) THEN
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

  -- ── СЦЕНАРІЙ 1: ОНОВЛЕННЯ ІСНУЮЧОГО КОРИСТУВАЧА ──
  IF v_target_id IS NOT NULL THEN
    -- Перевірка унікальності логіну, якщо він змінюється
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
      position = CASE WHEN v_is_admin THEN COALESCE(p_user_payload->>'position', position) ELSE position END,
      department = CASE WHEN v_is_admin THEN COALESCE(p_user_payload->>'department', department) ELSE department END,
      shift = CASE WHEN v_is_admin THEN COALESCE(p_user_payload->>'shift', shift) ELSE shift END,
      access_rights = CASE 
        WHEN v_is_admin AND (p_user_payload ? 'access_rights') THEN (p_user_payload->'access_rights')
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
      -- Якщо пароль не вказано, встановлюємо випадковий тимчасовий хеш
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
      COALESCE(p_user_payload->'access_rights', '{"operator": true}'::jsonb),
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

CREATE OR REPLACE FUNCTION rpc_admin_delete_user(
  p_admin_id BIGINT,
  p_target_user_id BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin_record RECORD;
  v_is_admin BOOLEAN := false;
  v_deleted_login TEXT;
BEGIN
  IF p_target_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Target user ID is required');
  END IF;

  -- Захист від самовидалення
  IF p_admin_id IS NOT NULL AND p_admin_id = p_target_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Адміністратор не може видалити свій власний обліковий запис');
  END IF;

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
    END IF;
  ELSE
    v_is_admin := verify_mes_session_or_app();
  END IF;

  IF NOT v_is_admin THEN
    INSERT INTO public.security_audit_events (event_type, table_name, payload, severity)
    VALUES ('UNAUTHORIZED_USER_DELETE_ATTEMPT', 'system_users', 
            jsonb_build_object('caller_id', p_admin_id, 'target_id', p_target_user_id), 'CRITICAL');
    RETURN jsonb_build_object('success', false, 'error', 'Лише адміністратор або директор може видаляти користувачів');
  END IF;

  DELETE FROM public.system_users
  WHERE id = p_target_user_id
  RETURNING login INTO v_deleted_login;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Користувача не знайдено');
  END IF;

  INSERT INTO public.security_audit_events (event_type, table_name, payload, severity)
  VALUES ('USER_DELETED', 'system_users', 
          jsonb_build_object('deleted_id', p_target_user_id, 'login', v_deleted_login, 'deleted_by', p_admin_id), 
          'CRITICAL');

  RETURN jsonb_build_object('success', true, 'deleted_id', p_target_user_id);
END;
$$;
