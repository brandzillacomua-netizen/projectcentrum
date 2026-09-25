begin;

-- Resilient return_vkya_restoration_to_route function.
-- 1. Does not fail if source_history_id is null or missing from work_card_history,
--    resolving task_id resiliently from source_task_id, source_card_id, source_history_id, or source_order_id.
-- 2. Formats card_info with [VKYA_RETURN:id:qty] so both shortage calculations and card breakdown
--    recognize the returned parts immediately.
-- 3. Inserts an audit record into work_card_history so returned parts appear in the
--    Shop 1 Card Archive (Архів карток Цеху 1) under the corresponding outfit/task.
-- 4. Fixes unique constraint violation "uq_inventory_sgp_nom_finished" in
--    vkya_add_route_inventory and return_legacy_restoration_to_bz when updating SGP stock.

create or replace function public.vkya_add_route_inventory(
  p_nomenclature_id uuid,
  p_type text,
  p_quantity integer
) returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $body$
declare
  v_inventory_id uuid;
  v_name text;
  v_unit text;
  v_warehouse text;
begin
  if p_quantity is null or p_quantity <= 0 or p_type is null then return; end if;

  perform pg_advisory_xact_lock(hashtextextended('vkya-inventory:' || p_nomenclature_id::text || ':' || p_type, 0));

  v_warehouse := case
    when p_type in ('scrap_ready', 'scrap_cat_1', 'scrap_cat_2', 'scrap_cat_3', 'scrap_cat_4', 'scrap_restoration') then 'operational'
    else 'sgp'
  end;

  select id into v_inventory_id
  from public.inventory
  where nomenclature_id = p_nomenclature_id
    and (
      (v_warehouse = 'sgp' and warehouse = 'sgp' and pocket_owner is null and type in ('finished', 'bz', 'bz_shop2', 'wip_bz', 'semi', 'semi_shop2', 'part', 'product'))
      or (type = p_type and warehouse = v_warehouse)
    )
  order by updated_at desc nulls last, id
  limit 1
  for update;

  if v_inventory_id is not null then
    update public.inventory
    set total_qty = coalesce(total_qty, 0) + p_quantity, updated_at = now()
    where id = v_inventory_id;
  else
    select name, unit into v_name, v_unit
    from public.nomenclatures where id = p_nomenclature_id;
    insert into public.inventory (
      nomenclature_id, name, unit, total_qty, reserved_qty, type, warehouse, updated_at
    ) values (
      p_nomenclature_id, coalesce(v_name, 'Деталь'), coalesce(v_unit, 'шт'),
      p_quantity, 0, p_type, v_warehouse, now()
    );
  end if;
end;
$body$;

revoke all on function public.vkya_add_route_inventory(uuid,text,integer) from public;
grant execute on function public.vkya_add_route_inventory(uuid,text,integer) to anon, authenticated, service_role;

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
     and (
       (warehouse = 'sgp' and pocket_owner is null and type in ('finished', 'bz', 'bz_shop2', 'wip_bz', 'semi', 'semi_shop2', 'part', 'product'))
       or (type = 'bz' and warehouse = 'operational')
     )
   order by updated_at desc nulls last limit 1 for update;

  if v_inventory_id is null then
    insert into public.inventory (nomenclature_id, name, unit, total_qty, reserved_qty, type, warehouse, pocket_owner, updated_at)
    values (v_restoration.nomenclature_id, coalesce(v_nom_name, 'Деталь'), coalesce(v_nom_unit, 'шт'), v_restoration.completed_quantity, 0, 'bz', 'sgp', null, now());
  else
    update public.inventory set total_qty = coalesce(v_inventory_qty, 0) + v_restoration.completed_quantity, updated_at = now()
     where id = v_inventory_id;
  end if;

  update public.vkya_restoration_cards set
    route_card_id = '00000000-0000-0000-0000-000000000000',
    returned_to_route_at = now(),
    returned_to_route_by = nullif(btrim(p_returned_by), ''),
    updated_at = now()
  where id = v_restoration.id;
end;
$body$;

revoke all on function public.return_legacy_restoration_to_bz(uuid,text) from public;
grant execute on function public.return_legacy_restoration_to_bz(uuid,text) to anon, authenticated, service_role;

