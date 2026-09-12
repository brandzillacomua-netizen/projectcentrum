import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const prodUrl = 'https://hurzutjytlcvtbvihnry.supabase.co';
const prodAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';
const prod = createClient(prodUrl, prodAnonKey);

function escapeSql(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return isNaN(val) ? 'NULL' : String(val);
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'::jsonb`;
  return `'${String(val).replace(/'/g, "''")}'`;
}

async function main() {
  await prod.auth.signInWithPassword({
    email: 'alexinj@centrum.local',
    password: 'REVOKED_AUDIT_PASSWORD_DO_NOT_USE'
  });

  const { data: compStruct } = await prod.from('company_structure').select('*');
  const { data: compPos } = await prod.from('company_positions').select('*');
  const { data: bomItems } = await prod.from('bom_items').select('*');
  const { data: taskProjects } = await prod.from('task_projects').select('*');
  const { data: mgmtTasks } = await prod.from('management_tasks').select('*');
  const { data: packBoxes } = await prod.from('packaging_boxes').select('*');

  let sql = `-- ═══════════════════════════════════════════════════════════════════════════
-- 🏢 CENTRUM MES: 1-to-1 Reference Data Seed (testbdkulytcya)
-- company_structure, company_positions, bom_items, task_projects, management_tasks, packaging_boxes
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. СТВОРЕННЯ ТАБЛИЦЬ ТА КОЛОНОК

-- 1.1 company_structure
CREATE TABLE IF NOT EXISTS public.company_structure (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text,
  created_at timestamptz DEFAULT now()
);

-- 1.2 company_positions
CREATE TABLE IF NOT EXISTS public.company_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  department_id uuid,
  start_page text,
  created_at timestamptz DEFAULT now()
);

-- 1.3 bom_items (recreate/ensure all columns)
CREATE TABLE IF NOT EXISTS public.bom_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid,
  child_id uuid,
  quantity_per_parent numeric DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  group_label text
);
ALTER TABLE public.bom_items ADD COLUMN IF NOT EXISTS quantity_per_parent numeric DEFAULT 1;
ALTER TABLE public.bom_items ADD COLUMN IF NOT EXISTS group_label text;

-- 1.4 task_projects
CREATE TABLE IF NOT EXISTS public.task_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  color text,
  status text DEFAULT 'active',
  member_logins jsonb DEFAULT '[]'::jsonb,
  department_ids jsonb DEFAULT '[]'::jsonb,
  created_by text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  columns jsonb DEFAULT '[]'::jsonb
);

-- 1.5 management_tasks
CREATE TABLE IF NOT EXISTS public.management_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  status text DEFAULT 'pending',
  priority text DEFAULT 'medium',
  created_at timestamptz DEFAULT now(),
  deadline timestamptz,
  created_by text,
  assigned_to text,
  is_collective boolean DEFAULT false,
  department text DEFAULT 'all',
  tags jsonb DEFAULT '[]'::jsonb,
  checklist jsonb DEFAULT '[]'::jsonb,
  color text,
  assignees jsonb DEFAULT '[]'::jsonb,
  project_id uuid
);

-- 1.6 packaging_boxes
CREATE TABLE IF NOT EXISTS public.packaging_boxes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid,
  task_id uuid,
  batch_index text,
  box_number text,
  nomenclature_id uuid,
  quantity numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. RLS & ПРАВА ДОСТУПУ
ALTER TABLE public.company_structure ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bom_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.management_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.packaging_boxes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staging_all_access_company_structure" ON public.company_structure;
CREATE POLICY "staging_all_access_company_structure" ON public.company_structure FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "staging_all_access_company_positions" ON public.company_positions;
CREATE POLICY "staging_all_access_company_positions" ON public.company_positions FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "staging_all_access_bom_items" ON public.bom_items;
CREATE POLICY "staging_all_access_bom_items" ON public.bom_items FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "staging_all_access_task_projects" ON public.task_projects;
CREATE POLICY "staging_all_access_task_projects" ON public.task_projects FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "staging_all_access_management_tasks" ON public.management_tasks;
CREATE POLICY "staging_all_access_management_tasks" ON public.management_tasks FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "staging_all_access_packaging_boxes" ON public.packaging_boxes;
CREATE POLICY "staging_all_access_packaging_boxes" ON public.packaging_boxes FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

GRANT ALL ON public.company_structure TO anon, authenticated, service_role;
GRANT ALL ON public.company_positions TO anon, authenticated, service_role;
GRANT ALL ON public.bom_items TO anon, authenticated, service_role;
GRANT ALL ON public.task_projects TO anon, authenticated, service_role;
GRANT ALL ON public.management_tasks TO anon, authenticated, service_role;
GRANT ALL ON public.packaging_boxes TO anon, authenticated, service_role;

-- 3. НАПОВНЕННЯ ДАНИХ (1-В-1 З ПРОДУ)

`;

  // company_structure
  if (compStruct && compStruct.length > 0) {
    const rows = compStruct.map(r => `(${escapeSql(r.id)}, ${escapeSql(r.name)}, ${escapeSql(r.type)}, ${escapeSql(r.created_at)})`);
    sql += `-- 3.1 company_structure (${compStruct.length} rows)
INSERT INTO public.company_structure (id, name, type, created_at)
VALUES
${rows.join(',\n')}
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  type = EXCLUDED.type;\n\n`;
  }

  // company_positions
  if (compPos && compPos.length > 0) {
    const rows = compPos.map(r => `(${escapeSql(r.id)}, ${escapeSql(r.name)}, ${escapeSql(r.department_id)}, ${escapeSql(r.start_page)}, ${escapeSql(r.created_at)})`);
    sql += `-- 3.2 company_positions (${compPos.length} rows)
INSERT INTO public.company_positions (id, name, department_id, start_page, created_at)
VALUES
${rows.join(',\n')}
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  department_id = EXCLUDED.department_id,
  start_page = EXCLUDED.start_page;\n\n`;
  }

  // bom_items
  if (bomItems && bomItems.length > 0) {
    const rows = bomItems.map(r => `(${escapeSql(r.id)}, ${escapeSql(r.parent_id)}, ${escapeSql(r.child_id)}, ${escapeSql(r.quantity_per_parent)}, ${escapeSql(r.created_at)}, ${escapeSql(r.group_label)})`);
    sql += `-- 3.3 bom_items (${bomItems.length} rows)
INSERT INTO public.bom_items (id, parent_id, child_id, quantity_per_parent, created_at, group_label)
VALUES
${rows.join(',\n')}
ON CONFLICT (id) DO UPDATE SET
  parent_id = EXCLUDED.parent_id,
  child_id = EXCLUDED.child_id,
  quantity_per_parent = EXCLUDED.quantity_per_parent,
  group_label = EXCLUDED.group_label;\n\n`;
  }

  // task_projects
  if (taskProjects && taskProjects.length > 0) {
    const rows = taskProjects.map(r => `(${escapeSql(r.id)}, ${escapeSql(r.name)}, ${escapeSql(r.description)}, ${escapeSql(r.color)}, ${escapeSql(r.status)}, ${escapeSql(r.member_logins)}, ${escapeSql(r.department_ids)}, ${escapeSql(r.created_by)}, ${escapeSql(r.created_at)}, ${escapeSql(r.updated_at)}, ${escapeSql(r.columns)})`);
    sql += `-- 3.4 task_projects (${taskProjects.length} rows)
INSERT INTO public.task_projects (id, name, description, color, status, member_logins, department_ids, created_by, created_at, updated_at, columns)
VALUES
${rows.join(',\n')}
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  color = EXCLUDED.color,
  status = EXCLUDED.status,
  member_logins = EXCLUDED.member_logins,
  department_ids = EXCLUDED.department_ids,
  updated_at = EXCLUDED.updated_at,
  columns = EXCLUDED.columns;\n\n`;
  }

  // management_tasks
  if (mgmtTasks && mgmtTasks.length > 0) {
    const rows = mgmtTasks.map(r => `(${escapeSql(r.id)}, ${escapeSql(r.title)}, ${escapeSql(r.description)}, ${escapeSql(r.status)}, ${escapeSql(r.priority)}, ${escapeSql(r.created_at)}, ${escapeSql(r.deadline)}, ${escapeSql(r.created_by)}, ${escapeSql(r.assigned_to)}, ${escapeSql(r.is_collective)}, ${escapeSql(r.department)}, ${escapeSql(r.tags)}, ${escapeSql(r.checklist)}, ${escapeSql(r.color)}, ${escapeSql(r.assignees)}, ${escapeSql(r.project_id)})`);
    sql += `-- 3.5 management_tasks (${mgmtTasks.length} rows)
INSERT INTO public.management_tasks (id, title, description, status, priority, created_at, deadline, created_by, assigned_to, is_collective, department, tags, checklist, color, assignees, project_id)
VALUES
${rows.join(',\n')}
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  status = EXCLUDED.status,
  priority = EXCLUDED.priority,
  deadline = EXCLUDED.deadline,
  assigned_to = EXCLUDED.assigned_to,
  is_collective = EXCLUDED.is_collective,
  department = EXCLUDED.department,
  tags = EXCLUDED.tags,
  checklist = EXCLUDED.checklist,
  color = EXCLUDED.color,
  assignees = EXCLUDED.assignees,
  project_id = EXCLUDED.project_id;\n\n`;
  }

  // packaging_boxes
  if (packBoxes && packBoxes.length > 0) {
    const rows = packBoxes.map(r => `(${escapeSql(r.id)}, ${escapeSql(r.order_id)}, ${escapeSql(r.task_id)}, ${escapeSql(r.batch_index)}, ${escapeSql(r.box_number)}, ${escapeSql(r.nomenclature_id)}, ${escapeSql(r.quantity)}, ${escapeSql(r.created_at)}, ${escapeSql(r.updated_at)})`);
    sql += `-- 3.6 packaging_boxes (${packBoxes.length} rows)
INSERT INTO public.packaging_boxes (id, order_id, task_id, batch_index, box_number, nomenclature_id, quantity, created_at, updated_at)
VALUES
${rows.join(',\n')}
ON CONFLICT (id) DO UPDATE SET
  box_number = EXCLUDED.box_number,
  quantity = EXCLUDED.quantity,
  updated_at = EXCLUDED.updated_at;\n\n`;
  }

  const outFile = path.resolve('a:/centrum/supabase/staging_seed_1_to_1.sql');
  fs.writeFileSync(outFile, sql, 'utf8');
  console.log(`✓ Generated ${outFile} (${(sql.length / 1024).toFixed(1)} KB)`);
}

main().catch(console.error);
