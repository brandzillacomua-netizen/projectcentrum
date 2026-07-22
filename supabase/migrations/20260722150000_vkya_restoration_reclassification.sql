create table if not exists public.vkya_reclassification_queue (
  id uuid primary key default gen_random_uuid(),
  restoration_card_id uuid not null references public.vkya_restoration_cards(id) on delete restrict,
  nomenclature_id uuid not null,
  nomenclature_name text not null,
  source_stage text not null,
  quantity integer not null check (quantity > 0),
  classified_quantity integer not null default 0 check (classified_quantity >= 0 and classified_quantity <= quantity),
  status text not null default 'pending' check (status in ('pending', 'classified')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restoration_card_id)
);

create index if not exists vkya_reclassification_queue_status_idx
  on public.vkya_reclassification_queue (status, created_at desc);

alter table public.vkya_reclassification_queue enable row level security;
grant select, insert, update on public.vkya_reclassification_queue to anon, authenticated;

drop policy if exists "vkya_reclassification_queue_read" on public.vkya_reclassification_queue;
create policy "vkya_reclassification_queue_read" on public.vkya_reclassification_queue
  for select to anon, authenticated using (true);
drop policy if exists "vkya_reclassification_queue_insert" on public.vkya_reclassification_queue;
create policy "vkya_reclassification_queue_insert" on public.vkya_reclassification_queue
  for insert to anon, authenticated with check (true);
drop policy if exists "vkya_reclassification_queue_update" on public.vkya_reclassification_queue;
create policy "vkya_reclassification_queue_update" on public.vkya_reclassification_queue
  for update to anon, authenticated using (true) with check (true);

create or replace function public.complete_vkya_restoration_card(
  p_card_id uuid,
  p_completed_quantity integer
) returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
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
      source_stage, quantity
    ) values (
      v_card.id, v_card.nomenclature_id, v_card.nomenclature_name,
      v_card.restoration_stage || ' (ВКЯ)', v_return_quantity
    );
  end if;
  return v_return_quantity;
end;
$$;

revoke all on function public.complete_vkya_restoration_card(uuid,integer) from public;
grant execute on function public.complete_vkya_restoration_card(uuid,integer) to anon, authenticated;