create or replace function public.return_vkya_restoration_to_route(
  p_restoration_card_id uuid,
  p_returned_by text default null
) returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $body$
declare
  v_restoration public.vkya_restoration_cards%rowtype;
  v_history public.work_card_history%rowtype;
  v_source public.work_cards%rowtype;
  v_target_status text;
  v_target_operation text;
  v_target_inventory text;
  v_route_card_id uuid;
  v_task_id uuid;
  v_order_id uuid;
  v_can_merge boolean;
  v_manager_name text;
  v_shift_name text;
begin
  select * into v_restoration
  from public.vkya_restoration_cards
  where id = p_restoration_card_id
  for update;

  if not found then raise exception 'Карту відновлення не знайдено'; end if;
  if v_restoration.route_card_id is not null then return v_restoration.route_card_id; end if;
  if v_restoration.status <> 'completed' or coalesce(v_restoration.completed_quantity, 0) <= 0 then
    raise exception 'Спочатку завершіть карту та вкажіть відновлену кількість';
  end if;

  -- 1. Fetch source history if present
  if v_restoration.source_history_id is not null then
    select * into v_history
    from public.work_card_history
    where id = v_restoration.source_history_id;
  end if;

  -- 2. Fetch source card if present
  if coalesce(v_restoration.source_card_id, v_history.card_id) is not null then
    select * into v_source
    from public.work_cards
    where id = coalesce(v_restoration.source_card_id, v_history.card_id);
  end if;

  -- 3. Resolve task_id resiliently and validate against public.tasks
  v_task_id := coalesce(v_restoration.source_task_id, v_source.task_id, v_history.task_id);
  
  if v_task_id is not null then
    select id into v_task_id
    from public.tasks
    where id = v_task_id;
  end if;

  if v_task_id is null and v_restoration.source_order_id is not null then
    select id into v_task_id
    from public.tasks
    where order_id = v_restoration.source_order_id
    order by created_at desc
    limit 1;
  end if;

  if v_task_id is null and coalesce(v_source.order_id, v_history.task_id) is not null then
    select id into v_task_id
    from public.tasks
    where order_id = coalesce(v_source.order_id, v_history.task_id)
    order by created_at desc
    limit 1;
  end if;

  if v_task_id is null then
    select wc.task_id into v_task_id
    from public.work_cards wc
    join public.tasks t on t.id = wc.task_id
    where wc.nomenclature_id = v_restoration.nomenclature_id
    order by wc.created_at desc
    limit 1;
  end if;

  -- Final validation of v_task_id against public.tasks table
  if v_task_id is not null then
    perform 1 from public.tasks where id = v_task_id;
    if not found then
      v_task_id := null;
    end if;
  end if;

  if v_task_id is not null then
    select order_id into v_order_id
    from public.tasks
    where id = v_task_id;
  end if;

  v_order_id := coalesce(v_order_id, v_restoration.source_order_id, v_source.order_id);
  if v_order_id is not null then
    perform 1 from public.orders where id = v_order_id;
    if not found then
      v_order_id := null;
    end if;
  end if;

  v_manager_name := coalesce(v_source.manager_name, v_history.manager_name, '—');
  v_shift_name := coalesce(v_source.shift_name, v_history.shift_name, '—');

  -- All restored parts from VKYA return directly to Shop 2 Buffer (at-shop2-buffer)
  v_target_status := 'at-shop2-buffer';
  v_target_operation := 'Сортування';
  v_target_inventory := 'semi_shop2';

  if v_source.id is not null and v_source.status = v_target_status
     and lower(btrim(coalesce(v_source.operation, ''))) = lower(btrim(coalesce(v_target_operation, ''))) then
    v_can_merge := true;
    v_route_card_id := v_source.id;
  else
    select id into v_route_card_id
    from public.work_cards
    where (task_id = v_task_id or (task_id is null and v_task_id is null))
      and nomenclature_id = v_restoration.nomenclature_id
      and status = v_target_status
      and lower(btrim(coalesce(operation, ''))) = lower(btrim(coalesce(v_target_operation, '')))
    order by created_at desc
    limit 1;
    v_can_merge := (v_route_card_id is not null);
  end if;

  if v_can_merge then
    update public.work_cards
    set quantity = coalesce(quantity, 0) + v_restoration.completed_quantity,
        card_info = concat_ws(' ', nullif(btrim(coalesce(card_info, '')), ''),
          format('[VKYA_RETURN:%s:%s] [VKYA_RESTORED_RETURN:%s:%s]',
            v_restoration.id, v_restoration.completed_quantity,
            v_restoration.id, v_restoration.completed_quantity))
    where id = v_route_card_id;
  else
    insert into public.work_cards (
      task_id, order_id, nomenclature_id, quantity, operation, status,
      machine, manager_name, shift_name, card_info
    ) values (
      v_task_id, v_order_id,
      v_restoration.nomenclature_id, v_restoration.completed_quantity,
      v_target_operation, v_target_status, '—', v_manager_name, v_shift_name,
      format('[VKYA_RETURN:%s:%s] [VKYA_RESTORED_RETURN:%s:%s] [SOURCE_CARD:%s] [SOURCE_HISTORY:%s] Повернено в Буфер Цеху №2 після відновлення ВКЯ',
        v_restoration.id, v_restoration.completed_quantity,
        v_restoration.id, v_restoration.completed_quantity,
        coalesce(v_source.id::text, '—'), coalesce(v_history.id::text, '—'))
    ) returning id into v_route_card_id;
  end if;

  if v_target_inventory is not null then
    perform public.vkya_add_route_inventory(v_restoration.nomenclature_id, v_target_inventory, v_restoration.completed_quantity);
  end if;

  -- Create history entry in work_card_history so returned card appears in Shop 1 Card Archive (Архів карток Цеху 1)
  insert into public.work_card_history (
    card_id, nomenclature_id, task_id, stage_name, operator_name,
    qty_at_start, qty_completed, scrap_qty, started_at, completed_at, created_at,
    is_archived_scrap, machine, manager_name, shift_name, card_info
  ) values (
    v_route_card_id, v_restoration.nomenclature_id, v_task_id,
    v_restoration.restoration_stage || ' (Відновлено ВКЯ)',
    coalesce(v_restoration.operator_name, nullif(btrim(p_returned_by), ''), 'Термінал відновлення ВКЯ'),
    v_restoration.completed_quantity, v_restoration.completed_quantity, 0,
    coalesce(v_restoration.started_at, v_restoration.created_at, now()),
    now(), now(), false, '—', v_manager_name, v_shift_name,
    format('[VKYA_RETURN:%s:%s] [VKYA_RESTORED_RETURN:%s:%s] Відновлено та повернуто в наряд із ВКЯ',
      v_restoration.id, v_restoration.completed_quantity,
      v_restoration.id, v_restoration.completed_quantity)
  );

  -- Record resolution so Shop 1 / Foreman report queries see the returned count (if source history exists)
  if v_restoration.source_history_id is not null and exists (select 1 from public.work_card_history where id = v_restoration.source_history_id) then
    insert into public.vkya_quality_resolutions (
      source_history_id, source_card_id, task_id, order_id, nomenclature_id,
      quantity, disposition, restoration_card_id, resolved_by_name
    ) values (
      v_restoration.source_history_id,
      case when exists (select 1 from public.work_cards where id = v_restoration.source_card_id) then v_restoration.source_card_id else null end,
      v_task_id, v_order_id,
      v_restoration.nomenclature_id, v_restoration.completed_quantity, 'returned_to_route',
      v_restoration.id, nullif(btrim(p_returned_by), '')
    )
    on conflict do nothing;
  end if;

  update public.vkya_restoration_cards
  set route_card_id = v_route_card_id,
      returned_to_route_at = now(),
      returned_to_route_by = nullif(btrim(p_returned_by), ''),
      updated_at = now()
  where id = v_restoration.id;

  return v_route_card_id;
end;
$body$;

revoke all on function public.return_vkya_restoration_to_route(uuid,text) from public;
grant execute on function public.return_vkya_restoration_to_route(uuid,text) to anon, authenticated, service_role;

commit;
