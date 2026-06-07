-- ═══════════════════════════════════════════════════════════════════════════
-- 🛡️ ACTIVATE ROW LEVEL SECURITY (RLS) — CRM КУЛИЦЯ MES v2.5
-- Запустити в Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Створення функції верифікації секретного ключа додатка
CREATE OR REPLACE FUNCTION verify_app_secret()
RETURNS BOOLEAN AS $$
DECLARE
  headers TEXT;
  secret TEXT;
BEGIN
  -- Отримуємо заголовок транзакції Postgrest
  headers := current_setting('request.headers', true);
  
  -- Якщо запит виконано з SQL Editor у кабінеті Supabase або консолі, headers буде NULL.
  -- Ми дозволяємо це для адміністрування бази даних.
  IF headers IS NULL OR headers = '' THEN
    RETURN TRUE;
  END IF;
  
  -- Спробуємо витягнути x-mes-secret із JSON заголовків
  BEGIN
    secret := headers::json->>'x-mes-secret';
  EXCEPTION WHEN OTHERS THEN
    RETURN FALSE;
  END;
  
  -- Порівнюємо отриманий секрет із ключем додатка
  RETURN (secret = 'CentrumMES2026SecretKey_a9f8');
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
