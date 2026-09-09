-- ═══════════════════════════════════════════════════════════════════════════
-- BASE TABLES DDL GENERATED FROM PRODUCTION SCHEMA
-- ═══════════════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.system_users (
  id uuid primary key default gen_random_uuid(),
  "login" text,
  "password" text,
  "first_name" text,
  "last_name" text,
  "position" text,
  "access_rights" jsonb,
  "created_at" timestamptz,
  "department" text,
  "shift" text,
  "notification_settings" jsonb,
  "avatar" text,
  "last_seen" text,
  "shift_calendar" jsonb
);

ALTER TABLE public.system_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staging_permissive_access" ON public.system_users;
CREATE POLICY "staging_permissive_access" ON public.system_users FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.customers (
  id uuid primary key default gen_random_uuid(),
  "name" text,
  "official_name" text,
  "created_at" timestamptz,
  "company" text,
  "contact_person" text,
  "phone" text,
  "email" text,
  "tin" text,
  "edrpou" text,
  "city" text,
  "address" text,
  "manager" text,
  "segment" text,
  "status" text,
  "notes" text,
  "delivery_method" text,
  "delivery_city" text,
  "delivery_warehouse" text,
  "delivery_address" text,
  "delivery_recipient_name" text,
  "delivery_recipient_phone" text,
  "is_legal_entity" boolean,
  "legal_entity_name" text
);

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staging_permissive_access" ON public.customers;
CREATE POLICY "staging_permissive_access" ON public.customers FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.management_tasks (
  id uuid primary key default gen_random_uuid(),
  "title" text,
  "description" text,
  "status" text,
  "priority" text,
  "created_at" timestamptz,
  "deadline" timestamptz,
  "created_by" text,
  "assigned_to" text,
  "is_collective" boolean,
  "department" text,
  "tags" jsonb,
  "checklist" jsonb,
  "color" text,
  "assignees" jsonb,
  "project_id" uuid
);

ALTER TABLE public.management_tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staging_permissive_access" ON public.management_tasks;
CREATE POLICY "staging_permissive_access" ON public.management_tasks FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.task_projects (
  id uuid primary key default gen_random_uuid(),
  "name" text,
  "description" text,
  "color" text,
  "status" text,
  "member_logins" jsonb,
  "department_ids" jsonb,
  "created_by" text,
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "columns" jsonb
);

