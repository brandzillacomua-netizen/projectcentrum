-- Migration: Add updated_at to realtime tables
-- Description: Adds updated_at column to tasks, orders, work_cards, and material_requests to fix 400 Bad Request during incremental catch-up.

create or replace function public.auto_update_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Table: tasks
alter table public.tasks add column if not exists updated_at timestamptz not null default now();
drop trigger if exists trg_tasks_updated_at on public.tasks;
create trigger trg_tasks_updated_at
  before update on public.tasks
  for each row execute function public.auto_update_updated_at();
create index if not exists idx_tasks_updated_at on public.tasks(updated_at desc);

-- Table: orders
alter table public.orders add column if not exists updated_at timestamptz not null default now();
drop trigger if exists trg_orders_updated_at on public.orders;
create trigger trg_orders_updated_at
  before update on public.orders
  for each row execute function public.auto_update_updated_at();
create index if not exists idx_orders_updated_at on public.orders(updated_at desc);

-- Table: work_cards
alter table public.work_cards add column if not exists updated_at timestamptz not null default now();
drop trigger if exists trg_work_cards_updated_at on public.work_cards;
create trigger trg_work_cards_updated_at
  before update on public.work_cards
  for each row execute function public.auto_update_updated_at();
create index if not exists idx_work_cards_updated_at on public.work_cards(updated_at desc);

-- Table: material_requests
alter table public.material_requests add column if not exists updated_at timestamptz not null default now();
drop trigger if exists trg_material_requests_updated_at on public.material_requests;
create trigger trg_material_requests_updated_at
  before update on public.material_requests
  for each row execute function public.auto_update_updated_at();
create index if not exists idx_material_requests_updated_at on public.material_requests(updated_at desc);

-- Add updated_at to publication if needed (not strictly required since they are probably already published, but good practice if columns are added later, though Supabase handles this automatically usually).
