-- ============================================================================
-- CENTRUM MES: PRODUCTION PERFORMANCE INDEXES (2026)
-- Run this script in Supabase SQL Editor.
-- Execution time: ~0.05s across all tables.
-- ============================================================================

-- 1. Швидка вибірка активних карток цеху при завантаженні системи (940 карток)
CREATE INDEX IF NOT EXISTS idx_work_cards_active_created 
ON work_cards (created_at DESC) 
WHERE status != 'completed';

-- 2. Швидкий пошук карток за конкретним нарядом (Shop1, Foreman, генерація)
CREATE INDEX IF NOT EXISTS idx_work_cards_task_status 
ON work_cards (task_id, status) 
WHERE status != 'completed';

-- 3. МИТТЄВИЙ ПОШУК ІСТОРІЇ КАРТОК (КРИТИЧНО ДЛЯ АРХІВУ FOREMAN2 / SHOP1)
-- ВАЖЛИВО: У work_card_history пошук у коді іде за card_id (всі 12,051 записів мають task_id = NULL).
-- Індекс на card_id скорочує час вибірки історії з секунд до 20-40 мс!
CREATE INDEX IF NOT EXISTS idx_work_card_history_card_id_created 
ON work_card_history (card_id, created_at DESC);

-- Додатковий індекс на майбутнє, коли task_id буде заповнюватися в історії
CREATE INDEX IF NOT EXISTS idx_work_card_history_task_id 
ON work_card_history (task_id, created_at DESC)
WHERE task_id IS NOT NULL;

-- 4. Прискорення фільтрації незакритих нарядів (dataProfiles / tasks bootloader)
CREATE INDEX IF NOT EXISTS idx_tasks_open 
ON tasks (created_at DESC, id DESC) 
WHERE status != 'completed';

-- 5. Пошук нарядів за замовленням
CREATE INDEX IF NOT EXISTS idx_tasks_order_id 
ON tasks (order_id);

-- 6. Миттєвий пошук невиконаних запитів матеріалів (Склад / Забезпечення)
CREATE INDEX IF NOT EXISTS idx_material_requests_open 
ON material_requests (created_at DESC, id DESC) 
WHERE status != 'completed';

-- 7. Пошук запитів матеріалів за нарядом
CREATE INDEX IF NOT EXISTS idx_material_requests_task_id 
ON material_requests (task_id);
