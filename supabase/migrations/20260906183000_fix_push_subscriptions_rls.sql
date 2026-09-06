-- ═══════════════════════════════════════════════════════════════════════════
-- 🔔 FIX PUSH SUBSCRIPTIONS RLS POLICY — CRM КУЛИЦЯ MES v2.0
-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 20260906183000_fix_push_subscriptions_rls.sql
-- Purpose:
--   Дозволити користувачам (як авторизованим через JWT, так і анонімним пристроям)
--   зберігати та оновлювати власні Web Push підписки (endpoint, keys) у push_subscriptions
--   без блокування політикою RLS (помилка 403 / 42501).
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- 1. Видаляємо всі старі обмежувальні політики на push_subscriptions
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN 
    SELECT policyname 
    FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'push_subscriptions'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.push_subscriptions;', pol.policyname);
  END LOOP;
END $$;

-- 2. Створюємо чисту політику на читання, вставку та оновлення підписок
CREATE POLICY "Allow push subscriptions management"
  ON public.push_subscriptions
  FOR ALL
  TO authenticated, anon
  USING (true)
  WITH CHECK (true);

-- 3. Надаємо необхідні права на таблицю ролям anon та authenticated
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO anon, authenticated;
