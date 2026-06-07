-- ═══════════════════════════════════════════════════════════════════════════
-- 🔒 CLEANUP OLD PUBLIC POLICIES — CRM КУЛИЦЯ MES v2.5
-- Видалення старих "відкритих" політик, що дозволяють доступ без секретного ключа.
-- Запустити в Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════
-- 
-- ЗНАЙДЕНІ ВРАЗЛИВІ ТАБЛИЦІ:
--   • work_card_history  — стара політика "Allow public read and write"
--   • packaging_boxes    — стара політика "allow_all"
--   • management_tasks   — стара політика "Allow all for everyone"
--   • push_subscriptions — стара політика "anon_all"
--   • machine_calls      — стара політика "Allow public read and write"
--   • machine_operations — стара політика "Allow all operations"
--   • reception_docs     — стара політика "Enable all for reception_docs"
--   • machines           — стара політика "Allow all access"
-- ═══════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Allow public read and write" ON work_card_history;
DROP POLICY IF EXISTS "allow_all" ON packaging_boxes;
DROP POLICY IF EXISTS "Allow all for everyone" ON management_tasks;
DROP POLICY IF EXISTS "anon_all" ON push_subscriptions;
DROP POLICY IF EXISTS "Allow public read and write" ON machine_calls;
DROP POLICY IF EXISTS "Allow all operations" ON machine_operations;
DROP POLICY IF EXISTS "Enable all for reception_docs" ON reception_docs;
DROP POLICY IF EXISTS "Allow all access" ON machines;

-- Підтвердження: покажемо залишкові публічні (небезпечні) політики
-- (результат має бути порожнім)
SELECT tablename, policyname, roles, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND 'public' = ANY(roles);
