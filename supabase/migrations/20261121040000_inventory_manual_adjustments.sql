-- Manual inventory stock adjustments (+ / -) with atomic audit log

create table if not exists public.inventory_manual_adjustments (
  id uuid primary key default gen_random_uuid(),
  inventory_id uuid not null references public.inventory(id) on delete cascade,
  nomenclature_id uuid,
  item_name text not null,
  warehouse text,
  action text not null check (action in ('add', 'subtract')),
  delta_qty numeric not null check (delta_qty > 0),
  qty_before numeric not null check (qty_before >= 0),
  qty_after numeric not null check (qty_after >= 0),
  reason text,
  actor_id bigint,
  actor_name text not null,
  source_module text not null default 'warehouse',
  created_at timestamptz not null default clock_timestamp()
);

create index if not exists idx_inv_manual_adj_created_at
  on public.inventory_manual_adjustments (created_at desc);
create index if not exists idx_inv_manual_adj_inventory_id
  on public.inventory_manual_adjustments (inventory_id, created_at desc);

alter table public.inventory_manual_adjustments enable row level security;
revoke all on table public.inventory_manual_adjustments from public, anon, authenticated;

create or replace function public.adjust_inventory_manually(
  p_inventory_id uuid,
  p_action text,
  p_delta_qty numeric,
  p_actor_id bigint,
  p_actor_name text,
  p_reason text default null,
  p_source_module text default 'warehouse'
)
returns public.inventory_manual_adjustments
language plpgsql
volatile
security definer
set search_path = pg_catalog, public
as $adjust_inv$
declare
  v_row public.inventory%rowtype;
  v_before numeric;
  v_after numeric;
  v_adj public.inventory_manual_adjustments%rowtype;
begin
  if p_inventory_id is null then
    raise exception 'Не вказано позицію складу';
  end if;
  if p_action not in ('add', 'subtract') then
    raise exception 'Невідома дія корекції: %', p_action;
  end if;
  if p_delta_qty is null or p_delta_qty <= 0 then
    raise exception 'Кількість має бути більшою за нуль';
  end if;
  if coalesce(trim(p_actor_name), '') = '' then
    raise exception 'Не визначено користувача для журналу корекцій';
  end if;

  select *
  into v_row
  from public.inventory
  where id = p_inventory_id
  for update;

  if not found then
    raise exception 'Позицію складу не знайдено';
  end if;

  v_before := coalesce(v_row.total_qty, 0);
  if p_action = 'add' then
    v_after := v_before + p_delta_qty;
  else
    if v_before < p_delta_qty then
      raise exception 'Недостатньо залишку для віднімання. Поточний залишок: %', v_before;
    end if;
    v_after := v_before - p_delta_qty;
  end if;

  update public.inventory
  set total_qty = v_after,
      updated_at = now()
  where id = v_row.id;

  insert into public.inventory_manual_adjustments (
    inventory_id,
    nomenclature_id,
    item_name,
    warehouse,
    action,
    delta_qty,
    qty_before,
    qty_after,
    reason,
    actor_id,
    actor_name,
    source_module
  ) values (
    v_row.id,
    v_row.nomenclature_id,
    coalesce(nullif(trim(v_row.name), ''), 'Без назви'),
    v_row.warehouse,
    p_action,
    p_delta_qty,
    v_before,
    v_after,
    nullif(trim(coalesce(p_reason, '')), ''),
    p_actor_id,
    trim(p_actor_name),
    coalesce(nullif(trim(p_source_module), ''), 'warehouse')
  )
  returning * into v_adj;

  return v_adj;
end;
$adjust_inv$;

create or replace function public.get_inventory_adjustments_journal(
  p_limit integer default 150
)
returns table (
  id uuid,
  inventory_id uuid,
  nomenclature_id uuid,
  item_name text,
  warehouse text,
  action text,
  delta_qty numeric,
  qty_before numeric,
  qty_after numeric,
  reason text,
  actor_name text,
  source_module text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $adj_journal$
  select
    a.id,
    a.inventory_id,
    a.nomenclature_id,
    a.item_name,
    a.warehouse,
    a.action,
    a.delta_qty,
    a.qty_before,
    a.qty_after,
    a.reason,
    a.actor_name,
    a.source_module,
    a.created_at
  from public.inventory_manual_adjustments a
  order by a.created_at desc
  limit least(greatest(coalesce(p_limit, 150), 1), 500);
$adj_journal$;

revoke all on function public.adjust_inventory_manually(uuid, text, numeric, bigint, text, text, text) from public;
revoke all on function public.get_inventory_adjustments_journal(integer) from public;
grant execute on function public.adjust_inventory_manually(uuid, text, numeric, bigint, text, text, text) to anon, authenticated;
grant execute on function public.get_inventory_adjustments_journal(integer) to anon, authenticated;

notify pgrst, 'reload schema';
