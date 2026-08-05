-- Recoverable VKYA scrap is tracked as source-aware lots. Physical inventory
-- may remain aggregated, but every operational allocation is charged to the
-- exact classification/order/card that produced it.

begin;

create table if not exists public.vkya_scrap_lot_allocations (
  id uuid primary key default gen_random_uuid(),
  classification_category_id bigint not null references public.scrap_classification_categories(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  action text not null check (action in ('rework_order', 'restoration')),
  rework_order_id uuid references public.orders(id) on delete set null,
  rework_task_id uuid references public.tasks(id) on delete set null,
  rework_card_id uuid references public.work_cards(id) on delete set null,
  restoration_card_id uuid references public.vkya_restoration_cards(id) on delete set null,
  allocated_by_user_id bigint,
  allocated_by_name text,
  allocated_at timestamptz not null default now(),
  notes text,
  constraint vkya_scrap_lot_allocation_target check (
    (action = 'rework_order' and rework_order_id is not null and rework_task_id is not null
      and rework_card_id is not null and restoration_card_id is null)
    or
    (action = 'restoration' and restoration_card_id is not null
      and rework_order_id is null and rework_task_id is null and rework_card_id is null)
  )
);

create index if not exists vkya_scrap_lot_allocations_category_idx
  on public.vkya_scrap_lot_allocations (classification_category_id, allocated_at);

alter table public.vkya_scrap_lot_allocations enable row level security;
grant select on public.vkya_scrap_lot_allocations to anon, authenticated;
drop policy if exists "vkya_scrap_lot_allocations_read" on public.vkya_scrap_lot_allocations;
create policy "vkya_scrap_lot_allocations_read" on public.vkya_scrap_lot_allocations
  for select to anon, authenticated using (true);

create or replace view public.vkya_recoverable_scrap_lots as
with allocated as (
  select classification_category_id, sum(quantity)::numeric as quantity
  from public.vkya_scrap_lot_allocations
  group by classification_category_id
), base_lots as (
  select
    cc.id as classification_category_id,
    c.id as classification_id,
    coalesce(
      c.source_history_id,
      nullif(substring(coalesce(c.notes, '') from '\[VKYA_ORIGIN_HISTORY:([0-9a-fA-F-]{36})\]'), '')::uuid
    ) as source_history_id,
    c.card_id,
    c.task_id,
    c.order_id,
    c.nomenclature_id,
    c.order_number,
    c.card_sequence,
    c.source_operator_name,
    c.source_stage_name,
    c.source_machine_name,
    c.classified_by_name,
    c.classified_at,
    cc.category,
    case when cc.category = 2 then 'scrap_cat_2' else 'scrap_cat_1' end as storage_type,
    greatest(0, cc.quantity - coalesce(a.quantity, 0))::numeric as ledger_remaining
  from public.scrap_classification_categories cc
  join public.scrap_classifications c on c.id = cc.classification_id
  left join allocated a on a.classification_category_id = cc.id
  where cc.category in (1, 2, 3)
), stock as (
  select
    nomenclature_id,
    case when type = 'scrap_cat_2' then 'scrap_cat_2' else 'scrap_cat_1' end as storage_type,
    sum(total_qty)::numeric as stock_quantity
  from public.inventory
  where type in ('scrap_cat_1', 'scrap_cat_2', 'scrap_cat_3')
  group by nomenclature_id, 2
), ranked as (
  select
    b.*,
    coalesce(s.stock_quantity, 0) as stock_quantity,
    coalesce(sum(b.ledger_remaining) over (
      partition by b.nomenclature_id, b.storage_type
      order by b.classified_at desc, b.classification_category_id desc
      rows between unbounded preceding and 1 preceding
    ), 0) as prior_lot_quantity
  from base_lots b
  left join stock s
    on s.nomenclature_id = b.nomenclature_id and s.storage_type = b.storage_type
  where b.ledger_remaining > 0
)
select
  r.classification_category_id,
  r.classification_id,
  r.source_history_id,
  r.card_id,
  r.task_id,
  r.order_id,
  r.nomenclature_id,
  n.name as nomenclature_name,
  coalesce(n.unit, 'шт') as unit,
  r.order_number,
  r.card_sequence,
  r.source_operator_name,
  r.source_stage_name,
  r.source_machine_name,
  r.classified_by_name,
  r.classified_at,
  r.category,
  r.storage_type,
  least(r.ledger_remaining, greatest(0, r.stock_quantity - r.prior_lot_quantity))::bigint as available_quantity
from ranked r
join public.nomenclatures n on n.id = r.nomenclature_id
where least(r.ledger_remaining, greatest(0, r.stock_quantity - r.prior_lot_quantity)) > 0;

grant select on public.vkya_recoverable_scrap_lots to anon, authenticated;

create or replace function public.vkya_take_recoverable_scrap(
  p_nomenclature_id uuid,
  p_storage_type text,
  p_quantity integer
) returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $body$
declare
  v_row record;
  v_remaining numeric := p_quantity;
  v_available numeric;
  v_take numeric;
begin
  if p_quantity is null or p_quantity <= 0 then raise exception 'Кількість має бути більшою за нуль'; end if;
  if p_storage_type not in ('scrap_cat_1', 'scrap_cat_2') then raise exception 'Невідомий тип партії браку'; end if;

  perform pg_advisory_xact_lock(hashtextextended(
    'vkya-recoverable:' || p_nomenclature_id::text || ':' || p_storage_type, 0
  ));

  select coalesce(sum(total_qty), 0) into v_available
  from public.inventory
  where nomenclature_id = p_nomenclature_id
    and case when type = 'scrap_cat_2' then 'scrap_cat_2' else 'scrap_cat_1' end = p_storage_type
    and type in ('scrap_cat_1', 'scrap_cat_2', 'scrap_cat_3');

  if v_available < p_quantity then
    raise exception 'У складському залишку цієї партії доступно лише % шт.', v_available;
  end if;

  for v_row in
    select id, total_qty
    from public.inventory
    where nomenclature_id = p_nomenclature_id
      and case when type = 'scrap_cat_2' then 'scrap_cat_2' else 'scrap_cat_1' end = p_storage_type
      and type in ('scrap_cat_1', 'scrap_cat_2', 'scrap_cat_3')
    order by updated_at nulls first, id
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

revoke all on function public.vkya_take_recoverable_scrap(uuid,text,integer) from public;

create or replace function public.create_vkya_restoration_from_lot(
  p_classification_category_id bigint,
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
  v_category public.scrap_classification_categories%rowtype;
  v_classification public.scrap_classifications%rowtype;
  v_stage public.vkya_restoration_stages%rowtype;
  v_allocated numeric;
  v_available numeric;
  v_storage_type text;
  v_name text;
  v_unit text;
  v_source_history_id uuid;
  v_card_id uuid;
begin
  if p_quantity is null or p_quantity <= 0 then raise exception 'Кількість має бути більшою за нуль'; end if;

  select * into v_category from public.scrap_classification_categories
  where id = p_classification_category_id for update;
  if not found or v_category.category not in (1, 2, 3) then raise exception 'Партію браку не знайдено'; end if;

  select * into v_classification from public.scrap_classifications
  where id = v_category.classification_id for update;
  if not found then raise exception 'Класифікацію партії не знайдено'; end if;

  select * into v_stage from public.vkya_restoration_stages
  where id = p_restoration_stage_id and is_active = true;
  if not found then raise exception 'Оберіть активний етап відновлення'; end if;

  select coalesce(sum(quantity), 0) into v_allocated
  from public.vkya_scrap_lot_allocations
  where classification_category_id = v_category.id;
  v_available := v_category.quantity - v_allocated;
  if p_quantity > v_available then raise exception 'У партії доступно лише % шт.', greatest(0, v_available); end if;

  v_storage_type := case when v_category.category = 2 then 'scrap_cat_2' else 'scrap_cat_1' end;
  perform public.vkya_take_recoverable_scrap(v_classification.nomenclature_id, v_storage_type, p_quantity);

  select name, unit into v_name, v_unit
  from public.nomenclatures where id = v_classification.nomenclature_id;
  v_source_history_id := coalesce(
    v_classification.source_history_id,
    nullif(substring(coalesce(v_classification.notes, '') from '\[VKYA_ORIGIN_HISTORY:([0-9a-fA-F-]{36})\]'), '')::uuid
  );

  insert into public.vkya_restoration_cards (
    source_inventory_id, nomenclature_id, nomenclature_name, unit,
    restoration_stage_id, restoration_stage, quantity,
    created_by_user_id, created_by_name,
    source_history_id, source_card_id, source_task_id, source_order_id, source_stage_name
  ) values (
    null, v_classification.nomenclature_id, coalesce(v_name, 'Деталь'), coalesce(v_unit, 'шт'),
    v_stage.id, v_stage.name, p_quantity,
    p_created_by_user_id, nullif(btrim(p_created_by_name), ''),
    v_source_history_id, v_classification.card_id, v_classification.task_id,
    v_classification.order_id, v_classification.source_stage_name
  ) returning id into v_card_id;

  insert into public.vkya_scrap_lot_allocations (
    classification_category_id, quantity, action, restoration_card_id,
    allocated_by_user_id, allocated_by_name
  ) values (
    v_category.id, p_quantity, 'restoration', v_card_id,
    p_created_by_user_id, nullif(btrim(p_created_by_name), '')
  );

  return v_card_id;
end;
$body$;

revoke all on function public.create_vkya_restoration_from_lot(bigint,integer,uuid,bigint,text) from public;
grant execute on function public.create_vkya_restoration_from_lot(bigint,integer,uuid,bigint,text) to anon, authenticated;

create or replace function public.create_vkya_rework_from_lot(
  p_classification_category_id bigint,
  p_quantity integer,
  p_created_by_user_id bigint default null,
  p_created_by_name text default null
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $body$
declare
  v_category public.scrap_classification_categories%rowtype;
  v_classification public.scrap_classifications%rowtype;
  v_allocated numeric;
  v_available numeric;
  v_storage_type text;
  v_name text;
  v_code text;
  v_order_number text;
  v_order_id uuid;
  v_task_id uuid;
  v_card_id uuid;
begin
  if p_quantity is null or p_quantity <= 0 then raise exception 'Кількість має бути більшою за нуль'; end if;

  select * into v_category from public.scrap_classification_categories
  where id = p_classification_category_id for update;
  if not found or v_category.category not in (1, 2, 3) then raise exception 'Партію браку не знайдено'; end if;

  select * into v_classification from public.scrap_classifications
  where id = v_category.classification_id for update;
  if not found then raise exception 'Класифікацію партії не знайдено'; end if;

  select coalesce(sum(quantity), 0) into v_allocated
  from public.vkya_scrap_lot_allocations
  where classification_category_id = v_category.id;
  v_available := v_category.quantity - v_allocated;
  if p_quantity > v_available then raise exception 'У партії доступно лише % шт.', greatest(0, v_available); end if;

  v_storage_type := case when v_category.category = 2 then 'scrap_cat_2' else 'scrap_cat_1' end;
  perform public.vkya_take_recoverable_scrap(v_classification.nomenclature_id, v_storage_type, p_quantity);

  select name, nomenclature_code into v_name, v_code
  from public.nomenclatures where id = v_classification.nomenclature_id;

  perform pg_advisory_xact_lock(hashtextextended('vkya-rework-order-number', 0));
  select 'ВБ' || lpad((coalesce(max(substring(order_num from '^ВБ([0-9]+)$')::integer), 0) + 1)::text, 4, '0')
  into v_order_number
  from public.orders
  where order_num ~ '^ВБ[0-9]+$';

  insert into public.orders (order_num, customer, status)
  values (v_order_number, 'ВНУТРІШНЄ ДООПРАЦЮВАННЯ', 'in-progress')
  returning id into v_order_id;

  insert into public.tasks (
    order_id, step, status, machine_name, estimated_time,
    engineer_conf, warehouse_conf, director_conf, plan_snapshot, planned_sets
  ) values (
    v_order_id, 'Доопрацювання', 'waiting', 'Доопрацювання', 0,
    true, 'true', true,
    jsonb_build_object(v_classification.nomenclature_id::text, jsonb_build_object(
      'id', v_classification.nomenclature_id,
      'name', coalesce(v_name, 'Деталь'),
      'code', coalesce(v_code, '—'),
      'need', p_quantity,
      'stock', 0,
      'plan', p_quantity,
      'is_rework', true,
      'source_order_id', v_classification.order_id,
      'source_task_id', v_classification.task_id,
      'source_card_id', v_classification.card_id,
      'source_classification_id', v_classification.id
    )),
    0
  ) returning id into v_task_id;

  insert into public.work_cards (
    task_id, order_id, nomenclature_id, quantity, status, operation, card_info
  ) values (
    v_task_id, v_order_id, v_classification.nomenclature_id, p_quantity,
    'new', 'Доопрацювання',
    format('[REWORK] [ЦЕХ №2] [VKYA_LOT:%s] [SOURCE_ORDER:%s] [SOURCE_TASK:%s] [SOURCE_CARD:%s] %s — ДООПРАЦЮВАННЯ БРАКУ',
      v_category.id, v_classification.order_id, v_classification.task_id,
      v_classification.card_id, coalesce(v_name, 'Деталь'))
  ) returning id into v_card_id;

  insert into public.vkya_scrap_lot_allocations (
    classification_category_id, quantity, action,
    rework_order_id, rework_task_id, rework_card_id,
    allocated_by_user_id, allocated_by_name
  ) values (
    v_category.id, p_quantity, 'rework_order',
    v_order_id, v_task_id, v_card_id,
    p_created_by_user_id, nullif(btrim(p_created_by_name), '')
  );

  return jsonb_build_object(
    'order_id', v_order_id,
    'task_id', v_task_id,
    'card_id', v_card_id,
    'order_number', v_order_number
  );
end;
$body$;

revoke all on function public.create_vkya_rework_from_lot(bigint,integer,bigint,text) from public;
grant execute on function public.create_vkya_rework_from_lot(bigint,integer,bigint,text) to anon, authenticated;

do $publication$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'vkya_scrap_lot_allocations'
     ) then
    alter publication supabase_realtime add table public.vkya_scrap_lot_allocations;
  end if;
end;
$publication$;

commit;
