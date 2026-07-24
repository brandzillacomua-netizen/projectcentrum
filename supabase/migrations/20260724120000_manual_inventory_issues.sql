-- Manual operational-warehouse issues initiated by nomenclature QR codes.
-- The stock deduction and audit row are committed as one transaction.

create table if not exists public.manual_inventory_issues (
  id uuid primary key default gen_random_uuid(),
  nomenclature_id uuid not null references public.nomenclatures(id) on delete restrict,
  quantity numeric not null check (quantity > 0),
  unit text not null,
  stock_before numeric not null check (stock_before >= 0),
  stock_after numeric not null check (stock_after >= 0),
  issued_by_id bigint,
  issued_by_name text not null,
  source_module text not null check (source_module in ('warehouse', 'warehouse_boxes')),
  created_at timestamptz not null default clock_timestamp()
);

create index if not exists idx_manual_inventory_issues_created_at
  on public.manual_inventory_issues (created_at desc);
create index if not exists idx_manual_inventory_issues_nomenclature
  on public.manual_inventory_issues (nomenclature_id, created_at desc);

alter table public.manual_inventory_issues enable row level security;
revoke all on table public.manual_inventory_issues from public, anon, authenticated;

create or replace function public.issue_operational_inventory_manually(
  p_nomenclature_id uuid,
  p_quantity numeric,
  p_issued_by_id bigint,
  p_issued_by_name text,
  p_source_module text
)
returns public.manual_inventory_issues
language plpgsql
volatile
security definer
set search_path = pg_catalog, public
as $manual_issue$
declare
  v_available numeric;
  v_remaining numeric := p_quantity;
  v_take numeric;
  v_row public.inventory%rowtype;
  v_issue public.manual_inventory_issues%rowtype;
  v_unit text;
begin
  if p_nomenclature_id is null then
    raise exception 'Номенклатуру не вказано';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Кількість має бути більшою за нуль';
  end if;
  if coalesce(trim(p_issued_by_name), '') = '' then
    raise exception 'Користувача, який виконує видачу, не визначено';
  end if;
  if p_source_module not in ('warehouse', 'warehouse_boxes') then
    raise exception 'Невідоме джерело ручної видачі';
  end if;

  -- Lock every matching operational row so two scanners cannot spend the same stock.
  perform 1
  from public.inventory
  where nomenclature_id = p_nomenclature_id
    and (warehouse = 'operational' or warehouse is null)
  for update;

  select
    coalesce(sum(greatest(coalesce(total_qty, 0) - coalesce(reserved_qty, 0), 0)), 0),
    max(coalesce(unit, 'шт'))
  into v_available, v_unit
  from public.inventory
  where nomenclature_id = p_nomenclature_id
    and (warehouse = 'operational' or warehouse is null);

  if v_available < p_quantity then
    raise exception 'Недостатньо вільного залишку. Доступно: %', v_available;
  end if;

  for v_row in
    select *
    from public.inventory
    where nomenclature_id = p_nomenclature_id
      and (warehouse = 'operational' or warehouse is null)
      and coalesce(total_qty, 0) > coalesce(reserved_qty, 0)
    order by (coalesce(total_qty, 0) - coalesce(reserved_qty, 0)) desc, id
    for update
  loop
    exit when v_remaining <= 0;
    v_take := least(
      v_remaining,
      greatest(coalesce(v_row.total_qty, 0) - coalesce(v_row.reserved_qty, 0), 0)
    );
    if v_take > 0 then
      update public.inventory
      set total_qty = coalesce(total_qty, 0) - v_take
      where id = v_row.id;
      v_remaining := v_remaining - v_take;
    end if;
  end loop;

  insert into public.manual_inventory_issues (
    nomenclature_id, quantity, unit, stock_before, stock_after,
    issued_by_id, issued_by_name, source_module
  ) values (
    p_nomenclature_id, p_quantity, coalesce(v_unit, 'шт'),
    v_available, v_available - p_quantity,
    p_issued_by_id, trim(p_issued_by_name), p_source_module
  )
  returning * into v_issue;

  return v_issue;
end;
$manual_issue$;

create or replace function public.manual_inventory_issue_journal(p_limit integer default 100)
returns table (
  id uuid,
  nomenclature_id uuid,
  nomenclature_name text,
  quantity numeric,
  unit text,
  stock_before numeric,
  stock_after numeric,
  issued_by_name text,
  source_module text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $journal$
  select
    i.id, i.nomenclature_id, n.name, i.quantity, i.unit,
    i.stock_before, i.stock_after, i.issued_by_name,
    i.source_module, i.created_at
  from public.manual_inventory_issues i
  join public.nomenclatures n on n.id = i.nomenclature_id
  order by i.created_at desc
  limit least(greatest(coalesce(p_limit, 100), 1), 500);
$journal$;

revoke all on function public.issue_operational_inventory_manually(uuid,numeric,bigint,text,text) from public;
revoke all on function public.manual_inventory_issue_journal(integer) from public;
grant execute on function public.issue_operational_inventory_manually(uuid,numeric,bigint,text,text) to anon, authenticated;
grant execute on function public.manual_inventory_issue_journal(integer) to anon, authenticated;

