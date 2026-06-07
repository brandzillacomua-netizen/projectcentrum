-- ═══════════════════════════════════════════════════════════════════════════
-- 🛡️ PASSWORD HASHING MIGRATION — CRM КУЛИЦЯ MES v2.5
-- Запустити в Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Активація розширення pgcrypto (якщо не активоване)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Створення тригерної функції для авто-хешування паролів
CREATE OR REPLACE FUNCTION hash_system_user_password()
RETURNS TRIGGER AS $$
BEGIN
  -- Хешуємо пароль, якщо він додається або змінюється, і якщо це не готовий хеш bcrypt
  IF NEW.password IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.password <> OLD.password) THEN
    IF NEW.password NOT LIKE '$2a$%' AND NEW.password NOT LIKE '$2b$%' THEN
      NEW.password := crypt(NEW.password, gen_salt('bf', 8));
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Прив'язка тригера до таблиці system_users
DROP TRIGGER IF EXISTS trg_hash_system_user_password ON system_users;
CREATE TRIGGER trg_hash_system_user_password
  BEFORE INSERT OR UPDATE ON system_users
  FOR EACH ROW
  EXECUTE FUNCTION hash_system_user_password();

-- 4. Безпечне перетворення існуючих відкритих паролів на bcrypt-хеші
UPDATE system_users 
SET password = crypt(password, gen_salt('bf', 8)) 
WHERE password IS NOT NULL 
  AND password NOT LIKE '$2a$%' 
  AND password NOT LIKE '$2b$%';

-- 5. Створення RPC-функції для безпечної перевірки пароля при вході
DROP FUNCTION IF EXISTS verify_user_password(TEXT, TEXT);
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
) SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id,
    u.login,
    u.first_name,
    u.last_name,
    u.position,
    u.access_rights,
    u.department,
    u.shift,
    u.notification_settings,
    u.avatar
  FROM system_users u
  WHERE lower(u.login) = lower(login_name)
    AND u.password = crypt(plain_password, u.password);
END;
$$ LANGUAGE plpgsql;
