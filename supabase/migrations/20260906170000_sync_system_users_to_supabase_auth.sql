-- ═══════════════════════════════════════════════════════════════════════════
-- 🛡️ CENTRUM MES v2.0 — PHASE 0: JWT AUTH SYNCHRONIZATION
-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 20260906170000_sync_system_users_to_supabase_auth.sql
-- Purpose:
--   1. Синхронізує користувачів з `public.system_users` у `auth.users` та `auth.identities`.
--   2. Зберігає 100% оригінальні bcrypt-паролі ($2a$08$) — нікому не потрібно міняти пароль.
--   3. Призначений спочатку для тестування юзера `vvv` (або всіх юзерів одразу).
-- ═══════════════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;

-- 1. ФУНКЦІЯ СИНХРОНІЗАЦІЇ ЮЗЕРА В AUTH.USERS
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
    -- Якщо логін вже містить email (наприклад admin@workshop.local), використовуємо його без дублювання
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

    -- Перевіряємо чи вже існує користувач з таким email або старим ID в auth.users
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
      r.password, -- Використовуємо готовий bcrypt-хеш 1-в-1
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
      '', -- GoTrue вимагає порожній рядок замість NULL для уникнення "Scan error"
      '',
      '',
      '',
      NOW(),
      NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      encrypted_password = EXCLUDED.encrypted_password,
      email = EXCLUDED.email,
      raw_user_meta_data = EXCLUDED.raw_user_meta_data,
      email_confirmed_at = COALESCE(auth.users.email_confirmed_at, NOW()),
      confirmation_token = COALESCE(auth.users.confirmation_token, ''),
      recovery_token = COALESCE(auth.users.recovery_token, ''),
      email_change_token_new = COALESCE(auth.users.email_change_token_new, ''),
      email_change = COALESCE(auth.users.email_change, ''),
      updated_at = NOW();

    -- Додатково захищаємо новіші версії GoTrue від NULL у токенах повторної автентифікації
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

    -- 2. Створення правильної ідентичності GoTrue v2.196 (email обчислюється автоматично як generated column)
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

-- 2. СИНХРОНІЗАЦІЯ ВСІХ КОРИСТУВАЧІВ ПІДПРИЄМСТВА
SELECT * FROM public.sync_system_user_to_auth(NULL);

-- 3. АВТОМАТИЧНИЙ ТРИГЕР ДЛЯ МАЙБУТНІХ ЗМІН ТА НОВИХ КОРИСТУВАЧІВ
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
