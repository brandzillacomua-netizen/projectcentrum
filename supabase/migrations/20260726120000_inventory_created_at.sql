-- BZ reservation functions use deterministic FIFO ordering for inventory rows.
-- Older installations of inventory only had updated_at, so creating a naryad
-- failed with: column "created_at" does not exist.
alter table public.inventory
  add column if not exists created_at timestamptz not null default now();

create index if not exists idx_inventory_created_at
  on public.inventory (created_at, id);
