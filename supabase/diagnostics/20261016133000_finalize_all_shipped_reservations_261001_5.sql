-- ONE-TIME PRODUCTION REPAIR, scoped to exact request IDs from the live diagnostic.
-- Order 261001-5 shipped 52,500 pcs.
-- 335 pcs were consumed by the original reservations.
-- 3,474 pcs (F415-421-ІП27-В-3-26) were already consumed by the prior repair.
-- This transaction consumes the remaining 48,691 pcs and completes all ten
-- packaging request rows, including the already-consumed 3,474-pcs request.

set lock_timeout = '5s';
set statement_timeout = '60s';

begin;

create temporary table _shipment_request_manifest (
  request_id uuid primary key,
  inventory_id uuid not null,
  expected_qty numeric not null,
  deduct_physical boolean not null
) on commit drop;

insert into _shipment_request_manifest
  (request_id, inventory_id, expected_qty, deduct_physical)
values
  ('54947b43-566d-4c16-ae89-af61d86035b5', '81eeb3fa-e102-4a8f-a43d-654046988878', 3500, true),
  ('c8db9f33-b324-4c67-be2f-3bc804ca1b36', '6c968d97-fc42-48f9-b58a-e5f4c913e5ff', 7000, true),
  ('cc2564e5-c3d6-4f13-a37b-500d15674576', 'e13372a9-21c1-437c-80c2-658cf27eefcb', 3500, true),
  ('a0cc228d-e18e-4233-b33b-af53a845e83d', '57a15e2f-18bf-4e76-afb8-33946b75bccd', 14000, true),
  ('1ee0e3cf-b371-4eac-a771-2e4a96e52833', '798739b4-c227-4fcc-b2cb-216235271417', 11855, true),
  ('5838c9b2-7811-4d96-b8bb-851bddd546d6', '64506f2c-315f-4dfe-8faa-661c12eec6ef', 3413, true),
  -- Physical stock for this request was already deducted by the first repair.
  ('a37836cb-3901-4548-8b5e-0a10d1090b91', '3d0b7571-55a6-4d51-af25-f9cbe5a2bcd0', 3474, false),
  ('c6790d92-cc07-4b07-a3e3-9e8b2d1aeb47', '950bb335-0b7a-4daf-828c-895cc2cfa4fa', 3396, true),
  ('39ffa975-bc13-4a09-b282-88509449182d', 'b3d5630f-bdff-4895-b46d-17a48d80bd0b', 33, true),
  ('f9c208e7-b4c3-4383-8a84-0de97f0270d0', '2c159408-0630-4ff8-93e9-dcac961cb546', 1994, true);

do $$
declare
  v_order_id constant uuid := '62330578-eb54-401c-8258-c2efd660780e';
  v_request_count integer;
  v_bad_count integer;
  v_deduction record;
begin
  if not exists (
    select 1
    from public.orders o
    where o.id = v_order_id
      and o.order_num = '261001-5'
      and o.status = 'shipped'
    for update
  ) then
    raise exception 'Repair aborted: shipped order 261001-5 was not found';
  end if;

  select count(*)
  into v_request_count
  from public.material_requests mr
  join _shipment_request_manifest m on m.request_id = mr.id;

  if v_request_count <> 10 then
    raise exception 'Repair aborted: expected 10 exact request rows, found %', v_request_count;
  end if;

  select count(*)
  into v_bad_count
  from _shipment_request_manifest m
  join public.material_requests mr on mr.id = m.request_id
  where mr.order_id is distinct from v_order_id
     or mr.inventory_id is distinct from m.inventory_id
     or mr.quantity is distinct from m.expected_qty
     or mr.status <> 'issued'
     or mr.details not ilike '%ЗАПИТ НА КОМПЛЕКТУВАННЯ%';

  if v_bad_count <> 0 then
    raise exception
      'Repair aborted: % exact request row(s) changed since the diagnostic; no data was modified',
      v_bad_count;
  end if;

  perform 1
  from public.material_requests mr
  join _shipment_request_manifest m on m.request_id = mr.id
  order by mr.id
  for update of mr;

  perform 1
  from public.inventory i
  join _shipment_request_manifest m on m.inventory_id = i.id
  where m.deduct_physical
  order by i.id
  for update of i;

  select count(*)
  into v_bad_count
  from (
    select
      m.inventory_id,
      sum(m.expected_qty) as qty,
      i.total_qty,
      i.reserved_qty
    from _shipment_request_manifest m
    join public.inventory i on i.id = m.inventory_id
    where m.deduct_physical
    group by m.inventory_id, i.total_qty, i.reserved_qty
  ) checked
  where checked.total_qty < checked.qty
     or checked.reserved_qty < checked.qty;

  if v_bad_count <> 0 then
    raise exception
      'Repair aborted: % inventory row(s) no longer contain the required physical/reserved quantity',
      v_bad_count;
  end if;

  for v_deduction in
    select m.inventory_id, sum(m.expected_qty) as qty
    from _shipment_request_manifest m
    where m.deduct_physical
    group by m.inventory_id
    order by m.inventory_id
  loop
    update public.inventory
    set total_qty = total_qty - v_deduction.qty,
        reserved_qty = reserved_qty - v_deduction.qty,
        updated_at = now()
    where id = v_deduction.inventory_id;
  end loop;

  update public.material_requests mr
  set status = 'completed'
  from _shipment_request_manifest m
  where mr.id = m.request_id;

  -- Close the old allocation ledger rows for the already-consumed initial 335 pcs.
  update public.bz_inventory_reservations
  set status = 'released',
      released_at = coalesce(released_at, now()),
      release_reason = coalesce(release_reason, 'Order 261001-5 shipped; one-time inventory reconciliation')
  where order_id = v_order_id
    and status = 'allocated';

  update public.tasks t
  set plan_snapshot = jsonb_set(
    coalesce(t.plan_snapshot, '{}'::jsonb),
    '{_metadata}',
    coalesce(t.plan_snapshot->'_metadata', '{}'::jsonb)
      || jsonb_build_object(
        'sgp_inventory_repair_261001_5_complete', true,
        'sgp_inventory_repair_261001_5_at', now()::text
      ),
    true
  )
  where t.order_id = v_order_id;

  raise notice
    'Order 261001-5 repaired: deducted 48691 remaining pcs and completed 10 packaging requests';
end;
$$;

select
  mr.id as request_id,
  mr.status,
  mr.quantity,
  mr.inventory_id,
  i.total_qty,
  i.reserved_qty,
  i.total_qty - i.reserved_qty as free_qty
from _shipment_request_manifest m
join public.material_requests mr on mr.id = m.request_id
join public.inventory i on i.id = mr.inventory_id
order by mr.inventory_id, mr.id;

commit;
