-- ═══════════════════════════════════════════════════════════════════════════
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

-- 3.1 company_structure (17 rows)
INSERT INTO public.company_structure (id, name, type, created_at)
VALUES
('3d4c3abc-97b7-4d8a-9e0b-35e891368b41', 'Цех №1', 'shop', '2026-05-21T22:19:42.690948+00:00'),
('4e96043d-693e-479f-9476-c7d291efdeb4', 'Цех №2', 'shop', '2026-05-21T22:19:42.690948+00:00'),
('a7726d3e-213c-441c-8876-9aaa83d2de9a', 'Склад', 'warehouse', '2026-05-21T22:19:42.690948+00:00'),
('17568833-7866-478e-9f1d-2cfb512c5d8f', 'Галтовка', 'tumbling', '2026-05-21T22:19:42.690948+00:00'),
('5b9028f0-2960-4159-b678-e87306cbb308', 'Контроль браку', 'quality', '2026-05-21T22:19:42.690948+00:00'),
('f8c8f51c-6bfa-4574-8f28-881d39035c22', 'Керівництво', 'management', '2026-05-21T22:19:42.690948+00:00'),
('7224892e-ebc5-4671-a46c-65a4d6fe0167', 'Склад Виробництва', 'warehouse', '2026-05-21T22:26:33.238382+00:00'),
('36d69c98-5669-4bb1-855a-ceefd54c2798', 'Доопрацювання', 'other', '2026-05-21T22:58:30.829729+00:00'),
('e7063948-adb2-482e-b981-249cc182ab59', 'Прийомка', 'tumbling', '2026-05-22T12:39:33.985161+00:00'),
('4f0b85de-297c-413b-986e-a1df0c277764', 'Сортування', 'tumbling', '2026-05-22T12:45:41.568295+00:00'),
('e5d419bd-5704-49f6-aa74-09e03ef1d869', 'Відділ Підготовки', 'tumbling', '2026-05-24T08:21:23.755624+00:00'),
('b675ffc6-c117-4b85-93e1-3aa523560531', 'Відділ Доопрацювання', 'tumbling', '2026-05-24T15:14:40.698977+00:00'),
('6c5d9bf2-36c7-40e3-9da2-fd10c959687c', 'Відділ Пакування', 'tumbling', '2026-06-04T13:43:36.752972+00:00'),
('6a1cd2b1-81ad-43e1-8ed4-8ac8b570f469', 'Відділ Відвантаження', 'tumbling', '2026-06-04T14:17:29.706635+00:00'),
('87e76603-a0f6-4977-af60-d4d37d4d78e7', 'Технічний відділ', 'tumbling', '2026-06-30T13:06:11.621552+00:00'),
('3ddab979-c88a-4cd3-b0e4-f4f28e6c21c5', 'Відділ Постачання', 'tumbling', '2026-07-03T18:00:35.393071+00:00'),
('bd18eacd-966a-45f5-9aa9-4a5bdd605c53', 'Відділ Продажу', 'other', '2026-08-18T10:31:27.442317+00:00')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  type = EXCLUDED.type;

-- 3.2 company_positions (28 rows)
INSERT INTO public.company_positions (id, name, department_id, start_page, created_at)
VALUES
('046a63be-c084-4d2b-b988-b7ed6256ecf4', 'Адмін', NULL, NULL, '2026-05-21T22:28:58.195856+00:00'),
('8a747feb-0dd9-4ba8-8f3b-9d7283a069bb', 'Чистильники', '4e96043d-693e-479f-9476-c7d291efdeb4', NULL, '2026-05-21T22:59:21.287968+00:00'),
('5553e0a9-e952-4ca6-a605-421b94f8c075', 'Маляр', '4e96043d-693e-479f-9476-c7d291efdeb4', NULL, '2026-05-21T22:28:58.195856+00:00'),
('c1fd9965-5582-4f66-9f5a-01d83ee2856a', 'Пресувальник', '4e96043d-693e-479f-9476-c7d291efdeb4', NULL, '2026-05-21T22:28:58.195856+00:00'),
('721a0213-aa16-4129-a616-93d153f749b6', 'Галтовщик', '3d4c3abc-97b7-4d8a-9e0b-35e891368b41', NULL, '2026-05-21T22:28:58.195856+00:00'),
('d3668b28-dc35-45ea-9896-b3d8d3e101f5', 'Відділ контролю якості (ВКЯ)', '5b9028f0-2960-4159-b678-e87306cbb308', '/brak', '2026-05-21T22:28:58.195856+00:00'),
('337202a8-9898-49f0-bb92-1688be26931e', 'Інженер', NULL, '/engineer', '2026-05-21T22:28:58.195856+00:00'),
('aa39b2b3-db8d-435e-8faa-86418e193ffd', 'Директор виробництва', NULL, '/dashboard', '2026-05-21T22:28:58.195856+00:00'),
('7867a6ec-8ad1-4d86-a0c4-ff78b7558a5f', 'Начальник цеху №1', '3d4c3abc-97b7-4d8a-9e0b-35e891368b41', '/master', '2026-05-21T22:28:58.195856+00:00'),
('c5e4e785-4aa5-4606-a055-28655409da2d', 'Начальник цеху №2', '4e96043d-693e-479f-9476-c7d291efdeb4', '/shop2', '2026-05-22T10:55:17.406483+00:00'),
('d8079162-1d47-450e-8a4f-c6ed1cd891c5', 'Майстер зміни Цех №1', '3d4c3abc-97b7-4d8a-9e0b-35e891368b41', '/shop1', '2026-05-21T22:28:58.195856+00:00'),
('1de7979f-d262-4b0c-bb66-9122d27b389e', 'Майстер зміни Цех №2', '4e96043d-693e-479f-9476-c7d291efdeb4', '/shop2-terminal', '2026-05-22T10:56:00.891348+00:00'),
('a351d0cb-aa5b-4d99-82c4-8b62d3978b80', 'Оператор', '3d4c3abc-97b7-4d8a-9e0b-35e891368b41', '/shop1', '2026-05-21T22:28:58.195856+00:00'),
('0ce736a1-a1d2-44d0-8f5d-96a4a7aa512e', 'Працівник складу', 'a7726d3e-213c-441c-8876-9aaa83d2de9a', '/warehouse', '2026-05-21T22:28:58.195856+00:00'),
('3e4d5ae5-a4ea-4d67-b9a0-aee4f6b24342', 'Приймальник', 'e7063948-adb2-482e-b981-249cc182ab59', NULL, '2026-05-22T12:39:45.76397+00:00'),
('5f72cf19-13e5-4124-922a-1626fc634354', 'Сортувальник', '4f0b85de-297c-413b-986e-a1df0c277764', NULL, '2026-05-22T12:52:11.643612+00:00'),
('a3b85206-913d-4164-8535-7777b6331c7e', 'Підготовщик', 'e5d419bd-5704-49f6-aa74-09e03ef1d869', NULL, '2026-05-24T08:21:36.689173+00:00'),
('b8f62769-4175-4078-99a9-5d98f0dee309', 'Доопрацювальник', 'b675ffc6-c117-4b85-93e1-3aa523560531', NULL, '2026-05-24T15:15:00.747771+00:00'),
('980b855e-1dc8-4325-8f10-9ac8f60e1363', 'Пакувальник', '6c5d9bf2-36c7-40e3-9da2-fd10c959687c', NULL, '2026-06-04T13:44:35.964897+00:00'),
('a4c49f8f-9af0-4c1b-b397-039d54e8bda6', 'Відвантажувальник', '6a1cd2b1-81ad-43e1-8ed4-8ac8b570f469', NULL, '2026-06-04T14:17:48.151343+00:00'),
('61b66076-b87a-4e5c-a69c-bb2d96f4046a', 'Комірник', 'a7726d3e-213c-441c-8876-9aaa83d2de9a', NULL, '2026-06-05T06:55:08.108829+00:00'),
('01efc297-45ef-47d5-9c70-840ecb1fba4a', 'викон роб', '87e76603-a0f6-4977-af60-d4d37d4d78e7', NULL, '2026-06-30T13:06:24.123547+00:00'),
('fcacb60e-9912-4832-8b31-530a2fbab1bb', 'заступник начальника цеху №1 по тех. питаннях', '87e76603-a0f6-4977-af60-d4d37d4d78e7', NULL, '2026-06-30T13:06:37.897748+00:00'),
('451d076c-a23f-4d84-a9c2-9fe29594fa15', 'інженер з експлуатації обладнання', '87e76603-a0f6-4977-af60-d4d37d4d78e7', NULL, '2026-06-30T13:06:45.800087+00:00'),
('043e876c-9d55-4f83-a0bd-17ff0ad9b623', 'електромонтажні роботи', '87e76603-a0f6-4977-af60-d4d37d4d78e7', NULL, '2026-06-30T13:06:54.140314+00:00'),
('90e547c5-0ff4-4eab-94dd-0640df4af8cc', 'тех. працівник', '87e76603-a0f6-4977-af60-d4d37d4d78e7', NULL, '2026-06-30T13:07:01.649813+00:00'),
('0d459ee6-3a70-4e53-9a6b-f3e515f5f7a9', 'Постачання', '3ddab979-c88a-4cd3-b0e4-f4f28e6c21c5', NULL, '2026-07-03T18:01:07.835039+00:00'),
('201c4fd3-639c-4391-adba-75ec2fcc8deb', 'Менеджер', 'bd18eacd-966a-45f5-9aa9-4a5bdd605c53', '/manager', '2026-05-21T22:28:58.195856+00:00')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  department_id = EXCLUDED.department_id,
  start_page = EXCLUDED.start_page;

