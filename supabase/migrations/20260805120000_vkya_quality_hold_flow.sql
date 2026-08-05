-- VKYA quality hold flow
--
-- A production defect is a quality hold until VKYA confirms category 4
-- (final scrap).  Holds may be returned to their original route or assigned
-- to restoration without creating a foreman reissue shortage.

create extension if not exists pgcrypto;

-- Some installations predate the incremental VKYA queue migration.  Keep this
-- migration self-contained so the quality-hold RPCs never depend on an
-- optional read-model table being present already.
create sequence if not exists public.vkya_classification_queue_change_seq;

create index if not exists scrap_classifications_source_history_idx
  on public.scrap_classifications (source_history_id)
  where source_history_id is not null;

create table if not exists public.vkya_classification_queue_projection (
  source_type text not null check (source_type in ('history', 'restoration_return')),
  source_id uuid not null,
  payload jsonb not null,
  is_active boolean not null,
  change_seq bigint not null default nextval('public.vkya_classification_queue_change_seq'),
  changed_at timestamptz not null default clock_timestamp(),
  primary key (source_type, source_id)
);

create index if not exists vkya_queue_projection_active_idx
  on public.vkya_classification_queue_projection (is_active, change_seq);
create index if not exists vkya_queue_projection_change_idx
  on public.vkya_classification_queue_projection (change_seq);

alter table public.vkya_classification_queue_projection enable row level security;
revoke all on table public.vkya_classification_queue_projection from public;
grant select on public.vkya_classification_queue_projection to anon, authenticated;
drop policy if exists "vkya_queue_projection_realtime_read"
  on public.vkya_classification_queue_projection;
create policy "vkya_queue_projection_realtime_read"
  on public.vkya_classification_queue_projection
  for select to anon, authenticated using (true);

create table if not exists public.vkya_quality_resolutions (
  id uuid primary key default gen_random_uuid(),
  source_history_id uuid not null references public.work_card_history(id) on delete restrict,
  source_card_id uuid references public.work_cards(id) on delete set null,
  task_id uuid,
  order_id uuid,
  nomenclature_id uuid not null,
  quantity integer not null check (quantity > 0),
  disposition text not null check (disposition in ('returned_to_route', 'restoration_assigned')),
  route_card_id uuid references public.work_cards(id) on delete set null,
  restoration_card_id uuid references public.vkya_restoration_cards(id) on delete set null,
  resolved_by_user_id bigint,
  resolved_by_name text,
  resolved_at timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now(),
  constraint vkya_quality_resolution_target check (
    (disposition = 'returned_to_route' and route_card_id is not null and restoration_card_id is null)
    or
    (disposition = 'restoration_assigned' and restoration_card_id is not null and route_card_id is null)
  )
);

create index if not exists vkya_quality_resolutions_history_idx
  on public.vkya_quality_resolutions (source_history_id, resolved_at);
create index if not exists vkya_quality_resolutions_task_nom_idx
  on public.vkya_quality_resolutions (task_id, nomenclature_id);

alter table public.vkya_quality_resolutions enable row level security;
grant select on public.vkya_quality_resolutions to anon, authenticated;

drop policy if exists "vkya_quality_resolutions_read" on public.vkya_quality_resolutions;
create policy "vkya_quality_resolutions_read" on public.vkya_quality_resolutions
  for select to anon, authenticated using (true);

alter table public.vkya_restoration_cards
  add column if not exists source_history_id uuid references public.work_card_history(id) on delete set null,
  add column if not exists source_card_id uuid references public.work_cards(id) on delete set null,
  add column if not exists source_task_id uuid,
  add column if not exists source_order_id uuid,
  add column if not exists source_stage_name text;

alter table public.vkya_reclassification_queue
  add column if not exists source_history_id uuid references public.work_card_history(id) on delete set null,
  add column if not exists source_card_id uuid references public.work_cards(id) on delete set null,
  add column if not exists source_task_id uuid,
  add column if not exists source_order_id uuid;

