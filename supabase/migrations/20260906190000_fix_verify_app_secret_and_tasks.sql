-- ═══════════════════════════════════════════════════════════════════════════
-- 🚀 HOTFIX: ВІДНОВЛЕННЯ ДОСТУПУ ДО НАРЯДІВ (TASKS, ORDERS, INVENTORY) ПІД JWT
-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 20260906190000_fix_verify_app_secret_and_tasks.sql
-- Purpose:
--   1. Оновлення verify_app_secret() — перенаправлення на перевірку JWT (auth.uid())
--   2. Відновлення відображення нарядів, замовлень, номенклатур та складу
--   3. Виправлення RLS на push_subscriptions (усунення помилки 403)
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Централізований Session Guard з підтримкою auth.uid() та ролі authenticated
CREATE OR REPLACE FUNCTION public.verify_mes_session_or_app()
RETURNS BOOLEAN AS $$
DECLARE
  headers TEXT;
  jwt_role TEXT;
  auth_uid TEXT;
BEGIN
  -- Внутрішні виклики (SQL Editor, міграції)
  headers := current_setting('request.headers', true);
  IF headers IS NULL OR headers = '' THEN
    RETURN TRUE;
  END IF;

  -- Service role
  BEGIN
    jwt_role := current_setting('request.jwt.claim.role', true);
    IF jwt_role = 'service_role' THEN
      RETURN TRUE;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  -- Авторизований користувач через Supabase Auth JWT
  BEGIN
    auth_uid := auth.uid()::TEXT;
    IF auth_uid IS NOT NULL AND auth_uid <> '' THEN
      RETURN TRUE;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  -- Перевірка клейму authenticated
  BEGIN
    IF current_setting('request.jwt.claim.role', true) = 'authenticated' THEN
      RETURN TRUE;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Перенаправлення verify_app_secret() на оновлений Guard
CREATE OR REPLACE FUNCTION public.verify_app_secret()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN public.verify_mes_session_or_app();
EXCEPTION WHEN OTHERS THEN
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Надання прав на таблицю push_subscriptions
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN 
    SELECT policyname 
    FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'push_subscriptions' 
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.push_subscriptions;', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "Allow push subscriptions management" 
  ON public.push_subscriptions 
  FOR ALL 
  TO authenticated, anon 
  USING (true) 
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO anon, authenticated;
