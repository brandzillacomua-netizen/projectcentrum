begin;

-- Inventory was accidentally re-linked to an arbitrary legacy nomenclature row
-- by 20260909170000 when public.nomenclatures contained duplicate names.  The
-- application and work cards use the V2 master ID, so restore that deterministic
-- relationship wherever the V2 name is unambiguous.
with canonical_v2 as (
  select lower(btrim(name)) as normalized_name, (array_agg(id order by id))[1] as id
  from public.nomenclatures_v2
  where nullif(btrim(name), '') is not null
  group by lower(btrim(name))
  having count(*) = 1
)
update public.inventory i
set nomenclature_id = c.id,
    updated_at = clock_timestamp()
from canonical_v2 c
where lower(btrim(i.name)) = c.normalized_name
  and i.nomenclature_id is distinct from c.id;

-- Match and conflict on the same identity that the inventory table enforces:
-- name + type + warehouse + pocket owner.  The previous implementation looked
-- up only nomenclature_id + type, then attempted an INSERT that collided with
-- inventory_name_type_warehouse_owner_unique when a legacy ID was present.
create or replace function public.rpc_increment_inventory_stock(
  p_nomenclature_id uuid,
  p_qty numeric,
  p_type text default 'scrap_ready',
  p_item_name text default 'Деталь',
  p_unit text default 'шт'
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, public
as $inventory_increment$
declare
  v_inv_id uuid;
  v_old_qty numeric := 0;
  v_new_qty numeric := 0;
  v_nom_name text;
  v_nom_unit text;
  v_can_relink boolean := false;
begin
  if p_nomenclature_id is null or p_qty is null or p_qty <= 0 then
    return jsonb_build_object(
      'success', false,
      'error', 'Invalid nomenclature_id or non-positive quantity'
    );
  end if;

  select n.name, n.unit, true
    into v_nom_name, v_nom_unit, v_can_relink
    from public.nomenclatures_v2 n
   where n.id = p_nomenclature_id;

  if not found then
    select n.name, n.unit
      into v_nom_name, v_nom_unit
      from public.nomenclatures n
     where n.id = p_nomenclature_id;
  end if;

  v_nom_name := coalesce(nullif(btrim(v_nom_name), ''), nullif(btrim(p_item_name), ''), 'Деталь');
  v_nom_unit := coalesce(nullif(btrim(v_nom_unit), ''), nullif(btrim(p_unit), ''), 'шт');

  -- Serialize different IDs that resolve to the same physical inventory row.
  perform pg_advisory_xact_lock(hashtextextended(
    lower(v_nom_name) || '|' || coalesce(p_type, '') || '|operational|', 0
  ));

  select i.id, coalesce(i.total_qty, 0)
    into v_inv_id, v_old_qty
    from public.inventory i
   where i.type is not distinct from p_type
     and i.warehouse is not distinct from 'operational'
     and i.pocket_owner is null
     and (
       i.nomenclature_id = p_nomenclature_id
       or lower(btrim(i.name)) = lower(v_nom_name)
     )
   order by case when i.nomenclature_id = p_nomenclature_id then 0 else 1 end,
            i.created_at,
            i.id
   limit 1
   for update;

  if found then
    v_new_qty := v_old_qty + p_qty;
    update public.inventory
       set total_qty = v_new_qty,
           nomenclature_id = case when v_can_relink then p_nomenclature_id else nomenclature_id end,
           name = v_nom_name,
           unit = v_nom_unit,
           updated_at = clock_timestamp()
     where id = v_inv_id;

    return jsonb_build_object(
      'success', true,
      'id', v_inv_id,
      'prev_qty', v_old_qty,
      'new_qty', v_new_qty,
      'action', 'updated'
    );
  end if;

  insert into public.inventory (
    nomenclature_id, name, unit, total_qty, type, warehouse, pocket_owner, updated_at
  ) values (
    p_nomenclature_id, v_nom_name, v_nom_unit, p_qty, p_type, 'operational', null, clock_timestamp()
  )
  on conflict on constraint inventory_name_type_warehouse_owner_unique
  do update set
    total_qty = coalesce(public.inventory.total_qty, 0) + excluded.total_qty,
    nomenclature_id = case when v_can_relink then excluded.nomenclature_id else public.inventory.nomenclature_id end,
    unit = excluded.unit,
    updated_at = clock_timestamp()
  returning id, total_qty into v_inv_id, v_new_qty;

  return jsonb_build_object(
    'success', true,
    'id', v_inv_id,
    'prev_qty', v_new_qty - p_qty,
    'new_qty', v_new_qty,
    'action', case when v_new_qty = p_qty then 'inserted' else 'updated_after_conflict' end
  );
end;
$inventory_increment$;

revoke all on function public.rpc_increment_inventory_stock(uuid, numeric, text, text, text) from public;
grant execute on function public.rpc_increment_inventory_stock(uuid, numeric, text, text, text)
  to anon, authenticated, service_role;

comment on function public.rpc_increment_inventory_stock(uuid, numeric, text, text, text) is
  'Atomically increments operational inventory using the same name/type/warehouse/owner identity as the table unique constraint and repairs legacy nomenclature IDs.';

-- Production did not have the guaranteed sorting-history RPC, so the browser
-- compatibility path inserted the same Sorting/Buffer history again on every
-- retry. Install the idempotency receipt and RPC in the current schema.
create table if not exists public.mes_sorting_history_receipts (
  card_id uuid primary key references public.work_cards(id) on delete cascade,
  sorting_history_id uuid,
  buffer_history_id uuid,
  scrap_qty numeric not null check (scrap_qty >= 0),
  recorded_at timestamptz not null default clock_timestamp()
);

alter table public.mes_sorting_history_receipts enable row level security;
revoke all on table public.mes_sorting_history_receipts from public, anon, authenticated;

create or replace function public.record_sorting_history_once(
  p_card_id uuid,
  p_nomenclature_id uuid,
  p_operator_name text,
  p_buffer_operator_name text,
  p_shift_name text,
  p_qty_at_start numeric,
  p_qty_completed numeric,
  p_scrap_qty numeric,
  p_started_at timestamptz,
  p_stage_completed_at timestamptz,
  p_buffer_completed_at timestamptz,
  p_manager_name text default null,
  p_machine_name text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, public
as $sorting_history$
declare
  v_receipt public.mes_sorting_history_receipts%rowtype;
  v_sorting_history_id uuid;
  v_buffer_history_id uuid;
  v_card public.work_cards%rowtype;
begin
  if p_card_id is null or p_nomenclature_id is null then
    raise exception 'card_id and nomenclature_id are required' using errcode = '22004';
  end if;
  if coalesce(p_qty_at_start, 0) < 0
     or coalesce(p_qty_completed, 0) < 0
     or coalesce(p_scrap_qty, 0) < 0
     or coalesce(p_qty_completed, 0) + coalesce(p_scrap_qty, 0) > coalesce(p_qty_at_start, 0) then
    raise exception 'invalid sorting quantities' using errcode = '22003';
  end if;

  select * into v_card
    from public.work_cards
   where id = p_card_id
   for update;
  if not found then
    raise exception 'work card % does not exist', p_card_id using errcode = 'P0002';
  end if;
  if v_card.nomenclature_id is distinct from p_nomenclature_id then
    raise exception 'nomenclature mismatch for work card %', p_card_id using errcode = '22023';
  end if;
  if v_card.operation is distinct from 'Сортування'
     or v_card.status not in ('in-progress', 'at-buffer', 'at-shop2-buffer') then
    raise exception 'work card % is not in a sortable state (% / %)', p_card_id, v_card.operation, v_card.status
      using errcode = '55000';
  end if;

  select * into v_receipt
    from public.mes_sorting_history_receipts
   where card_id = p_card_id;
  if found then
    if v_receipt.scrap_qty is distinct from coalesce(p_scrap_qty, 0) then
      raise exception 'sorting retry for card % has a different scrap quantity', p_card_id using errcode = '22023';
    end if;
    return jsonb_build_object(
      'created', false,
      'sortingHistoryId', v_receipt.sorting_history_id,
      'bufferHistoryId', v_receipt.buffer_history_id,
      'scrapQty', v_receipt.scrap_qty
    );
  end if;

  insert into public.work_card_history (
    card_id, nomenclature_id, stage_name, operator_name,
    qty_at_start, qty_completed, scrap_qty,
    started_at, completed_at, is_archived_scrap,
    shift_name, manager_name, machine_name
  ) values (
    p_card_id, p_nomenclature_id, 'Сортування', nullif(btrim(p_operator_name), ''),
    coalesce(p_qty_at_start, 0), coalesce(p_qty_completed, 0), coalesce(p_scrap_qty, 0),
    coalesce(p_started_at, clock_timestamp()), coalesce(p_stage_completed_at, clock_timestamp()),
    coalesce(p_scrap_qty, 0) > 0,
    nullif(btrim(p_shift_name), ''), nullif(btrim(p_manager_name), ''), nullif(btrim(p_machine_name), '')
  ) returning id into v_sorting_history_id;

  insert into public.work_card_history (
    card_id, nomenclature_id, stage_name, operator_name,
    qty_at_start, qty_completed, scrap_qty,
    started_at, completed_at, is_archived_scrap,
    shift_name, manager_name, machine_name
  ) values (
    p_card_id, p_nomenclature_id, 'Буфер Сортування', nullif(btrim(p_buffer_operator_name), ''),
    coalesce(p_qty_completed, 0), coalesce(p_qty_completed, 0), 0,
    coalesce(p_stage_completed_at, p_started_at, clock_timestamp()),
    coalesce(p_buffer_completed_at, clock_timestamp()), false,
    nullif(btrim(p_shift_name), ''), nullif(btrim(p_manager_name), ''), nullif(btrim(p_machine_name), '')
  ) returning id into v_buffer_history_id;

  insert into public.mes_sorting_history_receipts (
    card_id, sorting_history_id, buffer_history_id, scrap_qty
  ) values (
    p_card_id, v_sorting_history_id, v_buffer_history_id, coalesce(p_scrap_qty, 0)
  );

  return jsonb_build_object(
    'created', true,
    'sortingHistoryId', v_sorting_history_id,
    'bufferHistoryId', v_buffer_history_id,
    'scrapQty', coalesce(p_scrap_qty, 0)
  );
end;
$sorting_history$;

revoke all on function public.record_sorting_history_once(
  uuid, uuid, text, text, text, numeric, numeric, numeric,
  timestamptz, timestamptz, timestamptz, text, text
) from public;
grant execute on function public.record_sorting_history_once(
  uuid, uuid, text, text, text, numeric, numeric, numeric,
  timestamptz, timestamptz, timestamptz, text, text
) to anon, authenticated, service_role;

-- One-time, rerunnable recovery for the five cards that advanced to the Shop 2
-- buffer while their inventory write failed. The baseline checks deliberately
-- abort instead of risking a double increment if production data changed after
-- the 2026-09-10 audit.
create table if not exists public.mes_sorting_inventory_repair_receipts (
  card_id uuid primary key references public.work_cards(id) on delete restrict,
  nomenclature_id uuid not null,
  repaired_qty numeric not null check (repaired_qty > 0),
  repaired_at timestamptz not null default clock_timestamp()
);

revoke all on table public.mes_sorting_inventory_repair_receipts from public, anon, authenticated;

do $sorting_repair$
declare
  v_north_repaired integer;
  v_upper_repaired integer;
  v_north_qty numeric;
  v_upper_qty numeric;
begin
  select count(*) into v_north_repaired
    from public.mes_sorting_inventory_repair_receipts
   where nomenclature_id = '20886010-951a-41ca-af31-67ba987d0b3e'::uuid;
  select count(*) into v_upper_repaired
    from public.mes_sorting_inventory_repair_receipts
   where nomenclature_id = '91059aca-e0f9-4bfc-a311-c65f3b190061'::uuid;

  if v_north_repaired = 0 then
    select total_qty into v_north_qty
      from public.inventory
     where nomenclature_id = '20886010-951a-41ca-af31-67ba987d0b3e'::uuid
       and type = 'semi_shop2' and warehouse = 'operational' and pocket_owner is null
     for update;
    if v_north_qty is distinct from 498 then
      raise exception 'Recovery stopped: expected Н-3-14 semi_shop2 baseline 498, found %', v_north_qty;
    end if;
  end if;

  if v_upper_repaired = 0 then
    select total_qty into v_upper_qty
      from public.inventory
     where nomenclature_id = '91059aca-e0f9-4bfc-a311-c65f3b190061'::uuid
       and type = 'semi_shop2' and warehouse = 'operational' and pocket_owner is null
     for update;
    if v_upper_qty is distinct from 85 then
      raise exception 'Recovery stopped: expected В-3-30 semi_shop2 baseline 85, found %', v_upper_qty;
    end if;
  end if;

  with candidates(card_id, nomenclature_id, repaired_qty) as (values
    ('471795e0-b75e-4eb6-9ccb-20ef951a7e07'::uuid, '20886010-951a-41ca-af31-67ba987d0b3e'::uuid, 56::numeric),
    ('6be2be4a-3e11-4b5f-b797-3f596456a3d6'::uuid, '20886010-951a-41ca-af31-67ba987d0b3e'::uuid, 56::numeric),
    ('73e8c911-ad1a-433c-942c-5ac1e889acde'::uuid, '20886010-951a-41ca-af31-67ba987d0b3e'::uuid, 56::numeric),
    ('d7cb62a7-cd44-4ba4-ab3a-b44014696f50'::uuid, '20886010-951a-41ca-af31-67ba987d0b3e'::uuid, 56::numeric),
    ('728207f1-cf1b-4216-982c-648b701a8b34'::uuid, '91059aca-e0f9-4bfc-a311-c65f3b190061'::uuid, 120::numeric)
  ), verified as (
    select c.*
      from candidates c
      join public.work_cards wc on wc.id = c.card_id
       and wc.nomenclature_id = c.nomenclature_id
       and wc.status = 'at-shop2-buffer'
       and wc.operation = 'Сортування'
       and greatest(coalesce(wc.quantity, 0) - coalesce(wc.used_in_shop2_qty, 0), 0) = c.repaired_qty
  ), inserted as (
    insert into public.mes_sorting_inventory_repair_receipts(card_id, nomenclature_id, repaired_qty)
    select card_id, nomenclature_id, repaired_qty from verified
    on conflict (card_id) do nothing
    returning nomenclature_id, repaired_qty
  ), totals as (
    select nomenclature_id, sum(repaired_qty) as repaired_qty
      from inserted
     group by nomenclature_id
  )
  update public.inventory i
     set total_qty = coalesce(i.total_qty, 0) + t.repaired_qty,
         updated_at = clock_timestamp()
    from totals t
   where i.nomenclature_id = t.nomenclature_id
     and i.type = 'semi_shop2'
     and i.warehouse = 'operational'
     and i.pocket_owner is null;
end;
$sorting_repair$;

commit;