create or replace function public.vkya_take_scrap_ready(
  p_nomenclature_id uuid,
  p_quantity integer
) returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $body$
declare
  v_row record;
  v_remaining numeric := p_quantity;
  v_take numeric;
  v_available numeric;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Кількість має бути більшою за нуль';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('vkya-inventory:' || p_nomenclature_id::text || ':scrap_ready', 0));

  select coalesce(sum(total_qty), 0) into v_available
  from public.inventory
  where nomenclature_id = p_nomenclature_id and type = 'scrap_ready';

  if v_available < p_quantity then
    raise exception 'На складі очікування ВКЯ є лише % шт., потрібно %', v_available, p_quantity;
  end if;

  for v_row in
    select id, total_qty
    from public.inventory
    where nomenclature_id = p_nomenclature_id and type = 'scrap_ready'
    order by updated_at nulls first, created_at nulls first, id
    for update
  loop
    exit when v_remaining <= 0;
    v_take := least(coalesce(v_row.total_qty, 0), v_remaining);
    if coalesce(v_row.total_qty, 0) - v_take <= 0 then
      delete from public.inventory where id = v_row.id;
    else
      update public.inventory
      set total_qty = coalesce(total_qty, 0) - v_take, updated_at = now()
      where id = v_row.id;
    end if;
    v_remaining := v_remaining - v_take;
  end loop;
  if v_remaining > 0 then
    raise exception 'Залишок очікування ВКЯ змінився паралельно. Оновіть дані й повторіть дію';
  end if;
end;
$body$;

revoke all on function public.vkya_take_scrap_ready(uuid,integer) from public;

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
begin
  if p_quantity is null or p_quantity <= 0 or p_type is null then return; end if;

  perform pg_advisory_xact_lock(hashtextextended('vkya-inventory:' || p_nomenclature_id::text || ':' || p_type, 0));

  select id into v_inventory_id
  from public.inventory
  where nomenclature_id = p_nomenclature_id and type = p_type
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
      nomenclature_id, name, unit, total_qty, reserved_qty, type, updated_at
    ) values (
      p_nomenclature_id, coalesce(v_name, 'Деталь'), coalesce(v_unit, 'шт'),
      p_quantity, 0, p_type, now()
    );
  end if;
end;
$body$;

revoke all on function public.vkya_add_route_inventory(uuid,text,integer) from public;

create or replace function public.vkya_reduce_route_inventory(
  p_nomenclature_id uuid,
  p_type text,
  p_quantity integer
) returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $body$
declare
  v_row record;
  v_remaining numeric := greatest(coalesce(p_quantity, 0), 0);
  v_take numeric;
begin
  perform pg_advisory_xact_lock(hashtextextended('vkya-inventory:' || p_nomenclature_id::text || ':' || p_type, 0));
  for v_row in
    select id, total_qty from public.inventory
    where nomenclature_id = p_nomenclature_id and type = p_type
    order by updated_at nulls first, created_at nulls first, id
    for update
  loop
    exit when v_remaining <= 0;
    v_take := least(coalesce(v_row.total_qty, 0), v_remaining);
    if coalesce(v_row.total_qty, 0) - v_take <= 0 then
      delete from public.inventory where id = v_row.id;
    else
      update public.inventory
      set total_qty = coalesce(total_qty, 0) - v_take, updated_at = now()
      where id = v_row.id;
    end if;
    v_remaining := v_remaining - v_take;
  end loop;
end;
$body$;

revoke all on function public.vkya_reduce_route_inventory(uuid,text,integer) from public;

create or replace function public.validate_vkya_classification_capacity()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $body$
declare
  v_scrap numeric;
  v_classified numeric;
  v_resolved numeric;
begin
  if new.source_history_id is null then return new; end if;

  select coalesce(scrap_qty, 0) into v_scrap
  from public.work_card_history
  where id = new.source_history_id
  for update;
  if not found then raise exception 'Запис очікування ВКЯ не знайдено'; end if;

  select coalesce(sum(quantity), 0) into v_classified
  from public.scrap_classifications
  where source_history_id = new.source_history_id;
  select coalesce(sum(quantity), 0) into v_resolved
  from public.vkya_quality_resolutions
  where source_history_id = new.source_history_id;

  if v_classified + v_resolved + new.quantity > v_scrap then
    raise exception 'Рішення ВКЯ перевищує доступний залишок: доступно %, запитано %',
      greatest(0, v_scrap - v_classified - v_resolved), new.quantity;
  end if;
  return new;
