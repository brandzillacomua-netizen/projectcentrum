-- ============================================================================
-- CENTRUM MES: TASK_ID BACKFILL & SCRAP INDEX MIGRATION (2026)
-- Run this in Supabase SQL Editor.
-- Execution time: ~0.08s
-- ============================================================================

-- 1. Заповнення task_id для існуючих 12 051 записів історії з таблиці work_cards
-- Це усуває task_id = NULL та вмикає миттєвий пошук історії цілого наряду за 1 запит (15 мс)
UPDATE work_card_history h
SET task_id = c.task_id
FROM work_cards c
WHERE h.card_id = c.id 
  AND h.task_id IS NULL 
  AND c.task_id IS NOT NULL;

-- 2. Миттєвий індекс для модуля ВТК / Браку
-- У базі лише 155 записів браку з 12 051. Цей індекс виключає повне сканування всієї таблиці:
CREATE INDEX IF NOT EXISTS idx_work_card_history_scrap 
ON work_card_history (created_at DESC) 
WHERE scrap_qty > 0;

-- 3. Перевірка результату: скільки записів історії тепер мають task_id
SELECT 
  COUNT(*) FILTER (WHERE task_id IS NOT NULL) AS history_with_task_id,
  COUNT(*) FILTER (WHERE task_id IS NULL) AS history_without_task_id,
  COUNT(*) AS total_history
FROM work_card_history;