ALTER TABLE public.task_projects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staging_permissive_access" ON public.task_projects;
CREATE POLICY "staging_permissive_access" ON public.task_projects FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.orders (
  id uuid primary key default gen_random_uuid(),
  "customer" text,
  "order_num" text,
  "nomenclature_id" uuid,
  "quantity" bigint,
  "deadline" text,
  "accessories" text,
  "status" text,
  "created_at" timestamptz,
  "order_date" text,
  "official_customer" text,
  "unit" text,
  "entered_by" text,
  "responsible_person" text,
  "actual_date" text,
  "source" text,
  "report" text,
  "invoice_num" text,
  "customer_id" uuid
);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staging_permissive_access" ON public.orders;
CREATE POLICY "staging_permissive_access" ON public.orders FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.tasks (
  id uuid primary key default gen_random_uuid(),
  "order_id" uuid,
  "step" text,
  "operator_name" text,
  "status" text,
  "good_qty" bigint,
  "scrap_qty" bigint,
  "started_at" text,
  "finished_at" text,
  "created_at" timestamptz,
  "completed_at" timestamptz,
  "estimated_time" bigint,
  "scrap_data" text,
  "engineer_conf" boolean,
  "warehouse_conf" text,
  "machine_name" text,
  "director_conf" boolean,
  "plan_snapshot" jsonb,
  "planned_deadline" timestamptz,
  "batch_index" text,
  "planned_sets" bigint
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staging_permissive_access" ON public.tasks;
CREATE POLICY "staging_permissive_access" ON public.tasks FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.work_cards (
  id uuid primary key default gen_random_uuid(),
  "task_id" uuid,
  "order_id" uuid,
  "operation" text,
  "machine" text,
  "status" text,
  "estimated_time" bigint,
  "started_at" timestamptz,
  "completed_at" timestamptz,
  "created_at" timestamptz,
  "card_info" text,
  "operator_name" text,
  "nomenclature_id" uuid,
  "quantity" bigint,
  "is_rework" boolean,
  "machine_id" uuid,
  "manager_name" text,
  "shift_name" text,
  "cutters_used" bigint,
  "used_in_shop2_qty" bigint,
  "galt_priority" bigint,
  "box_number" text,
  "is_box_prepared" boolean
);

ALTER TABLE public.work_cards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staging_permissive_access" ON public.work_cards;
CREATE POLICY "staging_permissive_access" ON public.work_cards FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.work_card_history (
  id uuid primary key default gen_random_uuid(),
  "card_id" uuid,
  "nomenclature_id" uuid,
  "stage_name" text,
  "operator_name" text,
  "qty_at_start" bigint,
  "qty_completed" bigint,
  "scrap_qty" bigint,
  "started_at" text,
  "completed_at" timestamptz,
  "created_at" timestamptz,
  "is_archived_scrap" boolean,
  "machine" text,
  "machine_id" uuid,
  "manager_name" text,
  "shift_name" text,
  "machine_name" text,
  "cutters_used" bigint,
  "qc_scrap_reason" text,
  "qc_scrap_comment" text,
  "galt_priority" bigint,
  "card_info" text,
  "task_id" uuid
);

ALTER TABLE public.work_card_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staging_permissive_access" ON public.work_card_history;
CREATE POLICY "staging_permissive_access" ON public.work_card_history FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.nomenclatures (
  id uuid primary key default gen_random_uuid(),
  "name" text,
  "material_rate" bigint,
  "time_rate" bigint,
  "created_at" timestamptz,
  "units_per_sheet" bigint,
  "time_per_unit" bigint,
  "material_type" text,
  "cnc_program" text,
  "type" text,
  "consumption_per_sheet" bigint,
  "characteristic" text,
  "description" text,
  "qty_per_unit" bigint,
  "option_label" text,
  "color" text,
  "additional_info" text,
  "unit" text
);

ALTER TABLE public.nomenclatures ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staging_permissive_access" ON public.nomenclatures;
CREATE POLICY "staging_permissive_access" ON public.nomenclatures FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.nomenclatures_v2 (
  id uuid primary key default gen_random_uuid(),
  "code" text,
  "name" text,
  "group_id" uuid,
  "unit" text,
  "rule_type" text,
  "rule_params" jsonb,
  "status" text,
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "default_material_id" uuid,
  "barcode" text,
  "qr_code" text
);

ALTER TABLE public.nomenclatures_v2 ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staging_permissive_access" ON public.nomenclatures_v2;
CREATE POLICY "staging_permissive_access" ON public.nomenclatures_v2 FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.bom_items (
  id uuid primary key default gen_random_uuid(),
  "parent_id" uuid,
  "child_id" uuid,
  "quantity_per_parent" bigint,
  "created_at" timestamptz,
  "group_label" text
);

ALTER TABLE public.bom_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staging_permissive_access" ON public.bom_items;
CREATE POLICY "staging_permissive_access" ON public.bom_items FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.material_requests (
  id uuid primary key default gen_random_uuid(),
  "order_id" uuid,
  "details" text,
  "status" text,
  "created_at" timestamptz,
  "inventory_id" uuid,
  "quantity" bigint,
  "nomenclature_id" uuid,
  "task_id" uuid,
  "card_id" uuid,
  "category" text,
  "target_warehouse" text
);

ALTER TABLE public.material_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staging_permissive_access" ON public.material_requests;
CREATE POLICY "staging_permissive_access" ON public.material_requests FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.purchase_requests (
  id uuid primary key default gen_random_uuid(),
  "order_id" uuid,
  "order_num" text,
  "items" jsonb,
  "status" text,
  "created_at" timestamptz,
  "destination_warehouse" text,
  "task_id" uuid
);

ALTER TABLE public.purchase_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staging_permissive_access" ON public.purchase_requests;
CREATE POLICY "staging_permissive_access" ON public.purchase_requests FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.reception_docs (
  id uuid primary key default gen_random_uuid(),
  "created_at" timestamptz,
  "items" jsonb,
  "status" text,
  "order_id" uuid,
  "task_id" uuid,
  "target_warehouse" text,
  "source_warehouse" text,
  "pocket_owner" text
);

ALTER TABLE public.reception_docs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staging_permissive_access" ON public.reception_docs;
CREATE POLICY "staging_permissive_access" ON public.reception_docs FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  "thread_id" uuid,
  "sender_id" uuid,
  "sender_login" text,
  "sender_name" text,
  "body" text,
  "attachment_url" text,
  "attachment_path" text,
  "attachment_type" text,
  "attachment_name" text,
  "attachment_size" bigint,
  "image_width" bigint,
  "image_height" bigint,
  "created_at" timestamptz,
  "edited_at" text,
  "deleted_at" text
);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staging_permissive_access" ON public.chat_messages;
CREATE POLICY "staging_permissive_access" ON public.chat_messages FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

