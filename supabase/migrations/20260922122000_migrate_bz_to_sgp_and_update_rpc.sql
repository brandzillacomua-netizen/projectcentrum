-- 1. Drop old 5-parameter signature if it exists to avoid overload ambiguity
drop function if exists public.rpc_increment_inventory_stock(uuid, numeric, text, text, text);

-- Update rpc_increment_inventory_stock to accept p_warehouse
create or replace function public.rpc_increment_inventory_stock(
  p_nomenclature_id uuid,
  p_qty numeric,
  p_type text default 'scrap_ready',
  p_item_name text default 'Деталь',
  p_unit text default 'шт',
  p_warehouse text default 'operational'
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
  v_safe_warehouse text;
begin
  if p_nomenclature_id is null or p_qty is null or p_qty <= 0 then
    return jsonb_build_object(
      'success', false,
      'error', 'Invalid nomenclature_id or non-positive quantity'
    );
  end if;

  v_safe_warehouse := coalesce(nullif(btrim(p_warehouse), ''), 'operational');

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

  perform pg_advisory_xact_lock(hashtextextended(
    lower(v_nom_name) || '|' || coalesce(p_type, '') || '|' || v_safe_warehouse || '|', 0
  ));

  select i.id, coalesce(i.total_qty, 0)
    into v_inv_id, v_old_qty
    from public.inventory i
   where i.type is not distinct from p_type
     and i.warehouse is not distinct from v_safe_warehouse
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
    p_nomenclature_id, v_nom_name, v_nom_unit, p_qty, p_type, v_safe_warehouse, null, clock_timestamp()
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

-- 2. Update return_legacy_restoration_to_bz to push to SGP
create or replace function public.return_legacy_restoration_to_bz(
  p_restoration_card_id uuid,
  p_returned_by text default null
) returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $body$
declare
  v_restoration public.vkya_restoration_cards%rowtype;
  v_inventory_id uuid;
  v_inventory_qty numeric;
  v_nom_name text;
  v_nom_unit text;
begin
  select * into v_restoration from public.vkya_restoration_cards
  where id = p_restoration_card_id for update;
  if not found then raise exception 'Карту відновлення не знайдено'; end if;
  if v_restoration.status <> 'completed' then raise exception 'Спочатку завершіть карту відновлення'; end if;
  if v_restoration.completed_quantity <= 0 then raise exception 'Немає відновлених деталей для повернення'; end if;
  if v_restoration.route_card_id is not null or v_restoration.shop2_card_id is not null then
    raise exception 'Карту вже оброблено';
  end if;

  select name, unit into v_nom_name, v_nom_unit
    from public.nomenclatures where id = v_restoration.nomenclature_id;

  select id, total_qty into v_inventory_id, v_inventory_qty
    from public.inventory
   where nomenclature_id = v_restoration.nomenclature_id 
     and type = 'part' 
     and warehouse = 'sgp'
   order by updated_at desc nulls last limit 1 for update;

  if v_inventory_id is null then
    insert into public.inventory (nomenclature_id, name, unit, total_qty, reserved_qty, type, warehouse, pocket_owner, updated_at)
    values (v_restoration.nomenclature_id, coalesce(v_nom_name, 'Деталь'), coalesce(v_nom_unit, 'шт'), v_restoration.completed_quantity, 0, 'part', 'sgp', null, now());
  else
    update public.inventory set total_qty = total_qty + v_restoration.completed_quantity, updated_at = now()
    where id = v_inventory_id;
  end if;

  insert into public.inventory_logs (
    nomenclature_id, action, qty_changed, prev_qty, new_qty, reason, user_name, target_type
  ) values (
    v_restoration.nomenclature_id, 'add', v_restoration.completed_quantity, coalesce(v_inventory_qty, 0), coalesce(v_inventory_qty, 0) + v_restoration.completed_quantity,
    format('Повернення з ВКЯ (Старий БЗ) -> СГП (Картка #%s)', v_restoration.card_number),
    coalesce(p_returned_by, v_restoration.operator_name, 'ВКЯ'), 'part'
  );

  update public.vkya_restoration_cards set
    shop2_card_id = '00000000-0000-0000-0000-000000000000', 
    shop2_stage = 'СГП (Склад)',
    transferred_to_shop2_at = now(), updated_at = now()
  where id = v_restoration.id;
end;
$body$;

-- 3. Data Migration: Move existing BZ inventory to SGP
do $$
declare
  r record;
  v_existing_sgp_id uuid;
begin
  for r in 
    select id, nomenclature_id, total_qty 
    from public.inventory 
    where type in ('bz', 'bz_shop2', 'semi', 'semi_shop2', 'wip_bz')
      and (warehouse = 'operational' or warehouse is null)
      and pocket_owner is null
      and nomenclature_id is not null
  loop
    -- Check if an SGP row already exists for this nomenclature
    select id into v_existing_sgp_id
    from public.inventory
    where nomenclature_id = r.nomenclature_id
      and warehouse = 'sgp'
      and pocket_owner is null
      and type in ('finished', 'bz', 'bz_shop2', 'wip_bz', 'semi', 'semi_shop2', 'part', 'product')
    limit 1;

    if v_existing_sgp_id is not null then
      -- Add quantity to the existing SGP row
      update public.inventory 
      set total_qty = total_qty + r.total_qty, updated_at = now() 
      where id = v_existing_sgp_id;
      
      -- Delete the old BZ row
      delete from public.inventory where id = r.id;
    else
      -- No existing SGP row, safely convert the BZ row to SGP
      update public.inventory 
      set warehouse = 'sgp', type = 'part', updated_at = now() 
      where id = r.id;
    end if;
  end loop;
end;
$$;
