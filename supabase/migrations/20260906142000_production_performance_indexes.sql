-- ═══════════════════════════════════════════════════════════════════════════
-- 🚀 ENTERPRISE HIGH-LOAD MIGRATION: PRODUCTION PERFORMANCE INDEXES
-- База даних: CRM КУЛИЦЯ / MES CENTRUM
-- Призначення:
--   1. Миттєва вибірка активних карток цеху при старті системи (< 15 мс)
--   2. Індекси для черг Shop 1, Shop 2 та терміналів майстра
--   3. Швидкісний пошук за історією переміщень work_card_history
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Швидка вибірка активних карток цеху (виключає закриті картки з індексу)
CREATE INDEX IF NOT EXISTS idx_work_cards_active_created 
ON public.work_cards (created_at DESC) 
WHERE status != 'completed';

-- 2. Швидкий пошук активних карток за нарядом (Shop1, Foreman, генерація карт)
CREATE INDEX IF NOT EXISTS idx_work_cards_task_status 
ON public.work_cards (task_id, status) 
WHERE status != 'completed';

-- 3. Миттєвий пошук історії карток (Критично для панелей Foreman2 / Shop1)
CREATE INDEX IF NOT EXISTS idx_work_card_history_card_id_created 
ON public.work_card_history (card_id, created_at DESC);

-- 4. Індекс історії за номером наряду
CREATE INDEX IF NOT EXISTS idx_work_card_history_task_id 
ON public.work_card_history (task_id, created_at DESC)
WHERE task_id IS NOT NULL;

-- 5. Прискорення фільтрації незакритих нарядів (tasks bootloader)
CREATE INDEX IF NOT EXISTS idx_tasks_open 
ON public.tasks (created_at DESC, id DESC) 
WHERE status != 'completed';

-- 6. Пошук нарядів за номером замовлення
CREATE INDEX IF NOT EXISTS idx_tasks_order_id 
ON public.tasks (order_id);

-- 7. Пошук відкритих запитів матеріалів на складі
CREATE INDEX IF NOT EXISTS idx_material_requests_open 
ON public.material_requests (created_at DESC, id DESC) 
WHERE status != 'completed';

-- 8. Пошук запитів матеріалів за нарядом
CREATE INDEX IF NOT EXISTS idx_material_requests_task_id 
ON public.material_requests (task_id);