end;
$body$;

drop trigger if exists trg_validate_vkya_classification_capacity on public.scrap_classifications;
create trigger trg_validate_vkya_classification_capacity
before insert on public.scrap_classifications
for each row execute function public.validate_vkya_classification_capacity();

create or replace function public.return_vkya_quantity_to_route(
  p_source_history_id uuid,
  p_quantity integer,
  p_resolved_by_user_id bigint default null,
  p_resolved_by_name text default null,
  p_notes text default null
) returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $body$
declare
  v_history public.work_card_history%rowtype;
  v_source public.work_cards%rowtype;
  v_classified numeric;
  v_resolved numeric;
  v_available numeric;
  v_target_status text;
  v_target_operation text;
  v_target_inventory text;
  v_route_card_id uuid;
  v_resolution_id uuid;
  v_stage text;
  v_can_merge boolean;
begin
  if p_quantity is null or p_quantity <= 0 then raise exception 'Кількість має бути більшою за нуль'; end if;

  select * into v_history from public.work_card_history
  where id = p_source_history_id for update;
  if not found or coalesce(v_history.scrap_qty, 0) <= 0 then
    raise exception 'Позицію в черзі ВКЯ не знайдено';
  end if;

  select * into v_source from public.work_cards
  where id = v_history.card_id for update;
  if not found then raise exception 'Початкову робочу картку не знайдено'; end if;

  select coalesce(sum(quantity), 0) into v_classified
  from public.scrap_classifications where source_history_id = v_history.id;
  select coalesce(sum(quantity), 0) into v_resolved
  from public.vkya_quality_resolutions where source_history_id = v_history.id;
  v_available := coalesce(v_history.scrap_qty, 0) - v_classified - v_resolved;
  if p_quantity > v_available then
    raise exception 'Для повернення доступно лише % шт.', greatest(0, v_available);
  end if;

  v_stage := lower(btrim(coalesce(v_history.stage_name, '')));
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
    v_target_status := 'at-shop2-buffer'; v_target_operation := 'Сортування'; v_target_inventory := 'semi_shop2';
  elsif v_stage = 'пресування' then
    v_target_status := 'at-buffer'; v_target_operation := 'Пресування';
  elsif v_stage = 'фарбування' then
    v_target_status := 'at-buffer'; v_target_operation := 'Фарбування';
  elsif v_stage = 'контроль вкя' then
    v_target_status := nullif(substring(coalesce(v_history.card_info, '') from '\[VKYA_SOURCE_STATUS:([^]]*)\]'), '');
    v_target_operation := nullif(substring(coalesce(v_history.card_info, '') from '\[VKYA_SOURCE_OPERATION:([^]]*)\]'), '');
    if v_target_status not in ('new','waiting-buffer','at-buffer','at-shop2-buffer') then v_target_status := 'new'; end if;
    v_target_operation := coalesce(v_target_operation, nullif(v_source.operation, ''), 'Контроль ВКЯ');
  else
    v_target_status := case when v_source.status in ('new','waiting-buffer','at-buffer','at-shop2-buffer') then v_source.status else 'new' end;
    v_target_operation := coalesce(nullif(v_source.operation, ''), v_history.stage_name, 'Контроль ВКЯ');
  end if;

  perform public.vkya_take_scrap_ready(v_history.nomenclature_id, p_quantity);

  v_can_merge := v_source.status = v_target_status
    and lower(btrim(coalesce(v_source.operation, ''))) = lower(btrim(coalesce(v_target_operation, '')))
    and v_source.status in ('new','waiting-buffer','at-buffer','at-shop2-buffer');

  if v_can_merge then
    update public.work_cards
    set quantity = coalesce(quantity, 0) + p_quantity,
        card_info = concat_ws(' ', nullif(btrim(coalesce(card_info, '')), ''),
          format('[VKYA_RETURN:%s:%s]', p_source_history_id, p_quantity))
    where id = v_source.id
    returning id into v_route_card_id;
  else
    insert into public.work_cards (
      task_id, order_id, nomenclature_id, quantity, operation, status,
      machine, manager_name, shift_name, card_info
    ) values (
      v_source.task_id, v_source.order_id, v_source.nomenclature_id, p_quantity,
      v_target_operation, v_target_status, '—', v_source.manager_name, v_source.shift_name,
      format('[VKYA_RETURN] [SOURCE_CARD:%s] [SOURCE_HISTORY:%s] Повернено ВКЯ у початковий наряд',
        v_source.id, v_history.id)
    ) returning id into v_route_card_id;
  end if;

  if v_target_inventory is not null then
    if v_stage = 'сортування' and v_target_inventory = 'semi_shop2' then
      perform public.vkya_reduce_route_inventory(v_history.nomenclature_id, 'semi', p_quantity);
    end if;
    perform public.vkya_add_route_inventory(v_history.nomenclature_id, v_target_inventory, p_quantity);
  end if;

  insert into public.vkya_quality_resolutions (
    source_history_id, source_card_id, task_id, order_id, nomenclature_id,
    quantity, disposition, route_card_id, resolved_by_user_id, resolved_by_name, notes
  ) values (
    v_history.id, v_source.id, v_source.task_id, v_source.order_id, v_history.nomenclature_id,
    p_quantity, 'returned_to_route', v_route_card_id, p_resolved_by_user_id,
    nullif(btrim(p_resolved_by_name), ''), p_notes
  ) returning id into v_resolution_id;

  return v_route_card_id;
