-- VKYA terminology and restored-part route return.
-- scrap_ready is the quarantine queue. Classification has two operational
-- outcomes: recoverable scrap (category 1) and final scrap (category 4).

begin;

alter table public.vkya_restoration_cards
  add column if not exists route_card_id uuid references public.work_cards(id) on delete set null,
  add column if not exists returned_to_route_at timestamptz,
  add column if not exists returned_to_route_by text;

-- Merge the former category-3 inventory into recoverable scrap. Inventory has
-- a uniqueness rule by name/type/warehouse/owner, so merge quantities before
-- changing the type when a category-1 row already exists.
do $migration$
declare
  v_source public.inventory%rowtype;
  v_target_id uuid;
begin
  for v_source in
    select * from public.inventory where type = 'scrap_cat_3' for update
  loop
    v_target_id := null;
    select id into v_target_id
    from public.inventory
    where type = 'scrap_cat_1'
      and name is not distinct from v_source.name
      and warehouse is not distinct from v_source.warehouse
      and pocket_owner is not distinct from v_source.pocket_owner
    limit 1
    for update;

    if v_target_id is null then
      update public.inventory
      set type = 'scrap_cat_1', updated_at = now()
      where id = v_source.id;
    else
      update public.inventory
      set total_qty = coalesce(total_qty, 0) + coalesce(v_source.total_qty, 0),
          reserved_qty = coalesce(reserved_qty, 0) + coalesce(v_source.reserved_qty, 0),
          updated_at = now()
      where id = v_target_id;
      delete from public.inventory where id = v_source.id;
    end if;
  end loop;
end;
$migration$;

-- Preserve analytical totals while removing category 3 from operational data.
insert into public.scrap_classification_categories (classification_id, category, quantity)
select classification_id, 1, sum(quantity)::integer
from public.scrap_classification_categories
where category = 3
group by classification_id
on conflict (classification_id, category) do update
set quantity = public.scrap_classification_categories.quantity + excluded.quantity;

delete from public.scrap_classification_categories where category = 3;

create index if not exists vkya_restoration_cards_route_card_idx
  on public.vkya_restoration_cards (route_card_id)
  where route_card_id is not null;

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
  v_stage text;
  v_can_merge boolean;
begin
  select * into v_restoration
  from public.vkya_restoration_cards
  where id = p_restoration_card_id
  for update;

  if not found then raise exception 'Карту відновлення не знайдено'; end if;
  if v_restoration.route_card_id is not null then return v_restoration.route_card_id; end if;
  if v_restoration.shop2_card_id is not null then
    raise exception 'Відновлені деталі вже передано в Цех №2';
  end if;
  if v_restoration.status <> 'completed' or coalesce(v_restoration.completed_quantity, 0) <= 0 then
    raise exception 'Спочатку завершіть карту та вкажіть відновлену кількість';
  end if;
  if v_restoration.source_history_id is null or v_restoration.source_task_id is null then
    raise exception 'Стара карта не містить походження наряду і не може бути повернена автоматично';
  end if;

  select * into v_history
  from public.work_card_history
  where id = v_restoration.source_history_id
  for update;
  if not found then raise exception 'Початковий запис ВКЯ не знайдено'; end if;

  select * into v_source
  from public.work_cards
  where id = coalesce(v_restoration.source_card_id, v_history.card_id)
  for update;
  if not found then raise exception 'Початкову робочу картку не знайдено'; end if;

  v_stage := lower(btrim(coalesce(v_restoration.source_stage_name, v_history.stage_name, '')));
  if v_stage = 'розкрій' then
    v_target_status := 'at-buffer'; v_target_operation := 'Прийомка';
  elsif v_stage like 'галтовка (вібростіл)%' then
    v_target_status := 'new'; v_target_operation := 'Галтовка (Мийка)';
  elsif v_stage like 'галтовка (мийка)%' then
    v_target_status := 'new'; v_target_operation := 'Галтовка (Галтовка)';
  elsif v_stage like 'галтовка (галтовка)%' then
    v_target_status := 'new'; v_target_operation := 'Галтовка (Сушка)';
  elsif v_stage like 'галтовка (сушка)%' or v_stage = 'галтовка' then
    v_target_status := 'at-buffer'; v_target_operation := 'Прийомка';
  elsif v_stage = 'приймка' then
    v_target_status := 'at-buffer'; v_target_operation := 'Сортування';
  elsif v_stage = 'сортування' then
    v_target_status := 'at-shop2-buffer'; v_target_operation := 'Сортування';
    v_target_inventory := 'semi_shop2';
  elsif v_stage = 'пресування' then
    v_target_status := 'at-buffer'; v_target_operation := 'Пресування';
  elsif v_stage = 'фарбування' then
    v_target_status := 'at-buffer'; v_target_operation := 'Фарбування';
  elsif v_stage = 'контроль вкя' then
    v_target_status := nullif(substring(coalesce(v_history.card_info, '') from '\[VKYA_SOURCE_STATUS:([^]]*)\]'), '');
    v_target_operation := nullif(substring(coalesce(v_history.card_info, '') from '\[VKYA_SOURCE_OPERATION:([^]]*)\]'), '');
    if v_target_status not in ('new','waiting-buffer','at-buffer','at-shop2-buffer') then
      v_target_status := 'new';
    end if;
    v_target_operation := coalesce(v_target_operation, nullif(v_source.operation, ''), 'Контроль ВКЯ');
  else
    v_target_status := case
      when v_source.status in ('new','waiting-buffer','at-buffer','at-shop2-buffer') then v_source.status
      else 'new'
    end;
    v_target_operation := coalesce(nullif(v_source.operation, ''), v_restoration.source_stage_name, 'Контроль ВКЯ');
  end if;

  v_can_merge := v_source.status = v_target_status
    and lower(btrim(coalesce(v_source.operation, ''))) = lower(btrim(coalesce(v_target_operation, '')))
    and v_source.status in ('new','waiting-buffer','at-buffer','at-shop2-buffer');

  if v_can_merge then
    update public.work_cards
    set quantity = coalesce(quantity, 0) + v_restoration.completed_quantity,
        card_info = concat_ws(' ', nullif(btrim(coalesce(card_info, '')), ''),
          format('[VKYA_RESTORED_RETURN:%s:%s]', v_restoration.id, v_restoration.completed_quantity))
    where id = v_source.id
    returning id into v_route_card_id;
  else
    insert into public.work_cards (
      task_id, order_id, nomenclature_id, quantity, operation, status,
      machine, manager_name, shift_name, card_info
    ) values (
      v_restoration.source_task_id, coalesce(v_restoration.source_order_id, v_source.order_id),
      v_restoration.nomenclature_id, v_restoration.completed_quantity,
      v_target_operation, v_target_status, '—', v_source.manager_name, v_source.shift_name,
      format('[VKYA_RESTORED_RETURN] [SOURCE_CARD:%s] [SOURCE_HISTORY:%s] [RESTORATION_CARD:%s] Повернено після відновлення ВКЯ',
        v_source.id, v_history.id, v_restoration.id)
    ) returning id into v_route_card_id;
  end if;

  if v_target_inventory is not null then
    if v_stage = 'сортування' and v_target_inventory = 'semi_shop2' then
      perform public.vkya_reduce_route_inventory(v_restoration.nomenclature_id, 'semi', v_restoration.completed_quantity);
    end if;
    perform public.vkya_add_route_inventory(v_restoration.nomenclature_id, v_target_inventory, v_restoration.completed_quantity);
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
grant execute on function public.return_vkya_restoration_to_route(uuid,text) to anon, authenticated;

