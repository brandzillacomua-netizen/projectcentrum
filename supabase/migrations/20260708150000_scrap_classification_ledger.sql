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
