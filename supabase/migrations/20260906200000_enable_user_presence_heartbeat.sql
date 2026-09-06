-- ═══════════════════════════════════════════════════════════════════════════
-- 🟢 FIX: ВІДНОВЛЕННЯ ТРЕКІНГУ ОНЛАЙН-СТАТУСУ (USER PRESENCE HEARTBEAT)
-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 20260906200000_enable_user_presence_heartbeat.sql
-- Purpose:
--   1. Створення атомарного RPC rpc_touch_user_presence(p_user_id) для heartbeat
--   2. Додавання RLS-політики UPDATE на system_users для ролі authenticated
--   3. Надання прав GRANT UPDATE (last_seen) для усунення блокування оновлення статусу
--   4. Безпека: захист інших колонок (права, паролі, посади) від несанкціонованої модифікації
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Атомарна процедура оновлення часу присутності
CREATE OR REPLACE FUNCTION public.rpc_touch_user_presence(p_user_id BIGINT DEFAULT NULL)
RETURNS TIMESTAMP WITH TIME ZONE
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_target_id BIGINT := p_user_id;
  v_auth_uid UUID;
  v_now TIMESTAMP WITH TIME ZONE := NOW();
BEGIN
  -- Якщо ID не передано явно, витягуємо його з автентифікованого JWT
  IF v_target_id IS NULL THEN
    v_auth_uid := auth.uid();
    IF v_auth_uid IS NOT NULL THEN
      SELECT su.id INTO v_target_id
      FROM public.system_users su
      JOIN auth.users au ON (
        (au.raw_user_meta_data->>'system_user_id')::bigint = su.id
        OR LOWER(au.email) = LOWER(su.login)
        OR LOWER(au.email) = LOWER(su.login) || '@centrum.local'
      )
      WHERE au.id = v_auth_uid
      LIMIT 1;
    END IF;
  END IF;

  -- Якщо користувача ідентифіковано — оновлюємо last_seen
  IF v_target_id IS NOT NULL THEN
    UPDATE public.system_users
    SET last_seen = v_now
    WHERE id = v_target_id;
  END IF;

  RETURN v_now;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_touch_user_presence(BIGINT) TO authenticated, anon;

-- 2. Дозволяємо UPDATE через RLS для авторизованих користувачів
DROP POLICY IF EXISTS "Allow authenticated users to update own presence" ON public.system_users;
CREATE POLICY "Allow authenticated users to update own presence"
  ON public.system_users
  FOR UPDATE
  TO authenticated
  USING (verify_mes_session_or_app())
  WITH CHECK (verify_mes_session_or_app());

-- 3. Гранулярні права: authenticated може оновлювати ТІЛЬКИ колонку last_seen
-- (всі інші критичні колонки захищені від прямої зміни і потребують rpc_admin_upsert_user)
GRANT UPDATE (last_seen) ON public.system_users TO authenticated;

-- 4. Оновлюємо статус поточного адміністратора на "щойно в мережі"
UPDATE public.system_users 
SET last_seen = NOW() 
WHERE login = 'admin@workshop.local';
