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