-- 3.3 bom_items (20 rows)
INSERT INTO public.bom_items (id, parent_id, child_id, quantity_per_parent, created_at, group_label)
VALUES
('8b9b88f0-b50c-4eab-8a44-bde558afa08c', '1e6dc22b-4991-47db-956c-ee635aa33582', 'a054c340-cedf-4348-b425-489ca35ec9c2', 1, '2026-09-08T13:18:28.448668+00:00', 'Метизи'),
('8c20ed12-7950-45f0-adf1-c177c032afbf', 'e3deffb1-8758-48e2-8ae8-5a1c6c28a813', 'c44b5257-fb99-4306-ab99-cc89447513b6', 1, '2026-09-08T13:45:23.824127+00:00', 'Деталі'),
('f24a79d2-4201-44bc-85c3-19ea3b8874ad', 'e3deffb1-8758-48e2-8ae8-5a1c6c28a813', 'bc25f823-9aae-4862-a37a-ce1da506599c', 1, '2026-09-08T13:45:23.824127+00:00', 'Деталі'),
('a730e688-22b3-4ddf-876c-8918dc525443', 'e3deffb1-8758-48e2-8ae8-5a1c6c28a813', 'b140f3ac-ab51-4d49-a21d-eb0a5a0be775', 1, '2026-09-08T13:45:23.824127+00:00', 'Деталі'),
('f793ab56-f6fc-4294-b546-0ca10ff0d003', 'e3deffb1-8758-48e2-8ae8-5a1c6c28a813', 'd51fbc6d-e2c4-43ab-8085-ac489d210baa', 1, '2026-09-08T13:45:23.824127+00:00', 'Деталі'),
('2be3758a-65b3-4ae6-b6ce-97391c02d389', 'e3deffb1-8758-48e2-8ae8-5a1c6c28a813', '9cce7c47-f9a9-4f41-a27c-733bc023f729', 1, '2026-09-08T13:45:23.824127+00:00', 'Деталі'),
('6991f136-ce31-46a1-b7d9-86ee44196c81', 'e3deffb1-8758-48e2-8ae8-5a1c6c28a813', '52ff6faa-5f18-496c-9076-7af916897df9', 4, '2026-09-08T13:45:23.824127+00:00', 'Деталі'),
('dbdb79e9-e4ab-4cba-a7ae-07c4d3326824', '26a77a50-d932-4a02-a65d-b4cd608ec6ac', '16baa960-da47-4f07-bae3-2099b92abfc0', 1, '2026-09-08T16:42:49.673746+00:00', 'Деталі'),
('1b897b6c-c219-4a57-a5d0-f7829ea51517', '26a77a50-d932-4a02-a65d-b4cd608ec6ac', '20886010-951a-41ca-af31-67ba987d0b3e', 1, '2026-09-08T16:42:49.673746+00:00', 'Деталі'),
('5a4b2823-6524-423c-be27-7195d06a0fb4', '26a77a50-d932-4a02-a65d-b4cd608ec6ac', '91059aca-e0f9-4bfc-a311-c65f3b190061', 1, '2026-09-08T16:42:49.673746+00:00', 'Деталі'),
('1380dbb8-1231-4685-9069-dd61389bbf96', '26a77a50-d932-4a02-a65d-b4cd608ec6ac', '6e7bc61e-f678-4ba3-8256-a44cbb2d54d0', 4, '2026-09-08T16:42:49.673746+00:00', 'Деталі'),
('6ca2ddbc-8ca8-4819-89f8-5214ed34a0de', '11371d1a-9db4-4de1-93ea-d44ccb604543', '058eb2cd-9981-414b-b72c-aed78bd111a3', 1, '2026-09-04T15:50:49.481507+00:00', 'Метизи'),
('6ff9618f-7bda-4381-83e0-5f19b60f309a', '11371d1a-9db4-4de1-93ea-d44ccb604543', '8b3545cc-7119-451f-93de-83feb7c29170', 1, '2026-09-04T15:50:49.481507+00:00', 'Деталі'),
('91d6d357-2ffb-41ef-9b44-20609edbf645', '50e63438-9c91-475a-af63-15ac30ff609a', '826e46f8-c72e-4ffd-b157-84d821090422', 1, '2026-09-04T16:18:57.496623+00:00', 'Деталі'),
('dee3fe33-9513-4cd6-9d92-7e6b1ccfd045', '50e63438-9c91-475a-af63-15ac30ff609a', 'fe89d4ca-f238-422b-a2a4-2c650aba9d9c', 1, '2026-09-04T16:18:57.496623+00:00', 'Деталі'),
('bdbff0a1-93be-42ed-931a-ef17d1291f82', '50e63438-9c91-475a-af63-15ac30ff609a', 'c7f2c611-72ee-4a93-9082-cb87d6181741', 1, '2026-09-04T16:18:57.496623+00:00', 'Деталі'),
('005d5753-2021-4db3-ad9a-82b6464a8c38', '50e63438-9c91-475a-af63-15ac30ff609a', '1ffc69d2-8d6c-4a03-afc8-9715b5612936', 2, '2026-09-04T16:18:57.496623+00:00', 'Деталі'),
('754dd0aa-8105-46a8-a1aa-5f90bf83fbbc', '50e63438-9c91-475a-af63-15ac30ff609a', 'feb6f708-7fe4-42d4-b640-0a70c6e4b148', 2, '2026-09-04T16:18:57.496623+00:00', 'Деталі'),
('fe69acd5-3383-470e-a329-a29e20338119', '50e63438-9c91-475a-af63-15ac30ff609a', 'be0bf3ed-063d-4e31-b7e0-cb882cff9cdf', 2, '2026-09-04T16:18:57.496623+00:00', 'Деталі'),
('a43d6307-d0e3-44ff-941d-6b392750871a', '50e63438-9c91-475a-af63-15ac30ff609a', 'ff32aa58-8c7f-438b-ae1c-dead9c9b19ec', 2, '2026-09-04T16:18:57.496623+00:00', 'Деталі')
ON CONFLICT (id) DO UPDATE SET
  parent_id = EXCLUDED.parent_id,
  child_id = EXCLUDED.child_id,
  quantity_per_parent = EXCLUDED.quantity_per_parent,
  group_label = EXCLUDED.group_label;

