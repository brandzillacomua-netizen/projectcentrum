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
