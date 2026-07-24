-- Authoritative BZ accounting.
-- BZ available stock is stored in inventory(type = 'bz').
-- Allocation to a production order atomically moves it to type = 'wip_bz'.

create table if not exists public.bz_inventory_reservations (
  id uuid primary key default gen_random_uuid(),
  operation_id uuid not null,
  order_id uuid,
  task_id uuid,
  nomenclature_id uuid not null references public.nomenclatures(id) on delete restrict,
  requested_qty numeric not null check (requested_qty >= 0),
  allocated_qty numeric not null check (allocated_qty >= 0),
  status text not null default 'allocated' check (status in ('allocated', 'released')),
  actor_id bigint,
  actor_name text,
  created_at timestamptz not null default now(),
  released_at timestamptz,
  release_reason text,
  unique (operation_id, nomenclature_id)
);

create index if not exists idx_bz_reservations_task
  on public.bz_inventory_reservations(task_id);
create index if not exists idx_bz_reservations_nomenclature_status
  on public.bz_inventory_reservations(nomenclature_id, status);

create table if not exists public.bz_inventory_ledger (
  id uuid primary key default gen_random_uuid(),
  operation_id uuid not null default gen_random_uuid(),
  reservation_id uuid references public.bz_inventory_reservations(id) on delete set null,
  nomenclature_id uuid not null references public.nomenclatures(id) on delete restrict,
  movement_type text not null,
  from_bucket text,
  to_bucket text,
  quantity numeric not null check (quantity >= 0),
  from_balance_before numeric,
  from_balance_after numeric,
  to_balance_before numeric,
  to_balance_after numeric,
  order_id uuid,
  task_id uuid,
  actor_id bigint,
  actor_name text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_bz_ledger_nomenclature_created
  on public.bz_inventory_ledger(nomenclature_id, created_at desc);
create index if not exists idx_bz_ledger_operation
  on public.bz_inventory_ledger(operation_id);
create index if not exists idx_bz_ledger_task
  on public.bz_inventory_ledger(task_id);

alter table public.bz_inventory_reservations enable row level security;
alter table public.bz_inventory_ledger enable row level security;

drop policy if exists "bz reservations readable" on public.bz_inventory_reservations;
create policy "bz reservations readable"
  on public.bz_inventory_reservations for select
  using (true);

drop policy if exists "bz ledger readable" on public.bz_inventory_ledger;
create policy "bz ledger readable"
  on public.bz_inventory_ledger for select
  using (true);

-- Catch every older/direct inventory write as well. Enriched RPC movements set a
-- transaction-local flag and write their own ledger row, so they are not doubled.
create or replace function public.audit_legacy_bz_inventory_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_qty numeric := coalesce(old.total_qty, 0);
  v_new_qty numeric := coalesce(new.total_qty, 0);
  v_nom uuid := coalesce(new.nomenclature_id, old.nomenclature_id);
  v_type text := coalesce(new.type, old.type);
begin
  if current_setting('app.bz_enriched_ledger', true) = '1' then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;

  if coalesce(old.type, '') not in ('bz', 'wip_bz', 'bz_shop2')
     and coalesce(new.type, '') not in ('bz', 'wip_bz', 'bz_shop2') then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;

  if tg_op = 'UPDATE' and v_old_qty = v_new_qty and old.type is not distinct from new.type then
    return new;
  end if;

  insert into public.bz_inventory_ledger (
    nomenclature_id, movement_type, from_bucket, to_bucket, quantity,
    from_balance_before, from_balance_after, to_balance_before, to_balance_after,
    metadata
  ) values (
    v_nom,
    case tg_op when 'INSERT' then 'legacy_insert'
               when 'DELETE' then 'legacy_delete'
               else 'legacy_adjustment' end,
    case when tg_op <> 'INSERT' then old.type end,
    case when tg_op <> 'DELETE' then new.type end,
    abs(v_new_qty - v_old_qty),
    case when tg_op <> 'INSERT' then v_old_qty end,
    case when tg_op <> 'INSERT' then case when tg_op = 'DELETE' then 0 else v_new_qty end end,
    case when tg_op <> 'DELETE' then case when tg_op = 'INSERT' then 0 else v_old_qty end end,
    case when tg_op <> 'DELETE' then v_new_qty end,
    jsonb_build_object('inventory_id', coalesce(new.id, old.id), 'database_operation', tg_op)
  );

  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;

drop trigger if exists trg_audit_legacy_bz_inventory_change on public.inventory;
create trigger trg_audit_legacy_bz_inventory_change
after insert or update or delete on public.inventory
for each row execute function public.audit_legacy_bz_inventory_change();

create or replace function public.reserve_bz_for_naryad(
  p_operation_id uuid,
  p_order_id uuid,
  p_items jsonb,
  p_actor_id bigint default null,
  p_actor_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_nom_id uuid;
  v_requested numeric;
  v_available_row public.inventory%rowtype;
  v_wip_row public.inventory%rowtype;
  v_available numeric;
  v_allocated numeric;
  v_reservation public.bz_inventory_reservations%rowtype;
  v_result jsonb := '[]'::jsonb;
begin
  if p_operation_id is null then
    raise exception 'operation_id is required';
  end if;

  if exists (
    select 1 from public.bz_inventory_reservations
    where operation_id = p_operation_id
  ) then
    return jsonb_build_object(
      'operation_id', p_operation_id,
      'allocations', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'reservation_id', id,
          'nomenclature_id', nomenclature_id,
          'requested_qty', requested_qty,
          'allocated_qty', allocated_qty
        ) order by created_at), '[]'::jsonb)
        from public.bz_inventory_reservations
        where operation_id = p_operation_id
      )
    );
  end if;

  perform set_config('app.bz_enriched_ledger', '1', true);

  for v_item in
    select value from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    v_nom_id := (v_item->>'nomenclature_id')::uuid;
    v_requested := greatest(coalesce((v_item->>'quantity')::numeric, 0), 0);
    if v_requested = 0 then
      continue;
    end if;

    select * into v_available_row
    from public.inventory
    where nomenclature_id = v_nom_id
      and type = 'bz'
      and (pocket_owner is null or pocket_owner = 'Не вказано')
    order by case when warehouse = 'operational' then 0 else 1 end, created_at, id
    limit 1
    for update;

    v_available := greatest(
      coalesce(v_available_row.total_qty, 0) - coalesce(v_available_row.reserved_qty, 0),
      0
    );
    v_allocated := least(v_requested, v_available);

    insert into public.bz_inventory_reservations (
      operation_id, order_id, nomenclature_id, requested_qty, allocated_qty,
      actor_id, actor_name
    ) values (
      p_operation_id, p_order_id, v_nom_id, v_requested, v_allocated,
      p_actor_id, p_actor_name
    )
    returning * into v_reservation;

    if v_allocated > 0 then
      update public.inventory
      set total_qty = coalesce(total_qty, 0) - v_allocated,
          updated_at = now()
      where id = v_available_row.id;

      select * into v_wip_row
      from public.inventory
      where nomenclature_id = v_nom_id and type = 'wip_bz'
      order by created_at, id
      limit 1
      for update;

      if v_wip_row.id is null then
        insert into public.inventory (
          nomenclature_id, name, total_qty, reserved_qty, type, unit, pocket_owner
        )
        select n.id, n.name, v_allocated, 0, 'wip_bz', coalesce(n.unit, 'шт'), null
        from public.nomenclatures n where n.id = v_nom_id
        returning * into v_wip_row;
      else
        update public.inventory
        set total_qty = coalesce(total_qty, 0) + v_allocated,
            updated_at = now()
        where id = v_wip_row.id
        returning * into v_wip_row;
      end if;

      insert into public.bz_inventory_ledger (
        operation_id, reservation_id, nomenclature_id, movement_type,
        from_bucket, to_bucket, quantity,
        from_balance_before, from_balance_after, to_balance_before, to_balance_after,
        order_id, actor_id, actor_name
      ) values (
        p_operation_id, v_reservation.id, v_nom_id, 'allocate_to_naryad',
        'bz', 'wip_bz', v_allocated,
        v_available_row.total_qty, v_available_row.total_qty - v_allocated,
        coalesce(v_wip_row.total_qty, 0) - v_allocated, v_wip_row.total_qty,
        p_order_id, p_actor_id, p_actor_name
      );
    end if;

    v_result := v_result || jsonb_build_array(jsonb_build_object(
      'reservation_id', v_reservation.id,
      'nomenclature_id', v_nom_id,
      'requested_qty', v_requested,
      'allocated_qty', v_allocated,
      'available_before', v_available,
      'available_after', v_available - v_allocated
    ));
  end loop;

  return jsonb_build_object('operation_id', p_operation_id, 'allocations', v_result);
