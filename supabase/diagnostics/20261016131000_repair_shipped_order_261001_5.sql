-- ONE-TIME PRODUCTION REPAIR
-- Order: 261001-5
-- Expected orphaned SGP reserve: total_qty=7543 and reserved_qty=3474.
--
-- Safe to re-run: after a successful run the exact source values no longer
-- exist, so the script stops before changing inventory again.

set lock_timeout = '5s';
set statement_timeout = '60s';

begin;

do $$
declare
  v_order_id uuid;
  v_canonical_id uuid;
  v_matching_rows integer;
  v_total_qty numeric;
  v_reserved_qty numeric;
begin
  select o.id
  into v_order_id
  from public.orders o
  where o.order_num = '261001-5'
  for update;

  if v_order_id is null then
    raise exception 'Order 261001-5 was not found';
  end if;

  if not exists (
    select 1
    from public.tasks t
    where t.order_id = v_order_id
      and coalesce((t.plan_snapshot #>> '{_metadata,is_shipped}')::boolean, false)
  ) then
    raise exception 'Order 261001-5 is not marked as shipped';
  end if;

  select n.id
  into v_canonical_id
  from public.nomenclatures_v2 n
  where n.code = 'V2-90800';

  if v_canonical_id is null then
    raise exception 'Nomenclature V2-90800 was not found';
  end if;

  -- The SGP screen groups several physical inventory rows by canonical V2 ID.
  -- Validate the same grouped totals that are visible in the interface.
  select
    count(*),
    coalesce(sum(i.total_qty), 0),
    coalesce(sum(i.reserved_qty), 0)
  into v_matching_rows, v_total_qty, v_reserved_qty
  from public.inventory i
  where (
      i.nomenclature_id = v_canonical_id
      or exists (
        select 1
        from public.nomenclature_v2_aliases a
        where a.legacy_id = i.nomenclature_id
          and a.canonical_id = v_canonical_id
      )
    )
    and (
      i.warehouse = 'sgp'
      or lower(coalesce(i.type, '')) in (
        'finished', 'part', 'product', 'bz', 'bz_shop2',
        'wip_bz', 'semi', 'semi_shop2'
      )
    );

  if v_matching_rows = 0 or v_total_qty <> 7543 or v_reserved_qty <> 3474 then
    raise exception
      'Repair aborted: V2-90800 has % SGP row(s), total %, reserve %; expected grouped total 7543 and reserve 3474',
      v_matching_rows,
      v_total_qty,
      v_reserved_qty;
  end if;

  perform 1
  from public.inventory i
  where (
      i.nomenclature_id = v_canonical_id
      or exists (
        select 1
        from public.nomenclature_v2_aliases a
        where a.legacy_id = i.nomenclature_id
          and a.canonical_id = v_canonical_id
      )
    )
    and (
      i.warehouse = 'sgp'
      or lower(coalesce(i.type, '')) in (
        'finished', 'part', 'product', 'bz', 'bz_shop2',
        'wip_bz', 'semi', 'semi_shop2'
      )
    )
  order by i.id
  for update;

  if exists (
    select 1
    from public.inventory i
    where (
        i.nomenclature_id = v_canonical_id
        or exists (
          select 1
          from public.nomenclature_v2_aliases a
          where a.legacy_id = i.nomenclature_id
            and a.canonical_id = v_canonical_id
        )
      )
      and (
        i.warehouse = 'sgp'
        or lower(coalesce(i.type, '')) in (
          'finished', 'part', 'product', 'bz', 'bz_shop2',
          'wip_bz', 'semi', 'semi_shop2'
        )
      )
      and coalesce(i.reserved_qty, 0) > coalesce(i.total_qty, 0)
  ) then
    raise exception 'Repair aborted: one of the physical rows has reserve greater than total';
  end if;

  -- Exact one-time correction for goods that have physically left the warehouse.
  -- Each physical row consumes its own reserved quantity; grouped deduction is 3474.
  update public.inventory i
  set total_qty = i.total_qty - i.reserved_qty,
      reserved_qty = 0,
      updated_at = now()
  where (
      i.nomenclature_id = v_canonical_id
      or exists (
        select 1
        from public.nomenclature_v2_aliases a
        where a.legacy_id = i.nomenclature_id
          and a.canonical_id = v_canonical_id
      )
    )
    and (
      i.warehouse = 'sgp'
      or lower(coalesce(i.type, '')) in (
        'finished', 'part', 'product', 'bz', 'bz_shop2',
        'wip_bz', 'semi', 'semi_shop2'
      )
    )
    and i.reserved_qty > 0;

  if not found then
    raise exception 'Repair aborted: no reserved physical rows were updated';
  end if;

  raise notice
    'Order 261001-5 repaired: V2-90800 changed from 7543/3474 to 4069/0';
end;
$$;

-- Verification result. Expected for F415-421-ІП27-В-3-26:
-- total_qty = 4069, reserved_qty = 0, free_qty = 4069.
with target as (
  select id
  from public.nomenclatures_v2
  where code = 'V2-90800'
), rows as (
  select i.*
  from public.inventory i
  cross join target t
  where i.nomenclature_id = t.id
     or exists (
       select 1
       from public.nomenclature_v2_aliases a
       where a.legacy_id = i.nomenclature_id
         and a.canonical_id = t.id
     )
)
select
  'V2-90800' as article,
  coalesce(sum(total_qty), 0) as total_qty,
  coalesce(sum(reserved_qty), 0) as reserved_qty,
  coalesce(sum(total_qty - reserved_qty), 0) as free_qty
from rows
where warehouse = 'sgp'
   or lower(coalesce(type, '')) in (
     'finished', 'part', 'product', 'bz', 'bz_shop2',
     'wip_bz', 'semi', 'semi_shop2'
   );

commit;
