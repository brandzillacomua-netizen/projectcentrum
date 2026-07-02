-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Add color and assignees to management_tasks
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Колір плашки картки (рядок HEX, напр. '#ef4444', або '' якщо авто)
ALTER TABLE management_tasks
  ADD COLUMN IF NOT EXISTS color text DEFAULT '';

-- 2. Масив виконавців (логіни), підтримка декількох відповідальних
ALTER TABLE management_tasks
  ADD COLUMN IF NOT EXISTS assignees jsonb DEFAULT '[]'::jsonb;

-- 3. Ініціалізуємо assignees з assigned_to для вже існуючих задач
UPDATE management_tasks
SET assignees = jsonb_build_array(assigned_to)
WHERE assigned_to IS NOT NULL
  AND assigned_to != ''
  AND (assignees IS NULL OR assignees = '[]'::jsonb);

-- Перевірка результату:
SELECT id, title, assigned_to, assignees, color
FROM management_tasks
LIMIT 10;