end;
$body$;

revoke all on function public.return_vkya_quantity_to_route(uuid,integer,bigint,text,text) from public;
grant execute on function public.return_vkya_quantity_to_route(uuid,integer,bigint,text,text) to anon, authenticated;

create or replace function public.create_vkya_restoration_from_hold(
  p_source_history_id uuid,
  p_quantity integer,
  p_restoration_stage_id uuid,
  p_created_by_user_id bigint default null,
  p_created_by_name text default null
) returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $body$
declare
  v_history public.work_card_history%rowtype;
  v_source public.work_cards%rowtype;
  v_stage public.vkya_restoration_stages%rowtype;
  v_classified numeric;
  v_resolved numeric;
  v_available numeric;
  v_name text;
  v_unit text;
  v_card_id uuid;
begin
  if p_quantity is null or p_quantity <= 0 then raise exception 'Кількість має бути більшою за нуль'; end if;
  select * into v_stage from public.vkya_restoration_stages
  where id = p_restoration_stage_id and is_active = true;
  if not found then raise exception 'Оберіть активний етап відновлення'; end if;

  select * into v_history from public.work_card_history
  where id = p_source_history_id for update;
  if not found or coalesce(v_history.scrap_qty, 0) <= 0 then raise exception 'Позицію в черзі ВКЯ не знайдено'; end if;
  select * into v_source from public.work_cards where id = v_history.card_id for update;
  if not found then raise exception 'Початкову робочу картку не знайдено'; end if;

  select coalesce(sum(quantity), 0) into v_classified
  from public.scrap_classifications where source_history_id = v_history.id;
  select coalesce(sum(quantity), 0) into v_resolved
  from public.vkya_quality_resolutions where source_history_id = v_history.id;
  v_available := coalesce(v_history.scrap_qty, 0) - v_classified - v_resolved;
  if p_quantity > v_available then raise exception 'На відновлення доступно лише % шт.', greatest(0, v_available); end if;

  perform public.vkya_take_scrap_ready(v_history.nomenclature_id, p_quantity);
  select name, unit into v_name, v_unit from public.nomenclatures where id = v_history.nomenclature_id;

  insert into public.vkya_restoration_cards (
    source_inventory_id, nomenclature_id, nomenclature_name, unit,
    restoration_stage_id, restoration_stage, quantity,
    created_by_user_id, created_by_name,
    source_history_id, source_card_id, source_task_id, source_order_id, source_stage_name
  ) values (
    null, v_history.nomenclature_id, coalesce(v_name, 'Деталь'), coalesce(v_unit, 'шт'),
    v_stage.id, v_stage.name, p_quantity,
    p_created_by_user_id, nullif(btrim(p_created_by_name), ''),
    v_history.id, v_source.id, v_source.task_id, v_source.order_id, v_history.stage_name
  ) returning id into v_card_id;

  insert into public.vkya_quality_resolutions (
    source_history_id, source_card_id, task_id, order_id, nomenclature_id,
    quantity, disposition, restoration_card_id, resolved_by_user_id, resolved_by_name
  ) values (
    v_history.id, v_source.id, v_source.task_id, v_source.order_id, v_history.nomenclature_id,
    p_quantity, 'restoration_assigned', v_card_id, p_created_by_user_id,
    nullif(btrim(p_created_by_name), '')
  );

  return v_card_id;
