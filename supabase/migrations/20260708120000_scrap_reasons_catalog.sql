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