end;
$$;

create or replace function public.attach_bz_reservation_to_task(
  p_operation_id uuid,
  p_task_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.bz_inventory_reservations
  set task_id = p_task_id
  where operation_id = p_operation_id and task_id is null;

  update public.bz_inventory_ledger
  set task_id = p_task_id
  where operation_id = p_operation_id and task_id is null;
end;
$$;

create or replace function public.release_bz_reservation(
  p_operation_id uuid,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_res public.bz_inventory_reservations%rowtype;
  v_bz public.inventory%rowtype;
  v_wip public.inventory%rowtype;
  v_release numeric;
begin
  perform set_config('app.bz_enriched_ledger', '1', true);

  for v_res in
    select * from public.bz_inventory_reservations
    where operation_id = p_operation_id and status = 'allocated'
    order by created_at, id
    for update
  loop
    v_release := v_res.allocated_qty;
    if v_release > 0 then
      select * into v_wip
      from public.inventory
      where nomenclature_id = v_res.nomenclature_id and type = 'wip_bz'
      order by created_at, id limit 1 for update;

      if v_wip.id is null or coalesce(v_wip.total_qty, 0) < v_release then
        raise exception 'Cannot release BZ reservation %, WIP balance is insufficient', v_res.id;
      end if;

      select * into v_bz
      from public.inventory
      where nomenclature_id = v_res.nomenclature_id
        and type = 'bz'
        and (pocket_owner is null or pocket_owner = 'Не вказано')
      order by case when warehouse = 'operational' then 0 else 1 end, created_at, id
      limit 1 for update;

      update public.inventory
      set total_qty = total_qty - v_release, updated_at = now()
      where id = v_wip.id;

      if v_bz.id is null then
        insert into public.inventory (
          nomenclature_id, name, total_qty, reserved_qty, type, unit, pocket_owner
        )
        select n.id, n.name, v_release, 0, 'bz', coalesce(n.unit, 'шт'), null
        from public.nomenclatures n where n.id = v_res.nomenclature_id
        returning * into v_bz;
      else
        update public.inventory
        set total_qty = coalesce(total_qty, 0) + v_release, updated_at = now()
        where id = v_bz.id
        returning * into v_bz;
      end if;

      insert into public.bz_inventory_ledger (
        operation_id, reservation_id, nomenclature_id, movement_type,
        from_bucket, to_bucket, quantity,
        from_balance_before, from_balance_after, to_balance_before, to_balance_after,
        order_id, task_id, actor_id, actor_name, metadata
      ) values (
        p_operation_id, v_res.id, v_res.nomenclature_id, 'release_naryad_allocation',
        'wip_bz', 'bz', v_release,
        v_wip.total_qty, v_wip.total_qty - v_release,
        coalesce(v_bz.total_qty, 0) - v_release, v_bz.total_qty,
        v_res.order_id, v_res.task_id, v_res.actor_id, v_res.actor_name,
        jsonb_build_object('reason', p_reason)
      );
    end if;

    update public.bz_inventory_reservations
    set status = 'released', released_at = now(), release_reason = p_reason
    where id = v_res.id;
  end loop;
end;
$$;

-- Establish a forward-auditable opening point without rewriting current balances.
insert into public.bz_inventory_ledger (
  nomenclature_id, movement_type, to_bucket, quantity,
  to_balance_before, to_balance_after, metadata, created_at
)
select i.nomenclature_id, 'opening_balance', i.type, greatest(coalesce(i.total_qty, 0), 0),
       0, coalesce(i.total_qty, 0),
       jsonb_build_object('inventory_id', i.id, 'note', 'Ledger introduced from current inventory snapshot'),
       now()
from public.inventory i
where i.type in ('bz', 'wip_bz', 'bz_shop2')
  and not exists (
    select 1 from public.bz_inventory_ledger l
    where l.movement_type = 'opening_balance'
      and l.metadata->>'inventory_id' = i.id::text
  );

grant select on public.bz_inventory_reservations to anon, authenticated;
grant select on public.bz_inventory_ledger to anon, authenticated;
grant execute on function public.reserve_bz_for_naryad(uuid, uuid, jsonb, bigint, text) to anon, authenticated;
grant execute on function public.attach_bz_reservation_to_task(uuid, uuid) to anon, authenticated;
grant execute on function public.release_bz_reservation(uuid, text) to anon, authenticated;
