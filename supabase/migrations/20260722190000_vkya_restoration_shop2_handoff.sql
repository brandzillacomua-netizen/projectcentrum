alter table public.vkya_restoration_cards
  add column if not exists shop2_card_id uuid references public.work_cards(id) on delete restrict,
  add column if not exists shop2_stage text,
  add column if not exists transferred_to_shop2_at timestamptz;

create unique index if not exists vkya_restoration_cards_shop2_card_unique
  on public.vkya_restoration_cards (shop2_card_id)
  where shop2_card_id is not null;

create or replace function public.dispatch_vkya_restoration_to_shop2(
  p_restoration_card_id uuid,
  p_shop2_stage text
) returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_restoration public.vkya_restoration_cards%rowtype;
  v_shop2_card_id uuid;
  v_stage text;
begin
  v_stage := btrim(coalesce(p_shop2_stage, ''));
  if v_stage not in ('Пресування', 'Фарбування') then
    raise exception 'Дозволені етапи: Пресування або Фарбування';
  end if;

  select * into v_restoration
    from public.vkya_restoration_cards
   where id = p_restoration_card_id
   for update;
  if not found then raise exception 'Карту відновлення не знайдено'; end if;
  if v_restoration.status <> 'completed' then raise exception 'Спочатку завершіть карту відновлення'; end if;
  if v_restoration.completed_quantity <= 0 then raise exception 'Немає відновлених деталей для передачі'; end if;
  if v_restoration.shop2_card_id is not null then return v_restoration.shop2_card_id; end if;

  insert into public.work_cards (
    nomenclature_id, quantity, operation, status, machine, card_info
  ) values (
    v_restoration.nomenclature_id,
    v_restoration.completed_quantity,
    v_stage,
    'new',
    '—',
    format('[RESTORATION] [VKYA_RESTORATION] [ЦЕХ №2] [VKYA_CARD:%s] %s — ПІСЛЯ ВІДНОВЛЕННЯ ВКЯ',
      v_restoration.card_number, v_restoration.nomenclature_name)
  ) returning id into v_shop2_card_id;

  update public.vkya_restoration_cards set
    shop2_card_id = v_shop2_card_id,
    shop2_stage = v_stage,
    transferred_to_shop2_at = now(),
    updated_at = now()
  where id = v_restoration.id;

  return v_shop2_card_id;
end;
$$;

revoke all on function public.dispatch_vkya_restoration_to_shop2(uuid,text) from public;
grant execute on function public.dispatch_vkya_restoration_to_shop2(uuid,text) to anon, authenticated;

create or replace function public.complete_vkya_shop2_card_to_bz(
  p_card_id uuid,
  p_stage text,
  p_operator_name text,
  p_shift_name text,
  p_finished_quantity integer,
  p_scrap_quantity integer
) returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_card public.work_cards%rowtype;
  v_inventory_id uuid;
  v_inventory_qty numeric;
  v_nom_name text;
  v_nom_unit text;
begin
  select * into v_card from public.work_cards where id = p_card_id for update;
  if not found then raise exception 'Карту Цеху №2 не знайдено'; end if;
  if position('[VKYA_RESTORATION]' in coalesce(v_card.card_info, '')) = 0 then
    raise exception 'Карта не належить потоку відновлення ВКЯ';
  end if;
  if v_card.status <> 'in-progress' then raise exception 'Карта не перебуває в роботі'; end if;
  if p_stage not in ('Пресування', 'Фарбування') or v_card.operation <> p_stage then
    raise exception 'Етап карти не відповідає терміналу';
  end if;
  if p_finished_quantity < 0 or p_scrap_quantity < 0
     or p_finished_quantity + p_scrap_quantity <> v_card.quantity then
    raise exception 'Сума готових деталей і браку має дорівнювати кількості карти';
  end if;

  insert into public.work_card_history (
    card_id, nomenclature_id, stage_name, operator_name,
    qty_at_start, qty_completed, scrap_qty, started_at, completed_at,
    is_archived_scrap, shift_name, manager_name, machine_name, card_info
  ) values (
    v_card.id, v_card.nomenclature_id, p_stage, nullif(btrim(p_operator_name), ''),
    v_card.quantity, p_finished_quantity, p_scrap_quantity,
    coalesce(v_card.started_at, now()), now(), p_scrap_quantity > 0,
    nullif(btrim(p_shift_name), ''), v_card.manager_name, v_card.machine, v_card.card_info
  );

  select name, unit into v_nom_name, v_nom_unit
    from public.nomenclatures where id = v_card.nomenclature_id;

  if p_finished_quantity > 0 then
    select id, total_qty into v_inventory_id, v_inventory_qty
      from public.inventory
     where nomenclature_id = v_card.nomenclature_id and type = 'bz'
     order by updated_at desc nulls last limit 1 for update;
    if v_inventory_id is null then
      insert into public.inventory (nomenclature_id, name, unit, total_qty, reserved_qty, type, pocket_owner, updated_at)
      values (v_card.nomenclature_id, coalesce(v_nom_name, 'Деталь'), coalesce(v_nom_unit, 'шт'), p_finished_quantity, 0, 'bz', null, now());
    else
      update public.inventory set total_qty = coalesce(v_inventory_qty, 0) + p_finished_quantity, updated_at = now()
       where id = v_inventory_id;
    end if;
  end if;

  v_inventory_id := null;
  v_inventory_qty := null;
  if p_scrap_quantity > 0 then
    select id, total_qty into v_inventory_id, v_inventory_qty
      from public.inventory
     where nomenclature_id = v_card.nomenclature_id and type = 'scrap_ready'
     order by updated_at desc nulls last limit 1 for update;
    if v_inventory_id is null then
      insert into public.inventory (nomenclature_id, name, unit, total_qty, type, updated_at)
      values (v_card.nomenclature_id, coalesce(v_nom_name, 'Деталь'), coalesce(v_nom_unit, 'шт'), p_scrap_quantity, 'scrap_ready', now());
    else
      update public.inventory set total_qty = coalesce(v_inventory_qty, 0) + p_scrap_quantity, updated_at = now()
       where id = v_inventory_id;
    end if;
  end if;

  update public.work_cards set
    status = 'completed', operation = 'Базовий залишок', quantity = p_finished_quantity,
    completed_at = now(), card_info = coalesce(card_info, '') || ' [VKYA_TO_BZ]'
  where id = v_card.id;
end;
$$;

revoke all on function public.complete_vkya_shop2_card_to_bz(uuid,text,text,text,integer,integer) from public;
grant execute on function public.complete_vkya_shop2_card_to_bz(uuid,text,text,text,integer,integer) to anon, authenticated;