-- 3.4 task_projects (5 rows)
INSERT INTO public.task_projects (id, name, description, color, status, member_logins, department_ids, created_by, created_at, updated_at, columns)
VALUES
('69976a14-ea5c-4fd4-bee8-41b43cc9c64a', 'Демонтажні роботи підвальне приміщення', '', '#8b5cf6', 'active', '["kompaniets.o","drabchuk.r"]'::jsonb, '["87e76603-a0f6-4977-af60-d4d37d4d78e7"]'::jsonb, 'director', '2026-07-07T11:37:18.77815+00:00', '2026-07-07T11:37:18.77815+00:00', '[]'::jsonb),
('72d37343-4b8e-46bd-9ae0-c3492181cfea', 'Влаштування підвального приміщення', 'Фіолетовий колір - Драбчук Р.
Синій колір - Гайбонюк В.
Зелений - Зіньків А. 
Оранджевий - Микусь Р.', '#8b5cf6', 'active', '["drabchuk.r","haiboniuk.v","zinkiv.a","kompaniets.o","mykus.r"]'::jsonb, '[]'::jsonb, 'director', '2026-08-25T14:56:22.741745+00:00', '2026-08-25T14:56:22.741745+00:00', '[]'::jsonb),
('04dab2d3-8dba-4c2c-8f18-3be3979750f1', 'Влаштування підвального приміщення', 'В даному проєкті передбачено всі роботи, що стосуються влаштування підвального приміщення. 
Інженерія (електропостачання, система стисненого повітря, водопостачання та інше)', '#8b5cf6', 'active', '["drabchuk.r","haiboniuk.v","solonenko.d","zinkiv.a","mykus.r"]'::jsonb, '[]'::jsonb, 'director', '2026-08-22T11:15:39.039823+00:00', '2026-08-22T11:15:39.039823+00:00', '[{"id":"todo","color":"#8b5cf6","title":"В ЧЕРЗІ"},{"id":"in_progress","color":"#3b82f6","title":"В РОБОТІ"},{"id":"review","color":"#f59e0b","title":"ПЕРЕВІРКА"},{"id":"done","color":"#10b981","title":"ВИКОНАНО"}]'::jsonb),
('d4113ad9-dc8a-4347-90ad-51e9d4633fa4', 'Скай Тактік', '', '#8b5cf6', 'active', '[]'::jsonb, '["bd18eacd-966a-45f5-9aa9-4a5bdd605c53"]'::jsonb, 'manager88', '2026-08-25T10:38:02.3605+00:00', '2026-08-25T10:38:02.3605+00:00', '[{"id":"todo","color":"#8b5cf6","title":"В ЧЕРЗІ"},{"id":"in_progress","color":"#3b82f6","title":"В РОБОТІ"},{"id":"review","color":"#f59e0b","title":"ПЕРЕВІРКА"},{"id":"done","color":"#10b981","title":"ВИКОНАНО"}]'::jsonb),
('67adc76b-310a-4350-a12f-32b4f15130d3', 'RND розробки', 'Тут будемо узгоджувати всі розробки', '#8b5cf6', 'active', '[]'::jsonb, '["bd18eacd-966a-45f5-9aa9-4a5bdd605c53"]'::jsonb, 'manager88', '2026-08-26T13:06:02.009168+00:00', '2026-08-26T13:06:02.009168+00:00', '[{"id":"todo","color":"#8b5cf6","title":"Новий запит"},{"id":"in_progress","color":"#3b82f6","title":"Кафедра"},{"id":"review","color":"#f59e0b","title":"Фінвідділ"},{"id":"col_mta3vlf8","color":"#ef4444","title":"Торговий відділ"},{"id":"done","color":"#10b981","title":"ВИКОНАНО"}]'::jsonb)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  color = EXCLUDED.color,
  status = EXCLUDED.status,
  member_logins = EXCLUDED.member_logins,
  department_ids = EXCLUDED.department_ids,
  updated_at = EXCLUDED.updated_at,
  columns = EXCLUDED.columns;

-- 3.5 management_tasks (36 rows)
INSERT INTO public.management_tasks (id, title, description, status, priority, created_at, deadline, created_by, assigned_to, is_collective, department, tags, checklist, color, assignees, project_id)
VALUES
('d4b210c0-f183-4019-9ea6-b014c35da4ec', 'Очищення вент. каналів.', 'Очищення вент каналів для вентиляції бмб для подальшого монтажу.', 'done', 'high', '2026-06-30T14:08:51.523+00:00', '2026-07-03T00:00:00+00:00', 'director', 'drabchuk.r', FALSE, 'all', '[]'::jsonb, '[{"id":"gnttcpq93nhmr0q2duv","done":true,"text":"Список людей, які виконують робоут"},{"id":"gm2bz80vzj7mr0q2kmu","done":true,"text":"План робіт"},{"id":"fe0sprgw7nbmr0q2ppr","done":true,"text":"Вивезення сміття"}]'::jsonb, '', '["drabchuk.r"]'::jsonb, NULL),
('09b97ac0-4638-4d4c-b9e1-9188e1c67fd9', 'Монтаж металевого кронштейну для подальшого монтажу ліфта', 'Зварити і закріпити стальну конструкцію для подальшого кріплення ліфта
[4 лип., 16:30] Пілецький: Васька, Ти молодець)', 'review', 'medium', '2026-07-02T10:28:03.611+00:00', '2026-07-09T09:00:00+00:00', 'haiboniuk.v', 'haiboniuk.v', FALSE, 'all', '[]'::jsonb, '[{"id":"ke6qqtft5wmr3d05q6","done":true,"text":"Підготовка основи для кріплення стійки в підлозі"},{"id":"w1b4f41ipumr3d2a5c","done":true,"text":"Підготовка профільних труб до монтажу"},{"id":"o6lc9r3ezsfmr4lga37.i","done":true,"text":"Монтаж профільних труб 150*150"},{"id":"w483ns69h5mr4lic4j.i","done":true,"text":"Підготовка закладних для монтажу профільної труби 150*150 мм","parent_id":"ke6qqtft5wmr3d05q6"}]'::jsonb, '', '["haiboniuk.v"]'::jsonb, NULL),
('81bcde94-5faf-478f-9e09-bb7182ea34da', 'Монтаж лінії живлення та розетки для піскоструминної установки', 'Виконати прокладання лінії живлення, монтаж і підключення розетки для піскоструминної установки. Після завершення робіт перевірити правильність підключення та працездатність лінії й розетки.', 'done', 'urgent', '2026-07-07T12:29:31.8+00:00', '2026-07-07T09:00:00+00:00', 'zinkiv.a', 'zinkiv.a', FALSE, 'all', '[]'::jsonb, '[{"id":"ulv213dizomramlkdv.i","done":true,"text":"Прокладено лінію живлення."},{"id":"d1i3fkscormramlo03.i","done":true,"text":"Встановлено та підключено розетку."},{"id":"mxd5vvj6ne7mramls53.i","done":true,"text":"Перевірено працездатність."},{"id":"vok3idrgpdmramlvnz.i","done":true,"text":"Роботи завершено."}]'::jsonb, '', '["zinkiv.a","borovets.v"]'::jsonb, NULL),
('401393f5-4c9a-45d6-998c-9c21f69a753b', 'Підключення перетворювача тиску та налаштування частотного перетворювача системи аспірації', 'Виконати підключення перетворювача тиску до частотного перетворювача системи аспірації та налаштувати його для роботи за аналоговим сигналом', 'done', 'medium', '2026-07-13T13:38:53.061+00:00', '2026-07-14T09:00:00+00:00', 'zinkiv.a', 'zinkiv.a', FALSE, 'all', '[]'::jsonb, '[{"id":"35wyx9diyjhmrj9pom3.i","done":true,"text":"Підключено перетворювач тиску."},{"id":"2o3j964bjxamrj9puqg.i","done":true,"text":"Налаштовано частотний перетворювач."},{"id":"284627a0jiymrj9pzki.i","done":true,"text":"Перевірено роботу системи."},{"id":"xqwkoue72ebmrj9q3hs.i","done":true,"text":"Роботи завершено."}]'::jsonb, '', '["zinkiv.a"]'::jsonb, NULL),
('42825b8a-7b7e-46f3-959c-0d7d7c7bd8d7', 'Виготовлення та монтаж віброізольованих опор для вентиляторів аспірації №1 та №2', 'Виготовити опорні металеві  основи (чашки) для вентиляторів аспірації №1 та №2, закріпити їх до підлоги та встановити вентилятори через гумові віброізоляційні подушки. Після завершення робіт перевірити надійність кріплення, стійкість обладнання.', 'done', 'medium', '2026-07-06T09:38:45.508+00:00', '2026-08-05T09:00:00+00:00', 'zinkiv.a', 'haiboniuk.v', FALSE, 'all', '[]'::jsonb, '[{"id":"u9ix4qc54yemr9122w1","done":true,"text":"Виконано монтаж вентиляторів на віброопорах."},{"id":"xfgljfxl2dmr915vse.i","done":true,"text":"Перевірено надійність кріплення."}]'::jsonb, '', '["haiboniuk.v"]'::jsonb, NULL),
('5f826c73-e2bc-41a8-aa77-4d6e1d296ea4', 'Монтаж розеток у зоні верстатів «Феї»', 'Виконати монтаж розеток у зоні верстатів «Феї», включаючи прокладання лінії живлення, встановлення та підключення розеток. Після завершення робіт перевірити працездатність установлених розеток.', 'done', 'high', '2026-07-02T21:58:33.543+00:00', '2026-08-01T09:00:00+00:00', 'zinkiv.a', 'borovets.v', FALSE, 'all', '[]'::jsonb, '[{"id":"8x8l61tt6z6mr41ps26.i","done":true,"text":"Прокладено лінію живлення."},{"id":"0l7rk2gqfj8mr41pxp7.i","done":true,"text":"Встановлено розетки."},{"id":"uuj32a8w0wimr41q3pq.i","done":true,"text":"Виконано підключення."},{"id":"ab19994p2oumr41qdzd.i","done":true,"text":"Перевірено працездатність розеток."}]'::jsonb, '', '["borovets.v","zinkiv.a"]'::jsonb, NULL),
('ace412b5-78f3-454c-adf4-f3333388bb36', 'Підключення фільтрів в цеху другого поверху', 'Під*єднати до електромережі фільтруючі установки', 'done', 'urgent', '2026-06-30T14:22:30.678+00:00', '2026-07-01T00:00:00+00:00', 'director', 'zinkiv.a', FALSE, 'all', '[]'::jsonb, '[{"id":"msa1tm6053bmr0qjh18.i","done":true,"text":"Підготувати фільтри до установки"},{"id":"2wtdiksb8ghmr0qjomf.i","done":true,"text":"Змонтувати фільтри"},{"id":"zhieub31rblmr0qk0p3.i","done":true,"text":"Розробити та погодити схему підключення"},{"id":"76exmx0plaomr0qkxmi.i","done":true,"text":"Під*єднати до електромережі"}]'::jsonb, '', '["zinkiv.a"]'::jsonb, NULL),
('43216b28-5f92-4b6a-b414-0c5ec5ffa04d', 'Доопрацювання нової системи аспірації', 'Виконати доопрацювання системи аспірації шляхом підключення та програмування датчика рівня пилу, підключення світлової сигналізації, встановлення і підключення вентиляції щита керування, а також проведення перевірки працездатності всіх доопрацьованих вузлів після завершення робіт.', 'done', 'high', '2026-07-02T07:04:09.701+00:00', '2026-08-01T09:00:00+00:00', 'zinkiv.a', 'zinkiv.a', FALSE, 'all', '[]'::jsonb, '[{"id":"7jttwpsekqxmr35o25k","done":true,"text":"Підключено та запрограмовано датчик рівня пилу."},{"id":"esyrt0yo27jmr35ojcb","done":true,"text":"Підключено світлову сигналізацію."},{"id":"dal7r178335mr35reou","done":true,"text":"Встановлено та підключено вентиляцію щита керування."},{"id":"trdsqswh9zmr35rmfx","done":true,"text":"Перевірено коректність роботи всіх елементів."},{"id":"yodcvp8nvrmr35ry7j","done":true,"text":"Роботи завершено та систему введено в експлуатацію."}]'::jsonb, '', '["zinkiv.a"]'::jsonb, NULL),
('4d819b7d-c813-42a1-881d-2e8d4a77e10e', 'Ліфт огородження ', '', 'in_progress', 'medium', '2026-08-20T16:24:33.737+00:00', NULL, 'haiboniuk.v', 'haiboniuk.v', FALSE, 'all', '[]'::jsonb, '[{"id":"qarc6bo1ovemt1q3xh5.i","done":false,"text":"Монтаж металевого каркасу на 2 поверсі.","deadline":"2026-08-17T20:00"},{"id":"lvyvgh347lmt1q4nty.i","done":false,"text":"Монтаж металевого каркасу на 1 поверсі."},{"id":"4on61b0htkjmt1q7n5v","done":true,"text":"Покраска металевого каркасу","deadline":"2026-08-19","parent_id":"qarc6bo1ovemt1q3xh5.i"},{"id":"cd4col96vmlmt1q8r4q","done":false,"text":"Монтаж сітки","parent_id":"qarc6bo1ovemt1q3xh5.i"},{"id":"k9gwf2xq4bmt1q9wx5","done":true,"text":"Покраска металевого каркасу","parent_id":"lvyvgh347lmt1q4nty.i"},{"id":"dt3xtz0v2immt1qa79f","done":false,"text":"Монтаж сітки","parent_id":"lvyvgh347lmt1q4nty.i"},{"id":"d5gdaftsmlfmt1qab6p","done":false,"text":"монтаж металевого каркасу на 0 поверсі"},{"id":"iy0p8w1kzzjmt1qawig","done":true,"text":"Покраска металевого каркасу","parent_id":"d5gdaftsmlfmt1qab6p"},{"id":"dckkt1pz98bmt1qb4nk","done":false,"text":"Монтаж сітки","parent_id":"d5gdaftsmlfmt1qab6p"},{"id":"f9e9s16xsvmt1qcm3u","done":true,"text":"Монтаж магнітного замка , датчиків відкривання закривання дверей. Фіксаторів дверей","parent_id":"qarc6bo1ovemt1q3xh5.i"},{"id":"hj0o6wwuk7mmt1qd0op","done":true,"text":"Монтаж магнітного замка , датчиків відкривання закривання дверей. Фіксаторів дверей","parent_id":"lvyvgh347lmt1q4nty.i"},{"id":"lxl3q3oewhtmt1qdiaa","done":true,"text":"Монтаж магнітного замка , датчиків відкривання закривання дверей. Фіксаторів дверей","parent_id":"d5gdaftsmlfmt1qab6p"}]'::jsonb, '', '[]'::jsonb, NULL),
('c23b8178-1d8a-4e1e-b356-dbebf7989333', 'Монтаж освітлення у робочій зоні верстатів «Феї»', 'Виконати монтаж освітлення в зоні верстатів «Феї», включаючи встановлення світильників, прокладання та підключення лінії живлення.', 'done', 'high', '2026-07-02T21:52:59.276+00:00', '2026-07-11T09:00:00+00:00', 'zinkiv.a', 'zinkiv.a', FALSE, 'all', '[]'::jsonb, '[{"id":"6r4c623ex85mr41iw7f.i","done":true,"text":"Прокладено лінію живлення."},{"id":"f35qdwgm1idmr41j2kj.i","done":true,"text":"Встановлено світильники."},{"id":"7fs9ck11wtmr4i61zu.i","done":true,"text":"Виконано підключення"},{"id":"3hbi4lyffxwmr4i6rhu.i","done":true,"text":"Перевірено роботу освітлення"}]'::jsonb, '', '["zinkiv.a"]'::jsonb, NULL),
('c896f1a4-c7f7-4d0a-b4f6-5b30bfda73a5', 'Демонтаж нефункціонуючого освітлення цех №2 (2 поверх)', 'Виконати демонтаж нефункціонуючих елементів системи освітлення в цеху №2. Після завершення робіт перевірити безпечний стан місця виконання робіт', 'in_progress', 'low', '2026-07-02T07:18:19.279+00:00', '2026-12-31T09:00:00+00:00', 'zinkiv.a', 'zinkiv.a', FALSE, 'all', '[]'::jsonb, '[{"id":"wlf3rh6o82hmr369rsc","done":false,"text":"Визначено нефункціонуючі елементи освітлення."},{"id":"trvh4js6fnmr369wzg","done":false,"text":"Виконано демонтаж світильників та супутніх елементів."},{"id":"u5vfveuq2q9mr36a2uk","done":false,"text":"Демонтовані матеріали прибрано з робочої зони."},{"id":"r7cui3568qmr36a8ce","done":false,"text":"Погоджено подальші дії щодо демонтованих світильників."},{"id":"2gxergb1xb6mr36ad2t","done":false,"text":"Перевірено безпечний стан електромережі після демонтажу."},{"id":"r8qf96vsjsmr36aget","done":false,"text":"Роботи завершено."}]'::jsonb, '', '["zinkiv.a","borovets.v"]'::jsonb, NULL),
('059fc458-1574-4a2f-9408-211fa11d2152', 'Фото для Даніеля', 'Комплект фото з технології виробництва ', 'todo', 'medium', '2026-08-05T10:19:09.386+00:00', NULL, 'director', 'director', FALSE, 'all', '[]'::jsonb, '[]'::jsonb, '#ef4444', '["director"]'::jsonb, NULL),
('2b4eb4b6-fb36-4e8b-a3b4-9ccf82d8cdc9', 'Прокладання та підключення кабелю живлення до щита верстатів «Феї»', 'Виконати прокладання кабелю живлення до щита верстатів «Феї» відповідно до вимог проєкту та норм електробезпеки. Після прокладання виконати підключення кабелю з обох кінців, перевірити правильність монтажу, надійність контактних з''єднань і готовність лінії до введення в експлуатацію.', 'done', 'medium', '2026-07-02T07:25:31.701+00:00', '2026-08-01T09:00:00+00:00', 'zinkiv.a', 'zinkiv.a', FALSE, 'all', '[]'::jsonb, '[{"id":"t8r8kyefpwfmr36h1t0","done":true,"text":"Підготовлено трасу для прокладання кабелю.","assignee":"borovets.v","assignees":["borovets.v"]},{"id":"atcsyzqh7l6mr36h9tb","done":true,"text":"Кабель живлення прокладено до щита верстатів «Феї»"},{"id":"ab32l850lqnmr36htd7","done":true,"text":"Кабель підключено до щита верстатів «Феї»."},{"id":"aprzkb2hnypmr36hxy9","done":true,"text":"Кабель підключено з боку джерела живлення."},{"id":"ums6cka3kagmr36i3iw","done":true,"text":"Перевірено правильність підключення і надійність контактних з''єднань."},{"id":"qzlevh5wknmmr36i8ba","done":true,"text":"Лінію підготовлено до введення в експлуатацію."},{"id":"xzj89kfvbqmr36ifud","done":true,"text":"Роботи завершено."}]'::jsonb, '', '["zinkiv.a"]'::jsonb, NULL),
('e388d134-e674-48e1-83c8-553eaadf4ad5', 'Доопрацювання аспірації на 2 пов. ', 'Провести монтаж аспіраційних труб для подальшого підключення 2 станків Домінант. ', 'review', 'medium', '2026-08-20T16:30:42.273+00:00', NULL, 'haiboniuk.v', 'haiboniuk.v', FALSE, 'all', '[]'::jsonb, '[]'::jsonb, '', '["haiboniuk.v"]'::jsonb, NULL),
('7b5c7575-9d32-4d19-bfed-a2f1844be62b', 'План робіт по демонтажних роботах другого поверху', 'Демонтажні роботи проємів другого поверху, стін, підлоги, перестінків', 'in_progress', 'high', '2026-07-01T10:02:04.49+00:00', '2026-07-08T00:00:00+00:00', 'director', 'drabchuk.r', FALSE, 'all', '[]'::jsonb, '[{"id":"umcx942x59mr1wjtka","done":true,"text":"Зібрати команду"},{"id":"yff3f7sgwdamr1wk6lt","done":true,"text":"погодити к-ть людей, та хто саме буде це виконувати.","parent_id":"umcx942x59mr1wjtka"},{"id":"ee3gvaonjsnmr1wkez8","done":true,"text":"Призначити відповідального","parent_id":"umcx942x59mr1wjtka"},{"id":"ng72jzx0c1qmr1wklz2","done":true,"text":"Підготувати інструмент"},{"id":"mqpd7k1c5ehmr1wlekw.i","done":true,"text":"вказати к-ть інструменту, який використовується","parent_id":"ng72jzx0c1qmr1wklz2"},{"id":"1uo31khddwpmr1wn0ow.i","done":true,"text":"Початок демонтажних робіт"},{"id":"o2wlbvml28mr1wn8wm.i","done":false,"text":"Вивіз будівельного сміття"},{"id":"vcoos4ocjqmr1wngh5.i","done":true,"text":"Винесення сміття в мішках","parent_id":"o2wlbvml28mr1wn8wm.i"},{"id":"4ie5xosj666mr1wnph6.i","done":false,"text":"Замовити контейнер","parent_id":"o2wlbvml28mr1wn8wm.i"},{"id":"01fe4yb4wp92mr1wnw8p.i","done":false,"text":"Вивіз сміття","parent_id":"o2wlbvml28mr1wn8wm.i"},{"id":"yu9n6ih9u3imr1wo49a.i","done":false,"text":"Кінцеве прибирання","parent_id":"o2wlbvml28mr1wn8wm.i"}]'::jsonb, '', '["drabchuk.r"]'::jsonb, NULL),
('e2fc0a99-7e21-4fa3-8ccb-1fc74b42a150', 'Прибирання від демонтованих конструкцій на другому поверсі', 'Винести на двір конструкції стелі з другого поверху.
Долучити людей з цеху №2', 'done', 'urgent', '2026-07-01T18:03:18.314+00:00', '2026-07-02T10:00:00+00:00', 'director', 'drabchuk.r', FALSE, 'all', '[]'::jsonb, '[]'::jsonb, '#22c55e', '["drabchuk.r"]'::jsonb, NULL),
('50aee0e3-d696-4abc-8e34-15b897c49cb4', 'Електромонтажні роботи в кімнаті прийому їжі та коридорі', 'Виконати електромонтажні роботи в кімнаті прийому їжі та коридорі. У кімнаті прийому їжі прокласти кабельні лінії, розключити розподільчі коробки, встановити та підключити світильники й електрофурнітуру. У коридорі виконати монтаж і підключення світильника та електрофурнітури. Після завершення робіт перевірити працездатність усіх змонтованих електротехнічних виробів.', 'in_progress', 'medium', '2026-07-06T06:04:21.512+00:00', '2026-08-05T09:00:00+00:00', 'zinkiv.a', 'zinkiv.a', FALSE, 'all', '[]'::jsonb, '[{"id":"82gej0fuc75mr8tdsw1","done":true,"text":"Прокладено кабельні лінії в кімнаті прийому їжі."},{"id":"xffsg9mjfjmr8tdwv3","done":true,"text":"Розключено розподільчі коробки."},{"id":"6lkf64gc6jxmr8te0iu","done":true,"text":"Встановлено та підключено світильники в кімнаті прийому їжі."},{"id":"bdwfzc6w3c5mr8te40w","done":false,"text":"Встановлено та підключено електрофурнітуру в кімнаті прийому їжі."},{"id":"8jz421m58eamr8te785","done":false,"text":"Встановлено та підключено світильник у коридорі."},{"id":"blo5uczhqimr8tea30","done":false,"text":"Встановлено та підключено електрофурнітуру в коридорі."},{"id":"p8vq273ctdimr8ted2n","done":false,"text":"Перевірено працездатність освітлення та електрофурнітури."},{"id":"gtagw0drsz9mrkq2qw8.i","done":true,"text":"Перенести підрозетники на фартусі"}]'::jsonb, '', '["zinkiv.a","borovets.v"]'::jsonb, NULL),
('1d4b89bd-dde6-498e-868b-dee14bb9f45b', 'Монтаж ліній живлення та розеток 220 В для моніторів', 'Виконати підведення живлення 220 В та встановлення розеток для підключення моніторів у визначених точках: цех фарбування 1, цех фарбування 2 та прес. Після завершення монтажу перевірити правильність підключення, надійність контактних з''єднань і працездатність установлених розеток.', 'in_progress', 'high', '2026-07-02T07:41:19.471+00:00', '2026-07-09T09:00:00+00:00', 'zinkiv.a', 'zinkiv.a', FALSE, 'all', '[]'::jsonb, '[{"id":"fvsgpio1m4rmr36sbc7","done":true,"text":"Підведено живлення 220 В до точки «Цех фарбування 1»."},{"id":"gfv4iat2rlimr370fw6","done":false,"text":"Підведено живлення 220 В до точки «Цех фарбування 2»."},{"id":"8ou7ga9xon7mr3733h9","done":false,"text":"Підведено живлення 220 В до точки «Прес»."},{"id":"ya14j9f952cmr373fjd","done":false,"text":"Перевірено працездатність установлених розеток."},{"id":"6iszavzyqqimr373igs","done":false,"text":"Встановлено та підключено розетку для монітора в точці «Прес».","parent_id":"8ou7ga9xon7mr3733h9"},{"id":"1zmwrteyywhmr373pe6","done":false,"text":"Роботи завершено."},{"id":"c4quteae6dumr3bv37z","done":true,"text":"Підведено живлення 220 В до точки «к. підготовки листів»."},{"id":"0p3pc4ec01sdmr3bvt09","done":true,"text":"Встановлено та підключено розетку для монітора в точці «к. підготовки листів».","parent_id":"c4quteae6dumr3bv37z"}]'::jsonb, '', '["zinkiv.a"]'::jsonb, NULL),
('6d4e9fdf-317e-42c6-9e20-ecf072a5ad94', 'Монтаж дверей 3 поверх', 'Монтаж двохстворчатих дверей коридору з боку сходової площадки 3-й поверх', 'done', 'high', '2026-07-03T07:23:35.713+00:00', '2026-07-03T09:00:00+00:00', 'drabchuk.r', 'director', FALSE, 'all', '[]'::jsonb, '[{"id":"kiz23eqhg2mr4lzs5e.i","done":true,"text":"Організіція монтажу дверей"},{"id":"xc87vsic31amr4m13is.i","done":true,"text":"Забезпечення інструментом та матеріалами"}]'::jsonb, '#f97316', '[]'::jsonb, NULL),
('dcde2c55-2b11-4736-b120-a4fb9d5c3c37', 'Модернізація електрощита та монтаж освітлення в підготовчій зоні фарбувальної дільниці', 'Виконати заміну електричного щита та змонтувати нову систему освітлення в підготовчій зоні фарбувальної дільниці.Після завершення робіт перевірити працездатність електрощита й освітлення.', 'done', 'medium', '2026-07-06T05:47:28.834+00:00', '2026-08-05T09:00:00+00:00', 'zinkiv.a', 'zinkiv.a', FALSE, 'all', '[]'::jsonb, '[{"id":"22b5amlvyxkmr8ssbxj.i","done":true,"text":"Демонтовано існуючий електричний щит."},{"id":"33u2svqx55tmr8ssfiy.i","done":true,"text":"Встановлено та підключено новий електричний щит."},{"id":"3vkgtrlgourmr8ssoeg.i","done":true,"text":"Прокладено лінії живлення для освітлення."},{"id":"ihpgktnujmmr8ssvu0.i","done":true,"text":"Встановлено та підключено світильники."},{"id":"u2db7oqdmk9mr8st071.i","done":true,"text":"Перевірено роботу електрощита та освітлення."}]'::jsonb, '', '["zinkiv.a"]'::jsonb, NULL),
('37e83dd1-3bda-4f63-9331-e31e3bdc0d1d', 'План розміщення аспірацій 2 поверху', 'Розрахунок аспіраційних труб для прокладання магістралі в цеху на 2 поверсі. З подальшим підключенням станків домінант. 
', 'review', 'medium', '2026-08-20T16:35:04.653+00:00', NULL, 'haiboniuk.v', 'haiboniuk.v', FALSE, 'all', '[]'::jsonb, '[]'::jsonb, '', '[]'::jsonb, NULL),
('ca4a233f-2394-47ca-ab60-db6f52f8c46d', 'Проведення аспіраційних труб на 1 поверсі ', 'Продовжити аспіраційний трубо провід 
Для подальшого підключення до нього станків (фея)', 'done', 'medium', '2026-07-02T10:22:52.025+00:00', '2026-07-02T09:00:00+00:00', 'haiboniuk.v', 'haiboniuk.v', FALSE, 'all', '[]'::jsonb, '[]'::jsonb, '', '["haiboniuk.v"]'::jsonb, NULL),
('dd54546a-5696-4327-9aab-1452c5788011', 'Встановлення дверей на другому поверсі в ліфтовій зоні. ', 'Встановити двері в приміщення де знаходиться рейсмус', 'done', 'high', '2026-07-03T19:23:48.288+00:00', '2026-07-04T09:00:00+00:00', 'director', 'drabchuk.r', FALSE, 'all', '[]'::jsonb, '[{"id":"rp8c2x16p8mr5bmznx","done":false,"text":"Знайти двері на другому поверсі."},{"id":"ocjipr9i9wmr5bn2ws","done":false,"text":"Встановити"},{"id":"774dbnh6f6jmr5bn74r","done":false,"text":"Повідомити керівника"}]'::jsonb, '#ef4444', '["drabchuk.r"]'::jsonb, NULL),
('8b24d281-4683-4840-8719-4ec73e028289', 'Електромережі', '', 'todo', 'high', '2026-08-22T11:21:08.16+00:00', '2026-08-28T00:00:00+00:00', 'director', 'zinkiv.a', FALSE, 'all', '[]'::jsonb, '[]'::jsonb, '', '["zinkiv.a","mykus.r"]'::jsonb, '04dab2d3-8dba-4c2c-8f18-3be3979750f1'),
('1c5dc3bd-473f-45f7-8826-8ce6272af256', 'Підключення до електромережі виробництва другого поверху', 'Для здійснення централізованого обліку електроенергії та можливості ввімкнення генератора, щоб заживити весь цех потрібно під*єднати ліве крило (пакування і т.д.) ', 'done', 'high', '2026-07-01T17:45:37.699+00:00', '2026-07-10T15:00:00+00:00', 'director', 'zinkiv.a', FALSE, 'all', '[]'::jsonb, '[{"id":"mtqgx3t0nermr2d6czm","done":true,"text":"Погодити прокладання траси","deadline":"2026-07-02T12:00"},{"id":"g18um9o8homr2d6oe0","done":true,"text":"Підготувати матеріали (прорахунок та закупівля)","deadline":"2026-07-02T18:00"},{"id":"jq7om7kdlzmr2d7o19","done":true,"text":"Кабель","parent_id":"g18um9o8homr2d6oe0"},{"id":"vr1cfvovfupmr2d83a4","done":true,"text":"Електромонтажні вироби та розхідники","parent_id":"g18um9o8homr2d6oe0"},{"id":"aj8fr6pg8almr2d8ao1","done":true,"text":"Автоматика","parent_id":"g18um9o8homr2d6oe0"},{"id":"ohr1mug047mr2d8n0w","done":true,"text":"Підготовка траси"},{"id":"loz8tnf1zzdmr2d8rax","done":true,"text":"Підключення"},{"id":"jfgcfg30ajmr2d8yfq","done":true,"text":"Прибирання та закінчення роботи"},{"id":"is3z5c3gr9smr2d9c22","done":true,"text":"Усний звіт директору виробництва по закінченню робіт"}]'::jsonb, '', '["zinkiv.a"]'::jsonb, NULL),
('9b068ec6-147a-4f06-9df8-0a86047461ff', 'Встановлення кондиціонерів', 'Потрібно прорахувати траси кондиціонерів в приміщення Ігоря 3Д друк та на кафедру. 
Підвести живлення до місць встановлення та вибрати місця встановлення.', 'review', 'high', '2026-07-01T17:54:43.224+00:00', '2026-07-09T11:00:00+00:00', 'director', 'drabchuk.r', TRUE, '87e76603-a0f6-4977-af60-d4d37d4d78e7', '[]'::jsonb, '[{"id":"6ythlx823mmr2df53f.i","done":false,"text":"Погодити розташування кондиціонерів з підрядником","deadline":"2026-07-02T12:50"},{"id":"rbqn401o9kgmr2diskc","done":false,"text":"Прорахувати довжини трас та надати інформацію","deadline":"2026-07-02T13:00"},{"id":"gzk3ra3bl3mr2dltlx","done":true,"text":"Підвести живлення відповідно до потужності","assignee":"zinkiv.a"},{"id":"nlaih1kupkmr2dlzjo","done":true,"text":"погодження точки підключення","deadline":"2026-07-02","parent_id":"gzk3ra3bl3mr2dltlx"},{"id":"7fkxqlwz9gwmr2dm914","done":true,"text":"закупівля матеріалів","deadline":"2026-07-02","parent_id":"gzk3ra3bl3mr2dltlx"},{"id":"rssw55qeu2amr2dn8e6","done":true,"text":"виконання електромонтажних робіт","deadline":"2026-07-07","parent_id":"gzk3ra3bl3mr2dltlx"}]'::jsonb, '', '["drabchuk.r"]'::jsonb, NULL),
('8cde2c77-ba1d-4f2e-b6b7-46b5340d5226', 'Встановлення світлозвукової сигналізації попередження про перехід з генератора на мережу', 'Визначити місця встановлення світлозвукової сигналізації, замовити необхідні матеріали, виконати прокладання кабельних ліній, монтаж і підключення сигналізації. Після завершення робіт перевірити її працездатність.', 'in_progress', 'medium', '2026-07-09T09:04:31.276+00:00', '2026-08-08T09:00:00+00:00', 'zinkiv.a', 'zinkiv.a', FALSE, 'all', '[]'::jsonb, '[{"id":"frzp284m26mrda1d66.i","done":false,"text":"Визначено місця встановлення сигналізації.","assignee":"d.ws1","assignees":["d.ws1"]},{"id":"lvijlouudzgmrda1ize.i","done":false,"text":"Замовлено необхідні матеріали.","assignee":"zinkiv.a","assignees":["zinkiv.a"]},{"id":"znj8rn7z40omrda1mdi.i","done":false,"text":"Прокладено кабельні лінії.","assignee":null,"assignees":[]},{"id":"3xlwn3jphl3mrda1pwd.i","done":false,"text":"Змонтовано та підключено сигналізацію."},{"id":"5qzlchhv4y5mrda1v1t.i","done":false,"text":"Перевірено працездатність."},{"id":"eur5fqh631mrda1yds.i","done":false,"text":"Роботи завершено."}]'::jsonb, '', '["zinkiv.a","borovets.v"]'::jsonb, NULL),
('27d092f7-8815-4f31-863c-57f378cfdd88', 'Організація електроживлення ліфта', 'Виконати організацію електроживлення ліфта, включаючи прокладання кабельної лінії та її підключення відповідно до вимог проєкту й норм електробезпеки. Після завершення робіт перевірити правильність монтажу та готовність лінії до введення в експлуатацію.', 'done', 'medium', '2026-07-09T08:47:02.073+00:00', '2026-07-16T09:00:00+00:00', 'zinkiv.a', 'zinkiv.a', FALSE, 'all', '[]'::jsonb, '[{"id":"iu5f8n9ctomrd9h21d","done":true,"text":"Погоджено виконання робіт та маршрут прокладання кабелю."},{"id":"97gt77scb4hmrd9heqc","done":true,"text":"Прокладено кабельну лінію."},{"id":"eezveyfmn6omrd9hk9p","done":true,"text":"Виконано підключення електроживлення."},{"id":"9gqxpd6lslfmrd9hq07","done":true,"text":"Перевірено правильність монтажу."},{"id":"zqlcigc8yt9mrd9htq6","done":true,"text":"Роботи завершено."}]'::jsonb, '', '["zinkiv.a","borovets.v"]'::jsonb, NULL),
('454755d1-b3fb-43b4-87bb-e21c27107351', 'Прорізання дренажного каналу та влаштування отворів в перестінках', '', 'todo', 'high', '2026-08-25T17:09:39.52+00:00', '2026-09-01T00:00:00+00:00', 'director', 'drabchuk.r', FALSE, 'all', '[]'::jsonb, '[{"id":"cpzzermyqjumt8x0a2j","done":false,"text":"Вирівняти канали для водовідведення;","deadline":"2026-09-02","parent_id":null},{"id":"m86qr3ff9ammt8x0if3","done":false,"text":"Влаштувати отвори в стінах;","deadline":"2026-09-02","parent_id":null},{"id":"2i7v2xjg5fqmt8x1ktm","done":false,"text":"Влаштувати гідроізоляцію;","deadline":"2026-08-28","parent_id":null},{"id":"ipfkwmqtrsomt8x4j73.i","done":false,"text":"позначити місця для додаткової гідроізоляції","deadline":"2026-08-26T10:00","parent_id":"2i7v2xjg5fqmt8x1ktm"},{"id":"0c5f2ru0r9k5mt8x5axp.i","done":false,"text":"зароблення додатково позначених місць;","deadline":"2026-08-28","parent_id":"2i7v2xjg5fqmt8x1ktm"}]'::jsonb, '', '["drabchuk.r"]'::jsonb, '72d37343-4b8e-46bd-9ae0-c3492181cfea'),
('f6c8871e-f080-45bb-857b-b60de6b87cb4', 'Підведення електроживлення до плотера.', 'Виконати підведення електроживлення до місця встановлення плотера. Прокласти кабель електроживлення, підключити його в електрощиті, встановити та підключити розетку', 'done', 'urgent', '2026-07-22T06:31:23.136+00:00', '2026-07-22T09:00:00+00:00', 'zinkiv.a', 'borovets.v', FALSE, 'all', '[]'::jsonb, '[{"id":"hov7qe1tabtmrvperur","done":true,"text":"Прокласти кабель електроживлення."},{"id":"10wxa4c452rnmrvpex0h","done":true,"text":"Підключити кабель в електрощиті."},{"id":"i6qt3p1bbqmrvpf0qg","done":true,"text":"Встановити та підключити розетку."},{"id":"vc8m87yjcosmrvpf42w","done":true,"text":"Перевірити правильність підключення та наявність напруги."}]'::jsonb, '', '["borovets.v","zinkiv.a"]'::jsonb, NULL),
('982a8fce-2307-4fc6-916f-ba7d8d93e9ba', 'Встановлення розетки 380 В для преса.', 'Виконати монтаж трифазної розетки 380 В для підключення преса. За потреби прокласти кабель електроживлення, підключити лінію в електрощиті, встановити та підключити розетку, перевірити правильність підключення, наявність напруги та чергування фаз.', 'done', 'urgent', '2026-07-22T06:34:24.659+00:00', '2026-07-22T09:00:00+00:00', 'zinkiv.a', 'zinkiv.a', FALSE, 'all', '[]'::jsonb, '[]'::jsonb, '', '["zinkiv.a"]'::jsonb, NULL),
('cceccde4-4a01-47f2-8fc1-6986b070d6d0', 'Підведення електроживлення та встановлення електрощита для нових кабінетів виробництва.', 'Виконати підведення електроживлення до нових кабінетів виробництва, встановити електрощит, виконати підключення кабельних ліній', 'done', 'medium', '2026-07-22T07:13:59.592+00:00', '2026-08-21T09:00:00+00:00', 'zinkiv.a', 'zinkiv.a', FALSE, 'all', '[]'::jsonb, '[{"id":"5s5cqrfg1ylmrvqxngr.i","done":true,"text":"Замовити необхідні матеріали."},{"id":"c70nxvmlgxbmrvqxr0x.i","done":true,"text":"Прокласти кабельні лінії."},{"id":"gr43hkedeg8mrvqxwed.i","done":true,"text":"Встановити електрощит."}]'::jsonb, '', '["zinkiv.a","borovets.v"]'::jsonb, NULL),
('7acc0b48-1057-4d63-8624-4aebc120ae11', 'Діагностика та відновлення роботи малої аспірації (2 поверх)', 'Виконати діагностику несправності малої аспірації на 2 поверсі, встановити причину відсутності запуску та усунути виявлену несправність.', 'done', 'urgent', '2026-07-14T06:47:23.677+00:00', '2026-07-14T09:00:00+00:00', 'zinkiv.a', 'zinkiv.a', FALSE, 'all', '[]'::jsonb, '[{"id":"cb3yt05pnvmrkag6bo","done":true,"text":"Виконати діагностику несправності малої аспірації на 2 поверсі, встановити причину відсутності запуску та усунути виявлену несправність."},{"id":"yuu57kynxwmrkagbp5","done":true,"text":"Визначити причину несправності."},{"id":"4mrrzcwusxlmrkaggma","done":true,"text":"Замовити матеріали або запасні частини (за потреби).","parent_id":"yuu57kynxwmrkagbp5"},{"id":"08rn1yr0pd1amrkaglnl","done":true,"text":"Усунути несправність."},{"id":"uu1crzrw32smrkagwpm","done":true,"text":"Перевірити роботу малої аспірації."}]'::jsonb, '', '["zinkiv.a"]'::jsonb, NULL),
('c1d1925d-b365-4b7f-ac84-cfc647fb67e9', 'Заміна підйомних механізмів та модернізація електроживлення трьох столів малярної дільниці', 'Виконати заміну електричних підйомних механізмів на трьох столах малярної дільниці та переробити електричну частину для підключення нових механізмів. Після завершення робіт перевірити правильність підключення та працездатність кожного столу.', 'done', 'medium', '2026-07-13T13:54:00.13+00:00', '2026-07-20T09:00:00+00:00', 'zinkiv.a', 'zinkiv.a', FALSE, 'all', '[]'::jsonb, '[{"id":"i2adbapobe9mrja52hy.i","done":true,"text":"Стіл №1"},{"id":"arl7jozz4ymmrja57d7.i","done":true,"text":"Демонтувати підйомний механізм.","assignee":"zinkiv.a","assignees":["zinkiv.a"],"parent_id":"i2adbapobe9mrja52hy.i"},{"id":"kspfq0k32phmrja5cwa.i","done":true,"text":"Переварити кріплення.","assignee":"haiboniuk.v","assignees":["haiboniuk.v"],"parent_id":"i2adbapobe9mrja52hy.i"},{"id":"9f04dau26bkmrja5fry.i","done":true,"text":"Переробити електричну частину.","assignee":"zinkiv.a","assignees":["zinkiv.a"],"parent_id":"i2adbapobe9mrja52hy.i"},{"id":"kzy8gryzt2mrja5ihs.i","done":true,"text":"Встановити та підключити новий механізм.","assignee":"zinkiv.a","assignees":["zinkiv.a"],"parent_id":"i2adbapobe9mrja52hy.i"},{"id":"0hzs9g96xr8mrja5l11.i","done":true,"text":"Перевірити працездатність.","assignee":"zinkiv.a","assignees":["zinkiv.a"],"parent_id":"i2adbapobe9mrja52hy.i"},{"id":"5oe06vu7uhsmrja5rcj.i","done":true,"text":"Стіл №2"},{"id":"wllfbogcz2nmrja5uy1.i","done":true,"text":"Демонтувати підйомний механізм.","assignee":"zinkiv.a","assignees":["zinkiv.a"],"parent_id":"5oe06vu7uhsmrja5rcj.i"},{"id":"eqm23zperznmrja5xwm.i","done":true,"text":"Переварити кріплення.","assignee":"haiboniuk.v","assignees":["haiboniuk.v"],"parent_id":"5oe06vu7uhsmrja5rcj.i"},{"id":"9o35fmr4t5pmrja60og.i","done":true,"text":"Переробити електричну частину.","assignee":"zinkiv.a","assignees":["zinkiv.a"],"parent_id":"5oe06vu7uhsmrja5rcj.i"},{"id":"c0s57c915amrja636k.i","done":true,"text":"Встановити та підключити новий механізм.","assignee":"zinkiv.a","assignees":["zinkiv.a"],"parent_id":"5oe06vu7uhsmrja5rcj.i"},{"id":"711mefbyljemrja65r6.i","done":true,"text":"Перевірити працездатність.","assignee":"haiboniuk.v","assignees":["haiboniuk.v"],"parent_id":"5oe06vu7uhsmrja5rcj.i"},{"id":"ubfz8h5n5tomrja6c0d.i","done":true,"text":"Стіл №3"},{"id":"8g2lglb87wqmrja6fiq.i","done":true,"text":"Демонтувати підйомний механізм.","assignee":"zinkiv.a","assignees":["zinkiv.a"],"parent_id":"ubfz8h5n5tomrja6c0d.i"},{"id":"ldk2bnumhncmrja6iqr.i","done":true,"text":"Переварити кріплення.","assignee":"haiboniuk.v","assignees":["haiboniuk.v"],"parent_id":"ubfz8h5n5tomrja6c0d.i"},{"id":"cgwt5upfj1kmrja6lqe.i","done":true,"text":"Переробити електричну частину.","assignee":"zinkiv.a","assignees":["zinkiv.a"],"parent_id":"ubfz8h5n5tomrja6c0d.i"},{"id":"zfzfhzq1q4imrja6odw.i","done":true,"text":"Встановити та підключити новий механізм.","assignee":"zinkiv.a","assignees":["zinkiv.a"],"parent_id":"ubfz8h5n5tomrja6c0d.i"},{"id":"ram32pl8wzkmrja6rl4.i","done":true,"text":"Перевірити працездатність.","assignee":"zinkiv.a","assignees":["zinkiv.a"],"parent_id":"ubfz8h5n5tomrja6c0d.i"}]'::jsonb, '', '["zinkiv.a","haiboniuk.v"]'::jsonb, NULL),
('256c2bcb-54de-44b0-bca9-b1027c9afc98', 'Організація електроживлення, освітлення та вентиляції кімнати для куріння.', 'Виконати комплекс електромонтажних робіт у кімнаті для куріння, що включає підведення електроживлення, монтаж і підключення освітлення, а також підключення системи вентиляції.', 'done', 'urgent', '2026-07-22T18:06:27.571+00:00', '2026-07-22T21:00:00+00:00', 'zinkiv.a', 'zinkiv.a', FALSE, 'all', '[]'::jsonb, '[{"id":"o71isu040irmrwe7qik","done":true,"text":"Замовити необхідні матеріали."},{"id":"hgpjactx7fkmrwe7yqo","done":true,"text":"Підвести електроживлення до кімнати.","assignee":"haiboniuk.v","assignees":["haiboniuk.v"]},{"id":"xkwdmj1h45dmrwe828f","done":true,"text":"Встановити та підключити освітлення.","assignee":"borovets.v","assignees":["borovets.v"]},{"id":"vw482y1afqmrwe878f","done":true,"text":"Підключити систему вентиляції."},{"id":"86l4vqf9tiamrwe8clw","done":true,"text":"Перевірити правильність підключення та працездатність обладнання."}]'::jsonb, '', '["zinkiv.a"]'::jsonb, NULL),
('d4d475cf-563f-4fda-8da9-62397ec5e4b0', 'Завершення електромонтажних робіт у роздягальні та санвузлі', 'Виконати монтаж і підключення системи освітлення в роздягальні та санвузлі, встановити та підключити електрофурнітуру. Завершити розключення електричного щита, виконати маркування апаратів, перевірити правильність підключення та працездатність усієї системи.', 'done', 'medium', '2026-07-06T05:55:34.548+00:00', '2026-08-05T09:00:00+00:00', 'zinkiv.a', 'zinkiv.a', FALSE, 'all', '[]'::jsonb, '[{"id":"qb1ip7ub39mr8t1kio.i","done":true,"text":"Встановлено та підключено світильники.","assignee":"borovets.v","assignees":["borovets.v"]},{"id":"dwy11d74bknmr8t1s32.i","done":true,"text":"Встановлено та підключено електрофурнітуру.","assignee":"borovets.v","assignees":["borovets.v"]},{"id":"7d2h00bh3p8mr8t1y9k.i","done":true,"text":"Завершено розключення електричного щита."},{"id":"573gjne2drjmr8t22uh.i","done":true,"text":"Виконано маркування (наліпки) в електричному щиті."},{"id":"qsrn0ekw6yomr8t281p.i","done":true,"text":"Перевірено працездатність освітлення та електрообладнання."}]'::jsonb, '', '["zinkiv.a"]'::jsonb, NULL)
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
  project_id = EXCLUDED.project_id;

-- 3.6 packaging_boxes (63 rows)
INSERT INTO public.packaging_boxes (id, order_id, task_id, batch_index, box_number, nomenclature_id, quantity, created_at, updated_at)
VALUES
('97d987c1-110f-4fe8-a0ff-6ef3c199909f', '8c5046a2-5674-4e8b-bfc5-d7531c4508d7', '47477833-6b2b-42ba-9f3e-25f952a26634', '1', '1', '40a5229f-2f69-4e94-91a0-d947acd48483', 50, '2026-07-06T07:47:10.898949+00:00', '2026-07-06T07:47:09.742+00:00'),
('3733ca57-5cd0-40ab-b1a9-5175dd29fe42', '8c5046a2-5674-4e8b-bfc5-d7531c4508d7', '47477833-6b2b-42ba-9f3e-25f952a26634', '1', '1', '093114dc-f6af-4e7e-bfa4-5746f5b11ba1', 50, '2026-07-06T07:47:10.898949+00:00', '2026-07-06T07:47:09.742+00:00'),
('028ff810-3186-4230-912b-ee66ff2f1aba', '8c5046a2-5674-4e8b-bfc5-d7531c4508d7', '47477833-6b2b-42ba-9f3e-25f952a26634', '1', '1', '84e1e26e-c6f2-4873-841a-1609dc0d8b84', 50, '2026-07-06T07:47:10.898949+00:00', '2026-07-06T07:47:09.742+00:00'),
('48a2ddda-968d-4e80-b249-aefbad019d23', '8c5046a2-5674-4e8b-bfc5-d7531c4508d7', '47477833-6b2b-42ba-9f3e-25f952a26634', '1', '1', 'a56e08ca-c816-40f1-acb2-e9cc0bb1bff0', 200, '2026-07-06T07:47:10.898949+00:00', '2026-07-06T07:47:09.742+00:00'),
('fff2c1f3-e071-4b75-a63d-1481c18d5033', '8c5046a2-5674-4e8b-bfc5-d7531c4508d7', '47477833-6b2b-42ba-9f3e-25f952a26634', '1', '1', '9e2e276d-f9dc-4d63-951b-1744359f4723', 600, '2026-07-06T07:47:10.898949+00:00', '2026-07-06T07:47:09.742+00:00'),
('a677657c-5b59-4151-8052-39a43c85aa5b', '8c5046a2-5674-4e8b-bfc5-d7531c4508d7', '47477833-6b2b-42ba-9f3e-25f952a26634', '1', '1', '32b92244-b897-42d1-96af-e16326e4b17c', 400, '2026-07-06T07:47:10.898949+00:00', '2026-07-06T07:47:09.742+00:00'),
('05b1d533-8daa-4a7e-9638-bba631b8523f', '8c5046a2-5674-4e8b-bfc5-d7531c4508d7', '47477833-6b2b-42ba-9f3e-25f952a26634', '1', '1', '555da7cc-c1d7-41c7-bea2-8e0aeb67f2a9', 200, '2026-07-06T07:47:10.898949+00:00', '2026-07-06T07:47:09.742+00:00'),
('7961258e-f881-48da-a799-8472bd980e41', '8c5046a2-5674-4e8b-bfc5-d7531c4508d7', '47477833-6b2b-42ba-9f3e-25f952a26634', '1', '1', '930dfdd1-8ea5-4ad7-8fc5-56b8dff77f59', 200, '2026-07-06T07:47:10.898949+00:00', '2026-07-06T07:47:09.742+00:00'),
('d7326d00-7bcc-4486-b7a0-bc0377540c9e', '8c5046a2-5674-4e8b-bfc5-d7531c4508d7', '47477833-6b2b-42ba-9f3e-25f952a26634', '1', '1', '80e554f3-09ad-400e-b6bc-c064c7e72078', 400, '2026-07-06T07:47:10.898949+00:00', '2026-07-06T07:47:09.742+00:00'),
('a130c04a-faef-402e-b1d9-2608d2c2f40c', '8c5046a2-5674-4e8b-bfc5-d7531c4508d7', '47477833-6b2b-42ba-9f3e-25f952a26634', '1', '1', '0b88025c-bd0e-49d0-b25b-33cdb47a9c91', 50, '2026-07-06T07:47:10.898949+00:00', '2026-07-06T07:47:09.742+00:00'),
('f11a480d-810f-412c-b1de-30e959ba59ea', '3ef055f7-4586-4d1f-9ac4-a038e3430080', '0bb6b1e0-0a88-46e7-84bd-d2443637c803', '1', '3', '447e35fd-0139-4fc2-9bf3-dc445014cf8f', 53, '2026-07-08T12:00:18.892791+00:00', '2026-07-08T12:01:10.713+00:00'),
('1ebb0ca4-edec-4274-a8b2-47f83f923054', '3ef055f7-4586-4d1f-9ac4-a038e3430080', '0bb6b1e0-0a88-46e7-84bd-d2443637c803', '1', '3', 'e0face80-f00d-48cf-9fed-914995f86e71', 53, '2026-07-08T12:00:18.892791+00:00', '2026-07-08T12:01:10.713+00:00'),
('410591a4-ef0a-42bb-9d53-eac5ca43a9cd', '3ef055f7-4586-4d1f-9ac4-a038e3430080', '0bb6b1e0-0a88-46e7-84bd-d2443637c803', '1', '2', '312b0260-707a-4dc4-9f7a-bd412dd8fa00', 53, '2026-07-08T12:00:18.892791+00:00', '2026-07-08T12:01:10.713+00:00'),
('d0e4b0ba-92aa-46d5-a776-9e3d2070275a', '3ef055f7-4586-4d1f-9ac4-a038e3430080', '0bb6b1e0-0a88-46e7-84bd-d2443637c803', '1', '3', '2d0fb65f-68e3-43d9-94d0-3073f68b8fda', 53, '2026-07-08T12:00:18.892791+00:00', '2026-07-08T12:01:10.713+00:00'),
('37da1ae7-0269-4953-9955-0669e40cc483', '3ef055f7-4586-4d1f-9ac4-a038e3430080', '0bb6b1e0-0a88-46e7-84bd-d2443637c803', '1', '1', '3222d4f9-4275-4d91-af58-728dba0b13ef', 212, '2026-07-08T12:00:18.892791+00:00', '2026-07-08T12:01:10.713+00:00'),
('87742cf5-b741-419a-819c-9d703a0fd57b', '3ef055f7-4586-4d1f-9ac4-a038e3430080', '0bb6b1e0-0a88-46e7-84bd-d2443637c803', '1', '2', 'c869a1af-9388-44c7-8d3e-5babf375a68b', 212, '2026-07-08T12:00:18.892791+00:00', '2026-07-08T12:01:10.713+00:00'),
('4a72f61b-e7dd-4176-b102-690d9f32cea2', '3ef055f7-4586-4d1f-9ac4-a038e3430080', '0bb6b1e0-0a88-46e7-84bd-d2443637c803', '1', '2', '593efd08-86b4-4c60-8789-eb6c87e1e915', 212, '2026-07-08T12:00:18.892791+00:00', '2026-07-08T12:01:10.713+00:00'),
('81c79674-8474-4465-97ee-bd866fe832a1', 'e037c400-9797-421d-9c79-3e3651f30ac7', '50e590b8-3c78-4504-9a88-43f657319f41', '1', '31-45', '8300e002-0169-46ec-9cc6-39cef0971269', 3000, '2026-07-08T09:51:41.453123+00:00', '2026-07-08T09:53:11.241+00:00'),
('65351e9d-aea0-4d13-85bb-58f09e69c07f', 'e037c400-9797-421d-9c79-3e3651f30ac7', '50e590b8-3c78-4504-9a88-43f657319f41', '1', '1-30', 'ef976ad5-8c88-4f03-a53e-2b914f15d4ba', 12000, '2026-07-08T09:51:41.453123+00:00', '2026-07-08T09:53:11.241+00:00'),
('ebcf4393-508c-4556-b2ab-87a65b2b0ce6', 'e037c400-9797-421d-9c79-3e3651f30ac7', '50e590b8-3c78-4504-9a88-43f657319f41', '1', '52-57', 'dc154eb4-a568-4944-8608-9cb0dae1180e', 6000, '2026-07-08T09:51:41.453123+00:00', '2026-07-08T09:53:11.241+00:00'),
('9a5b4bfe-d7ed-4507-a087-6669eb0a33fb', 'e037c400-9797-421d-9c79-3e3651f30ac7', '50e590b8-3c78-4504-9a88-43f657319f41', '1', '46-51', '076ba504-b3f6-4ec8-8844-fe9515077d9c', 3000, '2026-07-08T09:51:41.453123+00:00', '2026-07-08T09:53:11.241+00:00'),
('c0b0b168-623c-4678-b26c-0ee0d2b7fa34', 'e037c400-9797-421d-9c79-3e3651f30ac7', '50e590b8-3c78-4504-9a88-43f657319f41', '1', '58-60', 'c869a1af-9388-44c7-8d3e-5babf375a68b', 12000, '2026-07-08T09:51:41.453123+00:00', '2026-07-08T09:53:11.241+00:00'),
('1f408812-8157-4382-b47e-d02a4aa619c8', 'e037c400-9797-421d-9c79-3e3651f30ac7', '50e590b8-3c78-4504-9a88-43f657319f41', '1', '73', 'ea64a26a-dee9-4704-b6eb-5a0b4f79597b', 3000, '2026-07-08T09:51:41.453123+00:00', '2026-07-08T09:53:11.241+00:00'),
('4a9799df-8e6a-4d66-9300-9ce1c3f024e6', 'e037c400-9797-421d-9c79-3e3651f30ac7', '50e590b8-3c78-4504-9a88-43f657319f41', '1', '69-70', '077e12b5-ca83-4ce2-b7dd-f8fbc7d2b3fc', 12000, '2026-07-08T09:51:41.453123+00:00', '2026-07-08T09:53:11.241+00:00'),
('200a467c-7de1-4cea-85d6-d5ca4825b8af', 'e037c400-9797-421d-9c79-3e3651f30ac7', '50e590b8-3c78-4504-9a88-43f657319f41', '1', '66-68', '4eb1a6c1-7afb-45ea-a3b3-bb568d6b6706', 48000, '2026-07-08T09:51:41.453123+00:00', '2026-07-08T09:53:11.241+00:00'),
('339c65d7-6067-479f-8693-de27590a4f71', 'e037c400-9797-421d-9c79-3e3651f30ac7', '50e590b8-3c78-4504-9a88-43f657319f41', '1', '71-73', '13b9aa0b-70a2-4a61-82a6-63fe2b1d930c', 12000, '2026-07-08T09:51:41.453123+00:00', '2026-07-08T09:53:11.241+00:00'),
('e98b1613-d11d-4aa6-aa0f-2bbe275dec89', 'e037c400-9797-421d-9c79-3e3651f30ac7', '50e590b8-3c78-4504-9a88-43f657319f41', '1', '62-65', '50f24ea0-4b19-4f4d-9baa-7350159119c9', 24000, '2026-07-08T09:51:41.453123+00:00', '2026-07-08T09:53:11.241+00:00'),
('24d20dab-a737-4379-bce8-538e17adf014', 'e037c400-9797-421d-9c79-3e3651f30ac7', '50e590b8-3c78-4504-9a88-43f657319f41', '1', '73', '56d85ed6-7aa9-48d0-937c-a0841097adac', 6000, '2026-07-08T09:51:41.453123+00:00', '2026-07-08T09:53:11.241+00:00'),
('351b8161-00e4-4282-b648-6fc0c2c2e302', 'e037c400-9797-421d-9c79-3e3651f30ac7', '50e590b8-3c78-4504-9a88-43f657319f41', '1', '61', '0b88025c-bd0e-49d0-b25b-33cdb47a9c91', 3000, '2026-07-08T09:51:41.453123+00:00', '2026-07-08T09:53:11.241+00:00'),
('7f5341aa-8a3f-4d55-a03d-45606ec2e9de', 'e037c400-9797-421d-9c79-3e3651f30ac7', '50e590b8-3c78-4504-9a88-43f657319f41', '1', '73', '0ab28738-6385-471f-b5aa-7881dfa3cb1c', 1, '2026-07-08T09:51:41.453123+00:00', '2026-07-08T09:53:11.241+00:00'),
('9a7adab4-381f-4064-abc1-70fcb33fc19a', 'e037c400-9797-421d-9c79-3e3651f30ac7', '50e590b8-3c78-4504-9a88-43f657319f41', '1', '73', 'c48e7cef-0500-48bb-87b9-232f63f54116', 2, '2026-07-08T09:51:41.453123+00:00', '2026-07-08T09:53:11.241+00:00'),
('4fb1c4f2-0c96-4891-834a-099f2d4f11b9', 'e037c400-9797-421d-9c79-3e3651f30ac7', '50e590b8-3c78-4504-9a88-43f657319f41', '1', '73', '5794bab6-1bca-4785-86f8-b525e2b0be76', 1, '2026-07-08T09:51:41.453123+00:00', '2026-07-08T09:53:11.241+00:00'),
('d3850742-6fb2-42d9-996a-7c920dc12321', 'e037c400-9797-421d-9c79-3e3651f30ac7', '50e590b8-3c78-4504-9a88-43f657319f41', '1', '73', '9a048d33-d916-4b5c-8539-00006ab3e23d', 0, '2026-07-08T09:51:41.453123+00:00', '2026-07-08T09:53:11.241+00:00'),
('01d81edd-852d-4bc5-9f89-07a2f529681f', 'e037c400-9797-421d-9c79-3e3651f30ac7', '50e590b8-3c78-4504-9a88-43f657319f41', '1', '73', '34f79eca-3fd9-4281-ab69-e123a2005379', 4, '2026-07-08T09:53:11.458704+00:00', '2026-07-08T09:53:11.241+00:00'),
('b9ea5b05-1085-4f61-b6ca-84e1a80cd466', '3ef055f7-4586-4d1f-9ac4-a038e3430080', '0bb6b1e0-0a88-46e7-84bd-d2443637c803', '1', '2', '374cd1ce-dac7-4d26-b1af-8336bc7351e1', 53, '2026-07-08T12:00:18.892791+00:00', '2026-07-08T12:01:10.713+00:00'),
('6b4f052d-c25d-476a-9184-a72ee8cb5b8c', '3ef055f7-4586-4d1f-9ac4-a038e3430080', '0bb6b1e0-0a88-46e7-84bd-d2443637c803', '1', '4', '6ceeade2-738b-45c3-8ad5-20001ab142d9', 424, '2026-07-08T12:00:18.892791+00:00', '2026-07-08T12:01:10.713+00:00'),
('9bb1066f-aeba-40a2-b41d-4a0cfc710f79', '3ef055f7-4586-4d1f-9ac4-a038e3430080', '0bb6b1e0-0a88-46e7-84bd-d2443637c803', '1', '4', 'cc080a9a-9503-4e8d-9010-3f29b12c8ce1', 742, '2026-07-08T12:00:18.892791+00:00', '2026-07-08T12:01:10.713+00:00'),
('4b2ae2b6-1dcf-4f13-b758-900e7ef7748f', '3ef055f7-4586-4d1f-9ac4-a038e3430080', '0bb6b1e0-0a88-46e7-84bd-d2443637c803', '1', '4', 'eaba31d7-b73f-4d0f-9316-b6fb7df66f21', 53, '2026-07-08T12:00:18.892791+00:00', '2026-07-08T12:01:10.713+00:00'),
('476befe0-9af2-407f-9914-7c4de081c6c8', '3ef055f7-4586-4d1f-9ac4-a038e3430080', '0bb6b1e0-0a88-46e7-84bd-d2443637c803', '1', '4', '7a83ad11-96ad-44e1-a4a6-880e61e337a3', 106, '2026-07-08T12:00:18.892791+00:00', '2026-07-08T12:01:10.713+00:00'),
('06f36970-2dfc-4d26-a081-3d42ac9ec2c0', '3ef055f7-4586-4d1f-9ac4-a038e3430080', '0bb6b1e0-0a88-46e7-84bd-d2443637c803', '1', '4', '0bcb0f73-4c93-4564-bb46-6092cf7529d7', 106, '2026-07-08T12:00:18.892791+00:00', '2026-07-08T12:01:10.713+00:00'),
('91a0bb11-4839-4f72-92dc-2dfd22ecc9bd', '3ef055f7-4586-4d1f-9ac4-a038e3430080', '0bb6b1e0-0a88-46e7-84bd-d2443637c803', '1', '4', '1106d676-8570-4f74-a3f3-626ed97e171b', 212, '2026-07-08T12:00:18.892791+00:00', '2026-07-08T12:01:10.713+00:00'),
('79b255f2-b1d6-45da-9f22-839a714da460', '3ef055f7-4586-4d1f-9ac4-a038e3430080', '0bb6b1e0-0a88-46e7-84bd-d2443637c803', '1', '4', '586806a4-0f03-4979-bf28-1bc0938f6dfa', 424, '2026-07-08T12:00:18.892791+00:00', '2026-07-08T12:01:10.713+00:00'),
('7d8249a5-3f70-49ea-86cb-6c2d7127bd59', '3ef055f7-4586-4d1f-9ac4-a038e3430080', '0bb6b1e0-0a88-46e7-84bd-d2443637c803', '1', '4', '72b5a7a2-83c2-4e0b-b080-28f252bc3e6f', 212, '2026-07-08T12:00:18.892791+00:00', '2026-07-08T12:01:10.713+00:00'),
('da79485a-2338-4b45-bad0-db2a58d4d1fd', '3ef055f7-4586-4d1f-9ac4-a038e3430080', '0bb6b1e0-0a88-46e7-84bd-d2443637c803', '1', '3', '2455cd38-6a4a-48b0-8433-ac055bf367b6', 318, '2026-07-08T12:01:11.5746+00:00', '2026-07-08T12:01:10.713+00:00'),
('2abb0e2a-1176-48a3-98d5-b12c73953cfa', '2cb02ded-84ba-4888-930e-3b306d0eba04', 'b770a8c7-fe92-477b-b49e-f985783e3ccd', '1', '7', '447e35fd-0139-4fc2-9bf3-dc445014cf8f', 120, '2026-07-14T09:51:26.234118+00:00', '2026-07-14T09:51:34.823+00:00'),
('6b589f89-e695-4d79-aa29-283fa777136e', '2cb02ded-84ba-4888-930e-3b306d0eba04', 'b770a8c7-fe92-477b-b49e-f985783e3ccd', '1', '5', 'e0face80-f00d-48cf-9fed-914995f86e71', 120, '2026-07-14T09:51:26.234118+00:00', '2026-07-14T09:51:34.823+00:00'),
('c99497ae-95e9-4580-b7bb-9687810e2d0c', '2cb02ded-84ba-4888-930e-3b306d0eba04', 'b770a8c7-fe92-477b-b49e-f985783e3ccd', '1', '5', '312b0260-707a-4dc4-9f7a-bd412dd8fa00', 120, '2026-07-14T09:51:26.234118+00:00', '2026-07-14T09:51:34.823+00:00'),
('1d5fa791-6639-465e-82ac-3e83ac2c4892', '2cb02ded-84ba-4888-930e-3b306d0eba04', 'b770a8c7-fe92-477b-b49e-f985783e3ccd', '1', '3,6', '2d0fb65f-68e3-43d9-94d0-3073f68b8fda', 120, '2026-07-14T09:51:26.234118+00:00', '2026-07-14T09:51:34.823+00:00'),
('8cd3ec7a-2c83-4724-8ddb-df705d7e5fed', '2cb02ded-84ba-4888-930e-3b306d0eba04', 'b770a8c7-fe92-477b-b49e-f985783e3ccd', '1', '1-2,6', '3222d4f9-4275-4d91-af58-728dba0b13ef', 480, '2026-07-14T09:51:26.234118+00:00', '2026-07-14T09:51:34.823+00:00'),
('3ddec2f9-8268-4267-99cf-1fe45dfe23fd', '2cb02ded-84ba-4888-930e-3b306d0eba04', 'b770a8c7-fe92-477b-b49e-f985783e3ccd', '1', '5', 'c869a1af-9388-44c7-8d3e-5babf375a68b', 480, '2026-07-14T09:51:26.234118+00:00', '2026-07-14T09:51:34.823+00:00'),
('29ef1d67-d2d0-488c-b502-6be66179fdb9', '2cb02ded-84ba-4888-930e-3b306d0eba04', 'b770a8c7-fe92-477b-b49e-f985783e3ccd', '1', '6', '593efd08-86b4-4c60-8789-eb6c87e1e915', 480, '2026-07-14T09:51:26.234118+00:00', '2026-07-14T09:51:34.823+00:00'),
('671910ee-8075-4292-86a5-7270abe4fbaa', '2cb02ded-84ba-4888-930e-3b306d0eba04', 'b770a8c7-fe92-477b-b49e-f985783e3ccd', '1', '4,6', '374cd1ce-dac7-4d26-b1af-8336bc7351e1', 120, '2026-07-14T09:51:26.234118+00:00', '2026-07-14T09:51:34.823+00:00'),
('748259e5-a4a3-46a6-96d8-a306068bc809', '2cb02ded-84ba-4888-930e-3b306d0eba04', 'b770a8c7-fe92-477b-b49e-f985783e3ccd', '1', '7', '6ceeade2-738b-45c3-8ad5-20001ab142d9', 960, '2026-07-14T09:51:26.234118+00:00', '2026-07-14T09:51:34.823+00:00'),
('a255afc0-ad85-467c-bce4-5920258e0fbd', '2cb02ded-84ba-4888-930e-3b306d0eba04', 'b770a8c7-fe92-477b-b49e-f985783e3ccd', '1', '7', 'cc080a9a-9503-4e8d-9010-3f29b12c8ce1', 1680, '2026-07-14T09:51:26.234118+00:00', '2026-07-14T09:51:34.823+00:00'),
('a7226f0d-9857-4f7e-b8ae-03fddf1f8ab7', '2cb02ded-84ba-4888-930e-3b306d0eba04', 'b770a8c7-fe92-477b-b49e-f985783e3ccd', '1', '7', 'eaba31d7-b73f-4d0f-9316-b6fb7df66f21', 120, '2026-07-14T09:51:26.234118+00:00', '2026-07-14T09:51:34.823+00:00'),
('7f928869-aec6-426e-b659-855d1ea249db', '2cb02ded-84ba-4888-930e-3b306d0eba04', 'b770a8c7-fe92-477b-b49e-f985783e3ccd', '1', '7', '7a83ad11-96ad-44e1-a4a6-880e61e337a3', 240, '2026-07-14T09:51:26.234118+00:00', '2026-07-14T09:51:34.823+00:00'),
('2bc6779a-3e1d-4750-8c05-0997db1f2f3e', '2cb02ded-84ba-4888-930e-3b306d0eba04', 'b770a8c7-fe92-477b-b49e-f985783e3ccd', '1', '7', '0bcb0f73-4c93-4564-bb46-6092cf7529d7', 240, '2026-07-14T09:51:26.234118+00:00', '2026-07-14T09:51:34.823+00:00'),
('5b901847-b522-49e8-a1f6-a90b8b8f83da', '2cb02ded-84ba-4888-930e-3b306d0eba04', 'b770a8c7-fe92-477b-b49e-f985783e3ccd', '1', '7', '1106d676-8570-4f74-a3f3-626ed97e171b', 480, '2026-07-14T09:51:26.234118+00:00', '2026-07-14T09:51:34.823+00:00'),
('36c26ec4-0db7-4d3b-9842-77772e12cd9b', '2cb02ded-84ba-4888-930e-3b306d0eba04', 'b770a8c7-fe92-477b-b49e-f985783e3ccd', '1', '7', '586806a4-0f03-4979-bf28-1bc0938f6dfa', 960, '2026-07-14T09:51:26.234118+00:00', '2026-07-14T09:51:34.823+00:00'),
('914ea45a-b713-4495-a03f-060158523b7a', '2cb02ded-84ba-4888-930e-3b306d0eba04', 'b770a8c7-fe92-477b-b49e-f985783e3ccd', '1', '7', '72b5a7a2-83c2-4e0b-b080-28f252bc3e6f', 480, '2026-07-14T09:51:26.234118+00:00', '2026-07-14T09:51:34.823+00:00'),
('d11a2612-eebb-4cd2-a6cb-052f4549dc35', '2cb02ded-84ba-4888-930e-3b306d0eba04', 'b770a8c7-fe92-477b-b49e-f985783e3ccd', '1', '7', '2455cd38-6a4a-48b0-8433-ac055bf367b6', 720, '2026-07-14T09:51:26.234118+00:00', '2026-07-14T09:51:34.823+00:00'),
('a8bb19dc-e3d1-4de5-8525-a9a29049aede', '40753de8-692e-4c3f-877c-560f47b5654a', 'dd8a7b02-151c-444c-b285-eed7db678921', '1', '1', 'f56ddf37-5857-454c-b95a-ce9d8100d15a', 60, '2026-08-27T12:39:05.477584+00:00', '2026-08-27T13:00:31.008+00:00'),
('8ba6eeeb-32a6-4c8c-bfd3-7f2b5fddf94d', '40753de8-692e-4c3f-877c-560f47b5654a', 'dd8a7b02-151c-444c-b285-eed7db678921', '1', '2', '93b5c63d-c80b-469c-9c8e-a738ecc10a35', 60, '2026-08-27T13:00:30.557036+00:00', '2026-08-27T13:00:31.008+00:00')
ON CONFLICT (id) DO UPDATE SET
  box_number = EXCLUDED.box_number,
  quantity = EXCLUDED.quantity,
  updated_at = EXCLUDED.updated_at;



-- ═══════════════════════════════════════════════════════════════════════════
-- 🚀 CENTRUM MES: Complete Production Schema for Staging (testbdkulytcya)
-- Adds all missing columns for orders, order_items, tasks, work_cards, material_requests
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. ORDERS
CREATE TABLE IF NOT EXISTS public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer text,
  order_num text,
  nomenclature_id uuid,
  quantity numeric DEFAULT 0,
  deadline timestamptz,
  accessories text,
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  customer_id uuid
);

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS order_date text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS official_customer text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS unit text DEFAULT 'шт';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS entered_by text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS responsible_person text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS actual_date timestamptz;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS source text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS report text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS invoice_num text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_id uuid;

-- 2. ORDER_ITEMS
CREATE TABLE IF NOT EXISTS public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
  nomenclature_id uuid,
  quantity numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- 3. TASKS
CREATE TABLE IF NOT EXISTS public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid,
  step text,
  status text DEFAULT 'new',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS operator_name text;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS good_qty numeric DEFAULT 0;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS scrap_qty numeric DEFAULT 0;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS started_at timestamptz;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS finished_at timestamptz;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS completed_at timestamptz;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS estimated_time numeric;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS scrap_data jsonb;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS engineer_conf boolean DEFAULT false;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS warehouse_conf text DEFAULT 'false';
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS machine_name text;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS director_conf boolean DEFAULT false;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS plan_snapshot jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS planned_deadline text;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS batch_index text;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS planned_sets numeric DEFAULT 0;

-- 4. WORK_CARDS
CREATE TABLE IF NOT EXISTS public.work_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid,
  status text DEFAULT 'new',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.work_cards ADD COLUMN IF NOT EXISTS order_id uuid;
ALTER TABLE public.work_cards ADD COLUMN IF NOT EXISTS operation text;
ALTER TABLE public.work_cards ADD COLUMN IF NOT EXISTS machine text;
ALTER TABLE public.work_cards ADD COLUMN IF NOT EXISTS estimated_time numeric DEFAULT 0;
ALTER TABLE public.work_cards ADD COLUMN IF NOT EXISTS started_at timestamptz;
ALTER TABLE public.work_cards ADD COLUMN IF NOT EXISTS completed_at timestamptz;
ALTER TABLE public.work_cards ADD COLUMN IF NOT EXISTS card_info text;
ALTER TABLE public.work_cards ADD COLUMN IF NOT EXISTS operator_name text;
ALTER TABLE public.work_cards ADD COLUMN IF NOT EXISTS nomenclature_id uuid;
ALTER TABLE public.work_cards ADD COLUMN IF NOT EXISTS quantity numeric DEFAULT 0;
ALTER TABLE public.work_cards ADD COLUMN IF NOT EXISTS is_rework boolean DEFAULT false;
ALTER TABLE public.work_cards ADD COLUMN IF NOT EXISTS machine_id text;
ALTER TABLE public.work_cards ADD COLUMN IF NOT EXISTS manager_name text;
ALTER TABLE public.work_cards ADD COLUMN IF NOT EXISTS shift_name text;
ALTER TABLE public.work_cards ADD COLUMN IF NOT EXISTS cutters_used numeric DEFAULT 0;
ALTER TABLE public.work_cards ADD COLUMN IF NOT EXISTS used_in_shop2_qty numeric DEFAULT 0;
ALTER TABLE public.work_cards ADD COLUMN IF NOT EXISTS galt_priority numeric DEFAULT 1;
ALTER TABLE public.work_cards ADD COLUMN IF NOT EXISTS box_number text;
ALTER TABLE public.work_cards ADD COLUMN IF NOT EXISTS is_box_prepared boolean DEFAULT false;

-- 5. MATERIAL_REQUESTS
CREATE TABLE IF NOT EXISTS public.material_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text DEFAULT 'pending',
  quantity numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.material_requests ADD COLUMN IF NOT EXISTS order_id uuid;
ALTER TABLE public.material_requests ADD COLUMN IF NOT EXISTS details text;
ALTER TABLE public.material_requests ADD COLUMN IF NOT EXISTS inventory_id uuid;
ALTER TABLE public.material_requests ADD COLUMN IF NOT EXISTS nomenclature_id uuid;
ALTER TABLE public.material_requests ADD COLUMN IF NOT EXISTS task_id uuid;
ALTER TABLE public.material_requests ADD COLUMN IF NOT EXISTS card_id uuid;
ALTER TABLE public.material_requests ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE public.material_requests ADD COLUMN IF NOT EXISTS target_warehouse text;

-- 6. RLS & PERMISSIONS
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staging_all_access_orders" ON public.orders;
CREATE POLICY "staging_all_access_orders" ON public.orders FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "staging_all_access_order_items" ON public.order_items;
CREATE POLICY "staging_all_access_order_items" ON public.order_items FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "staging_all_access_tasks" ON public.tasks;
CREATE POLICY "staging_all_access_tasks" ON public.tasks FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "staging_all_access_work_cards" ON public.work_cards;
CREATE POLICY "staging_all_access_work_cards" ON public.work_cards FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "staging_all_access_material_requests" ON public.material_requests;
CREATE POLICY "staging_all_access_material_requests" ON public.material_requests FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

GRANT ALL ON public.orders TO anon, authenticated, service_role;
GRANT ALL ON public.order_items TO anon, authenticated, service_role;
GRANT ALL ON public.tasks TO anon, authenticated, service_role;
GRANT ALL ON public.work_cards TO anon, authenticated, service_role;
GRANT ALL ON public.material_requests TO anon, authenticated, service_role;

-- 7. Realtime
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE 
    public.orders, 
    public.order_items, 
    public.tasks, 
    public.work_cards,
    public.material_requests;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
