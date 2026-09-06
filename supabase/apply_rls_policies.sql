-- ═══════════════════════════════════════════════════════════════════════════
-- 🛡️ ACTIVATE ROW LEVEL SECURITY (RLS) — CRM КУЛИЦЯ MES v2.5
-- Запустити в Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Створення функції верифікації сесії додатка (Hardened Session Guard)
CREATE OR REPLACE FUNCTION verify_app_secret()
RETURNS BOOLEAN AS $$
BEGIN
  -- Делегуємо перевірку до централізованого Enterprise Guard
  -- (дивіться міграцію 20260906_harden_rls_and_eliminate_secret.sql)
  RETURN verify_mes_session_or_app();
EXCEPTION WHEN OTHERS THEN
  -- Фолбек для захисту при відсутності розширеної функції
  RETURN (current_setting('request.headers', true) IS NULL);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Автоматична активація RLS та створення політик на кожну таблицю в схемі public
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT tablename 
    FROM pg_tables 
    WHERE schemaname = 'public'
      AND tablename NOT IN ('system_users', 'security_audit_events')
  LOOP
    -- Активація RLS на таблицю
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', r.tablename);
    
    -- Видалення старої політики (якщо вона є)
    EXECUTE format('DROP POLICY IF EXISTS "Allow operations with verified secret" ON public.%I;', r.tablename);
    
    -- Створення нової політики на всі операції (SELECT, INSERT, UPDATE, DELETE)
    -- для ролей anon та authenticated
    EXECUTE format(
      'CREATE POLICY "Allow operations with verified secret" ON public.%I ' ||
      'FOR ALL TO anon, authenticated ' ||
      'USING (verify_app_secret()) ' ||
      'WITH CHECK (verify_app_secret());', 
      r.tablename
    );
  END LOOP;
END;
$$;
