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
