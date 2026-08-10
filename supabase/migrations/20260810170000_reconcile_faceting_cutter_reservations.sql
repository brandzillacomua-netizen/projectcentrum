-- Card-level cutter issuance used to deduct total stock without releasing the
-- task-level reservation. Rebuild faceting-cutter reservations from their
-- actual active issued requests so restored cutters become available again.

with expected_reservations as (
  select
    i.id as inventory_id,
    coalesce(sum(mr.quantity) filter (where mr.status = 'issued'), 0) as reserved_qty
  from public.inventory i
  left join public.material_requests mr
    on mr.inventory_id = i.id
  where i.warehouse = 'operational'
    and i.type = 'consumable'
    and public.is_faceting_cutter(i.nomenclature_id)
  group by i.id
)
update public.inventory i
set reserved_qty = e.reserved_qty,
    updated_at = now()
from expected_reservations e
where i.id = e.inventory_id
  and coalesce(i.reserved_qty, 0) is distinct from e.reserved_qty;