end;
$body$;

revoke all on function public.create_vkya_restoration_from_hold(uuid,integer,uuid,bigint,text) from public;
grant execute on function public.create_vkya_restoration_from_hold(uuid,integer,uuid,bigint,text) to anon, authenticated;

-- Failed restoration keeps the original production lineage, so a later
-- category-4 decision is charged to the right order/task.
create or replace function public.complete_vkya_restoration_card(
  p_card_id uuid,
  p_completed_quantity integer
) returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $body$
declare
  v_card public.vkya_restoration_cards%rowtype;
  v_return_quantity integer;
begin
  select * into v_card from public.vkya_restoration_cards where id = p_card_id for update;
  if not found then raise exception 'Карту відновлення не знайдено'; end if;
  if v_card.status <> 'in_progress' then raise exception 'Карта не перебуває в роботі'; end if;
  if p_completed_quantity is null or p_completed_quantity < 0 or p_completed_quantity > v_card.quantity then
    raise exception 'Некоректна кількість відновлених деталей';
  end if;

  v_return_quantity := v_card.quantity - p_completed_quantity;
  update public.vkya_restoration_cards set
    status = 'completed', completed_quantity = p_completed_quantity,
    completed_at = now(), updated_at = now()
  where id = v_card.id;

  if v_return_quantity > 0 then
    insert into public.vkya_reclassification_queue (
      restoration_card_id, nomenclature_id, nomenclature_name,
      source_stage, quantity, source_history_id, source_card_id,
      source_task_id, source_order_id
    ) values (
      v_card.id, v_card.nomenclature_id, v_card.nomenclature_name,
      v_card.restoration_stage || ' (ВКЯ)', v_return_quantity,
      v_card.source_history_id, v_card.source_card_id,
      v_card.source_task_id, v_card.source_order_id
    );
  end if;
  return v_return_quantity;
end;
$body$;

revoke all on function public.complete_vkya_restoration_card(uuid,integer) from public;
grant execute on function public.complete_vkya_restoration_card(uuid,integer) to anon, authenticated;

-- Restored pieces with lineage resume the original order. Legacy restoration
-- cards intentionally keep the old standalone/BZ behaviour.
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
  if v_stage not in ('Пресування', 'Фарбування') then raise exception 'Дозволені етапи: Пресування або Фарбування'; end if;

  select * into v_restoration from public.vkya_restoration_cards
  where id = p_restoration_card_id for update;
  if not found then raise exception 'Карту відновлення не знайдено'; end if;
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
as $body$
declare
  v_card public.work_cards%rowtype;
  v_inventory_id uuid;
  v_inventory_qty numeric;
  v_nom_name text;
  v_nom_unit text;
  v_returns_to_route boolean;
