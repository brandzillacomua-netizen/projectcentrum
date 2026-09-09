-- ═══════════════════════════════════════════════════════════════════════════
-- 🔑 CENTRUM MES: Вмикання точної автентифікації на testbdkulytcya
-- Підтримує bcrypt хешування паролів із продакшну
-- ═══════════════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DROP FUNCTION IF EXISTS public.verify_user_password(text, text);

CREATE OR REPLACE FUNCTION public.verify_user_password(login_name TEXT, plain_password TEXT)
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
  SELECT su.id INTO v_user_id
  FROM public.system_users su
  WHERE LOWER(su.login) = LOWER(login_name)
    AND (su.password = crypt(plain_password, su.password) OR su.password = plain_password);

  IF v_user_id IS NOT NULL THEN
    UPDATE public.system_users
    SET last_seen = NOW()::text
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
