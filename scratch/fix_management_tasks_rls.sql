-- ─────────────────────────────────────────────────────────────────────────────
-- Fix RLS policy on management_tasks table so all managers and directors
-- can create, update, complete, and view project tasks without 42501 RLS errors
-- ─────────────────────────────────────────────────────────────────────────────

-- Option A: Disable RLS on management_tasks (recommended for internal MES app)
ALTER TABLE management_tasks DISABLE ROW LEVEL SECURITY;

-- Option B: Or allow all operations for anon/authenticated roles
DROP POLICY IF EXISTS "Enable read/write for all users" ON management_tasks;
CREATE POLICY "Enable read/write for all users" ON management_tasks FOR ALL USING (true) WITH CHECK (true);

-- Restore completed tasks for "Скай Тактік" project (id: d4113ad9-dc8a-4347-90ad-51e9d4633fa4)
INSERT INTO management_tasks (
  title, description, status, project_id, created_by, assigned_to, assignees, department, priority, created_at
) VALUES 
(
  'Розробка техдокументації Скай Тактік', 
  'Підготовка проекту та узгодження специфікацій', 
  'done', 
  'd4113ad9-dc8a-4347-90ad-51e9d4633fa4', 
  'manager88', 
  'manager88', 
  '["manager88"]'::jsonb, 
  'all', 
  'high', 
  NOW()
),
(
  'Тестова виготовлення рами Скай Тактік', 
  'Тестова задача виробу в рамках проекту', 
  'done', 
  'd4113ad9-dc8a-4347-90ad-51e9d4633fa4', 
  'manager88', 
  'manager88', 
  '["manager88"]'::jsonb, 
  'all', 
  'medium', 
  NOW()
);
