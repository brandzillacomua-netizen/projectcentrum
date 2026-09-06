-- ═══════════════════════════════════════════════════════════════════════════
-- 🛡️ ENTERPRISE HIGH-LOAD MIGRATION: ATOMIC AUTH & USER GOVERNANCE RPCS
-- Міграція: 20260906150000_enterprise_auth_and_user_rpcs.sql
-- База даних: CRM КУЛИЦЯ / MES CENTRUM
-- Призначення:
--   1. Атомарне створення та редагування користувачів з серверним bcrypt-хешуванням (rpc_admin_upsert_user)
--   2. Атомарне безпечне видалення користувачів із захистом від самовидалення (rpc_admin_delete_user)
--   3. Автоматична фіксація активності (last_seen) та аудиту безпеки (security_audit_events)
--   4. Повна зворотна сумісність (Zero Downtime) для цехових терміналів та існуючих сесій
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Переконуємося у наявності розширення pgcrypto
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Переконуємося у наявності таблиці аудиту безпеки
CREATE TABLE IF NOT EXISTS public.security_audit_events (
  id BIGSERIAL PRIMARY KEY,
  event_type TEXT NOT NULL,
  table_name TEXT,
  client_ip TEXT,
  user_agent TEXT,
  payload JSONB,
  severity TEXT DEFAULT 'WARNING',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.security_audit_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow select for verified session on audit" ON public.security_audit_events;
CREATE POLICY "Allow select for verified session on audit" 
  ON public.security_audit_events FOR SELECT TO anon, authenticated 
  USING (verify_mes_session_or_app());

DROP POLICY IF EXISTS "Allow insert for system audit" ON public.security_audit_events;
CREATE POLICY "Allow insert for system audit" 
  ON public.security_audit_events FOR INSERT TO anon, authenticated 
  WITH CHECK (true);

-- 3. АТОМАРНИЙ RPC СТВОРЕННЯ ТА РЕДАГУВАННЯ КОРИСТУВАЧІВ
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
        v_admin_record.access_rights->>'admin' = 'true' OR 
        v_admin_record.access_rights->>'director' = 'true'
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

-- 4. АТОМАРНИЙ RPC БЕЗПЕЧНОГО ВИДАЛЕННЯ КОРИСТУВАЧА
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
        v_admin_record.access_rights->>'admin' = 'true' OR 
        v_admin_record.access_rights->>'director' = 'true'
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

-- 5. ОНОВЛЕННЯ RPC АВТОРИЗАЦІЇ З АВТО-ФІКСАЦІЄЮ ЧАСУ ОСТАННЬОЇ АКТИВНОСТІ
CREATE OR REPLACE FUNCTION verify_user_password(login_name TEXT, plain_password TEXT)
RETURNS TABLE (
  id BIGINT,
  login TEXT,
  first_name TEXT,
  last_name TEXT,
  "position" TEXT,
  access_rights JSONB,
  department TEXT,
  shift TEXT,
  notification_settings JSONB,
  avatar TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id BIGINT;
BEGIN
  -- Знаходимо користувача та перевіряємо хеш
  SELECT su.id INTO v_user_id
  FROM public.system_users su
  WHERE LOWER(su.login) = LOWER(login_name)
    AND su.password = crypt(plain_password, su.password);

  IF v_user_id IS NOT NULL THEN
    -- Фіксація факту входу та оновлення часу активності (повна кваліфікація public.system_users.id усуває неоднозначність)
    UPDATE public.system_users
    SET last_seen = NOW()
    WHERE public.system_users.id = v_user_id;

    RETURN QUERY
    SELECT 
      su.id,
      su.login,
      su.first_name,
      su.last_name,
      su.position,
      su.access_rights,
      su.department,
      su.shift,
      su.notification_settings,
      su.avatar
    FROM public.system_users su
    WHERE su.id = v_user_id;
  END IF;
END;
$$;