begin
  select * into v_card from public.work_cards where id = p_card_id for update;
  if not found then raise exception 'Карту Цеху №2 не знайдено'; end if;
  if position('[VKYA_RESTORATION]' in coalesce(v_card.card_info, '')) = 0 then raise exception 'Карта не належить потоку відновлення ВКЯ'; end if;
  if v_card.status <> 'in-progress' then raise exception 'Карта не перебуває в роботі'; end if;
  if p_stage not in ('Пресування', 'Фарбування') or v_card.operation <> p_stage then raise exception 'Етап карти не відповідає терміналу'; end if;
  if p_finished_quantity < 0 or p_scrap_quantity < 0 or p_finished_quantity + p_scrap_quantity <> v_card.quantity then
    raise exception 'Сума готових деталей і браку має дорівнювати кількості карти';
  end if;

  v_returns_to_route := position('[VKYA_SOURCE_ROUTE]' in coalesce(v_card.card_info, '')) > 0
    and v_card.task_id is not null;

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

  select name, unit into v_nom_name, v_nom_unit from public.nomenclatures where id = v_card.nomenclature_id;

  if p_finished_quantity > 0 and not v_returns_to_route then
    select id, total_qty into v_inventory_id, v_inventory_qty
    from public.inventory where nomenclature_id = v_card.nomenclature_id and type = 'bz'
    order by updated_at desc nulls last limit 1 for update;
    if v_inventory_id is null then
      insert into public.inventory (nomenclature_id, name, unit, total_qty, reserved_qty, type, pocket_owner, updated_at)
      values (v_card.nomenclature_id, coalesce(v_nom_name, 'Деталь'), coalesce(v_nom_unit, 'шт'), p_finished_quantity, 0, 'bz', null, now());
    else
      update public.inventory set total_qty = coalesce(v_inventory_qty, 0) + p_finished_quantity, updated_at = now()
      where id = v_inventory_id;
    end if;
  end if;

  if p_scrap_quantity > 0 then
    perform public.vkya_add_route_inventory(v_card.nomenclature_id, 'scrap_ready', p_scrap_quantity);
  end if;

  update public.work_cards set
    status = case when v_returns_to_route then 'at-buffer' else 'completed' end,
    operation = case when v_returns_to_route then p_stage else 'Базовий залишок' end,
    quantity = p_finished_quantity,
    completed_at = now(),
    card_info = concat_ws(' ', nullif(btrim(coalesce(card_info, '')), ''),
      case when v_returns_to_route then '[VKYA_RETURNED_TO_ROUTE]' else '[VKYA_TO_BZ]' end)
  where id = v_card.id;
end;
$body$;

revoke all on function public.complete_vkya_shop2_card_to_bz(uuid,text,text,text,integer,integer) from public;
grant execute on function public.complete_vkya_shop2_card_to_bz(uuid,text,text,text,integer,integer) to anon, authenticated;

-- Only category 4 is an irreversible production loss.  All other VKYA states
-- remain recoverable and must not create a foreman reissue requirement.
create or replace view public.vkya_final_scrap_totals as
select
  c.task_id,
  c.order_id,
  c.card_id,
  c.nomenclature_id,
  sum(cc.quantity)::bigint as total_scrap,
  min(c.classified_at) as first_scrap_at,
  max(c.classified_at) as last_scrap_at,
  max(c.classified_at) as updated_at
from public.scrap_classifications c
join public.scrap_classification_categories cc on cc.classification_id = c.id
where cc.category = 4 and c.task_id is not null
group by c.task_id, c.order_id, c.card_id, c.nomenclature_id;

grant select on public.vkya_final_scrap_totals to anon, authenticated;

-- Queue projection now treats returned/restoration-assigned quantities as
-- resolved, while preserving the existing payload contract.
create or replace function public.sync_vkya_history_queue_projection()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $body$
declare
  v_resolved numeric;
  v_ready boolean;
begin
  select
    coalesce((select sum(quantity) from public.scrap_classifications where source_history_id = new.id), 0)
    + coalesce((select sum(quantity) from public.vkya_quality_resolutions where source_history_id = new.id), 0)
  into v_resolved;
  v_ready := coalesce(new.scrap_qty, 0) > v_resolved
    and (coalesce(new.is_archived_scrap, false) or coalesce(new.card_info, '') like '%[ЦЕХ №2]%');

  insert into public.vkya_classification_queue_projection (
    source_type, source_id, payload, is_active, change_seq, changed_at
  ) values (
    'history', new.id,
    to_jsonb(new) || jsonb_build_object('classified_quantity', v_resolved),
    v_ready, nextval('public.vkya_classification_queue_change_seq'), clock_timestamp()
  ) on conflict (source_type, source_id) do update set
    payload = excluded.payload, is_active = excluded.is_active,
    change_seq = excluded.change_seq, changed_at = excluded.changed_at;
  return new;
end;
$body$;

