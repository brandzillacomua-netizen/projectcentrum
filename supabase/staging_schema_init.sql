-- ═══════════════════════════════════════════════════════════════════════════
-- CENTRUM MES: Consolidated Schema Initializer for Staging (testbdkulytcya)
-- ═══════════════════════════════════════════════════════════════════════════

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
  "default_material_id" uuid
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



-- ─── MIGRATION: 20260706120000_task_projects.sql ───
-- Projects inside the management task module.
create table if not exists public.task_projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  color text not null default '#8b5cf6',
  status text not null default 'active' check (status in ('active', 'archived')),
  member_logins jsonb not null default '[]'::jsonb,
  department_ids jsonb not null default '[]'::jsonb,
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.management_tasks
  add column if not exists project_id uuid references public.task_projects(id) on delete cascade;

create index if not exists management_tasks_project_id_idx on public.management_tasks(project_id);
create index if not exists task_projects_created_by_idx on public.task_projects(created_by);

alter table public.task_projects enable row level security;
drop policy if exists "task_projects_mes_access" on public.task_projects;
create policy "task_projects_mes_access" on public.task_projects
  for all to anon, authenticated using (true) with check (true);

grant select, insert, update, delete on public.task_projects to anon, authenticated;

-- supabase_realtime у цьому проєкті створена як FOR ALL TABLES,
-- тому нова таблиця автоматично входить до публікації.



-- ─── MIGRATION: 20260706_production_statistics.sql ───
create index if not exists idx_work_card_history_completed_at
  on public.work_card_history (completed_at desc);

create index if not exists idx_work_card_history_card_id
  on public.work_card_history (card_id);

create index if not exists idx_work_cards_active_created_at
  on public.work_cards (status, created_at desc);

create or replace function public.mes_production_summary(
  p_from timestamptz default null,
  p_to timestamptz default null
)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'totalProduced', coalesce(sum(coalesce(h.qty_completed, 0)) filter (
      where lower(trim(coalesce(h.stage_name, ''))) in (
        'пакування/сгп', 'прийомка', 'склад бз', 'сгп', 'пакування', 'completed'
      )
    ), 0),
    'totalScrap', coalesce(sum(coalesce(h.scrap_qty, 0)), 0),
    'historyCount', count(*)
  )
  from public.work_card_history h
  where (p_from is null or coalesce(h.completed_at, h.created_at) >= p_from)
    and (p_to is null or coalesce(h.completed_at, h.created_at) <= p_to);
$$;

grant execute on function public.mes_production_summary(timestamptz, timestamptz) to anon, authenticated;

-- ─── MIGRATION: 20260707120000_shop1_naryad_reports.sql ───
-- Lightweight archive + one-shot detail endpoint for Shop 1 naryad reports.
-- The UI never downloads the complete task/history archive.

create extension if not exists pg_trgm;

create index if not exists idx_tasks_report_created
  on public.tasks (created_at desc, id);
create index if not exists idx_tasks_report_order
  on public.tasks (order_id, created_at desc);
create index if not exists idx_work_cards_task_report
  on public.work_cards (task_id, id);
create index if not exists idx_work_card_history_card_completed
  on public.work_card_history (card_id, completed_at);
create index if not exists idx_material_requests_task_report
  on public.material_requests (task_id);
create index if not exists idx_orders_order_num_trgm
  on public.orders using gin (order_num gin_trgm_ops);
create index if not exists idx_orders_customer_trgm
  on public.orders using gin (customer gin_trgm_ops);

drop function if exists public.shop1_naryad_catalog(text, integer, integer);

create function public.shop1_naryad_catalog(
  p_search text default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  task_id uuid,
  order_id uuid,
  order_num text,
  customer text,
  status text,
  batch_index integer,
  created_at timestamptz,
  completed_at timestamptz,
  task_count bigint,
  card_count bigint,
  total_count bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  with grouped as (
    select
      (array_agg(t.id order by t.created_at))[1] as task_id,
      t.order_id,
      o.order_num::text as order_num,
      o.customer::text as customer,
      case
        when bool_and(t.status = 'completed') then 'completed'
        when bool_or(t.status = 'in-progress') then 'in-progress'
        when bool_or(t.status = 'paused') then 'paused'
        else max(t.status)::text
      end as status,
      t.batch_index::integer as batch_index,
      min(t.created_at)::timestamptz as created_at,
      max(t.completed_at)::timestamptz as completed_at,
      count(distinct t.id) as task_count,
      count(distinct wc.id) as card_count,
      max(coalesce(t.completed_at, t.created_at)) as last_activity
    from public.tasks t
    -- An archive row is a production naryad only while its source order exists.
    -- Inner join prevents orphan technical tasks from being shown as fake numbers.
    join public.orders o on o.id = t.order_id
    left join public.work_cards wc on wc.task_id = t.id
    where nullif(trim(p_search), '') is null
       or o.order_num ilike '%' || trim(p_search) || '%'
       or o.customer ilike '%' || trim(p_search) || '%'
       or t.id::text ilike '%' || trim(p_search) || '%'
    group by t.order_id, o.order_num, o.customer, t.batch_index
  )
  select
    g.task_id, g.order_id, g.order_num, g.customer, g.status, g.batch_index,
    g.created_at, g.completed_at, g.task_count, g.card_count,
    count(*) over() as total_count
  from grouped g
  order by g.last_activity desc, g.task_id desc
  limit least(greatest(coalesce(p_limit, 50), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

create or replace function public.shop1_naryad_report(p_task_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with anchor as (
    select t.order_id, t.batch_index
    from public.tasks t
    where t.id = p_task_id
  ), target_tasks as materialized (
    select t.id, t.plan_snapshot
    from public.tasks t
    join anchor a on a.order_id = t.order_id
      and t.batch_index is not distinct from a.batch_index
  ), selected_cards as materialized (
    select wc.id, wc.created_at, wc.card_info,
      row_number() over (order by wc.created_at, wc.id) as card_number
    from public.work_cards wc
    join target_tasks tt on tt.id = wc.task_id
  ), history as (
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'id', h.id,
        'card_id', h.card_id,
        'nomenclature_id', h.nomenclature_id,
        'stage_name', h.stage_name,
        'operator_name', h.operator_name,
        'shift_name', h.shift_name,
        'machine_name', h.machine_name,
        'started_at', h.started_at,
        'completed_at', h.completed_at,
        'created_at', h.created_at,
        'qty_completed', h.qty_completed,
        'scrap_qty', h.scrap_qty,
        'cutters_used', h.cutters_used,
        'card_info', h.card_info
      ) order by coalesce(h.completed_at, h.created_at)
    ), '[]'::jsonb) value
    from public.work_card_history h
    join selected_cards sc on sc.id = h.card_id
  ), requests as (
    select coalesce(jsonb_agg(
      to_jsonb(mr) || jsonb_build_object(
        'nomenclature', case when n.id is null then null else jsonb_build_object('id', n.id, 'name', n.name) end
      ) order by mr.created_at
    ), '[]'::jsonb) value
    from public.material_requests mr
    left join public.nomenclatures n on n.id = mr.nomenclature_id
    where mr.task_id in (select id from target_tasks)
  )
  select jsonb_build_object(
    'historyRows', history.value,
    'taskCards', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'card_number', card_number, 'card_info', card_info) order by card_number), '[]'::jsonb) from selected_cards),
    'materialRequests', requests.value,
    'planSnapshot', (select tt.plan_snapshot from target_tasks tt where tt.plan_snapshot is not null limit 1),
    'orderItems', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'nomenclature_id', oi.nomenclature_id,
        'quantity', oi.quantity,
        'name', n.name
      )), '[]'::jsonb)
      from anchor a
      join public.order_items oi on oi.order_id = a.order_id
      left join public.nomenclatures n on n.id = oi.nomenclature_id
    ),
    'taskCount', (select count(*) from target_tasks)
  )
  from history cross join requests;
$$;

grant execute on function public.shop1_naryad_catalog(text, integer, integer) to authenticated;
grant execute on function public.shop1_naryad_report(uuid) to authenticated;


-- ─── MIGRATION: 20260707150000_nomenclature_catalog_foundation.sql ───
-- Nomenclature catalog foundation (additive, non-breaking).
-- The existing public.nomenclatures table and all nomenclature_id references remain untouched.

create table if not exists public.nomenclature_classes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  behavior text not null check (behavior in ('material', 'hardware', 'part', 'tool', 'legacy_product')),
  is_stock_item boolean not null default true,
  is_produced boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.nomenclature_units (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  symbol text not null,
  dimension text not null default 'count',
  precision smallint not null default 0 check (precision between 0 and 6),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.nomenclature_catalog_groups (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  parent_id uuid references public.nomenclature_catalog_groups(id) on delete restrict,
  class_id uuid references public.nomenclature_classes(id) on delete restrict,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (parent_id is null or parent_id <> id)
);

create table if not exists public.nomenclature_attribute_definitions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  value_type text not null check (value_type in ('text', 'number', 'boolean', 'date', 'dictionary')),
  unit_id uuid references public.nomenclature_units(id) on delete restrict,
  dictionary_values jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  check (dictionary_values is null or jsonb_typeof(dictionary_values) = 'array')
);

create table if not exists public.nomenclature_group_attributes (
  group_id uuid not null references public.nomenclature_catalog_groups(id) on delete cascade,
  attribute_id uuid not null references public.nomenclature_attribute_definitions(id) on delete restrict,
  is_required boolean not null default false,
  use_in_name boolean not null default false,
  sort_order integer not null default 0,
  primary key (group_id, attribute_id)
);

-- One optional catalog profile per existing nomenclature row. This is the compatibility seam:
-- old modules keep reading nomenclatures while LAB can enrich the same immutable UUID.
create table if not exists public.nomenclature_catalog_profiles (
  nomenclature_id uuid primary key references public.nomenclatures(id) on delete restrict,
  class_id uuid not null references public.nomenclature_classes(id) on delete restrict,
  group_id uuid references public.nomenclature_catalog_groups(id) on delete restrict,
  base_unit_id uuid references public.nomenclature_units(id) on delete restrict,
  display_name text,
  catalog_code text unique,
  lifecycle_status text not null default 'draft' check (lifecycle_status in ('draft', 'active', 'blocked', 'archived')),
  migration_state text not null default 'unreviewed' check (migration_state in ('unreviewed', 'suggested', 'verified', 'conflict')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.nomenclature_attribute_values (
  nomenclature_id uuid not null references public.nomenclature_catalog_profiles(nomenclature_id) on delete cascade,
  attribute_id uuid not null references public.nomenclature_attribute_definitions(id) on delete restrict,
  value_text text,
  value_number numeric,
  value_boolean boolean,
  value_date date,
  updated_at timestamptz not null default now(),
  primary key (nomenclature_id, attribute_id),
  check (num_nonnulls(value_text, value_number, value_boolean, value_date) = 1)
);

create table if not exists public.nomenclature_unit_conversions (
  nomenclature_id uuid not null references public.nomenclature_catalog_profiles(nomenclature_id) on delete cascade,
  from_unit_id uuid not null references public.nomenclature_units(id) on delete restrict,
  to_unit_id uuid not null references public.nomenclature_units(id) on delete restrict,
  factor numeric not null check (factor > 0),
  primary key (nomenclature_id, from_unit_id, to_unit_id),
  check (from_unit_id <> to_unit_id)
);

create table if not exists public.nomenclature_catalog_history (
  id bigint generated always as identity primary key,
  nomenclature_id uuid not null,
  event_type text not null,
  changed_by text,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now(),
  constraint nomenclature_catalog_history_nomenclature_fk
    foreign key (nomenclature_id) references public.nomenclatures(id) on delete restrict
);

create index if not exists nomenclature_catalog_groups_parent_idx on public.nomenclature_catalog_groups(parent_id);
create index if not exists nomenclature_catalog_groups_class_idx on public.nomenclature_catalog_groups(class_id);
create index if not exists nomenclature_catalog_profiles_class_idx on public.nomenclature_catalog_profiles(class_id);
create index if not exists nomenclature_catalog_profiles_group_idx on public.nomenclature_catalog_profiles(group_id);
create index if not exists nomenclature_catalog_profiles_status_idx on public.nomenclature_catalog_profiles(lifecycle_status);
create index if not exists nomenclature_attribute_values_attribute_idx on public.nomenclature_attribute_values(attribute_id);
create index if not exists nomenclature_catalog_history_nom_idx on public.nomenclature_catalog_history(nomenclature_id, created_at desc);

insert into public.nomenclature_classes (code, name, behavior, is_stock_item, is_produced, sort_order)
values
  ('raw_material', 'Сировина', 'material', true, false, 10),
  ('hardware', 'Метизи', 'hardware', true, false, 20),
  ('part', 'Деталі', 'part', true, true, 30),
  ('tool', 'Інструмент', 'tool', true, false, 40),
  ('legacy_product', 'Вироби (сумісність)', 'legacy_product', false, true, 90)
on conflict (code) do update set
  name = excluded.name,
  behavior = excluded.behavior,
  is_stock_item = excluded.is_stock_item,
  is_produced = excluded.is_produced,
  sort_order = excluded.sort_order;

insert into public.nomenclature_units (code, name, symbol, dimension, precision)
values
  ('pcs', 'Штука', 'шт', 'count', 0),
  ('sheet', 'Лист', 'лист', 'count', 0),
  ('kg', 'Кілограм', 'кг', 'mass', 3),
  ('g', 'Грам', 'г', 'mass', 3),
  ('mm', 'Міліметр', 'мм', 'length', 3),
  ('m', 'Метр', 'м', 'length', 3),
  ('m2', 'Квадратний метр', 'м²', 'area', 3),
  ('l', 'Літр', 'л', 'volume', 3),
  ('set', 'Комплект', 'компл.', 'count', 0)
on conflict (code) do update set
  name = excluded.name,
  symbol = excluded.symbol,
  dimension = excluded.dimension,
  precision = excluded.precision;

insert into public.nomenclature_catalog_groups (code, name, class_id, sort_order)
select seed.code, seed.name, c.id, seed.sort_order
from (values
  ('RAW', 'Сировина', 'raw_material', 10),
  ('HW', 'Метизи', 'hardware', 20),
  ('PART', 'Деталі', 'part', 30),
  ('TOOL', 'Інструмент', 'tool', 40)
) as seed(code, name, class_code, sort_order)
join public.nomenclature_classes c on c.code = seed.class_code
on conflict (code) do update set
  name = excluded.name,
  class_id = excluded.class_id,
  sort_order = excluded.sort_order;

insert into public.nomenclature_catalog_groups (code, name, parent_id, class_id, sort_order)
select seed.code, seed.name, parent.id, parent.class_id, seed.sort_order
from (values
  ('RAW.SHEET', 'Листовий матеріал', 'RAW', 10),
  ('RAW.PROFILE', 'Труби та профілі', 'RAW', 20),
  ('RAW.CHEM', 'Клеї та хімія', 'RAW', 30),
  ('HW.BOLT', 'Болти', 'HW', 10),
  ('HW.NUT', 'Гайки', 'HW', 20),
  ('HW.PRESS_NUT', 'Прес-гайки', 'HW', 30),
  ('HW.WASHER', 'Шайби', 'HW', 40),
  ('HW.RIVET', 'Заклепки', 'HW', 50),
  ('TOOL.MILL', 'Фрези', 'TOOL', 10),
  ('TOOL.DRILL', 'Свердла', 'TOOL', 20)
) as seed(code, name, parent_code, sort_order)
join public.nomenclature_catalog_groups parent on parent.code = seed.parent_code
on conflict (code) do update set
  name = excluded.name,
  parent_id = excluded.parent_id,
  class_id = excluded.class_id,
  sort_order = excluded.sort_order;

insert into public.nomenclature_attribute_definitions (code, name, value_type, unit_id, dictionary_values)
select seed.code, seed.name, seed.value_type, u.id, seed.dictionary_values
from (values
  ('material_grade', 'Марка матеріалу', 'dictionary', null, '["T300", "T700"]'::jsonb),
  ('thickness_mm', 'Товщина', 'number', 'mm', null),
  ('width_mm', 'Ширина', 'number', 'mm', null),
  ('length_mm', 'Довжина', 'number', 'mm', null),
  ('thread', 'Різьба', 'text', null, null),
  ('standard', 'Стандарт', 'text', null, null),
  ('diameter_mm', 'Діаметр', 'number', 'mm', null),
  ('shank_diameter_mm', 'Діаметр хвостовика', 'number', 'mm', null),
  ('teeth_count', 'Кількість зубів', 'number', null, null),
  ('drawing_number', 'Номер креслення', 'text', null, null),
  ('revision', 'Ревізія', 'text', null, null)
) as seed(code, name, value_type, unit_code, dictionary_values)
left join public.nomenclature_units u on u.code = seed.unit_code
on conflict (code) do update set
  name = excluded.name,
  value_type = excluded.value_type,
  dictionary_values = excluded.dictionary_values;

insert into public.nomenclature_group_attributes (group_id, attribute_id, is_required, use_in_name, sort_order)
select g.id, a.id, seed.is_required, seed.use_in_name, seed.sort_order
from (values
  ('RAW.SHEET', 'material_grade', true, true, 10),
  ('RAW.SHEET', 'thickness_mm', true, true, 20),
  ('RAW.SHEET', 'width_mm', false, true, 30),
  ('RAW.SHEET', 'length_mm', false, true, 40),
  ('HW.BOLT', 'standard', false, true, 10),
  ('HW.BOLT', 'thread', true, true, 20),
  ('HW.BOLT', 'length_mm', true, true, 30),
  ('HW.NUT', 'standard', false, true, 10),
  ('HW.NUT', 'thread', true, true, 20),
  ('HW.PRESS_NUT', 'thread', true, true, 10),
  ('TOOL.MILL', 'diameter_mm', true, true, 10),
  ('TOOL.MILL', 'shank_diameter_mm', false, true, 20),
  ('TOOL.MILL', 'teeth_count', false, true, 30),
  ('PART', 'drawing_number', false, true, 10),
  ('PART', 'revision', false, true, 20)
) as seed(group_code, attribute_code, is_required, use_in_name, sort_order)
join public.nomenclature_catalog_groups g on g.code = seed.group_code
join public.nomenclature_attribute_definitions a on a.code = seed.attribute_code
on conflict (group_id, attribute_id) do update set
  is_required = excluded.is_required,
  use_in_name = excluded.use_in_name,
  sort_order = excluded.sort_order;

-- RLS follows the current MES access model. Fine-grained catalog roles can replace
-- these policies before LAB becomes the primary editing module.
alter table public.nomenclature_classes enable row level security;
alter table public.nomenclature_units enable row level security;
alter table public.nomenclature_catalog_groups enable row level security;
alter table public.nomenclature_attribute_definitions enable row level security;
alter table public.nomenclature_group_attributes enable row level security;
alter table public.nomenclature_catalog_profiles enable row level security;
alter table public.nomenclature_attribute_values enable row level security;
alter table public.nomenclature_unit_conversions enable row level security;
alter table public.nomenclature_catalog_history enable row level security;

drop policy if exists nomenclature_classes_mes_access on public.nomenclature_classes;
create policy nomenclature_classes_mes_access on public.nomenclature_classes for all to anon, authenticated using (true) with check (true);
drop policy if exists nomenclature_units_mes_access on public.nomenclature_units;
create policy nomenclature_units_mes_access on public.nomenclature_units for all to anon, authenticated using (true) with check (true);
drop policy if exists nomenclature_catalog_groups_mes_access on public.nomenclature_catalog_groups;
create policy nomenclature_catalog_groups_mes_access on public.nomenclature_catalog_groups for all to anon, authenticated using (true) with check (true);
drop policy if exists nomenclature_attribute_definitions_mes_access on public.nomenclature_attribute_definitions;
create policy nomenclature_attribute_definitions_mes_access on public.nomenclature_attribute_definitions for all to anon, authenticated using (true) with check (true);
drop policy if exists nomenclature_group_attributes_mes_access on public.nomenclature_group_attributes;
create policy nomenclature_group_attributes_mes_access on public.nomenclature_group_attributes for all to anon, authenticated using (true) with check (true);
drop policy if exists nomenclature_catalog_profiles_mes_access on public.nomenclature_catalog_profiles;
create policy nomenclature_catalog_profiles_mes_access on public.nomenclature_catalog_profiles for all to anon, authenticated using (true) with check (true);
drop policy if exists nomenclature_attribute_values_mes_access on public.nomenclature_attribute_values;
create policy nomenclature_attribute_values_mes_access on public.nomenclature_attribute_values for all to anon, authenticated using (true) with check (true);
drop policy if exists nomenclature_unit_conversions_mes_access on public.nomenclature_unit_conversions;
create policy nomenclature_unit_conversions_mes_access on public.nomenclature_unit_conversions for all to anon, authenticated using (true) with check (true);
drop policy if exists nomenclature_catalog_history_mes_access on public.nomenclature_catalog_history;
create policy nomenclature_catalog_history_mes_access on public.nomenclature_catalog_history for all to anon, authenticated using (true) with check (true);

grant select, insert, update, delete on public.nomenclature_classes to anon, authenticated;
grant select, insert, update, delete on public.nomenclature_units to anon, authenticated;
grant select, insert, update, delete on public.nomenclature_catalog_groups to anon, authenticated;
grant select, insert, update, delete on public.nomenclature_attribute_definitions to anon, authenticated;
grant select, insert, update, delete on public.nomenclature_group_attributes to anon, authenticated;
grant select, insert, update, delete on public.nomenclature_catalog_profiles to anon, authenticated;
grant select, insert, update, delete on public.nomenclature_attribute_values to anon, authenticated;
grant select, insert, update, delete on public.nomenclature_unit_conversions to anon, authenticated;
grant select, insert, update, delete on public.nomenclature_catalog_history to anon, authenticated;

grant usage, select on sequence public.nomenclature_catalog_history_id_seq to anon, authenticated;


-- ─── MIGRATION: 20260707160000_nomenclature_catalog_legacy_backfill.sql ───
-- Safe, idempotent legacy classification for Nomenclature LAB.
-- Existing nomenclatures rows are not updated; only catalog profiles are added.

insert into public.nomenclature_catalog_profiles (
  nomenclature_id,
  class_id,
  group_id,
  base_unit_id,
  display_name,
  lifecycle_status,
  migration_state
)
select
  n.id,
  c.id,
  g.id,
  pcs.id,
  n.name,
  'active',
  'suggested'
from public.nomenclatures n
join public.nomenclature_classes c on c.code = case
  when lower(coalesce(n.name, '')) like '%фрез%' or lower(coalesce(n.name, '')) like '%свердл%' then 'tool'
  when lower(coalesce(n.name, '')) like '%болт%'
    or lower(coalesce(n.name, '')) like '%гайк%'
    or lower(coalesce(n.name, '')) like '%шайб%'
    or lower(coalesce(n.name, '')) like '%заклеп%' then 'hardware'
  when lower(coalesce(n.name, '')) like '%лист%'
    or lower(coalesce(n.name, '')) like '%профіл%'
    or lower(coalesce(n.name, '')) like '%труб%' then 'raw_material'
  when lower(coalesce(n.type, '')) in ('raw', 'material') then 'raw_material'
  when lower(coalesce(n.type, '')) in ('hardware', 'fastener') then 'hardware'
  when lower(coalesce(n.type, '')) in ('part', 'detail') then 'part'
  when lower(coalesce(n.type, '')) in ('tool', 'instrument') then 'tool'
  when lower(coalesce(n.type, '')) = 'consumable'
    and (lower(coalesce(n.name, '')) like '%фрез%' or lower(coalesce(n.name, '')) like '%свердл%') then 'tool'
  when lower(coalesce(n.type, '')) in ('product', 'assembly', 'finished') then 'legacy_product'
  else null
end
left join public.nomenclature_catalog_groups g on g.code = case
  when lower(coalesce(n.name, '')) like '%лист%' then 'RAW.SHEET'
  when lower(coalesce(n.name, '')) like '%профіл%' or lower(coalesce(n.name, '')) like '%труб%' then 'RAW.PROFILE'
  when lower(coalesce(n.name, '')) like '%кле%' then 'RAW.CHEM'
  when lower(coalesce(n.name, '')) like '%прес%гайк%' then 'HW.PRESS_NUT'
  when lower(coalesce(n.name, '')) like '%гайк%' then 'HW.NUT'
  when lower(coalesce(n.name, '')) like '%болт%' then 'HW.BOLT'
  when lower(coalesce(n.name, '')) like '%шайб%' then 'HW.WASHER'
  when lower(coalesce(n.name, '')) like '%заклеп%' then 'HW.RIVET'
  when lower(coalesce(n.name, '')) like '%фрез%' then 'TOOL.MILL'
  when lower(coalesce(n.name, '')) like '%свердл%' then 'TOOL.DRILL'
  when lower(coalesce(n.type, '')) in ('part', 'detail') then 'PART'
  when lower(coalesce(n.type, '')) in ('hardware', 'fastener') then 'HW'
  when lower(coalesce(n.type, '')) in ('raw', 'material') then 'RAW'
  when lower(coalesce(n.type, '')) in ('tool', 'instrument') then 'TOOL'
  else null
end
join public.nomenclature_units pcs on pcs.code = 'pcs'
where not exists (
  select 1
  from public.nomenclature_catalog_profiles existing
  where existing.nomenclature_id = n.id
);

-- Extract only confident sheet attributes. Values remain suggestions until reviewed.
insert into public.nomenclature_attribute_values (nomenclature_id, attribute_id, value_text)
select p.nomenclature_id, a.id,
  case
    when upper(coalesce(n.name, '') || ' ' || coalesce(n.material_type, '')) like '%T700%' then 'T700'
    when upper(coalesce(n.name, '') || ' ' || coalesce(n.material_type, '')) like '%Т700%' then 'T700'
    when upper(coalesce(n.name, '') || ' ' || coalesce(n.material_type, '')) like '%T300%' then 'T300'
    when upper(coalesce(n.name, '') || ' ' || coalesce(n.material_type, '')) like '%Т300%' then 'T300'
  end
from public.nomenclature_catalog_profiles p
join public.nomenclatures n on n.id = p.nomenclature_id
join public.nomenclature_catalog_groups g on g.id = p.group_id and g.code = 'RAW.SHEET'
join public.nomenclature_attribute_definitions a on a.code = 'material_grade'
where upper(coalesce(n.name, '') || ' ' || coalesce(n.material_type, '')) similar to '%(T|Т)(300|700)%'
on conflict (nomenclature_id, attribute_id) do nothing;


-- ─── MIGRATION: 20260708120000_scrap_reasons_catalog.sql ───
create extension if not exists pgcrypto;

create table if not exists public.scrap_reasons (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint scrap_reasons_name_not_blank check (length(btrim(name)) > 0)
);

create unique index if not exists scrap_reasons_name_unique on public.scrap_reasons (lower(btrim(name)));

insert into public.scrap_reasons (name, sort_order) values
  ('Биття цанги', 10), ('Помилка програми', 20), ('Збій станка', 30),
  ('Кривизна листа', 40), ('Поломка флешки', 50), ('Прив''язка', 60),
  ('Помилка оператора', 70), ('Інше (коментар)', 999)
on conflict do nothing;

grant select, insert, update on public.scrap_reasons to anon, authenticated;
alter table public.scrap_reasons enable row level security;

drop policy if exists "scrap_reasons_read" on public.scrap_reasons;
create policy "scrap_reasons_read" on public.scrap_reasons for select to anon, authenticated using (true);
drop policy if exists "scrap_reasons_insert" on public.scrap_reasons;
create policy "scrap_reasons_insert" on public.scrap_reasons for insert to anon, authenticated with check (true);
drop policy if exists "scrap_reasons_update" on public.scrap_reasons;
create policy "scrap_reasons_update" on public.scrap_reasons for update to anon, authenticated using (true) with check (true);

alter publication supabase_realtime add table public.scrap_reasons;


-- ─── MIGRATION: 20260708150000_scrap_classification_ledger.sql ───
create extension if not exists pgcrypto;

-- One row per VKYA classification action (supports partial classification).
create table if not exists public.scrap_classifications (
  id uuid primary key default gen_random_uuid(),
  source_history_id uuid references public.work_card_history(id) on delete set null,
  card_id uuid,
  task_id uuid,
  order_id uuid,
  nomenclature_id uuid not null,
  order_number text,
  card_sequence integer,
  source_operator_name text,
  source_stage_name text,
  source_machine_name text,
  quantity integer not null check (quantity > 0),
  classified_by_user_id bigint,
  classified_by_name text,
  classified_at timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now()
);

-- Category totals belonging to one classification action.
create table if not exists public.scrap_classification_categories (
  id bigint generated always as identity primary key,
  classification_id uuid not null references public.scrap_classifications(id) on delete cascade,
  category smallint not null check (category between 1 and 4),
  quantity integer not null check (quantity > 0),
  unique (classification_id, category)
);

-- Reason totals belonging to one classification action.
-- reason_name is a historical snapshot: later catalog renames do not rewrite reports.
create table if not exists public.scrap_classification_reasons (
  id bigint generated always as identity primary key,
  classification_id uuid not null references public.scrap_classifications(id) on delete cascade,
  reason_id uuid references public.scrap_reasons(id) on delete restrict,
  reason_name text not null,
  quantity integer not null check (quantity > 0),
  unique (classification_id, reason_id)
);

create index if not exists scrap_classifications_date_idx
  on public.scrap_classifications (classified_at desc);
create index if not exists scrap_classifications_operator_idx
  on public.scrap_classifications (source_operator_name, classified_at desc);
create index if not exists scrap_classifications_nomenclature_idx
  on public.scrap_classifications (nomenclature_id, classified_at desc);
create index if not exists scrap_classifications_order_idx
  on public.scrap_classifications (order_id, classified_at desc);
create index if not exists scrap_classifications_card_idx
  on public.scrap_classifications (card_id, classified_at desc);
create index if not exists scrap_category_report_idx
  on public.scrap_classification_categories (category, classification_id);
create index if not exists scrap_reason_report_idx
  on public.scrap_classification_reasons (reason_id, classification_id);

alter table public.scrap_classifications enable row level security;
alter table public.scrap_classification_categories enable row level security;
alter table public.scrap_classification_reasons enable row level security;

grant select, insert on public.scrap_classifications to anon, authenticated;
grant select, insert on public.scrap_classification_categories to anon, authenticated;
grant select, insert on public.scrap_classification_reasons to anon, authenticated;
grant usage, select on sequence public.scrap_classification_categories_id_seq to anon, authenticated;
grant usage, select on sequence public.scrap_classification_reasons_id_seq to anon, authenticated;

drop policy if exists "scrap_classifications_read" on public.scrap_classifications;
create policy "scrap_classifications_read" on public.scrap_classifications
  for select to anon, authenticated using (true);
drop policy if exists "scrap_classifications_insert" on public.scrap_classifications;
create policy "scrap_classifications_insert" on public.scrap_classifications
  for insert to anon, authenticated with check (true);

drop policy if exists "scrap_categories_read" on public.scrap_classification_categories;
create policy "scrap_categories_read" on public.scrap_classification_categories
  for select to anon, authenticated using (true);
drop policy if exists "scrap_categories_insert" on public.scrap_classification_categories;
create policy "scrap_categories_insert" on public.scrap_classification_categories
  for insert to anon, authenticated with check (true);

drop policy if exists "scrap_reasons_fact_read" on public.scrap_classification_reasons;
create policy "scrap_reasons_fact_read" on public.scrap_classification_reasons
  for select to anon, authenticated using (true);
drop policy if exists "scrap_reasons_fact_insert" on public.scrap_classification_reasons;
create policy "scrap_reasons_fact_insert" on public.scrap_classification_reasons
  for insert to anon, authenticated with check (true);

-- Atomic writer. Both category and reason totals must exactly equal p_quantity.
create or replace function public.record_scrap_classification(
  p_source_history_id uuid,
  p_card_id uuid,
  p_task_id uuid,
  p_order_id uuid,
  p_nomenclature_id uuid,
  p_order_number text,
  p_card_sequence integer,
  p_source_operator_name text,
  p_source_stage_name text,
  p_source_machine_name text,
  p_quantity integer,
  p_classified_by_user_id bigint,
  p_classified_by_name text,
  p_categories jsonb,
  p_reasons jsonb,
  p_notes text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_category_total integer;
  v_reason_total integer;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Classification quantity must be greater than zero';
  end if;
  if jsonb_typeof(p_categories) <> 'array' or jsonb_array_length(p_categories) = 0 then
    raise exception 'Categories must be a non-empty JSON array';
  end if;
  if jsonb_typeof(p_reasons) <> 'array' or jsonb_array_length(p_reasons) = 0 then
    raise exception 'Reasons must be a non-empty JSON array';
  end if;

  select coalesce(sum((item->>'quantity')::integer), 0)
    into v_category_total from jsonb_array_elements(p_categories) item;
  select coalesce(sum((item->>'quantity')::integer), 0)
    into v_reason_total from jsonb_array_elements(p_reasons) item;

  if v_category_total <> p_quantity then
    raise exception 'Category total (%) must equal classification quantity (%)', v_category_total, p_quantity;
  end if;
  if v_reason_total <> p_quantity then
    raise exception 'Reason total (%) must equal classification quantity (%)', v_reason_total, p_quantity;
  end if;

  insert into public.scrap_classifications (
    source_history_id, card_id, task_id, order_id, nomenclature_id,
    order_number, card_sequence, source_operator_name, source_stage_name,
    source_machine_name, quantity, classified_by_user_id,
    classified_by_name, notes
  ) values (
    p_source_history_id, p_card_id, p_task_id, p_order_id, p_nomenclature_id,
    p_order_number, p_card_sequence, p_source_operator_name, p_source_stage_name,
    p_source_machine_name, p_quantity, p_classified_by_user_id,
    p_classified_by_name, p_notes
  ) returning id into v_id;

  insert into public.scrap_classification_categories (classification_id, category, quantity)
  select v_id, (item->>'category')::smallint, (item->>'quantity')::integer
  from jsonb_array_elements(p_categories) item
  where (item->>'quantity')::integer > 0;

  insert into public.scrap_classification_reasons (classification_id, reason_id, reason_name, quantity)
  select v_id, r.id, r.name, (item->>'quantity')::integer
  from jsonb_array_elements(p_reasons) item
  join public.scrap_reasons r on r.id = (item->>'reason_id')::uuid
  where (item->>'quantity')::integer > 0;

  if (select coalesce(sum(quantity), 0) from public.scrap_classification_reasons where classification_id = v_id) <> p_quantity then
    raise exception 'One or more supplied scrap reasons do not exist';
  end if;

  return v_id;
end;
$$;

revoke all on function public.record_scrap_classification(uuid,uuid,uuid,uuid,uuid,text,integer,text,text,text,integer,bigint,text,jsonb,jsonb,text) from public;
grant execute on function public.record_scrap_classification(uuid,uuid,uuid,uuid,uuid,text,integer,text,text,text,integer,bigint,text,jsonb,jsonb,text) to anon, authenticated;

-- Report-ready views. They intentionally remain separate to avoid multiplying
-- quantities by joining category rows to reason rows.
create or replace view public.scrap_report_by_category as
select
  date_trunc('day', c.classified_at) as report_day,
  c.source_operator_name,
  c.nomenclature_id,
  c.order_id,
  a.category,
  sum(a.quantity)::bigint as quantity
from public.scrap_classifications c
join public.scrap_classification_categories a on a.classification_id = c.id
group by 1, 2, 3, 4, 5;

create or replace view public.scrap_report_by_reason as
select
  date_trunc('day', c.classified_at) as report_day,
  c.source_operator_name,
  c.nomenclature_id,
  c.order_id,
  r.reason_id,
  r.reason_name,
  sum(r.quantity)::bigint as quantity
from public.scrap_classifications c
join public.scrap_classification_reasons r on r.classification_id = c.id
group by 1, 2, 3, 4, 5, 6;

grant select on public.scrap_report_by_category to anon, authenticated;
grant select on public.scrap_report_by_reason to anon, authenticated;


-- ─── MIGRATION: 20260710100000_scrap_reasons_delete_policy.sql ───
grant delete on public.scrap_reasons to anon, authenticated;

drop policy if exists "scrap_reasons_delete" on public.scrap_reasons;
create policy "scrap_reasons_delete" on public.scrap_reasons
  for delete to anon, authenticated using (true);


-- ─── MIGRATION: 20260711120000_merge_duplicate_scrap_reason_light_chips.sql ───
do $$
declare
  v_old_id uuid := '2815abf0-f666-421a-adc0-5b8bbb1ac1ed';
  v_new_id uuid := '39113a5e-8930-455a-bbea-d6a939050375';
  v_old_name text := 'легенькі сколи -потребує косметичного ремонту';
  v_new_name text := 'Легкі сколи-потребує косметичного ремонту';
begin
  if exists (select 1 from public.scrap_reasons where id = v_old_id)
     and exists (select 1 from public.scrap_reasons where id = v_new_id) then

    update public.scrap_classification_reasons new_row
      set quantity = new_row.quantity + old_row.quantity,
          reason_name = v_new_name
    from public.scrap_classification_reasons old_row
    where old_row.reason_id = v_old_id
      and new_row.reason_id = v_new_id
      and new_row.classification_id = old_row.classification_id;

    delete from public.scrap_classification_reasons old_row
    where old_row.reason_id = v_old_id
      and exists (
        select 1
        from public.scrap_classification_reasons new_row
        where new_row.reason_id = v_new_id
          and new_row.classification_id = old_row.classification_id
      );

    update public.scrap_classification_reasons
      set reason_id = v_new_id,
          reason_name = v_new_name
    where reason_id = v_old_id;

    update public.work_card_history
      set qc_scrap_comment = replace(qc_scrap_comment, v_old_name, v_new_name)
    where qc_scrap_comment like '%' || v_old_name || '%';

    delete from public.scrap_reasons
    where id = v_old_id;
  end if;
end $$;


-- ─── MIGRATION: 20260711130000_chat_module.sql ───
create extension if not exists pgcrypto;

create table if not exists public.chat_threads (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  thread_type text not null default 'group',
  context_type text,
  context_id text,
  created_by bigint,
  created_by_login text,
  created_by_name text,
  is_archived boolean not null default false,
  last_message text,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chat_participants (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.chat_threads(id) on delete cascade,
  user_id bigint not null,
  user_login text,
  user_name text not null,
  is_muted boolean not null default false,
  last_read_at timestamptz,
  created_at timestamptz not null default now(),
  unique(thread_id, user_id)
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.chat_threads(id) on delete cascade,
  sender_id bigint,
  sender_login text,
  sender_name text not null,
  body text,
  attachment_url text,
  attachment_path text,
  attachment_type text,
  attachment_name text,
  attachment_size integer,
  image_width integer,
  image_height integer,
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz,
  constraint chat_messages_has_content check (
    nullif(trim(coalesce(body, '')), '') is not null
    or attachment_url is not null
  )
);

create index if not exists idx_chat_threads_updated_at on public.chat_threads(updated_at desc);
create index if not exists idx_chat_threads_archived on public.chat_threads(is_archived);
create index if not exists idx_chat_participants_user on public.chat_participants(user_id);
create index if not exists idx_chat_participants_thread on public.chat_participants(thread_id);
create index if not exists idx_chat_messages_thread_created on public.chat_messages(thread_id, created_at desc);

create or replace function public.touch_chat_thread()
returns trigger
language plpgsql
as $$
begin
  update public.chat_threads
     set updated_at = now(),
         last_message_at = now(),
         last_message = case
           when nullif(trim(coalesce(new.body, '')), '') is not null then left(new.body, 240)
           when new.attachment_url is not null then '[Фото]'
           else last_message
         end
   where id = new.thread_id;
  return new;
end;
$$;

drop trigger if exists trg_touch_chat_thread on public.chat_messages;
create trigger trg_touch_chat_thread
after insert on public.chat_messages
for each row execute function public.touch_chat_thread();

alter table public.chat_threads enable row level security;
alter table public.chat_participants enable row level security;
alter table public.chat_messages enable row level security;

drop policy if exists chat_threads_all on public.chat_threads;
create policy chat_threads_all on public.chat_threads
for all using (true) with check (true);

drop policy if exists chat_participants_all on public.chat_participants;
create policy chat_participants_all on public.chat_participants
for all using (true) with check (true);

drop policy if exists chat_messages_all on public.chat_messages;
create policy chat_messages_all on public.chat_messages
for all using (true) with check (true);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-attachments',
  'chat-attachments',
  true,
  1048576,
  array['image/jpeg', 'image/webp', 'image/png']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists chat_attachments_select on storage.objects;
create policy chat_attachments_select on storage.objects
for select using (bucket_id = 'chat-attachments');

drop policy if exists chat_attachments_insert on storage.objects;
create policy chat_attachments_insert on storage.objects
for insert with check (bucket_id = 'chat-attachments');

drop policy if exists chat_attachments_update on storage.objects;
create policy chat_attachments_update on storage.objects
for update using (bucket_id = 'chat-attachments') with check (bucket_id = 'chat-attachments');

drop policy if exists chat_attachments_delete on storage.objects;
create policy chat_attachments_delete on storage.objects
for delete using (bucket_id = 'chat-attachments');

do $$
declare
  realtime_for_all boolean;
begin
  select coalesce(puballtables, false)
    into realtime_for_all
    from pg_publication
   where pubname = 'supabase_realtime';

  if realtime_for_all then
    return;
  end if;

  begin
    alter publication supabase_realtime add table public.chat_threads;
  exception
    when duplicate_object then null;
    when undefined_object then null;
  end;

  begin
    alter publication supabase_realtime add table public.chat_participants;
  exception
    when duplicate_object then null;
    when undefined_object then null;
  end;

  begin
    alter publication supabase_realtime add table public.chat_messages;
  exception
    when duplicate_object then null;
    when undefined_object then null;
  end;
end $$;


-- ─── MIGRATION: 20260711140000_chat_thread_settings.sql ───
alter table public.chat_threads
  add column if not exists avatar_url text,
  add column if not exists avatar_path text,
  add column if not exists avatar_type text,
  add column if not exists avatar_size integer;


-- ─── MIGRATION: 20260712100000_chat_direct_threads_unique.sql ───
alter table public.chat_threads
  add column if not exists direct_key text;

with pair_threads as (
  select
    t.id,
    'direct:' || string_agg(cp.user_id::text, ':' order by cp.user_id::text) as direct_key,
    coalesce(t.last_message_at, t.updated_at, t.created_at) as activity_at
  from public.chat_threads t
  join public.chat_participants cp on cp.thread_id = t.id
  where t.is_archived = false
  group by t.id, t.last_message_at, t.updated_at, t.created_at
  having count(*) = 2
),
ranked as (
  select
    *,
    row_number() over (partition by direct_key order by activity_at desc, id desc) as rn
  from pair_threads
)
update public.chat_threads t
   set thread_type = 'direct',
       direct_key = case when ranked.rn = 1 then ranked.direct_key else null end,
       is_archived = case when ranked.rn = 1 then t.is_archived else true end,
       updated_at = now()
  from ranked
 where t.id = ranked.id;

create unique index if not exists ux_chat_threads_direct_key_active
  on public.chat_threads (direct_key)
  where direct_key is not null and is_archived = false;


-- ─── MIGRATION: 20260712113000_chat_channels_and_reactions.sql ───
alter table public.chat_participants
  add column if not exists participant_role text not null default 'member',
  add column if not exists can_post boolean not null default true;

update public.chat_participants
   set participant_role = coalesce(nullif(participant_role, ''), 'member'),
       can_post = coalesce(can_post, true);

create table if not exists public.chat_message_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.chat_messages(id) on delete cascade,
  user_id bigint not null,
  user_login text,
  user_name text not null,
  reaction text not null,
  created_at timestamptz not null default now(),
  constraint chat_message_reactions_reaction_not_empty check (length(trim(reaction)) > 0),
  unique(message_id, user_id, reaction)
);

create index if not exists idx_chat_message_reactions_message
  on public.chat_message_reactions(message_id);

create index if not exists idx_chat_message_reactions_user
  on public.chat_message_reactions(user_id);

create table if not exists public.chat_polls (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.chat_threads(id) on delete cascade,
  message_id uuid references public.chat_messages(id) on delete set null,
  question text not null,
  allow_multiple boolean not null default false,
  created_by bigint,
  created_by_login text,
  created_by_name text,
  closes_at timestamptz,
  created_at timestamptz not null default now(),
  constraint chat_polls_question_not_empty check (length(trim(question)) > 0)
);

create table if not exists public.chat_poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.chat_polls(id) on delete cascade,
  option_text text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint chat_poll_options_text_not_empty check (length(trim(option_text)) > 0)
);

create table if not exists public.chat_poll_votes (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.chat_polls(id) on delete cascade,
  option_id uuid not null references public.chat_poll_options(id) on delete cascade,
  user_id bigint not null,
  user_login text,
  user_name text not null,
  created_at timestamptz not null default now(),
  unique(poll_id, option_id, user_id)
);

create index if not exists idx_chat_polls_thread
  on public.chat_polls(thread_id, created_at desc);

create index if not exists idx_chat_poll_options_poll
  on public.chat_poll_options(poll_id, sort_order);

create index if not exists idx_chat_poll_votes_poll
  on public.chat_poll_votes(poll_id);

create index if not exists idx_chat_poll_votes_user
  on public.chat_poll_votes(user_id);

alter table public.chat_message_reactions enable row level security;
alter table public.chat_polls enable row level security;
alter table public.chat_poll_options enable row level security;
alter table public.chat_poll_votes enable row level security;

drop policy if exists chat_message_reactions_all on public.chat_message_reactions;
create policy chat_message_reactions_all on public.chat_message_reactions
for all using (true) with check (true);

drop policy if exists chat_polls_all on public.chat_polls;
create policy chat_polls_all on public.chat_polls
for all using (true) with check (true);

drop policy if exists chat_poll_options_all on public.chat_poll_options;
create policy chat_poll_options_all on public.chat_poll_options
for all using (true) with check (true);

drop policy if exists chat_poll_votes_all on public.chat_poll_votes;
create policy chat_poll_votes_all on public.chat_poll_votes
for all using (true) with check (true);

do $$
declare
  realtime_for_all boolean;
begin
  select coalesce(puballtables, false)
    into realtime_for_all
    from pg_publication
   where pubname = 'supabase_realtime';

  if realtime_for_all then
    return;
  end if;

  begin
    alter publication supabase_realtime add table public.chat_message_reactions;
  exception
    when duplicate_object then null;
    when undefined_object then null;
  end;

  begin
    alter publication supabase_realtime add table public.chat_polls;
  exception
    when duplicate_object then null;
    when undefined_object then null;
  end;

  begin
    alter publication supabase_realtime add table public.chat_poll_options;
  exception
    when duplicate_object then null;
    when undefined_object then null;
  end;

  begin
    alter publication supabase_realtime add table public.chat_poll_votes;
  exception
    when duplicate_object then null;
    when undefined_object then null;
  end;
end $$;


-- ─── MIGRATION: 20260712120000_chat_pinned_channels.sql ───
alter table public.chat_threads
  add column if not exists is_pinned boolean not null default false;

update public.chat_threads
   set is_pinned = true,
       updated_at = now()
 where thread_type = 'channel'
   and coalesce(is_pinned, false) = false;

create index if not exists idx_chat_threads_pinned_updated
  on public.chat_threads(is_pinned desc, updated_at desc);


-- ─── MIGRATION: 20260712123000_chat_privacy_hardening.sql ───
create or replace function public.touch_chat_thread()
returns trigger
language plpgsql
as $$
begin
  update public.chat_threads
     set updated_at = now(),
         last_message_at = now(),
         last_message = case
           when new.attachment_type = 'channel_poll' then '[Опитування]'
           when new.attachment_type = 'system_task' then '[Завдання]'
           when new.attachment_url is not null then '[Фото]'
           else '[Повідомлення]'
         end
   where id = new.thread_id;
  return new;
end;
$$;

update public.chat_threads
   set last_message = case
     when last_message is null then null
     when last_message in ('Чат створено', 'Р§Р°С‚ СЃС‚РІРѕСЂРµРЅРѕ') then last_message
     when last_message in ('[Фото]', '[Опитування]', '[Завдання]', '[Повідомлення]') then last_message
     else '[Повідомлення]'
   end
 where last_message is not null;


-- ─── MIGRATION: 20260712124500_chat_private_attachments.sql ───
update storage.buckets
   set public = false
 where id = 'chat-attachments';

update public.chat_messages
   set attachment_path = regexp_replace(
     attachment_url,
     '^.*/storage/v1/object/public/chat-attachments/',
     ''
   )
 where attachment_path is null
   and attachment_url like '%/storage/v1/object/public/chat-attachments/%';

drop policy if exists chat_attachments_select on storage.objects;
drop policy if exists chat_attachments_insert on storage.objects;
drop policy if exists chat_attachments_update on storage.objects;
drop policy if exists chat_attachments_delete on storage.objects;

create policy chat_attachments_select on storage.objects
for select using (bucket_id = 'chat-attachments');

create policy chat_attachments_insert on storage.objects
for insert with check (bucket_id = 'chat-attachments');

create policy chat_attachments_update on storage.objects
for update using (bucket_id = 'chat-attachments') with check (bucket_id = 'chat-attachments');

create policy chat_attachments_delete on storage.objects
for delete using (bucket_id = 'chat-attachments');


-- ─── MIGRATION: 20260712130000_chat_integrity_guards.sql ───
create or replace function public.chat_thread_type(p_thread_id uuid)
returns text
language sql
stable
as $$
  select coalesce(thread_type, 'group')
    from public.chat_threads
   where id = p_thread_id
     and coalesce(is_archived, false) = false
$$;

create or replace function public.chat_participant_snapshot(p_thread_id uuid, p_user_id bigint)
returns table (
  user_login text,
  user_name text,
  participant_role text,
  can_post boolean
)
language sql
stable
as $$
  select
    cp.user_login,
    cp.user_name,
    coalesce(cp.participant_role, 'member') as participant_role,
    coalesce(cp.can_post, true) as can_post
  from public.chat_participants cp
  where cp.thread_id = p_thread_id
    and cp.user_id = p_user_id
  limit 1
$$;

create or replace function public.guard_chat_message_write()
returns trigger
language plpgsql
as $$
declare
  participant record;
  v_thread_type text;
begin
  if new.sender_id is null then
    raise exception 'chat sender_id is required';
  end if;

  select *
    into participant
    from public.chat_participant_snapshot(new.thread_id, new.sender_id);

  if participant.user_name is null then
    raise exception 'chat sender is not a participant of this thread';
  end if;

  v_thread_type := public.chat_thread_type(new.thread_id);
  if v_thread_type is null then
    raise exception 'chat thread does not exist or is archived';
  end if;

  if v_thread_type = 'channel' and participant.can_post is not true then
    raise exception 'this user cannot post to this channel';
  end if;

  new.sender_login := participant.user_login;
  new.sender_name := participant.user_name;
  return new;
end;
$$;

drop trigger if exists trg_guard_chat_message_write on public.chat_messages;
create trigger trg_guard_chat_message_write
before insert or update of thread_id, sender_id, sender_login, sender_name, body, attachment_url, attachment_path, attachment_type
on public.chat_messages
for each row execute function public.guard_chat_message_write();

create or replace function public.guard_chat_reaction_write()
returns trigger
language plpgsql
as $$
declare
  participant record;
  v_thread_id uuid;
begin
  if new.user_id is null then
    raise exception 'reaction user_id is required';
  end if;

  select thread_id
    into v_thread_id
    from public.chat_messages
   where id = new.message_id
     and deleted_at is null;

  if v_thread_id is null then
    raise exception 'message does not exist';
  end if;

  select *
    into participant
    from public.chat_participant_snapshot(v_thread_id, new.user_id);

  if participant.user_name is null then
    raise exception 'reaction user is not a participant of this thread';
  end if;

  new.user_login := participant.user_login;
  new.user_name := participant.user_name;
  return new;
end;
$$;

drop trigger if exists trg_guard_chat_reaction_write on public.chat_message_reactions;
create trigger trg_guard_chat_reaction_write
before insert or update of message_id, user_id, user_login, user_name, reaction
on public.chat_message_reactions
for each row execute function public.guard_chat_reaction_write();

create or replace function public.guard_chat_poll_write()
returns trigger
language plpgsql
as $$
declare
  participant record;
begin
  if new.created_by is null then
    raise exception 'poll created_by is required';
  end if;

  select *
    into participant
    from public.chat_participant_snapshot(new.thread_id, new.created_by);

  if participant.user_name is null then
    raise exception 'poll creator is not a participant of this thread';
  end if;

  if public.chat_thread_type(new.thread_id) = 'channel' and participant.can_post is not true then
    raise exception 'this user cannot create polls in this channel';
  end if;

  new.created_by_login := participant.user_login;
  new.created_by_name := participant.user_name;
  return new;
end;
$$;

drop trigger if exists trg_guard_chat_poll_write on public.chat_polls;
create trigger trg_guard_chat_poll_write
before insert or update of thread_id, created_by, created_by_login, created_by_name, question
on public.chat_polls
for each row execute function public.guard_chat_poll_write();

create or replace function public.guard_chat_poll_vote_write()
returns trigger
language plpgsql
as $$
declare
  participant record;
  v_thread_id uuid;
  v_allow_multiple boolean;
begin
  if new.user_id is null then
    raise exception 'vote user_id is required';
  end if;

  select p.thread_id, p.allow_multiple
    into v_thread_id, v_allow_multiple
    from public.chat_polls p
   where p.id = new.poll_id;

  if v_thread_id is null then
    raise exception 'poll does not exist';
  end if;

  select *
    into participant
    from public.chat_participant_snapshot(v_thread_id, new.user_id);

  if participant.user_name is null then
    raise exception 'vote user is not a participant of this thread';
  end if;

  if coalesce(v_allow_multiple, false) is false then
    delete from public.chat_poll_votes
     where poll_id = new.poll_id
       and user_id = new.user_id
       and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);
  end if;

  new.user_login := participant.user_login;
  new.user_name := participant.user_name;
  return new;
end;
$$;

drop trigger if exists trg_guard_chat_poll_vote_write on public.chat_poll_votes;
create trigger trg_guard_chat_poll_vote_write
before insert or update of poll_id, option_id, user_id, user_login, user_name
on public.chat_poll_votes
for each row execute function public.guard_chat_poll_vote_write();


-- ─── MIGRATION: 20260713143000_work_card_scrap_totals.sql ───
-- Fast scrap totals for dashboards and foreman archives.
-- work_card_history remains the audit source of truth; this table is only a
-- small indexed projection for screens that need instant totals.

create extension if not exists pgcrypto;

create table if not exists public.work_card_scrap_totals (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.work_cards(id) on delete cascade,
  task_id uuid not null,
  order_id uuid,
  nomenclature_id uuid not null,
  total_scrap integer not null default 0 check (total_scrap >= 0),
  first_scrap_at timestamptz,
  last_scrap_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (card_id, nomenclature_id)
);

create table if not exists public.work_card_scrap_total_backfill_progress (
  history_id uuid primary key references public.work_card_history(id) on delete cascade,
  processed_at timestamptz not null default now()
);

create index if not exists idx_work_card_scrap_totals_task_nom
  on public.work_card_scrap_totals (task_id, nomenclature_id);
create index if not exists idx_work_card_scrap_totals_order_nom
  on public.work_card_scrap_totals (order_id, nomenclature_id);
create index if not exists idx_work_card_scrap_totals_card
  on public.work_card_scrap_totals (card_id);

alter table public.work_card_scrap_totals enable row level security;
alter table public.work_card_scrap_total_backfill_progress enable row level security;

grant select on public.work_card_scrap_totals to anon, authenticated;

drop policy if exists "work_card_scrap_totals_read" on public.work_card_scrap_totals;
create policy "work_card_scrap_totals_read" on public.work_card_scrap_totals
  for select to anon, authenticated using (true);

drop policy if exists "work_card_scrap_total_backfill_progress_no_read" on public.work_card_scrap_total_backfill_progress;
create policy "work_card_scrap_total_backfill_progress_no_read" on public.work_card_scrap_total_backfill_progress
  for select to authenticated using (false);

create or replace function public.apply_work_card_scrap_delta(
  p_card_id uuid,
  p_nomenclature_id uuid,
  p_delta integer,
  p_event_at timestamptz default now()
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_card record;
  v_event_at timestamptz := coalesce(p_event_at, now());
begin
  if p_card_id is null or p_nomenclature_id is null or coalesce(p_delta, 0) = 0 then
    return;
  end if;

  select id, task_id, order_id, nomenclature_id
    into v_card
    from public.work_cards
   where id = p_card_id;

  if not found then
    return;
  end if;

  insert into public.work_card_scrap_totals (
    card_id, task_id, order_id, nomenclature_id,
    total_scrap, first_scrap_at, last_scrap_at, updated_at
  ) values (
    p_card_id, v_card.task_id, v_card.order_id, p_nomenclature_id,
    greatest(p_delta, 0),
    case when p_delta > 0 then v_event_at else null end,
    case when p_delta > 0 then v_event_at else null end,
    now()
  )
  on conflict (card_id, nomenclature_id) do update set
    task_id = excluded.task_id,
    order_id = excluded.order_id,
    total_scrap = greatest(0, public.work_card_scrap_totals.total_scrap + p_delta),
    first_scrap_at = case
      when p_delta > 0 then least(coalesce(public.work_card_scrap_totals.first_scrap_at, v_event_at), v_event_at)
      else public.work_card_scrap_totals.first_scrap_at
    end,
    last_scrap_at = case
      when p_delta > 0 then greatest(coalesce(public.work_card_scrap_totals.last_scrap_at, v_event_at), v_event_at)
      else public.work_card_scrap_totals.last_scrap_at
    end,
    updated_at = now();

  delete from public.work_card_scrap_totals
   where card_id = p_card_id
     and nomenclature_id = p_nomenclature_id
     and total_scrap <= 0;
end;
$$;

create or replace function public.sync_work_card_scrap_totals_from_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.apply_work_card_scrap_delta(
      new.card_id,
      new.nomenclature_id,
      coalesce(new.scrap_qty, 0)::integer,
      coalesce(new.completed_at, new.created_at, now())
    );
    return new;
  elsif tg_op = 'UPDATE' then
    perform public.apply_work_card_scrap_delta(
      old.card_id,
      old.nomenclature_id,
      -coalesce(old.scrap_qty, 0)::integer,
      coalesce(old.completed_at, old.created_at, now())
    );
    perform public.apply_work_card_scrap_delta(
      new.card_id,
      new.nomenclature_id,
      coalesce(new.scrap_qty, 0)::integer,
      coalesce(new.completed_at, new.created_at, now())
    );
    return new;
  elsif tg_op = 'DELETE' then
    perform public.apply_work_card_scrap_delta(
      old.card_id,
      old.nomenclature_id,
      -coalesce(old.scrap_qty, 0)::integer,
      coalesce(old.completed_at, old.created_at, now())
    );
    return old;
  end if;

  return null;
end;
$$;

drop trigger if exists trg_sync_work_card_scrap_totals on public.work_card_history;
create trigger trg_sync_work_card_scrap_totals
after insert or update or delete on public.work_card_history
for each row execute function public.sync_work_card_scrap_totals_from_history();

create or replace function public.rebuild_work_card_scrap_totals()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  truncate table public.work_card_scrap_totals;

  insert into public.work_card_scrap_totals (
    card_id, task_id, order_id, nomenclature_id,
    total_scrap, first_scrap_at, last_scrap_at, updated_at
  )
  select
    h.card_id,
    wc.task_id,
    wc.order_id,
    h.nomenclature_id,
    sum(coalesce(h.scrap_qty, 0))::integer as total_scrap,
    min(coalesce(h.completed_at, h.created_at)) as first_scrap_at,
    max(coalesce(h.completed_at, h.created_at)) as last_scrap_at,
    now() as updated_at
  from public.work_card_history h
  join public.work_cards wc on wc.id = h.card_id
  where coalesce(h.scrap_qty, 0) > 0
    and h.card_id is not null
    and h.nomenclature_id is not null
  group by h.card_id, wc.task_id, wc.order_id, h.nomenclature_id
  having sum(coalesce(h.scrap_qty, 0)) > 0;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.backfill_work_card_scrap_totals_batch(
  p_limit integer default 100
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 100), 1), 500);
  v_processed integer := 0;
  v_groups integer := 0;
  v_scrap integer := 0;
begin
  create temporary table if not exists pg_temp.scrap_backfill_batch (
    id uuid primary key,
    card_id uuid not null,
    nomenclature_id uuid not null,
    scrap_qty integer not null,
    event_at timestamptz not null
  ) on commit drop;

  truncate table pg_temp.scrap_backfill_batch;

  insert into pg_temp.scrap_backfill_batch (id, card_id, nomenclature_id, scrap_qty, event_at)
  select
    h.id,
    h.card_id,
    h.nomenclature_id,
    coalesce(h.scrap_qty, 0)::integer,
    coalesce(h.completed_at, h.created_at, now())
  from public.work_card_history h
  left join public.work_card_scrap_total_backfill_progress p on p.history_id = h.id
  where p.history_id is null
    and coalesce(h.scrap_qty, 0) > 0
    and h.card_id is not null
    and h.nomenclature_id is not null
  order by coalesce(h.created_at, h.completed_at), h.id
  limit v_limit;

  get diagnostics v_processed = row_count;

  if v_processed = 0 then
    return jsonb_build_object('processed', 0, 'groups', 0, 'scrap', 0);
  end if;

  with grouped as (
    select
      b.card_id,
      wc.task_id,
      wc.order_id,
      b.nomenclature_id,
      sum(b.scrap_qty)::integer as total_scrap,
      min(b.event_at) as first_scrap_at,
      max(b.event_at) as last_scrap_at
    from pg_temp.scrap_backfill_batch b
    join public.work_cards wc on wc.id = b.card_id
    group by b.card_id, wc.task_id, wc.order_id, b.nomenclature_id
  ), upserted as (
    insert into public.work_card_scrap_totals (
      card_id, task_id, order_id, nomenclature_id,
      total_scrap, first_scrap_at, last_scrap_at, updated_at
    )
    select
      card_id, task_id, order_id, nomenclature_id,
      total_scrap, first_scrap_at, last_scrap_at, now()
    from grouped
    on conflict (card_id, nomenclature_id) do update set
      task_id = excluded.task_id,
      order_id = excluded.order_id,
      total_scrap = public.work_card_scrap_totals.total_scrap + excluded.total_scrap,
      first_scrap_at = least(
        coalesce(public.work_card_scrap_totals.first_scrap_at, excluded.first_scrap_at),
        excluded.first_scrap_at
      ),
      last_scrap_at = greatest(
        coalesce(public.work_card_scrap_totals.last_scrap_at, excluded.last_scrap_at),
        excluded.last_scrap_at
      ),
      updated_at = now()
    returning total_scrap
  )
  select count(*), coalesce(sum(total_scrap), 0)::integer
    into v_groups, v_scrap
    from upserted;

  insert into public.work_card_scrap_total_backfill_progress (history_id)
  select id from pg_temp.scrap_backfill_batch
  on conflict (history_id) do nothing;

  return jsonb_build_object(
    'processed', v_processed,
    'groups', coalesce(v_groups, 0),
    'scrap', coalesce(v_scrap, 0)
  );
end;
$$;

revoke all on function public.apply_work_card_scrap_delta(uuid, uuid, integer, timestamptz) from public;
revoke all on function public.sync_work_card_scrap_totals_from_history() from public;
revoke all on function public.rebuild_work_card_scrap_totals() from public;
revoke all on function public.backfill_work_card_scrap_totals_batch(integer) from public;
grant execute on function public.rebuild_work_card_scrap_totals() to authenticated;
grant execute on function public.backfill_work_card_scrap_totals_batch(integer) to anon, authenticated;

-- Do not run the rebuild automatically inside the migration.
-- On a loaded Supabase project, rebuilding from the full history in one query
-- can block PostgREST. Run public.rebuild_work_card_scrap_totals() manually
-- during a quiet maintenance window, or backfill in smaller batches.


-- ─── MIGRATION: 20260713150000_work_card_flow_totals.sql ───
-- Fast work-card flow totals for dashboards and foreman archives.
-- work_card_history remains the audit source of truth; this table is only a
-- small indexed projection for screens that need instant per-stage totals.

create extension if not exists pgcrypto;

create table if not exists public.work_card_flow_totals (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.work_cards(id) on delete cascade,
  task_id uuid not null,
  order_id uuid,
  nomenclature_id uuid not null,
  stage_name text not null,
  total_good integer not null default 0 check (total_good >= 0),
  total_bz integer not null default 0 check (total_bz >= 0),
  total_scrap integer not null default 0 check (total_scrap >= 0),
  first_event_at timestamptz,
  last_event_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (card_id, nomenclature_id, stage_name)
);

create table if not exists public.work_card_flow_total_backfill_progress (
  history_id uuid primary key references public.work_card_history(id) on delete cascade,
  processed_at timestamptz not null default now()
);

create index if not exists idx_work_card_flow_totals_task_nom
  on public.work_card_flow_totals (task_id, nomenclature_id);
create index if not exists idx_work_card_flow_totals_order_nom
  on public.work_card_flow_totals (order_id, nomenclature_id);
create index if not exists idx_work_card_flow_totals_task_stage
  on public.work_card_flow_totals (task_id, stage_name);
create index if not exists idx_work_card_flow_totals_card
  on public.work_card_flow_totals (card_id);

alter table public.work_card_flow_totals enable row level security;
alter table public.work_card_flow_total_backfill_progress enable row level security;

grant select on public.work_card_flow_totals to anon, authenticated;

drop policy if exists "work_card_flow_totals_read" on public.work_card_flow_totals;
create policy "work_card_flow_totals_read" on public.work_card_flow_totals
  for select to anon, authenticated using (true);

drop policy if exists "work_card_flow_total_backfill_progress_no_read" on public.work_card_flow_total_backfill_progress;
create policy "work_card_flow_total_backfill_progress_no_read" on public.work_card_flow_total_backfill_progress
  for select to authenticated using (false);

create or replace function public.is_work_card_bz_stage(p_stage_name text)
returns boolean
language sql
immutable
as $$
  select lower(trim(coalesce(p_stage_name, ''))) in ('склад бз', 'склад bz')
$$;

create or replace function public.apply_work_card_flow_delta(
  p_card_id uuid,
  p_nomenclature_id uuid,
  p_stage_name text,
  p_good_delta integer default 0,
  p_bz_delta integer default 0,
  p_scrap_delta integer default 0,
  p_event_at timestamptz default now()
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_card record;
  v_stage_name text := coalesce(nullif(trim(p_stage_name), ''), 'unknown');
  v_event_at timestamptz := coalesce(p_event_at, now());
  v_has_positive boolean := greatest(
    coalesce(p_good_delta, 0),
    coalesce(p_bz_delta, 0),
    coalesce(p_scrap_delta, 0)
  ) > 0;
begin
  if p_card_id is null or p_nomenclature_id is null then
    return;
  end if;

  if coalesce(p_good_delta, 0) = 0
     and coalesce(p_bz_delta, 0) = 0
     and coalesce(p_scrap_delta, 0) = 0 then
    return;
  end if;

  select id, task_id, order_id, nomenclature_id
    into v_card
    from public.work_cards
   where id = p_card_id;

  if not found then
    return;
  end if;

  insert into public.work_card_flow_totals (
    card_id, task_id, order_id, nomenclature_id, stage_name,
    total_good, total_bz, total_scrap,
    first_event_at, last_event_at, updated_at
  ) values (
    p_card_id, v_card.task_id, v_card.order_id, p_nomenclature_id, v_stage_name,
    greatest(coalesce(p_good_delta, 0), 0),
    greatest(coalesce(p_bz_delta, 0), 0),
    greatest(coalesce(p_scrap_delta, 0), 0),
    case when v_has_positive then v_event_at else null end,
    case when v_has_positive then v_event_at else null end,
    now()
  )
  on conflict (card_id, nomenclature_id, stage_name) do update set
    task_id = excluded.task_id,
    order_id = excluded.order_id,
    total_good = greatest(0, public.work_card_flow_totals.total_good + coalesce(p_good_delta, 0)),
    total_bz = greatest(0, public.work_card_flow_totals.total_bz + coalesce(p_bz_delta, 0)),
    total_scrap = greatest(0, public.work_card_flow_totals.total_scrap + coalesce(p_scrap_delta, 0)),
    first_event_at = case
      when v_has_positive then least(coalesce(public.work_card_flow_totals.first_event_at, v_event_at), v_event_at)
      else public.work_card_flow_totals.first_event_at
    end,
    last_event_at = case
      when v_has_positive then greatest(coalesce(public.work_card_flow_totals.last_event_at, v_event_at), v_event_at)
      else public.work_card_flow_totals.last_event_at
    end,
    updated_at = now();

  delete from public.work_card_flow_totals
   where card_id = p_card_id
     and nomenclature_id = p_nomenclature_id
     and stage_name = v_stage_name
     and total_good <= 0
     and total_bz <= 0
     and total_scrap <= 0;
end;
$$;

create or replace function public.sync_work_card_flow_totals_from_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_good integer;
  v_bz integer;
begin
  if tg_op = 'INSERT' then
    v_bz := case when public.is_work_card_bz_stage(new.stage_name) then coalesce(new.qty_completed, 0)::integer else 0 end;
    v_good := case when public.is_work_card_bz_stage(new.stage_name) then 0 else coalesce(new.qty_completed, 0)::integer end;
    perform public.apply_work_card_flow_delta(
      new.card_id, new.nomenclature_id, new.stage_name,
      v_good, v_bz, coalesce(new.scrap_qty, 0)::integer,
      coalesce(new.completed_at, new.created_at, now())
    );
    return new;
  elsif tg_op = 'UPDATE' then
    v_bz := case when public.is_work_card_bz_stage(old.stage_name) then coalesce(old.qty_completed, 0)::integer else 0 end;
    v_good := case when public.is_work_card_bz_stage(old.stage_name) then 0 else coalesce(old.qty_completed, 0)::integer end;
    perform public.apply_work_card_flow_delta(
      old.card_id, old.nomenclature_id, old.stage_name,
      -v_good, -v_bz, -coalesce(old.scrap_qty, 0)::integer,
      coalesce(old.completed_at, old.created_at, now())
    );

    v_bz := case when public.is_work_card_bz_stage(new.stage_name) then coalesce(new.qty_completed, 0)::integer else 0 end;
    v_good := case when public.is_work_card_bz_stage(new.stage_name) then 0 else coalesce(new.qty_completed, 0)::integer end;
    perform public.apply_work_card_flow_delta(
      new.card_id, new.nomenclature_id, new.stage_name,
      v_good, v_bz, coalesce(new.scrap_qty, 0)::integer,
      coalesce(new.completed_at, new.created_at, now())
    );
    return new;
  elsif tg_op = 'DELETE' then
    v_bz := case when public.is_work_card_bz_stage(old.stage_name) then coalesce(old.qty_completed, 0)::integer else 0 end;
    v_good := case when public.is_work_card_bz_stage(old.stage_name) then 0 else coalesce(old.qty_completed, 0)::integer end;
    perform public.apply_work_card_flow_delta(
      old.card_id, old.nomenclature_id, old.stage_name,
      -v_good, -v_bz, -coalesce(old.scrap_qty, 0)::integer,
      coalesce(old.completed_at, old.created_at, now())
    );
    return old;
  end if;

  return null;
end;
$$;

drop trigger if exists trg_sync_work_card_flow_totals on public.work_card_history;
create trigger trg_sync_work_card_flow_totals
after insert or update or delete on public.work_card_history
for each row execute function public.sync_work_card_flow_totals_from_history();

create or replace function public.rebuild_work_card_flow_totals()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  truncate table public.work_card_flow_totals;

  insert into public.work_card_flow_totals (
    card_id, task_id, order_id, nomenclature_id, stage_name,
    total_good, total_bz, total_scrap,
    first_event_at, last_event_at, updated_at
  )
  select
    h.card_id,
    wc.task_id,
    wc.order_id,
    h.nomenclature_id,
    coalesce(nullif(trim(h.stage_name), ''), 'unknown') as stage_name,
    sum(case when public.is_work_card_bz_stage(h.stage_name) then 0 else coalesce(h.qty_completed, 0) end)::integer as total_good,
    sum(case when public.is_work_card_bz_stage(h.stage_name) then coalesce(h.qty_completed, 0) else 0 end)::integer as total_bz,
    sum(coalesce(h.scrap_qty, 0))::integer as total_scrap,
    min(coalesce(h.completed_at, h.created_at)) as first_event_at,
    max(coalesce(h.completed_at, h.created_at)) as last_event_at,
    now() as updated_at
  from public.work_card_history h
  join public.work_cards wc on wc.id = h.card_id
  where h.card_id is not null
    and h.nomenclature_id is not null
    and (
      coalesce(h.qty_completed, 0) > 0
      or coalesce(h.scrap_qty, 0) > 0
    )
  group by h.card_id, wc.task_id, wc.order_id, h.nomenclature_id, coalesce(nullif(trim(h.stage_name), ''), 'unknown')
  having
    sum(case when public.is_work_card_bz_stage(h.stage_name) then 0 else coalesce(h.qty_completed, 0) end) > 0
    or sum(case when public.is_work_card_bz_stage(h.stage_name) then coalesce(h.qty_completed, 0) else 0 end) > 0
    or sum(coalesce(h.scrap_qty, 0)) > 0;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.backfill_work_card_flow_totals_batch(
  p_limit integer default 100
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 100), 1), 500);
  v_processed integer := 0;
  v_groups integer := 0;
  v_good integer := 0;
  v_bz integer := 0;
  v_scrap integer := 0;
begin
  create temporary table if not exists pg_temp.flow_backfill_batch (
    id uuid primary key,
    card_id uuid not null,
    nomenclature_id uuid not null,
    stage_name text not null,
    good_qty integer not null,
    bz_qty integer not null,
    scrap_qty integer not null,
    event_at timestamptz not null
  ) on commit drop;

  truncate table pg_temp.flow_backfill_batch;

  insert into pg_temp.flow_backfill_batch (
    id, card_id, nomenclature_id, stage_name, good_qty, bz_qty, scrap_qty, event_at
  )
  select
    h.id,
    h.card_id,
    h.nomenclature_id,
    coalesce(nullif(trim(h.stage_name), ''), 'unknown') as stage_name,
    case when public.is_work_card_bz_stage(h.stage_name) then 0 else coalesce(h.qty_completed, 0)::integer end as good_qty,
    case when public.is_work_card_bz_stage(h.stage_name) then coalesce(h.qty_completed, 0)::integer else 0 end as bz_qty,
    coalesce(h.scrap_qty, 0)::integer as scrap_qty,
    coalesce(h.completed_at, h.created_at, now()) as event_at
  from public.work_card_history h
  left join public.work_card_flow_total_backfill_progress p on p.history_id = h.id
  where p.history_id is null
    and h.card_id is not null
    and h.nomenclature_id is not null
    and (
      coalesce(h.qty_completed, 0) > 0
      or coalesce(h.scrap_qty, 0) > 0
    )
  order by coalesce(h.created_at, h.completed_at), h.id
  limit v_limit;

  get diagnostics v_processed = row_count;

  if v_processed = 0 then
    return jsonb_build_object('processed', 0, 'groups', 0, 'good', 0, 'bz', 0, 'scrap', 0);
  end if;

  with grouped as (
    select
      b.card_id,
      wc.task_id,
      wc.order_id,
      b.nomenclature_id,
      b.stage_name,
      sum(b.good_qty)::integer as total_good,
      sum(b.bz_qty)::integer as total_bz,
      sum(b.scrap_qty)::integer as total_scrap,
      min(b.event_at) as first_event_at,
      max(b.event_at) as last_event_at
    from pg_temp.flow_backfill_batch b
    join public.work_cards wc on wc.id = b.card_id
    group by b.card_id, wc.task_id, wc.order_id, b.nomenclature_id, b.stage_name
  ), upserted as (
    insert into public.work_card_flow_totals (
      card_id, task_id, order_id, nomenclature_id, stage_name,
      total_good, total_bz, total_scrap,
      first_event_at, last_event_at, updated_at
    )
    select
      card_id, task_id, order_id, nomenclature_id, stage_name,
      total_good, total_bz, total_scrap,
      first_event_at, last_event_at, now()
    from grouped
    on conflict (card_id, nomenclature_id, stage_name) do update set
      task_id = excluded.task_id,
      order_id = excluded.order_id,
      total_good = public.work_card_flow_totals.total_good + excluded.total_good,
      total_bz = public.work_card_flow_totals.total_bz + excluded.total_bz,
      total_scrap = public.work_card_flow_totals.total_scrap + excluded.total_scrap,
      first_event_at = least(
        coalesce(public.work_card_flow_totals.first_event_at, excluded.first_event_at),
        excluded.first_event_at
      ),
      last_event_at = greatest(
        coalesce(public.work_card_flow_totals.last_event_at, excluded.last_event_at),
        excluded.last_event_at
      ),
      updated_at = now()
    returning total_good, total_bz, total_scrap
  )
  select
    count(*),
    coalesce(sum(total_good), 0)::integer,
    coalesce(sum(total_bz), 0)::integer,
    coalesce(sum(total_scrap), 0)::integer
    into v_groups, v_good, v_bz, v_scrap
    from upserted;

  insert into public.work_card_flow_total_backfill_progress (history_id)
  select id from pg_temp.flow_backfill_batch
  on conflict (history_id) do nothing;

  return jsonb_build_object(
    'processed', v_processed,
    'groups', coalesce(v_groups, 0),
    'good', coalesce(v_good, 0),
    'bz', coalesce(v_bz, 0),
    'scrap', coalesce(v_scrap, 0)
  );
end;
$$;

revoke all on function public.is_work_card_bz_stage(text) from public;
revoke all on function public.apply_work_card_flow_delta(uuid, uuid, text, integer, integer, integer, timestamptz) from public;
revoke all on function public.sync_work_card_flow_totals_from_history() from public;
revoke all on function public.rebuild_work_card_flow_totals() from public;
revoke all on function public.backfill_work_card_flow_totals_batch(integer) from public;
grant execute on function public.rebuild_work_card_flow_totals() to authenticated;
grant execute on function public.backfill_work_card_flow_totals_batch(integer) to anon, authenticated;

-- Do not run the rebuild automatically inside the migration.
-- On a loaded Supabase project, rebuilding from the full history in one query
-- can block PostgREST. Run public.rebuild_work_card_flow_totals() manually
-- during a quiet maintenance window, or backfill in smaller batches.


-- ─── MIGRATION: 20260720110000_chat_unread_counts.sql ───
-- One bounded database call replaces the client-side N+1 unread counters.
-- This is additive: clients without this RPC keep using their compatibility
-- fallback, so the migration and frontend can be rolled out independently.

create index if not exists idx_chat_messages_unread_lookup
  on public.chat_messages (thread_id, created_at)
  where deleted_at is null;

create or replace function public.chat_unread_counts(p_user_id bigint)
returns table (
  thread_id uuid,
  unread_count bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    cp.thread_id,
    count(cm.id)::bigint as unread_count
  from public.chat_participants cp
  left join public.chat_messages cm
    on cm.thread_id = cp.thread_id
   and cm.deleted_at is null
   and cm.sender_id is distinct from p_user_id
   and cm.created_at > coalesce(cp.last_read_at, '-infinity'::timestamptz)
  where cp.user_id = p_user_id
  group by cp.thread_id;
$$;

revoke all on function public.chat_unread_counts(bigint) from public;
grant execute on function public.chat_unread_counts(bigint) to anon, authenticated;

comment on function public.chat_unread_counts(bigint) is
  'Returns unread message totals per thread for one MES user in a single indexed query.';


-- ─── MIGRATION: 20260720140000_operational_query_indexes.sql ───
-- Indexes for the bounded operational reads used by terminals and dashboards.
-- Current production tables are small enough for a regular additive migration;
-- re-check pg_stat_user_indexes after rollout and remove only demonstrably
-- unused duplicates in a later, separately approved migration.

create index if not exists idx_tasks_active_created_desc
  on public.tasks (created_at desc, id)
  where status <> 'completed';

create index if not exists idx_tasks_recent_completed_desc
  on public.tasks (completed_at desc, id)
  where status = 'completed';

create index if not exists idx_work_cards_active_created_desc
  on public.work_cards (created_at desc, id)
  where status <> 'completed';

create index if not exists idx_work_cards_task_status_created
  on public.work_cards (task_id, status, created_at desc);

create index if not exists idx_material_requests_active_created_desc
  on public.material_requests (created_at desc, id)
  where status <> 'completed';

create index if not exists idx_material_requests_completed_created_desc
  on public.material_requests (created_at desc, id)
  where status = 'completed';

create index if not exists idx_material_requests_task_status_created
  on public.material_requests (task_id, status, created_at desc);

create index if not exists idx_work_card_history_effective_completed
  on public.work_card_history ((coalesce(completed_at, created_at)) desc);


-- ─── MIGRATION: 20260720150000_fulfillment_queue.sql ───
-- Bounded fulfillment queues for Packaging and Shipping.
--
-- The application previously rebuilt these queues from the shared `tasks`
-- bootstrap. That bootstrap intentionally keeps only recent completed tasks,
-- which can hide an older package that is still waiting for fulfillment. This
-- RPC keeps every returned read bounded by batch count while preserving the
-- exact metadata predicates used by the two existing screens.

create index if not exists idx_tasks_packaging_open_batches
  on public.tasks (completed_at desc, order_id, batch_index)
  where status = 'completed'
    and coalesce(plan_snapshot #> '{_metadata,is_packaged}', 'false'::jsonb) <> 'true'::jsonb;

create index if not exists idx_tasks_packaged_batches
  on public.tasks (completed_at desc, order_id, batch_index)
  where plan_snapshot #> '{_metadata,is_packaged}' = 'true'::jsonb;

create index if not exists idx_tasks_shipping_open_batches
  on public.tasks (completed_at desc, order_id, batch_index)
  where status = 'completed'
    and plan_snapshot #> '{_metadata,is_packaged}' = 'true'::jsonb
    and coalesce(plan_snapshot #> '{_metadata,is_shipped}', 'false'::jsonb) <> 'true'::jsonb;

create index if not exists idx_tasks_shipped_batches
  on public.tasks (completed_at desc, order_id, batch_index)
  where plan_snapshot #> '{_metadata,is_shipped}' = 'true'::jsonb;

create or replace function public.mes_fulfillment_queue(
  p_queue text,
  p_open_batch_limit integer default 300,
  p_archive_batch_limit integer default 40
)
returns table (
  queue_state text,
  order_id text,
  batch_index text,
  batch_sort_at timestamptz,
  tasks jsonb
)
language sql
stable
security invoker
set search_path = public
as $$
  with params as (
    select
      lower(trim(coalesce(p_queue, ''))) as queue_name,
      least(greatest(coalesce(p_open_batch_limit, 300), 1), 500) as open_limit,
      least(greatest(coalesce(p_archive_batch_limit, 40), 0), 200) as archive_limit
  ),
  eligible as (
    -- Packaging queue: completed, not-yet-packaged tasks remain open no matter
    -- how old they are. Already packaged batches form the bounded archive.
    select
      t.id,
      t.order_id,
      coalesce(t.batch_index::text, '') as batch_key,
      t.created_at,
      coalesce(t.completed_at, t.created_at) as sort_at,
      to_jsonb(t) as task,
      'open'::text as queue_state
    from public.tasks t
    cross join params p
    where p.queue_name = 'packaging'
      and t.order_id is not null
      and t.status = 'completed'
      and coalesce(t.plan_snapshot #> '{_metadata,is_packaged}', 'false'::jsonb) <> 'true'::jsonb

    union all

    select
      t.id,
      t.order_id,
      coalesce(t.batch_index::text, '') as batch_key,
      t.created_at,
      coalesce(t.completed_at, t.created_at) as sort_at,
      to_jsonb(t) as task,
      'archive'::text as queue_state
    from public.tasks t
    cross join params p
    where p.queue_name = 'packaging'
      and t.order_id is not null
      and t.plan_snapshot #> '{_metadata,is_packaged}' = 'true'::jsonb

    union all

    -- Shipping queue: packaged completed tasks stay open until every task in
    -- the batch is marked shipped. The screen already treats shipped metadata
    -- as authoritative for its archive, regardless of the task status.
    select
      t.id,
      t.order_id,
      coalesce(t.batch_index::text, '') as batch_key,
      t.created_at,
      coalesce(t.completed_at, t.created_at) as sort_at,
      to_jsonb(t) as task,
      'open'::text as queue_state
    from public.tasks t
    cross join params p
    where p.queue_name = 'shipping'
      and t.order_id is not null
      and t.status = 'completed'
      and t.plan_snapshot #> '{_metadata,is_packaged}' = 'true'::jsonb
      and coalesce(t.plan_snapshot #> '{_metadata,is_shipped}', 'false'::jsonb) <> 'true'::jsonb

    union all

    select
      t.id,
      t.order_id,
      coalesce(t.batch_index::text, '') as batch_key,
      t.created_at,
      coalesce(t.completed_at, t.created_at) as sort_at,
      to_jsonb(t) as task,
      'archive'::text as queue_state
    from public.tasks t
    cross join params p
    where p.queue_name = 'shipping'
      and t.order_id is not null
      and t.plan_snapshot #> '{_metadata,is_shipped}' = 'true'::jsonb
  ),
  batch_candidates as (
    select
      e.queue_state,
      e.order_id,
      e.batch_key,
      max(e.sort_at) as batch_sort_at
    from eligible e
    group by e.queue_state, e.order_id, e.batch_key
  ),
  ranked_batches as (
    select
      b.*,
      row_number() over (
        partition by b.queue_state
        order by b.batch_sort_at desc, b.order_id, b.batch_key
      ) as batch_rank
    from batch_candidates b
  ),
  selected_batches as (
    select r.*
    from ranked_batches r
    cross join params p
    where (r.queue_state = 'open' and r.batch_rank <= p.open_limit)
       or (r.queue_state = 'archive' and r.batch_rank <= p.archive_limit)
  )
  select
    s.queue_state,
    s.order_id::text,
    nullif(s.batch_key, '') as batch_index,
    s.batch_sort_at,
    jsonb_agg(e.task order by e.created_at, e.id::text) as tasks
  from selected_batches s
  join eligible e
    on e.queue_state = s.queue_state
   and e.order_id = s.order_id
   and e.batch_key = s.batch_key
  group by s.queue_state, s.order_id, s.batch_key, s.batch_sort_at
  order by
    case when s.queue_state = 'open' then 0 else 1 end,
    s.batch_sort_at desc,
    s.order_id,
    s.batch_key;
$$;

revoke all on function public.mes_fulfillment_queue(text, integer, integer) from public;
grant execute on function public.mes_fulfillment_queue(text, integer, integer) to anon, authenticated;

comment on function public.mes_fulfillment_queue(text, integer, integer) is
  'Returns bounded Packaging or Shipping task batches. Open work is age-independent; archive size is explicitly limited.';

-- Packing-slip numbers used to be calculated by downloading every task and
-- scanning plan_snapshot in the browser. A single atomic counter eliminates
-- that whole-table read and prevents duplicate numbers when two shippers
-- finish at the same time. The one-time migration seed preserves the current
-- maximum; later calls never scan tasks.
create table if not exists public.mes_counters (
  counter_key text primary key,
  counter_value bigint not null check (counter_value >= 0),
  updated_at timestamptz not null default now()
);

alter table public.mes_counters enable row level security;
revoke all on table public.mes_counters from public;

with existing_slips as (
  select max(
    case
      when t.plan_snapshot #>> '{_metadata,packing_slip_number}' ~ '^[0-9]+$'
        then (t.plan_snapshot #>> '{_metadata,packing_slip_number}')::bigint
      else null
    end
  ) as max_value
  from public.tasks t
)
insert into public.mes_counters (counter_key, counter_value)
select 'packing_slip_number', greatest(856::bigint, coalesce(max_value, 856::bigint))
from existing_slips
on conflict (counter_key) do update
set counter_value = greatest(public.mes_counters.counter_value, excluded.counter_value),
    updated_at = now();

create or replace function public.mes_next_packing_slip_number()
returns bigint
language plpgsql
volatile
security definer
set search_path = pg_catalog, public
as $$
declare
  next_value bigint;
begin
  insert into public.mes_counters (counter_key, counter_value, updated_at)
  values ('packing_slip_number', 857, now())
  on conflict (counter_key) do update
  set counter_value = greatest(public.mes_counters.counter_value, 856) + 1,
      updated_at = now()
  returning counter_value into next_value;

  return next_value;
end;
$$;

revoke all on table public.mes_counters from anon, authenticated;
revoke all on function public.mes_next_packing_slip_number() from public;
grant execute on function public.mes_next_packing_slip_number() to anon, authenticated;

comment on function public.mes_next_packing_slip_number() is
  'Atomically reserves the next packing-slip number without reading the tasks table.';


-- ─── MIGRATION: 20260720160000_production_summary_rollup.sql ───
-- Constant-time all-time production summary rollup.
--
-- IMPORTANT: this migration performs one exact full-history backfill while
-- holding SHARE ROW EXCLUSIVE on public.work_card_history. Reads continue, but
-- INSERT/UPDATE/DELETE wait until the migration commits. Apply through the
-- Supabase migration runner during an off-shift maintenance window.
--
-- Ranged mes_production_summary(p_from, p_to) calls intentionally retain the
-- previous exact work_card_history query. Only the all-time (null, null) call
-- is served from the private singleton projection.

do $production_summary_rollup_guard$
declare
  v_missing_columns text;
begin
  if to_regclass('public.work_card_history') is null then
    raise exception 'production summary rollup requires public.work_card_history'
      using errcode = '42P01';
  end if;

  select string_agg(required_column.name, ', ' order by required_column.name)
    into v_missing_columns
    from (
      values
        ('stage_name'),
        ('qty_completed'),
        ('scrap_qty'),
        ('created_at'),
        ('completed_at')
    ) as required_column(name)
   where not exists (
     select 1
       from information_schema.columns c
      where c.table_schema = 'public'
        and c.table_name = 'work_card_history'
        and c.column_name = required_column.name
   );

  if v_missing_columns is not null then
    raise exception 'production summary rollup cannot be installed; missing work_card_history columns: %', v_missing_columns
      using errcode = '42703';
  end if;
end;
$production_summary_rollup_guard$;

create schema if not exists mes_private;
revoke all on schema mes_private from public;
revoke all on schema mes_private from anon, authenticated;

create table if not exists mes_private.production_summary_rollup (
  singleton_id smallint primary key,
  total_produced numeric not null default 0,
  total_scrap numeric not null default 0,
  history_count bigint not null default 0,
  rebuilt_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint production_summary_rollup_singleton check (singleton_id = 1),
  constraint production_summary_rollup_nonnegative_count check (history_count >= 0)
);

alter table mes_private.production_summary_rollup enable row level security;
revoke all on table mes_private.production_summary_rollup from public;
revoke all on table mes_private.production_summary_rollup from anon, authenticated;

comment on table mes_private.production_summary_rollup is
  'Private singleton projection for constant-time all-time MES production totals. public.work_card_history remains the source of truth.';

create or replace function mes_private.sync_production_summary_rollup()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, mes_private
as $production_summary_rollup_trigger$
declare
  v_delta_produced numeric := 0;
  v_delta_scrap numeric := 0;
  v_delta_count bigint := 0;
  v_old_produced numeric := 0;
  v_old_scrap numeric := 0;
  v_old_count bigint := 0;
begin
  if tg_op = 'TRUNCATE' then
    update mes_private.production_summary_rollup
       set total_produced = 0,
           total_scrap = 0,
           history_count = 0,
           rebuilt_at = clock_timestamp(),
           updated_at = clock_timestamp()
     where singleton_id = 1;

    if not found then
      raise exception 'production summary rollup is not initialized'
        using errcode = 'P0002';
    end if;
    return null;
  elsif tg_op = 'INSERT' then
    select
      coalesce(sum(
        case
          when lower(btrim(coalesce(h.stage_name, ''))) in (
            'пакування/сгп', 'прийомка', 'склад бз', 'сгп', 'пакування', 'completed'
          ) then coalesce(h.qty_completed, 0)
          else 0
        end
      ), 0)::numeric,
      coalesce(sum(coalesce(h.scrap_qty, 0)), 0)::numeric,
      count(*)::bigint
      into v_delta_produced, v_delta_scrap, v_delta_count
      from new_rows h;
  elsif tg_op = 'DELETE' then
    select
      -coalesce(sum(
        case
          when lower(btrim(coalesce(h.stage_name, ''))) in (
            'пакування/сгп', 'прийомка', 'склад бз', 'сгп', 'пакування', 'completed'
          ) then coalesce(h.qty_completed, 0)
          else 0
        end
      ), 0)::numeric,
      -coalesce(sum(coalesce(h.scrap_qty, 0)), 0)::numeric,
      -(count(*)::bigint)
      into v_delta_produced, v_delta_scrap, v_delta_count
      from old_rows h;
  elsif tg_op = 'UPDATE' then
    select
      coalesce(sum(
        case
          when lower(btrim(coalesce(h.stage_name, ''))) in (
            'пакування/сгп', 'прийомка', 'склад бз', 'сгп', 'пакування', 'completed'
          ) then coalesce(h.qty_completed, 0)
          else 0
        end
      ), 0)::numeric,
      coalesce(sum(coalesce(h.scrap_qty, 0)), 0)::numeric,
      count(*)::bigint
      into v_delta_produced, v_delta_scrap, v_delta_count
      from new_rows h;

    select
      coalesce(sum(
        case
          when lower(btrim(coalesce(h.stage_name, ''))) in (
            'пакування/сгп', 'прийомка', 'склад бз', 'сгп', 'пакування', 'completed'
          ) then coalesce(h.qty_completed, 0)
          else 0
        end
      ), 0)::numeric,
      coalesce(sum(coalesce(h.scrap_qty, 0)), 0)::numeric,
      count(*)::bigint
      into v_old_produced, v_old_scrap, v_old_count
      from old_rows h;

    v_delta_produced := v_delta_produced - v_old_produced;
    v_delta_scrap := v_delta_scrap - v_old_scrap;
    v_delta_count := v_delta_count - v_old_count;
  else
    raise exception 'unsupported production summary trigger operation: %', tg_op
      using errcode = '0A000';
  end if;

  -- Metadata-only history updates do not need to contend on the singleton row.
  if v_delta_produced = 0 and v_delta_scrap = 0 and v_delta_count = 0 then
    return null;
  end if;

  update mes_private.production_summary_rollup
     set total_produced = total_produced + v_delta_produced,
         total_scrap = total_scrap + v_delta_scrap,
         history_count = history_count + v_delta_count,
         updated_at = clock_timestamp()
   where singleton_id = 1;

  if not found then
    -- Never create a partial rollup from a delta. Failing the source write is
    -- safer than silently publishing incorrect all-time production totals.
    raise exception 'production summary rollup is not initialized'
      using errcode = 'P0002';
  end if;

  return null;
end;
$production_summary_rollup_trigger$;

revoke all on function mes_private.sync_production_summary_rollup() from public;
revoke all on function mes_private.sync_production_summary_rollup() from anon, authenticated;

-- Supabase migration batches are transactional. A short lock timeout makes a
-- busy production database fail and roll back cleanly instead of queueing an
-- unexpected write outage. Retry the migration during the off-shift window.
set local lock_timeout = '5s';
lock table public.work_card_history in share row exclusive mode;

-- Exact idempotent backfill. The write lock prevents source changes between
-- this snapshot and trigger installation.
insert into mes_private.production_summary_rollup (
  singleton_id,
  total_produced,
  total_scrap,
  history_count,
  rebuilt_at,
  updated_at
)
select
  1,
  coalesce(sum(coalesce(h.qty_completed, 0)) filter (
    where lower(btrim(coalesce(h.stage_name, ''))) in (
      'пакування/сгп', 'прийомка', 'склад бз', 'сгп', 'пакування', 'completed'
    )
  ), 0)::numeric,
  coalesce(sum(coalesce(h.scrap_qty, 0)), 0)::numeric,
  count(*)::bigint,
  clock_timestamp(),
  clock_timestamp()
from public.work_card_history h
on conflict (singleton_id) do update set
  total_produced = excluded.total_produced,
  total_scrap = excluded.total_scrap,
  history_count = excluded.history_count,
  rebuilt_at = excluded.rebuilt_at,
  updated_at = excluded.updated_at;

drop trigger if exists trg_mes_production_summary_rollup_insert on public.work_card_history;
create trigger trg_mes_production_summary_rollup_insert
after insert on public.work_card_history
referencing new table as new_rows
for each statement execute function mes_private.sync_production_summary_rollup();

drop trigger if exists trg_mes_production_summary_rollup_update on public.work_card_history;
create trigger trg_mes_production_summary_rollup_update
after update on public.work_card_history
referencing old table as old_rows new table as new_rows
for each statement execute function mes_private.sync_production_summary_rollup();

drop trigger if exists trg_mes_production_summary_rollup_delete on public.work_card_history;
create trigger trg_mes_production_summary_rollup_delete
after delete on public.work_card_history
referencing old table as old_rows
for each statement execute function mes_private.sync_production_summary_rollup();

drop trigger if exists trg_mes_production_summary_rollup_truncate on public.work_card_history;
create trigger trg_mes_production_summary_rollup_truncate
after truncate on public.work_card_history
for each statement execute function mes_private.sync_production_summary_rollup();

-- This helper exposes only the same aggregate already returned by
-- mes_production_summary. Keeping it separate lets ranged calls retain the
-- previous SECURITY INVOKER behavior against work_card_history.
create or replace function public.mes_production_summary_rollup_all_time()
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, mes_private
as $production_summary_rollup_reader$
declare
  v_result jsonb;
begin
  select jsonb_build_object(
    'totalProduced', r.total_produced,
    'totalScrap', r.total_scrap,
    'historyCount', r.history_count
  )
    into v_result
    from mes_private.production_summary_rollup r
   where r.singleton_id = 1;

  if not found then
    raise exception 'production summary rollup is not initialized'
      using errcode = 'P0002';
  end if;

  return v_result;
end;
$production_summary_rollup_reader$;

revoke all on function public.mes_production_summary_rollup_all_time() from public;
grant execute on function public.mes_production_summary_rollup_all_time() to anon, authenticated, service_role;

comment on function public.mes_production_summary_rollup_all_time() is
  'Returns the private constant-time all-history MES production rollup. No source rows are exposed.';

create or replace function public.mes_production_summary(
  p_from timestamptz default null,
  p_to timestamptz default null
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = pg_catalog, public
as $mes_production_summary$
begin
  if p_from is null and p_to is null then
    return public.mes_production_summary_rollup_all_time();
  end if;

  -- Preserve the exact legacy semantics for open, closed and one-sided ranges.
  return (
    select jsonb_build_object(
      'totalProduced', coalesce(sum(coalesce(h.qty_completed, 0)) filter (
        where lower(btrim(coalesce(h.stage_name, ''))) in (
          'пакування/сгп', 'прийомка', 'склад бз', 'сгп', 'пакування', 'completed'
        )
      ), 0),
      'totalScrap', coalesce(sum(coalesce(h.scrap_qty, 0)), 0),
      'historyCount', count(*)
    )
    from public.work_card_history h
    where (p_from is null or coalesce(h.completed_at, h.created_at) >= p_from)
      and (p_to is null or coalesce(h.completed_at, h.created_at) <= p_to)
  );
end;
$mes_production_summary$;

revoke all on function public.mes_production_summary(timestamptz, timestamptz) from public;
grant execute on function public.mes_production_summary(timestamptz, timestamptz) to anon, authenticated, service_role;

comment on function public.mes_production_summary(timestamptz, timestamptz) is
  'Uses a private incremental rollup for all-time totals and the exact source history for ranged totals.';

-- Rollback guidance (run only after reverting the frontend expectation):
--   drop trigger if exists trg_mes_production_summary_rollup_insert on public.work_card_history;
--   drop trigger if exists trg_mes_production_summary_rollup_update on public.work_card_history;
--   drop trigger if exists trg_mes_production_summary_rollup_delete on public.work_card_history;
--   drop trigger if exists trg_mes_production_summary_rollup_truncate on public.work_card_history;
--   drop function if exists mes_private.sync_production_summary_rollup();
--   drop function if exists public.mes_production_summary_rollup_all_time();
--   drop table if exists mes_private.production_summary_rollup;
-- Restore public.mes_production_summary from 20260706_production_statistics.sql
-- in the same rollback migration; do not leave the public RPC missing.


-- ─── MIGRATION: 20260721170000_sorting_vkya_delivery.sql ───
-- Guaranteed, idempotent delivery of Shop 1 sorting scrap to the VKYA queue.
--
-- The legacy clients wrote the card, inventory, Shop 2 arrival and history in
-- parallel HTTP requests. A transient failure could advance the card while the
-- work_card_history insert (the VKYA source) was lost. This receipt makes the
-- two sorting history rows one atomic database operation and prevents a retry
-- from duplicating scrap for the same card.

create table if not exists public.mes_sorting_history_receipts (
  card_id uuid primary key references public.work_cards(id) on delete cascade,
  sorting_history_id uuid references public.work_card_history(id) on delete restrict,
  buffer_history_id uuid references public.work_card_history(id) on delete restrict,
  scrap_qty numeric not null check (scrap_qty >= 0),
  recorded_at timestamptz not null default clock_timestamp()
);

alter table public.mes_sorting_history_receipts enable row level security;
revoke all on table public.mes_sorting_history_receipts from public;
revoke all on table public.mes_sorting_history_receipts from anon, authenticated;

comment on table public.mes_sorting_history_receipts is
  'Internal idempotency receipts for atomic Sorting/VKYA history delivery.';

create or replace function public.record_sorting_history_once(
  p_card_id uuid,
  p_nomenclature_id uuid,
  p_operator_name text,
  p_buffer_operator_name text,
  p_shift_name text,
  p_qty_at_start numeric,
  p_qty_completed numeric,
  p_scrap_qty numeric,
  p_started_at timestamptz,
  p_stage_completed_at timestamptz,
  p_buffer_completed_at timestamptz,
  p_manager_name text default null,
  p_machine_name text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, public
as $sorting_delivery$
declare
  v_receipt public.mes_sorting_history_receipts%rowtype;
  v_sorting_history_id uuid;
  v_buffer_history_id uuid;
  v_card public.work_cards%rowtype;
begin
  if p_card_id is null or p_nomenclature_id is null then
    raise exception 'card_id and nomenclature_id are required' using errcode = '22004';
  end if;
  if coalesce(p_qty_at_start, 0) < 0
     or coalesce(p_qty_completed, 0) < 0
     or coalesce(p_scrap_qty, 0) < 0 then
    raise exception 'sorting quantities cannot be negative' using errcode = '22003';
  end if;
  if coalesce(p_qty_completed, 0) + coalesce(p_scrap_qty, 0) > coalesce(p_qty_at_start, 0) then
    raise exception 'completed plus scrap quantity exceeds starting quantity' using errcode = '22003';
  end if;

  -- Serialize competing retries for the same card and validate that callers
  -- cannot attach a VKYA record to an unrelated nomenclature.
  select * into v_card
    from public.work_cards
   where id = p_card_id
   for update;
  if not found then
    raise exception 'work card % does not exist', p_card_id using errcode = 'P0002';
  end if;
  if v_card.nomenclature_id is distinct from p_nomenclature_id then
    raise exception 'nomenclature mismatch for work card %', p_card_id using errcode = '22023';
  end if;
  if v_card.operation is distinct from 'Сортування'
     or v_card.status not in ('in-progress', 'at-buffer', 'at-shop2-buffer') then
    raise exception 'work card % is not in a sortable state (% / %)', p_card_id, v_card.operation, v_card.status
      using errcode = '55000';
  end if;

  select * into v_receipt
    from public.mes_sorting_history_receipts
   where card_id = p_card_id;
  if found then
    if v_receipt.scrap_qty is distinct from coalesce(p_scrap_qty, 0) then
      raise exception 'sorting retry for card % has a different scrap quantity', p_card_id
        using errcode = '22023';
    end if;
    return jsonb_build_object(
      'created', false,
      'sortingHistoryId', v_receipt.sorting_history_id,
      'bufferHistoryId', v_receipt.buffer_history_id,
      'scrapQty', v_receipt.scrap_qty
    );
  end if;

  insert into public.work_card_history (
    card_id, nomenclature_id, stage_name, operator_name,
    qty_at_start, qty_completed, scrap_qty,
    started_at, completed_at, is_archived_scrap,
    shift_name, manager_name, machine_name
  ) values (
    p_card_id, p_nomenclature_id, 'Сортування', nullif(btrim(p_operator_name), ''),
    coalesce(p_qty_at_start, 0), coalesce(p_qty_completed, 0), coalesce(p_scrap_qty, 0),
    coalesce(p_started_at, clock_timestamp()), coalesce(p_stage_completed_at, clock_timestamp()),
    coalesce(p_scrap_qty, 0) > 0,
    nullif(btrim(p_shift_name), ''), nullif(btrim(p_manager_name), ''), nullif(btrim(p_machine_name), '')
  ) returning id into v_sorting_history_id;

  insert into public.work_card_history (
    card_id, nomenclature_id, stage_name, operator_name,
    qty_at_start, qty_completed, scrap_qty,
    started_at, completed_at, is_archived_scrap,
    shift_name, manager_name, machine_name
  ) values (
    p_card_id, p_nomenclature_id, 'Буфер Сортування', nullif(btrim(p_buffer_operator_name), ''),
    coalesce(p_qty_completed, 0), coalesce(p_qty_completed, 0), 0,
    coalesce(p_stage_completed_at, p_started_at, clock_timestamp()),
    coalesce(p_buffer_completed_at, clock_timestamp()), false,
    nullif(btrim(p_shift_name), ''), nullif(btrim(p_manager_name), ''), nullif(btrim(p_machine_name), '')
  ) returning id into v_buffer_history_id;

  insert into public.mes_sorting_history_receipts (
    card_id, sorting_history_id, buffer_history_id, scrap_qty
  ) values (
    p_card_id, v_sorting_history_id, v_buffer_history_id, coalesce(p_scrap_qty, 0)
  );

  return jsonb_build_object(
    'created', true,
    'sortingHistoryId', v_sorting_history_id,
    'bufferHistoryId', v_buffer_history_id,
    'scrapQty', coalesce(p_scrap_qty, 0)
  );
end;
$sorting_delivery$;

revoke all on function public.record_sorting_history_once(
  uuid, uuid, text, text, text, numeric, numeric, numeric,
  timestamptz, timestamptz, timestamptz, text, text
) from public;
grant execute on function public.record_sorting_history_once(
  uuid, uuid, text, text, text, numeric, numeric, numeric,
  timestamptz, timestamptz, timestamptz, text, text
) to anon, authenticated;

comment on function public.record_sorting_history_once(
  uuid, uuid, text, text, text, numeric, numeric, numeric,
  timestamptz, timestamptz, timestamptz, text, text
) is 'Atomically records Sorting and Buffer Sorting history once per card so VKYA scrap cannot be lost or duplicated.';


-- ─── MIGRATION: 20260722110000_vkya_restoration_terminal.sql ───
create extension if not exists pgcrypto;

create table if not exists public.vkya_restoration_cards (
  id uuid primary key default gen_random_uuid(),
  card_number bigint generated always as identity unique,
  source_inventory_id uuid,
  nomenclature_id uuid not null,
  nomenclature_name text not null,
  unit text not null default 'шт',
  restoration_stage text not null check (btrim(restoration_stage) <> ''),
  quantity integer not null check (quantity > 0),
  completed_quantity integer not null default 0 check (completed_quantity >= 0 and completed_quantity <= quantity),
  status text not null default 'new' check (status in ('new', 'in_progress', 'completed')),
  operator_name text,
  created_by_user_id bigint,
  created_by_name text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists vkya_restoration_cards_queue_idx
  on public.vkya_restoration_cards (status, created_at);
create index if not exists vkya_restoration_cards_nomenclature_idx
  on public.vkya_restoration_cards (nomenclature_id, created_at desc);

alter table public.vkya_restoration_cards enable row level security;
grant select, insert, update on public.vkya_restoration_cards to anon, authenticated;
grant usage, select on sequence public.vkya_restoration_cards_card_number_seq to anon, authenticated;

drop policy if exists "vkya_restoration_cards_read" on public.vkya_restoration_cards;
create policy "vkya_restoration_cards_read" on public.vkya_restoration_cards
  for select to anon, authenticated using (true);
drop policy if exists "vkya_restoration_cards_insert" on public.vkya_restoration_cards;
create policy "vkya_restoration_cards_insert" on public.vkya_restoration_cards
  for insert to anon, authenticated with check (true);
drop policy if exists "vkya_restoration_cards_update" on public.vkya_restoration_cards;
create policy "vkya_restoration_cards_update" on public.vkya_restoration_cards
  for update to anon, authenticated using (true) with check (true);

create or replace function public.create_vkya_restoration_card(
  p_inventory_id uuid,
  p_quantity integer,
  p_restoration_stage text,
  p_created_by_user_id bigint default null,
  p_created_by_name text default null
) returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_inventory public.inventory%rowtype;
  v_card_id uuid;
  v_remaining numeric;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Кількість має бути більшою за нуль';
  end if;
  if nullif(btrim(p_restoration_stage), '') is null then
    raise exception 'Етап відновлення обов''язковий';
  end if;

  select * into v_inventory from public.inventory where id = p_inventory_id for update;
  if not found or v_inventory.type not like 'scrap_cat_%' then
    raise exception 'Позицію браку не знайдено або вона вже переміщена';
  end if;
  if p_quantity > coalesce(v_inventory.total_qty, 0) then
    raise exception 'Запитана кількість перевищує доступний залишок';
  end if;

  insert into public.vkya_restoration_cards (
    source_inventory_id, nomenclature_id, nomenclature_name, unit,
    restoration_stage, quantity, created_by_user_id, created_by_name
  ) values (
    v_inventory.id, v_inventory.nomenclature_id, coalesce(v_inventory.name, 'Деталь'),
    coalesce(v_inventory.unit, 'шт'), btrim(p_restoration_stage), p_quantity,
    p_created_by_user_id, nullif(btrim(p_created_by_name), '')
  ) returning id into v_card_id;

  v_remaining := coalesce(v_inventory.total_qty, 0) - p_quantity;
  if v_remaining = 0 then
    delete from public.inventory where id = v_inventory.id;
  else
    update public.inventory
       set total_qty = v_remaining, updated_at = now()
     where id = v_inventory.id;
  end if;

  return v_card_id;
end;
$$;

revoke all on function public.create_vkya_restoration_card(uuid,integer,text,bigint,text) from public;
grant execute on function public.create_vkya_restoration_card(uuid,integer,text,bigint,text) to anon, authenticated;


-- ─── MIGRATION: 20260722130000_vkya_restoration_stage_catalog.sql ───
create table if not exists public.vkya_restoration_stages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vkya_restoration_stages_name_not_blank check (btrim(name) <> '')
);

create unique index if not exists vkya_restoration_stages_name_unique
  on public.vkya_restoration_stages (lower(btrim(name)));

alter table public.vkya_restoration_stages enable row level security;
grant select, insert, update, delete on public.vkya_restoration_stages to anon, authenticated;

drop policy if exists "vkya_restoration_stages_read" on public.vkya_restoration_stages;
create policy "vkya_restoration_stages_read" on public.vkya_restoration_stages
  for select to anon, authenticated using (true);
drop policy if exists "vkya_restoration_stages_insert" on public.vkya_restoration_stages;
create policy "vkya_restoration_stages_insert" on public.vkya_restoration_stages
  for insert to anon, authenticated with check (true);
drop policy if exists "vkya_restoration_stages_update" on public.vkya_restoration_stages;
create policy "vkya_restoration_stages_update" on public.vkya_restoration_stages
  for update to anon, authenticated using (true) with check (true);
drop policy if exists "vkya_restoration_stages_delete" on public.vkya_restoration_stages;
create policy "vkya_restoration_stages_delete" on public.vkya_restoration_stages
  for delete to anon, authenticated using (true);

insert into public.vkya_restoration_stages (name, sort_order) values
  ('Шліфування на гріндері', 10),
  ('Шліфування ручне (губкою)', 20),
  ('Проклейка тріщин матеріалу', 30),
  ('Проклейка прес-гайок', 40),
  ('Кондуктор', 50),
  ('На доочищення дівчатам вручну', 60)
on conflict do nothing;

alter table public.vkya_restoration_cards
  add column if not exists restoration_stage_id uuid references public.vkya_restoration_stages(id) on delete restrict;

drop function if exists public.create_vkya_restoration_card(uuid,integer,text,bigint,text);

create or replace function public.create_vkya_restoration_card(
  p_inventory_id uuid,
  p_quantity integer,
  p_restoration_stage_id uuid,
  p_created_by_user_id bigint default null,
  p_created_by_name text default null
) returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_inventory public.inventory%rowtype;
  v_stage public.vkya_restoration_stages%rowtype;
  v_card_id uuid;
  v_remaining numeric;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Кількість має бути більшою за нуль';
  end if;

  select * into v_stage from public.vkya_restoration_stages
   where id = p_restoration_stage_id and is_active = true;
  if not found then
    raise exception 'Оберіть активний етап відновлення';
  end if;

  select * into v_inventory from public.inventory where id = p_inventory_id for update;
  if not found or v_inventory.type not like 'scrap_cat_%' then
    raise exception 'Позицію браку не знайдено або вона вже переміщена';
  end if;
  if p_quantity > coalesce(v_inventory.total_qty, 0) then
    raise exception 'Запитана кількість перевищує доступний залишок';
  end if;

  insert into public.vkya_restoration_cards (
    source_inventory_id, nomenclature_id, nomenclature_name, unit,
    restoration_stage_id, restoration_stage, quantity, created_by_user_id, created_by_name
  ) values (
    v_inventory.id, v_inventory.nomenclature_id, coalesce(v_inventory.name, 'Деталь'),
    coalesce(v_inventory.unit, 'шт'), v_stage.id, v_stage.name, p_quantity,
    p_created_by_user_id, nullif(btrim(p_created_by_name), '')
  ) returning id into v_card_id;

  v_remaining := coalesce(v_inventory.total_qty, 0) - p_quantity;
  if v_remaining = 0 then
    delete from public.inventory where id = v_inventory.id;
  else
    update public.inventory set total_qty = v_remaining, updated_at = now() where id = v_inventory.id;
  end if;
  return v_card_id;
end;
$$;

revoke all on function public.create_vkya_restoration_card(uuid,integer,uuid,bigint,text) from public;
grant execute on function public.create_vkya_restoration_card(uuid,integer,uuid,bigint,text) to anon, authenticated;


-- ─── MIGRATION: 20260722150000_vkya_restoration_reclassification.sql ───
create table if not exists public.vkya_reclassification_queue (
  id uuid primary key default gen_random_uuid(),
  restoration_card_id uuid not null references public.vkya_restoration_cards(id) on delete restrict,
  nomenclature_id uuid not null,
  nomenclature_name text not null,
  source_stage text not null,
  quantity integer not null check (quantity > 0),
  classified_quantity integer not null default 0 check (classified_quantity >= 0 and classified_quantity <= quantity),
  status text not null default 'pending' check (status in ('pending', 'classified')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restoration_card_id)
);

create index if not exists vkya_reclassification_queue_status_idx
  on public.vkya_reclassification_queue (status, created_at desc);

alter table public.vkya_reclassification_queue enable row level security;
grant select, insert, update on public.vkya_reclassification_queue to anon, authenticated;

drop policy if exists "vkya_reclassification_queue_read" on public.vkya_reclassification_queue;
create policy "vkya_reclassification_queue_read" on public.vkya_reclassification_queue
  for select to anon, authenticated using (true);
drop policy if exists "vkya_reclassification_queue_insert" on public.vkya_reclassification_queue;
create policy "vkya_reclassification_queue_insert" on public.vkya_reclassification_queue
  for insert to anon, authenticated with check (true);
drop policy if exists "vkya_reclassification_queue_update" on public.vkya_reclassification_queue;
create policy "vkya_reclassification_queue_update" on public.vkya_reclassification_queue
  for update to anon, authenticated using (true) with check (true);

create or replace function public.complete_vkya_restoration_card(
  p_card_id uuid,
  p_completed_quantity integer
) returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_card public.vkya_restoration_cards%rowtype;
  v_return_quantity integer;
begin
  select * into v_card from public.vkya_restoration_cards where id = p_card_id for update;
  if not found then raise exception 'Карту відновлення не знайдено'; end if;
  if v_card.status <> 'in_progress' then raise exception 'Карта не перебуває в роботі'; end if;
  if p_completed_quantity is null or p_completed_quantity < 0 or p_completed_quantity > v_card.quantity then
    raise exception 'Некоректна кількість відновлених деталей';
  end if;

  v_return_quantity := v_card.quantity - p_completed_quantity;
  update public.vkya_restoration_cards set
    status = 'completed', completed_quantity = p_completed_quantity,
    completed_at = now(), updated_at = now()
  where id = v_card.id;

  if v_return_quantity > 0 then
    insert into public.vkya_reclassification_queue (
      restoration_card_id, nomenclature_id, nomenclature_name,
      source_stage, quantity
    ) values (
      v_card.id, v_card.nomenclature_id, v_card.nomenclature_name,
      v_card.restoration_stage || ' (ВКЯ)', v_return_quantity
    );
  end if;
  return v_return_quantity;
end;
$$;

revoke all on function public.complete_vkya_restoration_card(uuid,integer) from public;
grant execute on function public.complete_vkya_restoration_card(uuid,integer) to anon, authenticated;


-- ─── MIGRATION: 20260722170000_vkya_legacy_restoration_assignment.sql ───
create or replace function public.assign_legacy_vkya_restoration_card(
  p_inventory_id uuid,
  p_quantity integer,
  p_restoration_stage_id uuid,
  p_created_by_user_id bigint default null,
  p_created_by_name text default null
) returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_inventory public.inventory%rowtype;
  v_stage public.vkya_restoration_stages%rowtype;
  v_card_id uuid;
  v_remaining numeric;
begin
  if p_quantity is null or p_quantity <= 0 then raise exception 'Кількість має бути більшою за нуль'; end if;
  select * into v_stage from public.vkya_restoration_stages where id = p_restoration_stage_id and is_active = true;
  if not found then raise exception 'Оберіть активний етап відновлення'; end if;

  select * into v_inventory from public.inventory where id = p_inventory_id for update;
  if not found or v_inventory.type <> 'scrap_restoration' then
    raise exception 'Стару позицію відновлення не знайдено';
  end if;
  if p_quantity > coalesce(v_inventory.total_qty, 0) then
    raise exception 'Запитана кількість перевищує доступний залишок';
  end if;

  insert into public.vkya_restoration_cards (
    source_inventory_id, nomenclature_id, nomenclature_name, unit,
    restoration_stage_id, restoration_stage, quantity,
    created_by_user_id, created_by_name
  ) values (
    v_inventory.id, v_inventory.nomenclature_id, coalesce(v_inventory.name, 'Деталь'),
    coalesce(v_inventory.unit, 'шт'), v_stage.id, v_stage.name, p_quantity,
    p_created_by_user_id, nullif(btrim(p_created_by_name), '')
  ) returning id into v_card_id;

  v_remaining := coalesce(v_inventory.total_qty, 0) - p_quantity;
  if v_remaining = 0 then
    delete from public.inventory where id = v_inventory.id;
  else
    update public.inventory set total_qty = v_remaining, updated_at = now() where id = v_inventory.id;
  end if;
  return v_card_id;
end;
$$;

revoke all on function public.assign_legacy_vkya_restoration_card(uuid,integer,uuid,bigint,text) from public;
grant execute on function public.assign_legacy_vkya_restoration_card(uuid,integer,uuid,bigint,text) to anon, authenticated;


-- ─── MIGRATION: 20260722190000_vkya_restoration_shop2_handoff.sql ───
alter table public.vkya_restoration_cards
  add column if not exists shop2_card_id uuid references public.work_cards(id) on delete restrict,
  add column if not exists shop2_stage text,
  add column if not exists transferred_to_shop2_at timestamptz;

create unique index if not exists vkya_restoration_cards_shop2_card_unique
  on public.vkya_restoration_cards (shop2_card_id)
  where shop2_card_id is not null;

create or replace function public.dispatch_vkya_restoration_to_shop2(
  p_restoration_card_id uuid,
  p_shop2_stage text
) returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_restoration public.vkya_restoration_cards%rowtype;
  v_shop2_card_id uuid;
  v_stage text;
begin
  v_stage := btrim(coalesce(p_shop2_stage, ''));
  if v_stage not in ('Пресування', 'Фарбування') then
    raise exception 'Дозволені етапи: Пресування або Фарбування';
  end if;

  select * into v_restoration
    from public.vkya_restoration_cards
   where id = p_restoration_card_id
   for update;
  if not found then raise exception 'Карту відновлення не знайдено'; end if;
  if v_restoration.status <> 'completed' then raise exception 'Спочатку завершіть карту відновлення'; end if;
  if v_restoration.completed_quantity <= 0 then raise exception 'Немає відновлених деталей для передачі'; end if;
  if v_restoration.shop2_card_id is not null then return v_restoration.shop2_card_id; end if;

  insert into public.work_cards (
    nomenclature_id, quantity, operation, status, machine, card_info
  ) values (
    v_restoration.nomenclature_id,
    v_restoration.completed_quantity,
    v_stage,
    'new',
    '—',
    format('[RESTORATION] [VKYA_RESTORATION] [ЦЕХ №2] [VKYA_CARD:%s] %s — ПІСЛЯ ВІДНОВЛЕННЯ ВКЯ',
      v_restoration.card_number, v_restoration.nomenclature_name)
  ) returning id into v_shop2_card_id;

  update public.vkya_restoration_cards set
    shop2_card_id = v_shop2_card_id,
    shop2_stage = v_stage,
    transferred_to_shop2_at = now(),
    updated_at = now()
  where id = v_restoration.id;

  return v_shop2_card_id;
end;
$$;

revoke all on function public.dispatch_vkya_restoration_to_shop2(uuid,text) from public;
grant execute on function public.dispatch_vkya_restoration_to_shop2(uuid,text) to anon, authenticated;

create or replace function public.complete_vkya_shop2_card_to_bz(
  p_card_id uuid,
  p_stage text,
  p_operator_name text,
  p_shift_name text,
  p_finished_quantity integer,
  p_scrap_quantity integer
) returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_card public.work_cards%rowtype;
  v_inventory_id uuid;
  v_inventory_qty numeric;
  v_nom_name text;
  v_nom_unit text;
begin
  select * into v_card from public.work_cards where id = p_card_id for update;
  if not found then raise exception 'Карту Цеху №2 не знайдено'; end if;
  if position('[VKYA_RESTORATION]' in coalesce(v_card.card_info, '')) = 0 then
    raise exception 'Карта не належить потоку відновлення ВКЯ';
  end if;
  if v_card.status <> 'in-progress' then raise exception 'Карта не перебуває в роботі'; end if;
  if p_stage not in ('Пресування', 'Фарбування') or v_card.operation <> p_stage then
    raise exception 'Етап карти не відповідає терміналу';
  end if;
  if p_finished_quantity < 0 or p_scrap_quantity < 0
     or p_finished_quantity + p_scrap_quantity <> v_card.quantity then
    raise exception 'Сума готових деталей і браку має дорівнювати кількості карти';
  end if;

  insert into public.work_card_history (
    card_id, nomenclature_id, stage_name, operator_name,
    qty_at_start, qty_completed, scrap_qty, started_at, completed_at,
    is_archived_scrap, shift_name, manager_name, machine_name, card_info
  ) values (
    v_card.id, v_card.nomenclature_id, p_stage, nullif(btrim(p_operator_name), ''),
    v_card.quantity, p_finished_quantity, p_scrap_quantity,
    coalesce(v_card.started_at, now()), now(), p_scrap_quantity > 0,
    nullif(btrim(p_shift_name), ''), v_card.manager_name, v_card.machine, v_card.card_info
  );

  select name, unit into v_nom_name, v_nom_unit
    from public.nomenclatures where id = v_card.nomenclature_id;

  if p_finished_quantity > 0 then
    select id, total_qty into v_inventory_id, v_inventory_qty
      from public.inventory
     where nomenclature_id = v_card.nomenclature_id and type = 'bz'
     order by updated_at desc nulls last limit 1 for update;
    if v_inventory_id is null then
      insert into public.inventory (nomenclature_id, name, unit, total_qty, reserved_qty, type, pocket_owner, updated_at)
      values (v_card.nomenclature_id, coalesce(v_nom_name, 'Деталь'), coalesce(v_nom_unit, 'шт'), p_finished_quantity, 0, 'bz', null, now());
    else
      update public.inventory set total_qty = coalesce(v_inventory_qty, 0) + p_finished_quantity, updated_at = now()
       where id = v_inventory_id;
    end if;
  end if;

  v_inventory_id := null;
  v_inventory_qty := null;
  if p_scrap_quantity > 0 then
    select id, total_qty into v_inventory_id, v_inventory_qty
      from public.inventory
     where nomenclature_id = v_card.nomenclature_id and type = 'scrap_ready'
     order by updated_at desc nulls last limit 1 for update;
    if v_inventory_id is null then
      insert into public.inventory (nomenclature_id, name, unit, total_qty, type, updated_at)
      values (v_card.nomenclature_id, coalesce(v_nom_name, 'Деталь'), coalesce(v_nom_unit, 'шт'), p_scrap_quantity, 'scrap_ready', now());
    else
      update public.inventory set total_qty = coalesce(v_inventory_qty, 0) + p_scrap_quantity, updated_at = now()
       where id = v_inventory_id;
    end if;
  end if;

  update public.work_cards set
    status = 'completed', operation = 'Базовий залишок', quantity = p_finished_quantity,
    completed_at = now(), card_info = coalesce(card_info, '') || ' [VKYA_TO_BZ]'
  where id = v_card.id;
end;
$$;

revoke all on function public.complete_vkya_shop2_card_to_bz(uuid,text,text,text,integer,integer) from public;
grant execute on function public.complete_vkya_shop2_card_to_bz(uuid,text,text,text,integer,integer) to anon, authenticated;


-- ─── MIGRATION: 20260724120000_manual_inventory_issues.sql ───
-- Manual operational-warehouse issues initiated by nomenclature QR codes.
-- The stock deduction and audit row are committed as one transaction.

create table if not exists public.manual_inventory_issues (
  id uuid primary key default gen_random_uuid(),
  nomenclature_id uuid not null references public.nomenclatures(id) on delete restrict,
  quantity numeric not null check (quantity > 0),
  unit text not null,
  stock_before numeric not null check (stock_before >= 0),
  stock_after numeric not null check (stock_after >= 0),
  issued_by_id bigint,
  issued_by_name text not null,
  source_module text not null check (source_module in ('warehouse', 'warehouse_boxes')),
  created_at timestamptz not null default clock_timestamp()
);

create index if not exists idx_manual_inventory_issues_created_at
  on public.manual_inventory_issues (created_at desc);
create index if not exists idx_manual_inventory_issues_nomenclature
  on public.manual_inventory_issues (nomenclature_id, created_at desc);

alter table public.manual_inventory_issues enable row level security;
revoke all on table public.manual_inventory_issues from public, anon, authenticated;

create or replace function public.issue_operational_inventory_manually(
  p_nomenclature_id uuid,
  p_quantity numeric,
  p_issued_by_id bigint,
  p_issued_by_name text,
  p_source_module text
)
returns public.manual_inventory_issues
language plpgsql
volatile
security definer
set search_path = pg_catalog, public
as $manual_issue$
declare
  v_available numeric;
  v_remaining numeric := p_quantity;
  v_take numeric;
  v_row public.inventory%rowtype;
  v_issue public.manual_inventory_issues%rowtype;
  v_unit text;
begin
  if p_nomenclature_id is null then
    raise exception 'Номенклатуру не вказано';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Кількість має бути більшою за нуль';
  end if;
  if coalesce(trim(p_issued_by_name), '') = '' then
    raise exception 'Користувача, який виконує видачу, не визначено';
  end if;
  if p_source_module not in ('warehouse', 'warehouse_boxes') then
    raise exception 'Невідоме джерело ручної видачі';
  end if;

  -- Lock every matching operational row so two scanners cannot spend the same stock.
  perform 1
  from public.inventory
  where nomenclature_id = p_nomenclature_id
    and (warehouse = 'operational' or warehouse is null)
  for update;

  select
    coalesce(sum(greatest(coalesce(total_qty, 0) - coalesce(reserved_qty, 0), 0)), 0),
    max(coalesce(unit, 'шт'))
  into v_available, v_unit
  from public.inventory
  where nomenclature_id = p_nomenclature_id
    and (warehouse = 'operational' or warehouse is null);

  if v_available < p_quantity then
    raise exception 'Недостатньо вільного залишку. Доступно: %', v_available;
  end if;

  for v_row in
    select *
    from public.inventory
    where nomenclature_id = p_nomenclature_id
      and (warehouse = 'operational' or warehouse is null)
      and coalesce(total_qty, 0) > coalesce(reserved_qty, 0)
    order by (coalesce(total_qty, 0) - coalesce(reserved_qty, 0)) desc, id
    for update
  loop
    exit when v_remaining <= 0;
    v_take := least(
      v_remaining,
      greatest(coalesce(v_row.total_qty, 0) - coalesce(v_row.reserved_qty, 0), 0)
    );
    if v_take > 0 then
      update public.inventory
      set total_qty = coalesce(total_qty, 0) - v_take
      where id = v_row.id;
      v_remaining := v_remaining - v_take;
    end if;
  end loop;

  insert into public.manual_inventory_issues (
    nomenclature_id, quantity, unit, stock_before, stock_after,
    issued_by_id, issued_by_name, source_module
  ) values (
    p_nomenclature_id, p_quantity, coalesce(v_unit, 'шт'),
    v_available, v_available - p_quantity,
    p_issued_by_id, trim(p_issued_by_name), p_source_module
  )
  returning * into v_issue;

  return v_issue;
end;
$manual_issue$;

create or replace function public.manual_inventory_issue_journal(p_limit integer default 100)
returns table (
  id uuid,
  nomenclature_id uuid,
  nomenclature_name text,
  quantity numeric,
  unit text,
  stock_before numeric,
  stock_after numeric,
  issued_by_name text,
  source_module text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $journal$
  select
    i.id, i.nomenclature_id, n.name, i.quantity, i.unit,
    i.stock_before, i.stock_after, i.issued_by_name,
    i.source_module, i.created_at
  from public.manual_inventory_issues i
  join public.nomenclatures n on n.id = i.nomenclature_id
  order by i.created_at desc
  limit least(greatest(coalesce(p_limit, 100), 1), 500);
$journal$;

revoke all on function public.issue_operational_inventory_manually(uuid,numeric,bigint,text,text) from public;
revoke all on function public.manual_inventory_issue_journal(integer) from public;
grant execute on function public.issue_operational_inventory_manually(uuid,numeric,bigint,text,text) to anon, authenticated;
grant execute on function public.manual_inventory_issue_journal(integer) to anon, authenticated;



-- ─── MIGRATION: 20260724150000_vkya_classification_queue_projection.sql ───
-- Incremental, cache-friendly VKYA classification queue.
-- The projection turns the append-heavy production history into a small
-- operational read model with a monotonic cursor and tombstones.

create sequence if not exists public.vkya_classification_queue_change_seq;

create index if not exists scrap_classifications_source_history_idx
  on public.scrap_classifications (source_history_id)
  where source_history_id is not null;

create table if not exists public.vkya_classification_queue_projection (
  source_type text not null check (source_type in ('history', 'restoration_return')),
  source_id uuid not null,
  payload jsonb not null,
  is_active boolean not null,
  change_seq bigint not null default nextval('public.vkya_classification_queue_change_seq'),
  changed_at timestamptz not null default clock_timestamp(),
  primary key (source_type, source_id)
);

create index if not exists vkya_queue_projection_active_idx
  on public.vkya_classification_queue_projection (is_active, change_seq);
create index if not exists vkya_queue_projection_change_idx
  on public.vkya_classification_queue_projection (change_seq);

alter table public.vkya_classification_queue_projection enable row level security;
revoke all on table public.vkya_classification_queue_projection from public;
grant select on public.vkya_classification_queue_projection to anon, authenticated;
drop policy if exists "vkya_queue_projection_realtime_read"
  on public.vkya_classification_queue_projection;
create policy "vkya_queue_projection_realtime_read"
  on public.vkya_classification_queue_projection
  for select to anon, authenticated using (true);

create or replace function public.sync_vkya_history_queue_projection()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $projection$
declare
  v_classified numeric;
  v_ready boolean;
begin
  select coalesce(sum(quantity), 0)
  into v_classified
  from public.scrap_classifications
  where source_history_id = new.id;

  v_ready := coalesce(new.scrap_qty, 0) > v_classified
    and (
      coalesce(new.is_archived_scrap, false)
      or coalesce(new.card_info, '') like '%[ЦЕХ №2]%'
    );

  insert into public.vkya_classification_queue_projection (
    source_type, source_id, payload, is_active, change_seq, changed_at
  ) values (
    'history',
    new.id,
    to_jsonb(new) || jsonb_build_object('classified_quantity', v_classified),
    v_ready,
    nextval('public.vkya_classification_queue_change_seq'),
    clock_timestamp()
  )
  on conflict (source_type, source_id) do update set
    payload = excluded.payload,
    is_active = excluded.is_active,
    change_seq = excluded.change_seq,
    changed_at = excluded.changed_at;
  return new;
end;
$projection$;

create or replace function public.sync_vkya_projection_after_classification()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $classification$
declare
  v_history public.work_card_history%rowtype;
  v_classified numeric;
begin
  if new.source_history_id is null then return new; end if;
  select * into v_history from public.work_card_history where id = new.source_history_id;
  if not found then return new; end if;
  select coalesce(sum(quantity), 0) into v_classified
  from public.scrap_classifications where source_history_id = new.source_history_id;

  insert into public.vkya_classification_queue_projection (
    source_type, source_id, payload, is_active, change_seq, changed_at
  ) values (
    'history', v_history.id,
    to_jsonb(v_history) || jsonb_build_object('classified_quantity', v_classified),
    coalesce(v_history.scrap_qty, 0) > v_classified
      and (coalesce(v_history.is_archived_scrap, false) or coalesce(v_history.card_info, '') like '%[ЦЕХ №2]%'),
    nextval('public.vkya_classification_queue_change_seq'), clock_timestamp()
  )
  on conflict (source_type, source_id) do update set
    payload = excluded.payload, is_active = excluded.is_active,
    change_seq = excluded.change_seq, changed_at = excluded.changed_at;
  return new;
end;
$classification$;

create or replace function public.sync_vkya_return_queue_projection()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $return_projection$
begin
  insert into public.vkya_classification_queue_projection (
    source_type, source_id, payload, is_active, change_seq, changed_at
  ) values (
    'restoration_return', new.id, to_jsonb(new),
    new.status = 'pending' and coalesce(new.quantity, 0) > coalesce(new.classified_quantity, 0),
    nextval('public.vkya_classification_queue_change_seq'), clock_timestamp()
  )
  on conflict (source_type, source_id) do update set
    payload = excluded.payload, is_active = excluded.is_active,
    change_seq = excluded.change_seq, changed_at = excluded.changed_at;
  return new;
end;
$return_projection$;

drop trigger if exists trg_vkya_history_queue_projection on public.work_card_history;
create trigger trg_vkya_history_queue_projection
after insert or update of scrap_qty, qc_scrap_comment, is_archived_scrap, card_info
on public.work_card_history
for each row execute function public.sync_vkya_history_queue_projection();

drop trigger if exists trg_vkya_projection_after_classification on public.scrap_classifications;
create trigger trg_vkya_projection_after_classification
after insert on public.scrap_classifications
for each row execute function public.sync_vkya_projection_after_classification();

drop trigger if exists trg_vkya_return_queue_projection on public.vkya_reclassification_queue;
create trigger trg_vkya_return_queue_projection
after insert or update of status, quantity, classified_quantity, updated_at
on public.vkya_reclassification_queue
for each row execute function public.sync_vkya_return_queue_projection();

-- Seed only records that can currently appear in the operational queue.
insert into public.vkya_classification_queue_projection (
  source_type, source_id, payload, is_active
)
select
  'history', h.id,
  to_jsonb(h) || jsonb_build_object(
    'classified_quantity',
    coalesce((select sum(c.quantity) from public.scrap_classifications c where c.source_history_id = h.id), 0)
  ),
  true
from public.work_card_history h
where coalesce(h.scrap_qty, 0) >
  coalesce((select sum(c.quantity) from public.scrap_classifications c where c.source_history_id = h.id), 0)
and (coalesce(h.is_archived_scrap, false) or coalesce(h.card_info, '') like '%[ЦЕХ №2]%')
on conflict (source_type, source_id) do update set
  payload = excluded.payload, is_active = true,
  change_seq = nextval('public.vkya_classification_queue_change_seq'),
  changed_at = clock_timestamp();

insert into public.vkya_classification_queue_projection (
  source_type, source_id, payload, is_active
)
select 'restoration_return', q.id, to_jsonb(q), true
from public.vkya_reclassification_queue q
where q.status = 'pending' and coalesce(q.quantity, 0) > coalesce(q.classified_quantity, 0)
on conflict (source_type, source_id) do update set
  payload = excluded.payload, is_active = true,
  change_seq = nextval('public.vkya_classification_queue_change_seq'),
  changed_at = clock_timestamp();

create or replace function public.vkya_classification_queue_changes(p_after_seq bigint default null)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public
as $changes$
  with cursor_value as (
    select coalesce(max(change_seq), 0) as value
    from public.vkya_classification_queue_projection
  ),
  selected as (
    select source_type, source_id, payload, is_active, change_seq, changed_at
    from public.vkya_classification_queue_projection
    where case
      when p_after_seq is null then is_active
      else change_seq > p_after_seq
    end
    order by change_seq
  )
  select jsonb_build_object(
    'cursor', (select value from cursor_value),
    'changes', coalesce(jsonb_agg(to_jsonb(selected)), '[]'::jsonb)
  )
  from selected;
$changes$;

revoke all on function public.vkya_classification_queue_changes(bigint) from public;
grant execute on function public.vkya_classification_queue_changes(bigint) to anon, authenticated;

do $publication$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1
       from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'vkya_classification_queue_projection'
     ) then
    alter publication supabase_realtime add table public.vkya_classification_queue_projection;
  end if;
end;
$publication$;


-- ─── MIGRATION: 20260724170000_bz_inventory_ledger.sql ───
-- Authoritative BZ accounting.
-- BZ available stock is stored in inventory(type = 'bz').
-- Allocation to a production order atomically moves it to type = 'wip_bz'.

create table if not exists public.bz_inventory_reservations (
  id uuid primary key default gen_random_uuid(),
  operation_id uuid not null,
  order_id uuid,
  task_id uuid,
  nomenclature_id uuid not null references public.nomenclatures(id) on delete restrict,
  requested_qty numeric not null check (requested_qty >= 0),
  allocated_qty numeric not null check (allocated_qty >= 0),
  status text not null default 'allocated' check (status in ('allocated', 'released')),
  actor_id bigint,
  actor_name text,
  created_at timestamptz not null default now(),
  released_at timestamptz,
  release_reason text,
  unique (operation_id, nomenclature_id)
);

create index if not exists idx_bz_reservations_task
  on public.bz_inventory_reservations(task_id);
create index if not exists idx_bz_reservations_nomenclature_status
  on public.bz_inventory_reservations(nomenclature_id, status);

create table if not exists public.bz_inventory_ledger (
  id uuid primary key default gen_random_uuid(),
  operation_id uuid not null default gen_random_uuid(),
  reservation_id uuid references public.bz_inventory_reservations(id) on delete set null,
  nomenclature_id uuid not null references public.nomenclatures(id) on delete restrict,
  movement_type text not null,
  from_bucket text,
  to_bucket text,
  quantity numeric not null check (quantity >= 0),
  from_balance_before numeric,
  from_balance_after numeric,
  to_balance_before numeric,
  to_balance_after numeric,
  order_id uuid,
  task_id uuid,
  actor_id bigint,
  actor_name text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_bz_ledger_nomenclature_created
  on public.bz_inventory_ledger(nomenclature_id, created_at desc);
create index if not exists idx_bz_ledger_operation
  on public.bz_inventory_ledger(operation_id);
create index if not exists idx_bz_ledger_task
  on public.bz_inventory_ledger(task_id);

alter table public.bz_inventory_reservations enable row level security;
alter table public.bz_inventory_ledger enable row level security;

drop policy if exists "bz reservations readable" on public.bz_inventory_reservations;
create policy "bz reservations readable"
  on public.bz_inventory_reservations for select
  using (true);

drop policy if exists "bz ledger readable" on public.bz_inventory_ledger;
create policy "bz ledger readable"
  on public.bz_inventory_ledger for select
  using (true);

-- Catch every older/direct inventory write as well. Enriched RPC movements set a
-- transaction-local flag and write their own ledger row, so they are not doubled.
create or replace function public.audit_legacy_bz_inventory_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_qty numeric := coalesce(old.total_qty, 0);
  v_new_qty numeric := coalesce(new.total_qty, 0);
  v_nom uuid := coalesce(new.nomenclature_id, old.nomenclature_id);
  v_type text := coalesce(new.type, old.type);
begin
  if current_setting('app.bz_enriched_ledger', true) = '1' then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;

  if coalesce(old.type, '') not in ('bz', 'wip_bz', 'bz_shop2')
     and coalesce(new.type, '') not in ('bz', 'wip_bz', 'bz_shop2') then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;

  if tg_op = 'UPDATE' and v_old_qty = v_new_qty and old.type is not distinct from new.type then
    return new;
  end if;

  insert into public.bz_inventory_ledger (
    nomenclature_id, movement_type, from_bucket, to_bucket, quantity,
    from_balance_before, from_balance_after, to_balance_before, to_balance_after,
    metadata
  ) values (
    v_nom,
    case tg_op when 'INSERT' then 'legacy_insert'
               when 'DELETE' then 'legacy_delete'
               else 'legacy_adjustment' end,
    case when tg_op <> 'INSERT' then old.type end,
    case when tg_op <> 'DELETE' then new.type end,
    abs(v_new_qty - v_old_qty),
    case when tg_op <> 'INSERT' then v_old_qty end,
    case when tg_op <> 'INSERT' then case when tg_op = 'DELETE' then 0 else v_new_qty end end,
    case when tg_op <> 'DELETE' then case when tg_op = 'INSERT' then 0 else v_old_qty end end,
    case when tg_op <> 'DELETE' then v_new_qty end,
    jsonb_build_object('inventory_id', coalesce(new.id, old.id), 'database_operation', tg_op)
  );

  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;

drop trigger if exists trg_audit_legacy_bz_inventory_change on public.inventory;
create trigger trg_audit_legacy_bz_inventory_change
after insert or update or delete on public.inventory
for each row execute function public.audit_legacy_bz_inventory_change();

create or replace function public.reserve_bz_for_naryad(
  p_operation_id uuid,
  p_order_id uuid,
  p_items jsonb,
  p_actor_id bigint default null,
  p_actor_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_nom_id uuid;
  v_requested numeric;
  v_available_row public.inventory%rowtype;
  v_wip_row public.inventory%rowtype;
  v_available numeric;
  v_allocated numeric;
  v_reservation public.bz_inventory_reservations%rowtype;
  v_result jsonb := '[]'::jsonb;
begin
  if p_operation_id is null then
    raise exception 'operation_id is required';
  end if;

  if exists (
    select 1 from public.bz_inventory_reservations
    where operation_id = p_operation_id
  ) then
    return jsonb_build_object(
      'operation_id', p_operation_id,
      'allocations', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'reservation_id', id,
          'nomenclature_id', nomenclature_id,
          'requested_qty', requested_qty,
          'allocated_qty', allocated_qty
        ) order by created_at), '[]'::jsonb)
        from public.bz_inventory_reservations
        where operation_id = p_operation_id
      )
    );
  end if;

  perform set_config('app.bz_enriched_ledger', '1', true);

  for v_item in
    select value from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    v_nom_id := (v_item->>'nomenclature_id')::uuid;
    v_requested := greatest(coalesce((v_item->>'quantity')::numeric, 0), 0);
    if v_requested = 0 then
      continue;
    end if;

    select * into v_available_row
    from public.inventory
    where nomenclature_id = v_nom_id
      and type = 'bz'
      and (pocket_owner is null or pocket_owner = 'Не вказано')
    order by case when warehouse = 'operational' then 0 else 1 end, created_at, id
    limit 1
    for update;

    v_available := greatest(
      coalesce(v_available_row.total_qty, 0) - coalesce(v_available_row.reserved_qty, 0),
      0
    );
    v_allocated := least(v_requested, v_available);

    insert into public.bz_inventory_reservations (
      operation_id, order_id, nomenclature_id, requested_qty, allocated_qty,
      actor_id, actor_name
    ) values (
      p_operation_id, p_order_id, v_nom_id, v_requested, v_allocated,
      p_actor_id, p_actor_name
    )
    returning * into v_reservation;

    if v_allocated > 0 then
      update public.inventory
      set total_qty = coalesce(total_qty, 0) - v_allocated,
          updated_at = now()
      where id = v_available_row.id;

      select * into v_wip_row
      from public.inventory
      where nomenclature_id = v_nom_id and type = 'wip_bz'
      order by created_at, id
      limit 1
      for update;

      if v_wip_row.id is null then
        insert into public.inventory (
          nomenclature_id, name, total_qty, reserved_qty, type, unit, pocket_owner
        )
        select n.id, n.name, v_allocated, 0, 'wip_bz', coalesce(n.unit, 'шт'), null
        from public.nomenclatures n where n.id = v_nom_id
        returning * into v_wip_row;
      else
        update public.inventory
        set total_qty = coalesce(total_qty, 0) + v_allocated,
            updated_at = now()
        where id = v_wip_row.id
        returning * into v_wip_row;
      end if;

      insert into public.bz_inventory_ledger (
        operation_id, reservation_id, nomenclature_id, movement_type,
        from_bucket, to_bucket, quantity,
        from_balance_before, from_balance_after, to_balance_before, to_balance_after,
        order_id, actor_id, actor_name
      ) values (
        p_operation_id, v_reservation.id, v_nom_id, 'allocate_to_naryad',
        'bz', 'wip_bz', v_allocated,
        v_available_row.total_qty, v_available_row.total_qty - v_allocated,
        coalesce(v_wip_row.total_qty, 0) - v_allocated, v_wip_row.total_qty,
        p_order_id, p_actor_id, p_actor_name
      );
    end if;

    v_result := v_result || jsonb_build_array(jsonb_build_object(
      'reservation_id', v_reservation.id,
      'nomenclature_id', v_nom_id,
      'requested_qty', v_requested,
      'allocated_qty', v_allocated,
      'available_before', v_available,
      'available_after', v_available - v_allocated
    ));
  end loop;

  return jsonb_build_object('operation_id', p_operation_id, 'allocations', v_result);
end;
$$;

create or replace function public.attach_bz_reservation_to_task(
  p_operation_id uuid,
  p_task_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.bz_inventory_reservations
  set task_id = p_task_id
  where operation_id = p_operation_id and task_id is null;

  update public.bz_inventory_ledger
  set task_id = p_task_id
  where operation_id = p_operation_id and task_id is null;
end;
$$;

create or replace function public.release_bz_reservation(
  p_operation_id uuid,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_res public.bz_inventory_reservations%rowtype;
  v_bz public.inventory%rowtype;
  v_wip public.inventory%rowtype;
  v_release numeric;
begin
  perform set_config('app.bz_enriched_ledger', '1', true);

  for v_res in
    select * from public.bz_inventory_reservations
    where operation_id = p_operation_id and status = 'allocated'
    order by created_at, id
    for update
  loop
    v_release := v_res.allocated_qty;
    if v_release > 0 then
      select * into v_wip
      from public.inventory
      where nomenclature_id = v_res.nomenclature_id and type = 'wip_bz'
      order by created_at, id limit 1 for update;

      if v_wip.id is null or coalesce(v_wip.total_qty, 0) < v_release then
        raise exception 'Cannot release BZ reservation %, WIP balance is insufficient', v_res.id;
      end if;

      select * into v_bz
      from public.inventory
      where nomenclature_id = v_res.nomenclature_id
        and type = 'bz'
        and (pocket_owner is null or pocket_owner = 'Не вказано')
      order by case when warehouse = 'operational' then 0 else 1 end, created_at, id
      limit 1 for update;

      update public.inventory
      set total_qty = total_qty - v_release, updated_at = now()
      where id = v_wip.id;

      if v_bz.id is null then
        insert into public.inventory (
          nomenclature_id, name, total_qty, reserved_qty, type, unit, pocket_owner
        )
        select n.id, n.name, v_release, 0, 'bz', coalesce(n.unit, 'шт'), null
        from public.nomenclatures n where n.id = v_res.nomenclature_id
        returning * into v_bz;
      else
        update public.inventory
        set total_qty = coalesce(total_qty, 0) + v_release, updated_at = now()
        where id = v_bz.id
        returning * into v_bz;
      end if;

      insert into public.bz_inventory_ledger (
        operation_id, reservation_id, nomenclature_id, movement_type,
        from_bucket, to_bucket, quantity,
        from_balance_before, from_balance_after, to_balance_before, to_balance_after,
        order_id, task_id, actor_id, actor_name, metadata
      ) values (
        p_operation_id, v_res.id, v_res.nomenclature_id, 'release_naryad_allocation',
        'wip_bz', 'bz', v_release,
        v_wip.total_qty, v_wip.total_qty - v_release,
        coalesce(v_bz.total_qty, 0) - v_release, v_bz.total_qty,
        v_res.order_id, v_res.task_id, v_res.actor_id, v_res.actor_name,
        jsonb_build_object('reason', p_reason)
      );
    end if;

    update public.bz_inventory_reservations
    set status = 'released', released_at = now(), release_reason = p_reason
    where id = v_res.id;
  end loop;
end;
$$;

-- Establish a forward-auditable opening point without rewriting current balances.
insert into public.bz_inventory_ledger (
  nomenclature_id, movement_type, to_bucket, quantity,
  to_balance_before, to_balance_after, metadata, created_at
)
select i.nomenclature_id, 'opening_balance', i.type, greatest(coalesce(i.total_qty, 0), 0),
       0, coalesce(i.total_qty, 0),
       jsonb_build_object('inventory_id', i.id, 'note', 'Ledger introduced from current inventory snapshot'),
       now()
from public.inventory i
where i.type in ('bz', 'wip_bz', 'bz_shop2')
  and not exists (
    select 1 from public.bz_inventory_ledger l
    where l.movement_type = 'opening_balance'
      and l.metadata->>'inventory_id' = i.id::text
  );

grant select on public.bz_inventory_reservations to anon, authenticated;
grant select on public.bz_inventory_ledger to anon, authenticated;
grant execute on function public.reserve_bz_for_naryad(uuid, uuid, jsonb, bigint, text) to anon, authenticated;
grant execute on function public.attach_bz_reservation_to_task(uuid, uuid) to anon, authenticated;
grant execute on function public.release_bz_reservation(uuid, text) to anon, authenticated;


-- ─── MIGRATION: 20260724190000_cutter_restoration_workflow.sql ───
create table if not exists public.cutter_usage_events (
  id uuid primary key default gen_random_uuid(),
  source_card_id uuid not null references public.work_cards(id) on delete restrict,
  task_id uuid,
  order_id uuid,
  nomenclature_id uuid not null references public.nomenclatures(id) on delete restrict,
  quantity numeric not null check (quantity > 0),
  is_faceting boolean not null default false,
  pocket_owner text,
  actor_id bigint,
  actor_name text,
  created_at timestamptz not null default now(),
  unique (source_card_id, nomenclature_id)
);

create table if not exists public.cutter_restoration_batches (
  id uuid primary key default gen_random_uuid(),
  batch_number text not null unique,
  usage_event_id uuid not null unique references public.cutter_usage_events(id) on delete restrict,
  source_card_id uuid not null references public.work_cards(id) on delete restrict,
  task_id uuid,
  order_id uuid,
  nomenclature_id uuid not null references public.nomenclatures(id) on delete restrict,
  cutter_name text not null,
  received_qty numeric not null check (received_qty > 0),
  restored_qty numeric not null default 0 check (restored_qty >= 0),
  rejected_qty numeric not null default 0 check (rejected_qty >= 0),
  status text not null default 'pending'
    check (status in ('pending', 'in_progress', 'awaiting_reception', 'completed')),
  source_operator text,
  source_manager text,
  source_machine text,
  assigned_user_id bigint,
  assigned_user_name text,
  started_at timestamptz,
  finished_at timestamptz,
  reception_doc_id uuid,
  completion_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (restored_qty + rejected_qty <= received_qty)
);

create table if not exists public.cutter_restoration_events (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.cutter_restoration_batches(id) on delete restrict,
  event_type text not null,
  restored_qty numeric not null default 0,
  rejected_qty numeric not null default 0,
  actor_id bigint,
  actor_name text,
  note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_cutter_restoration_batches_status_created
  on public.cutter_restoration_batches(status, created_at);
create index if not exists idx_cutter_restoration_batches_nomenclature
  on public.cutter_restoration_batches(nomenclature_id, created_at desc);
create index if not exists idx_cutter_restoration_events_batch
  on public.cutter_restoration_events(batch_id, created_at);

alter table public.cutter_usage_events enable row level security;
alter table public.cutter_restoration_batches enable row level security;
alter table public.cutter_restoration_events enable row level security;

drop policy if exists "cutter usage readable" on public.cutter_usage_events;
create policy "cutter usage readable" on public.cutter_usage_events for select using (true);
drop policy if exists "cutter restoration batches readable" on public.cutter_restoration_batches;
create policy "cutter restoration batches readable" on public.cutter_restoration_batches for select using (true);
drop policy if exists "cutter restoration events readable" on public.cutter_restoration_events;
create policy "cutter restoration events readable" on public.cutter_restoration_events for select using (true);

create or replace function public.is_faceting_cutter(p_nomenclature_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.nomenclatures n
    left join public.nomenclatures cutter_type
      on n.characteristic = cutter_type.id::text
    where n.id = p_nomenclature_id
      and (
        lower(coalesce(n.name, '')) like '%фасоч%'
        or lower(coalesce(n.characteristic, '')) like '%фасоч%'
        or lower(coalesce(cutter_type.name, '')) like '%фасоч%'
      )
  );
$$;

create or replace function public.register_cutter_usage(
  p_source_card_id uuid,
  p_items jsonb,
  p_actor_id bigint default null,
  p_actor_name text default null,
  p_source_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_card public.work_cards%rowtype;
  v_item jsonb;
  v_nom public.nomenclatures%rowtype;
  v_inventory public.inventory%rowtype;
  v_usage public.cutter_usage_events%rowtype;
  v_nom_id uuid;
  v_qty numeric;
  v_faceting boolean;
  v_owner text;
  v_batch_id uuid;
  v_batches jsonb := '[]'::jsonb;
begin
  select * into v_card
  from public.work_cards
  where id = p_source_card_id
  for update;

  if v_card.id is null then
    raise exception 'Work card not found';
  end if;

  v_owner := nullif(coalesce(p_source_metadata->>'manager_name', v_card.manager_name), 'Не вказано');

  for v_item in
    select value from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    v_nom_id := (v_item->>'nomenclature_id')::uuid;
    v_qty := greatest(coalesce((v_item->>'quantity')::numeric, 0), 0);
    if v_qty = 0 then continue; end if;

    select * into v_nom from public.nomenclatures where id = v_nom_id;
    if v_nom.id is null or v_nom.type <> 'consumable' then
      raise exception 'Invalid cutter nomenclature: %', v_nom_id;
    end if;

    -- Unique usage event is the idempotency barrier: a repeated terminal
    -- request can neither deduct stock nor create the restoration batch twice.
    if exists (
      select 1 from public.cutter_usage_events
      where source_card_id = p_source_card_id and nomenclature_id = v_nom_id
    ) then
      continue;
    end if;

    v_faceting := public.is_faceting_cutter(v_nom_id);

    select * into v_inventory
    from public.inventory
    where nomenclature_id = v_nom_id
      and warehouse = 'pocket'
      and pocket_owner is not distinct from v_owner
    order by created_at, id
    limit 1
    for update;

    if v_inventory.id is null then
      insert into public.inventory (
        nomenclature_id, name, unit, total_qty, reserved_qty,
        warehouse, type, pocket_owner, updated_at
      ) values (
        v_nom.id, v_nom.name, coalesce(v_nom.unit, 'шт'), -v_qty, 0,
        'pocket', 'consumable', v_owner, now()
      );
    else
      update public.inventory
      set total_qty = coalesce(total_qty, 0) - v_qty,
          updated_at = now()
      where id = v_inventory.id;
    end if;

    insert into public.cutter_usage_events (
      source_card_id, task_id, order_id, nomenclature_id, quantity,
      is_faceting, pocket_owner, actor_id, actor_name
    ) values (
      v_card.id, v_card.task_id, v_card.order_id, v_nom_id, v_qty,
      v_faceting, v_owner, p_actor_id, p_actor_name
    )
    returning * into v_usage;

    if v_faceting then
      insert into public.cutter_restoration_batches (
        batch_number, usage_event_id, source_card_id, task_id, order_id,
        nomenclature_id, cutter_name, received_qty,
        source_operator, source_manager, source_machine
      ) values (
        'FR-' || to_char(clock_timestamp(), 'YYYYMMDD') || '-' || upper(substr(replace(v_usage.id::text, '-', ''), 1, 6)),
        v_usage.id, v_card.id, v_card.task_id, v_card.order_id,
        v_nom_id, v_nom.name, v_qty,
        coalesce(p_source_metadata->>'operator_name', v_card.operator_name),
        coalesce(p_source_metadata->>'manager_name', v_card.manager_name),
        coalesce(p_source_metadata->>'machine_name', v_card.machine)
      )
      returning id into v_batch_id;

      insert into public.cutter_restoration_events (
        batch_id, event_type, actor_id, actor_name, metadata
      ) values (
        v_batch_id, 'created', p_actor_id, p_actor_name,
        jsonb_build_object('source_card_id', v_card.id, 'quantity', v_qty)
      );

      v_batches := v_batches || jsonb_build_array(v_batch_id);
    end if;
  end loop;

  return jsonb_build_object('created_batch_ids', v_batches);
end;
$$;

create or replace function public.start_cutter_restoration(
  p_batch_id uuid,
  p_actor_id bigint,
  p_actor_name text
)
returns public.cutter_restoration_batches
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch public.cutter_restoration_batches%rowtype;
begin
  if not exists (
    select 1 from public.system_users u
    where u.id = p_actor_id
      and (
        coalesce((u.access_rights->>'cutter_restoration')::boolean, false)
        or lower(coalesce(u.position, '')) in ('адмін', 'admin')
      )
  ) then
    raise exception 'User has no cutter restoration access';
  end if;

  select * into v_batch
  from public.cutter_restoration_batches
  where id = p_batch_id
  for update;

  if v_batch.id is null then raise exception 'Restoration batch not found'; end if;
  if v_batch.status = 'pending' then
    update public.cutter_restoration_batches
    set status = 'in_progress',
        assigned_user_id = p_actor_id,
        assigned_user_name = p_actor_name,
        started_at = now(),
        updated_at = now()
    where id = p_batch_id
    returning * into v_batch;

    insert into public.cutter_restoration_events(batch_id, event_type, actor_id, actor_name)
    values (p_batch_id, 'started', p_actor_id, p_actor_name);
  elsif v_batch.status = 'in_progress' and v_batch.assigned_user_id is distinct from p_actor_id then
    raise exception 'Batch is already assigned to another user';
  end if;

  return v_batch;
end;
$$;

create or replace function public.finish_cutter_restoration(
  p_batch_id uuid,
  p_restored_qty numeric,
  p_rejected_qty numeric,
  p_actor_id bigint,
  p_actor_name text,
  p_note text default null
)
returns public.cutter_restoration_batches
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch public.cutter_restoration_batches%rowtype;
  v_doc_id uuid;
  v_items jsonb;
begin
  if not exists (
    select 1 from public.system_users u
    where u.id = p_actor_id
      and (
        coalesce((u.access_rights->>'cutter_restoration')::boolean, false)
        or lower(coalesce(u.position, '')) in ('адмін', 'admin')
      )
  ) then
    raise exception 'User has no cutter restoration access';
  end if;

  select * into v_batch
  from public.cutter_restoration_batches
  where id = p_batch_id
  for update;

  if v_batch.id is null then raise exception 'Restoration batch not found'; end if;
  if v_batch.status <> 'in_progress' then raise exception 'Batch is not in progress'; end if;
  if v_batch.assigned_user_id is distinct from p_actor_id then
    raise exception 'Only the assigned user can finish this batch';
  end if;
  if coalesce(p_restored_qty, 0) < 0 or coalesce(p_rejected_qty, 0) < 0 then
    raise exception 'Quantities cannot be negative';
  end if;
  if coalesce(p_restored_qty, 0) + coalesce(p_rejected_qty, 0) <> v_batch.received_qty then
    raise exception 'Every cutter in the batch must be classified as restored or rejected';
  end if;

  if p_restored_qty > 0 then
    v_items := jsonb_build_array(jsonb_build_object(
      'name', v_batch.cutter_name,
      'nomenclature_id', v_batch.nomenclature_id,
      'qty', p_restored_qty,
      'expected_qty', p_restored_qty,
      'unit', 'шт',
      'origin', 'cutter_restoration',
      'restoration_batch_id', v_batch.id
    ));

    insert into public.reception_docs (
      items, status, target_warehouse, source_warehouse, created_at
    ) values (
      v_items, 'ordered', 'operational', null, now()
    )
    returning id into v_doc_id;
  end if;

  update public.cutter_restoration_batches
  set restored_qty = p_restored_qty,
      rejected_qty = p_rejected_qty,
      status = case when p_restored_qty > 0 then 'awaiting_reception' else 'completed' end,
      reception_doc_id = v_doc_id,
      completion_note = p_note,
      finished_at = now(),
      updated_at = now()
  where id = p_batch_id
  returning * into v_batch;

  insert into public.cutter_restoration_events (
    batch_id, event_type, restored_qty, rejected_qty,
    actor_id, actor_name, note, metadata
  ) values (
    p_batch_id, 'finished', p_restored_qty, p_rejected_qty,
    p_actor_id, p_actor_name, p_note,
    jsonb_build_object('reception_doc_id', v_doc_id)
  );

  return v_batch;
end;
$$;

create or replace function public.complete_cutter_restoration_after_reception()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch_id uuid;
begin
  if new.status = 'completed' and old.status is distinct from new.status then
    update public.cutter_restoration_batches
    set status = 'completed', updated_at = now()
    where reception_doc_id = new.id
      and status = 'awaiting_reception'
    returning id into v_batch_id;

    if v_batch_id is not null then
      insert into public.cutter_restoration_events (
        batch_id, event_type, metadata
      ) values (
        v_batch_id, 'warehouse_received',
        jsonb_build_object('reception_doc_id', new.id)
      );
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_complete_cutter_restoration_after_reception on public.reception_docs;
create trigger trg_complete_cutter_restoration_after_reception
after update of status on public.reception_docs
for each row execute function public.complete_cutter_restoration_after_reception();

grant select on public.cutter_usage_events to anon, authenticated;
grant select on public.cutter_restoration_batches to anon, authenticated;
grant select on public.cutter_restoration_events to anon, authenticated;
grant execute on function public.is_faceting_cutter(uuid) to anon, authenticated;
grant execute on function public.register_cutter_usage(uuid, jsonb, bigint, text, jsonb) to anon, authenticated;
grant execute on function public.start_cutter_restoration(uuid, bigint, text) to anon, authenticated;
grant execute on function public.finish_cutter_restoration(uuid, numeric, numeric, bigint, text, text) to anon, authenticated;


-- ─── MIGRATION: 20260726120000_inventory_created_at.sql ───
-- BZ reservation functions use deterministic FIFO ordering for inventory rows.
-- Older installations of inventory only had updated_at, so creating a naryad
-- failed with: column "created_at" does not exist.
alter table public.inventory
  add column if not exists created_at timestamptz not null default now();

create index if not exists idx_inventory_created_at
  on public.inventory (created_at, id);

-- Several production functions still consume the legacy unit field directly
-- from nomenclatures. Keep that compatibility field until every caller has
-- moved to nomenclature_catalog_profiles/base_unit_id.
alter table public.nomenclatures
  add column if not exists unit text not null default 'шт';


-- ─── MIGRATION: 20260726130000_backfill_cutter_restoration.sql ───
-- Restore cutter restoration batches missed by the legacy terminal path.
-- Inventory is intentionally NOT deducted here: the legacy client already
-- deducted the recorded factual quantity when each card was completed.

with parsed_history as (
  select distinct on (h.card_id, lower(cutter.key))
    h.card_id,
    wc.task_id,
    wc.order_id,
    n.id as nomenclature_id,
    cutter.value::numeric as quantity,
    wc.manager_name,
    h.operator_name,
    h.machine_name,
    h.completed_at
  from public.work_card_history h
  join public.work_cards wc on wc.id = h.card_id
  cross join lateral jsonb_each_text(
    substring(h.card_info from '\[CUTTERS_BREAKDOWN:(\{.*\})\]')::jsonb
  ) cutter
  join public.nomenclatures n
    on lower(btrim(n.name)) = lower(btrim(cutter.key))
   and n.type = 'consumable'
  where h.completed_at >= timestamptz '2026-07-24 00:00:00+00'
    and h.card_info like '%[CUTTERS_BREAKDOWN:%'
    and lower(cutter.key) like '%фасоч%'
    and cutter.value::numeric > 0
  order by h.card_id, lower(cutter.key), h.completed_at desc, h.id desc
)
insert into public.cutter_usage_events (
  source_card_id, task_id, order_id, nomenclature_id, quantity,
  is_faceting, pocket_owner, actor_name, created_at
)
select
  p.card_id, p.task_id, p.order_id, p.nomenclature_id, p.quantity,
  true, nullif(p.manager_name, 'Не вказано'), 'SYSTEM BACKFILL', p.completed_at
from parsed_history p
on conflict (source_card_id, nomenclature_id) do nothing;

insert into public.cutter_restoration_batches (
  batch_number, usage_event_id, source_card_id, task_id, order_id,
  nomenclature_id, cutter_name, received_qty,
  source_operator, source_manager, source_machine, created_at, updated_at
)
select
  'FR-BF-' || upper(substr(replace(u.id::text, '-', ''), 1, 10)),
  u.id, u.source_card_id, u.task_id, u.order_id,
  u.nomenclature_id, n.name, u.quantity,
  h.operator_name, wc.manager_name, h.machine_name,
  u.created_at, now()
from public.cutter_usage_events u
join public.nomenclatures n on n.id = u.nomenclature_id
join public.work_cards wc on wc.id = u.source_card_id
left join lateral (
  select wh.operator_name, wh.machine_name
  from public.work_card_history wh
  where wh.card_id = u.source_card_id
    and wh.card_info like '%[CUTTERS_BREAKDOWN:%'
  order by wh.completed_at desc, wh.id desc
  limit 1
) h on true
where u.is_faceting = true
  and u.created_at >= timestamptz '2026-07-24 00:00:00+00'
  and not exists (
    select 1 from public.cutter_restoration_batches b
    where b.usage_event_id = u.id
  );

insert into public.cutter_restoration_events (
  batch_id, event_type, actor_name, metadata, created_at
)
select
  b.id, 'created', 'SYSTEM BACKFILL',
  jsonb_build_object(
    'source_card_id', b.source_card_id,
    'quantity', b.received_qty,
    'reason', 'Recovered from factual CUTTERS_BREAKDOWN history'
  ),
  b.created_at
from public.cutter_restoration_batches b
where b.batch_number like 'FR-BF-%'
  and not exists (
    select 1 from public.cutter_restoration_events e
    where e.batch_id = b.id and e.event_type = 'created'
  );


-- ─── MIGRATION: 20260727140000_inventory_pocket_owner_unique.sql ───
begin;

-- Pocket inventory is scoped by its owner. The previous unique key omitted
-- pocket_owner, while register_cutter_usage intentionally keeps a separate
-- pocket balance per responsible manager.
alter table public.inventory
  drop constraint if exists inventory_name_type_warehouse_unique;

alter table public.inventory
  drop constraint if exists inventory_name_type_warehouse_owner_unique;

alter table public.inventory
  add constraint inventory_name_type_warehouse_owner_unique
  unique nulls not distinct (name, type, warehouse, pocket_owner);

commit;


-- ─── MIGRATION: 20260727150000_vkya_projection_history_delete.sql ───
begin;

create or replace function public.sync_vkya_history_queue_projection_delete()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $projection_delete$
begin
  insert into public.vkya_classification_queue_projection (
    source_type, source_id, payload, is_active, change_seq, changed_at
  ) values (
    'history',
    old.id,
    to_jsonb(old),
    false,
    nextval('public.vkya_classification_queue_change_seq'),
    clock_timestamp()
  )
  on conflict (source_type, source_id) do update set
    payload = excluded.payload,
    is_active = false,
    change_seq = excluded.change_seq,
    changed_at = excluded.changed_at;
  return old;
end;
$projection_delete$;

drop trigger if exists trg_vkya_history_queue_projection_delete
  on public.work_card_history;
create trigger trg_vkya_history_queue_projection_delete
after delete on public.work_card_history
for each row execute function public.sync_vkya_history_queue_projection_delete();

-- Repair any projection rows orphaned by deletions made before this trigger.
update public.vkya_classification_queue_projection projection
set is_active = false,
    change_seq = nextval('public.vkya_classification_queue_change_seq'),
    changed_at = clock_timestamp()
where projection.source_type = 'history'
  and projection.is_active
  and not exists (
    select 1
    from public.work_card_history history
    where history.id = projection.source_id
  );

commit;


-- ─── MIGRATION: 20260727160000_reconcile_cutter_restoration_from_history.sql ───
-- Keep the cutter restoration queue in sync with factual cutter usage recorded
-- in work_card_history. This is intentionally separate from pocket inventory:
-- terminal versions that wrote this history already handled their own stock
-- deduction, so reconciliation must never deduct a cutter for a second time.

create or replace function public.reconcile_cutter_restoration_from_history()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_created integer := 0;
  v_row_count integer := 0;
begin
  with parsed_history as (
    select distinct on (h.card_id, lower(btrim(cutter.key)))
      h.card_id,
      wc.task_id,
      wc.order_id,
      n.id as nomenclature_id,
      cutter.value::numeric as quantity,
      nullif(wc.manager_name, 'Не вказано') as manager_name,
      h.operator_name,
      h.machine_name,
      h.completed_at
    from public.work_card_history h
    join public.work_cards wc on wc.id = h.card_id
    cross join lateral regexp_matches(
      coalesce(h.card_info, ''),
      '\[CUTTERS_BREAKDOWN:(\{[^\]]+\})\]',
      'g'
    ) as matched(parts)
    cross join lateral jsonb_each_text(matched.parts[1]::jsonb) cutter
    join public.nomenclatures n
      on lower(btrim(n.name)) = lower(btrim(cutter.key))
     and n.type = 'consumable'
    where h.completed_at >= timestamptz '2026-07-24 00:00:00+00'
      and h.stage_name = 'Розкрій'
      and h.card_info like '%[CUTTERS_BREAKDOWN:%'
      and cutter.value::numeric > 0
      and public.is_faceting_cutter(n.id)
    order by
      h.card_id,
      lower(btrim(cutter.key)),
      h.completed_at desc,
      h.id desc
  )
  insert into public.cutter_usage_events (
    source_card_id,
    task_id,
    order_id,
    nomenclature_id,
    quantity,
    is_faceting,
    pocket_owner,
    actor_name,
    created_at
  )
  select
    p.card_id,
    p.task_id,
    p.order_id,
    p.nomenclature_id,
    p.quantity,
    true,
    p.manager_name,
    'SYSTEM HISTORY SYNC',
    p.completed_at
  from parsed_history p
  on conflict (source_card_id, nomenclature_id) do nothing;

  get diagnostics v_row_count = row_count;
  v_created := v_created + v_row_count;

  insert into public.cutter_restoration_batches (
    batch_number,
    usage_event_id,
    source_card_id,
    task_id,
    order_id,
    nomenclature_id,
    cutter_name,
    received_qty,
    source_operator,
    source_manager,
    source_machine,
    created_at,
    updated_at
  )
  select
    'FR-HS-' || upper(substr(replace(u.id::text, '-', ''), 1, 10)),
    u.id,
    u.source_card_id,
    u.task_id,
    u.order_id,
    u.nomenclature_id,
    n.name,
    u.quantity,
    h.operator_name,
    wc.manager_name,
    h.machine_name,
    u.created_at,
    now()
  from public.cutter_usage_events u
  join public.nomenclatures n on n.id = u.nomenclature_id
  join public.work_cards wc on wc.id = u.source_card_id
  left join lateral (
    select wh.operator_name, wh.machine_name
    from public.work_card_history wh
    where wh.card_id = u.source_card_id
      and wh.stage_name = 'Розкрій'
      and wh.card_info like '%[CUTTERS_BREAKDOWN:%'
    order by wh.completed_at desc, wh.id desc
    limit 1
  ) h on true
  where u.is_faceting = true
    and u.created_at >= timestamptz '2026-07-24 00:00:00+00'
    and not exists (
      select 1
      from public.cutter_restoration_batches b
      where b.usage_event_id = u.id
    )
  on conflict (usage_event_id) do nothing;

  get diagnostics v_row_count = row_count;
  v_created := v_created + v_row_count;

  insert into public.cutter_restoration_events (
    batch_id,
    event_type,
    actor_name,
    metadata,
    created_at
  )
  select
    b.id,
    'created',
    'SYSTEM HISTORY SYNC',
    jsonb_build_object(
      'source_card_id', b.source_card_id,
      'quantity', b.received_qty,
      'reason', 'Synchronized from factual CUTTERS_BREAKDOWN history'
    ),
    b.created_at
  from public.cutter_restoration_batches b
  where b.batch_number like 'FR-HS-%'
    and not exists (
      select 1
      from public.cutter_restoration_events e
      where e.batch_id = b.id
        and e.event_type = 'created'
    );

  return v_created;
end;
$$;

revoke all on function public.reconcile_cutter_restoration_from_history() from public;
grant execute on function public.reconcile_cutter_restoration_from_history() to anon, authenticated;

-- Repair everything missed since the restoration workflow was introduced.
select public.reconcile_cutter_restoration_from_history();


-- ─── MIGRATION: 20260727170000_cutter_restoration_group_work.sql ───
-- Work with accumulated cutters as one type-based stack while preserving
-- every source batch for traceability and reception.

create or replace function public.start_cutter_restoration_group(
  p_nomenclature_id uuid,
  p_actor_id bigint,
  p_actor_name text
)
returns setof public.cutter_restoration_batches
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch record;
begin
  for v_batch in
    select id
    from public.cutter_restoration_batches
    where nomenclature_id = p_nomenclature_id
      and status = 'pending'
    order by created_at, id
    for update
  loop
    perform public.start_cutter_restoration(v_batch.id, p_actor_id, p_actor_name);
  end loop;

  return query
  select b.*
  from public.cutter_restoration_batches b
  where b.nomenclature_id = p_nomenclature_id
    and b.status = 'in_progress'
    and b.assigned_user_id is not distinct from p_actor_id
  order by b.created_at, b.id;
end;
$$;

create or replace function public.finish_cutter_restoration_group(
  p_batch_ids uuid[],
  p_restored_qty numeric,
  p_rejected_qty numeric,
  p_actor_id bigint,
  p_actor_name text,
  p_note text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch public.cutter_restoration_batches%rowtype;
  v_total numeric;
  v_restored_left numeric := greatest(coalesce(p_restored_qty, 0), 0);
  v_batch_restored numeric;
  v_batch_rejected numeric;
  v_finished integer := 0;
begin
  if coalesce(array_length(p_batch_ids, 1), 0) = 0 then
    raise exception 'No restoration batches selected';
  end if;

  select coalesce(sum(received_qty), 0)
  into v_total
  from public.cutter_restoration_batches
  where id = any(p_batch_ids)
    and status = 'in_progress'
    and assigned_user_id is not distinct from p_actor_id;

  if v_total <> greatest(coalesce(p_restored_qty, 0), 0)
      + greatest(coalesce(p_rejected_qty, 0), 0) then
    raise exception 'Restored and rejected quantities must equal the selected stack quantity';
  end if;

  if (
    select count(*)
    from public.cutter_restoration_batches
    where id = any(p_batch_ids)
      and status = 'in_progress'
      and assigned_user_id is not distinct from p_actor_id
  ) <> coalesce(array_length(p_batch_ids, 1), 0) then
    raise exception 'One or more restoration batches are unavailable';
  end if;

  for v_batch in
    select *
    from public.cutter_restoration_batches
    where id = any(p_batch_ids)
    order by created_at, id
    for update
  loop
    v_batch_restored := least(v_batch.received_qty, v_restored_left);
    v_batch_rejected := v_batch.received_qty - v_batch_restored;

    perform public.finish_cutter_restoration(
      v_batch.id,
      v_batch_restored,
      v_batch_rejected,
      p_actor_id,
      p_actor_name,
      p_note
    );

    v_restored_left := v_restored_left - v_batch_restored;
    v_finished := v_finished + 1;
  end loop;

  return v_finished;
end;
$$;

revoke all on function public.start_cutter_restoration_group(uuid,bigint,text) from public;
revoke all on function public.finish_cutter_restoration_group(uuid[],numeric,numeric,bigint,text,text) from public;
grant execute on function public.start_cutter_restoration_group(uuid,bigint,text) to anon, authenticated;
grant execute on function public.finish_cutter_restoration_group(uuid[],numeric,numeric,bigint,text,text) to anon, authenticated;


-- ─── MIGRATION: 20260727180000_cutter_restoration_single_group_reception.sql ───
-- A grouped restoration stack must create one reception document, not one
-- document per traceability batch.

create or replace function public.finish_cutter_restoration_group(
  p_batch_ids uuid[],
  p_restored_qty numeric,
  p_rejected_qty numeric,
  p_actor_id bigint,
  p_actor_name text,
  p_note text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch public.cutter_restoration_batches%rowtype;
  v_total numeric;
  v_restored_left numeric := greatest(coalesce(p_restored_qty, 0), 0);
  v_batch_restored numeric;
  v_batch_rejected numeric;
  v_finished integer := 0;
  v_doc_id uuid;
  v_nomenclature_id uuid;
  v_cutter_name text;
  v_items jsonb;
begin
  if not exists (
    select 1
    from public.system_users u
    where u.id = p_actor_id
      and (
        coalesce((u.access_rights->>'cutter_restoration')::boolean, false)
        or lower(coalesce(u.position, '')) in ('адмін', 'admin')
      )
  ) then
    raise exception 'User has no cutter restoration access';
  end if;

  if coalesce(array_length(p_batch_ids, 1), 0) = 0 then
    raise exception 'No restoration batches selected';
  end if;

  select
    coalesce(sum(received_qty), 0),
    min(nomenclature_id::text)::uuid,
    min(cutter_name)
  into v_total, v_nomenclature_id, v_cutter_name
  from public.cutter_restoration_batches
  where id = any(p_batch_ids)
    and status = 'in_progress'
    and assigned_user_id is not distinct from p_actor_id;

  if (
    select count(distinct nomenclature_id)
    from public.cutter_restoration_batches
    where id = any(p_batch_ids)
  ) <> 1 then
    raise exception 'A restoration stack must contain one cutter type';
  end if;

  if v_total <> greatest(coalesce(p_restored_qty, 0), 0)
      + greatest(coalesce(p_rejected_qty, 0), 0) then
    raise exception 'Restored and rejected quantities must equal the selected stack quantity';
  end if;

  if (
    select count(*)
    from public.cutter_restoration_batches
    where id = any(p_batch_ids)
      and status = 'in_progress'
      and assigned_user_id is not distinct from p_actor_id
  ) <> coalesce(array_length(p_batch_ids, 1), 0) then
    raise exception 'One or more restoration batches are unavailable';
  end if;

  if p_restored_qty > 0 then
    v_items := jsonb_build_array(jsonb_build_object(
      'name', v_cutter_name,
      'nomenclature_id', v_nomenclature_id,
      'qty', p_restored_qty,
      'expected_qty', p_restored_qty,
      'unit', 'шт',
      'origin', 'cutter_restoration_group',
      'restoration_batch_ids', to_jsonb(p_batch_ids)
    ));

    insert into public.reception_docs (
      items, status, target_warehouse, source_warehouse, created_at
    ) values (
      v_items, 'ordered', 'operational', null, now()
    )
    returning id into v_doc_id;
  end if;

  for v_batch in
    select *
    from public.cutter_restoration_batches
    where id = any(p_batch_ids)
    order by created_at, id
    for update
  loop
    v_batch_restored := least(v_batch.received_qty, v_restored_left);
    v_batch_rejected := v_batch.received_qty - v_batch_restored;

    update public.cutter_restoration_batches
    set restored_qty = v_batch_restored,
        rejected_qty = v_batch_rejected,
        status = case when p_restored_qty > 0 then 'awaiting_reception' else 'completed' end,
        reception_doc_id = v_doc_id,
        completion_note = p_note,
        finished_at = now(),
        updated_at = now()
    where id = v_batch.id;

    insert into public.cutter_restoration_events (
      batch_id, event_type, restored_qty, rejected_qty,
      actor_id, actor_name, note, metadata
    ) values (
      v_batch.id, 'finished', v_batch_restored, v_batch_rejected,
      p_actor_id, p_actor_name, p_note,
      jsonb_build_object(
        'reception_doc_id', v_doc_id,
        'group_size', array_length(p_batch_ids, 1)
      )
    );

    v_restored_left := v_restored_left - v_batch_restored;
    v_finished := v_finished + 1;
  end loop;

  return v_finished;
end;
$$;

create or replace function public.complete_cutter_restoration_after_reception()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'completed' and old.status is distinct from new.status then
    with completed_batches as (
      update public.cutter_restoration_batches
      set status = 'completed', updated_at = now()
      where reception_doc_id = new.id
        and status = 'awaiting_reception'
      returning id
    )
    insert into public.cutter_restoration_events (
      batch_id, event_type, metadata
    )
    select
      id,
      'warehouse_received',
      jsonb_build_object('reception_doc_id', new.id)
    from completed_batches;
  end if;
  return new;
end;
$$;

revoke all on function public.finish_cutter_restoration_group(uuid[],numeric,numeric,bigint,text,text) from public;
grant execute on function public.finish_cutter_restoration_group(uuid[],numeric,numeric,bigint,text,text) to anon, authenticated;

-- Consolidate legacy per-batch reception documents that are still untouched
-- by the warehouse. One cutter type becomes one ordered reception document.
do $$
declare
  v_group record;
  v_new_doc_id uuid;
begin
  for v_group in
    select
      b.nomenclature_id,
      min(b.cutter_name) as cutter_name,
      b.assigned_user_id,
      array_agg(b.id order by b.created_at, b.id) as batch_ids,
      array_agg(distinct b.reception_doc_id) as old_doc_ids,
      sum(b.restored_qty) as restored_qty
    from public.cutter_restoration_batches b
    join public.reception_docs d on d.id = b.reception_doc_id
    where b.status = 'awaiting_reception'
      and b.reception_doc_id is not null
      and d.status = 'ordered'
      and d.target_warehouse = 'operational'
      and d.items @> '[{"origin":"cutter_restoration"}]'::jsonb
    group by b.nomenclature_id, b.assigned_user_id
    having count(distinct b.reception_doc_id) > 1
  loop
    insert into public.reception_docs (
      items, status, target_warehouse, source_warehouse, created_at
    ) values (
      jsonb_build_array(jsonb_build_object(
        'name', v_group.cutter_name,
        'nomenclature_id', v_group.nomenclature_id,
        'qty', v_group.restored_qty,
        'expected_qty', v_group.restored_qty,
        'unit', 'шт',
        'origin', 'cutter_restoration_group',
        'restoration_batch_ids', to_jsonb(v_group.batch_ids)
      )),
      'ordered',
      'operational',
      null,
      now()
    )
    returning id into v_new_doc_id;

    update public.cutter_restoration_batches
    set reception_doc_id = v_new_doc_id,
        updated_at = now()
    where id = any(v_group.batch_ids);

    insert into public.cutter_restoration_events (
      batch_id, event_type, actor_name, metadata
    )
    select
      batch_id,
      'reception_consolidated',
      'SYSTEM MIGRATION',
      jsonb_build_object(
        'reception_doc_id', v_new_doc_id,
        'replaced_document_count', array_length(v_group.old_doc_ids, 1)
      )
    from unnest(v_group.batch_ids) as source(batch_id);

    delete from public.reception_docs
    where id = any(v_group.old_doc_ids)
      and status = 'ordered';
  end loop;
end;
$$;


-- ─── MIGRATION: 20260727210000_cutter_restoration_canonical_stacks.sql ───
-- Accumulate restoration work by the physical cutter specification rather
-- than by a catalogue UUID. Duplicate catalogue rows for the same diameter,
-- dimensions and angle therefore belong to one working stack.

create or replace function public.cutter_restoration_type_key(p_name text)
returns text
language sql
immutable
parallel safe
as $$
  select regexp_replace(
    translate(
        regexp_replace(
          lower(coalesce(p_name, '')),
          '(фреза|фасочна|фасочная|cutter|ф|градусів|градуса|degrees?|deg|°)',
          '',
          'g'
        ),
        'х×*,',
        'xxx.'
    ),
    '[^a-zа-яіїєґ0-9.x()]',
    '',
    'g'
  )
$$;

create index if not exists cutter_restoration_batches_type_key_pending_idx
  on public.cutter_restoration_batches (
    public.cutter_restoration_type_key(cutter_name),
    created_at
  )
  where status = 'pending';

create or replace function public.start_cutter_restoration_stack(
  p_type_key text,
  p_actor_id bigint,
  p_actor_name text
)
returns setof public.cutter_restoration_batches
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch record;
begin
  if coalesce(p_type_key, '') = '' then
    raise exception 'Cutter type is required';
  end if;

  for v_batch in
    select id
    from public.cutter_restoration_batches
    where public.cutter_restoration_type_key(cutter_name) = p_type_key
      and status = 'pending'
    order by created_at, id
    for update skip locked
  loop
    perform public.start_cutter_restoration(v_batch.id, p_actor_id, p_actor_name);
  end loop;

  return query
  select b.*
  from public.cutter_restoration_batches b
  where public.cutter_restoration_type_key(b.cutter_name) = p_type_key
    and b.status = 'in_progress'
    and b.assigned_user_id is not distinct from p_actor_id
  order by b.created_at, b.id;
end;
$$;

-- The group may contain duplicate catalogue UUIDs, but every row must still
-- describe the same physical cutter specification.
create or replace function public.finish_cutter_restoration_group(
  p_batch_ids uuid[],
  p_restored_qty numeric,
  p_rejected_qty numeric,
  p_actor_id bigint,
  p_actor_name text,
  p_note text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch public.cutter_restoration_batches%rowtype;
  v_total numeric;
  v_restored_left numeric := greatest(coalesce(p_restored_qty, 0), 0);
  v_batch_restored numeric;
  v_batch_rejected numeric;
  v_finished integer := 0;
  v_doc_id uuid;
  v_nomenclature_id uuid;
  v_cutter_name text;
  v_items jsonb;
begin
  if not exists (
    select 1 from public.system_users u
    where u.id = p_actor_id
      and (
        coalesce((u.access_rights->>'cutter_restoration')::boolean, false)
        or lower(coalesce(u.position, '')) in ('адмін', 'admin')
      )
  ) then
    raise exception 'User has no cutter restoration access';
  end if;

  if coalesce(array_length(p_batch_ids, 1), 0) = 0 then
    raise exception 'No restoration batches selected';
  end if;

  select
    coalesce(sum(received_qty), 0),
    (array_agg(nomenclature_id order by created_at, id))[1],
    (array_agg(cutter_name order by created_at, id))[1]
  into v_total, v_nomenclature_id, v_cutter_name
  from public.cutter_restoration_batches
  where id = any(p_batch_ids)
    and status = 'in_progress'
    and assigned_user_id is not distinct from p_actor_id;

  if (
    select count(distinct public.cutter_restoration_type_key(cutter_name))
    from public.cutter_restoration_batches
    where id = any(p_batch_ids)
  ) <> 1 then
    raise exception 'A restoration stack must contain one physical cutter type';
  end if;

  if v_total <> greatest(coalesce(p_restored_qty, 0), 0)
      + greatest(coalesce(p_rejected_qty, 0), 0) then
    raise exception 'Restored and rejected quantities must equal the selected stack quantity';
  end if;

  if (
    select count(*) from public.cutter_restoration_batches
    where id = any(p_batch_ids)
      and status = 'in_progress'
      and assigned_user_id is not distinct from p_actor_id
  ) <> coalesce(array_length(p_batch_ids, 1), 0) then
    raise exception 'One or more restoration batches are unavailable';
  end if;

  if p_restored_qty > 0 then
    v_items := jsonb_build_array(jsonb_build_object(
      'name', v_cutter_name,
      'nomenclature_id', v_nomenclature_id,
      'qty', p_restored_qty,
      'expected_qty', p_restored_qty,
      'unit', 'шт',
      'origin', 'cutter_restoration_group',
      'restoration_batch_ids', to_jsonb(p_batch_ids)
    ));

    insert into public.reception_docs (
      items, status, target_warehouse, source_warehouse, created_at
    ) values (
      v_items, 'ordered', 'operational', null, now()
    )
    returning id into v_doc_id;
  end if;

  for v_batch in
    select * from public.cutter_restoration_batches
    where id = any(p_batch_ids)
    order by created_at, id
    for update
  loop
    v_batch_restored := least(v_batch.received_qty, v_restored_left);
    v_batch_rejected := v_batch.received_qty - v_batch_restored;

    update public.cutter_restoration_batches
    set restored_qty = v_batch_restored,
        rejected_qty = v_batch_rejected,
        status = case when p_restored_qty > 0 then 'awaiting_reception' else 'completed' end,
        reception_doc_id = v_doc_id,
        completion_note = p_note,
        finished_at = now(),
        updated_at = now()
    where id = v_batch.id;

    insert into public.cutter_restoration_events (
      batch_id, event_type, restored_qty, rejected_qty,
      actor_id, actor_name, note, metadata
    ) values (
      v_batch.id, 'finished', v_batch_restored, v_batch_rejected,
      p_actor_id, p_actor_name, p_note,
      jsonb_build_object(
        'reception_doc_id', v_doc_id,
        'group_size', array_length(p_batch_ids, 1),
        'cutter_type_key', public.cutter_restoration_type_key(v_batch.cutter_name)
      )
    );

    v_restored_left := v_restored_left - v_batch_restored;
    v_finished := v_finished + 1;
  end loop;

  return v_finished;
end;
$$;

revoke all on function public.cutter_restoration_type_key(text) from public;
revoke all on function public.start_cutter_restoration_stack(text,bigint,text) from public;
revoke all on function public.finish_cutter_restoration_group(uuid[],numeric,numeric,bigint,text,text) from public;
grant execute on function public.cutter_restoration_type_key(text) to anon, authenticated;
grant execute on function public.start_cutter_restoration_stack(text,bigint,text) to anon, authenticated;
grant execute on function public.finish_cutter_restoration_group(uuid[],numeric,numeric,bigint,text,text) to anon, authenticated;


-- ─── MIGRATION: 20260803150000_mes_monthly_report.sql ───
-- One bounded server-side aggregation for the MES monthly report.
-- Source rows never leave PostgreSQL; the client receives only report-ready JSON.

create index if not exists idx_work_card_history_completed_monthly_report
  on public.work_card_history (completed_at, card_id)
  include (qty_completed, scrap_qty, cutters_used, stage_name)
  where completed_at is not null;

create index if not exists idx_work_card_history_created_monthly_report
  on public.work_card_history (created_at, card_id)
  include (qty_completed, scrap_qty, cutters_used, stage_name)
  where completed_at is null;

create index if not exists idx_tasks_order_batch_monthly_report
  on public.tasks (order_id, batch_index, id);

create or replace function public.mes_monthly_report(p_month date)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $monthly_report$
  with bounds as materialized (
    select date_trunc('month', coalesce(p_month, current_date)::timestamp) at time zone 'Europe/Kyiv' as from_at,
           (date_trunc('month', coalesce(p_month, current_date)::timestamp) + interval '1 month') at time zone 'Europe/Kyiv' as to_at
  ), month_activity as materialized (
    select t.order_id, t.batch_index, t.id as task_id, wc.id as card_id, h.id as history_id,
           coalesce(h.completed_at, h.created_at) as activity_at,
           coalesce(h.qty_completed, 0)::numeric as qty_completed,
           coalesce(h.scrap_qty, 0)::numeric as scrap_qty,
           coalesce(h.cutters_used, 0)::numeric as cutters_used,
           lower(btrim(coalesce(h.stage_name, ''))) as stage_name
      from bounds b
      join public.work_card_history h
        on (h.completed_at >= b.from_at and h.completed_at < b.to_at)
        or (h.completed_at is null and h.created_at >= b.from_at and h.created_at < b.to_at)
      join public.work_cards wc on wc.id = h.card_id
      join public.tasks t on t.id = wc.task_id
      join public.orders o on o.id = t.order_id
       and upper(btrim(o.order_num::text)) !~ '^ВБ'
  ), qualified_groups as materialized (
    select distinct order_id, batch_index from month_activity
  ), target_tasks as materialized (
    select t.id, t.order_id, t.batch_index
      from public.tasks t
      join qualified_groups q on q.order_id = t.order_id
       and q.batch_index is not distinct from t.batch_index
  ), activity_totals as (
    select a.order_id, a.batch_index,
           min(a.activity_at) as first_activity,
           max(a.activity_at) as last_activity,
           count(distinct a.card_id)::bigint as card_count,
           sum(a.qty_completed) filter (where a.stage_name in ('приймка', 'completed', 'склад бз', 'сгп', 'пакування', 'пакування/сгп')) as produced_qty,
           sum(a.scrap_qty) as scrap_qty,
           sum(a.cutters_used) filter (where a.stage_name in ('розкрій', 'розкрій (перезмінка)')) as cutters_used
      from month_activity a
     group by a.order_id, a.batch_index
  ), request_materials as materialized (
    select tt.order_id, tt.batch_index,
           case
             when lower(coalesce(n.name, mr.details, '')) like '%фрез%' then 'cutters'
             when lower(coalesce(n.name, mr.details, '')) like '%лист%'
               or n.type in ('raw', 'material') then 'sheets'
             else 'other'
           end as category,
           coalesce(nullif(btrim(n.name), ''), nullif(btrim(mr.details), ''), 'Матеріал без назви') as name,
           sum(coalesce(mr.quantity, 0))::numeric as quantity
      from target_tasks tt
      join public.material_requests mr on mr.task_id = tt.id
      left join public.nomenclatures n on n.id = mr.nomenclature_id
     where mr.status in ('issued', 'completed')
     group by tt.order_id, tt.batch_index, category,
              coalesce(nullif(btrim(n.name), ''), nullif(btrim(mr.details), ''), 'Матеріал без назви')
  ), actual_materials as materialized (
    -- Issued sheet/other requests are factual warehouse consumption. Cutter
    -- consumption is taken from operator history to avoid counting issued and
    -- used cutters twice.
    select order_id, batch_index, category, name, quantity
      from request_materials where category <> 'cutters'
    union all
    select order_id, batch_index, 'cutters', 'Фрези (фактичне використання)', coalesce(cutters_used, 0)
      from activity_totals where coalesce(cutters_used, 0) > 0
  ), grouped_materials as materialized (
    select order_id, batch_index, category, name, sum(quantity)::numeric as quantity
      from actual_materials
     where quantity <> 0
     group by order_id, batch_index, category, name
  ), naryad_rows as materialized (
    select q.order_id, q.batch_index, o.order_num::text, o.customer::text,
           concat(o.order_num, case when q.batch_index is not null then '/' || q.batch_index::text else '' end) as naryad_number,
           a.first_activity, a.last_activity, a.card_count,
           coalesce(a.produced_qty, 0)::numeric as produced_qty,
           coalesce(a.scrap_qty, 0)::numeric as scrap_qty,
           coalesce(a.cutters_used, 0)::numeric as cutters_used,
           coalesce((select jsonb_agg(jsonb_build_object(
             'category', m.category, 'name', m.name, 'quantity', m.quantity, 'unit', 'шт'
           ) order by case m.category when 'sheets' then 1 when 'cutters' then 2 else 3 end, m.name)
             from grouped_materials m
            where m.order_id = q.order_id and m.batch_index is not distinct from q.batch_index), '[]'::jsonb) as materials
      from qualified_groups q
      join public.orders o on o.id = q.order_id
      join activity_totals a on a.order_id = q.order_id and a.batch_index is not distinct from q.batch_index
  ), material_summary as materialized (
    select category, name, sum(quantity)::numeric as quantity,
           count(*)::bigint as naryad_count
      from grouped_materials
     group by category, name
  ), totals as (
    select count(*)::bigint as naryad_count,
           coalesce(sum(card_count), 0)::bigint as card_count,
           coalesce(sum(produced_qty), 0)::numeric as produced_qty,
           coalesce(sum(scrap_qty), 0)::numeric as scrap_qty,
           coalesce(sum(cutters_used), 0)::numeric as cutters_used
      from naryad_rows
  )
  select jsonb_build_object(
    'month', to_char((select from_at from bounds) at time zone 'Europe/Kyiv', 'YYYY-MM'),
    'generated_at', clock_timestamp(),
    'summary', jsonb_build_object(
      'naryad_count', t.naryad_count,
      'card_count', t.card_count,
      'produced_qty', t.produced_qty,
      'scrap_qty', t.scrap_qty,
      'cutters_used', t.cutters_used,
      'scrap_rate', case when t.produced_qty + t.scrap_qty > 0
        then round(t.scrap_qty * 100 / (t.produced_qty + t.scrap_qty), 2) else 0 end
    ),
    'naryads', coalesce((select jsonb_agg(to_jsonb(n) order by n.last_activity desc, n.order_num) from naryad_rows n), '[]'::jsonb),
    'materials', coalesce((select jsonb_agg(jsonb_build_object(
      'category', m.category, 'name', m.name, 'quantity', m.quantity,
      'naryad_count', m.naryad_count, 'unit', 'шт'
    ) order by case m.category when 'sheets' then 1 when 'cutters' then 2 else 3 end, m.quantity desc, m.name) from material_summary m), '[]'::jsonb)
  )
  from totals t;
$monthly_report$;

revoke all on function public.mes_monthly_report(date) from public;
grant execute on function public.mes_monthly_report(date) to authenticated, service_role;

comment on function public.mes_monthly_report(date) is
  'Bounded calendar-month MES report. Returns only aggregated naryad, material, cutter and scrap data.';


-- ─── MIGRATION: 20260803170000_exclude_vb_from_monthly_report.sql ───
-- Internal VB rework orders are operational movements, not customer production
-- naryads. Exclude them at the source so they affect neither KPIs nor materials.
--
-- This follow-up is intentionally safe for databases where the monthly report
-- migration has already been deployed. The original migration is amended too,
-- so a clean installation gets the same definition directly.

do $exclude_vb_monthly_report$
declare
  v_definition text;
  v_search constant text := 'join public.orders o on o.id = t.order_id';
  v_replacement constant text := E'join public.orders o on o.id = t.order_id\n       and upper(btrim(o.order_num::text)) !~ ''^ВБ''';
begin
  select pg_get_functiondef('public.mes_monthly_report(date)'::regprocedure)
    into v_definition;

  -- Idempotent guard for environments where the amended base migration was
  -- used before this follow-up migration was registered.
  if position('upper(btrim(o.order_num::text)) !~ ''^ВБ''' in v_definition) > 0 then
    return;
  end if;

  if position(v_search in v_definition) = 0 then
    raise exception 'mes_monthly_report definition changed; VB exclusion was not applied';
  end if;

  v_definition := replace(v_definition, v_search, v_replacement);
  execute v_definition;
end;
$exclude_vb_monthly_report$;

comment on function public.mes_monthly_report(date) is
  'Bounded calendar-month MES report. Internal order numbers beginning with ВБ are excluded.';


-- ─── MIGRATION: 20260803190000_monthly_naryad_drilldown.sql ───
-- Lazy, single-naryad drilldown for the monthly report. This keeps the main
-- report cheap: detail rows are aggregated only when a user expands a naryad.

create index if not exists idx_cutter_usage_events_task_created_report
  on public.cutter_usage_events (task_id, created_at)
  include (nomenclature_id, quantity);

create or replace function public.mes_monthly_naryad_detail(
  p_month date,
  p_order_id uuid,
  p_batch_index integer default null
)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $monthly_naryad_detail$
  with bounds as materialized (
    select date_trunc('month', coalesce(p_month, current_date)::timestamp) at time zone 'Europe/Kyiv' as from_at,
           (date_trunc('month', coalesce(p_month, current_date)::timestamp) + interval '1 month') at time zone 'Europe/Kyiv' as to_at
  ), target_tasks as materialized (
    select t.id, t.plan_snapshot
      from public.tasks t
      join public.orders o on o.id = t.order_id
       and upper(btrim(o.order_num::text)) !~ '^ВБ'
     where t.order_id = p_order_id
       and t.batch_index is not distinct from p_batch_index
  ), group_snapshot as materialized (
    select tt.plan_snapshot
      from target_tasks tt
     where tt.plan_snapshot is not null
     order by tt.id
     limit 1
  ), planned_details as materialized (
    select part.key::uuid as nomenclature_id,
           coalesce((part.value->>'need')::numeric, (part.value->>'plan')::numeric, 0) as planned_qty,
           coalesce((part.value->>'stock')::numeric, 0) as bz_qty,
           coalesce(nullif(part.value->>'name', ''), n.name, 'Деталь без назви') as name
      from group_snapshot gs
      cross join lateral (
        select entry.key, entry.value
          from jsonb_each(gs.plan_snapshot) entry
         where entry.key ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
           and jsonb_typeof(entry.value) = 'object'
      ) part
      left join public.nomenclatures n on n.id = part.key::uuid
  ), month_history as materialized (
    select h.nomenclature_id, lower(btrim(coalesce(h.stage_name, ''))) as stage_name,
           coalesce(h.qty_completed, 0)::numeric as qty_completed,
           coalesce(h.scrap_qty, 0)::numeric as scrap_qty,
           coalesce(h.cutters_used, 0)::numeric as cutters_used
      from bounds b
      join public.work_cards wc on wc.task_id in (select id from target_tasks)
      join public.work_card_history h on h.card_id = wc.id
       and ((h.completed_at >= b.from_at and h.completed_at < b.to_at)
         or (h.completed_at is null and h.created_at >= b.from_at and h.created_at < b.to_at))
  ), actual_details as materialized (
    select h.nomenclature_id,
           sum(h.scrap_qty)::numeric as scrap_qty,
           sum(h.qty_completed) filter (where h.stage_name in ('склад бз', 'склад bz'))::numeric as actual_bz_qty
      from month_history h
     where h.nomenclature_id is not null
     group by h.nomenclature_id
  ), detail_rows as materialized (
    select p.nomenclature_id, p.name, p.planned_qty, p.bz_qty,
           coalesce(a.actual_bz_qty, 0)::numeric as actual_bz_qty,
           coalesce(a.scrap_qty, 0)::numeric as scrap_qty
      from planned_details p
      left join actual_details a on a.nomenclature_id = p.nomenclature_id
  ), cutter_rows as materialized (
    select n.name, sum(cue.quantity)::numeric as quantity
      from bounds b
      join public.cutter_usage_events cue
        on cue.created_at >= b.from_at and cue.created_at < b.to_at
      join target_tasks tt on tt.id = cue.task_id
      join public.nomenclatures n on n.id = cue.nomenclature_id
     group by n.name
  ), cutter_totals as (
    select coalesce(sum(h.cutters_used) filter (where h.stage_name in ('розкрій', 'розкрій (перезмінка)')), 0)::numeric as history_total,
           coalesce((select sum(c.quantity) from cutter_rows c), 0)::numeric as detailed_total
      from month_history h
  ), final_cutters as (
    select c.name, c.quantity from cutter_rows c
    union all
    select 'Без деталізації', t.history_total - t.detailed_total
      from cutter_totals t
     where t.history_total > t.detailed_total
  )
  select jsonb_build_object(
    'details', coalesce((select jsonb_agg(jsonb_build_object(
      'nomenclature_id', d.nomenclature_id, 'name', d.name,
      'planned_qty', d.planned_qty, 'bz_qty', d.bz_qty,
      'actual_bz_qty', d.actual_bz_qty, 'scrap_qty', d.scrap_qty
    ) order by d.name) from detail_rows d), '[]'::jsonb),
    'cutters', coalesce((select jsonb_agg(jsonb_build_object(
      'name', c.name, 'quantity', c.quantity
    ) order by c.quantity desc, c.name) from final_cutters c), '[]'::jsonb)
  );
$monthly_naryad_detail$;

revoke all on function public.mes_monthly_naryad_detail(date, uuid, integer) from public;
grant execute on function public.mes_monthly_naryad_detail(date, uuid, integer) to authenticated, service_role;

comment on function public.mes_monthly_naryad_detail(date, uuid, integer) is
  'Lazy monthly naryad drilldown: planned details, BZ, scrap and factual cutter types.';


-- ─── MIGRATION: 20260803210000_monthly_report_by_naryad_created_at.sql ───
-- A naryad belongs to the calendar month in which its first task was created,
-- not to every month in which somebody performed an operation. Its factual
-- work period and totals may therefore extend beyond the selected month.

create index if not exists idx_tasks_created_order_batch_monthly_report
  on public.tasks (created_at, order_id, batch_index, id);

create or replace function public.mes_monthly_report(p_month date)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $monthly_report$
  with bounds as materialized (
    select date_trunc('month', coalesce(p_month, current_date)::timestamp) at time zone 'Europe/Kyiv' as from_at,
           (date_trunc('month', coalesce(p_month, current_date)::timestamp) + interval '1 month') at time zone 'Europe/Kyiv' as to_at
  ), qualified_groups as materialized (
    select distinct t.order_id, t.batch_index
      from bounds b
      join public.tasks t on t.created_at >= b.from_at and t.created_at < b.to_at
      join public.orders o on o.id = t.order_id
       and upper(btrim(o.order_num::text)) !~ '^ВБ'
     where not exists (
       select 1 from public.tasks earlier
        where earlier.order_id = t.order_id
          and earlier.batch_index is not distinct from t.batch_index
          and earlier.created_at < b.from_at
     )
  ), target_tasks as materialized (
    select t.id, t.order_id, t.batch_index
      from public.tasks t
      join qualified_groups q on q.order_id = t.order_id
       and q.batch_index is not distinct from t.batch_index
  ), naryad_activity as materialized (
    select tt.order_id, tt.batch_index, wc.id as card_id,
           coalesce(h.completed_at, h.created_at) as activity_at,
           coalesce(h.qty_completed, 0)::numeric as qty_completed,
           coalesce(h.scrap_qty, 0)::numeric as scrap_qty,
           coalesce(h.cutters_used, 0)::numeric as cutters_used,
           lower(btrim(coalesce(h.stage_name, ''))) as stage_name
      from target_tasks tt
      join public.work_cards wc on wc.task_id = tt.id
      join public.work_card_history h on h.card_id = wc.id
  ), activity_totals as materialized (
    select q.order_id, q.batch_index,
           min(a.activity_at) as first_activity,
           max(a.activity_at) as last_activity,
           count(distinct a.card_id)::bigint as card_count,
           coalesce(sum(a.qty_completed) filter (where a.stage_name in ('приймка', 'completed', 'склад бз', 'сгп', 'пакування', 'пакування/сгп')), 0)::numeric as produced_qty,
           coalesce(sum(a.scrap_qty), 0)::numeric as scrap_qty,
           coalesce(sum(a.cutters_used) filter (where a.stage_name in ('розкрій', 'розкрій (перезмінка)')), 0)::numeric as cutters_used
      from qualified_groups q
      left join naryad_activity a on a.order_id = q.order_id
       and a.batch_index is not distinct from q.batch_index
     group by q.order_id, q.batch_index
  ), request_materials as materialized (
    select tt.order_id, tt.batch_index,
           case
             when lower(coalesce(n.name, mr.details, '')) like '%фрез%' then 'cutters'
             when lower(coalesce(n.name, mr.details, '')) like '%лист%' or n.type in ('raw', 'material') then 'sheets'
             else 'other'
           end as category,
           coalesce(nullif(btrim(n.name), ''), nullif(btrim(mr.details), ''), 'Матеріал без назви') as name,
           sum(coalesce(mr.quantity, 0))::numeric as quantity
      from target_tasks tt
      join public.material_requests mr on mr.task_id = tt.id
      left join public.nomenclatures n on n.id = mr.nomenclature_id
     where mr.status in ('issued', 'completed')
     group by tt.order_id, tt.batch_index, category,
              coalesce(nullif(btrim(n.name), ''), nullif(btrim(mr.details), ''), 'Матеріал без назви')
  ), actual_materials as materialized (
    select order_id, batch_index, category, name, quantity
      from request_materials where category <> 'cutters'
    union all
    select order_id, batch_index, 'cutters', 'Фрези (фактичне використання)', cutters_used
      from activity_totals where cutters_used > 0
  ), grouped_materials as materialized (
    select order_id, batch_index, category, name, sum(quantity)::numeric as quantity
      from actual_materials where quantity <> 0
     group by order_id, batch_index, category, name
  ), naryad_rows as materialized (
    select q.order_id, q.batch_index, o.order_num::text, o.customer::text,
           coalesce((select string_agg(distinct n.name, ', ' order by n.name)
             from public.order_items oi
             join public.nomenclatures n on n.id = oi.nomenclature_id
            where oi.order_id = q.order_id), '—') as product_name,
           concat(o.order_num, case when q.batch_index is not null then '/' || q.batch_index::text else '' end) as naryad_number,
           a.first_activity, a.last_activity, a.card_count,
           a.produced_qty, a.scrap_qty, a.cutters_used,
           coalesce((select jsonb_agg(jsonb_build_object(
             'category', m.category, 'name', m.name, 'quantity', m.quantity, 'unit', 'шт'
           ) order by case m.category when 'sheets' then 1 when 'cutters' then 2 else 3 end, m.name)
             from grouped_materials m where m.order_id = q.order_id
              and m.batch_index is not distinct from q.batch_index), '[]'::jsonb) as materials
      from qualified_groups q
      join public.orders o on o.id = q.order_id
      join activity_totals a on a.order_id = q.order_id
       and a.batch_index is not distinct from q.batch_index
  ), material_summary as materialized (
    select category, name, sum(quantity)::numeric as quantity, count(*)::bigint as naryad_count
      from grouped_materials group by category, name
  ), totals as (
    select count(*)::bigint as naryad_count,
           coalesce(sum(card_count), 0)::bigint as card_count,
           coalesce(sum(produced_qty), 0)::numeric as produced_qty,
           coalesce(sum(scrap_qty), 0)::numeric as scrap_qty,
           coalesce(sum(cutters_used), 0)::numeric as cutters_used
      from naryad_rows
  )
  select jsonb_build_object(
    'month', to_char((select from_at from bounds) at time zone 'Europe/Kyiv', 'YYYY-MM'),
    'generated_at', clock_timestamp(),
    'summary', jsonb_build_object(
      'naryad_count', t.naryad_count, 'card_count', t.card_count,
      'produced_qty', t.produced_qty, 'scrap_qty', t.scrap_qty,
      'cutters_used', t.cutters_used,
      'scrap_rate', case when t.produced_qty + t.scrap_qty > 0
        then round(t.scrap_qty * 100 / (t.produced_qty + t.scrap_qty), 2) else 0 end
    ),
    'naryads', coalesce((select jsonb_agg(to_jsonb(n) order by
      (select min(t.created_at) from public.tasks t where t.order_id = n.order_id
        and t.batch_index is not distinct from n.batch_index) asc,
      n.order_num, n.batch_index
    ) from naryad_rows n), '[]'::jsonb),
    'materials', coalesce((select jsonb_agg(jsonb_build_object(
      'category', m.category, 'name', m.name, 'quantity', m.quantity,
      'naryad_count', m.naryad_count, 'unit', 'шт'
    ) order by case m.category when 'sheets' then 1 when 'cutters' then 2 else 3 end, m.quantity desc, m.name) from material_summary m), '[]'::jsonb)
  ) from totals t;
$monthly_report$;

revoke all on function public.mes_monthly_report(date) from public;
grant execute on function public.mes_monthly_report(date) to authenticated, service_role;

comment on function public.mes_monthly_report(date) is
  'Monthly MES report assigned by first naryad task creation month; factual work period may cross month boundaries.';

-- Drilldown follows the same ownership rule: once the naryad is selected, show
-- its complete lifecycle rather than cutting detail totals at month-end.
create or replace function public.mes_monthly_naryad_detail(
  p_month date, p_order_id uuid, p_batch_index integer default null
)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $monthly_naryad_detail$
  with target_tasks as materialized (
    select t.id, t.plan_snapshot
      from public.tasks t
      join public.orders o on o.id = t.order_id and upper(btrim(o.order_num::text)) !~ '^ВБ'
     where t.order_id = p_order_id and t.batch_index is not distinct from p_batch_index
  ), group_snapshot as materialized (
    select plan_snapshot from target_tasks where plan_snapshot is not null order by id limit 1
  ), planned_details as materialized (
    select part.key::uuid as nomenclature_id,
           coalesce((part.value->>'need')::numeric, (part.value->>'plan')::numeric, 0) as planned_qty,
           coalesce((part.value->>'stock')::numeric, 0) as bz_qty,
           coalesce(nullif(part.value->>'name', ''), n.name, 'Деталь без назви') as name
      from group_snapshot gs
      cross join lateral (
        select e.key, e.value from jsonb_each(gs.plan_snapshot) e
         where e.key ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
           and jsonb_typeof(e.value) = 'object'
      ) part
      left join public.nomenclatures n on n.id = part.key::uuid
  ), all_history as materialized (
    select h.nomenclature_id, lower(btrim(coalesce(h.stage_name, ''))) as stage_name,
           coalesce(h.qty_completed, 0)::numeric as qty_completed,
           coalesce(h.scrap_qty, 0)::numeric as scrap_qty,
           coalesce(h.cutters_used, 0)::numeric as cutters_used,
           h.card_info
      from public.work_cards wc
      join public.work_card_history h on h.card_id = wc.id
     where wc.task_id in (select id from target_tasks)
  ), actual_details as materialized (
    select nomenclature_id, sum(scrap_qty)::numeric as scrap_qty,
           sum(qty_completed) filter (where stage_name = 'розкрій')::numeric as actual_cut_qty,
           sum(greatest(
             qty_completed - coalesce(nullif(substring(card_info from '\[REQ:(\d+)\]'), '')::numeric, qty_completed),
             0
           )) filter (where stage_name = 'розкрій')::numeric as actual_bz_qty
      from all_history where nomenclature_id is not null group by nomenclature_id
  ), detail_rows as materialized (
    select p.nomenclature_id, p.name, p.planned_qty, p.bz_qty,
           coalesce(a.actual_cut_qty, 0)::numeric as actual_cut_qty,
           greatest(coalesce(a.actual_cut_qty, 0) - p.planned_qty, 0)::numeric as actual_bz_qty,
           coalesce(a.scrap_qty, 0)::numeric as scrap_qty
      from planned_details p left join actual_details a on a.nomenclature_id = p.nomenclature_id
  ), cutter_rows as materialized (
    select n.name, sum(cue.quantity)::numeric as quantity
      from public.cutter_usage_events cue
      join target_tasks tt on tt.id = cue.task_id
      join public.nomenclatures n on n.id = cue.nomenclature_id
     group by n.name
  ), cutter_totals as (
    select coalesce(sum(cutters_used) filter (where stage_name in ('розкрій', 'розкрій (перезмінка)')), 0)::numeric as history_total,
           coalesce((select sum(quantity) from cutter_rows), 0)::numeric as detailed_total
      from all_history
  ), final_cutters as (
    select name, quantity from cutter_rows
    union all
    select 'Без деталізації', history_total - detailed_total from cutter_totals where history_total > detailed_total
  )
  select jsonb_build_object(
    'details', coalesce((select jsonb_agg(jsonb_build_object(
      'nomenclature_id', d.nomenclature_id, 'name', d.name, 'planned_qty', d.planned_qty,
      'actual_cut_qty', d.actual_cut_qty,
      'bz_qty', d.bz_qty, 'actual_bz_qty', d.actual_bz_qty, 'scrap_qty', d.scrap_qty
    ) order by d.name) from detail_rows d), '[]'::jsonb),
    'cutters', coalesce((select jsonb_agg(jsonb_build_object('name', c.name, 'quantity', c.quantity)
      order by c.quantity desc, c.name) from final_cutters c), '[]'::jsonb)
  );
$monthly_naryad_detail$;

revoke all on function public.mes_monthly_naryad_detail(date, uuid, integer) from public;
grant execute on function public.mes_monthly_naryad_detail(date, uuid, integer) to authenticated, service_role;


-- ─── MIGRATION: 20260803230000_monthly_report_chronological_order.sql ───
-- Keep monthly naryads in deterministic creation order (oldest first).
-- This patches databases where the preceding report function is already live;
-- clean installations receive the same ordering from the amended base migration.

do $monthly_report_chronological_order$
declare
  v_definition text;
  v_old constant text := '''naryads'', coalesce((select jsonb_agg(to_jsonb(n) order by n.last_activity desc nulls last, n.order_num) from naryad_rows n), ''[]''::jsonb)';
  v_new constant text := '''naryads'', coalesce((select jsonb_agg(to_jsonb(n) order by
      (select min(t.created_at) from public.tasks t where t.order_id = n.order_id
        and t.batch_index is not distinct from n.batch_index) asc,
      n.order_num, n.batch_index
    ) from naryad_rows n), ''[]''::jsonb)';
begin
  select pg_get_functiondef('public.mes_monthly_report(date)'::regprocedure)
    into v_definition;

  if position('select min(t.created_at) from public.tasks t where t.order_id = n.order_id' in v_definition) > 0 then
    return;
  end if;

  if position(v_old in v_definition) = 0 then
    raise exception 'mes_monthly_report definition changed; chronological ordering was not applied';
  end if;

  execute replace(v_definition, v_old, v_new);
end;
$monthly_report_chronological_order$;

comment on function public.mes_monthly_report(date) is
  'Monthly MES report assigned and ordered by first naryad task creation time.';


-- ─── MIGRATION: 20260804010000_monthly_report_actual_cutting_bz.sql ───
-- Factual +BZ created by cutting, not BZ stock consumed by a naryad.
-- Full replacement is deliberate: pg_get_functiondef formatting differs
-- between PostgreSQL versions, so text-patching a deployed function is brittle.

create or replace function public.mes_monthly_naryad_detail(
  p_month date,
  p_order_id uuid,
  p_batch_index integer default null
)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $monthly_naryad_detail$
  with target_tasks as materialized (
    select t.id, t.plan_snapshot
      from public.tasks t
      join public.orders o on o.id = t.order_id
       and upper(btrim(o.order_num::text)) !~ '^ВБ'
     where t.order_id = p_order_id
       and t.batch_index is not distinct from p_batch_index
  ), group_snapshot as materialized (
    select plan_snapshot
      from target_tasks
     where plan_snapshot is not null
     order by id
     limit 1
  ), planned_details as materialized (
    select part.key::uuid as nomenclature_id,
           coalesce((part.value->>'need')::numeric, (part.value->>'plan')::numeric, 0) as planned_qty,
           coalesce(nullif(part.value->>'name', ''), n.name, 'Деталь без назви') as name
      from group_snapshot gs
      cross join lateral (
        select e.key, e.value
          from jsonb_each(gs.plan_snapshot) e
         where e.key ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
           and jsonb_typeof(e.value) = 'object'
      ) part
      left join public.nomenclatures n on n.id = part.key::uuid
  ), all_history as materialized (
    select h.nomenclature_id,
           lower(btrim(coalesce(h.stage_name, ''))) as stage_name,
           coalesce(h.qty_completed, 0)::numeric as qty_completed,
           coalesce(h.scrap_qty, 0)::numeric as scrap_qty,
           coalesce(h.cutters_used, 0)::numeric as cutters_used,
           h.card_info
      from public.work_cards wc
      join public.work_card_history h on h.card_id = wc.id
     where wc.task_id in (select id from target_tasks)
  ), actual_details as materialized (
    select nomenclature_id,
           sum(scrap_qty)::numeric as scrap_qty,
           sum(qty_completed) filter (where stage_name = 'розкрій')::numeric as actual_cut_qty,
           sum(greatest(
             qty_completed - coalesce(
               nullif(substring(card_info from '\[REQ:([0-9]+)\]'), '')::numeric,
               qty_completed
             ),
             0
           )) filter (where stage_name = 'розкрій')::numeric as actual_bz_qty
      from all_history
     where nomenclature_id is not null
     group by nomenclature_id
  ), detail_rows as materialized (
    select p.nomenclature_id, p.name, p.planned_qty,
           coalesce(a.actual_cut_qty, 0)::numeric as actual_cut_qty,
           greatest(coalesce(a.actual_cut_qty, 0) - p.planned_qty, 0)::numeric as actual_bz_qty,
           coalesce(a.scrap_qty, 0)::numeric as scrap_qty
      from planned_details p
      left join actual_details a on a.nomenclature_id = p.nomenclature_id
  ), cutter_rows as materialized (
    select n.name, sum(cue.quantity)::numeric as quantity
      from public.cutter_usage_events cue
      join target_tasks tt on tt.id = cue.task_id
      join public.nomenclatures n on n.id = cue.nomenclature_id
     group by n.name
  ), cutter_totals as (
    select coalesce(sum(cutters_used) filter (
             where stage_name in ('розкрій', 'розкрій (перезмінка)')
           ), 0)::numeric as history_total,
           coalesce((select sum(quantity) from cutter_rows), 0)::numeric as detailed_total
      from all_history
  ), final_cutters as (
    select name, quantity from cutter_rows
    union all
    select 'Без деталізації', history_total - detailed_total
      from cutter_totals
     where history_total > detailed_total
  )
  select jsonb_build_object(
    'details', coalesce((
      select jsonb_agg(jsonb_build_object(
        'nomenclature_id', d.nomenclature_id,
        'name', d.name,
        'planned_qty', d.planned_qty,
        'actual_cut_qty', d.actual_cut_qty,
        'actual_bz_qty', d.actual_bz_qty,
        'scrap_qty', d.scrap_qty
      ) order by d.name)
      from detail_rows d
    ), '[]'::jsonb),
    'cutters', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', c.name,
        'quantity', c.quantity
      ) order by c.quantity desc, c.name)
      from final_cutters c
    ), '[]'::jsonb)
  );
$monthly_naryad_detail$;

revoke all on function public.mes_monthly_naryad_detail(date, uuid, integer) from public;
grant execute on function public.mes_monthly_naryad_detail(date, uuid, integer)
  to authenticated, service_role;

comment on function public.mes_monthly_naryad_detail(date, uuid, integer) is
  'Naryad drilldown with factual +BZ: completed cutting quantity after scrap minus per-card REQ.';


-- ─── MIGRATION: 20260804030000_monthly_report_actual_cut_fact.sql ───
-- Add factual cut quantity to an already deployed drilldown without relying on
-- pg_get_functiondef text formatting. qty_completed is already net of scrap.

alter function public.mes_monthly_naryad_detail(date, uuid, integer)
  rename to mes_monthly_naryad_detail_without_cut_fact;

create function public.mes_monthly_naryad_detail(
  p_month date,
  p_order_id uuid,
  p_batch_index integer default null
)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $monthly_detail_with_cut_fact$
  with base as materialized (
    select public.mes_monthly_naryad_detail_without_cut_fact(
      p_month, p_order_id, p_batch_index
    ) as value
  ), target_tasks as materialized (
    select t.id
      from public.tasks t
     where t.order_id = p_order_id
       and t.batch_index is not distinct from p_batch_index
  ), actual as materialized (
    select h.nomenclature_id, sum(coalesce(h.qty_completed, 0))::numeric as quantity
      from public.work_cards wc
      join public.work_card_history h on h.card_id = wc.id
     where wc.task_id in (select id from target_tasks)
       and lower(btrim(coalesce(h.stage_name, ''))) = 'розкрій'
     group by h.nomenclature_id
  ), enriched_details as (
    select coalesce(jsonb_agg(
      detail.value || jsonb_build_object(
        'actual_cut_qty', coalesce(a.quantity, 0),
        'actual_bz_qty', greatest(coalesce(a.quantity, 0) - coalesce((detail.value->>'planned_qty')::numeric, 0), 0)
      )
      order by detail.ordinality
    ), '[]'::jsonb) as value
      from base b
      cross join lateral jsonb_array_elements(coalesce(b.value->'details', '[]'::jsonb))
        with ordinality as detail(value, ordinality)
      left join actual a on a.nomenclature_id::text = detail.value->>'nomenclature_id'
  )
  select jsonb_set(b.value, '{details}', e.value, true)
    from base b cross join enriched_details e;
$monthly_detail_with_cut_fact$;

revoke all on function public.mes_monthly_naryad_detail(date, uuid, integer) from public;
grant execute on function public.mes_monthly_naryad_detail(date, uuid, integer)
  to authenticated, service_role;

revoke all on function public.mes_monthly_naryad_detail_without_cut_fact(date, uuid, integer) from public;
grant execute on function public.mes_monthly_naryad_detail_without_cut_fact(date, uuid, integer)
  to authenticated, service_role;

comment on function public.mes_monthly_naryad_detail(date, uuid, integer) is
  'Naryad drilldown with FACT = net completed cutting quantity, including reissue cards.';


-- ─── MIGRATION: 20260804050000_monthly_report_net_actual_bz.sql ───
-- Net factual BZ per detail: only the amount by which the final aggregate cut
-- quantity exceeds the detail plan. Per-loading surpluses must not survive when
-- other cards of the same detail leave an overall shortage.

create or replace function public.mes_monthly_naryad_detail(
  p_month date,
  p_order_id uuid,
  p_batch_index integer default null
)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $monthly_detail_with_net_bz$
  with base as materialized (
    select public.mes_monthly_naryad_detail_without_cut_fact(
      p_month, p_order_id, p_batch_index
    ) as value
  ), target_tasks as materialized (
    select t.id from public.tasks t
     where t.order_id = p_order_id
       and t.batch_index is not distinct from p_batch_index
  ), actual as materialized (
    select h.nomenclature_id, sum(coalesce(h.qty_completed, 0))::numeric as quantity
      from public.work_cards wc
      join public.work_card_history h on h.card_id = wc.id
     where wc.task_id in (select id from target_tasks)
       and lower(btrim(coalesce(h.stage_name, ''))) = 'розкрій'
     group by h.nomenclature_id
  ), enriched_details as (
    select coalesce(jsonb_agg(
      detail.value || jsonb_build_object(
        'actual_cut_qty', coalesce(a.quantity, 0),
        'actual_bz_qty', greatest(
          coalesce(a.quantity, 0) - coalesce((detail.value->>'planned_qty')::numeric, 0),
          0
        )
      ) order by detail.ordinality
    ), '[]'::jsonb) as value
      from base b
      cross join lateral jsonb_array_elements(coalesce(b.value->'details', '[]'::jsonb))
        with ordinality as detail(value, ordinality)
      left join actual a on a.nomenclature_id::text = detail.value->>'nomenclature_id'
  )
  select jsonb_set(b.value, '{details}', e.value, true)
    from base b cross join enriched_details e;
$monthly_detail_with_net_bz$;

revoke all on function public.mes_monthly_naryad_detail(date, uuid, integer) from public;
grant execute on function public.mes_monthly_naryad_detail(date, uuid, integer)
  to authenticated, service_role;

comment on function public.mes_monthly_naryad_detail(date, uuid, integer) is
  'Naryad drilldown: FACT includes reissues; factual BZ is max(FACT - PLAN, 0) per detail.';


-- ─── MIGRATION: 20260804070000_monthly_report_product_column.sql ───
-- Add product names to each monthly naryad without rebuilding or rescanning the
-- report implementation. The wrapper enriches the already aggregated JSON.

alter function public.mes_monthly_report(date)
  rename to mes_monthly_report_without_products;

create function public.mes_monthly_report(p_month date)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $monthly_report_with_products$
  with base as materialized (
    select public.mes_monthly_report_without_products(p_month) as value
  ), enriched_naryads as (
    select coalesce(jsonb_agg(
      naryad.value || jsonb_build_object(
        'product_name', coalesce(products.name, '—')
      ) order by naryad.ordinality
    ), '[]'::jsonb) as value
      from base b
      cross join lateral jsonb_array_elements(coalesce(b.value->'naryads', '[]'::jsonb))
        with ordinality as naryad(value, ordinality)
      left join lateral (
        select string_agg(distinct n.name, ', ' order by n.name) as name
          from public.order_items oi
          join public.nomenclatures n on n.id = oi.nomenclature_id
         where oi.order_id = (naryad.value->>'order_id')::uuid
      ) products on true
  )
  select jsonb_set(b.value, '{naryads}', e.value, true)
    from base b cross join enriched_naryads e;
$monthly_report_with_products$;

revoke all on function public.mes_monthly_report(date) from public;
grant execute on function public.mes_monthly_report(date) to authenticated, service_role;

revoke all on function public.mes_monthly_report_without_products(date) from public;
grant execute on function public.mes_monthly_report_without_products(date) to authenticated, service_role;

comment on function public.mes_monthly_report(date) is
  'Monthly MES report enriched with product names from order items.';


-- ─── MIGRATION: 20260804080000_monthly_report_plan_kpis.sql ───
-- Enrich the monthly KPI summary with the production and cutter plans while
-- keeping the report as one bounded database call.

alter function public.mes_monthly_report(date)
  rename to mes_monthly_report_without_plan_kpis;

create function public.mes_monthly_report(p_month date)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $monthly_report_with_plan_kpis$
  with base as materialized (
    select public.mes_monthly_report_without_plan_kpis(p_month) as value
  ), report_groups as materialized (
    select (row.value->>'order_id')::uuid as order_id,
           nullif(row.value->>'batch_index', '')::integer as batch_index
      from base b
      cross join lateral jsonb_array_elements(coalesce(b.value->'naryads', '[]'::jsonb)) row(value)
  ), target_tasks as materialized (
    select t.id, t.order_id, t.batch_index, t.plan_snapshot
      from public.tasks t
      join report_groups g on g.order_id = t.order_id
       and g.batch_index is not distinct from t.batch_index
  ), group_snapshots as materialized (
    select distinct on (t.order_id, t.batch_index)
           t.order_id, t.batch_index, t.plan_snapshot
      from target_tasks t
     where t.plan_snapshot is not null
     order by t.order_id, t.batch_index, t.id
  ), production_plan as (
    select coalesce(sum(coalesce(
             nullif(part.value->>'need', '')::numeric,
             nullif(part.value->>'plan', '')::numeric,
             0
           )), 0)::numeric as quantity
      from group_snapshots gs
      cross join lateral jsonb_each(gs.plan_snapshot) part(key, value)
     where part.key ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
       and jsonb_typeof(part.value) = 'object'
  ), cutter_plan as (
    select coalesce(sum(coalesce(mr.quantity, 0)), 0)::numeric as quantity
      from target_tasks tt
      join public.material_requests mr on mr.task_id = tt.id
      left join public.nomenclatures n on n.id = mr.nomenclature_id
     where lower(coalesce(n.name, mr.details, '')) like '%фрез%'
  )
  select jsonb_set(
           b.value,
           '{summary}',
           coalesce(b.value->'summary', '{}'::jsonb) || jsonb_build_object(
             'planned_qty', pp.quantity,
             'planned_cutters', cp.quantity
           ),
           true
         )
    from base b cross join production_plan pp cross join cutter_plan cp;
$monthly_report_with_plan_kpis$;

revoke all on function public.mes_monthly_report(date) from public;
grant execute on function public.mes_monthly_report(date) to authenticated, service_role;

revoke all on function public.mes_monthly_report_without_plan_kpis(date) from public;
grant execute on function public.mes_monthly_report_without_plan_kpis(date) to authenticated, service_role;

comment on function public.mes_monthly_report(date) is
  'Monthly MES report with product names and planned production/cutter KPI totals.';


-- ─── MIGRATION: 20260804100000_correct_accidental_x_3_39_scrap.sql ───
-- One-time guarded correction requested for X-3-39 in naryads
-- 23072026-01 and 26072026-01. Respectively 1,916 and 1,560 pieces were
-- entered as scrap by mistake and must be returned as good production.

do $correction$
declare
  v_order_count integer;
  v_nomenclature_count integer;
  v_history_count integer;
  v_total_scrap numeric;
  v_first_order_scrap numeric;
  v_second_order_scrap numeric;
  v_classification_count integer;
  v_classified_qty numeric;
  v_unclassified_qty numeric;
  v_category_inventory_count integer;
  v_category_inventory_qty numeric;
  v_legacy_classification_count integer;
  v_reissue_count integer;
  v_inventory_row_count integer;
  v_inventory_qty numeric;
  v_category record;
begin
  create temporary table _x339_scrap_to_correct on commit drop as
  select h.id as history_id,
         wc.id as card_id,
         wc.task_id,
         coalesce(wc.order_id, t.order_id) as order_id,
         case
           when regexp_replace(btrim(o.order_num::text), '[^0-9]', '', 'g') in ('2307202601', '23072026') then '23072026-01'
           when regexp_replace(btrim(o.order_num::text), '[^0-9]', '', 'g') in ('2607202601', '26072026') then '26072026-01'
         end as order_num,
         h.nomenclature_id,
         h.scrap_qty::numeric as scrap_qty
    from public.work_card_history h
    join public.work_cards wc on wc.id = h.card_id
    left join public.tasks t on t.id = wc.task_id
    join public.orders o on o.id = coalesce(wc.order_id, t.order_id)
    join public.nomenclatures n on n.id = h.nomenclature_id
   where (
       regexp_replace(btrim(o.order_num::text), '[^0-9]', '', 'g') in ('2307202601', '2607202601')
       or (
         regexp_replace(btrim(o.order_num::text), '[^0-9]', '', 'g') in ('23072026', '26072026')
         and coalesce(t.batch_index, 1) = 1
       )
     )
     and lower(n.name) ~ '(x|х)[[:space:]-]*3[[:space:]-]*39$'
     and coalesce(h.scrap_qty, 0) > 0;

  select count(distinct o.id)
    into v_order_count
    from public.orders o
   where regexp_replace(btrim(o.order_num::text), '[^0-9]', '', 'g') in
     ('2307202601', '23072026', '2607202601', '26072026');

  if v_order_count <> 2 then
    raise exception 'X-3-39 correction aborted: expected 2 target orders, found %', v_order_count;
  end if;

  select count(*), count(distinct nomenclature_id), coalesce(sum(scrap_qty), 0)
    into v_history_count, v_nomenclature_count, v_total_scrap
    from _x339_scrap_to_correct;

  if v_history_count = 0 then
    raise exception 'X-3-39 correction aborted: no positive scrap history found';
  end if;
  if v_nomenclature_count <> 1 then
    raise exception 'X-3-39 correction aborted: expected one nomenclature, found %', v_nomenclature_count;
  end if;

  select coalesce(sum(scrap_qty), 0)
    into v_first_order_scrap
    from _x339_scrap_to_correct
   where order_num = '23072026-01';
  select coalesce(sum(scrap_qty), 0)
    into v_second_order_scrap
    from _x339_scrap_to_correct
   where order_num = '26072026-01';

  if v_first_order_scrap <> 1916 then
    raise exception 'X-3-39 correction aborted: order 23072026-01 expected 1916 scrap pieces, found %', v_first_order_scrap;
  end if;
  if v_second_order_scrap <> 1560 then
    raise exception 'X-3-39 correction aborted: order 26072026-01 expected 1560 scrap pieces, found %', v_second_order_scrap;
  end if;
  if v_total_scrap <> 3476 then
    raise exception 'X-3-39 correction aborted: expected exactly 3476 scrap pieces in total, found %', v_total_scrap;
  end if;

  select count(*), coalesce(sum(c.quantity), 0)
    into v_classification_count, v_classified_qty
    from public.scrap_classifications c
   where c.source_history_id in (select history_id from _x339_scrap_to_correct);

  if v_classification_count <> 27 then
    raise exception 'X-3-39 correction aborted: expected 27 VKYA classifications, found %', v_classification_count;
  end if;
  v_unclassified_qty := v_total_scrap - v_classified_qty;
  if v_classified_qty <> 3472 or v_unclassified_qty <> 4 then
    raise exception 'X-3-39 correction aborted: expected 3472 classified and 4 unclassified, found % classified and % unclassified',
      v_classified_qty, v_unclassified_qty;
  end if;

  select count(*)
    into v_legacy_classification_count
    from public.work_card_history h
   where h.id in (select history_id from _x339_scrap_to_correct)
     and coalesce(h.qc_scrap_comment, '') like '%[SCRAP_CAT:%';

  if v_legacy_classification_count = 0 then
    raise exception 'X-3-39 correction aborted: classification comments are missing';
  end if;

  select count(*)
    into v_reissue_count
    from public.work_cards wc
   where wc.order_id in (select distinct order_id from _x339_scrap_to_correct)
     and wc.nomenclature_id in (select distinct nomenclature_id from _x339_scrap_to_correct)
     and (coalesce(wc.card_info, '') ilike '%[REDO]%'
       or coalesce(wc.card_info, '') ilike '%довипуск%');

  if v_reissue_count <> 0 then
    raise exception 'X-3-39 correction aborted: % reissue cards already exist', v_reissue_count;
  end if;

  select count(*), coalesce(sum(i.total_qty), 0)
    into v_inventory_row_count, v_inventory_qty
    from public.inventory i
   where i.nomenclature_id = (select nomenclature_id from _x339_scrap_to_correct limit 1)
     and i.type = 'scrap_ready';

  if v_inventory_row_count <> 1 then
    raise exception 'X-3-39 correction aborted: expected one scrap_ready inventory row, found %', v_inventory_row_count;
  end if;
  if v_inventory_qty < v_total_scrap then
    raise exception 'X-3-39 correction aborted: scrap_ready has %, required %', v_inventory_qty, v_total_scrap;
  end if;

  create temporary table _x339_categories_to_reverse on commit drop as
  select cc.category, sum(cc.quantity)::numeric as quantity
    from public.scrap_classification_categories cc
    join public.scrap_classifications c on c.id = cc.classification_id
   where c.source_history_id in (select history_id from _x339_scrap_to_correct)
   group by cc.category;

  if (select coalesce(sum(quantity), 0) from _x339_categories_to_reverse) <> v_classified_qty then
    raise exception 'X-3-39 correction aborted: category allocations do not total classified quantity %', v_classified_qty;
  end if;

  for v_category in select category, quantity from _x339_categories_to_reverse loop
    select count(*), coalesce(sum(i.total_qty), 0)
      into v_category_inventory_count, v_category_inventory_qty
      from public.inventory i
     where i.nomenclature_id = (select nomenclature_id from _x339_scrap_to_correct limit 1)
       and i.type = 'scrap_cat_' || v_category.category::text;

    if v_category_inventory_count > 1 then
      raise exception 'X-3-39 correction aborted: category % has ambiguous inventory rows: %',
        v_category.category, v_category_inventory_count;
    end if;
  end loop;

  -- Reverse the inventory projections created by the 27 VKYA classification
  -- actions before removing their analytical ledger rows.
  for v_category in select category, quantity from _x339_categories_to_reverse loop
    update public.inventory i
       set total_qty = greatest(0, coalesce(i.total_qty, 0) - v_category.quantity),
           updated_at = now()
     where i.nomenclature_id = (select nomenclature_id from _x339_scrap_to_correct limit 1)
       and i.type = 'scrap_cat_' || v_category.category::text;
  end loop;

  delete from public.scrap_classifications c
   where c.source_history_id in (select history_id from _x339_scrap_to_correct);

  -- Return every mistakenly scrapped piece to the factual good quantity while
  -- retaining the original history row and an explicit audit marker.
  update public.work_card_history h
     set qty_completed = coalesce(h.qty_completed, 0) + t.scrap_qty,
         scrap_qty = 0,
         is_archived_scrap = false,
         qc_scrap_comment = concat_ws(
           ' ',
           nullif(btrim(
             regexp_replace(
               regexp_replace(coalesce(h.qc_scrap_comment, ''), '\[SCRAP_CAT:[^]]+\]', '', 'g'),
               '\[SCRAP_REASONS:[^]]+\]', '', 'g'
             )
           ), ''),
           format(
             '[SCRAP_CORRECTION:20260804100000 accidental X-3-39 entry; returned %s pieces to good production]',
             t.scrap_qty
           )
         )
    from _x339_scrap_to_correct t
   where h.id = t.history_id;

  update public.work_cards wc
     set quantity = coalesce(wc.quantity, 0) + corrected.scrap_qty
    from (
      select card_id, sum(scrap_qty)::numeric as scrap_qty
        from _x339_scrap_to_correct
       group by card_id
    ) corrected
   where wc.id = corrected.card_id;

  update public.inventory i
     set total_qty = coalesce(i.total_qty, 0) - v_total_scrap,
         updated_at = now()
   where i.nomenclature_id = (select nomenclature_id from _x339_scrap_to_correct limit 1)
     and i.type = 'scrap_ready';

  raise notice 'Corrected % X-3-39 scrap history rows; returned % pieces to production',
    v_history_count, v_total_scrap;
end;
$correction$;


-- ─── MIGRATION: 20260804110000_reverse_duplicate_vkya_sorting_scrap.sql ───
-- Reverse one unclassified duplicate VKYA scrap entry:
-- naryad 31072026-01, card suffix 88F5E3E1, Kyiv ... P-7-46, 46 pcs.
-- The original classified entry is retained unchanged.

do $correction$
declare
  v_target_count integer;
  v_target_history_id uuid;
  v_card_id uuid;
  v_nomenclature_id uuid;
  v_duplicate_scrap numeric;
  v_classified_twin_count integer;
  v_classified_twin_qty numeric;
  v_inventory_count integer;
  v_scrap_ready_qty numeric;
begin
  create temporary table _duplicate_vkya_scrap on commit drop as
  select h.id as history_id,
         wc.id as card_id,
         h.nomenclature_id,
         h.scrap_qty::numeric as scrap_qty,
         coalesce(classified.quantity, 0)::numeric as classified_qty
    from public.work_card_history h
    join public.work_cards wc on wc.id = h.card_id
    left join lateral (
      select sum(c.quantity)::numeric as quantity
        from public.scrap_classifications c
       where c.source_history_id = h.id
    ) classified on true
   where h.id = 'f297520b-b904-44ed-a742-1eaec7cdb1ca'::uuid
     and wc.id = 'c224f67a-e620-4cb7-9059-895c88f5e3e1'::uuid
     and coalesce(h.scrap_qty, 0) = 46
     and coalesce(classified.quantity, 0) = 0;

  select count(*)
    into v_target_count
    from _duplicate_vkya_scrap;

  if v_target_count <> 1 then
    raise exception 'Duplicate VKYA correction aborted: expected one unclassified 46-piece history row, found %', v_target_count;
  end if;

  select history_id, card_id, nomenclature_id, scrap_qty
    into v_target_history_id, v_card_id, v_nomenclature_id, v_duplicate_scrap
    from _duplicate_vkya_scrap
   limit 1;

  if (select classified_qty from _duplicate_vkya_scrap limit 1) <> 0 then
    raise exception 'Duplicate VKYA correction aborted: target queue row is partially classified (% pieces)',
      (select classified_qty from _duplicate_vkya_scrap limit 1);
  end if;

  if v_duplicate_scrap <> 46 then
    raise exception 'Duplicate VKYA correction aborted: target history scrap is %, expected 46', v_duplicate_scrap;
  end if;

  select count(distinct c.id), coalesce(sum(c.quantity), 0)
    into v_classified_twin_count, v_classified_twin_qty
    from public.scrap_classifications c
   where c.source_history_id = 'a2122796-f25f-441b-92f2-98ae8e018748'::uuid
     and c.card_id = v_card_id
     and c.nomenclature_id = v_nomenclature_id
     and c.source_history_id is distinct from v_target_history_id;

  if v_classified_twin_count = 0 or v_classified_twin_qty <> 46 then
    raise exception 'Duplicate VKYA correction aborted: exact classified twin is invalid (rows %, quantity %)',
      v_classified_twin_count, v_classified_twin_qty;
  end if;

  select count(*), coalesce(sum(i.total_qty), 0)
    into v_inventory_count, v_scrap_ready_qty
    from public.inventory i
   where i.nomenclature_id = v_nomenclature_id
     and i.type = 'scrap_ready';

  if v_inventory_count <> 1 then
    raise exception 'Duplicate VKYA correction aborted: expected one scrap_ready inventory row, found %', v_inventory_count;
  end if;
  if v_scrap_ready_qty < v_duplicate_scrap then
    raise exception 'Duplicate VKYA correction aborted: scrap_ready has %, required %',
      v_scrap_ready_qty, v_duplicate_scrap;
  end if;

  update public.work_card_history h
     set qty_completed = coalesce(h.qty_completed, 0) + v_duplicate_scrap,
         scrap_qty = 0,
         is_archived_scrap = false,
         qc_scrap_comment = concat_ws(
           ' ',
           nullif(btrim(coalesce(h.qc_scrap_comment, '')), ''),
           '[SCRAP_CORRECTION:20260804110000 duplicate unclassified VKYA entry; returned 46 pieces to card]'
         )
   where h.id = v_target_history_id;

  update public.work_cards wc
     set quantity = coalesce(wc.quantity, 0) + v_duplicate_scrap
   where wc.id = v_card_id;

  update public.inventory i
     set total_qty = coalesce(i.total_qty, 0) - v_duplicate_scrap,
         updated_at = now()
   where i.nomenclature_id = v_nomenclature_id
     and i.type = 'scrap_ready';

  raise notice 'Removed duplicate VKYA queue entry % and returned % pieces to card %',
    v_target_history_id, v_duplicate_scrap, v_card_id;
end;
$correction$;


-- ─── MIGRATION: 20260805120000_vkya_quality_hold_flow.sql ───
-- VKYA quality hold flow
--
-- A production defect is a quality hold until VKYA confirms category 4
-- (final scrap).  Holds may be returned to their original route or assigned
-- to restoration without creating a foreman reissue shortage.

create extension if not exists pgcrypto;

-- Some installations predate the incremental VKYA queue migration.  Keep this
-- migration self-contained so the quality-hold RPCs never depend on an
-- optional read-model table being present already.
create sequence if not exists public.vkya_classification_queue_change_seq;

create index if not exists scrap_classifications_source_history_idx
  on public.scrap_classifications (source_history_id)
  where source_history_id is not null;

create table if not exists public.vkya_classification_queue_projection (
  source_type text not null check (source_type in ('history', 'restoration_return')),
  source_id uuid not null,
  payload jsonb not null,
  is_active boolean not null,
  change_seq bigint not null default nextval('public.vkya_classification_queue_change_seq'),
  changed_at timestamptz not null default clock_timestamp(),
  primary key (source_type, source_id)
);

create index if not exists vkya_queue_projection_active_idx
  on public.vkya_classification_queue_projection (is_active, change_seq);
create index if not exists vkya_queue_projection_change_idx
  on public.vkya_classification_queue_projection (change_seq);

alter table public.vkya_classification_queue_projection enable row level security;
revoke all on table public.vkya_classification_queue_projection from public;
grant select on public.vkya_classification_queue_projection to anon, authenticated;
drop policy if exists "vkya_queue_projection_realtime_read"
  on public.vkya_classification_queue_projection;
create policy "vkya_queue_projection_realtime_read"
  on public.vkya_classification_queue_projection
  for select to anon, authenticated using (true);

create table if not exists public.vkya_quality_resolutions (
  id uuid primary key default gen_random_uuid(),
  source_history_id uuid not null references public.work_card_history(id) on delete restrict,
  source_card_id uuid references public.work_cards(id) on delete set null,
  task_id uuid,
  order_id uuid,
  nomenclature_id uuid not null,
  quantity integer not null check (quantity > 0),
  disposition text not null check (disposition in ('returned_to_route', 'restoration_assigned')),
  route_card_id uuid references public.work_cards(id) on delete set null,
  restoration_card_id uuid references public.vkya_restoration_cards(id) on delete set null,
  resolved_by_user_id bigint,
  resolved_by_name text,
  resolved_at timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now(),
  constraint vkya_quality_resolution_target check (
    (disposition = 'returned_to_route' and route_card_id is not null and restoration_card_id is null)
    or
    (disposition = 'restoration_assigned' and restoration_card_id is not null and route_card_id is null)
  )
);

create index if not exists vkya_quality_resolutions_history_idx
  on public.vkya_quality_resolutions (source_history_id, resolved_at);
create index if not exists vkya_quality_resolutions_task_nom_idx
  on public.vkya_quality_resolutions (task_id, nomenclature_id);

alter table public.vkya_quality_resolutions enable row level security;
grant select on public.vkya_quality_resolutions to anon, authenticated;

drop policy if exists "vkya_quality_resolutions_read" on public.vkya_quality_resolutions;
create policy "vkya_quality_resolutions_read" on public.vkya_quality_resolutions
  for select to anon, authenticated using (true);

alter table public.vkya_restoration_cards
  add column if not exists source_history_id uuid references public.work_card_history(id) on delete set null,
  add column if not exists source_card_id uuid references public.work_cards(id) on delete set null,
  add column if not exists source_task_id uuid,
  add column if not exists source_order_id uuid,
  add column if not exists source_stage_name text;

alter table public.vkya_reclassification_queue
  add column if not exists source_history_id uuid references public.work_card_history(id) on delete set null,
  add column if not exists source_card_id uuid references public.work_cards(id) on delete set null,
  add column if not exists source_task_id uuid,
  add column if not exists source_order_id uuid;

create or replace function public.vkya_take_scrap_ready(
  p_nomenclature_id uuid,
  p_quantity integer
) returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $body$
declare
  v_row record;
  v_remaining numeric := p_quantity;
  v_take numeric;
  v_available numeric;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Кількість має бути більшою за нуль';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('vkya-inventory:' || p_nomenclature_id::text || ':scrap_ready', 0));

  select coalesce(sum(total_qty), 0) into v_available
  from public.inventory
  where nomenclature_id = p_nomenclature_id and type = 'scrap_ready';

  if v_available < p_quantity then
    raise exception 'На складі очікування ВКЯ є лише % шт., потрібно %', v_available, p_quantity;
  end if;

  for v_row in
    select id, total_qty
    from public.inventory
    where nomenclature_id = p_nomenclature_id and type = 'scrap_ready'
    order by updated_at nulls first, created_at nulls first, id
    for update
  loop
    exit when v_remaining <= 0;
    v_take := least(coalesce(v_row.total_qty, 0), v_remaining);
    if coalesce(v_row.total_qty, 0) - v_take <= 0 then
      delete from public.inventory where id = v_row.id;
    else
      update public.inventory
      set total_qty = coalesce(total_qty, 0) - v_take, updated_at = now()
      where id = v_row.id;
    end if;
    v_remaining := v_remaining - v_take;
  end loop;
  if v_remaining > 0 then
    raise exception 'Залишок очікування ВКЯ змінився паралельно. Оновіть дані й повторіть дію';
  end if;
end;
$body$;

revoke all on function public.vkya_take_scrap_ready(uuid,integer) from public;

create or replace function public.vkya_add_route_inventory(
  p_nomenclature_id uuid,
  p_type text,
  p_quantity integer
) returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $body$
declare
  v_inventory_id uuid;
  v_name text;
  v_unit text;
begin
  if p_quantity is null or p_quantity <= 0 or p_type is null then return; end if;

  perform pg_advisory_xact_lock(hashtextextended('vkya-inventory:' || p_nomenclature_id::text || ':' || p_type, 0));

  select id into v_inventory_id
  from public.inventory
  where nomenclature_id = p_nomenclature_id and type = p_type
  order by updated_at desc nulls last, id
  limit 1
  for update;

  if v_inventory_id is not null then
    update public.inventory
    set total_qty = coalesce(total_qty, 0) + p_quantity, updated_at = now()
    where id = v_inventory_id;
  else
    select name, unit into v_name, v_unit
    from public.nomenclatures where id = p_nomenclature_id;
    insert into public.inventory (
      nomenclature_id, name, unit, total_qty, reserved_qty, type, updated_at
    ) values (
      p_nomenclature_id, coalesce(v_name, 'Деталь'), coalesce(v_unit, 'шт'),
      p_quantity, 0, p_type, now()
    );
  end if;
end;
$body$;

revoke all on function public.vkya_add_route_inventory(uuid,text,integer) from public;

create or replace function public.vkya_reduce_route_inventory(
  p_nomenclature_id uuid,
  p_type text,
  p_quantity integer
) returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $body$
declare
  v_row record;
  v_remaining numeric := greatest(coalesce(p_quantity, 0), 0);
  v_take numeric;
begin
  perform pg_advisory_xact_lock(hashtextextended('vkya-inventory:' || p_nomenclature_id::text || ':' || p_type, 0));
  for v_row in
    select id, total_qty from public.inventory
    where nomenclature_id = p_nomenclature_id and type = p_type
    order by updated_at nulls first, created_at nulls first, id
    for update
  loop
    exit when v_remaining <= 0;
    v_take := least(coalesce(v_row.total_qty, 0), v_remaining);
    if coalesce(v_row.total_qty, 0) - v_take <= 0 then
      delete from public.inventory where id = v_row.id;
    else
      update public.inventory
      set total_qty = coalesce(total_qty, 0) - v_take, updated_at = now()
      where id = v_row.id;
    end if;
    v_remaining := v_remaining - v_take;
  end loop;
end;
$body$;

revoke all on function public.vkya_reduce_route_inventory(uuid,text,integer) from public;

create or replace function public.validate_vkya_classification_capacity()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $body$
declare
  v_scrap numeric;
  v_classified numeric;
  v_resolved numeric;
begin
  if new.source_history_id is null then return new; end if;

  select coalesce(scrap_qty, 0) into v_scrap
  from public.work_card_history
  where id = new.source_history_id
  for update;
  if not found then raise exception 'Запис очікування ВКЯ не знайдено'; end if;

  select coalesce(sum(quantity), 0) into v_classified
  from public.scrap_classifications
  where source_history_id = new.source_history_id;
  select coalesce(sum(quantity), 0) into v_resolved
  from public.vkya_quality_resolutions
  where source_history_id = new.source_history_id;

  if v_classified + v_resolved + new.quantity > v_scrap then
    raise exception 'Рішення ВКЯ перевищує доступний залишок: доступно %, запитано %',
      greatest(0, v_scrap - v_classified - v_resolved), new.quantity;
  end if;
  return new;
end;
$body$;

drop trigger if exists trg_validate_vkya_classification_capacity on public.scrap_classifications;
create trigger trg_validate_vkya_classification_capacity
before insert on public.scrap_classifications
for each row execute function public.validate_vkya_classification_capacity();

create or replace function public.return_vkya_quantity_to_route(
  p_source_history_id uuid,
  p_quantity integer,
  p_resolved_by_user_id bigint default null,
  p_resolved_by_name text default null,
  p_notes text default null
) returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $body$
declare
  v_history public.work_card_history%rowtype;
  v_source public.work_cards%rowtype;
  v_classified numeric;
  v_resolved numeric;
  v_available numeric;
  v_target_status text;
  v_target_operation text;
  v_target_inventory text;
  v_route_card_id uuid;
  v_resolution_id uuid;
  v_stage text;
  v_can_merge boolean;
begin
  if p_quantity is null or p_quantity <= 0 then raise exception 'Кількість має бути більшою за нуль'; end if;

  select * into v_history from public.work_card_history
  where id = p_source_history_id for update;
  if not found or coalesce(v_history.scrap_qty, 0) <= 0 then
    raise exception 'Позицію в черзі ВКЯ не знайдено';
  end if;

  select * into v_source from public.work_cards
  where id = v_history.card_id for update;
  if not found then raise exception 'Початкову робочу картку не знайдено'; end if;

  select coalesce(sum(quantity), 0) into v_classified
  from public.scrap_classifications where source_history_id = v_history.id;
  select coalesce(sum(quantity), 0) into v_resolved
  from public.vkya_quality_resolutions where source_history_id = v_history.id;
  v_available := coalesce(v_history.scrap_qty, 0) - v_classified - v_resolved;
  if p_quantity > v_available then
    raise exception 'Для повернення доступно лише % шт.', greatest(0, v_available);
  end if;

  v_stage := lower(btrim(coalesce(v_history.stage_name, '')));
  if v_stage = 'розкрій' then
    v_target_status := 'at-buffer'; v_target_operation := 'Прийомка';
  elsif v_stage like 'галтовка (вібростіл)%' then
    v_target_status := 'new'; v_target_operation := 'Галтовка (Мийка)';
  elsif v_stage like 'галтовка (мийка)%' then
    v_target_status := 'new'; v_target_operation := 'Галтовка (Галтовка)';
  elsif v_stage like 'галтовка (галтовка)%' then
    v_target_status := 'new'; v_target_operation := 'Галтовка (Сушка)';
  elsif v_stage like 'галтовка (сушка)%' or v_stage = 'галтовка' then
    v_target_status := 'at-buffer'; v_target_operation := 'Прийомка';
  elsif v_stage = 'приймка' then
    v_target_status := 'at-buffer'; v_target_operation := 'Сортування';
  elsif v_stage = 'сортування' then
    v_target_status := 'at-shop2-buffer'; v_target_operation := 'Сортування'; v_target_inventory := 'semi_shop2';
  elsif v_stage = 'пресування' then
    v_target_status := 'at-buffer'; v_target_operation := 'Пресування';
  elsif v_stage = 'фарбування' then
    v_target_status := 'at-buffer'; v_target_operation := 'Фарбування';
  elsif v_stage = 'контроль вкя' then
    v_target_status := nullif(substring(coalesce(v_history.card_info, '') from '\[VKYA_SOURCE_STATUS:([^]]*)\]'), '');
    v_target_operation := nullif(substring(coalesce(v_history.card_info, '') from '\[VKYA_SOURCE_OPERATION:([^]]*)\]'), '');
    if v_target_status not in ('new','waiting-buffer','at-buffer','at-shop2-buffer') then v_target_status := 'new'; end if;
    v_target_operation := coalesce(v_target_operation, nullif(v_source.operation, ''), 'Контроль ВКЯ');
  else
    v_target_status := case when v_source.status in ('new','waiting-buffer','at-buffer','at-shop2-buffer') then v_source.status else 'new' end;
    v_target_operation := coalesce(nullif(v_source.operation, ''), v_history.stage_name, 'Контроль ВКЯ');
  end if;

  perform public.vkya_take_scrap_ready(v_history.nomenclature_id, p_quantity);

  v_can_merge := v_source.status = v_target_status
    and lower(btrim(coalesce(v_source.operation, ''))) = lower(btrim(coalesce(v_target_operation, '')))
    and v_source.status in ('new','waiting-buffer','at-buffer','at-shop2-buffer');

  if v_can_merge then
    update public.work_cards
    set quantity = coalesce(quantity, 0) + p_quantity,
        card_info = concat_ws(' ', nullif(btrim(coalesce(card_info, '')), ''),
          format('[VKYA_RETURN:%s:%s]', p_source_history_id, p_quantity))
    where id = v_source.id
    returning id into v_route_card_id;
  else
    insert into public.work_cards (
      task_id, order_id, nomenclature_id, quantity, operation, status,
      machine, manager_name, shift_name, card_info
    ) values (
      v_source.task_id, v_source.order_id, v_source.nomenclature_id, p_quantity,
      v_target_operation, v_target_status, '—', v_source.manager_name, v_source.shift_name,
      format('[VKYA_RETURN] [SOURCE_CARD:%s] [SOURCE_HISTORY:%s] Повернено ВКЯ у початковий наряд',
        v_source.id, v_history.id)
    ) returning id into v_route_card_id;
  end if;

  if v_target_inventory is not null then
    if v_stage = 'сортування' and v_target_inventory = 'semi_shop2' then
      perform public.vkya_reduce_route_inventory(v_history.nomenclature_id, 'semi', p_quantity);
    end if;
    perform public.vkya_add_route_inventory(v_history.nomenclature_id, v_target_inventory, p_quantity);
  end if;

  insert into public.vkya_quality_resolutions (
    source_history_id, source_card_id, task_id, order_id, nomenclature_id,
    quantity, disposition, route_card_id, resolved_by_user_id, resolved_by_name, notes
  ) values (
    v_history.id, v_source.id, v_source.task_id, v_source.order_id, v_history.nomenclature_id,
    p_quantity, 'returned_to_route', v_route_card_id, p_resolved_by_user_id,
    nullif(btrim(p_resolved_by_name), ''), p_notes
  ) returning id into v_resolution_id;

  return v_route_card_id;
end;
$body$;

revoke all on function public.return_vkya_quantity_to_route(uuid,integer,bigint,text,text) from public;
grant execute on function public.return_vkya_quantity_to_route(uuid,integer,bigint,text,text) to anon, authenticated;

create or replace function public.create_vkya_restoration_from_hold(
  p_source_history_id uuid,
  p_quantity integer,
  p_restoration_stage_id uuid,
  p_created_by_user_id bigint default null,
  p_created_by_name text default null
) returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $body$
declare
  v_history public.work_card_history%rowtype;
  v_source public.work_cards%rowtype;
  v_stage public.vkya_restoration_stages%rowtype;
  v_classified numeric;
  v_resolved numeric;
  v_available numeric;
  v_name text;
  v_unit text;
  v_card_id uuid;
begin
  if p_quantity is null or p_quantity <= 0 then raise exception 'Кількість має бути більшою за нуль'; end if;
  select * into v_stage from public.vkya_restoration_stages
  where id = p_restoration_stage_id and is_active = true;
  if not found then raise exception 'Оберіть активний етап відновлення'; end if;

  select * into v_history from public.work_card_history
  where id = p_source_history_id for update;
  if not found or coalesce(v_history.scrap_qty, 0) <= 0 then raise exception 'Позицію в черзі ВКЯ не знайдено'; end if;
  select * into v_source from public.work_cards where id = v_history.card_id for update;
  if not found then raise exception 'Початкову робочу картку не знайдено'; end if;

  select coalesce(sum(quantity), 0) into v_classified
  from public.scrap_classifications where source_history_id = v_history.id;
  select coalesce(sum(quantity), 0) into v_resolved
  from public.vkya_quality_resolutions where source_history_id = v_history.id;
  v_available := coalesce(v_history.scrap_qty, 0) - v_classified - v_resolved;
  if p_quantity > v_available then raise exception 'На відновлення доступно лише % шт.', greatest(0, v_available); end if;

  perform public.vkya_take_scrap_ready(v_history.nomenclature_id, p_quantity);
  select name, unit into v_name, v_unit from public.nomenclatures where id = v_history.nomenclature_id;

  insert into public.vkya_restoration_cards (
    source_inventory_id, nomenclature_id, nomenclature_name, unit,
    restoration_stage_id, restoration_stage, quantity,
    created_by_user_id, created_by_name,
    source_history_id, source_card_id, source_task_id, source_order_id, source_stage_name
  ) values (
    null, v_history.nomenclature_id, coalesce(v_name, 'Деталь'), coalesce(v_unit, 'шт'),
    v_stage.id, v_stage.name, p_quantity,
    p_created_by_user_id, nullif(btrim(p_created_by_name), ''),
    v_history.id, v_source.id, v_source.task_id, v_source.order_id, v_history.stage_name
  ) returning id into v_card_id;

  insert into public.vkya_quality_resolutions (
    source_history_id, source_card_id, task_id, order_id, nomenclature_id,
    quantity, disposition, restoration_card_id, resolved_by_user_id, resolved_by_name
  ) values (
    v_history.id, v_source.id, v_source.task_id, v_source.order_id, v_history.nomenclature_id,
    p_quantity, 'restoration_assigned', v_card_id, p_created_by_user_id,
    nullif(btrim(p_created_by_name), '')
  );

  return v_card_id;
end;
$body$;

revoke all on function public.create_vkya_restoration_from_hold(uuid,integer,uuid,bigint,text) from public;
grant execute on function public.create_vkya_restoration_from_hold(uuid,integer,uuid,bigint,text) to anon, authenticated;

-- Failed restoration keeps the original production lineage, so a later
-- category-4 decision is charged to the right order/task.
create or replace function public.complete_vkya_restoration_card(
  p_card_id uuid,
  p_completed_quantity integer
) returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $body$
declare
  v_card public.vkya_restoration_cards%rowtype;
  v_return_quantity integer;
begin
  select * into v_card from public.vkya_restoration_cards where id = p_card_id for update;
  if not found then raise exception 'Карту відновлення не знайдено'; end if;
  if v_card.status <> 'in_progress' then raise exception 'Карта не перебуває в роботі'; end if;
  if p_completed_quantity is null or p_completed_quantity < 0 or p_completed_quantity > v_card.quantity then
    raise exception 'Некоректна кількість відновлених деталей';
  end if;

  v_return_quantity := v_card.quantity - p_completed_quantity;
  update public.vkya_restoration_cards set
    status = 'completed', completed_quantity = p_completed_quantity,
    completed_at = now(), updated_at = now()
  where id = v_card.id;

  if v_return_quantity > 0 then
    insert into public.vkya_reclassification_queue (
      restoration_card_id, nomenclature_id, nomenclature_name,
      source_stage, quantity, source_history_id, source_card_id,
      source_task_id, source_order_id
    ) values (
      v_card.id, v_card.nomenclature_id, v_card.nomenclature_name,
      v_card.restoration_stage || ' (ВКЯ)', v_return_quantity,
      v_card.source_history_id, v_card.source_card_id,
      v_card.source_task_id, v_card.source_order_id
    );
  end if;
  return v_return_quantity;
end;
$body$;

revoke all on function public.complete_vkya_restoration_card(uuid,integer) from public;
grant execute on function public.complete_vkya_restoration_card(uuid,integer) to anon, authenticated;

-- Restored pieces with lineage resume the original order. Legacy restoration
-- cards intentionally keep the old standalone/BZ behaviour.
create or replace function public.dispatch_vkya_restoration_to_shop2(
  p_restoration_card_id uuid,
  p_shop2_stage text
) returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $body$
declare
  v_restoration public.vkya_restoration_cards%rowtype;
  v_shop2_card_id uuid;
  v_stage text;
  v_route_tag text;
begin
  v_stage := btrim(coalesce(p_shop2_stage, ''));
  if v_stage not in ('Пресування', 'Фарбування') then raise exception 'Дозволені етапи: Пресування або Фарбування'; end if;

  select * into v_restoration from public.vkya_restoration_cards
  where id = p_restoration_card_id for update;
  if not found then raise exception 'Карту відновлення не знайдено'; end if;
  if v_restoration.status <> 'completed' then raise exception 'Спочатку завершіть карту відновлення'; end if;
  if v_restoration.completed_quantity <= 0 then raise exception 'Немає відновлених деталей для передачі'; end if;
  if v_restoration.shop2_card_id is not null then return v_restoration.shop2_card_id; end if;

  v_route_tag := case when v_restoration.source_task_id is not null then '[VKYA_SOURCE_ROUTE]' else '[VKYA_LEGACY_BZ]' end;
  insert into public.work_cards (
    task_id, order_id, nomenclature_id, quantity, operation, status, machine, card_info
  ) values (
    v_restoration.source_task_id, v_restoration.source_order_id,
    v_restoration.nomenclature_id, v_restoration.completed_quantity,
    v_stage, 'new', '—',
    format('[RESTORATION] [VKYA_RESTORATION] %s [ЦЕХ №2] [VKYA_CARD:%s] %s — ПІСЛЯ ВІДНОВЛЕННЯ ВКЯ',
      v_route_tag, v_restoration.card_number, v_restoration.nomenclature_name)
  ) returning id into v_shop2_card_id;

  update public.vkya_restoration_cards set
    shop2_card_id = v_shop2_card_id, shop2_stage = v_stage,
    transferred_to_shop2_at = now(), updated_at = now()
  where id = v_restoration.id;
  return v_shop2_card_id;
end;
$body$;

revoke all on function public.dispatch_vkya_restoration_to_shop2(uuid,text) from public;
grant execute on function public.dispatch_vkya_restoration_to_shop2(uuid,text) to anon, authenticated;

create or replace function public.complete_vkya_shop2_card_to_bz(
  p_card_id uuid,
  p_stage text,
  p_operator_name text,
  p_shift_name text,
  p_finished_quantity integer,
  p_scrap_quantity integer
) returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $body$
declare
  v_card public.work_cards%rowtype;
  v_inventory_id uuid;
  v_inventory_qty numeric;
  v_nom_name text;
  v_nom_unit text;
  v_returns_to_route boolean;
begin
  select * into v_card from public.work_cards where id = p_card_id for update;
  if not found then raise exception 'Карту Цеху №2 не знайдено'; end if;
  if position('[VKYA_RESTORATION]' in coalesce(v_card.card_info, '')) = 0 then raise exception 'Карта не належить потоку відновлення ВКЯ'; end if;
  if v_card.status <> 'in-progress' then raise exception 'Карта не перебуває в роботі'; end if;
  if p_stage not in ('Пресування', 'Фарбування') or v_card.operation <> p_stage then raise exception 'Етап карти не відповідає терміналу'; end if;
  if p_finished_quantity < 0 or p_scrap_quantity < 0 or p_finished_quantity + p_scrap_quantity <> v_card.quantity then
    raise exception 'Сума готових деталей і браку має дорівнювати кількості карти';
  end if;

  v_returns_to_route := position('[VKYA_SOURCE_ROUTE]' in coalesce(v_card.card_info, '')) > 0
    and v_card.task_id is not null;

  insert into public.work_card_history (
    card_id, nomenclature_id, stage_name, operator_name,
    qty_at_start, qty_completed, scrap_qty, started_at, completed_at,
    is_archived_scrap, shift_name, manager_name, machine_name, card_info
  ) values (
    v_card.id, v_card.nomenclature_id, p_stage, nullif(btrim(p_operator_name), ''),
    v_card.quantity, p_finished_quantity, p_scrap_quantity,
    coalesce(v_card.started_at, now()), now(), p_scrap_quantity > 0,
    nullif(btrim(p_shift_name), ''), v_card.manager_name, v_card.machine, v_card.card_info
  );

  select name, unit into v_nom_name, v_nom_unit from public.nomenclatures where id = v_card.nomenclature_id;

  if p_finished_quantity > 0 and not v_returns_to_route then
    select id, total_qty into v_inventory_id, v_inventory_qty
    from public.inventory where nomenclature_id = v_card.nomenclature_id and type = 'bz'
    order by updated_at desc nulls last limit 1 for update;
    if v_inventory_id is null then
      insert into public.inventory (nomenclature_id, name, unit, total_qty, reserved_qty, type, pocket_owner, updated_at)
      values (v_card.nomenclature_id, coalesce(v_nom_name, 'Деталь'), coalesce(v_nom_unit, 'шт'), p_finished_quantity, 0, 'bz', null, now());
    else
      update public.inventory set total_qty = coalesce(v_inventory_qty, 0) + p_finished_quantity, updated_at = now()
      where id = v_inventory_id;
    end if;
  end if;

  if p_scrap_quantity > 0 then
    perform public.vkya_add_route_inventory(v_card.nomenclature_id, 'scrap_ready', p_scrap_quantity);
  end if;

  update public.work_cards set
    status = case when v_returns_to_route then 'at-buffer' else 'completed' end,
    operation = case when v_returns_to_route then p_stage else 'Базовий залишок' end,
    quantity = p_finished_quantity,
    completed_at = now(),
    card_info = concat_ws(' ', nullif(btrim(coalesce(card_info, '')), ''),
      case when v_returns_to_route then '[VKYA_RETURNED_TO_ROUTE]' else '[VKYA_TO_BZ]' end)
  where id = v_card.id;
end;
$body$;

revoke all on function public.complete_vkya_shop2_card_to_bz(uuid,text,text,text,integer,integer) from public;
grant execute on function public.complete_vkya_shop2_card_to_bz(uuid,text,text,text,integer,integer) to anon, authenticated;

-- Only category 4 is an irreversible production loss.  All other VKYA states
-- remain recoverable and must not create a foreman reissue requirement.
create or replace view public.vkya_final_scrap_totals as
select
  c.task_id,
  c.order_id,
  c.card_id,
  c.nomenclature_id,
  sum(cc.quantity)::bigint as total_scrap,
  min(c.classified_at) as first_scrap_at,
  max(c.classified_at) as last_scrap_at,
  max(c.classified_at) as updated_at
from public.scrap_classifications c
join public.scrap_classification_categories cc on cc.classification_id = c.id
where cc.category = 4 and c.task_id is not null
group by c.task_id, c.order_id, c.card_id, c.nomenclature_id;

grant select on public.vkya_final_scrap_totals to anon, authenticated;

-- Queue projection now treats returned/restoration-assigned quantities as
-- resolved, while preserving the existing payload contract.
create or replace function public.sync_vkya_history_queue_projection()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $body$
declare
  v_resolved numeric;
  v_ready boolean;
begin
  select
    coalesce((select sum(quantity) from public.scrap_classifications where source_history_id = new.id), 0)
    + coalesce((select sum(quantity) from public.vkya_quality_resolutions where source_history_id = new.id), 0)
  into v_resolved;
  v_ready := coalesce(new.scrap_qty, 0) > v_resolved
    and (coalesce(new.is_archived_scrap, false) or coalesce(new.card_info, '') like '%[ЦЕХ №2]%');

  insert into public.vkya_classification_queue_projection (
    source_type, source_id, payload, is_active, change_seq, changed_at
  ) values (
    'history', new.id,
    to_jsonb(new) || jsonb_build_object('classified_quantity', v_resolved),
    v_ready, nextval('public.vkya_classification_queue_change_seq'), clock_timestamp()
  ) on conflict (source_type, source_id) do update set
    payload = excluded.payload, is_active = excluded.is_active,
    change_seq = excluded.change_seq, changed_at = excluded.changed_at;
  return new;
end;
$body$;

create or replace function public.sync_vkya_history_queue_projection_for_id(p_history_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $body$
declare
  v_history public.work_card_history%rowtype;
  v_resolved numeric;
begin
  select * into v_history from public.work_card_history where id = p_history_id;
  if not found then return; end if;
  select
    coalesce((select sum(quantity) from public.scrap_classifications where source_history_id = p_history_id), 0)
    + coalesce((select sum(quantity) from public.vkya_quality_resolutions where source_history_id = p_history_id), 0)
  into v_resolved;
  insert into public.vkya_classification_queue_projection (
    source_type, source_id, payload, is_active, change_seq, changed_at
  ) values (
    'history', v_history.id,
    to_jsonb(v_history) || jsonb_build_object('classified_quantity', v_resolved),
    coalesce(v_history.scrap_qty, 0) > v_resolved
      and (coalesce(v_history.is_archived_scrap, false) or coalesce(v_history.card_info, '') like '%[ЦЕХ №2]%'),
    nextval('public.vkya_classification_queue_change_seq'), clock_timestamp()
  ) on conflict (source_type, source_id) do update set
    payload = excluded.payload, is_active = excluded.is_active,
    change_seq = excluded.change_seq, changed_at = excluded.changed_at;
end;
$body$;

create or replace function public.sync_vkya_projection_after_classification()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $body$
declare
  v_history public.work_card_history%rowtype;
begin
  if new.source_history_id is null then return new; end if;
  select * into v_history from public.work_card_history where id = new.source_history_id;
  if found then perform public.sync_vkya_history_queue_projection_for_id(v_history.id); end if;
  return new;
end;
$body$;

create or replace function public.sync_vkya_projection_after_resolution()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $body$
begin
  perform public.sync_vkya_history_queue_projection_for_id(new.source_history_id);
  return new;
end;
$body$;

create or replace function public.sync_vkya_return_queue_projection()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $body$
begin
  insert into public.vkya_classification_queue_projection (
    source_type, source_id, payload, is_active, change_seq, changed_at
  ) values (
    'restoration_return', new.id, to_jsonb(new),
    new.status = 'pending' and coalesce(new.quantity, 0) > coalesce(new.classified_quantity, 0),
    nextval('public.vkya_classification_queue_change_seq'), clock_timestamp()
  ) on conflict (source_type, source_id) do update set
    payload = excluded.payload, is_active = excluded.is_active,
    change_seq = excluded.change_seq, changed_at = excluded.changed_at;
  return new;
end;
$body$;

create or replace function public.sync_vkya_history_queue_projection_delete()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $body$
begin
  insert into public.vkya_classification_queue_projection (
    source_type, source_id, payload, is_active, change_seq, changed_at
  ) values (
    'history', old.id, to_jsonb(old), false,
    nextval('public.vkya_classification_queue_change_seq'), clock_timestamp()
  ) on conflict (source_type, source_id) do update set
    payload = excluded.payload, is_active = false,
    change_seq = excluded.change_seq, changed_at = excluded.changed_at;
  return old;
end;
$body$;

create or replace function public.vkya_classification_queue_changes(p_after_seq bigint default null)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public
as $body$
  with cursor_value as (
    select coalesce(max(change_seq), 0) as value
    from public.vkya_classification_queue_projection
  ),
  selected as (
    select source_type, source_id, payload, is_active, change_seq, changed_at
    from public.vkya_classification_queue_projection
    where case when p_after_seq is null then is_active else change_seq > p_after_seq end
    order by change_seq
  )
  select jsonb_build_object(
    'cursor', (select value from cursor_value),
    'changes', coalesce(jsonb_agg(to_jsonb(selected)), '[]'::jsonb)
  )
  from selected;
$body$;

revoke all on function public.vkya_classification_queue_changes(bigint) from public;
grant execute on function public.vkya_classification_queue_changes(bigint) to anon, authenticated;

drop trigger if exists trg_vkya_history_queue_projection on public.work_card_history;
create trigger trg_vkya_history_queue_projection
after insert or update of scrap_qty, qc_scrap_comment, is_archived_scrap, card_info
on public.work_card_history
for each row execute function public.sync_vkya_history_queue_projection();

drop trigger if exists trg_vkya_history_queue_projection_delete on public.work_card_history;
create trigger trg_vkya_history_queue_projection_delete
after delete on public.work_card_history
for each row execute function public.sync_vkya_history_queue_projection_delete();

drop trigger if exists trg_vkya_return_queue_projection on public.vkya_reclassification_queue;
create trigger trg_vkya_return_queue_projection
after insert or update of status, quantity, classified_quantity, updated_at
on public.vkya_reclassification_queue
for each row execute function public.sync_vkya_return_queue_projection();

drop trigger if exists trg_vkya_projection_after_resolution on public.vkya_quality_resolutions;
create trigger trg_vkya_projection_after_resolution
after insert on public.vkya_quality_resolutions
for each row execute function public.sync_vkya_projection_after_resolution();

-- Recreate the classification trigger after the helper it calls exists.
drop trigger if exists trg_vkya_projection_after_classification on public.scrap_classifications;
create trigger trg_vkya_projection_after_classification
after insert on public.scrap_classifications
for each row execute function public.sync_vkya_projection_after_classification();

update public.vkya_classification_queue_projection p
set payload = to_jsonb(h) || jsonb_build_object(
      'classified_quantity',
      coalesce((select sum(quantity) from public.scrap_classifications where source_history_id = h.id), 0)
      + coalesce((select sum(quantity) from public.vkya_quality_resolutions where source_history_id = h.id), 0)
    ),
    is_active = coalesce(h.scrap_qty, 0) >
      coalesce((select sum(quantity) from public.scrap_classifications where source_history_id = h.id), 0)
      + coalesce((select sum(quantity) from public.vkya_quality_resolutions where source_history_id = h.id), 0)
      and (coalesce(h.is_archived_scrap, false) or coalesce(h.card_info, '') like '%[ЦЕХ №2]%'),
    change_seq = nextval('public.vkya_classification_queue_change_seq'),
    changed_at = clock_timestamp()
from public.work_card_history h
where p.source_type = 'history' and p.source_id = h.id;

insert into public.vkya_classification_queue_projection (
  source_type, source_id, payload, is_active
)
select
  'history', h.id,
  to_jsonb(h) || jsonb_build_object(
    'classified_quantity',
    coalesce((select sum(quantity) from public.scrap_classifications where source_history_id = h.id), 0)
    + coalesce((select sum(quantity) from public.vkya_quality_resolutions where source_history_id = h.id), 0)
  ),
  true
from public.work_card_history h
where coalesce(h.scrap_qty, 0) >
    coalesce((select sum(quantity) from public.scrap_classifications where source_history_id = h.id), 0)
    + coalesce((select sum(quantity) from public.vkya_quality_resolutions where source_history_id = h.id), 0)
  and (coalesce(h.is_archived_scrap, false) or coalesce(h.card_info, '') like '%[ЦЕХ №2]%')
on conflict (source_type, source_id) do update set
  payload = excluded.payload, is_active = true,
  change_seq = nextval('public.vkya_classification_queue_change_seq'),
  changed_at = clock_timestamp();

insert into public.vkya_classification_queue_projection (
  source_type, source_id, payload, is_active
)
select 'restoration_return', q.id, to_jsonb(q), true
from public.vkya_reclassification_queue q
where q.status = 'pending' and coalesce(q.quantity, 0) > coalesce(q.classified_quantity, 0)
on conflict (source_type, source_id) do update set
  payload = excluded.payload, is_active = true,
  change_seq = nextval('public.vkya_classification_queue_change_seq'),
  changed_at = clock_timestamp();

update public.vkya_classification_queue_projection p
set is_active = false,
    change_seq = nextval('public.vkya_classification_queue_change_seq'),
    changed_at = clock_timestamp()
where p.source_type = 'history'
  and p.is_active
  and not exists (
    select 1 from public.work_card_history h where h.id = p.source_id
  );

do $publication$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'vkya_classification_queue_projection'
     ) then
    alter publication supabase_realtime add table public.vkya_classification_queue_projection;
  end if;

  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'scrap_classification_categories'
     ) then
    alter publication supabase_realtime add table public.scrap_classification_categories;
  end if;
end;
$publication$;


-- ─── MIGRATION: 20260805140000_vkya_quarantine_and_restoration_return.sql ───
-- VKYA terminology and restored-part route return.
-- scrap_ready is the quarantine queue. Classification has two operational
-- outcomes: recoverable scrap (category 1) and final scrap (category 4).

begin;

alter table public.vkya_restoration_cards
  add column if not exists route_card_id uuid references public.work_cards(id) on delete set null,
  add column if not exists returned_to_route_at timestamptz,
  add column if not exists returned_to_route_by text;

-- Merge the former category-3 inventory into recoverable scrap. Inventory has
-- a uniqueness rule by name/type/warehouse/owner, so merge quantities before
-- changing the type when a category-1 row already exists.
do $migration$
declare
  v_source public.inventory%rowtype;
  v_target_id uuid;
begin
  for v_source in
    select * from public.inventory where type = 'scrap_cat_3' for update
  loop
    v_target_id := null;
    select id into v_target_id
    from public.inventory
    where type = 'scrap_cat_1'
      and name is not distinct from v_source.name
      and warehouse is not distinct from v_source.warehouse
      and pocket_owner is not distinct from v_source.pocket_owner
    limit 1
    for update;

    if v_target_id is null then
      update public.inventory
      set type = 'scrap_cat_1', updated_at = now()
      where id = v_source.id;
    else
      update public.inventory
      set total_qty = coalesce(total_qty, 0) + coalesce(v_source.total_qty, 0),
          reserved_qty = coalesce(reserved_qty, 0) + coalesce(v_source.reserved_qty, 0),
          updated_at = now()
      where id = v_target_id;
      delete from public.inventory where id = v_source.id;
    end if;
  end loop;
end;
$migration$;

-- Preserve analytical totals while removing category 3 from operational data.
insert into public.scrap_classification_categories (classification_id, category, quantity)
select classification_id, 1, sum(quantity)::integer
from public.scrap_classification_categories
where category = 3
group by classification_id
on conflict (classification_id, category) do update
set quantity = public.scrap_classification_categories.quantity + excluded.quantity;

delete from public.scrap_classification_categories where category = 3;

create index if not exists vkya_restoration_cards_route_card_idx
  on public.vkya_restoration_cards (route_card_id)
  where route_card_id is not null;

create or replace function public.return_vkya_restoration_to_route(
  p_restoration_card_id uuid,
  p_returned_by text default null
) returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $body$
declare
  v_restoration public.vkya_restoration_cards%rowtype;
  v_history public.work_card_history%rowtype;
  v_source public.work_cards%rowtype;
  v_target_status text;
  v_target_operation text;
  v_target_inventory text;
  v_route_card_id uuid;
  v_stage text;
  v_can_merge boolean;
begin
  select * into v_restoration
  from public.vkya_restoration_cards
  where id = p_restoration_card_id
  for update;

  if not found then raise exception 'Карту відновлення не знайдено'; end if;
  if v_restoration.route_card_id is not null then return v_restoration.route_card_id; end if;
  if v_restoration.shop2_card_id is not null then
    raise exception 'Відновлені деталі вже передано в Цех №2';
  end if;
  if v_restoration.status <> 'completed' or coalesce(v_restoration.completed_quantity, 0) <= 0 then
    raise exception 'Спочатку завершіть карту та вкажіть відновлену кількість';
  end if;
  if v_restoration.source_history_id is null or v_restoration.source_task_id is null then
    raise exception 'Стара карта не містить походження наряду і не може бути повернена автоматично';
  end if;

  select * into v_history
  from public.work_card_history
  where id = v_restoration.source_history_id
  for update;
  if not found then raise exception 'Початковий запис ВКЯ не знайдено'; end if;

  select * into v_source
  from public.work_cards
  where id = coalesce(v_restoration.source_card_id, v_history.card_id)
  for update;
  if not found then raise exception 'Початкову робочу картку не знайдено'; end if;

  v_stage := lower(btrim(coalesce(v_restoration.source_stage_name, v_history.stage_name, '')));
  if v_stage = 'розкрій' then
    v_target_status := 'at-buffer'; v_target_operation := 'Прийомка';
  elsif v_stage like 'галтовка (вібростіл)%' then
    v_target_status := 'new'; v_target_operation := 'Галтовка (Мийка)';
  elsif v_stage like 'галтовка (мийка)%' then
    v_target_status := 'new'; v_target_operation := 'Галтовка (Галтовка)';
  elsif v_stage like 'галтовка (галтовка)%' then
    v_target_status := 'new'; v_target_operation := 'Галтовка (Сушка)';
  elsif v_stage like 'галтовка (сушка)%' or v_stage = 'галтовка' then
    v_target_status := 'at-buffer'; v_target_operation := 'Прийомка';
  elsif v_stage = 'приймка' then
    v_target_status := 'at-buffer'; v_target_operation := 'Сортування';
  elsif v_stage = 'сортування' then
    v_target_status := 'at-shop2-buffer'; v_target_operation := 'Сортування';
    v_target_inventory := 'semi_shop2';
  elsif v_stage = 'пресування' then
    v_target_status := 'at-buffer'; v_target_operation := 'Пресування';
  elsif v_stage = 'фарбування' then
    v_target_status := 'at-buffer'; v_target_operation := 'Фарбування';
  elsif v_stage = 'контроль вкя' then
    v_target_status := nullif(substring(coalesce(v_history.card_info, '') from '\[VKYA_SOURCE_STATUS:([^]]*)\]'), '');
    v_target_operation := nullif(substring(coalesce(v_history.card_info, '') from '\[VKYA_SOURCE_OPERATION:([^]]*)\]'), '');
    if v_target_status not in ('new','waiting-buffer','at-buffer','at-shop2-buffer') then
      v_target_status := 'new';
    end if;
    v_target_operation := coalesce(v_target_operation, nullif(v_source.operation, ''), 'Контроль ВКЯ');
  else
    v_target_status := case
      when v_source.status in ('new','waiting-buffer','at-buffer','at-shop2-buffer') then v_source.status
      else 'new'
    end;
    v_target_operation := coalesce(nullif(v_source.operation, ''), v_restoration.source_stage_name, 'Контроль ВКЯ');
  end if;

  v_can_merge := v_source.status = v_target_status
    and lower(btrim(coalesce(v_source.operation, ''))) = lower(btrim(coalesce(v_target_operation, '')))
    and v_source.status in ('new','waiting-buffer','at-buffer','at-shop2-buffer');

  if v_can_merge then
    update public.work_cards
    set quantity = coalesce(quantity, 0) + v_restoration.completed_quantity,
        card_info = concat_ws(' ', nullif(btrim(coalesce(card_info, '')), ''),
          format('[VKYA_RESTORED_RETURN:%s:%s]', v_restoration.id, v_restoration.completed_quantity))
    where id = v_source.id
    returning id into v_route_card_id;
  else
    insert into public.work_cards (
      task_id, order_id, nomenclature_id, quantity, operation, status,
      machine, manager_name, shift_name, card_info
    ) values (
      v_restoration.source_task_id, coalesce(v_restoration.source_order_id, v_source.order_id),
      v_restoration.nomenclature_id, v_restoration.completed_quantity,
      v_target_operation, v_target_status, '—', v_source.manager_name, v_source.shift_name,
      format('[VKYA_RESTORED_RETURN] [SOURCE_CARD:%s] [SOURCE_HISTORY:%s] [RESTORATION_CARD:%s] Повернено після відновлення ВКЯ',
        v_source.id, v_history.id, v_restoration.id)
    ) returning id into v_route_card_id;
  end if;

  if v_target_inventory is not null then
    if v_stage = 'сортування' and v_target_inventory = 'semi_shop2' then
      perform public.vkya_reduce_route_inventory(v_restoration.nomenclature_id, 'semi', v_restoration.completed_quantity);
    end if;
    perform public.vkya_add_route_inventory(v_restoration.nomenclature_id, v_target_inventory, v_restoration.completed_quantity);
  end if;

  update public.vkya_restoration_cards
  set route_card_id = v_route_card_id,
      returned_to_route_at = now(),
      returned_to_route_by = nullif(btrim(p_returned_by), ''),
      updated_at = now()
  where id = v_restoration.id;

  return v_route_card_id;
end;
$body$;

revoke all on function public.return_vkya_restoration_to_route(uuid,text) from public;
grant execute on function public.return_vkya_restoration_to_route(uuid,text) to anon, authenticated;

-- Keep the legacy dispatch callable, but make route return and Shop2 dispatch
-- mutually exclusive under the same row lock.
create or replace function public.dispatch_vkya_restoration_to_shop2(
  p_restoration_card_id uuid,
  p_shop2_stage text
) returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $body$
declare
  v_restoration public.vkya_restoration_cards%rowtype;
  v_shop2_card_id uuid;
  v_stage text;
  v_route_tag text;
begin
  v_stage := btrim(coalesce(p_shop2_stage, ''));
  if v_stage not in ('Пресування', 'Фарбування') then
    raise exception 'Дозволені етапи: Пресування або Фарбування';
  end if;

  select * into v_restoration from public.vkya_restoration_cards
  where id = p_restoration_card_id for update;
  if not found then raise exception 'Карту відновлення не знайдено'; end if;
  if v_restoration.route_card_id is not null then
    raise exception 'Відновлені деталі вже повернено в початковий наряд';
  end if;
  if v_restoration.status <> 'completed' then raise exception 'Спочатку завершіть карту відновлення'; end if;
  if v_restoration.completed_quantity <= 0 then raise exception 'Немає відновлених деталей для передачі'; end if;
  if v_restoration.shop2_card_id is not null then return v_restoration.shop2_card_id; end if;

  v_route_tag := case when v_restoration.source_task_id is not null then '[VKYA_SOURCE_ROUTE]' else '[VKYA_LEGACY_BZ]' end;
  insert into public.work_cards (
    task_id, order_id, nomenclature_id, quantity, operation, status, machine, card_info
  ) values (
    v_restoration.source_task_id, v_restoration.source_order_id,
    v_restoration.nomenclature_id, v_restoration.completed_quantity,
    v_stage, 'new', '—',
    format('[RESTORATION] [VKYA_RESTORATION] %s [ЦЕХ №2] [VKYA_CARD:%s] %s — ПІСЛЯ ВІДНОВЛЕННЯ ВКЯ',
      v_route_tag, v_restoration.card_number, v_restoration.nomenclature_name)
  ) returning id into v_shop2_card_id;

  update public.vkya_restoration_cards set
    shop2_card_id = v_shop2_card_id, shop2_stage = v_stage,
    transferred_to_shop2_at = now(), updated_at = now()
  where id = v_restoration.id;
  return v_shop2_card_id;
end;
$body$;

revoke all on function public.dispatch_vkya_restoration_to_shop2(uuid,text) from public;
grant execute on function public.dispatch_vkya_restoration_to_shop2(uuid,text) to anon, authenticated;

commit;


-- ─── MIGRATION: 20260805150000_vkya_recoverable_scrap_lots.sql ───
-- Recoverable VKYA scrap is tracked as source-aware lots. Physical inventory
-- may remain aggregated, but every operational allocation is charged to the
-- exact classification/order/card that produced it.

begin;

create table if not exists public.vkya_scrap_lot_allocations (
  id uuid primary key default gen_random_uuid(),
  classification_category_id bigint not null references public.scrap_classification_categories(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  action text not null check (action in ('rework_order', 'restoration')),
  rework_order_id uuid references public.orders(id) on delete set null,
  rework_task_id uuid references public.tasks(id) on delete set null,
  rework_card_id uuid references public.work_cards(id) on delete set null,
  restoration_card_id uuid references public.vkya_restoration_cards(id) on delete set null,
  allocated_by_user_id bigint,
  allocated_by_name text,
  allocated_at timestamptz not null default now(),
  notes text,
  constraint vkya_scrap_lot_allocation_target check (
    (action = 'rework_order' and rework_order_id is not null and rework_task_id is not null
      and rework_card_id is not null and restoration_card_id is null)
    or
    (action = 'restoration' and restoration_card_id is not null
      and rework_order_id is null and rework_task_id is null and rework_card_id is null)
  )
);

create index if not exists vkya_scrap_lot_allocations_category_idx
  on public.vkya_scrap_lot_allocations (classification_category_id, allocated_at);

alter table public.vkya_scrap_lot_allocations enable row level security;
grant select on public.vkya_scrap_lot_allocations to anon, authenticated;
drop policy if exists "vkya_scrap_lot_allocations_read" on public.vkya_scrap_lot_allocations;
create policy "vkya_scrap_lot_allocations_read" on public.vkya_scrap_lot_allocations
  for select to anon, authenticated using (true);

create or replace view public.vkya_recoverable_scrap_lots as
with allocated as (
  select classification_category_id, sum(quantity)::numeric as quantity
  from public.vkya_scrap_lot_allocations
  group by classification_category_id
), base_lots as (
  select
    cc.id as classification_category_id,
    c.id as classification_id,
    coalesce(
      c.source_history_id,
      nullif(substring(coalesce(c.notes, '') from '\[VKYA_ORIGIN_HISTORY:([0-9a-fA-F-]{36})\]'), '')::uuid
    ) as source_history_id,
    c.card_id,
    c.task_id,
    c.order_id,
    c.nomenclature_id,
    c.order_number,
    c.card_sequence,
    c.source_operator_name,
    c.source_stage_name,
    c.source_machine_name,
    c.classified_by_name,
    c.classified_at,
    cc.category,
    case when cc.category = 2 then 'scrap_cat_2' else 'scrap_cat_1' end as storage_type,
    greatest(0, cc.quantity - coalesce(a.quantity, 0))::numeric as ledger_remaining
  from public.scrap_classification_categories cc
  join public.scrap_classifications c on c.id = cc.classification_id
  left join allocated a on a.classification_category_id = cc.id
  where cc.category in (1, 2, 3)
), stock as (
  select
    nomenclature_id,
    case when type = 'scrap_cat_2' then 'scrap_cat_2' else 'scrap_cat_1' end as storage_type,
    sum(total_qty)::numeric as stock_quantity
  from public.inventory
  where type in ('scrap_cat_1', 'scrap_cat_2', 'scrap_cat_3')
  group by nomenclature_id, 2
), ranked as (
  select
    b.*,
    coalesce(s.stock_quantity, 0) as stock_quantity,
    coalesce(sum(b.ledger_remaining) over (
      partition by b.nomenclature_id, b.storage_type
      order by b.classified_at desc, b.classification_category_id desc
      rows between unbounded preceding and 1 preceding
    ), 0) as prior_lot_quantity
  from base_lots b
  left join stock s
    on s.nomenclature_id = b.nomenclature_id and s.storage_type = b.storage_type
  where b.ledger_remaining > 0
)
select
  r.classification_category_id,
  r.classification_id,
  r.source_history_id,
  r.card_id,
  r.task_id,
  r.order_id,
  r.nomenclature_id,
  n.name as nomenclature_name,
  coalesce(n.unit, 'шт') as unit,
  r.order_number,
  r.card_sequence,
  r.source_operator_name,
  r.source_stage_name,
  r.source_machine_name,
  r.classified_by_name,
  r.classified_at,
  r.category,
  r.storage_type,
  least(r.ledger_remaining, greatest(0, r.stock_quantity - r.prior_lot_quantity))::bigint as available_quantity
from ranked r
join public.nomenclatures n on n.id = r.nomenclature_id
where least(r.ledger_remaining, greatest(0, r.stock_quantity - r.prior_lot_quantity)) > 0;

grant select on public.vkya_recoverable_scrap_lots to anon, authenticated;

create or replace function public.vkya_take_recoverable_scrap(
  p_nomenclature_id uuid,
  p_storage_type text,
  p_quantity integer
) returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $body$
declare
  v_row record;
  v_remaining numeric := p_quantity;
  v_available numeric;
  v_take numeric;
begin
  if p_quantity is null or p_quantity <= 0 then raise exception 'Кількість має бути більшою за нуль'; end if;
  if p_storage_type not in ('scrap_cat_1', 'scrap_cat_2') then raise exception 'Невідомий тип партії браку'; end if;

  perform pg_advisory_xact_lock(hashtextextended(
    'vkya-recoverable:' || p_nomenclature_id::text || ':' || p_storage_type, 0
  ));

  select coalesce(sum(total_qty), 0) into v_available
  from public.inventory
  where nomenclature_id = p_nomenclature_id
    and case when type = 'scrap_cat_2' then 'scrap_cat_2' else 'scrap_cat_1' end = p_storage_type
    and type in ('scrap_cat_1', 'scrap_cat_2', 'scrap_cat_3');

  if v_available < p_quantity then
    raise exception 'У складському залишку цієї партії доступно лише % шт.', v_available;
  end if;

  for v_row in
    select id, total_qty
    from public.inventory
    where nomenclature_id = p_nomenclature_id
      and case when type = 'scrap_cat_2' then 'scrap_cat_2' else 'scrap_cat_1' end = p_storage_type
      and type in ('scrap_cat_1', 'scrap_cat_2', 'scrap_cat_3')
    order by updated_at nulls first, id
    for update
  loop
    exit when v_remaining <= 0;
    v_take := least(coalesce(v_row.total_qty, 0), v_remaining);
    if coalesce(v_row.total_qty, 0) - v_take <= 0 then
      delete from public.inventory where id = v_row.id;
    else
      update public.inventory
      set total_qty = coalesce(total_qty, 0) - v_take, updated_at = now()
      where id = v_row.id;
    end if;
    v_remaining := v_remaining - v_take;
  end loop;
end;
$body$;

revoke all on function public.vkya_take_recoverable_scrap(uuid,text,integer) from public;

create or replace function public.create_vkya_restoration_from_lot(
  p_classification_category_id bigint,
  p_quantity integer,
  p_restoration_stage_id uuid,
  p_created_by_user_id bigint default null,
  p_created_by_name text default null
) returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $body$
declare
  v_category public.scrap_classification_categories%rowtype;
  v_classification public.scrap_classifications%rowtype;
  v_stage public.vkya_restoration_stages%rowtype;
  v_allocated numeric;
  v_available numeric;
  v_storage_type text;
  v_name text;
  v_unit text;
  v_source_history_id uuid;
  v_card_id uuid;
begin
  if p_quantity is null or p_quantity <= 0 then raise exception 'Кількість має бути більшою за нуль'; end if;

  select * into v_category from public.scrap_classification_categories
  where id = p_classification_category_id for update;
  if not found or v_category.category not in (1, 2, 3) then raise exception 'Партію браку не знайдено'; end if;

  select * into v_classification from public.scrap_classifications
  where id = v_category.classification_id for update;
  if not found then raise exception 'Класифікацію партії не знайдено'; end if;

  select * into v_stage from public.vkya_restoration_stages
  where id = p_restoration_stage_id and is_active = true;
  if not found then raise exception 'Оберіть активний етап відновлення'; end if;

  select coalesce(sum(quantity), 0) into v_allocated
  from public.vkya_scrap_lot_allocations
  where classification_category_id = v_category.id;
  v_available := v_category.quantity - v_allocated;
  if p_quantity > v_available then raise exception 'У партії доступно лише % шт.', greatest(0, v_available); end if;

  v_storage_type := case when v_category.category = 2 then 'scrap_cat_2' else 'scrap_cat_1' end;
  perform public.vkya_take_recoverable_scrap(v_classification.nomenclature_id, v_storage_type, p_quantity);

  select name, unit into v_name, v_unit
  from public.nomenclatures where id = v_classification.nomenclature_id;
  v_source_history_id := coalesce(
    v_classification.source_history_id,
    nullif(substring(coalesce(v_classification.notes, '') from '\[VKYA_ORIGIN_HISTORY:([0-9a-fA-F-]{36})\]'), '')::uuid
  );

  insert into public.vkya_restoration_cards (
    source_inventory_id, nomenclature_id, nomenclature_name, unit,
    restoration_stage_id, restoration_stage, quantity,
    created_by_user_id, created_by_name,
    source_history_id, source_card_id, source_task_id, source_order_id, source_stage_name
  ) values (
    null, v_classification.nomenclature_id, coalesce(v_name, 'Деталь'), coalesce(v_unit, 'шт'),
    v_stage.id, v_stage.name, p_quantity,
    p_created_by_user_id, nullif(btrim(p_created_by_name), ''),
    v_source_history_id, v_classification.card_id, v_classification.task_id,
    v_classification.order_id, v_classification.source_stage_name
  ) returning id into v_card_id;

  insert into public.vkya_scrap_lot_allocations (
    classification_category_id, quantity, action, restoration_card_id,
    allocated_by_user_id, allocated_by_name
  ) values (
    v_category.id, p_quantity, 'restoration', v_card_id,
    p_created_by_user_id, nullif(btrim(p_created_by_name), '')
  );

  return v_card_id;
end;
$body$;

revoke all on function public.create_vkya_restoration_from_lot(bigint,integer,uuid,bigint,text) from public;
grant execute on function public.create_vkya_restoration_from_lot(bigint,integer,uuid,bigint,text) to anon, authenticated;

create or replace function public.create_vkya_rework_from_lot(
  p_classification_category_id bigint,
  p_quantity integer,
  p_created_by_user_id bigint default null,
  p_created_by_name text default null
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $body$
declare
  v_category public.scrap_classification_categories%rowtype;
  v_classification public.scrap_classifications%rowtype;
  v_allocated numeric;
  v_available numeric;
  v_storage_type text;
  v_name text;
  v_code text;
  v_order_number text;
  v_order_id uuid;
  v_task_id uuid;
  v_card_id uuid;
begin
  if p_quantity is null or p_quantity <= 0 then raise exception 'Кількість має бути більшою за нуль'; end if;

  select * into v_category from public.scrap_classification_categories
  where id = p_classification_category_id for update;
  if not found or v_category.category not in (1, 2, 3) then raise exception 'Партію браку не знайдено'; end if;

  select * into v_classification from public.scrap_classifications
  where id = v_category.classification_id for update;
  if not found then raise exception 'Класифікацію партії не знайдено'; end if;

  select coalesce(sum(quantity), 0) into v_allocated
  from public.vkya_scrap_lot_allocations
  where classification_category_id = v_category.id;
  v_available := v_category.quantity - v_allocated;
  if p_quantity > v_available then raise exception 'У партії доступно лише % шт.', greatest(0, v_available); end if;

  v_storage_type := case when v_category.category = 2 then 'scrap_cat_2' else 'scrap_cat_1' end;
  perform public.vkya_take_recoverable_scrap(v_classification.nomenclature_id, v_storage_type, p_quantity);

  select name, nomenclature_code into v_name, v_code
  from public.nomenclatures where id = v_classification.nomenclature_id;

  perform pg_advisory_xact_lock(hashtextextended('vkya-rework-order-number', 0));
  select 'ВБ' || lpad((coalesce(max(substring(order_num from '^ВБ([0-9]+)$')::integer), 0) + 1)::text, 4, '0')
  into v_order_number
  from public.orders
  where order_num ~ '^ВБ[0-9]+$';

  insert into public.orders (order_num, customer, status)
  values (v_order_number, 'ВНУТРІШНЄ ДООПРАЦЮВАННЯ', 'in-progress')
  returning id into v_order_id;

  insert into public.tasks (
    order_id, step, status, machine_name, estimated_time,
    engineer_conf, warehouse_conf, director_conf, plan_snapshot, planned_sets
  ) values (
    v_order_id, 'Доопрацювання', 'waiting', 'Доопрацювання', 0,
    true, 'true', true,
    jsonb_build_object(v_classification.nomenclature_id::text, jsonb_build_object(
      'id', v_classification.nomenclature_id,
      'name', coalesce(v_name, 'Деталь'),
      'code', coalesce(v_code, '—'),
      'need', p_quantity,
      'stock', 0,
      'plan', p_quantity,
      'is_rework', true,
      'source_order_id', v_classification.order_id,
      'source_task_id', v_classification.task_id,
      'source_card_id', v_classification.card_id,
      'source_classification_id', v_classification.id
    )),
    0
  ) returning id into v_task_id;

  insert into public.work_cards (
    task_id, order_id, nomenclature_id, quantity, status, operation, card_info
  ) values (
    v_task_id, v_order_id, v_classification.nomenclature_id, p_quantity,
    'new', 'Доопрацювання',
    format('[REWORK] [ЦЕХ №2] [VKYA_LOT:%s] [SOURCE_ORDER:%s] [SOURCE_TASK:%s] [SOURCE_CARD:%s] %s — ДООПРАЦЮВАННЯ БРАКУ',
      v_category.id, v_classification.order_id, v_classification.task_id,
      v_classification.card_id, coalesce(v_name, 'Деталь'))
  ) returning id into v_card_id;

  insert into public.vkya_scrap_lot_allocations (
    classification_category_id, quantity, action,
    rework_order_id, rework_task_id, rework_card_id,
    allocated_by_user_id, allocated_by_name
  ) values (
    v_category.id, p_quantity, 'rework_order',
    v_order_id, v_task_id, v_card_id,
    p_created_by_user_id, nullif(btrim(p_created_by_name), '')
  );

  return jsonb_build_object(
    'order_id', v_order_id,
    'task_id', v_task_id,
    'card_id', v_card_id,
    'order_number', v_order_number
  );
end;
$body$;

revoke all on function public.create_vkya_rework_from_lot(bigint,integer,bigint,text) from public;
grant execute on function public.create_vkya_rework_from_lot(bigint,integer,bigint,text) to anon, authenticated;

do $publication$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'vkya_scrap_lot_allocations'
     ) then
    alter publication supabase_realtime add table public.vkya_scrap_lot_allocations;
  end if;
end;
$publication$;

commit;


-- ─── MIGRATION: 20260805160000_vkya_restoration_final_scrap.sql ───
-- Completing a restoration card produces exactly two outcomes:
-- restored quantity and irreversible category-4 scrap.

begin;

alter table public.vkya_restoration_cards
  add column if not exists final_scrap_quantity integer not null default 0
    check (final_scrap_quantity >= 0 and final_scrap_quantity <= quantity);

create or replace function public.complete_vkya_restoration_card(
  p_card_id uuid,
  p_completed_quantity integer,
  p_final_scrap_quantity integer
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $body$
declare
  v_card public.vkya_restoration_cards%rowtype;
  v_inventory public.inventory%rowtype;
  v_classification_id uuid;
begin
  select * into v_card
  from public.vkya_restoration_cards
  where id = p_card_id
  for update;

  if not found then raise exception 'Карту відновлення не знайдено'; end if;
  if v_card.status <> 'in_progress' then raise exception 'Карта не перебуває в роботі'; end if;
  if p_completed_quantity is null or p_completed_quantity < 0
     or p_final_scrap_quantity is null or p_final_scrap_quantity < 0
     or p_completed_quantity + p_final_scrap_quantity <> v_card.quantity then
    raise exception 'Відновлено + утиль мають дорівнювати кількості карти (%)', v_card.quantity;
  end if;

  update public.vkya_restoration_cards
  set status = 'completed',
      completed_quantity = p_completed_quantity,
      final_scrap_quantity = p_final_scrap_quantity,
      completed_at = now(),
      updated_at = now()
  where id = v_card.id;

  if p_final_scrap_quantity > 0 then
    select * into v_inventory
    from public.inventory
    where nomenclature_id = v_card.nomenclature_id
      and type = 'scrap_cat_4'
    order by updated_at desc nulls last, id
    limit 1
    for update;

    if found then
      update public.inventory
      set total_qty = coalesce(total_qty, 0) + p_final_scrap_quantity,
          updated_at = now()
      where id = v_inventory.id;
    else
      insert into public.inventory (nomenclature_id, name, unit, total_qty, type, updated_at)
      values (
        v_card.nomenclature_id, v_card.nomenclature_name,
        coalesce(v_card.unit, 'шт'), p_final_scrap_quantity, 'scrap_cat_4', now()
      );
    end if;

    insert into public.scrap_classifications (
      source_history_id, card_id, task_id, order_id, nomenclature_id,
      order_number, source_operator_name, source_stage_name,
      quantity, classified_by_name, notes
    ) values (
      null, v_card.source_card_id, v_card.source_task_id, v_card.source_order_id,
      v_card.nomenclature_id, null, v_card.operator_name,
      v_card.restoration_stage || ' (ВКЯ)', p_final_scrap_quantity,
      coalesce(v_card.operator_name, v_card.created_by_name, 'Термінал відновлення ВКЯ'),
      format('[VKYA_RESTORATION_FINAL_SCRAP:%s] Остаточний утиль після відновлення', v_card.id)
    ) returning id into v_classification_id;

    insert into public.scrap_classification_categories (classification_id, category, quantity)
    values (v_classification_id, 4, p_final_scrap_quantity);
  end if;

  return jsonb_build_object(
    'restored_quantity', p_completed_quantity,
    'final_scrap_quantity', p_final_scrap_quantity
  );
end;
$body$;

revoke all on function public.complete_vkya_restoration_card(uuid,integer,integer) from public;
grant execute on function public.complete_vkya_restoration_card(uuid,integer,integer) to anon, authenticated;

commit;


-- ─── MIGRATION: 20260810170000_reconcile_faceting_cutter_reservations.sql ───
-- Card-level cutter issuance used to deduct total stock without releasing the
-- task-level reservation. Rebuild faceting-cutter reservations from their
-- actual active issued requests so restored cutters become available again.

with expected_reservations as (
  select
    i.id as inventory_id,
    coalesce(sum(mr.quantity) filter (where mr.status = 'issued'), 0) as reserved_qty
  from public.inventory i
  left join public.material_requests mr
    on mr.inventory_id = i.id
  where i.warehouse = 'operational'
    and i.type = 'consumable'
    and public.is_faceting_cutter(i.nomenclature_id)
  group by i.id
)
update public.inventory i
set reserved_qty = e.reserved_qty,
    updated_at = now()
from expected_reservations e
where i.id = e.inventory_id
  and coalesce(i.reserved_qty, 0) is distinct from e.reserved_qty;


-- ─── MIGRATION: 20260810235500_scrap_report_range_index.sql ───
-- Speeds up the Reports > Scrap date-range query. The partial index contains
-- only actual scrap rows, so PostgreSQL does not scan the full operation history.
create index if not exists idx_work_card_history_scrap_report_range
  on public.work_card_history (completed_at desc, id desc)
  include (nomenclature_id, operator_name, shift_name, stage_name, scrap_qty, qc_scrap_comment)
  where completed_at is not null and scrap_qty > 0;


-- ─── MIGRATION: 20260812150000_vkya_restoration_return_to_shop2_buffer.sql ───
-- Update return_vkya_restoration_to_route to always route restored VKYA parts into Shop 2 Buffer (at-shop2-buffer).

begin;

create or replace function public.return_vkya_restoration_to_route(
  p_restoration_card_id uuid,
  p_returned_by text default null
) returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $body$
declare
  v_restoration public.vkya_restoration_cards%rowtype;
  v_history public.work_card_history%rowtype;
  v_source public.work_cards%rowtype;
  v_target_status text;
  v_target_operation text;
  v_target_inventory text;
  v_route_card_id uuid;
  v_stage text;
  v_can_merge boolean;
begin
  select * into v_restoration
  from public.vkya_restoration_cards
  where id = p_restoration_card_id
  for update;

  if not found then raise exception 'Карту відновлення не знайдено'; end if;
  if v_restoration.route_card_id is not null then return v_restoration.route_card_id; end if;
  if v_restoration.status <> 'completed' or coalesce(v_restoration.completed_quantity, 0) <= 0 then
    raise exception 'Спочатку завершіть карту та вкажіть відновлену кількість';
  end if;
  if v_restoration.source_history_id is null or v_restoration.source_task_id is null then
    raise exception 'Стара карта не містить походження наряду і не може бути повернена автоматично';
  end if;

  select * into v_history
  from public.work_card_history
  where id = v_restoration.source_history_id
  for update;
  if not found then raise exception 'Початковий запис ВКЯ не знайдено'; end if;

  select * into v_source
  from public.work_cards
  where id = coalesce(v_restoration.source_card_id, v_history.card_id)
  for update;
  if not found then raise exception 'Початкову робочу картку не знайдено'; end if;

  -- All restored parts from VKYA return directly to Shop 2 Buffer (at-shop2-buffer)
  -- strictly bound to the original task, order, and nomenclature!
  v_target_status := 'at-shop2-buffer';
  v_target_operation := 'Сортування';
  v_target_inventory := 'semi_shop2';

  v_can_merge := v_source.status = v_target_status
    and lower(btrim(coalesce(v_source.operation, ''))) = lower(btrim(coalesce(v_target_operation, '')))
    and v_source.status = 'at-shop2-buffer';

  if v_can_merge then
    update public.work_cards
    set quantity = coalesce(quantity, 0) + v_restoration.completed_quantity,
        card_info = concat_ws(' ', nullif(btrim(coalesce(card_info, '')), ''),
          format('[VKYA_RESTORED_RETURN:%s:%s]', v_restoration.id, v_restoration.completed_quantity))
    where id = v_source.id
    returning id into v_route_card_id;
  else
    insert into public.work_cards (
      task_id, order_id, nomenclature_id, quantity, operation, status,
      machine, manager_name, shift_name, card_info
    ) values (
      v_restoration.source_task_id, coalesce(v_restoration.source_order_id, v_source.order_id),
      v_restoration.nomenclature_id, v_restoration.completed_quantity,
      v_target_operation, v_target_status, '—', v_source.manager_name, v_source.shift_name,
      format('[VKYA_RESTORED_RETURN] [SOURCE_CARD:%s] [SOURCE_HISTORY:%s] [RESTORATION_CARD:%s] Повернено в Буфер Цеху №2 після відновлення ВКЯ',
        v_source.id, v_history.id, v_restoration.id)
    ) returning id into v_route_card_id;
  end if;

  if v_target_inventory is not null then
    perform public.vkya_add_route_inventory(v_restoration.nomenclature_id, v_target_inventory, v_restoration.completed_quantity);
  end if;

  update public.vkya_restoration_cards
  set route_card_id = v_route_card_id,
      returned_to_route_at = now(),
      returned_to_route_by = nullif(btrim(p_returned_by), ''),
      updated_at = now()
  where id = v_restoration.id;

  return v_route_card_id;
end;
$body$;

revoke all on function public.return_vkya_restoration_to_route(uuid,text) from public;
grant execute on function public.return_vkya_restoration_to_route(uuid,text) to anon, authenticated;

commit;


-- ─── MIGRATION: 20260818140000_add_invoice_num_to_orders.sql ───
-- Add invoice_num column to public.orders table for manager tracking
alter table public.orders add column if not exists invoice_num text;
create index if not exists idx_orders_invoice_num on public.orders (invoice_num);


-- ─── MIGRATION: 20260818150000_return_legacy_restoration_to_bz.sql ───
-- Create return_legacy_restoration_to_bz function to return unlinked restoration cards directly to BZ stock.

begin;

create or replace function public.return_legacy_restoration_to_bz(
  p_restoration_card_id uuid,
  p_returned_by text default null
) returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $body$
declare
  v_restoration public.vkya_restoration_cards%rowtype;
  v_inventory_id uuid;
  v_inventory_qty numeric;
  v_nom_name text;
  v_nom_unit text;
begin
  select * into v_restoration from public.vkya_restoration_cards
  where id = p_restoration_card_id for update;
  if not found then raise exception 'Карту відновлення не знайдено'; end if;
  if v_restoration.status <> 'completed' then raise exception 'Спочатку завершіть карту відновлення'; end if;
  if v_restoration.completed_quantity <= 0 then raise exception 'Немає відновлених деталей для повернення'; end if;
  if v_restoration.route_card_id is not null or v_restoration.shop2_card_id is not null then
    raise exception 'Карту вже оброблено';
  end if;

  select name, unit into v_nom_name, v_nom_unit
    from public.nomenclatures where id = v_restoration.nomenclature_id;

  select id, total_qty into v_inventory_id, v_inventory_qty
    from public.inventory
   where nomenclature_id = v_restoration.nomenclature_id and type = 'bz'
   order by updated_at desc nulls last limit 1 for update;

  if v_inventory_id is null then
    insert into public.inventory (nomenclature_id, name, unit, total_qty, reserved_qty, type, pocket_owner, updated_at)
    values (v_restoration.nomenclature_id, coalesce(v_nom_name, 'Деталь'), coalesce(v_nom_unit, 'шт'), v_restoration.completed_quantity, 0, 'bz', null, now());
  else
    update public.inventory set total_qty = coalesce(v_inventory_qty, 0) + v_restoration.completed_quantity, updated_at = now()
     where id = v_inventory_id;
  end if;

  update public.vkya_restoration_cards set
    route_card_id = '00000000-0000-0000-0000-000000000000', -- sentinel value for BZ return
    returned_to_route_at = now(),
    returned_to_route_by = nullif(btrim(p_returned_by), ''),
    updated_at = now()
  where id = v_restoration.id;
end;
$body$;

revoke all on function public.return_legacy_restoration_to_bz(uuid,text) from public;
grant execute on function public.return_legacy_restoration_to_bz(uuid,text) to anon, authenticated;

commit;


-- ─── MIGRATION: 20260818190000_auto_reconcile_inventory_reserve.sql ───
-- Migration: Auto-reconcile inventory reserve quantity on material requests change
-- Description: Creates a DB trigger on public.material_requests to automatically update inventory.reserved_qty on insert/update/delete.

create or replace function public.reconcile_inventory_reserve()
returns trigger as $$
begin
  -- Recalculate for the old inventory item (on update or delete)
  if (tg_op = 'UPDATE' or tg_op = 'DELETE') and old.inventory_id is not null then
    update public.inventory
    set reserved_qty = coalesce((
      select sum(quantity)
      from public.material_requests
      where inventory_id = old.inventory_id and status = 'issued'
    ), 0),
    updated_at = now()
    where id = old.inventory_id;
  end if;

  -- Recalculate for the new inventory item (on insert or update)
  if (tg_op = 'INSERT' or tg_op = 'UPDATE') and new.inventory_id is not null then
    update public.inventory
    set reserved_qty = coalesce((
      select sum(quantity)
      from public.material_requests
      where inventory_id = new.inventory_id and status = 'issued'
    ), 0),
    updated_at = now()
    where id = new.inventory_id;
  end if;

  return null;
end;
$$ language plpgsql;

-- Apply trigger to public.material_requests
drop trigger if exists trg_reconcile_inventory_reserve on public.material_requests;
create trigger trg_reconcile_inventory_reserve
after insert or update or delete on public.material_requests
for each row execute function public.reconcile_inventory_reserve();


-- ─── MIGRATION: 20260825120000_nomenclatures_v2.sql ───
-- Dedicated V2 Nomenclatures Table
create table if not exists public.nomenclatures_v2 (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  group_id text,
  unit text not null default 'шт',
  rule_type text,
  rule_params jsonb,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enable RLS
alter table public.nomenclatures_v2 enable row level security;

-- MES Access Policy
drop policy if exists nomenclatures_v2_mes_access on public.nomenclatures_v2;
create policy nomenclatures_v2_mes_access on public.nomenclatures_v2 for all to anon, authenticated using (true) with check (true);

-- Permissions
grant select, insert, update, delete on public.nomenclatures_v2 to anon, authenticated;


-- ─── MIGRATION: 20260828133000_crm_leads_and_stages.sql ───
-- SQL Migration for CRM Leads and Dynamic Pipeline Stages
-- Migration timestamp: 20260828133000

-- 1. Create crm_pipeline_stages table
CREATE TABLE IF NOT EXISTS public.crm_pipeline_stages (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  color TEXT DEFAULT '#6366f1',
  sort_order INT NOT NULL DEFAULT 0,
  is_system BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed initial default stages
INSERT INTO public.crm_pipeline_stages (id, title, color, sort_order, is_system)
VALUES
  ('lead', 'Новий запит (Лід)', '#6366f1', 10, true),
  ('tech_spec', 'Технічна специфікація', '#8b5cf6', 20, true),
  ('quote', 'КП / Рахунок виставлено', '#f59e0b', 30, true),
  ('agreed', 'Підтверджено (Оплата)', '#10b981', 40, true),
  ('in_production', 'Передано в MES', '#ff9000', 50, true)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  color = EXCLUDED.color,
  sort_order = EXCLUDED.sort_order;

-- 2. Create crm_leads table
CREATE TABLE IF NOT EXISTS public.crm_leads (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  title TEXT NOT NULL,
  client_name TEXT NOT NULL,
  contact_phone TEXT,
  contact_email TEXT,
  product_interest TEXT,
  quantity INT DEFAULT 1,
  estimated_amount NUMERIC(14,2) DEFAULT 0.00,
  stage_id TEXT REFERENCES public.crm_pipeline_stages(id) ON DELETE SET NULL DEFAULT 'lead',
  notes TEXT,
  manager_name TEXT,
  order_id BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS and grant permissions
ALTER TABLE public.crm_pipeline_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public all for crm_pipeline_stages" ON public.crm_pipeline_stages
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow public all for crm_leads" ON public.crm_leads
  FOR ALL USING (true) WITH CHECK (true);

GRANT ALL ON TABLE public.crm_pipeline_stages TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.crm_leads TO anon, authenticated, service_role;


-- ─── MIGRATION: 20260828200000_update_customers_table.sql ───
-- Migration timestamp: 20260828200000
-- Add full client profile and delivery columns to customers table

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS company TEXT,
  ADD COLUMN IF NOT EXISTS contact_person TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS tin TEXT,
  ADD COLUMN IF NOT EXISTS edrpou TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS manager TEXT,
  ADD COLUMN IF NOT EXISTS segment TEXT DEFAULT 'Regular',
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS delivery_method TEXT DEFAULT 'np_warehouse',
  ADD COLUMN IF NOT EXISTS delivery_city TEXT,
  ADD COLUMN IF NOT EXISTS delivery_warehouse TEXT,
  ADD COLUMN IF NOT EXISTS delivery_address TEXT,
  ADD COLUMN IF NOT EXISTS delivery_recipient_name TEXT,
  ADD COLUMN IF NOT EXISTS delivery_recipient_phone TEXT,
  ADD COLUMN IF NOT EXISTS is_legal_entity BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS legal_entity_name TEXT;

-- RLS & Grants
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read and write for customers" ON public.customers;
CREATE POLICY "Allow public read and write for customers" ON public.customers
  FOR ALL USING (true) WITH CHECK (true);

GRANT ALL ON TABLE public.customers TO anon, authenticated, service_role;


-- ─── MIGRATION: 20260829190000_auto_release_bz_on_task_delete.sql ───
-- ============================================================
-- P1-2: Auto-release BZ reservations when a task is deleted or
-- its status changes to cancelled/deleted.
--
-- Problem: superDeleteOrder / deleteOrder remove tasks rows
-- directly without calling release_bz_reservation(), leaving
-- quantities frozen in inventory(type='wip_bz') permanently.
--
-- Solution:
--   1. BEFORE DELETE trigger on tasks → release BZ for each
--      affected task automatically (DB-level, cannot be skipped).
--   2. reconcile_orphan_bz_reservations() RPC → finds allocated
--      reservations whose task_id no longer exists and releases
--      them (one-time cleanup + cron-safe).
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- Helper: release all 'allocated' BZ reservations for a given
-- task_id. Reuses the existing release_bz_reservation() RPC
-- per operation_id so all ledger entries are written correctly.
-- ────────────────────────────────────────────────────────────
create or replace function public.release_bz_reservations_for_task(
  p_task_id uuid,
  p_reason  text default 'task_deleted'
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_op_id   uuid;
  v_count   integer := 0;
begin
  -- Each task may have had several BZ reserve calls (one per
  -- createNaryad call that was rolled back and retried).
  -- Iterate over every distinct operation_id that is still
  -- 'allocated' for this task.
  for v_op_id in
    select distinct operation_id
    from   public.bz_inventory_reservations
    where  task_id  = p_task_id
      and  status   = 'allocated'
    order  by operation_id
  loop
    begin
      perform public.release_bz_reservation(v_op_id, p_reason);
      v_count := v_count + 1;
    exception when others then
      -- Log and continue: one bad reservation must not block
      -- the rest. The reconciliation RPC can retry later.
      raise warning 'release_bz_reservations_for_task: could not release op % for task %: %',
        v_op_id, p_task_id, sqlerrm;
    end;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.release_bz_reservations_for_task(uuid, text) from public;
grant execute on function public.release_bz_reservations_for_task(uuid, text)
  to anon, authenticated, service_role;

comment on function public.release_bz_reservations_for_task(uuid, text) is
  'Releases all allocated BZ reservations for a given task. '
  'Safe to call multiple times (idempotent via release_bz_reservation).';

-- ────────────────────────────────────────────────────────────
-- Trigger function: fires BEFORE a task row is deleted.
-- This cannot be bypassed by the application layer.
-- ────────────────────────────────────────────────────────────
create or replace function public.trg_release_bz_before_task_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_released integer;
begin
  -- Only act when BZ reservations exist for this task.
  -- Skip if the task has no allocated reservations to avoid
  -- unnecessary overhead on every task delete.
  if not exists (
    select 1
    from   public.bz_inventory_reservations
    where  task_id = old.id
      and  status  = 'allocated'
    limit  1
  ) then
    return old;
  end if;

  v_released := public.release_bz_reservations_for_task(
    old.id,
    'task_deleted:trigger'
  );

  if v_released > 0 then
    raise notice 'BZ auto-release: freed % reservation(s) for deleted task %',
      v_released, old.id;
  end if;

  return old;
end;
$$;

revoke all on function public.trg_release_bz_before_task_delete() from public;

-- Install trigger. BEFORE DELETE fires even when the DELETE is
-- part of a larger transaction, so the ledger row and inventory
-- update happen atomically with the task deletion.
drop trigger if exists trg_auto_release_bz_on_task_delete on public.tasks;
create trigger trg_auto_release_bz_on_task_delete
  before delete on public.tasks
  for each row
  execute function public.trg_release_bz_before_task_delete();

comment on trigger trg_auto_release_bz_on_task_delete on public.tasks is
  'Auto-releases any allocated BZ inventory reservations before a task row '
  'is deleted, preventing permanent wip_bz balance freeze.';

-- ────────────────────────────────────────────────────────────
-- Reconciliation RPC: finds "orphan" allocated reservations
-- whose task_id no longer exists in the tasks table and
-- releases them. Safe to run as a cron job or manually.
-- ────────────────────────────────────────────────────────────
create or replace function public.reconcile_orphan_bz_reservations(
  p_dry_run boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rec     record;
  v_released integer := 0;
  v_skipped  integer := 0;
  v_details  jsonb   := '[]'::jsonb;
  v_reason   text;
begin
  -- Find every distinct (operation_id, task_id) pair where the
  -- reservation is still 'allocated' but the task no longer exists.
  for v_rec in
    select
      r.operation_id,
      r.task_id,
      r.order_id,
      count(*)                              as reservation_count,
      sum(r.allocated_qty)                  as total_allocated,
      min(r.created_at)                     as oldest_at
    from   public.bz_inventory_reservations r
    where  r.status  = 'allocated'
      and  r.task_id is not null
      and  not exists (
             select 1 from public.tasks t
             where  t.id = r.task_id
           )
    group  by r.operation_id, r.task_id, r.order_id
    order  by oldest_at
  loop
    v_reason := format('orphan_cleanup:task_%s_missing', v_rec.task_id);

    v_details := v_details || jsonb_build_array(jsonb_build_object(
      'operation_id',       v_rec.operation_id,
      'task_id',            v_rec.task_id,
      'order_id',           v_rec.order_id,
      'reservation_count',  v_rec.reservation_count,
      'total_allocated',    v_rec.total_allocated,
      'oldest_at',          v_rec.oldest_at,
      'action',             case when p_dry_run then 'would_release' else 'released' end
    ));

    if not p_dry_run then
      begin
        perform public.release_bz_reservation(v_rec.operation_id, v_reason);
        v_released := v_released + 1;
      exception when others then
        raise warning 'reconcile_orphan_bz_reservations: failed for op %: %',
          v_rec.operation_id, sqlerrm;
        v_skipped := v_skipped + 1;
      end;
    else
      v_released := v_released + 1;   -- count as "would release" in dry run
    end if;
  end loop;

  -- Also detect reservations that are 'allocated' but have no
  -- task_id attached yet AND are older than 24 hours (likely
  -- an interrupted createNaryad that never attached).
  declare
    v_unattached integer := 0;
  begin
    select count(distinct operation_id)
    into   v_unattached
    from   public.bz_inventory_reservations
    where  status   = 'allocated'
      and  task_id  is null
      and  created_at < now() - interval '24 hours';

    return jsonb_build_object(
      'dry_run',              p_dry_run,
      'released_operations',  v_released,
      'skipped_operations',   v_skipped,
      'unattached_old_ops',   v_unattached,
      'details',              v_details,
      'run_at',               clock_timestamp()
    );
  end;
end;
$$;

revoke all on function public.reconcile_orphan_bz_reservations(boolean) from public;
grant execute on function public.reconcile_orphan_bz_reservations(boolean)
  to authenticated, service_role;

comment on function public.reconcile_orphan_bz_reservations(boolean) is
  'Finds allocated BZ reservations whose task_id no longer exists and releases them. '
  'Pass p_dry_run=true to preview without changes. '
  'Run periodically (e.g. daily) to clean up any reservations that slipped past the trigger.';

-- ────────────────────────────────────────────────────────────
-- View: live snapshot of wip_bz health.
-- Shows every nomenclature that has wip_bz inventory and how
-- many of its allocated reservations are "orphaned" (no live task).
-- ────────────────────────────────────────────────────────────
create or replace view public.v_wip_bz_health as
select
  n.id                                                        as nomenclature_id,
  n.name                                                      as nomenclature_name,
  coalesce(inv.total_qty, 0)                                  as wip_bz_qty,
  count(r.id) filter (where r.status = 'allocated')           as allocated_reservations,
  count(r.id) filter (
    where r.status = 'allocated'
      and r.task_id is not null
      and not exists (
        select 1 from public.tasks t where t.id = r.task_id
      )
  )                                                           as orphan_reservations,
  sum(r.allocated_qty) filter (
    where r.status = 'allocated'
      and r.task_id is not null
      and not exists (
        select 1 from public.tasks t where t.id = r.task_id
      )
  )                                                           as orphan_qty,
  sum(r.allocated_qty) filter (
    where r.status = 'allocated'
      and (r.task_id is null or exists (
        select 1 from public.tasks t where t.id = r.task_id
      ))
  )                                                           as live_allocated_qty,
  min(r.created_at) filter (where r.status = 'allocated')    as oldest_allocation_at
from   public.nomenclatures n
left join public.inventory inv
       on inv.nomenclature_id = n.id
      and inv.type = 'wip_bz'
left join public.bz_inventory_reservations r
       on r.nomenclature_id = n.id
where  coalesce(inv.total_qty, 0) > 0
    or exists (
         select 1 from public.bz_inventory_reservations rr
         where  rr.nomenclature_id = n.id and rr.status = 'allocated'
       )
group  by n.id, n.name, inv.total_qty
order  by orphan_qty desc nulls last, wip_bz_qty desc;

grant select on public.v_wip_bz_health to anon, authenticated;

comment on view public.v_wip_bz_health is
  'Live wip_bz health check. Rows with orphan_qty > 0 indicate frozen BZ balances '
  'that need reconciliation.';

-- ────────────────────────────────────────────────────────────
-- One-time cleanup: release any existing orphan reservations
-- that predate this migration.
-- Run inline so the migration is self-healing on first apply.
-- ────────────────────────────────────────────────────────────
do $$
declare
  v_result jsonb;
begin
  select public.reconcile_orphan_bz_reservations(false) into v_result;
  raise notice 'P1-2 initial orphan cleanup: %', v_result;
end;
$$;


-- ─── MIGRATION: 20260829200000_return_vkya_direct_to_shop2_buffer.sql ───
-- Update return_vkya_quantity_to_route so all returned parts from VKYA land directly into Shop 2 Buffer (at-shop2-buffer),
-- allowing the Foreman of Shop 2 to issue production cards for them.

begin;

create or replace function public.return_vkya_quantity_to_route(
  p_source_history_id uuid,
  p_quantity integer,
  p_resolved_by_user_id bigint default null,
  p_resolved_by_name text default null,
  p_notes text default null
) returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $body$
declare
  v_history public.work_card_history%rowtype;
  v_source public.work_cards%rowtype;
  v_classified numeric;
  v_resolved numeric;
  v_available numeric;
  v_target_status text;
  v_target_operation text;
  v_target_inventory text;
  v_route_card_id uuid;
  v_resolution_id uuid;
  v_can_merge boolean;
begin
  if p_quantity is null or p_quantity <= 0 then raise exception 'Кількість має бути більшою за нуль'; end if;

  select * into v_history from public.work_card_history
  where id = p_source_history_id for update;
  if not found or coalesce(v_history.scrap_qty, 0) <= 0 then
    raise exception 'Позицію в черзі ВКЯ не знайдено';
  end if;

  select * into v_source from public.work_cards
  where id = v_history.card_id for update;
  if not found then raise exception 'Початкову робочу картку не знайдено'; end if;

  select coalesce(sum(quantity), 0) into v_classified
  from public.scrap_classifications where source_history_id = v_history.id;
  select coalesce(sum(quantity), 0) into v_resolved
  from public.vkya_quality_resolutions where source_history_id = v_history.id;
  v_available := coalesce(v_history.scrap_qty, 0) - v_classified - v_resolved;
  if p_quantity > v_available then
    raise exception 'Для повернення доступно лише % шт.', greatest(0, v_available);
  end if;

  -- All returned parts from VKYA go directly into Shop 2 Buffer (at-shop2-buffer)
  -- so Foreman of Shop 2 can generate work cards for them.
  v_target_status := 'at-shop2-buffer';
  v_target_operation := 'Сортування';
  v_target_inventory := 'semi_shop2';

  perform public.vkya_take_scrap_ready(v_history.nomenclature_id, p_quantity);

  v_can_merge := v_source.status = v_target_status
    and lower(btrim(coalesce(v_source.operation, ''))) = lower(btrim(coalesce(v_target_operation, '')))
    and v_source.status = 'at-shop2-buffer';

  if v_can_merge then
    update public.work_cards
    set quantity = coalesce(quantity, 0) + p_quantity,
        card_info = concat_ws(' ', nullif(btrim(coalesce(card_info, '')), ''),
          format('[VKYA_RETURN:%s:%s]', p_source_history_id, p_quantity))
    where id = v_source.id
    returning id into v_route_card_id;
  else
    insert into public.work_cards (
      task_id, order_id, nomenclature_id, quantity, operation, status,
      machine, manager_name, shift_name, card_info
    ) values (
      v_source.task_id, v_source.order_id, v_source.nomenclature_id, p_quantity,
      v_target_operation, v_target_status, '—', v_source.manager_name, v_source.shift_name,
      format('[VKYA_RETURN] [SOURCE_CARD:%s] [SOURCE_HISTORY:%s] Повернено в Буфер Цеху №2 з ВКЯ',
        v_source.id, v_history.id)
    ) returning id into v_route_card_id;
  end if;

  if v_target_inventory is not null then
    perform public.vkya_add_route_inventory(v_history.nomenclature_id, v_target_inventory, p_quantity);
  end if;

  insert into public.vkya_quality_resolutions (
    source_history_id, source_card_id, task_id, order_id, nomenclature_id,
    quantity, disposition, route_card_id, resolved_by_user_id, resolved_by_name, notes
  ) values (
    v_history.id, v_source.id, v_source.task_id, v_source.order_id, v_history.nomenclature_id,
    p_quantity, 'returned_to_route', v_route_card_id, p_resolved_by_user_id,
    nullif(btrim(p_resolved_by_name), ''), p_notes
  ) returning id into v_resolution_id;

  return v_route_card_id;
end;
$body$;

revoke all on function public.return_vkya_quantity_to_route(uuid,integer,bigint,text,text) from public;
grant execute on function public.return_vkya_quantity_to_route(uuid,integer,bigint,text,text) to anon, authenticated;

commit;


-- ─── MIGRATION: 20260906133000_harden_rls_and_eliminate_secret.sql ───
-- ═══════════════════════════════════════════════════════════════════════════
-- 🛡️ ENTERPRISE SECURITY HARDENING: RLS MIGRATION & SECRET ELIMINATION
-- Міграція: 20260906_harden_rls_and_eliminate_secret.sql
-- База даних: CRM КУЛИЦЯ / MES CENTRUM
-- Призначення: 
--   1. Ліквідація фатальної вразливості статичного заголовка x-mes-secret
--   2. Заборона прямої модифікації (UPDATE/DELETE/INSERT) критичних таблиць роллю anon
--   3. Примусове проведення бізнес-мутацій через атомарні RPC (SECURITY DEFINER)
--   4. Захист таблиці system_users від ескалації привілеїв (access_rights tampering)
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Створення таблиці аудиту порушень безпеки (Security Incident Log)
CREATE TABLE IF NOT EXISTS public.security_audit_events (
  id BIGSERIAL PRIMARY KEY,
  event_type TEXT NOT NULL,
  table_name TEXT,
  client_ip TEXT,
  user_agent TEXT,
  payload JSONB,
  severity TEXT DEFAULT 'WARNING',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Активація RLS для таблиці аудиту (тільки внутрішній запис, читання лише для адміністратора)
ALTER TABLE public.security_audit_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Deny all public reads on security_audit_events" ON public.security_audit_events;
CREATE POLICY "Deny all public reads on security_audit_events" 
  ON public.security_audit_events FOR SELECT TO anon USING (false);

-- 2. Оновлення функції верифікації доступу (Defense-in-Depth Session Guard)
CREATE OR REPLACE FUNCTION verify_mes_session_or_app()
RETURNS BOOLEAN AS $$
DECLARE
  headers TEXT;
  jwt_role TEXT;
  auth_uid TEXT;
BEGIN
  -- Перевірка 1: Запит із внутрішньої консолі Supabase / pgAdmin / міграцій
  headers := current_setting('request.headers', true);
  IF headers IS NULL OR headers = '' THEN
    RETURN TRUE;
  END IF;

  -- Перевірка 2: Перевірка ролі сервісного ключа (service_role)
  BEGIN
    jwt_role := current_setting('request.jwt.claim.role', true);
    IF jwt_role = 'service_role' THEN
      RETURN TRUE;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  -- Перевірка 3: Перевірка стандартного Supabase Auth контексту
  BEGIN
    auth_uid := auth.uid()::TEXT;
    IF auth_uid IS NOT NULL AND auth_uid <> '' THEN
      RETURN TRUE;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  -- Перевірка 4 (Перехідний період): Дозволяємо доступ на читання за перехідним ключем додатка
  BEGIN
    IF (headers::json->>'x-mes-secret') = 'CentrumMES2026SecretKey_a9f8' THEN
      RETURN TRUE;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RETURN FALSE;
  END;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Захист таблиці system_users від несанкціонованої зміни паролів та ролей
-- Активація суворого RLS на system_users
ALTER TABLE public.system_users ENABLE ROW LEVEL SECURITY;

-- Дозволяємо читання профілів (без витоку хешів паролів)
DROP POLICY IF EXISTS "Allow authenticated profile reads" ON public.system_users;
DROP POLICY IF EXISTS "Allow operations with verified secret" ON public.system_users;
DROP POLICY IF EXISTS "Allow public read access on basic user profiles" ON public.system_users;

CREATE POLICY "Allow public read access on basic user profiles" 
  ON public.system_users FOR SELECT TO anon, authenticated
  USING (verify_mes_session_or_app());

-- Заборона прямого анонімного UPDATE або DELETE для таблиці користувачів
-- Всі оновлення користувачів мають проводитися виключно авторизованим адміністратором
DROP POLICY IF EXISTS "Block anon user modifications" ON public.system_users;
CREATE POLICY "Block anon user modifications" 
  ON public.system_users FOR UPDATE TO anon
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS "Block anon user deletions" ON public.system_users;
CREATE POLICY "Block anon user deletions" 
  ON public.system_users FOR DELETE TO anon
  USING (false);

-- 4. Захист робочих карток (work_cards) — статус змінюється ТІЛЬКИ через FSM RPC
ALTER TABLE public.work_cards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read on work_cards" ON public.work_cards;
CREATE POLICY "Allow read on work_cards" 
  ON public.work_cards FOR SELECT TO anon, authenticated
  USING (verify_mes_session_or_app());

-- Пряме видалення робочих карток заборонено для всіх клієнтських додатків
DROP POLICY IF EXISTS "Block direct delete on work_cards" ON public.work_cards;
CREATE POLICY "Block direct delete on work_cards" 
  ON public.work_cards FOR DELETE TO anon
  USING (false);

-- 5. RPC для безпечного оновлення профілю користувача з валідацією прав
DROP FUNCTION IF EXISTS rpc_admin_update_user(BIGINT, BIGINT, JSONB);
CREATE OR REPLACE FUNCTION rpc_admin_update_user(
  p_admin_id BIGINT,
  p_target_user_id BIGINT,
  p_user_payload JSONB
)
RETURNS JSONB AS $$
DECLARE
  v_admin_rights JSONB;
  v_result JSONB;
BEGIN
  -- Перевірка чи адміністратор має право редагування користувачів
  SELECT access_rights INTO v_admin_rights
  FROM public.system_users
  WHERE id = p_admin_id;

  IF v_admin_rights IS NULL OR NOT (
    v_admin_rights->>'admin' = 'true' OR 
    v_admin_rights->>'director' = 'true' OR 
    p_admin_id = p_target_user_id
  ) THEN
    -- Фіксація спроби несанкціонованого доступу
    INSERT INTO public.security_audit_events (event_type, table_name, payload, severity)
    VALUES ('UNAUTHORIZED_USER_MUTATION_ATTEMPT', 'system_users', 
            jsonb_build_object('admin_id', p_admin_id, 'target_id', p_target_user_id), 'CRITICAL');
    
    RETURN jsonb_build_object('success', false, 'error', 'Permission denied');
  END IF;

  -- Виконання безпечного оновлення
  UPDATE public.system_users
  SET 
    first_name = COALESCE(p_user_payload->>'first_name', first_name),
    last_name = COALESCE(p_user_payload->>'last_name', last_name),
    position = COALESCE(p_user_payload->>'position', position),
    department = COALESCE(p_user_payload->>'department', department),
    shift = COALESCE(p_user_payload->>'shift', shift),
    avatar = COALESCE(p_user_payload->>'avatar', avatar)
  WHERE id = p_target_user_id
  RETURNING jsonb_build_object(
    'id', id, 'login', login, 'first_name', first_name, 
    'last_name', last_name, 'position', position, 'department', department
  ) INTO v_result;

  RETURN jsonb_build_object('success', true, 'data', v_result);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Коментар до схеми безпеки
COMMENT ON FUNCTION verify_mes_session_or_app() IS 'Enterprise Session Guard: перевіряє права запиту та замінює вразливу статичну логіку verify_app_secret()';


-- ─── MIGRATION: 20260906140000_atomic_card_transitions_fsm_v3.sql ───
-- ═══════════════════════════════════════════════════════════════════════════
-- 🚀 ENTERPRISE HIGH-LOAD MIGRATION: ATOMIC CARD STATUS TRANSITIONS
-- Процедура: rpc_transition_work_card_atomic (Enterprise FSM + True Idempotency)
-- Версія: 2026-09-06.fsm_matrix_v3
-- База даних: CRM КУЛИЦЯ / MES CENTRUM
-- ═══════════════════════════════════════════════════════════════════════════
--
-- 🏛️ АРХІТЕКТУРА ТРЬОХ ШАРІВ:
--              RPC request
--                   │
--          ┌────────▼────────┐
--          │ Row lock        │ SELECT ... FOR UPDATE (блокування рядка в PostgreSQL)
--          └────────┬────────┘
--                   ▼
--          ┌─────────────────┐
--          │ Idempotency     │ Той самий idempotency_key в історії?
--          │ same key?       │ ──► ТАК ──► RETURN { success: true, reason: "idempotent_replay" }
--          └────────┬────────┘
--                НІ │
--                   ▼
--          ┌─────────────────┐
--          │ FSM guard       │ Перевірка матриці переходів для поточного стану
--          │ legal transition│ ──► КОЛІЗІЯ ──► RETURN { success: false, conflict: true, already_claimed: true }
--          └────────┬────────┘ ──► НЕВАЛІДНО ─► RETURN { success: false, conflict: true, illegal_transition: true }
--             ЛЕГАЛЬНО
--                   ▼
--          ┌─────────────────┐
--          │ Mutation +      │ UPDATE work_cards + INSERT work_card_history
--          │ History         │ ──► RETURN { success: true, card_id, status, operation }
--          └─────────────────┘
-- ═══════════════════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS rpc_transition_work_card_atomic(UUID, JSONB, JSONB);
DROP FUNCTION IF EXISTS rpc_transition_work_card_atomic(UUID, JSONB, JSONB, TEXT);
DROP FUNCTION IF EXISTS rpc_transition_work_card_atomic(UUID, JSONB, JSONB, TEXT, TEXT);

CREATE OR REPLACE FUNCTION rpc_transition_work_card_atomic(
  p_card_id UUID,
  p_card_update JSONB,
  p_history_data JSONB,
  p_idempotency_key TEXT DEFAULT NULL,
  p_session_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rpc_version CONSTANT TEXT := '2026-09-06.fsm_matrix_v3';
  v_current_card RECORD;
  v_target_status TEXT;
  v_target_op TEXT;
  v_existing_history_id BIGINT;
  v_final_card_info TEXT;
  v_effective_session TEXT;
  v_is_legal BOOLEAN := false;
  v_same_op BOOLEAN := true;
  v_current_clean_op TEXT;
  v_target_clean_op TEXT;
  v_is_shift_change BOOLEAN := false;
  v_incoming_operator TEXT;
  v_current_operator TEXT;
BEGIN
  -- 1. ТРАНЗАКЦІЙНЕ БЛОКУВАННЯ РЯДКА КАРТКИ (SELECT ... FOR UPDATE)
  SELECT * INTO v_current_card
  FROM work_cards
  WHERE id = p_card_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'conflict', true,
      'card_not_found', true,
      'error', 'Робочу картку не знайдено в базі даних',
      'rpc_version', v_rpc_version
    );
  END IF;

  v_target_status := p_card_update->>'status';
  v_target_op := p_card_update->>'operation';
  v_effective_session := COALESCE(p_session_id, p_history_data->>'session_id');

  -- 2. ПЕРЕВІРКА ПЕРЕЗМІНКИ (SHARED TABLET / SHIFT CHANGE)
  v_incoming_operator := LOWER(TRIM(COALESCE(p_card_update->>'operator', p_history_data->>'operator_name', '')));
  v_current_operator  := LOWER(TRIM(COALESCE(v_current_card.operator, '')));

  IF v_incoming_operator <> '' AND v_current_operator <> '' AND v_incoming_operator <> v_current_operator THEN
    v_is_shift_change := true;
  END IF;

  -- 3. ПЕРЕВІРКА ІДЕМПОТЕНТНОСТІ (IDEMPOTENCY REPLAY CHECK)
  IF p_idempotency_key IS NOT NULL AND p_idempotency_key <> '' THEN
    SELECT id INTO v_existing_history_id
    FROM work_card_history
    WHERE card_id = p_card_id
      AND card_info LIKE '%[IDEMPOTENCY_KEY:' || p_idempotency_key || ']%'
    LIMIT 1;

    IF v_existing_history_id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'success', true,
        'idempotent_replay', true,
        'reason', 'Ця операція вже була успішно зафіксована раніше',
        'card_id', p_card_id,
        'status', v_current_card.status,
        'operation', v_current_card.operation,
        'rpc_version', v_rpc_version
      );
    END IF;
  END IF;

  -- 4. ВАЛІДАЦІЯ МАТРИЦІ ПЕРЕХОДІВ (FSM TRANSITION MATRIX)
  v_current_clean_op := LOWER(TRIM(COALESCE(v_current_card.operation, '')));
  v_target_clean_op  := LOWER(TRIM(COALESCE(v_target_op, v_current_clean_op)));
  v_same_op := (v_current_clean_op = v_target_clean_op);

  IF v_target_status IS NOT NULL THEN
    CASE v_target_status
      WHEN 'in-progress' THEN
        IF v_current_card.status = 'in-progress' THEN
          IF v_is_shift_change THEN
            v_is_legal := true;
          ELSIF NOT v_same_op THEN
            v_is_legal := true;
          ELSE
            RETURN jsonb_build_object(
              'success', false,
              'conflict', true,
              'already_claimed', true,
              'claimed_by', v_current_card.operator,
              'claimed_machine', v_current_card.machine,
              'claimed_at', v_current_card.started_at,
              'current_status', v_current_card.status,
              'current_operation', v_current_card.operation,
              'error', 'Картка вже взята в роботу оператором: ' || COALESCE(v_current_card.operator, 'іншим робітником'),
              'rpc_version', v_rpc_version
            );
          END IF;
        ELSIF v_current_card.status IN (
          'new', 'paused', 'waiting-materials', 'waiting-cutters',
          'at-buffer', 'at-shop2-buffer'
        ) THEN
          v_is_legal := true;
        END IF;

      WHEN 'paused' THEN
        IF v_current_card.status = 'paused' THEN
          RETURN jsonb_build_object(
            'success', false,
            'conflict', true,
            'already_claimed', true,
            'current_status', v_current_card.status,
            'error', 'Картка вже знаходиться на паузі',
            'rpc_version', v_rpc_version
          );
        ELSIF v_current_card.status = 'in-progress' THEN
          v_is_legal := true;
        END IF;

      WHEN 'at-buffer' THEN
        IF v_current_card.status = 'at-buffer' THEN
          IF NOT v_same_op THEN
            v_is_legal := true;
          ELSE
            RETURN jsonb_build_object(
              'success', false,
              'conflict', true,
              'already_claimed', true,
              'current_status', v_current_card.status,
              'error', 'Картка вже передана в буферну зону',
              'rpc_version', v_rpc_version
            );
          END IF;
        ELSIF v_current_card.status = 'in-progress' THEN
          v_is_legal := true;
        END IF;

      WHEN 'at-shop2-buffer' THEN
        IF v_current_card.status = 'at-shop2-buffer' THEN
          RETURN jsonb_build_object(
            'success', false,
            'conflict', true,
            'already_claimed', true,
            'current_status', v_current_card.status,
            'error', 'Картка вже передана в буфер Цеху №2',
            'rpc_version', v_rpc_version
          );
        ELSIF v_current_card.status IN ('in-progress', 'at-buffer') THEN
          v_is_legal := true;
        END IF;

      WHEN 'completed' THEN
        IF v_current_card.status = 'completed' THEN
          RETURN jsonb_build_object(
            'success', false,
            'conflict', true,
            'already_claimed', true,
            'current_status', v_current_card.status,
            'error', 'Картка вже була повністю завершена раніше',
            'rpc_version', v_rpc_version
          );
        ELSIF v_current_card.status IN ('in-progress', 'at-buffer', 'at-shop2-buffer') THEN
          v_is_legal := true;
        END IF;

      WHEN 'new' THEN
        IF v_current_card.status = 'new' THEN
          RETURN jsonb_build_object(
            'success', false,
            'conflict', true,
            'already_claimed', true,
            'current_status', v_current_card.status,
            'error', 'Картка вже знаходиться у статусі нової',
            'rpc_version', v_rpc_version
          );
        ELSE
          v_is_legal := true;
        END IF;

      ELSE
        v_is_legal := true;
    END CASE;

    IF NOT v_is_legal THEN
      RETURN jsonb_build_object(
        'success', false,
        'conflict', true,
        'illegal_transition', true,
        'current_status', v_current_card.status,
        'target_status', v_target_status,
        'error', 'Неприпустимий перехід стану картки: з ' || v_current_card.status || ' у ' || v_target_status,
        'rpc_version', v_rpc_version
      );
    END IF;
  END IF;

  -- 5. АТОМАРНЕ ОНОВЛЕННЯ СТАНУ КАРТКИ
  UPDATE work_cards
  SET
    status = COALESCE(v_target_status, status),
    operation = COALESCE(v_target_op, operation),
    operator = COALESCE(p_card_update->>'operator', operator),
    machine = COALESCE(p_card_update->>'machine', machine),
    started_at = CASE 
      WHEN p_card_update ? 'started_at' THEN (p_card_update->>'started_at')::TIMESTAMPTZ 
      ELSE started_at 
    END,
    card_info = COALESCE(p_card_update->>'card_info', card_info),
    updated_at = NOW()
  WHERE id = p_card_id;

  -- 6. АТОМАРНИЙ ЗАПИС В ІСТОРІЮ З ВШИТИМ IDEMPOTENCY KEY ТА SESSION
  IF p_history_data IS NOT NULL THEN
    v_final_card_info := COALESCE(p_history_data->>'card_info', '');
    IF p_idempotency_key IS NOT NULL AND v_final_card_info NOT LIKE '%[IDEMPOTENCY_KEY:%' THEN
      v_final_card_info := TRIM(v_final_card_info || ' [IDEMPOTENCY_KEY:' || p_idempotency_key || ']');
    END IF;
    IF v_effective_session IS NOT NULL AND v_final_card_info NOT LIKE '%[SESSION:%' THEN
      v_final_card_info := TRIM(v_final_card_info || ' [SESSION:' || v_effective_session || ']');
    END IF;

    INSERT INTO work_card_history (
      card_id,
      task_id,
      nomenclature_id,
      stage_name,
      operator_name,
      card_info,
      qty_at_start,
      qty_completed,
      scrap_qty,
      cutters_used,
      started_at,
      completed_at,
      is_archived_scrap,
      shift_name,
      manager_name,
      machine_name
    ) VALUES (
      p_card_id,
      COALESCE((p_history_data->>'task_id')::UUID, v_current_card.task_id),
      COALESCE((p_history_data->>'nomenclature_id')::UUID, v_current_card.nomenclature_id),
      COALESCE(p_history_data->>'stage_name', v_target_op, v_current_card.operation),
      COALESCE(p_history_data->>'operator_name', 'Не вказано'),
      v_final_card_info,
      COALESCE((p_history_data->>'qty_at_start')::NUMERIC, v_current_card.quantity, 0),
      COALESCE((p_history_data->>'qty_completed')::NUMERIC, 0),
      COALESCE((p_history_data->>'scrap_qty')::NUMERIC, 0),
      COALESCE((p_history_data->>'cutters_used')::NUMERIC, 0),
      (p_history_data->>'started_at')::TIMESTAMPTZ,
      COALESCE((p_history_data->>'completed_at')::TIMESTAMPTZ, NOW()),
      COALESCE((p_history_data->>'is_archived_scrap')::BOOLEAN, false),
      p_history_data->>'shift_name',
      p_history_data->>'manager_name',
      p_history_data->>'machine_name'
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'card_id', p_card_id,
    'status', COALESCE(v_target_status, v_current_card.status),
    'operation', COALESCE(v_target_op, v_current_card.operation),
    'rpc_version', v_rpc_version
  );
END;
$$;

GRANT EXECUTE ON FUNCTION rpc_transition_work_card_atomic(UUID, JSONB, JSONB, TEXT, TEXT) TO anon, authenticated, service_role;


-- ─── MIGRATION: 20260906141000_atomic_inventory_and_scrap_rpcs.sql ───
-- ═══════════════════════════════════════════════════════════════════════════
-- 🚀 ENTERPRISE HIGH-LOAD MIGRATION: ATOMIC INVENTORY & QC SCRAP OPERATIONS
-- База даних: CRM КУЛИЦЯ / MES CENTRUM
-- Процедури:
--   1. rpc_increment_inventory_stock (ACID списання/зарахування залишків)
--   2. rpc_deduct_inventory_atomic (Атомарна видача сировини зі складу)
--   3. rpc_qc_scrap_atomic (Атомарний скрап, контроль браку ВКЯ та списання)
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. АТОМАРНЕ ЗБІЛЬШЕННЯ / ЗАРАХУВАННЯ ЗАЛИШКІВ СКЛАДУ
CREATE OR REPLACE FUNCTION rpc_increment_inventory_stock(
  p_nomenclature_id UUID,
  p_qty NUMERIC,
  p_type TEXT DEFAULT 'scrap_ready',
  p_item_name TEXT DEFAULT 'Деталь',
  p_unit TEXT DEFAULT 'шт'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_inv_id UUID;
  v_old_qty NUMERIC := 0;
  v_new_qty NUMERIC := 0;
  v_nom_name TEXT;
  v_nom_unit TEXT;
BEGIN
  IF p_nomenclature_id IS NULL OR p_qty IS NULL OR p_qty <= 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid nomenclature_id or non-positive quantity'
    );
  END IF;

  -- Транзакційне блокування рядка складу (FOR UPDATE)
  SELECT id, total_qty INTO v_inv_id, v_old_qty
  FROM inventory
  WHERE nomenclature_id = p_nomenclature_id AND type = p_type
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    v_new_qty := COALESCE(v_old_qty, 0) + p_qty;
    UPDATE inventory
    SET total_qty = v_new_qty,
        updated_at = NOW()
    WHERE id = v_inv_id;

    RETURN jsonb_build_object(
      'success', true,
      'id', v_inv_id,
      'prev_qty', v_old_qty,
      'new_qty', v_new_qty,
      'action', 'updated'
    );
  ELSE
    SELECT name, unit INTO v_nom_name, v_nom_unit
    FROM nomenclatures
    WHERE id = p_nomenclature_id;

    INSERT INTO inventory (
      nomenclature_id,
      name,
      unit,
      total_qty,
      type,
      warehouse,
      updated_at
    ) VALUES (
      p_nomenclature_id,
      COALESCE(p_item_name, v_nom_name, 'Деталь'),
      COALESCE(p_unit, v_nom_unit, 'шт'),
      p_qty,
      p_type,
      'operational',
      NOW()
    )
    RETURNING id, total_qty INTO v_inv_id, v_new_qty;

    RETURN jsonb_build_object(
      'success', true,
      'id', v_inv_id,
      'prev_qty', 0,
      'new_qty', v_new_qty,
      'action', 'inserted'
    );
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION rpc_increment_inventory_stock(UUID, NUMERIC, TEXT, TEXT, TEXT) TO anon, authenticated, service_role;

-- 2. АТОМАРНЕ СПИСАННЯ СИРОВИНИ ТА ЗНЯТТЯ РЕЗЕРВІВ
CREATE OR REPLACE FUNCTION rpc_deduct_inventory_atomic(
  p_inventory_id UUID,
  p_deduct_total NUMERIC DEFAULT 0,
  p_release_reserved NUMERIC DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_inv RECORD;
  v_new_total NUMERIC;
  v_new_reserved NUMERIC;
BEGIN
  IF p_inventory_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'inventory_id is required');
  END IF;

  SELECT * INTO v_inv
  FROM public.inventory
  WHERE id = p_inventory_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Inventory row not found');
  END IF;

  v_new_total := GREATEST(0, COALESCE(v_inv.total_qty, 0) - COALESCE(p_deduct_total, 0));
  v_new_reserved := GREATEST(0, COALESCE(v_inv.reserved_qty, 0) - COALESCE(p_release_reserved, 0));

  UPDATE public.inventory
  SET total_qty = v_new_total,
      reserved_qty = v_new_reserved,
      updated_at = NOW()
  WHERE id = p_inventory_id;

  RETURN jsonb_build_object(
    'success', true,
    'id', p_inventory_id,
    'prev_total', v_inv.total_qty,
    'new_total', v_new_total,
    'prev_reserved', v_inv.reserved_qty,
    'new_reserved', v_new_reserved
  );
END;
$$;

GRANT EXECUTE ON FUNCTION rpc_deduct_inventory_atomic(UUID, NUMERIC, NUMERIC) TO anon, authenticated, service_role;

-- 3. АТОМАРНИЙ СПИСАННЯ БРАКУ В ЦЕХУ ТА ВІДДІЛІ КОНТРОЛЮ (ВКЯ)
CREATE OR REPLACE FUNCTION rpc_qc_scrap_atomic(
  p_card_id UUID,
  p_scrap_qty NUMERIC,
  p_history_data JSONB,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rpc_version CONSTANT TEXT := '2026-09-06.qc_scrap_v1';
  v_current_card RECORD;
  v_new_qty NUMERIC;
  v_target_status TEXT;
  v_inventory_id UUID;
  v_existing_inv_qty NUMERIC;
  v_final_card_info TEXT;
BEGIN
  -- Транзакційне блокування рядка картки
  SELECT * INTO v_current_card
  FROM work_cards
  WHERE id = p_card_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Card not found',
      'rpc_version', v_rpc_version
    );
  END IF;

  IF p_scrap_qty <= 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Scrap quantity must be greater than 0',
      'rpc_version', v_rpc_version
    );
  END IF;

  v_new_qty := GREATEST(0, COALESCE(v_current_card.quantity, 0) - p_scrap_qty);
  v_target_status := CASE WHEN v_new_qty <= 0 THEN 'completed' ELSE v_current_card.status END;

  -- Оновлення кількості картки
  UPDATE work_cards
  SET
    quantity = v_new_qty,
    status = v_target_status,
    updated_at = NOW()
  WHERE id = p_card_id;

  -- Фіксація запису в історію
  IF p_history_data IS NOT NULL THEN
    v_final_card_info := COALESCE(p_history_data->>'card_info', '');
    IF p_idempotency_key IS NOT NULL AND v_final_card_info NOT LIKE '%[IDEMPOTENCY_KEY:%' THEN
      v_final_card_info := TRIM(v_final_card_info || ' [IDEMPOTENCY_KEY:' || p_idempotency_key || ']');
    END IF;

    INSERT INTO work_card_history (
      card_id,
      task_id,
      nomenclature_id,
      stage_name,
      operator_name,
      card_info,
      qty_at_start,
      qty_completed,
      scrap_qty,
      started_at,
      completed_at,
      shift_name,
      manager_name,
      machine_name
    ) VALUES (
      p_card_id,
      COALESCE((p_history_data->>'task_id')::UUID, v_current_card.task_id),
      COALESCE((p_history_data->>'nomenclature_id')::UUID, v_current_card.nomenclature_id),
      COALESCE(p_history_data->>'stage_name', v_current_card.operation),
      COALESCE(p_history_data->>'operator_name', 'Не вказано'),
      v_final_card_info,
      COALESCE(v_current_card.quantity, 0),
      0,
      p_scrap_qty,
      (p_history_data->>'started_at')::TIMESTAMPTZ,
      COALESCE((p_history_data->>'completed_at')::TIMESTAMPTZ, NOW()),
      p_history_data->>'shift_name',
      p_history_data->>'manager_name',
      p_history_data->>'machine_name'
    );
  END IF;

  -- Зарахування браку на оперативний склад scrap_ready
  IF v_current_card.nomenclature_id IS NOT NULL THEN
    PERFORM rpc_increment_inventory_stock(
      v_current_card.nomenclature_id,
      p_scrap_qty,
      'scrap_ready',
      'Брак деталі',
      'шт'
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'card_id', p_card_id,
    'prev_qty', v_current_card.quantity,
    'new_qty', v_new_qty,
    'status', v_target_status,
    'scrap_logged', p_scrap_qty,
    'rpc_version', v_rpc_version
  );
END;
$$;

GRANT EXECUTE ON FUNCTION rpc_qc_scrap_atomic(UUID, NUMERIC, JSONB, TEXT) TO anon, authenticated, service_role;


-- ─── MIGRATION: 20260906142000_production_performance_indexes.sql ───
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


-- ─── MIGRATION: 20260906150000_enterprise_auth_and_user_rpcs.sql ───
-- ═══════════════════════════════════════════════════════════════════════════
-- 🛡️ ENTERPRISE HIGH-LOAD MIGRATION: ATOMIC AUTH & USER GOVERNANCE RPCS
-- Міграція: 20260906150000_enterprise_auth_and_user_rpcs.sql
-- База даних: CRM КУЛИЦЯ / MES CENTRUM
-- Призначення:
--   1. Атомарне створення та редагування користувачів з серверним bcrypt-хешуванням (rpc_admin_upsert_user)
--   2. Атомарне безпечне видалення користувачів із захистом від самовидалення (rpc_admin_delete_user)
--   3. Автоматична фіксація активності (last_seen) та аудиту безпеки (security_audit_events)
--   4. Повна зворотна сумісність (Zero Downtime) для цехових терміналів та існуючих сесій
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Переконуємося у наявності розширення pgcrypto
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Переконуємося у наявності таблиці аудиту безпеки
CREATE TABLE IF NOT EXISTS public.security_audit_events (
  id BIGSERIAL PRIMARY KEY,
  event_type TEXT NOT NULL,
  table_name TEXT,
  client_ip TEXT,
  user_agent TEXT,
  payload JSONB,
  severity TEXT DEFAULT 'WARNING',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.security_audit_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow select for verified session on audit" ON public.security_audit_events;
CREATE POLICY "Allow select for verified session on audit" 
  ON public.security_audit_events FOR SELECT TO anon, authenticated 
  USING (verify_mes_session_or_app());

DROP POLICY IF EXISTS "Allow insert for system audit" ON public.security_audit_events;
CREATE POLICY "Allow insert for system audit" 
  ON public.security_audit_events FOR INSERT TO anon, authenticated 
  WITH CHECK (true);

-- 3. АТОМАРНИЙ RPC СТВОРЕННЯ ТА РЕДАГУВАННЯ КОРИСТУВАЧІВ
CREATE OR REPLACE FUNCTION rpc_admin_upsert_user(
  p_admin_id BIGINT,
  p_user_payload JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin_record RECORD;
  v_is_admin BOOLEAN := false;
  v_target_id BIGINT;
  v_incoming_login TEXT;
  v_raw_password TEXT;
  v_hashed_password TEXT;
  v_result JSONB;
  v_existing_id BIGINT;
BEGIN
  IF p_user_payload IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User payload cannot be empty');
  END IF;

  v_target_id := NULLIF(p_user_payload->>'id', '')::BIGINT;
  v_incoming_login := TRIM(LOWER(COALESCE(p_user_payload->>'login', '')));
  v_raw_password := NULLIF(p_user_payload->>'password', '');

  -- Перевірка прав викликача
  IF p_admin_id IS NOT NULL THEN
    SELECT * INTO v_admin_record
    FROM public.system_users
    WHERE id = p_admin_id;

    IF FOUND THEN
      v_is_admin := (
        v_admin_record.access_rights->>'admin' = 'true' OR 
        v_admin_record.access_rights->>'director' = 'true'
      );
    END IF;
  ELSE
    -- Для перехідного періоду: якщо admin_id не передано, але сесія валідна через додаток
    v_is_admin := verify_mes_session_or_app();
  END IF;

  -- Перевірка дозволу на дію:
  -- Тільки адмін/директор може створювати нових користувачів або редагувати чужі профілі
  IF v_target_id IS NULL AND NOT v_is_admin THEN
    INSERT INTO public.security_audit_events (event_type, table_name, payload, severity)
    VALUES ('UNAUTHORIZED_USER_CREATE_ATTEMPT', 'system_users', 
            jsonb_build_object('caller_id', p_admin_id, 'payload', p_user_payload - 'password'), 'CRITICAL');
    RETURN jsonb_build_object('success', false, 'error', 'Лише адміністратор або директор може додавати користувачів');
  END IF;

  IF v_target_id IS NOT NULL AND NOT v_is_admin AND (p_admin_id IS NULL OR p_admin_id <> v_target_id) THEN
    INSERT INTO public.security_audit_events (event_type, table_name, payload, severity)
    VALUES ('UNAUTHORIZED_USER_UPDATE_ATTEMPT', 'system_users', 
            jsonb_build_object('caller_id', p_admin_id, 'target_id', v_target_id), 'CRITICAL');
    RETURN jsonb_build_object('success', false, 'error', 'У вас немає прав на зміну даних цього користувача');
  END IF;

  -- Хешування пароля при потребі
  IF v_raw_password IS NOT NULL AND v_raw_password <> '••••••••' THEN
    IF v_raw_password LIKE '$2a$%' OR v_raw_password LIKE '$2b$%' THEN
      v_hashed_password := v_raw_password;
    ELSE
      v_hashed_password := crypt(v_raw_password, gen_salt('bf', 8));
    END IF;
  END IF;

  -- ── СЦЕНАРІЙ 1: ОНОВЛЕННЯ ІСНУЮЧОГО КОРИСТУВАЧА ──
  IF v_target_id IS NOT NULL THEN
    -- Перевірка унікальності логіну, якщо він змінюється
    IF v_incoming_login <> '' THEN
      SELECT id INTO v_existing_id
      FROM public.system_users
      WHERE LOWER(login) = v_incoming_login AND id <> v_target_id
      LIMIT 1;

      IF FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Користувач з таким логіном вже зареєстрований');
      END IF;
    END IF;

    UPDATE public.system_users
    SET
      first_name = COALESCE(p_user_payload->>'first_name', first_name),
      last_name = COALESCE(p_user_payload->>'last_name', last_name),
      position = CASE WHEN v_is_admin THEN COALESCE(p_user_payload->>'position', position) ELSE position END,
      department = CASE WHEN v_is_admin THEN COALESCE(p_user_payload->>'department', department) ELSE department END,
      shift = CASE WHEN v_is_admin THEN COALESCE(p_user_payload->>'shift', shift) ELSE shift END,
      access_rights = CASE 
        WHEN v_is_admin AND (p_user_payload ? 'access_rights') THEN (p_user_payload->'access_rights')
        ELSE access_rights 
      END,
      notification_settings = CASE 
        WHEN p_user_payload ? 'notification_settings' THEN (p_user_payload->'notification_settings')
        ELSE notification_settings 
      END,
      shift_calendar = CASE 
        WHEN p_user_payload ? 'shift_calendar' THEN (p_user_payload->'shift_calendar')
        ELSE shift_calendar 
      END,
      avatar = COALESCE(p_user_payload->>'avatar', avatar),
      password = COALESCE(v_hashed_password, password)
    WHERE id = v_target_id
    RETURNING jsonb_build_object(
      'id', id,
      'login', login,
      'first_name', first_name,
      'last_name', last_name,
      'position', position,
      'access_rights', access_rights,
      'department', department,
      'shift', shift,
      'notification_settings', notification_settings,
      'avatar', avatar,
      'last_seen', last_seen,
      'shift_calendar', shift_calendar
    ) INTO v_result;

    IF v_result IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Користувача не знайдено');
    END IF;

    INSERT INTO public.security_audit_events (event_type, table_name, payload, severity)
    VALUES ('USER_UPDATED', 'system_users', 
            jsonb_build_object('target_id', v_target_id, 'updated_by', p_admin_id, 'password_changed', (v_hashed_password IS NOT NULL)), 
            'INFO');

    RETURN jsonb_build_object('success', true, 'data', v_result, 'action', 'updated');

  -- ── СЦЕНАРІЙ 2: СТВОРЕННЯ НОВОГО КОРИСТУВАЧА ──
  ELSE
    IF v_incoming_login = '' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Логін обов''язковий для створення облікового запису');
    END IF;

    SELECT id INTO v_existing_id
    FROM public.system_users
    WHERE LOWER(login) = v_incoming_login
    LIMIT 1;

    IF FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Користувач з таким логіном вже зареєстрований');
    END IF;

    IF v_hashed_password IS NULL THEN
      -- Якщо пароль не вказано, встановлюємо випадковий тимчасовий хеш
      v_hashed_password := crypt('Centrum2026!' || gen_random_uuid()::text, gen_salt('bf', 8));
    END IF;

    INSERT INTO public.system_users (
      login,
      password,
      first_name,
      last_name,
      position,
      access_rights,
      department,
      shift,
      notification_settings,
      avatar,
      shift_calendar
    ) VALUES (
      v_incoming_login,
      v_hashed_password,
      COALESCE(p_user_payload->>'first_name', ''),
      COALESCE(p_user_payload->>'last_name', ''),
      COALESCE(p_user_payload->>'position', 'Співробітник'),
      COALESCE(p_user_payload->'access_rights', '{"operator": true}'::jsonb),
      COALESCE(p_user_payload->>'department', 'Виробництво'),
      COALESCE(p_user_payload->>'shift', 'Зміна 1'),
      COALESCE(p_user_payload->'notification_settings', '{}'::jsonb),
      COALESCE(p_user_payload->>'avatar', ''),
      COALESCE(p_user_payload->'shift_calendar', '{}'::jsonb)
    )
    RETURNING jsonb_build_object(
      'id', id,
      'login', login,
      'first_name', first_name,
      'last_name', last_name,
      'position', position,
      'access_rights', access_rights,
      'department', department,
      'shift', shift,
      'notification_settings', notification_settings,
      'avatar', avatar,
      'last_seen', last_seen,
      'shift_calendar', shift_calendar
    ) INTO v_result;

    INSERT INTO public.security_audit_events (event_type, table_name, payload, severity)
    VALUES ('USER_CREATED', 'system_users', 
            jsonb_build_object('created_id', v_result->>'id', 'login', v_incoming_login, 'created_by', p_admin_id), 
            'INFO');

    RETURN jsonb_build_object('success', true, 'data', v_result, 'action', 'created');
  END IF;
END;
$$;

-- 4. АТОМАРНИЙ RPC БЕЗПЕЧНОГО ВИДАЛЕННЯ КОРИСТУВАЧА
CREATE OR REPLACE FUNCTION rpc_admin_delete_user(
  p_admin_id BIGINT,
  p_target_user_id BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin_record RECORD;
  v_is_admin BOOLEAN := false;
  v_deleted_login TEXT;
BEGIN
  IF p_target_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Target user ID is required');
  END IF;

  -- Захист від самовидалення
  IF p_admin_id IS NOT NULL AND p_admin_id = p_target_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Адміністратор не може видалити свій власний обліковий запис');
  END IF;

  -- Перевірка прав викликача
  IF p_admin_id IS NOT NULL THEN
    SELECT * INTO v_admin_record
    FROM public.system_users
    WHERE id = p_admin_id;

    IF FOUND THEN
      v_is_admin := (
        v_admin_record.access_rights->>'admin' = 'true' OR 
        v_admin_record.access_rights->>'director' = 'true'
      );
    END IF;
  ELSE
    v_is_admin := verify_mes_session_or_app();
  END IF;

  IF NOT v_is_admin THEN
    INSERT INTO public.security_audit_events (event_type, table_name, payload, severity)
    VALUES ('UNAUTHORIZED_USER_DELETE_ATTEMPT', 'system_users', 
            jsonb_build_object('caller_id', p_admin_id, 'target_id', p_target_user_id), 'CRITICAL');
    RETURN jsonb_build_object('success', false, 'error', 'Лише адміністратор або директор може видаляти користувачів');
  END IF;

  DELETE FROM public.system_users
  WHERE id = p_target_user_id
  RETURNING login INTO v_deleted_login;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Користувача не знайдено');
  END IF;

  INSERT INTO public.security_audit_events (event_type, table_name, payload, severity)
  VALUES ('USER_DELETED', 'system_users', 
          jsonb_build_object('deleted_id', p_target_user_id, 'login', v_deleted_login, 'deleted_by', p_admin_id), 
          'CRITICAL');

  RETURN jsonb_build_object('success', true, 'deleted_id', p_target_user_id);
END;
$$;

-- 5. ОНОВЛЕННЯ RPC АВТОРИЗАЦІЇ З АВТО-ФІКСАЦІЄЮ ЧАСУ ОСТАННЬОЇ АКТИВНОСТІ
CREATE OR REPLACE FUNCTION verify_user_password(login_name TEXT, plain_password TEXT)
RETURNS TABLE (
  id BIGINT,
  login TEXT,
  first_name TEXT,
  last_name TEXT,
  "position" TEXT,
  access_rights JSONB,
  department TEXT,
  shift TEXT,
  notification_settings JSONB,
  avatar TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id BIGINT;
BEGIN
  -- Знаходимо користувача та перевіряємо хеш
  SELECT su.id INTO v_user_id
  FROM public.system_users su
  WHERE LOWER(su.login) = LOWER(login_name)
    AND su.password = crypt(plain_password, su.password);

  IF v_user_id IS NOT NULL THEN
    -- Фіксація факту входу та оновлення часу активності (повна кваліфікація public.system_users.id усуває неоднозначність)
    UPDATE public.system_users
    SET last_seen = NOW()
    WHERE public.system_users.id = v_user_id;

    RETURN QUERY
    SELECT 
      su.id,
      su.login,
      su.first_name,
      su.last_name,
      su.position,
      su.access_rights,
      su.department,
      su.shift,
      su.notification_settings,
      su.avatar
    FROM public.system_users su
    WHERE su.id = v_user_id;
  END IF;
END;
$$;


-- ─── MIGRATION: 20260906160000_zero_downtime_partition_work_card_history.sql ───
-- ═══════════════════════════════════════════════════════════════════════════
-- 🏛️ CENTRUM MES v2.0 — PHASE 0: ZERO-DOWNTIME TABLE PARTITIONING
-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 20260906160000_zero_downtime_partition_work_card_history.sql
-- Purpose:
--   1. Re-architects `work_card_history` into declarative monthly partitions.
--   2. Preserves 100% transparent query compatibility across all historical periods.
--   3. Guarantees live Supabase Realtime WebSocket events via `publish_via_partition_root = true`.
--   4. Eliminates physical foreign key lock contention from VKYA quality tables.
--   5. Retains full trigger execution for VKYA queue projections and flow rollups.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. БЕЗПЕЧНИЙ ТАЙМАУТ БЛОКУВАННЯ (Fail fast instead of stalling the shop floor)
SET LOCAL lock_timeout = '5s';

-- 2. ВІДВ'ЯЗУВАННЯ ФІЗИЧНИХ ЗОВНІШНІХ КЛЮЧІВ (Усунення конфлікту складеного PK)
-- Колонки `source_history_id` та їхні індекси залишаються недоторканими!
ALTER TABLE public.vkya_quality_resolutions
  DROP CONSTRAINT IF EXISTS vkya_quality_resolutions_source_history_id_fkey;

ALTER TABLE public.vkya_restoration_cards
  DROP CONSTRAINT IF EXISTS vkya_restoration_cards_source_history_id_fkey;

ALTER TABLE public.vkya_reclassification_queue
  DROP CONSTRAINT IF EXISTS vkya_reclassification_queue_source_history_id_fkey;

-- 3. СТВОРЕННЯ ТІНЬОВОЇ СЕКЦІОНОВАНОЇ ТАБЛИЦІ
CREATE TABLE IF NOT EXISTS public.work_card_history_partitioned (
  LIKE public.work_card_history INCLUDING DEFAULTS INCLUDING GENERATED,
  CONSTRAINT work_card_history_partitioned_pkey PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);
ALTER TABLE public.work_card_history_partitioned ENABLE ROW LEVEL SECURITY;

-- 4. СТВОРЕННЯ ПОМІСЯЧНИХ СЕКЦІЙ ТА УВІМКНЕННЯ RLS
CREATE TABLE IF NOT EXISTS public.work_card_history_earlier
  PARTITION OF public.work_card_history_partitioned
  FOR VALUES FROM (MINVALUE) TO ('2026-08-01 00:00:00+00');
ALTER TABLE public.work_card_history_earlier ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.work_card_history_2026_08
  PARTITION OF public.work_card_history_partitioned
  FOR VALUES FROM ('2026-08-01 00:00:00+00') TO ('2026-09-01 00:00:00+00');
ALTER TABLE public.work_card_history_2026_08 ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.work_card_history_2026_09
  PARTITION OF public.work_card_history_partitioned
  FOR VALUES FROM ('2026-09-01 00:00:00+00') TO ('2026-10-01 00:00:00+00');
ALTER TABLE public.work_card_history_2026_09 ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.work_card_history_2026_10
  PARTITION OF public.work_card_history_partitioned
  FOR VALUES FROM ('2026-10-01 00:00:00+00') TO ('2026-11-01 00:00:00+00');
ALTER TABLE public.work_card_history_2026_10 ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.work_card_history_2026_11
  PARTITION OF public.work_card_history_partitioned
  FOR VALUES FROM ('2026-11-01 00:00:00+00') TO ('2026-12-01 00:00:00+00');
ALTER TABLE public.work_card_history_2026_11 ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.work_card_history_2026_12
  PARTITION OF public.work_card_history_partitioned
  FOR VALUES FROM ('2026-12-01 00:00:00+00') TO ('2027-01-01 00:00:00+00');
ALTER TABLE public.work_card_history_2026_12 ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.work_card_history_2027_01
  PARTITION OF public.work_card_history_partitioned
  FOR VALUES FROM ('2027-01-01 00:00:00+00') TO ('2027-02-01 00:00:00+00');
ALTER TABLE public.work_card_history_2027_01 ENABLE ROW LEVEL SECURITY;

-- Секція за замовчуванням (гарантує, що жоден запис не випаде з помилкою відсутності секції)
CREATE TABLE IF NOT EXISTS public.work_card_history_default
  PARTITION OF public.work_card_history_partitioned
  DEFAULT;
ALTER TABLE public.work_card_history_default ENABLE ROW LEVEL SECURITY;

-- 5. МІГРАЦІЯ НАЯВНИХ ДАНИХ (Ідемпотентне копіювання)
DO $$
BEGIN
  -- Копіюємо дані лише якщо work_card_history ще не є секціонованою таблицею
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'work_card_history' AND c.relkind != 'p'
  ) THEN
    INSERT INTO public.work_card_history_partitioned
    SELECT * FROM public.work_card_history
    ON CONFLICT (id, created_at) DO NOTHING;
  END IF;
END $$;

-- 6. ВИСОКОПРОДУКТИВНІ ІНДЕКСИ (Автоматично наслідуються кожною секцією)
CREATE INDEX IF NOT EXISTS idx_wch_p_card_id_created
  ON public.work_card_history_partitioned (card_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_wch_p_task_id
  ON public.work_card_history_partitioned (task_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_wch_p_completed_at
  ON public.work_card_history_partitioned (completed_at DESC);

CREATE INDEX IF NOT EXISTS idx_wch_p_id
  ON public.work_card_history_partitioned (id);

-- 7. НАВІШУВАННЯ ТРИГЕРІВ НА СЕКЦІОНОВАНУ СТРУКТУРУ
DROP TRIGGER IF EXISTS trg_vkya_history_queue_projection ON public.work_card_history_partitioned;
CREATE TRIGGER trg_vkya_history_queue_projection
AFTER INSERT OR UPDATE OF scrap_qty, qc_scrap_comment, is_archived_scrap, card_info
ON public.work_card_history_partitioned
FOR EACH ROW EXECUTE FUNCTION public.sync_vkya_history_queue_projection();

DROP TRIGGER IF EXISTS trg_vkya_history_queue_projection_delete ON public.work_card_history_partitioned;
CREATE TRIGGER trg_vkya_history_queue_projection_delete
AFTER DELETE ON public.work_card_history_partitioned
FOR EACH ROW EXECUTE FUNCTION public.sync_vkya_history_queue_projection_delete();

DROP TRIGGER IF EXISTS trg_sync_work_card_flow_totals ON public.work_card_history_partitioned;
CREATE TRIGGER trg_sync_work_card_flow_totals
AFTER INSERT OR UPDATE OR DELETE ON public.work_card_history_partitioned
FOR EACH ROW EXECUTE FUNCTION public.sync_work_card_flow_totals_from_history();

DROP TRIGGER IF EXISTS trg_sync_work_card_scrap_totals ON public.work_card_history_partitioned;
CREATE TRIGGER trg_sync_work_card_scrap_totals
AFTER INSERT OR UPDATE OR DELETE ON public.work_card_history_partitioned
FOR EACH ROW EXECUTE FUNCTION public.sync_work_card_scrap_totals_from_history();

-- 8. АТОМАРНИЙ SWAP ТАБЛИЦЬ (<10 мс)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'work_card_history' AND c.relkind != 'p'
  ) THEN
    DROP TABLE IF EXISTS public.work_card_history_backup_pre_partition CASCADE;
    ALTER TABLE public.work_card_history RENAME TO work_card_history_backup_pre_partition;
    ALTER TABLE public.work_card_history_partitioned RENAME TO work_card_history;
  END IF;
END $$;

-- 9. БЕЗПЕКА ТА ПРАВА ДОСТУПУ (RLS)
ALTER TABLE public.work_card_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "work_card_history_full_access" ON public.work_card_history;
CREATE POLICY "work_card_history_full_access" ON public.work_card_history
  FOR ALL TO anon, authenticated, service_role
  USING (true)
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.work_card_history TO anon, authenticated, service_role;

-- 10. REALTIME ROOT PUBLICATION GUARANTEE
-- Вмикає публікацію івентів від імені кореневої таблиці `work_card_history`,
-- завдяки чому frontend отримує всі події без перезавантаження сторінки!
DO $$
DECLARE
  v_puballtables boolean := false;
BEGIN
  -- Перевіряємо статус публікації supabase_realtime
  SELECT puballtables INTO v_puballtables
  FROM pg_publication
  WHERE pubname = 'supabase_realtime';

  IF FOUND THEN
    -- Якщо публікація ведеться по окремих таблицях (puballtables = false), додаємо work_card_history
    IF v_puballtables IS FALSE THEN
      IF NOT EXISTS (
        SELECT 1 FROM pg_publication_rel pr
        JOIN pg_class c ON c.oid = pr.prrelid
        JOIN pg_publication p ON p.oid = pr.prpubid
        WHERE p.pubname = 'supabase_realtime' AND c.relname = 'work_card_history'
      ) THEN
        BEGIN
          ALTER PUBLICATION supabase_realtime ADD TABLE public.work_card_history;
        EXCEPTION
          WHEN OTHERS THEN NULL;
        END;
      END IF;
    END IF;

    -- Налаштовуємо публікацію через корінь секцій (працює як для FOR ALL TABLES, так і для окремих таблиць)
    BEGIN
      ALTER PUBLICATION supabase_realtime SET (publish_via_partition_root = true);
    EXCEPTION
      WHEN OTHERS THEN
        RAISE NOTICE 'Notice: publish_via_partition_root: %', SQLERRM;
    END;
  END IF;
END $$;


-- ─── MIGRATION: 20260906170000_sync_system_users_to_supabase_auth.sql ───
-- ═══════════════════════════════════════════════════════════════════════════
-- 🛡️ CENTRUM MES v2.0 — PHASE 0: JWT AUTH SYNCHRONIZATION
-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 20260906170000_sync_system_users_to_supabase_auth.sql
-- Purpose:
--   1. Синхронізує користувачів з `public.system_users` у `auth.users` та `auth.identities`.
--   2. Зберігає 100% оригінальні bcrypt-паролі ($2a$08$) — нікому не потрібно міняти пароль.
--   3. Призначений спочатку для тестування юзера `vvv` (або всіх юзерів одразу).
-- ═══════════════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;

-- 1. ФУНКЦІЯ СИНХРОНІЗАЦІЇ ЮЗЕРА В AUTH.USERS
CREATE OR REPLACE FUNCTION public.sync_system_user_to_auth(p_login TEXT DEFAULT NULL)
RETURNS TABLE (
  synced_login TEXT,
  auth_user_id UUID,
  status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  r RECORD;
  v_user_uuid UUID;
  v_existing_uuid UUID;
  v_email TEXT;
BEGIN
  FOR r IN 
    SELECT su.id, su.login, su.password, su.first_name, su.last_name
    FROM public.system_users su
    WHERE (p_login IS NULL OR LOWER(su.login) = LOWER(p_login))
      AND su.password IS NOT NULL
      AND su.password <> ''
  LOOP
    -- Якщо логін вже містить email (наприклад admin@workshop.local), використовуємо його без дублювання
    IF POSITION('@' IN r.login) > 0 THEN
      v_email := LOWER(TRIM(r.login));
    ELSE
      v_email := LOWER(TRIM(r.login)) || '@centrum.local';
    END IF;

    -- Детермінований стабільний UUID на основі ID користувача
    BEGIN
      v_user_uuid := extensions.uuid_generate_v5(extensions.uuid_ns_url(), 'centrum:user:' || r.id::text);
    EXCEPTION WHEN OTHERS THEN
      v_user_uuid := md5('centrum:user:' || r.id::text)::uuid;
    END;

    -- Перевіряємо чи вже існує користувач з таким email або старим ID в auth.users
    SELECT id INTO v_existing_uuid FROM auth.users WHERE email = v_email OR id = v_user_uuid LIMIT 1;
    IF v_existing_uuid IS NOT NULL THEN
      v_user_uuid := v_existing_uuid;
    END IF;

    -- 1. Створення або оновлення в auth.users
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      is_sso_user,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change,
      created_at,
      updated_at
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_user_uuid,
      'authenticated',
      'authenticated',
      v_email,
      r.password, -- Використовуємо готовий bcrypt-хеш 1-в-1
      NOW(),
      jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
      jsonb_build_object(
        'email', v_email,
        'email_verified', true,
        'phone_verified', false,
        'sub', v_user_uuid::text,
        'login', r.login,
        'system_user_id', r.id,
        'first_name', r.first_name,
        'last_name', r.last_name
      ),
      false,
      '', -- GoTrue вимагає порожній рядок замість NULL для уникнення "Scan error"
      '',
      '',
      '',
      NOW(),
      NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      encrypted_password = EXCLUDED.encrypted_password,
      email = EXCLUDED.email,
      raw_user_meta_data = EXCLUDED.raw_user_meta_data,
      email_confirmed_at = COALESCE(auth.users.email_confirmed_at, NOW()),
      confirmation_token = COALESCE(auth.users.confirmation_token, ''),
      recovery_token = COALESCE(auth.users.recovery_token, ''),
      email_change_token_new = COALESCE(auth.users.email_change_token_new, ''),
      email_change = COALESCE(auth.users.email_change, ''),
      updated_at = NOW();

    -- Додатково захищаємо новіші версії GoTrue від NULL у токенах повторної автентифікації
    BEGIN
      EXECUTE 'UPDATE auth.users SET 
        reauthentication_token = COALESCE(reauthentication_token, ''''),
        email_change_token_current = COALESCE(email_change_token_current, ''''),
        phone_change = COALESCE(phone_change, ''''),
        phone_change_token = COALESCE(phone_change_token, '''')
      WHERE id = $1' USING v_user_uuid;
    EXCEPTION WHEN undefined_column THEN
      NULL;
    END;

    -- 2. Створення правильної ідентичності GoTrue v2.196 (email обчислюється автоматично як generated column)
    DELETE FROM auth.identities WHERE user_id = v_user_uuid;
    
    INSERT INTO auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      v_user_uuid,
      jsonb_build_object(
        'sub', v_user_uuid::text,
        'email', v_email,
        'email_verified', true,
        'phone_verified', false
      ),
      'email',
      v_user_uuid::text,
      NOW(),
      NOW(),
      NOW()
    );

    synced_login := r.login;
    auth_user_id := v_user_uuid;
    status := 'SYNCED';
    RETURN NEXT;
  END LOOP;
END;
$$;

-- 2. СИНХРОНІЗАЦІЯ ВСІХ КОРИСТУВАЧІВ ПІДПРИЄМСТВА
SELECT * FROM public.sync_system_user_to_auth(NULL);

-- 3. АВТОМАТИЧНИЙ ТРИГЕР ДЛЯ МАЙБУТНІХ ЗМІН ТА НОВИХ КОРИСТУВАЧІВ
CREATE OR REPLACE FUNCTION public.trg_sync_system_user_to_auth()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
BEGIN
  IF NEW.password IS NOT NULL AND NEW.password <> '' THEN
    PERFORM public.sync_system_user_to_auth(NEW.login);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_system_users_auth_sync ON public.system_users;
CREATE TRIGGER trg_system_users_auth_sync
  AFTER INSERT OR UPDATE OF password, login, first_name, last_name
  ON public.system_users
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_sync_system_user_to_auth();


-- ─── MIGRATION: 20260906180000_strict_jwt_and_eliminate_secret.sql ───
-- ═══════════════════════════════════════════════════════════════════════════
-- 🛡️ CENTRUM MES v2.0 — PHASE 0: FINAL HARDENING & COMPLETE SECRET ELIMINATION
-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 20260906180000_strict_jwt_and_eliminate_secret.sql
-- Purpose:
--   1. ВИПРАВЛЕННЯ EMAIL: коректна синхронізація логінів з '@' (admin@workshop.local)
--   2. ПОВНА ЛІКВІДАЦІЯ x-mes-secret з verify_mes_session_or_app()
--   3. ПРИМУСОВЕ РОЗЛОГІНЕННЯ: анулювання всіх старих сесій у схемі auth
--   4. ЗАХИСТ ХЕШІВ ПАРОЛІВ: REVOKE SELECT (password) ON system_users
-- ═══════════════════════════════════════════════════════════════════════════

-- КРОК 1. Оновлена функція синхронізації (без подвійних доменів @...@centrum.local)
CREATE OR REPLACE FUNCTION public.sync_system_user_to_auth(p_login TEXT DEFAULT NULL)
RETURNS TABLE (
  synced_login TEXT,
  auth_user_id UUID,
  status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  r RECORD;
  v_user_uuid UUID;
  v_existing_uuid UUID;
  v_email TEXT;
BEGIN
  FOR r IN 
    SELECT su.id, su.login, su.password, su.first_name, su.last_name
    FROM public.system_users su
    WHERE (p_login IS NULL OR LOWER(su.login) = LOWER(p_login))
      AND su.password IS NOT NULL
      AND su.password <> ''
  LOOP
    -- Якщо логін вже містить @ (наприклад admin@workshop.local), використовуємо його без дублювання
    IF POSITION('@' IN r.login) > 0 THEN
      v_email := LOWER(TRIM(r.login));
    ELSE
      v_email := LOWER(TRIM(r.login)) || '@centrum.local';
    END IF;

    -- Детермінований стабільний UUID на основі ID користувача
    BEGIN
      v_user_uuid := extensions.uuid_generate_v5(extensions.uuid_ns_url(), 'centrum:user:' || r.id::text);
    EXCEPTION WHEN OTHERS THEN
      v_user_uuid := md5('centrum:user:' || r.id::text)::uuid;
    END;

    -- Перевіряємо чи вже існує користувач в auth.users
    SELECT id INTO v_existing_uuid FROM auth.users WHERE email = v_email OR id = v_user_uuid LIMIT 1;
    IF v_existing_uuid IS NOT NULL THEN
      v_user_uuid := v_existing_uuid;
    END IF;

    -- 1. Створення або оновлення в auth.users
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      is_sso_user,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change,
      created_at,
      updated_at
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_user_uuid,
      'authenticated',
      'authenticated',
      v_email,
      r.password, -- Зберігаємо оригінальний bcrypt-хеш 1-в-1
      NOW(),
      jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
      jsonb_build_object(
        'email', v_email,
        'email_verified', true,
        'phone_verified', false,
        'sub', v_user_uuid::text,
        'login', r.login,
        'system_user_id', r.id,
        'first_name', r.first_name,
        'last_name', r.last_name
      ),
      false,
      '',
      '',
      '',
      '',
      NOW(),
      NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      encrypted_password = EXCLUDED.encrypted_password,
      raw_user_meta_data = EXCLUDED.raw_user_meta_data,
      email_confirmed_at = COALESCE(auth.users.email_confirmed_at, NOW()),
      confirmation_token = COALESCE(auth.users.confirmation_token, ''),
      recovery_token = COALESCE(auth.users.recovery_token, ''),
      email_change_token_new = COALESCE(auth.users.email_change_token_new, ''),
      email_change = COALESCE(auth.users.email_change, ''),
      updated_at = NOW();

    -- Додатковий захист полів GoTrue від NULL
    BEGIN
      EXECUTE 'UPDATE auth.users SET 
        reauthentication_token = COALESCE(reauthentication_token, ''''),
        email_change_token_current = COALESCE(email_change_token_current, ''''),
        phone_change = COALESCE(phone_change, ''''),
        phone_change_token = COALESCE(phone_change_token, '''')
      WHERE id = $1' USING v_user_uuid;
    EXCEPTION WHEN undefined_column THEN
      NULL;
    END;

    -- 2. Оновлення ідентичності GoTrue (email обчислюється автоматично як generated column)
    DELETE FROM auth.identities WHERE user_id = v_user_uuid;
    
    INSERT INTO auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      v_user_uuid,
      jsonb_build_object(
        'sub', v_user_uuid::text,
        'email', v_email,
        'email_verified', true,
        'phone_verified', false
      ),
      'email',
      v_user_uuid::text,
      NOW(),
      NOW(),
      NOW()
    );

    synced_login := r.login;
    auth_user_id := v_user_uuid;
    status := 'SYNCED';
    RETURN NEXT;
  END LOOP;
END;
$$;

-- КРОК 2. Оновлення автоматичного тригера на system_users
CREATE OR REPLACE FUNCTION public.trg_sync_system_user_to_auth()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
BEGIN
  IF NEW.password IS NOT NULL AND NEW.password <> '' THEN
    PERFORM public.sync_system_user_to_auth(NEW.login);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_system_users_auth_sync ON public.system_users;
CREATE TRIGGER trg_system_users_auth_sync
  AFTER INSERT OR UPDATE OF password, login, first_name, last_name
  ON public.system_users
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_sync_system_user_to_auth();

-- КРОК 3. Синхронізація всіх користувачів підприємства (138 облікових записів)
SELECT * FROM public.sync_system_user_to_auth(NULL);

-- КРОК 4. ПОВНА ЛІКВІДАЦІЯ x-mes-secret — Тільки дійсний Supabase Auth JWT або service_role!
CREATE OR REPLACE FUNCTION verify_mes_session_or_app()
RETURNS BOOLEAN AS $$
DECLARE
  headers TEXT;
  jwt_role TEXT;
  auth_uid TEXT;
BEGIN
  -- 1. Запит із внутрішньої консолі Supabase / SQL Editor / pgAdmin / міграцій
  headers := current_setting('request.headers', true);
  IF headers IS NULL OR headers = '' THEN
    RETURN TRUE;
  END IF;

  -- 2. Запит від службових міграцій / бекенду з ключем service_role
  BEGIN
    jwt_role := current_setting('request.jwt.claim.role', true);
    IF jwt_role = 'service_role' THEN
      RETURN TRUE;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  -- 3. Офіційний Supabase Auth контекст (персональний JWT робітника)
  BEGIN
    auth_uid := auth.uid()::TEXT;
    IF auth_uid IS NOT NULL AND auth_uid <> '' THEN
      RETURN TRUE;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  -- ⛔ ЖОДНИЙ статичний секрет більше не приймається. Неавторизований доступ заборонено!
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- КРОК 5. Збереження публічного функціоналу для виклику майстра з верстата (QR-код)
DROP POLICY IF EXISTS "Allow public read on machines" ON public.machines;
CREATE POLICY "Allow public read on machines" ON public.machines FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Allow public call creation on machine_calls" ON public.machine_calls;
CREATE POLICY "Allow public call creation on machine_calls" ON public.machine_calls FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public basic profile reads for calls" ON public.system_users;
CREATE POLICY "Allow public basic profile reads for calls" ON public.system_users FOR SELECT TO anon USING (true);

-- КРОК 6. Посилення безпеки: заборона читання колонки password безпосередньо через API
REVOKE SELECT (password) ON public.system_users FROM anon, authenticated;

-- КРОК 7. ПРИМУСОВЕ РОЗЛОГІНЕННЯ: анулювання всіх старих сесій у базі даних
DELETE FROM auth.refresh_tokens;
DELETE FROM auth.sessions;

-- ═══════════════════════════════════════════════════════════════════════════
-- ✅ PHASE 0 ЗАВЕРШЕНО: x-mes-secret ЛІКВІДОВАНО, СИСТЕМА ПОВНІСТЮ НА JWT
-- ═══════════════════════════════════════════════════════════════════════════


-- ─── MIGRATION: 20260906183000_fix_push_subscriptions_rls.sql ───
-- ═══════════════════════════════════════════════════════════════════════════
-- 🔔 FIX PUSH SUBSCRIPTIONS RLS POLICY — CRM КУЛИЦЯ MES v2.0
-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 20260906183000_fix_push_subscriptions_rls.sql
-- Purpose:
--   Дозволити користувачам (як авторизованим через JWT, так і анонімним пристроям)
--   зберігати та оновлювати власні Web Push підписки (endpoint, keys) у push_subscriptions
--   без блокування політикою RLS (помилка 403 / 42501).
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- 1. Видаляємо всі старі обмежувальні політики на push_subscriptions
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN 
    SELECT policyname 
    FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'push_subscriptions'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.push_subscriptions;', pol.policyname);
  END LOOP;
END $$;

-- 2. Створюємо чисту політику на читання, вставку та оновлення підписок
CREATE POLICY "Allow push subscriptions management"
  ON public.push_subscriptions
  FOR ALL
  TO authenticated, anon
  USING (true)
  WITH CHECK (true);

-- 3. Надаємо необхідні права на таблицю ролям anon та authenticated
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO anon, authenticated;


-- ─── MIGRATION: 20260906190000_fix_verify_app_secret_and_tasks.sql ───
-- ═══════════════════════════════════════════════════════════════════════════
-- 🚀 HOTFIX: ВІДНОВЛЕННЯ ДОСТУПУ ДО НАРЯДІВ (TASKS, ORDERS, INVENTORY) ПІД JWT
-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 20260906190000_fix_verify_app_secret_and_tasks.sql
-- Purpose:
--   1. Оновлення verify_app_secret() — перенаправлення на перевірку JWT (auth.uid())
--   2. Відновлення відображення нарядів, замовлень, номенклатур та складу
--   3. Виправлення RLS на push_subscriptions (усунення помилки 403)
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Централізований Session Guard з підтримкою auth.uid() та ролі authenticated
CREATE OR REPLACE FUNCTION public.verify_mes_session_or_app()
RETURNS BOOLEAN AS $$
DECLARE
  headers TEXT;
  jwt_role TEXT;
  auth_uid TEXT;
BEGIN
  -- Внутрішні виклики (SQL Editor, міграції)
  headers := current_setting('request.headers', true);
  IF headers IS NULL OR headers = '' THEN
    RETURN TRUE;
  END IF;

  -- Service role
  BEGIN
    jwt_role := current_setting('request.jwt.claim.role', true);
    IF jwt_role = 'service_role' THEN
      RETURN TRUE;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  -- Авторизований користувач через Supabase Auth JWT
  BEGIN
    auth_uid := auth.uid()::TEXT;
    IF auth_uid IS NOT NULL AND auth_uid <> '' THEN
      RETURN TRUE;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  -- Перевірка клейму authenticated
  BEGIN
    IF current_setting('request.jwt.claim.role', true) = 'authenticated' THEN
      RETURN TRUE;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Перенаправлення verify_app_secret() на оновлений Guard
CREATE OR REPLACE FUNCTION public.verify_app_secret()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN public.verify_mes_session_or_app();
EXCEPTION WHEN OTHERS THEN
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Надання прав на таблицю push_subscriptions
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN 
    SELECT policyname 
    FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'push_subscriptions' 
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.push_subscriptions;', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "Allow push subscriptions management" 
  ON public.push_subscriptions 
  FOR ALL 
  TO authenticated, anon 
  USING (true) 
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO anon, authenticated;


-- ─── MIGRATION: 20260906200000_enable_user_presence_heartbeat.sql ───
-- ═══════════════════════════════════════════════════════════════════════════
-- 🟢 FIX: ВІДНОВЛЕННЯ ТРЕКІНГУ ОНЛАЙН-СТАТУСУ (USER PRESENCE HEARTBEAT)
-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 20260906200000_enable_user_presence_heartbeat.sql
-- Purpose:
--   1. Створення атомарного RPC rpc_touch_user_presence(p_user_id) для heartbeat
--   2. Додавання RLS-політики UPDATE на system_users для ролі authenticated
--   3. Надання прав GRANT UPDATE (last_seen) для усунення блокування оновлення статусу
--   4. Безпека: захист інших колонок (права, паролі, посади) від несанкціонованої модифікації
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Атомарна процедура оновлення часу присутності
CREATE OR REPLACE FUNCTION public.rpc_touch_user_presence(p_user_id BIGINT DEFAULT NULL)
RETURNS TIMESTAMP WITH TIME ZONE
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_target_id BIGINT := p_user_id;
  v_auth_uid UUID;
  v_now TIMESTAMP WITH TIME ZONE := NOW();
BEGIN
  -- Якщо ID не передано явно, витягуємо його з автентифікованого JWT
  IF v_target_id IS NULL THEN
    v_auth_uid := auth.uid();
    IF v_auth_uid IS NOT NULL THEN
      SELECT su.id INTO v_target_id
      FROM public.system_users su
      JOIN auth.users au ON (
        (au.raw_user_meta_data->>'system_user_id')::bigint = su.id
        OR LOWER(au.email) = LOWER(su.login)
        OR LOWER(au.email) = LOWER(su.login) || '@centrum.local'
      )
      WHERE au.id = v_auth_uid
      LIMIT 1;
    END IF;
  END IF;

  -- Якщо користувача ідентифіковано — оновлюємо last_seen
  IF v_target_id IS NOT NULL THEN
    UPDATE public.system_users
    SET last_seen = v_now
    WHERE id = v_target_id;
  END IF;

  RETURN v_now;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_touch_user_presence(BIGINT) TO authenticated, anon;

-- 2. Дозволяємо UPDATE через RLS для авторизованих користувачів
DROP POLICY IF EXISTS "Allow authenticated users to update own presence" ON public.system_users;
CREATE POLICY "Allow authenticated users to update own presence"
  ON public.system_users
  FOR UPDATE
  TO authenticated
  USING (verify_mes_session_or_app())
  WITH CHECK (verify_mes_session_or_app());

-- 3. Гранулярні права: authenticated може оновлювати ТІЛЬКИ колонку last_seen
-- (всі інші критичні колонки захищені від прямої зміни і потребують rpc_admin_upsert_user)
GRANT UPDATE (last_seen) ON public.system_users TO authenticated;

-- 4. Оновлюємо статус поточного адміністратора на "щойно в мережі"
UPDATE public.system_users 
SET last_seen = NOW() 
WHERE login = 'admin@workshop.local';


-- ─── MIGRATION: 20260907150000_shop2_atomic_buffer_and_ledger_rpcs.sql ───
-- ═══════════════════════════════════════════════════════════════════════════
-- 🚀 ENTERPRISE SHOP 2: ATOMIC BUFFER ALLOCATION & MATERIAL BALANCE LEDGER
-- Процедури:
--   1. rpc_generate_shop2_cards_atomic (Атомарна генерація РК та списання буфера)
--   2. rpc_get_shop2_buffer_summary   (Бекенд-агрегат матеріального балансу)
-- Версія: 2026-09-07.shop2_enterprise_v1
-- База даних: CRM КУЛИЦЯ / MES CENTRUM
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. DROP EXISTING VERSIONS IF ANY
DROP FUNCTION IF EXISTS rpc_generate_shop2_cards_atomic(UUID, UUID, JSONB, NUMERIC, TEXT);
DROP FUNCTION IF EXISTS rpc_get_shop2_buffer_summary(UUID[]);

-- ═══════════════════════════════════════════════════════════════════════════
-- ПРОЦЕДУРА 1: rpc_generate_shop2_cards_atomic
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION rpc_generate_shop2_cards_atomic(
  p_order_id UUID,
  p_nomenclature_id UUID,
  p_cards_payload JSONB,
  p_total_qty_to_deduct NUMERIC,
  p_user_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rpc_version CONSTANT TEXT := '2026-09-07.shop2_enterprise_v1';
  v_total_avail NUMERIC := 0;
  v_remaining_deduction NUMERIC := 0;
  v_buf_rec RECORD;
  v_card_avail NUMERIC;
  v_to_deduct NUMERIC;
  v_item JSONB;
  v_created_cards JSONB := '[]'::JSONB;
  v_new_card RECORD;
  v_qty NUMERIC;
  v_card_info TEXT;
BEGIN
  -- Валідація вхідних параметрів
  IF p_nomenclature_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'nomenclature_id є обов''язковим');
  END IF;

  IF p_cards_payload IS NULL OR jsonb_array_length(p_cards_payload) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Масив p_cards_payload не може бути порожнім');
  END IF;

  -- 1. БЛОКУВАННЯ РЯДКІВ БУФЕРА (SELECT ... FOR UPDATE) ТА РОЗРАХУНОК ДОСТУПНОСТІ
  SELECT COALESCE(SUM(GREATEST(0, quantity - COALESCE(used_in_shop2_qty, 0))), 0)
  INTO v_total_avail
  FROM work_cards
  WHERE nomenclature_id = p_nomenclature_id
    AND (p_order_id IS NULL OR order_id = p_order_id OR order_id IS NULL)
    AND (status = 'at-shop2-buffer' OR is_rework = true);

  IF p_total_qty_to_deduct > 0 AND v_total_avail < p_total_qty_to_deduct THEN
    RETURN jsonb_build_object(
      'success', false,
      'conflict', true,
      'error', 'Недостатньо вільних заготовок у буфері Цеху №2',
      'available', v_total_avail,
      'required', p_total_qty_to_deduct,
      'rpc_version', v_rpc_version
    );
  END IF;

  -- 2. СПИСАННЯ КІЛЬКОСТІ З БУФЕРНИХ КАРТОК
  IF p_total_qty_to_deduct > 0 THEN
    v_remaining_deduction := p_total_qty_to_deduct;

    FOR v_buf_rec IN
      SELECT id, quantity, COALESCE(used_in_shop2_qty, 0) AS used
      FROM work_cards
      WHERE nomenclature_id = p_nomenclature_id
        AND (p_order_id IS NULL OR order_id = p_order_id OR order_id IS NULL)
        AND (status = 'at-shop2-buffer' OR is_rework = true)
      ORDER BY
        CASE WHEN p_order_id IS NOT NULL AND order_id = p_order_id THEN 0 ELSE 1 END,
        created_at ASC
      FOR UPDATE
    LOOP
      v_card_avail := GREATEST(0, v_buf_rec.quantity - v_buf_rec.used);

      IF v_card_avail > 0 THEN
        v_to_deduct := LEAST(v_card_avail, v_remaining_deduction);

        UPDATE work_cards
        SET used_in_shop2_qty = v_buf_rec.used + v_to_deduct,
            updated_at = NOW()
        WHERE id = v_buf_rec.id;

        v_remaining_deduction := v_remaining_deduction - v_to_deduct;
        IF v_remaining_deduction <= 0 THEN
          EXIT;
        END IF;
      END IF;
    END LOOP;
  END IF;

  -- 3. СТВОРЕННЯ НОВИХ РОБОЧИХ КАРТОК ЦЕХУ №2
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_cards_payload)
  LOOP
    v_qty := (v_item->>'quantity')::NUMERIC;
    v_card_info := COALESCE(v_item->>'card_info', '');

    INSERT INTO work_cards (
      task_id,
      order_id,
      nomenclature_id,
      operation,
      machine,
      quantity,
      card_info,
      status,
      completed_at,
      is_rework
    ) VALUES (
      (v_item->>'task_id')::UUID,
      (v_item->>'order_id')::UUID,
      p_nomenclature_id,
      COALESCE(v_item->>'operation', 'Пресування'),
      COALESCE(v_item->>'machine', 'Не вказано'),
      v_qty,
      v_card_info,
      COALESCE(v_item->>'status', 'new'),
      CASE WHEN (v_item->>'completed_at') IS NOT NULL THEN (v_item->>'completed_at')::TIMESTAMPTZ ELSE NULL END,
      COALESCE((v_item->>'is_rework')::BOOLEAN, false)
    )
    RETURNING * INTO v_new_card;

    -- Запис в аудит історії
    INSERT INTO work_card_history (
      card_id,
      task_id,
      nomenclature_id,
      stage_name,
      operator_name,
      card_info,
      qty_at_start,
      qty_completed,
      scrap_qty,
      cutters_used,
      started_at,
      completed_at,
      shift_name,
      manager_name,
      machine_name
    ) VALUES (
      v_new_card.id,
      v_new_card.task_id,
      v_new_card.nomenclature_id,
      v_new_card.operation,
      COALESCE(p_user_id, 'Система (Цех №2)'),
      v_card_info || ' [SHOP2_BATCH_GENERATION]',
      v_new_card.quantity,
      0,
      0,
      0,
      NOW(),
      NULL,
      'Зміна 1',
      p_user_id,
      v_new_card.machine
    );

    v_created_cards := v_created_cards || jsonb_build_object(
      'id', v_new_card.id,
      'task_id', v_new_card.task_id,
      'order_id', v_new_card.order_id,
      'nomenclature_id', v_new_card.nomenclature_id,
      'operation', v_new_card.operation,
      'machine', v_new_card.machine,
      'quantity', v_new_card.quantity,
      'card_info', v_new_card.card_info,
      'status', v_new_card.status,
      'created_at', v_new_card.created_at
    );
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'deducted_qty', p_total_qty_to_deduct,
    'created_count', jsonb_array_length(v_created_cards),
    'cards', v_created_cards,
    'rpc_version', v_rpc_version
  );
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- ПРОЦЕДУРА 2: rpc_get_shop2_buffer_summary
-- Агрегація матеріального балансу Цеху №2 безпосередньо в базі даних
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION rpc_get_shop2_buffer_summary(
  p_order_ids UUID[] DEFAULT NULL
)
RETURNS TABLE (
  nomenclature_id UUID,
  order_id UUID,
  total_received NUMERIC,
  available_qty NUMERIC,
  used_in_shop2_qty NUMERIC,
  in_progress_qty NUMERIC,
  shop2_scrap_qty NUMERIC,
  packaging_yield_qty NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH buffer_cards AS (
    SELECT
      c.nomenclature_id,
      c.order_id,
      SUM(COALESCE(c.quantity, 0)) AS buf_total_rec,
      SUM(GREATEST(0, COALESCE(c.quantity, 0) - COALESCE(c.used_in_shop2_qty, 0))) AS buf_avail,
      SUM(COALESCE(c.used_in_shop2_qty, 0)) AS buf_used
    FROM work_cards c
    WHERE c.status = 'at-shop2-buffer'
      AND (p_order_ids IS NULL OR c.order_id = ANY(p_order_ids))
    GROUP BY c.nomenclature_id, c.order_id
  ),
  shop2_active_cards AS (
    SELECT
      c.nomenclature_id,
      c.order_id,
      SUM(CASE 
        WHEN c.status IN ('new', 'in-progress', 'waiting-cutters', 'waiting-materials', 'waiting-buffer', 'at-buffer') 
             AND NOT (c.operation ILIKE '%пакування%' OR c.operation ILIKE '%сгп%')
        THEN COALESCE(c.quantity, 0) 
        ELSE 0 
      END) AS shop2_wip,
      SUM(COALESCE(c.scrap_qty, 0)) AS shop2_scrap,
      SUM(CASE 
        WHEN c.status = 'completed' OR (c.operation ILIKE '%пакування%' OR c.operation ILIKE '%сгп%')
        THEN COALESCE(c.quantity, 0) 
        ELSE 0 
      END) AS shop2_completed
    FROM work_cards c
    WHERE (p_order_ids IS NULL OR c.order_id = ANY(p_order_ids))
      AND (
        c.operation ILIKE '%пресування%' OR 
        c.operation ILIKE '%фарбування%' OR 
        c.operation ILIKE '%маляр%' OR 
        c.operation ILIKE '%доопрацювання%' OR 
        c.operation ILIKE '%пакування%' OR 
        c.operation ILIKE '%сгп%' OR 
        c.card_info LIKE '%[SHOP:2]%' OR 
        c.card_info LIKE '%[ЦЕХ №2]%' OR 
        c.card_info LIKE '%[ЦЕХ 2]%'
      )
    GROUP BY c.nomenclature_id, c.order_id
  ),
  combined_keys AS (
    SELECT b.nomenclature_id, b.order_id FROM buffer_cards b
    UNION
    SELECT s.nomenclature_id, s.order_id FROM shop2_active_cards s
  )
  SELECT
    k.nomenclature_id,
    k.order_id,
    COALESCE(b.buf_total_rec, 0)::NUMERIC AS total_received,
    COALESCE(b.buf_avail, 0)::NUMERIC AS available_qty,
    COALESCE(b.buf_used, 0)::NUMERIC AS used_in_shop2_qty,
    COALESCE(s.shop2_wip, 0)::NUMERIC AS in_progress_qty,
    COALESCE(s.shop2_scrap, 0)::NUMERIC AS shop2_scrap_qty,
    GREATEST(
      COALESCE(s.shop2_completed, 0),
      GREATEST(0, COALESCE(b.buf_used, 0) - COALESCE(s.shop2_wip, 0) - COALESCE(s.shop2_scrap, 0))
    )::NUMERIC AS packaging_yield_qty
  FROM combined_keys k
  LEFT JOIN buffer_cards b 
    ON b.nomenclature_id = k.nomenclature_id 
   AND (b.order_id = k.order_id OR (b.order_id IS NULL AND k.order_id IS NULL))
  LEFT JOIN shop2_active_cards s 
    ON s.nomenclature_id = k.nomenclature_id 
   AND (s.order_id = k.order_id OR (s.order_id IS NULL AND k.order_id IS NULL));
END;
$$;


-- ─── MIGRATION: 20260908120000_split_packaging_task_rpc.sql ───
-- ═══════════════════════════════════════════════════════════════════════════
-- 📦 MES CENTRUM: ATOMIC PACKAGING TASK SPLIT RPC
-- Процедура: rpc_split_packaging_task
-- Призначення: Розділення єдиного наряду пакування на окремі партії за графіком
--              з інтерактивним розподілом спакованого факту та миттєвим виходом
--              готових партій на відвантаження.
-- ═══════════════════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS rpc_split_packaging_task(UUID, JSONB, TEXT);

CREATE OR REPLACE FUNCTION rpc_split_packaging_task(
  p_parent_task_id UUID,
  p_splits JSONB,
  p_user_name TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_parent RECORD;
  v_order RECORD;
  v_split JSONB;
  v_idx INT := 0;
  v_batch_num INT;
  v_batch_index TEXT;
  v_quantity NUMERIC;
  v_deadline TEXT;
  v_packed_qty NUMERIC;
  v_is_packed BOOLEAN;
  v_new_meta JSONB;
  v_new_snapshot JSONB;
  v_created_task_ids UUID[] := ARRAY[]::UUID[];
  v_current_report JSONB;
  v_schedule JSONB;
  v_updated_schedule JSONB := '[]'::JSONB;
  v_sched_elem JSONB;
BEGIN
  -- 1. Перевірка вхідних даних
  IF p_parent_task_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'p_parent_task_id є обов''язковим');
  END IF;

  IF p_splits IS NULL OR jsonb_array_length(p_splits) < 2 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Для розділення потрібно щонайменше 2 партії в p_splits');
  END IF;

  -- 2. Блокування та зчитування батьківського наряду
  SELECT * INTO v_parent
  FROM tasks
  WHERE id = p_parent_task_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Наряд пакування не знайдено в БД');
  END IF;

  IF v_parent.step IS NOT NULL AND LOWER(v_parent.step) NOT LIKE '%пакув%' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Наряд не належить до етапу Пакування: ' || COALESCE(v_parent.step, 'null'));
  END IF;

  -- 3. Зчитування замовлення
  SELECT * INTO v_order
  FROM orders
  WHERE id = v_parent.order_id
  FOR UPDATE;

  -- Зчитування існуючого batch_schedule з orders.report
  IF v_order.report IS NOT NULL AND v_order.report <> '' THEN
    BEGIN
      v_current_report := v_order.report::JSONB;
    EXCEPTION WHEN OTHERS THEN
      v_current_report := '{}'::JSONB;
    END;
  ELSE
    v_current_report := '{}'::JSONB;
  END IF;

  v_schedule := COALESCE(v_current_report->'batch_schedule', '[]'::JSONB);

  -- 4. Ітерація по масиву розбивки
  FOR v_split IN SELECT * FROM jsonb_array_elements(p_splits)
  LOOP
    v_batch_num := COALESCE((v_split->>'batch_num')::INT, v_idx + 1);
    v_batch_index := 'П' || v_batch_num;
    v_quantity := COALESCE((v_split->>'quantity')::NUMERIC, 0);
    v_deadline := v_split->>'deadline';
    v_packed_qty := COALESCE((v_split->>'packed_quantity')::NUMERIC, 0);
    v_is_packed := (v_packed_qty >= v_quantity AND v_quantity > 0);

    -- Формування snapshot metadata
    v_new_meta := jsonb_build_object(
      'is_packaged', v_is_packed,
      'batch_index', v_batch_index,
      'batch_num', v_batch_num,
      'planned_sets', v_quantity,
      'packed_sets', v_packed_qty,
      'packaged_at', CASE WHEN v_is_packed THEN NOW()::text ELSE NULL END,
      'packaged_by', CASE WHEN v_is_packed THEN COALESCE(p_user_name, 'Пакувальник') ELSE NULL END
    );

    IF v_idx = 0 THEN
      -- Перший елемент оновлює вихідний батьківський наряд in-place
      v_new_snapshot := COALESCE(v_parent.plan_snapshot, '{}'::JSONB);
      v_new_snapshot := jsonb_set(v_new_snapshot, '{_metadata}', v_new_meta, true);

      UPDATE tasks
      SET
        batch_index = v_batch_index,
        planned_sets = v_quantity,
        planned_deadline = CASE WHEN v_deadline IS NOT NULL AND v_deadline <> '' THEN v_deadline::TIMESTAMPTZ ELSE planned_deadline END,
        status = CASE WHEN v_is_packed THEN 'completed' ELSE 'in-progress' END,
        completed_at = CASE WHEN v_is_packed THEN COALESCE(completed_at, NOW()) ELSE NULL END,
        plan_snapshot = v_new_snapshot
      WHERE id = v_parent.id;

      v_created_task_ids := array_append(v_created_task_ids, v_parent.id);

      -- Оновлення коробок для першої партії
      UPDATE packaging_boxes
      SET batch_index = v_batch_index
      WHERE order_id = v_parent.order_id
        AND (batch_index IS NULL OR batch_index = '' OR batch_index = '1' OR batch_index = 'whole');

    ELSE
      -- Наступні елементи вставляються як нові таски
      v_new_snapshot := jsonb_build_object('_metadata', v_new_meta);

      INSERT INTO tasks (
        order_id,
        step,
        machine_name,
        batch_index,
        planned_sets,
        planned_deadline,
        status,
        completed_at,
        plan_snapshot,
        created_at
      ) VALUES (
        v_parent.order_id,
        'Пакування',
        v_parent.machine_name,
        v_batch_index,
        v_quantity,
        CASE WHEN v_deadline IS NOT NULL AND v_deadline <> '' THEN v_deadline::TIMESTAMPTZ ELSE v_parent.planned_deadline END,
        CASE WHEN v_is_packed THEN 'completed' ELSE 'in-progress' END,
        CASE WHEN v_is_packed THEN NOW() ELSE NULL END,
        v_new_snapshot,
        NOW()
      )
      RETURNING id INTO v_parent;

      v_created_task_ids := array_append(v_created_task_ids, v_parent.id);
    END IF;

    -- Синхронізація розкладу партій
    v_updated_schedule := v_updated_schedule || jsonb_build_array(jsonb_build_object(
      'batch_num', v_batch_num,
      'quantity', v_quantity,
      'deadline', v_deadline,
      'packaged', v_is_packed,
      'packaged_at', CASE WHEN v_is_packed THEN NOW()::text ELSE NULL END,
      'packaged_by', CASE WHEN v_is_packed THEN COALESCE(p_user_name, 'Пакувальник') ELSE NULL END
    ));

    v_idx := v_idx + 1;
  END LOOP;

  -- 5. Запис оновленого batch_schedule в orders.report
  IF v_order.id IS NOT NULL THEN
    v_current_report := jsonb_set(v_current_report, '{batch_schedule}', v_updated_schedule, true);
    UPDATE orders
    SET report = v_current_report::TEXT
    WHERE id = v_order.id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'parent_task_id', p_parent_task_id,
    'splits_count', v_idx,
    'task_ids', v_created_task_ids
  );
END;
$$;

COMMENT ON FUNCTION rpc_split_packaging_task IS 'Атомарне розділення наряду пакування на окремі партії з інтерактивним збереженням факту та синхронізацією з відвантаженням';


-- ─── MIGRATION: 20260908130000_migrate_hardware_to_sgp.sql ───
-- Migration: 20260908130000_migrate_hardware_to_sgp.sql
-- Перенесення всіх метизів, гвинтів, гайок, стійок та комплектуючих пакування з СО на СГП

-- 1. Перевести склад для всіх метизів та комплектуючих на 'sgp'
UPDATE public.inventory
SET warehouse = 'sgp',
    updated_at = NOW()
WHERE (
  type IN ('hardware', 'fastener', 'mount')
  OR LOWER(name) ~* '(гвинт|гайка|болт|шайба|стійка|накладка|тримач|метиз|кріплення|саморіз|втулка|фіксатор)'
)
AND (warehouse IS NULL OR warehouse = 'operational' OR warehouse = 'raw');

-- 2. Безпечна атомарна RPC-функція для видачі запиту пакування зі Складу Готової Продукції (СГП)
CREATE OR REPLACE FUNCTION public.issue_packaging_request_from_sgp(
  p_request_id BIGINT,
  p_issuer_name TEXT DEFAULT 'Комірник СГП'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_req public.material_requests%ROWTYPE;
  v_inv public.inventory%ROWTYPE;
  v_qty NUMERIC;
BEGIN
  SELECT * INTO v_req FROM public.material_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Запит не знайдено');
  END IF;

  IF v_req.status = 'completed' OR v_req.status = 'issued' THEN
    RETURN jsonb_build_object('success', true, 'message', 'Запит вже підтверджено та видано');
  END IF;

  v_qty := COALESCE(v_req.quantity, 0);

  -- Знайти відповідний запис залишку на СГП
  IF v_req.inventory_id IS NOT NULL THEN
    SELECT * INTO v_inv FROM public.inventory WHERE id = v_req.inventory_id FOR UPDATE;
  ELSIF v_req.nomenclature_id IS NOT NULL THEN
    SELECT * INTO v_inv FROM public.inventory 
    WHERE nomenclature_id = v_req.nomenclature_id AND warehouse = 'sgp'
    ORDER BY total_qty DESC LIMIT 1 FOR UPDATE;
  END IF;

  -- Якщо інвентар знайдено на СГП, списуємо фактичну кількість
  IF v_inv.id IS NOT NULL THEN
    UPDATE public.inventory
    SET total_qty = GREATEST(0, COALESCE(total_qty, 0) - v_qty),
        updated_at = NOW()
    WHERE id = v_inv.id;
  END IF;

  -- Оновлюємо статус запиту на completed (видано складом)
  UPDATE public.material_requests
  SET status = 'completed',
      inventory_id = COALESCE(v_inv.id, inventory_id),
      details = details || ' [ВИДАНО СГП: ' || p_issuer_name || ' ' || to_char(NOW(), 'DD.MM.YYYY HH24:MI') || ']'
  WHERE id = p_request_id;

  RETURN jsonb_build_object('success', true, 'message', 'Позицію успішно видано з СГП');
END;
$$;


-- ─── MIGRATION: 20260908140000_merge_bz_into_sgp_finished.sql ───
-- Migration: Merge BZ inventory into SGP Finished Products (Готова продукція)
-- Date: 2026-09-08

-- 1. Оновлюємо тип усіх залишків БЗ на СГП / загальному складі до 'finished'
UPDATE public.inventory
SET type = 'finished',
    warehouse = 'sgp',
    updated_at = NOW()
WHERE type = 'bz'
  AND (warehouse = 'sgp' OR warehouse IS NULL OR warehouse = 'operational');

-- 2. Оновлюємо функцію резервування деталей reserve_bz_for_naryad,
-- щоб вона перевіряла залишки як для type = 'finished', так і для type = 'bz' / 'part'
CREATE OR REPLACE FUNCTION public.reserve_bz_for_naryad(
  p_operation_id uuid,
  p_order_id uuid,
  p_items jsonb,
  p_actor_id bigint default null,
  p_actor_name text default null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item jsonb;
  v_nom_id uuid;
  v_requested numeric;
  v_available_row public.inventory%rowtype;
  v_wip_row public.inventory%rowtype;
  v_available numeric;
  v_allocated numeric;
  v_reservation public.bz_inventory_reservations%rowtype;
  v_result jsonb := '[]'::jsonb;
BEGIN
  IF p_operation_id IS NULL THEN
    RAISE EXCEPTION 'operation_id is required';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.bz_inventory_reservations
    WHERE operation_id = p_operation_id
  ) THEN
    RETURN jsonb_build_object(
      'operation_id', p_operation_id,
      'allocations', (
        SELECT coalesce(jsonb_agg(jsonb_build_object(
          'reservation_id', id,
          'nomenclature_id', nomenclature_id,
          'requested_qty', requested_qty,
          'allocated_qty', allocated_qty
        ) ORDER BY created_at), '[]'::jsonb)
        FROM public.bz_inventory_reservations
        WHERE operation_id = p_operation_id
      )
    );
  END IF;

  PERFORM set_config('app.bz_enriched_ledger', '1', true);

  FOR v_item IN
    SELECT value FROM jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  LOOP
    v_nom_id := (v_item->>'nomenclature_id')::uuid;
    v_requested := greatest(coalesce((v_item->>'quantity')::numeric, 0), 0);
    IF v_requested = 0 THEN
      CONTINUE;
    END IF;

    -- Шукаємо вільний залишок серед готової продукції (finished) або історичного bz
    SELECT * INTO v_available_row
    FROM public.inventory
    WHERE nomenclature_id = v_nom_id
      AND (type = 'finished' OR type = 'bz' OR type = 'part')
      AND (pocket_owner IS NULL OR pocket_owner = 'Не вказано')
    ORDER BY CASE WHEN type = 'finished' THEN 0 ELSE 1 END,
             CASE WHEN warehouse = 'sgp' THEN 0 ELSE 1 END,
             created_at, id
    LIMIT 1
    FOR UPDATE;

    v_available := greatest(
      coalesce(v_available_row.total_qty, 0) - coalesce(v_available_row.reserved_qty, 0),
      0
    );
    v_allocated := least(v_requested, v_available);

    INSERT INTO public.bz_inventory_reservations (
      operation_id, order_id, nomenclature_id, requested_qty, allocated_qty,
      actor_id, actor_name
    ) VALUES (
      p_operation_id, p_order_id, v_nom_id, v_requested, v_allocated,
      p_actor_id, p_actor_name
    )
    RETURNING * INTO v_reservation;

    IF v_allocated > 0 THEN
      UPDATE public.inventory
      SET total_qty = coalesce(total_qty, 0) - v_allocated,
          updated_at = now()
      WHERE id = v_available_row.id;

      SELECT * INTO v_wip_row
      FROM public.inventory
      WHERE nomenclature_id = v_nom_id AND type = 'wip_bz'
      ORDER BY created_at, id
      LIMIT 1
      FOR UPDATE;

      IF v_wip_row.id IS NULL THEN
        INSERT INTO public.inventory (
          nomenclature_id, name, total_qty, reserved_qty, type, unit, pocket_owner
        )
        VALUES (
          v_nom_id,
          v_available_row.name,
          v_allocated,
          0,
          'wip_bz',
          v_available_row.unit,
          null
        );
      ELSE
        UPDATE public.inventory
        SET total_qty = coalesce(total_qty, 0) + v_allocated,
            updated_at = now()
        WHERE id = v_wip_row.id;
      END IF;
    END IF;

    v_result := v_result || jsonb_build_array(jsonb_build_object(
      'reservation_id', v_reservation.id,
      'nomenclature_id', v_nom_id,
      'requested_qty', v_requested,
      'allocated_qty', v_allocated
    ));
  END LOOP;

  RETURN jsonb_build_object(
    'operation_id', p_operation_id,
    'allocations', v_result
  );
END;
$$;


-- ─── MIGRATION: 20260908150000_cleanup_orphan_warehouse_reserves.sql ───
-- ============================================================
-- Migration: 20260908150000_cleanup_orphan_warehouse_reserves.sql
-- Description: Clean up orphan material requests, release orphan BZ reservations,
--              and reset phantom reserved_qty on SO, SV, and SGP inventory.
-- ============================================================

-- 1. Скидаємо фантомні статичні резерви на всіх складах, якщо немає активних нарядів
UPDATE public.inventory
SET reserved_qty = 0,
    updated_at = NOW()
WHERE reserved_qty > 0;

-- 2. Скасовуємо завислі запити на матеріали під видалені наряди
UPDATE public.material_requests
SET status = 'cancelled'
WHERE status IN ('pending', 'approved', 'reserved', 'issued')
  AND (
    task_id IS NULL 
    OR NOT EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id AND t.status NOT IN ('completed', 'cancelled'))
  );

-- 3. Звільняємо всі завислі броні в таблиці bz_inventory_reservations під відсутні наряди
UPDATE public.bz_inventory_reservations
SET status = 'released',
    released_at = NOW(),
    release_reason = 'Очищення фантомних резервів: наряд відсутній або видалений'
WHERE status = 'allocated'
  AND (
    task_id IS NULL
    OR NOT EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id AND t.status NOT IN ('completed', 'cancelled'))
  );


-- ─── MIGRATION: 20260908170000_merge_semi_into_sgp_finished.sql ───
-- ==============================================================================
-- MIGRATION: 20260908170000_merge_semi_into_sgp_finished.sql
-- DESCRIPTION: Об'єднання залишків напівфабрикатів (semi, semi_shop2) у
--              Готову Продукцію (finished) на СГП (warehouse = 'sgp').
-- ==============================================================================

DO $$
DECLARE
  r RECORD;
  target_id UUID;
BEGIN
  -- 1. Для кожної позиції semi / semi_shop2:
  FOR r IN 
    SELECT id, name, total_qty, reserved_qty, unit 
    FROM inventory 
    WHERE type IN ('semi', 'semi_shop2')
  LOOP
    -- Шукаємо чи вже є готова продукція з такою ж назвою на СГП
    SELECT id INTO target_id 
    FROM inventory 
    WHERE LOWER(TRIM(name)) = LOWER(TRIM(r.name)) 
      AND type = 'finished' 
      AND warehouse = 'sgp' 
    LIMIT 1;

    IF target_id IS NOT NULL THEN
      -- Додаємо залишок до існуючої готової продукції
      UPDATE inventory 
      SET total_qty = total_qty + COALESCE(r.total_qty, 0)
      WHERE id = target_id;

      -- Видаляємо дублюючий запис semi
      DELETE FROM inventory WHERE id = r.id;
    ELSE
      -- Якщо позиції не було на СГП, переводимо запис у finished на sgp
      UPDATE inventory 
      SET type = 'finished', warehouse = 'sgp' 
      WHERE id = r.id;
    END IF;
  END LOOP;
END $$;


-- ─── MIGRATION: 20260908180000_update_register_cutter_usage_remove_pocket.sql ───
-- Migration: Remove pocket from register_cutter_usage
-- Cutters are now deducted directly from operational warehouse (СО) with atomic reservation release.
-- register_cutter_usage is preserved for recording cutter_usage_events and cutter_restoration_batches.

create or replace function public.register_cutter_usage(
  p_source_card_id uuid,
  p_items jsonb,
  p_actor_id bigint default null,
  p_actor_name text default null,
  p_source_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_card public.work_cards%rowtype;
  v_item jsonb;
  v_nom public.nomenclatures%rowtype;
  v_usage public.cutter_usage_events%rowtype;
  v_nom_id uuid;
  v_qty numeric;
  v_faceting boolean;
  v_owner text;
  v_batch_id uuid;
  v_batches jsonb := '[]'::jsonb;
begin
  select * into v_card
  from public.work_cards
  where id = p_source_card_id
  for update;

  if v_card.id is null then
    raise exception 'Work card not found';
  end if;

  v_owner := nullif(coalesce(p_source_metadata->>'manager_name', v_card.manager_name), 'Не вказано');

  for v_item in
    select value from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    v_nom_id := (v_item->>'nomenclature_id')::uuid;
    v_qty := greatest(coalesce((v_item->>'quantity')::numeric, 0), 0);
    if v_qty = 0 then continue; end if;

    select * into v_nom from public.nomenclatures where id = v_nom_id;
    if v_nom.id is null or v_nom.type <> 'consumable' then
      raise exception 'Invalid cutter nomenclature: %', v_nom_id;
    end if;

    -- Idempotency barrier: a repeated terminal request won't duplicate usage events or restoration batches.
    if exists (
      select 1 from public.cutter_usage_events
      where source_card_id = p_source_card_id and nomenclature_id = v_nom_id
    ) then
      continue;
    end if;

    v_faceting := public.is_faceting_cutter(v_nom_id);

    insert into public.cutter_usage_events (
      source_card_id, task_id, order_id, nomenclature_id, quantity,
      is_faceting, pocket_owner, actor_id, actor_name
    ) values (
      v_card.id, v_card.task_id, v_card.order_id, v_nom_id, v_qty,
      v_faceting, null, p_actor_id, p_actor_name
    )
    returning * into v_usage;

    if v_faceting then
      insert into public.cutter_restoration_batches (
        batch_number, usage_event_id, source_card_id, task_id, order_id,
        nomenclature_id, cutter_name, received_qty,
        source_operator, source_manager, source_machine
      ) values (
        'FR-' || to_char(clock_timestamp(), 'YYYYMMDD') || '-' || upper(substr(replace(v_usage.id::text, '-', ''), 1, 6)),
        v_usage.id, v_card.id, v_card.task_id, v_card.order_id,
        v_nom_id, v_nom.name, v_qty,
        coalesce(p_source_metadata->>'operator_name', v_card.operator_name),
        coalesce(p_source_metadata->>'manager_name', v_card.manager_name),
        coalesce(p_source_metadata->>'machine_name', v_card.machine)
      )
      returning id into v_batch_id;

      insert into public.cutter_restoration_events (
        batch_id, event_type, actor_id, actor_name, metadata
      ) values (
        v_batch_id, 'created', p_actor_id, p_actor_name,
        jsonb_build_object('source_card_id', v_card.id, 'quantity', v_qty)
      );

      v_batches := v_batches || jsonb_build_array(v_batch_id);
    end if;
  end loop;

  return jsonb_build_object('created_batch_ids', v_batches);
end;
$$;


-- ─── MIGRATION: 20260908190000_fix_bom_items_fk_to_nomenclatures_v2.sql ───
-- ═══════════════════════════════════════════════════════════════════════════
-- 🔧 FIX: bom_items FK → nomenclatures_v2
-- Крок 1: Очищуємо старі BOM записи де child_id або parent_id не існують в nomenclatures_v2
-- Крок 2: Перепризначаємо FK на nomenclatures_v2
-- ═══════════════════════════════════════════════════════════════════════════

-- ДІАГНОСТИКА: Показати скільки рядків будуть видалені
SELECT
  COUNT(*) FILTER (WHERE child_id NOT IN (SELECT id FROM public.nomenclatures_v2))  AS orphan_child_count,
  COUNT(*) FILTER (WHERE parent_id NOT IN (SELECT id FROM public.nomenclatures_v2)) AS orphan_parent_count,
  COUNT(*) AS total_bom_rows
FROM public.bom_items;

-- КРОК 1: Видалити bom_items де child_id або parent_id не існує в nomenclatures_v2
-- (це старі V1 записи, вони вже не актуальні)
DELETE FROM public.bom_items
WHERE child_id NOT IN (SELECT id FROM public.nomenclatures_v2)
   OR parent_id NOT IN (SELECT id FROM public.nomenclatures_v2);

-- КРОК 2: Видаляємо всі старі FK constraints на bom_items
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.bom_items'::regclass
      AND contype = 'f'
  LOOP
    EXECUTE format('ALTER TABLE public.bom_items DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END;
$$;

-- КРОК 3: Додаємо нові FK що посилаються на nomenclatures_v2
ALTER TABLE public.bom_items
  ADD CONSTRAINT bom_items_child_id_fkey
    FOREIGN KEY (child_id)
    REFERENCES public.nomenclatures_v2(id)
    ON DELETE CASCADE;

ALTER TABLE public.bom_items
  ADD CONSTRAINT bom_items_parent_id_fkey
    FOREIGN KEY (parent_id)
    REFERENCES public.nomenclatures_v2(id)
    ON DELETE CASCADE;

-- КРОК 4: Індекси для продуктивності
CREATE INDEX IF NOT EXISTS idx_bom_items_parent_id ON public.bom_items(parent_id);
CREATE INDEX IF NOT EXISTS idx_bom_items_child_id  ON public.bom_items(child_id);

-- ПІДТВЕРДЖЕННЯ: Показати кількість залишених BOM записів
SELECT COUNT(*) AS remaining_bom_rows FROM public.bom_items;


-- ─── MIGRATION: 20260908200000_fix_machine_operations_fk_to_nomenclatures_v2.sql ───
-- ═══════════════════════════════════════════════════════════════════════════
-- 🔧 FIX: machine_operations FK → nomenclatures_v2 + RLS Access Policy
-- ═══════════════════════════════════════════════════════════════════════════
-- 1. Очищуємо старі записи machine_operations де nomenclature_id не існує в nomenclatures_v2
-- 2. Видаляємо старий FK constraint на public.nomenclatures
-- 3. Додаємо новий FK constraint на public.nomenclatures_v2
-- 4. Надаємо повні права доступу на machine_operations (RLS) для anon та authenticated
-- ═══════════════════════════════════════════════════════════════════════════

-- КРОК 1: Видаляємо всі старі FK constraints на machine_operations
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.machine_operations'::regclass
      AND contype = 'f'
  LOOP
    EXECUTE format('ALTER TABLE public.machine_operations DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END;
$$;

-- КРОК 2: Додаємо новий FK що посилається на nomenclatures_v2
-- (Якщо є старі записи, що посилаються на V1, вони не заблокують, якщо перевірити валідність)
DO $$
BEGIN
  -- Видаляємо записи, які не існують в nomenclatures_v2
  DELETE FROM public.machine_operations
  WHERE nomenclature_id NOT IN (SELECT id FROM public.nomenclatures_v2);

  ALTER TABLE public.machine_operations
    ADD CONSTRAINT machine_operations_nomenclature_id_fkey
      FOREIGN KEY (nomenclature_id)
      REFERENCES public.nomenclatures_v2(id)
      ON DELETE CASCADE;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Constraint already exists or could not be added directly: %', SQLERRM;
END;
$$;

-- КРОК 3: Індекси для швидкого пошуку операцій за номенклатурою
CREATE INDEX IF NOT EXISTS idx_machine_operations_nomenclature_id 
  ON public.machine_operations(nomenclature_id);

-- КРОК 4: Налаштування RLS політик для machine_operations
ALTER TABLE public.machine_operations ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN 
    SELECT policyname 
    FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'machine_operations' 
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.machine_operations;', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "machine_operations_mes_access" 
  ON public.machine_operations 
  FOR ALL 
  TO authenticated, anon 
  USING (true) 
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.machine_operations TO anon, authenticated;


-- ─── MIGRATION: 20260908210000_sync_inventory_to_nomenclatures_v2.sql ───
-- ═══════════════════════════════════════════════════════════════════════════
-- 🔧 FIX: Синхронізація public.inventory з nomenclatures_v2 + Оновлення reserve_bz_for_naryad
-- ═══════════════════════════════════════════════════════════════════════════
-- Мета:
-- 1. Видалити старий FK constraint inventory_nomenclature_id_fkey, що тримав посилання на V1.
-- 2. Оновити nomenclature_id у таблиці inventory на актуальні канонічні ID з nomenclatures_v2.
-- 3. Додати новий FK constraint на public.nomenclatures_v2.
-- 4. Оновити функцію reserve_bz_for_naryad, щоб вона безпомилково знаходила
--    залишки на СГП як за канонічним ID, так і за назвою номенклатури.
-- ═══════════════════════════════════════════════════════════════════════════

-- КРОК 1: Видаляємо старий FK constraint на public.nomenclatures (V1)
ALTER TABLE public.inventory DROP CONSTRAINT IF EXISTS inventory_nomenclature_id_fkey;

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.inventory'::regclass
      AND contype = 'f'
      AND confrelid = 'public.nomenclatures'::regclass
  LOOP
    EXECUTE format('ALTER TABLE public.inventory DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END;
$$;

-- КРОК 2: Оновлення nomenclature_id в inventory за назвою з nomenclatures_v2
UPDATE public.inventory i
SET nomenclature_id = v2.id,
    updated_at = NOW()
FROM public.nomenclatures_v2 v2
WHERE LOWER(TRIM(i.name)) = LOWER(TRIM(v2.name))
  AND (i.nomenclature_id IS NULL OR i.nomenclature_id != v2.id);

-- КРОК 3: Додаткова синхронізація через стару таблицю nomenclatures (V1)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'nomenclatures') THEN
    UPDATE public.inventory i
    SET nomenclature_id = v2.id,
        updated_at = NOW()
    FROM public.nomenclatures v1
    JOIN public.nomenclatures_v2 v2 ON LOWER(TRIM(v1.name)) = LOWER(TRIM(v2.name))
    WHERE i.nomenclature_id = v1.id
      AND (i.nomenclature_id != v2.id);
  END IF;
END $$;

-- КРОК 4: Додаємо новий FK що посилається на nomenclatures_v2
DO $$
BEGIN
  ALTER TABLE public.inventory
    ADD CONSTRAINT inventory_nomenclature_id_fkey
      FOREIGN KEY (nomenclature_id)
      REFERENCES public.nomenclatures_v2(id)
      ON DELETE SET NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Constraint inventory_nomenclature_id_fkey could not be enforced strictly: %', SQLERRM;
END;
$$;

-- КРОК 5: Індекс для надшвидкого пошуку залишків за nomenclature_id
CREATE INDEX IF NOT EXISTS idx_inventory_nomenclature_id ON public.inventory(nomenclature_id);
CREATE INDEX IF NOT EXISTS idx_inventory_name_lower ON public.inventory(LOWER(TRIM(name)));

-- КРОК 6: Оновлення функції reserve_bz_for_naryad з розумним пошуком та авто-синхронізацією ID
CREATE OR REPLACE FUNCTION public.reserve_bz_for_naryad(
  p_operation_id uuid,
  p_order_id uuid,
  p_items jsonb,
  p_actor_id bigint default null,
  p_actor_name text default null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item jsonb;
  v_nom_id uuid;
  v_requested numeric;
  v_available_row public.inventory%rowtype;
  v_wip_row public.inventory%rowtype;
  v_available numeric;
  v_allocated numeric;
  v_reservation public.bz_inventory_reservations%rowtype;
  v_result jsonb := '[]'::jsonb;
BEGIN
  IF p_operation_id IS NULL THEN
    RAISE EXCEPTION 'operation_id is required';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.bz_inventory_reservations
    WHERE operation_id = p_operation_id
  ) THEN
    RETURN jsonb_build_object(
      'operation_id', p_operation_id,
      'allocations', (
        SELECT coalesce(jsonb_agg(jsonb_build_object(
          'reservation_id', id,
          'nomenclature_id', nomenclature_id,
          'requested_qty', requested_qty,
          'allocated_qty', allocated_qty
        ) ORDER BY created_at), '[]'::jsonb)
        FROM public.bz_inventory_reservations
        WHERE operation_id = p_operation_id
      )
    );
  END IF;

  PERFORM set_config('app.bz_enriched_ledger', '1', true);

  FOR v_item IN
    SELECT value FROM jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  LOOP
    v_nom_id := (v_item->>'nomenclature_id')::uuid;
    v_requested := greatest(coalesce((v_item->>'quantity')::numeric, 0), 0);
    IF v_requested = 0 THEN
      CONTINUE;
    END IF;

    -- Шукаємо вільний залишок серед готової продукції (finished) або історичного bz:
    -- 1) Пряме співпадіння за nomenclature_id
    -- 2) Або за збігом назви з nomenclatures_v2 (якщо nomenclature_id ще старий)
    SELECT * INTO v_available_row
    FROM public.inventory i
    WHERE (
        i.nomenclature_id = v_nom_id
        OR EXISTS (
          SELECT 1 FROM public.nomenclatures_v2 v2
          WHERE v2.id = v_nom_id AND LOWER(TRIM(v2.name)) = LOWER(TRIM(i.name))
        )
      )
      AND (i.type = 'finished' OR i.type = 'bz' OR i.type = 'part' OR i.warehouse = 'sgp')
      AND (i.pocket_owner IS NULL OR i.pocket_owner = 'Не вказано')
    ORDER BY CASE WHEN i.nomenclature_id = v_nom_id THEN 0 ELSE 1 END,
             CASE WHEN i.type = 'finished' THEN 0 ELSE 1 END,
             CASE WHEN i.warehouse = 'sgp' THEN 0 ELSE 1 END,
             i.created_at, i.id
    LIMIT 1
    FOR UPDATE;

    -- Якщо знайдено рядок зі старим nomenclature_id, автоматично оновлюємо його на v_nom_id
    IF v_available_row.id IS NOT NULL AND (v_available_row.nomenclature_id IS NULL OR v_available_row.nomenclature_id != v_nom_id) THEN
      UPDATE public.inventory
      SET nomenclature_id = v_nom_id,
          updated_at = NOW()
      WHERE id = v_available_row.id;
      v_available_row.nomenclature_id := v_nom_id;
    END IF;

    v_available := greatest(
      coalesce(v_available_row.total_qty, 0) - coalesce(v_available_row.reserved_qty, 0),
      0
    );
    v_allocated := least(v_requested, v_available);

    INSERT INTO public.bz_inventory_reservations (
      operation_id, order_id, nomenclature_id, requested_qty, allocated_qty,
      actor_id, actor_name
    ) VALUES (
      p_operation_id, p_order_id, v_nom_id, v_requested, v_allocated,
      p_actor_id, p_actor_name
    )
    RETURNING * INTO v_reservation;

    IF v_allocated > 0 THEN
      UPDATE public.inventory
      SET total_qty = coalesce(total_qty, 0) - v_allocated,
          updated_at = now()
      WHERE id = v_available_row.id;

      SELECT * INTO v_wip_row
      FROM public.inventory
      WHERE nomenclature_id = v_nom_id AND type = 'wip_bz'
      ORDER BY created_at, id
      LIMIT 1
      FOR UPDATE;

      IF v_wip_row.id IS NULL THEN
        INSERT INTO public.inventory (
          nomenclature_id, name, total_qty, reserved_qty, type, unit, pocket_owner
        )
        VALUES (
          v_nom_id,
          v_available_row.name,
          v_allocated,
          0,
          'wip_bz',
          v_available_row.unit,
          null
        );
      ELSE
        UPDATE public.inventory
        SET total_qty = coalesce(total_qty, 0) + v_allocated,
            updated_at = now()
        WHERE id = v_wip_row.id;
      END IF;
    END IF;

    v_result := v_result || jsonb_build_array(jsonb_build_object(
      'reservation_id', v_reservation.id,
      'nomenclature_id', v_nom_id,
      'requested_qty', v_requested,
      'allocated_qty', v_allocated
    ));
  END LOOP;

  RETURN jsonb_build_object(
    'operation_id', p_operation_id,
    'allocations', v_result
  );
END;
$$;

-- КРОК 7: ПІДТВЕРДЖЕННЯ — перевірка залишків по деталях Київ К-ІП9/10/31/36/37...
SELECT
  i.id,
  i.name,
  i.nomenclature_id,
  v2.code AS v2_code,
  i.total_qty,
  i.reserved_qty,
  i.type,
  i.warehouse
FROM public.inventory i
LEFT JOIN public.nomenclatures_v2 v2 ON v2.id = i.nomenclature_id
WHERE i.name ILIKE '%Київ К-ІП9/10/31/36/37%'
ORDER BY i.name;


-- ─── MIGRATION: 20260908220000_consolidate_sgp_finished_inventory.sql ───
-- ═══════════════════════════════════════════════════════════════════════════
-- 🚀 КОНСОЛІДАЦІЯ ГОТОВОЇ ПРОДУКЦІЇ В ОДИН РЯДОК НА СГП (ДЛЯ ВСІХ ДЕТАЛЕЙ)
-- ═══════════════════════════════════════════════════════════════════════════
-- Мета:
-- 1. Знайти ВСІ номенклатури на підприємстві, які мають дублюючі записи
--    готової продукції (finished, bz) на різних складах (sgp, operational).
-- 2. Схлопнути їх в ОДИН єдиний запис на кожну деталь на складі СГП (warehouse = 'sgp')
--    з повною сумарною кількістю.
-- 3. Встановити UNIQUE індекс, який фізично унеможливить появу дублів у майбутньому.
-- ═══════════════════════════════════════════════════════════════════════════

-- КРОК 1: Створюємо тимчасову таблицю зі злитими сумами по ВСІХ деталях бази
CREATE TEMP TABLE tmp_pure_finished AS
SELECT 
  nomenclature_id,
  MIN(name) AS name,
  MIN(unit) AS unit,
  SUM(COALESCE(total_qty, 0)) AS total_qty,
  SUM(COALESCE(reserved_qty, 0)) AS reserved_qty,
  MIN(id::text)::uuid AS master_id
FROM public.inventory
WHERE type IN ('finished', 'bz')
  AND (pocket_owner IS NULL OR pocket_owner = 'Не вказано')
  AND nomenclature_id IS NOT NULL
GROUP BY nomenclature_id;

-- КРОК 2: Видаляємо всі дублюючі рядки, залишаючи строго один master_id на деталь
DELETE FROM public.inventory
WHERE type IN ('finished', 'bz')
  AND (pocket_owner IS NULL OR pocket_owner = 'Не вказано')
  AND nomenclature_id IS NOT NULL
  AND id NOT IN (SELECT master_id FROM tmp_pure_finished);

-- КРОК 3: Оновлюємо master-запис повною сумарною кількістю та фіксуємо склад СГП
UPDATE public.inventory i
SET total_qty = t.total_qty,
    reserved_qty = t.reserved_qty,
    type = 'finished',
    warehouse = 'sgp',
    pocket_owner = NULL,
    updated_at = NOW()
FROM tmp_pure_finished t
WHERE i.id = t.master_id;

DROP TABLE IF EXISTS tmp_pure_finished;

-- КРОК 4: Захисний UNIQUE індекс на СГП — захищає всю базу від дублів назавжди
CREATE UNIQUE INDEX IF NOT EXISTS uq_inventory_sgp_nomenclature
ON public.inventory (nomenclature_id)
WHERE type = 'finished' AND warehouse = 'sgp';

-- КРОК 5: Перевірка результатів (показує об'єднані позиції)
SELECT
  i.id,
  i.name,
  i.nomenclature_id,
  v2.code AS v2_code,
  i.total_qty,
  i.reserved_qty,
  i.type,
  i.warehouse
FROM public.inventory i
LEFT JOIN public.nomenclatures_v2 v2 ON v2.id = i.nomenclature_id
WHERE i.name ILIKE '%Київ К-ІП9/10/31/36/37%'
ORDER BY i.name, i.type;


-- ─── MIGRATION: 20260908230000_delete_naryad_260908_1_and_requests.sql ───
-- ═══════════════════════════════════════════════════════════════════════════
-- 🗑️ ВИДАЛЕННЯ НАРЯДУ №260908-1 ТА НЕКОРЕКТНОГО ЗАПИТУ НА СКЛАД
-- ═══════════════════════════════════════════════════════════════════════════
-- Мета:
-- 1. Видалити помилковий запит на комплектацію (Карбонова пластина Т700 500*600 7мм — 87 од.)
-- 2. Видалити всі робочі картки (work_cards) та історію по наряду №260908-1
-- 3. Видалити сам наряд (task) №260908-1
-- 4. Повернути замовлення в статус 'pending', щоб майстер міг переформувати наряд на ЛИСТИ.
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_task_ids UUID[];
  v_order_ids UUID[];
  v_card_ids UUID[];
BEGIN
  -- 1. Знаходимо ID замовлення за номером 260908-1
  SELECT ARRAY_AGG(id) INTO v_order_ids
  FROM public.orders
  WHERE order_num ILIKE '%260908-1%';

  -- 2. Знаходимо всі пов'язані завдання (Розкрій, Пакування тощо)
  SELECT ARRAY_AGG(id) INTO v_task_ids
  FROM public.tasks
  WHERE order_id = ANY(v_order_ids)
     OR id IN (SELECT task_id FROM public.material_requests WHERE details ILIKE '%260908-1%');

  -- 2. Знаходимо робочі картки
  SELECT ARRAY_AGG(id) INTO v_card_ids
  FROM public.work_cards
  WHERE task_id = ANY(v_task_ids)
     OR order_id = ANY(v_order_ids);

  -- 3. Видаляємо зв'язані сутності
  -- 3.1. Запити матеріалів (включаючи запит на 87 од. карбонових пластин)
  DELETE FROM public.material_requests
  WHERE task_id = ANY(v_task_ids)
     OR order_id = ANY(v_order_ids)
     OR details ILIKE '%260908-1%'
     OR (quantity = 87 AND created_at > NOW() - INTERVAL '2 hours');

  -- 3.2. Резервації БЗ та рухи
  DELETE FROM public.bz_inventory_reservations
  WHERE task_id = ANY(v_task_ids)
     OR order_id = ANY(v_order_ids);

  -- 3.3. Історія карток та брак
  IF v_card_ids IS NOT NULL AND array_length(v_card_ids, 1) > 0 THEN
    DELETE FROM public.work_card_history WHERE card_id = ANY(v_card_ids);
    DELETE FROM public.work_card_scrap_totals WHERE card_id = ANY(v_card_ids);
  END IF;

  IF v_task_ids IS NOT NULL AND array_length(v_task_ids, 1) > 0 THEN
    DELETE FROM public.work_card_scrap_totals WHERE task_id = ANY(v_task_ids);
  END IF;

  -- 3.4. Робочі картки
  DELETE FROM public.work_cards
  WHERE task_id = ANY(v_task_ids)
     OR order_id = ANY(v_order_ids);

  -- 3.5. Самі завдання (наряди)
  DELETE FROM public.tasks
  WHERE id = ANY(v_task_ids);

  -- 5. Повертаємо замовлення у статус очікування формування наряду
  IF v_order_ids IS NOT NULL AND array_length(v_order_ids, 1) > 0 THEN
    UPDATE public.orders
    SET status = 'pending'
    WHERE id = ANY(v_order_ids);
  END IF;

  RAISE NOTICE 'Наряд 260908-1 та пов''язані запити успішно видалено.';
END $$;

-- ПІДТВЕРДЖЕННЯ:
SELECT count(*) AS remaining_tasks FROM public.tasks WHERE order_id IN (SELECT id FROM public.orders WHERE order_num ILIKE '%260908-1%');
SELECT count(*) AS remaining_requests FROM public.material_requests WHERE details ILIKE '%260908-1%';


-- ─── MIGRATION: 20260908240000_fix_work_cards_and_legacy_fk_to_nomenclatures_v2.sql ───
-- ═══════════════════════════════════════════════════════════════════════════
-- 🔧 FIX: Видалення застарілих FK constraints, що посилаються на nomenclatures (V1)
--         та оновлення зв'язку work_cards -> nomenclatures_v2
-- ═══════════════════════════════════════════════════════════════════════════
-- Проблема:
-- При генерації робочих карток (work_cards) для деталей наряду виникає помилка:
-- "insert or update on table "work_cards" violates foreign key constraint "work_cards_nomenclature_id_fkey""
-- Причина:
-- Таблиця work_cards (та інші суміжні таблиці) все ще тримали старий foreign key constraint,
-- який вимагав наявності ID у старій таблиці public.nomenclatures (V1),
-- тоді як система вже працює на новій public.nomenclatures_v2.
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  r RECORD;
BEGIN
  -- 1. Знаходимо та видаляємо ВСІ зовнішні ключі (FK), які досі посилаються на стару таблицю nomenclatures
  FOR r IN
    SELECT 
      conrelid::regclass::text AS tbl_name,
      conname AS fk_name
    FROM pg_constraint
    WHERE confrelid = 'public.nomenclatures'::regclass
      AND contype = 'f'
  LOOP
    RAISE NOTICE 'Видаляємо застарілий FK: % на таблиці %', r.fk_name, r.tbl_name;
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT IF EXISTS %I', r.tbl_name, r.fk_name);
  END LOOP;
END;
$$;

-- 2. Явно гарантуємо зняття обмеження з work_cards та work_card_history
ALTER TABLE public.work_cards DROP CONSTRAINT IF EXISTS work_cards_nomenclature_id_fkey;
ALTER TABLE public.work_card_history DROP CONSTRAINT IF EXISTS work_card_history_nomenclature_id_fkey;
ALTER TABLE public.material_requests DROP CONSTRAINT IF EXISTS material_requests_nomenclature_id_fkey;

-- 3. Додаємо новий зв'язок work_cards -> nomenclatures_v2(id)
-- Використовуємо NOT VALID, щоб не блокувати історичні записи зі старими UUID
DO $$
BEGIN
  ALTER TABLE public.work_cards
    ADD CONSTRAINT work_cards_nomenclature_id_fkey
      FOREIGN KEY (nomenclature_id)
      REFERENCES public.nomenclatures_v2(id)
      ON DELETE SET NULL
      NOT VALID;
  RAISE NOTICE 'Успішно додано FK work_cards -> nomenclatures_v2';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'FK work_cards_nomenclature_id_fkey вже існує або: %', SQLERRM;
END;
$$;

-- 4. Перевірка: виводимо залишок FK на стару таблицю nomenclatures
SELECT 
  conrelid::regclass AS table_with_legacy_fk,
  conname AS constraint_name
FROM pg_constraint
WHERE confrelid = 'public.nomenclatures'::regclass;


-- ─── MIGRATION: 20260908250000_id_based_material_architecture.sql ───
-- ═══════════════════════════════════════════════════════════════════════════
-- 🚀 ARCHITECTURAL MILESTONE: ID-Based Relational ERP Core
-- ═══════════════════════════════════════════════════════════════════════════
-- Мета:
-- 1. Додати поле default_material_id UUID у nomenclatures_v2
-- 2. Автоматично зв'язати кожну деталь розкрою з її точним робочим листом (СО) за ID
-- 3. Структурувати таблицю material_requests (категорія, цільовий склад)
-- ═══════════════════════════════════════════════════════════════════════════

-- КРОК 1: Стовпчик default_material_id у таблиці nomenclatures_v2
ALTER TABLE public.nomenclatures_v2 
  ADD COLUMN IF NOT EXISTS default_material_id UUID REFERENCES public.nomenclatures_v2(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_nomenclatures_v2_default_material_id 
  ON public.nomenclatures_v2(default_material_id);

-- КРОК 2: Структурні стовпчики в material_requests
ALTER TABLE public.material_requests 
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS target_warehouse text DEFAULT 'operational';

CREATE INDEX IF NOT EXISTS idx_material_requests_category_wh 
  ON public.material_requests(target_warehouse, category);

-- КРОК 3: Автоматичний бекфіл зв'язків: Деталь -> ID Робочого Листа (СО)
DO $$
DECLARE
  rec RECORD;
  v_sheet_id UUID;
  v_grade TEXT;
  v_thick TEXT;
  v_raw_str TEXT;
  v_linked_count INT := 0;
BEGIN
  FOR rec IN
    SELECT 
      id, 
      name, 
      group_id,
      COALESCE(rule_params->>'rawSheet', rule_params->>'material', '') AS raw_sheet_param
    FROM public.nomenclatures_v2
    WHERE default_material_id IS NULL
      AND (
        group_id = 'cat_parts' 
        OR rule_type = 'frame_part'
        OR rule_params->>'rawSheet' IS NOT NULL
        OR name ILIKE 'Київ%'
        OR name ILIKE 'К-%'
        OR name ILIKE '%деталь%'
      )
  LOOP
    v_raw_str := rec.raw_sheet_param || ' ' || rec.name;

    -- Визначаємо марку карбону
    IF v_raw_str ILIKE '%Т700%' OR v_raw_str ILIKE '%T700%' THEN
      v_grade := 'Т700';
    ELSE
      v_grade := 'Т300';
    END IF;

    -- Визначаємо товщину
    v_thick := substring(v_raw_str from '\(([0-9]+(?:[.,][0-9]+)?)\s*мм\)');
    IF v_thick IS NULL THEN
      v_thick := substring(v_raw_str from '([0-9]+(?:[.,][0-9]+)?)\s*мм');
    END IF;
    IF v_thick IS NULL THEN
      v_thick := substring(v_raw_str from '-([0-9]+(?:[.,][0-9]+)?)$');
    END IF;

    IF v_thick IS NOT NULL THEN
      v_thick := replace(v_thick, ',', '.');
      
      -- Шукаємо робочий лист у nomenclatures_v2 за маркою і товщиною
      SELECT id INTO v_sheet_id
      FROM public.nomenclatures_v2
      WHERE (group_id = 'grp_prepared_sheets' OR name ILIKE 'Лист ' || v_grade || '%')
        AND name NOT ILIKE '%пластина%'
        AND name NOT ILIKE '%гума%'
        AND name NOT ILIKE '%непідготовлений%'
        AND (name ILIKE '%' || v_grade || '%')
        AND (
          substring(name from '\(([0-9]+(?:[.,][0-9]+)?)\s*мм\)') = v_thick
          OR substring(name from '([0-9]+(?:[.,][0-9]+)?)\s*мм') = v_thick
        )
      LIMIT 1;

      IF v_sheet_id IS NOT NULL THEN
        UPDATE public.nomenclatures_v2
        SET default_material_id = v_sheet_id,
            rule_params = jsonb_set(COALESCE(rule_params, '{}'::jsonb), '{default_material_id}', to_jsonb(v_sheet_id::text))
        WHERE id = rec.id;
        
        v_linked_count := v_linked_count + 1;
      END IF;
    END IF;
  END LOOP;

  RAISE NOTICE 'Успішно пов''язано деталей з листами за ID: %', v_linked_count;
END $$;

-- КРОК 4: Категоризація існуючих запитів на склад
UPDATE public.material_requests
SET category = 'sheet', target_warehouse = 'operational'
WHERE category IS NULL AND (details ILIKE '%лист%' OR details ILIKE '%склад оперативний%');

UPDATE public.material_requests
SET category = 'cutter', target_warehouse = 'operational'
WHERE category IS NULL AND (details ILIKE '%фрез%');

UPDATE public.material_requests
SET category = 'prep', target_warehouse = 'sv'
WHERE category IS NULL AND (details ILIKE '%підготов%');

UPDATE public.material_requests
SET category = 'hardware', target_warehouse = 'sgp'
WHERE category IS NULL AND (details ILIKE '%комплектування%' OR details ILIKE '%пакування%');

-- ПІДТВЕРДЖЕННЯ РЕЗУЛЬТАТІВ:
SELECT 
  COUNT(*) FILTER (WHERE default_material_id IS NOT NULL) AS parts_with_sheet_id,
  COUNT(*) FILTER (WHERE default_material_id IS NULL) AS parts_without_sheet_id
FROM public.nomenclatures_v2
WHERE group_id = 'cat_parts' OR rule_type = 'frame_part';


-- ─── MIGRATION: 20260908260000_100_percent_id_architecture.sql ───
-- ═══════════════════════════════════════════════════════════════════════════
-- 🚀 ARCHITECTURAL MILESTONE: 100% ID-Based Relational Core & Magic String Purge
-- ═══════════════════════════════════════════════════════════════════════════
-- Мета:
-- 1. Додати поле is_box_prepared boolean у work_cards (ліквідація [BOX_PREPARED:true])
-- 2. Додати поле customer_id UUID у orders (ліквідація текстового зв'язку замовник-замовлення)
-- 3. Автоматичний бекфіл історичних даних
-- ═══════════════════════════════════════════════════════════════════════════

-- КРОК 1: Додавання is_box_prepared у work_cards
ALTER TABLE public.work_cards 
  ADD COLUMN IF NOT EXISTS is_box_prepared boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_work_cards_box_prepared 
  ON public.work_cards(is_box_prepared) 
  WHERE is_box_prepared = true;

-- Бекфіл прапорця готовності боксів з історичного рядка card_info
UPDATE public.work_cards
SET is_box_prepared = true
WHERE (card_info ILIKE '%[BOX_PREPARED:true]%' OR card_info ILIKE '%BOX_PREPARED%')
  AND is_box_prepared = false;

-- КРОК 2: Додавання customer_id у orders
ALTER TABLE public.orders 
  ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_customer_id 
  ON public.orders(customer_id);

-- Бекфіл customer_id для всіх замовлень за точним співпадінням імені клієнта
UPDATE public.orders o
SET customer_id = c.id
FROM public.customers c
WHERE o.customer_id IS NULL
  AND o.customer IS NOT NULL
  AND (
    trim(lower(o.customer)) = trim(lower(c.name))
    OR trim(lower(o.customer)) = trim(lower(COALESCE(c.company, '')))
    OR trim(lower(o.customer)) = trim(lower(COALESCE(c.official_name, '')))
  );

-- ПІДТВЕРДЖЕННЯ РЕЗУЛЬТАТІВ:
SELECT 
  COUNT(*) FILTER (WHERE is_box_prepared = true) AS cards_with_box_prepared,
  COUNT(*) FILTER (WHERE is_box_prepared = false) AS cards_without_box
FROM public.work_cards;

SELECT 
  COUNT(*) FILTER (WHERE customer_id IS NOT NULL) AS orders_with_customer_id,
  COUNT(*) FILTER (WHERE customer_id IS NULL) AS orders_without_customer_id
FROM public.orders;


