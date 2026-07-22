create extension if not exists pgcrypto;

create table if not exists public.vkya_restoration_cards (
  id uuid primary key default gen_random_uuid(),
  card_number bigint generated always as identity unique,
  source_inventory_id uuid,
  nomenclature_id uuid not null,
  nomenclature_name text not null,
  unit text not null default 'шт',
  restoration_stage text not null check (btrim(restoration_stage) <> ''),
  quantity integer not null check (quantity > 0),
  completed_quantity integer not null default 0 check (completed_quantity >= 0 and completed_quantity <= quantity),
  status text not null default 'new' check (status in ('new', 'in_progress', 'completed')),
  operator_name text,
  created_by_user_id bigint,
  created_by_name text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists vkya_restoration_cards_queue_idx
  on public.vkya_restoration_cards (status, created_at);
create index if not exists vkya_restoration_cards_nomenclature_idx
  on public.vkya_restoration_cards (nomenclature_id, created_at desc);

alter table public.vkya_restoration_cards enable row level security;
grant select, insert, update on public.vkya_restoration_cards to anon, authenticated;
grant usage, select on sequence public.vkya_restoration_cards_card_number_seq to anon, authenticated;

drop policy if exists "vkya_restoration_cards_read" on public.vkya_restoration_cards;
create policy "vkya_restoration_cards_read" on public.vkya_restoration_cards
  for select to anon, authenticated using (true);
drop policy if exists "vkya_restoration_cards_insert" on public.vkya_restoration_cards;
create policy "vkya_restoration_cards_insert" on public.vkya_restoration_cards
  for insert to anon, authenticated with check (true);
drop policy if exists "vkya_restoration_cards_update" on public.vkya_restoration_cards;
create policy "vkya_restoration_cards_update" on public.vkya_restoration_cards
  for update to anon, authenticated using (true) with check (true);

create or replace function public.create_vkya_restoration_card(
  p_inventory_id uuid,
  p_quantity integer,
  p_restoration_stage text,
  p_created_by_user_id bigint default null,
  p_created_by_name text default null
) returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_inventory public.inventory%rowtype;
  v_card_id uuid;
  v_remaining numeric;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Кількість має бути більшою за нуль';
  end if;
  if nullif(btrim(p_restoration_stage), '') is null then
    raise exception 'Етап відновлення обов''язковий';
  end if;

  select * into v_inventory from public.inventory where id = p_inventory_id for update;
  if not found or v_inventory.type not like 'scrap_cat_%' then
    raise exception 'Позицію браку не знайдено або вона вже переміщена';
  end if;
  if p_quantity > coalesce(v_inventory.total_qty, 0) then
    raise exception 'Запитана кількість перевищує доступний залишок';
  end if;

  insert into public.vkya_restoration_cards (
    source_inventory_id, nomenclature_id, nomenclature_name, unit,
    restoration_stage, quantity, created_by_user_id, created_by_name
  ) values (
    v_inventory.id, v_inventory.nomenclature_id, coalesce(v_inventory.name, 'Деталь'),
    coalesce(v_inventory.unit, 'шт'), btrim(p_restoration_stage), p_quantity,
    p_created_by_user_id, nullif(btrim(p_created_by_name), '')
  ) returning id into v_card_id;

  v_remaining := coalesce(v_inventory.total_qty, 0) - p_quantity;
  if v_remaining = 0 then
    delete from public.inventory where id = v_inventory.id;
  else
    update public.inventory
       set total_qty = v_remaining, updated_at = now()
     where id = v_inventory.id;
  end if;

  return v_card_id;
end;
$$;

revoke all on function public.create_vkya_restoration_card(uuid,integer,text,bigint,text) from public;
grant execute on function public.create_vkya_restoration_card(uuid,integer,text,bigint,text) to anon, authenticated;