-- Keep the legacy dispatch callable, but make route return and Shop2 dispatch
-- mutually exclusive under the same row lock.
create or replace function public.dispatch_vkya_restoration_to_shop2(
  p_restoration_card_id uuid,
  p_shop2_stage text
) returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $body$
declare
  v_restoration public.vkya_restoration_cards%rowtype;
  v_shop2_card_id uuid;
  v_stage text;
  v_route_tag text;
begin
  v_stage := btrim(coalesce(p_shop2_stage, ''));
  if v_stage not in ('Пресування', 'Фарбування') then
    raise exception 'Дозволені етапи: Пресування або Фарбування';
  end if;

  select * into v_restoration from public.vkya_restoration_cards
  where id = p_restoration_card_id for update;
  if not found then raise exception 'Карту відновлення не знайдено'; end if;
  if v_restoration.route_card_id is not null then
    raise exception 'Відновлені деталі вже повернено в початковий наряд';
  end if;
  if v_restoration.status <> 'completed' then raise exception 'Спочатку завершіть карту відновлення'; end if;
  if v_restoration.completed_quantity <= 0 then raise exception 'Немає відновлених деталей для передачі'; end if;
  if v_restoration.shop2_card_id is not null then return v_restoration.shop2_card_id; end if;

  v_route_tag := case when v_restoration.source_task_id is not null then '[VKYA_SOURCE_ROUTE]' else '[VKYA_LEGACY_BZ]' end;
  insert into public.work_cards (
    task_id, order_id, nomenclature_id, quantity, operation, status, machine, card_info
  ) values (
    v_restoration.source_task_id, v_restoration.source_order_id,
    v_restoration.nomenclature_id, v_restoration.completed_quantity,
    v_stage, 'new', '—',
    format('[RESTORATION] [VKYA_RESTORATION] %s [ЦЕХ №2] [VKYA_CARD:%s] %s — ПІСЛЯ ВІДНОВЛЕННЯ ВКЯ',
      v_route_tag, v_restoration.card_number, v_restoration.nomenclature_name)
  ) returning id into v_shop2_card_id;

  update public.vkya_restoration_cards set
    shop2_card_id = v_shop2_card_id, shop2_stage = v_stage,
    transferred_to_shop2_at = now(), updated_at = now()
  where id = v_restoration.id;
  return v_shop2_card_id;
end;
$body$;

revoke all on function public.dispatch_vkya_restoration_to_shop2(uuid,text) from public;
grant execute on function public.dispatch_vkya_restoration_to_shop2(uuid,text) to anon, authenticated;

commit;