create or replace function public.sync_vkya_history_queue_projection_for_id(p_history_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $body$
declare
  v_history public.work_card_history%rowtype;
  v_resolved numeric;
begin
  select * into v_history from public.work_card_history where id = p_history_id;
  if not found then return; end if;
  select
    coalesce((select sum(quantity) from public.scrap_classifications where source_history_id = p_history_id), 0)
    + coalesce((select sum(quantity) from public.vkya_quality_resolutions where source_history_id = p_history_id), 0)
  into v_resolved;
  insert into public.vkya_classification_queue_projection (
    source_type, source_id, payload, is_active, change_seq, changed_at
  ) values (
    'history', v_history.id,
    to_jsonb(v_history) || jsonb_build_object('classified_quantity', v_resolved),
    coalesce(v_history.scrap_qty, 0) > v_resolved
      and (coalesce(v_history.is_archived_scrap, false) or coalesce(v_history.card_info, '') like '%[ЦЕХ №2]%'),
    nextval('public.vkya_classification_queue_change_seq'), clock_timestamp()
  ) on conflict (source_type, source_id) do update set
    payload = excluded.payload, is_active = excluded.is_active,
    change_seq = excluded.change_seq, changed_at = excluded.changed_at;
end;
$body$;

create or replace function public.sync_vkya_projection_after_classification()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $body$
declare
  v_history public.work_card_history%rowtype;
begin
  if new.source_history_id is null then return new; end if;
  select * into v_history from public.work_card_history where id = new.source_history_id;
  if found then perform public.sync_vkya_history_queue_projection_for_id(v_history.id); end if;
  return new;
end;
$body$;

create or replace function public.sync_vkya_projection_after_resolution()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $body$
begin
  perform public.sync_vkya_history_queue_projection_for_id(new.source_history_id);
  return new;
end;
$body$;

create or replace function public.sync_vkya_return_queue_projection()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $body$
begin
  insert into public.vkya_classification_queue_projection (
    source_type, source_id, payload, is_active, change_seq, changed_at
  ) values (
    'restoration_return', new.id, to_jsonb(new),
    new.status = 'pending' and coalesce(new.quantity, 0) > coalesce(new.classified_quantity, 0),
    nextval('public.vkya_classification_queue_change_seq'), clock_timestamp()
  ) on conflict (source_type, source_id) do update set
    payload = excluded.payload, is_active = excluded.is_active,
    change_seq = excluded.change_seq, changed_at = excluded.changed_at;
  return new;
end;
$body$;

create or replace function public.sync_vkya_history_queue_projection_delete()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $body$
begin
  insert into public.vkya_classification_queue_projection (
    source_type, source_id, payload, is_active, change_seq, changed_at
  ) values (
    'history', old.id, to_jsonb(old), false,
    nextval('public.vkya_classification_queue_change_seq'), clock_timestamp()
  ) on conflict (source_type, source_id) do update set
    payload = excluded.payload, is_active = false,
    change_seq = excluded.change_seq, changed_at = excluded.changed_at;
  return old;
end;
$body$;

create or replace function public.vkya_classification_queue_changes(p_after_seq bigint default null)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public
as $body$
  with cursor_value as (
    select coalesce(max(change_seq), 0) as value
    from public.vkya_classification_queue_projection
  ),
  selected as (
    select source_type, source_id, payload, is_active, change_seq, changed_at
    from public.vkya_classification_queue_projection
    where case when p_after_seq is null then is_active else change_seq > p_after_seq end
    order by change_seq
  )
  select jsonb_build_object(
    'cursor', (select value from cursor_value),
    'changes', coalesce(jsonb_agg(to_jsonb(selected)), '[]'::jsonb)
  )
  from selected;
$body$;

revoke all on function public.vkya_classification_queue_changes(bigint) from public;
grant execute on function public.vkya_classification_queue_changes(bigint) to anon, authenticated;

drop trigger if exists trg_vkya_history_queue_projection on public.work_card_history;
create trigger trg_vkya_history_queue_projection
after insert or update of scrap_qty, qc_scrap_comment, is_archived_scrap, card_info
on public.work_card_history
for each row execute function public.sync_vkya_history_queue_projection();

drop trigger if exists trg_vkya_history_queue_projection_delete on public.work_card_history;
create trigger trg_vkya_history_queue_projection_delete
after delete on public.work_card_history
for each row execute function public.sync_vkya_history_queue_projection_delete();

drop trigger if exists trg_vkya_return_queue_projection on public.vkya_reclassification_queue;
create trigger trg_vkya_return_queue_projection
after insert or update of status, quantity, classified_quantity, updated_at
on public.vkya_reclassification_queue
for each row execute function public.sync_vkya_return_queue_projection();

drop trigger if exists trg_vkya_projection_after_resolution on public.vkya_quality_resolutions;
create trigger trg_vkya_projection_after_resolution
after insert on public.vkya_quality_resolutions
for each row execute function public.sync_vkya_projection_after_resolution();

-- Recreate the classification trigger after the helper it calls exists.
drop trigger if exists trg_vkya_projection_after_classification on public.scrap_classifications;
create trigger trg_vkya_projection_after_classification
after insert on public.scrap_classifications
for each row execute function public.sync_vkya_projection_after_classification();

update public.vkya_classification_queue_projection p
set payload = to_jsonb(h) || jsonb_build_object(
      'classified_quantity',
      coalesce((select sum(quantity) from public.scrap_classifications where source_history_id = h.id), 0)
      + coalesce((select sum(quantity) from public.vkya_quality_resolutions where source_history_id = h.id), 0)
    ),
    is_active = coalesce(h.scrap_qty, 0) >
      coalesce((select sum(quantity) from public.scrap_classifications where source_history_id = h.id), 0)
      + coalesce((select sum(quantity) from public.vkya_quality_resolutions where source_history_id = h.id), 0)
      and (coalesce(h.is_archived_scrap, false) or coalesce(h.card_info, '') like '%[ЦЕХ №2]%'),
    change_seq = nextval('public.vkya_classification_queue_change_seq'),
    changed_at = clock_timestamp()
from public.work_card_history h
where p.source_type = 'history' and p.source_id = h.id;

insert into public.vkya_classification_queue_projection (
  source_type, source_id, payload, is_active
)
select
  'history', h.id,
  to_jsonb(h) || jsonb_build_object(
    'classified_quantity',
    coalesce((select sum(quantity) from public.scrap_classifications where source_history_id = h.id), 0)
    + coalesce((select sum(quantity) from public.vkya_quality_resolutions where source_history_id = h.id), 0)
  ),
  true
from public.work_card_history h
where coalesce(h.scrap_qty, 0) >
    coalesce((select sum(quantity) from public.scrap_classifications where source_history_id = h.id), 0)
    + coalesce((select sum(quantity) from public.vkya_quality_resolutions where source_history_id = h.id), 0)
  and (coalesce(h.is_archived_scrap, false) or coalesce(h.card_info, '') like '%[ЦЕХ №2]%')
on conflict (source_type, source_id) do update set
  payload = excluded.payload, is_active = true,
  change_seq = nextval('public.vkya_classification_queue_change_seq'),
  changed_at = clock_timestamp();

insert into public.vkya_classification_queue_projection (
  source_type, source_id, payload, is_active
)
select 'restoration_return', q.id, to_jsonb(q), true
from public.vkya_reclassification_queue q
where q.status = 'pending' and coalesce(q.quantity, 0) > coalesce(q.classified_quantity, 0)
on conflict (source_type, source_id) do update set
  payload = excluded.payload, is_active = true,
  change_seq = nextval('public.vkya_classification_queue_change_seq'),
  changed_at = clock_timestamp();

update public.vkya_classification_queue_projection p
set is_active = false,
    change_seq = nextval('public.vkya_classification_queue_change_seq'),
    changed_at = clock_timestamp()
where p.source_type = 'history'
  and p.is_active
  and not exists (
    select 1 from public.work_card_history h where h.id = p.source_id
  );

do $publication$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'vkya_classification_queue_projection'
     ) then
    alter publication supabase_realtime add table public.vkya_classification_queue_projection;
  end if;

  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'scrap_classification_categories'
     ) then
    alter publication supabase_realtime add table public.scrap_classification_categories;
  end if;
end;
$publication$;
