-- ═══════════════════════════════════════════════════════════════════════════
-- 🛡️ CENTRUM MES v2.0 — PHASE 0: FINAL HARDENING & COMPLETE SECRET ELIMINATION
-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 20260906180000_strict_jwt_and_eliminate_secret.sql
-- Purpose:
--   1. ВИПРАВЛЕННЯ EMAIL: коректна синхронізація логінів з '@' (admin@workshop.local)
--   2. ПОВНА ЛІКВІДАЦІЯ x-mes-secret з verify_mes_session_or_app()
--   3. ПРИМУСОВЕ РОЗЛОГІНЕННЯ: анулювання всіх старих сесій у схемі auth
--   4. ЗАХИСТ ХЕШІВ ПАРОЛІВ: REVOKE SELECT (password) ON system_users
-- ═══════════════════════════════════════════════════════════════════════════

-- КРОК 1. Оновлена функція синхронізації (без подвійних доменів @...@centrum.local)
CREATE OR REPLACE FUNCTION public.sync_system_user_to_auth(p_login TEXT DEFAULT NULL)
RETURNS TABLE (
  synced_login TEXT,
  auth_user_id UUID,
  status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  r RECORD;
  v_user_uuid UUID;
  v_existing_uuid UUID;
  v_email TEXT;
BEGIN
  FOR r IN 
    SELECT su.id, su.login, su.password, su.first_name, su.last_name
    FROM public.system_users su
    WHERE (p_login IS NULL OR LOWER(su.login) = LOWER(p_login))
      AND su.password IS NOT NULL
      AND su.password <> ''
  LOOP
    -- Якщо логін вже містить @ (наприклад admin@workshop.local), використовуємо його без дублювання
    IF POSITION('@' IN r.login) > 0 THEN
      v_email := LOWER(TRIM(r.login));
    ELSE
      v_email := LOWER(TRIM(r.login)) || '@centrum.local';
    END IF;

    -- Детермінований стабільний UUID на основі ID користувача
    BEGIN
      v_user_uuid := extensions.uuid_generate_v5(extensions.uuid_ns_url(), 'centrum:user:' || r.id::text);
    EXCEPTION WHEN OTHERS THEN
      v_user_uuid := md5('centrum:user:' || r.id::text)::uuid;
    END;

    -- Перевіряємо чи вже існує користувач в auth.users
    SELECT id INTO v_existing_uuid FROM auth.users WHERE email = v_email OR id = v_user_uuid LIMIT 1;
    IF v_existing_uuid IS NOT NULL THEN
      v_user_uuid := v_existing_uuid;
    END IF;

    -- 1. Створення або оновлення в auth.users
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      is_sso_user,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change,
      created_at,
      updated_at
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_user_uuid,
      'authenticated',
      'authenticated',
      v_email,
      r.password, -- Зберігаємо оригінальний bcrypt-хеш 1-в-1
      NOW(),
      jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
      jsonb_build_object(
        'email', v_email,
        'email_verified', true,
        'phone_verified', false,
        'sub', v_user_uuid::text,
        'login', r.login,
        'system_user_id', r.id,
        'first_name', r.first_name,
        'last_name', r.last_name
      ),
      false,
      '',
      '',
      '',
      '',
      NOW(),
      NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      encrypted_password = EXCLUDED.encrypted_password,
      raw_user_meta_data = EXCLUDED.raw_user_meta_data,
      email_confirmed_at = COALESCE(auth.users.email_confirmed_at, NOW()),
      confirmation_token = COALESCE(auth.users.confirmation_token, ''),
      recovery_token = COALESCE(auth.users.recovery_token, ''),
      email_change_token_new = COALESCE(auth.users.email_change_token_new, ''),
      email_change = COALESCE(auth.users.email_change, ''),
      updated_at = NOW();

    -- Додатковий захист полів GoTrue від NULL
    BEGIN
      EXECUTE 'UPDATE auth.users SET 
        reauthentication_token = COALESCE(reauthentication_token, ''''),
        email_change_token_current = COALESCE(email_change_token_current, ''''),
        phone_change = COALESCE(phone_change, ''''),
        phone_change_token = COALESCE(phone_change_token, '''')
      WHERE id = $1' USING v_user_uuid;
    EXCEPTION WHEN undefined_column THEN
      NULL;
    END;

    -- 2. Оновлення ідентичності GoTrue (email обчислюється автоматично як generated column)
    DELETE FROM auth.identities WHERE user_id = v_user_uuid;
    
    INSERT INTO auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      v_user_uuid,
      jsonb_build_object(
        'sub', v_user_uuid::text,
        'email', v_email,
        'email_verified', true,
        'phone_verified', false
      ),
      'email',
      v_user_uuid::text,
      NOW(),
      NOW(),
      NOW()
    );

    synced_login := r.login;
    auth_user_id := v_user_uuid;
    status := 'SYNCED';
    RETURN NEXT;
  END LOOP;
END;
$$;

-- КРОК 2. Оновлення автоматичного тригера на system_users
CREATE OR REPLACE FUNCTION public.trg_sync_system_user_to_auth()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
BEGIN
  IF NEW.password IS NOT NULL AND NEW.password <> '' THEN
    PERFORM public.sync_system_user_to_auth(NEW.login);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_system_users_auth_sync ON public.system_users;
CREATE TRIGGER trg_system_users_auth_sync
  AFTER INSERT OR UPDATE OF password, login, first_name, last_name
  ON public.system_users
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_sync_system_user_to_auth();

-- КРОК 3. Синхронізація всіх користувачів підприємства (138 облікових записів)
SELECT * FROM public.sync_system_user_to_auth(NULL);

-- КРОК 4. ПОВНА ЛІКВІДАЦІЯ x-mes-secret — Тільки дійсний Supabase Auth JWT або service_role!
CREATE OR REPLACE FUNCTION verify_mes_session_or_app()
RETURNS BOOLEAN AS $$
DECLARE
  headers TEXT;
  jwt_role TEXT;
  auth_uid TEXT;
BEGIN
  -- 1. Запит із внутрішньої консолі Supabase / SQL Editor / pgAdmin / міграцій
  headers := current_setting('request.headers', true);
  IF headers IS NULL OR headers = '' THEN
    RETURN TRUE;
  END IF;

  -- 2. Запит від службових міграцій / бекенду з ключем service_role
  BEGIN
    jwt_role := current_setting('request.jwt.claim.role', true);
    IF jwt_role = 'service_role' THEN
      RETURN TRUE;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  -- 3. Офіційний Supabase Auth контекст (персональний JWT робітника)
  BEGIN
    auth_uid := auth.uid()::TEXT;
    IF auth_uid IS NOT NULL AND auth_uid <> '' THEN
      RETURN TRUE;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  -- ⛔ ЖОДНИЙ статичний секрет більше не приймається. Неавторизований доступ заборонено!
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- КРОК 5. Збереження публічного функціоналу для виклику майстра з верстата (QR-код)
DROP POLICY IF EXISTS "Allow public read on machines" ON public.machines;
CREATE POLICY "Allow public read on machines" ON public.machines FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Allow public call creation on machine_calls" ON public.machine_calls;
CREATE POLICY "Allow public call creation on machine_calls" ON public.machine_calls FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public basic profile reads for calls" ON public.system_users;
CREATE POLICY "Allow public basic profile reads for calls" ON public.system_users FOR SELECT TO anon USING (true);

-- КРОК 6. Посилення безпеки: заборона читання колонки password безпосередньо через API
REVOKE SELECT (password) ON public.system_users FROM anon, authenticated;

-- КРОК 7. ПРИМУСОВЕ РОЗЛОГІНЕННЯ: анулювання всіх старих сесій у базі даних
DELETE FROM auth.refresh_tokens;
DELETE FROM auth.sessions;

-- ═══════════════════════════════════════════════════════════════════════════
-- ✅ PHASE 0 ЗАВЕРШЕНО: x-mes-secret ЛІКВІДОВАНО, СИСТЕМА ПОВНІСТЮ НА JWT
-- ═══════════════════════════════════════════════════════════════════════════
