-- Migration: Add Sys Sync Pings Realtime Table
-- rollout-contract: v1
-- risk: low
-- transaction: transactional
-- preflight: supabase/diagnostics/20260914040000_add_sys_sync_pings_preflight.sql
-- postcondition: supabase/diagnostics/20260914040000_add_sys_sync_pings_postcondition.sql
-- rollback: supabase/rollbacks/20260914040000_add_sys_sync_pings_rollback.sql

SET lock_timeout = '5s';
SET statement_timeout = '15s';

BEGIN;

create table if not exists public.sys_sync_pings (
  table_name text primary key,
  updated_at timestamp with time zone default now()
);

alter table public.sys_sync_pings enable row level security;

drop policy if exists "Allow read access to all users" on public.sys_sync_pings;
drop policy if exists "Allow all to update" on public.sys_sync_pings;

create policy "Allow read access to authenticated" on public.sys_sync_pings
  for select to authenticated using (true);

create or replace function public.fn_sys_sync_ping()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $body$
begin
  insert into public.sys_sync_pings (table_name, updated_at)
  values (TG_TABLE_NAME, now())
  on conflict (table_name) do update
  set updated_at = now();
  return null;
end;
$body$;

revoke execute on function public.fn_sys_sync_ping() from public, anon, authenticated;

-- Create triggers for heavy tables
drop trigger if exists trg_sync_ping_tasks on public.tasks;
create trigger trg_sync_ping_tasks
after insert or update or delete on public.tasks
for each statement execute function public.fn_sys_sync_ping();

drop trigger if exists trg_sync_ping_orders on public.orders;
create trigger trg_sync_ping_orders
after insert or update or delete on public.orders
for each statement execute function public.fn_sys_sync_ping();

drop trigger if exists trg_sync_ping_work_cards on public.work_cards;
create trigger trg_sync_ping_work_cards
after insert or update or delete on public.work_cards
for each statement execute function public.fn_sys_sync_ping();

drop trigger if exists trg_sync_ping_inventory on public.inventory;
create trigger trg_sync_ping_inventory
after insert or update or delete on public.inventory
for each statement execute function public.fn_sys_sync_ping();

drop trigger if exists trg_sync_ping_material_req on public.material_requests;
create trigger trg_sync_ping_material_req
after insert or update or delete on public.material_requests
for each statement execute function public.fn_sys_sync_ping();

-- Enable realtime for the ping table
do $publication$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'sys_sync_pings'
     ) then
    alter publication supabase_realtime add table public.sys_sync_pings;
  end if;
end;
$publication$;

COMMIT;
