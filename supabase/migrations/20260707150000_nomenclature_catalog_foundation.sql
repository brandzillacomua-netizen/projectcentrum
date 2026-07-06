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
