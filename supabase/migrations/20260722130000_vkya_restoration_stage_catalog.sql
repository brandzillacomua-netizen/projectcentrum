create table if not exists public.vkya_restoration_stages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vkya_restoration_stages_name_not_blank check (btrim(name) <> '')
);

create unique index if not exists vkya_restoration_stages_name_unique
  on public.vkya_restoration_stages (lower(btrim(name)));

alter table public.vkya_restoration_stages enable row level security;
grant select, insert, update, delete on public.vkya_restoration_stages to anon, authenticated;

drop policy if exists "vkya_restoration_stages_read" on public.vkya_restoration_stages;
create policy "vkya_restoration_stages_read" on public.vkya_restoration_stages
  for select to anon, authenticated using (true);
drop policy if exists "vkya_restoration_stages_insert" on public.vkya_restoration_stages;
create policy "vkya_restoration_stages_insert" on public.vkya_restoration_stages
  for insert to anon, authenticated with check (true);
drop policy if exists "vkya_restoration_stages_update" on public.vkya_restoration_stages;
create policy "vkya_restoration_stages_update" on public.vkya_restoration_stages
  for update to anon, authenticated using (true) with check (true);
drop policy if exists "vkya_restoration_stages_delete" on public.vkya_restoration_stages;
create policy "vkya_restoration_stages_delete" on public.vkya_restoration_stages
  for delete to anon, authenticated using (true);

insert into public.vkya_restoration_stages (name, sort_order) values
  ('Шліфування на гріндері', 10),
  ('Шліфування ручне (губкою)', 20),
  ('Проклейка тріщин матеріалу', 30),
  ('Проклейка прес-гайок', 40),
  ('Кондуктор', 50),
  ('На доочищення дівчатам вручну', 60)
on conflict do nothing;

alter table public.vkya_restoration_cards
  add column if not exists restoration_stage_id uuid references public.vkya_restoration_stages(id) on delete restrict;

drop function if exists public.create_vkya_restoration_card(uuid,integer,text,bigint,text);

create or replace function public.create_vkya_restoration_card(
  p_inventory_id uuid,
  p_quantity integer,
  p_restoration_stage_id uuid,
  p_created_by_user_id bigint default null,
  p_created_by_name text default null
) returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_inventory public.inventory%rowtype;
  v_stage public.vkya_restoration_stages%rowtype;
  v_card_id uuid;
  v_remaining numeric;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Кількість має бути більшою за нуль';
  end if;

  select * into v_stage from public.vkya_restoration_stages
   where id = p_restoration_stage_id and is_active = true;
  if not found then
    raise exception 'Оберіть активний етап відновлення';
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
    restoration_stage_id, restoration_stage, quantity, created_by_user_id, created_by_name
  ) values (
    v_inventory.id, v_inventory.nomenclature_id, coalesce(v_inventory.name, 'Деталь'),
    coalesce(v_inventory.unit, 'шт'), v_stage.id, v_stage.name, p_quantity,
    p_created_by_user_id, nullif(btrim(p_created_by_name), '')
  ) returning id into v_card_id;

  v_remaining := coalesce(v_inventory.total_qty, 0) - p_quantity;
  if v_remaining = 0 then
    delete from public.inventory where id = v_inventory.id;
  else
    update public.inventory set total_qty = v_remaining, updated_at = now() where id = v_inventory.id;
  end if;
  return v_card_id;
end;
$$;

revoke all on function public.create_vkya_restoration_card(uuid,integer,uuid,bigint,text) from public;
grant execute on function public.create_vkya_restoration_card(uuid,integer,uuid,bigint,text) to anon, authenticated;
