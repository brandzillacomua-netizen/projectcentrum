-- ═══════════════════════════════════════════════════════════════════════════
-- 🚀 CENTRUM MES: Clean Modern Production Schema for Staging (testbdkulytcya)
-- Містить актуальну структуру станом на вересень 2026 (100% Relational ID Core)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Користувачі системи та права доступу
CREATE TABLE IF NOT EXISTS public.system_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  login text UNIQUE NOT NULL,
  password text,
  first_name text,
  last_name text,
  position text,
  department text,
  shift text,
  access_rights jsonb DEFAULT '{}'::jsonb,
  notification_settings jsonb DEFAULT '{}'::jsonb,
  avatar text,
  last_seen text,
  shift_calendar jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- 2. Контрагенти / Клієнти
CREATE TABLE IF NOT EXISTS public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  official_name text,
  company text,
  contact_person text,
  phone text,
  email text,
  tin text,
  edrpou text,
  city text,
  address text,
  manager text,
  segment text,
  status text DEFAULT 'active',
  notes text,
  delivery_method text,
  delivery_city text,
  delivery_warehouse text,
  delivery_address text,
  delivery_recipient_name text,
  delivery_recipient_phone text,
  is_legal_entity boolean DEFAULT false,
  legal_entity_name text,
  created_at timestamptz DEFAULT now()
);

-- 3. Номенклатура V2 (деталі, матеріали, фрези, фурнітура)
CREATE TABLE IF NOT EXISTS public.nomenclatures_v2 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  sku text,
  group_id text NOT NULL,
  rule_type text,
  default_material_id uuid REFERENCES public.nomenclatures_v2(id) ON DELETE SET NULL,
  rule_params jsonb DEFAULT '{}'::jsonb,
  legacy_ids jsonb DEFAULT '[]'::jsonb,
  is_active boolean DEFAULT true,
  unit text DEFAULT 'шт',
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nomenclatures_v2_default_material_id ON public.nomenclatures_v2(default_material_id);
CREATE INDEX IF NOT EXISTS idx_nomenclatures_v2_group_id ON public.nomenclatures_v2(group_id);

-- 4. Специфікація BOM (Bill of Materials)
CREATE TABLE IF NOT EXISTS public.bom_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid REFERENCES public.nomenclatures_v2(id) ON DELETE CASCADE,
  child_id uuid REFERENCES public.nomenclatures_v2(id) ON DELETE RESTRICT,
  quantity numeric NOT NULL DEFAULT 1,
  unit text DEFAULT 'шт',
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bom_items_parent_id ON public.bom_items(parent_id);
CREATE INDEX IF NOT EXISTS idx_bom_items_child_id ON public.bom_items(child_id);

-- 5. Замовлення (Orders)
CREATE TABLE IF NOT EXISTS public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_num text NOT NULL,
  customer text,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  nomenclature_id uuid REFERENCES public.nomenclatures_v2(id) ON DELETE SET NULL,
  quantity bigint NOT NULL DEFAULT 1,
  deadline text,
  accessories text,
  status text DEFAULT 'in-progress',
  order_info jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON public.orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_order_num ON public.orders(order_num);

-- 6. Технологічні завдання (Tasks)
CREATE TABLE IF NOT EXISTS public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
  nomenclature_id uuid REFERENCES public.nomenclatures_v2(id) ON DELETE SET NULL,
  step text NOT NULL,
  status text DEFAULT 'waiting',
  assigned_machine text,
  machine_id text,
  planned_quantity bigint DEFAULT 0,
  completed_quantity bigint DEFAULT 0,
  task_info jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tasks_order_id ON public.tasks(order_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);

-- 7. Виробничі картки (Work Cards)
CREATE TABLE IF NOT EXISTS public.work_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE,
  nomenclature_id uuid REFERENCES public.nomenclatures_v2(id) ON DELETE SET NULL,
  quantity bigint NOT NULL DEFAULT 1,
  status text DEFAULT 'created',
  box_number text,
  is_box_prepared boolean NOT NULL DEFAULT false,
  card_info text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_work_cards_task_id ON public.work_cards(task_id);
CREATE INDEX IF NOT EXISTS idx_work_cards_is_box_prepared ON public.work_cards(is_box_prepared);
CREATE INDEX IF NOT EXISTS idx_work_cards_status ON public.work_cards(status);

-- 8. Історія переходів карток (Work Card History)
CREATE TABLE IF NOT EXISTS public.work_card_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid REFERENCES public.work_cards(id) ON DELETE CASCADE,
  nomenclature_id uuid,
  stage_name text,
  operator_name text,
  qty_at_start bigint,
  qty_completed bigint,
  scrap_qty bigint,
  started_at text,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  is_archived_scrap boolean,
  machine text,
  machine_id uuid,
  manager_name text,
  shift_name text,
  machine_name text,
  cutters_used bigint,
  qc_scrap_reason text,
  qc_scrap_comment text,
  galt_priority bigint,
  card_info text,
  task_id uuid
);

CREATE INDEX IF NOT EXISTS idx_work_card_history_card_id ON public.work_card_history(card_id);

-- 9. Складські запити матеріалів (Material Requests)
CREATE TABLE IF NOT EXISTS public.material_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE,
  card_id uuid REFERENCES public.work_cards(id) ON DELETE SET NULL,
  nomenclature_id uuid REFERENCES public.nomenclatures_v2(id) ON DELETE SET NULL,
  quantity numeric NOT NULL DEFAULT 1,
  category text,
  target_warehouse text DEFAULT 'operational',
  status text DEFAULT 'pending',
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_material_requests_task_id ON public.material_requests(task_id);
CREATE INDEX IF NOT EXISTS idx_material_requests_category_wh ON public.material_requests(target_warehouse, category);

-- 10. Залишки на складі (Inventory Stock V2)
CREATE TABLE IF NOT EXISTS public.inventory_stock_v2 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nomenclature_id uuid REFERENCES public.nomenclatures_v2(id) ON DELETE CASCADE,
  warehouse text NOT NULL DEFAULT 'sgp',
  quantity numeric NOT NULL DEFAULT 0,
  reserved_quantity numeric NOT NULL DEFAULT 0,
  unit text DEFAULT 'шт',
  location text,
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inventory_stock_v2_nom_wh ON public.inventory_stock_v2(nomenclature_id, warehouse);

-- 11. Пермісивна RLS для початкового старту (підготовка до включення безпеки)
ALTER TABLE public.system_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nomenclatures_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bom_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_card_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_stock_v2 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staging_all_access_system_users" ON public.system_users FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "staging_all_access_customers" ON public.customers FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "staging_all_access_nomenclatures_v2" ON public.nomenclatures_v2 FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "staging_all_access_bom_items" ON public.bom_items FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "staging_all_access_orders" ON public.orders FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "staging_all_access_tasks" ON public.tasks FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "staging_all_access_work_cards" ON public.work_cards FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "staging_all_access_work_card_history" ON public.work_card_history FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "staging_all_access_material_requests" ON public.material_requests FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "staging_all_access_inventory_stock_v2" ON public.inventory_stock_v2 FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 12. Публікація в Realtime (щоб планшети миттєво бачили оновлення)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE 
    public.orders, 
    public.tasks, 
    public.work_cards, 
    public.material_requests, 
    public.inventory_stock_v2;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;
