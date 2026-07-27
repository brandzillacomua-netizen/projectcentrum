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
