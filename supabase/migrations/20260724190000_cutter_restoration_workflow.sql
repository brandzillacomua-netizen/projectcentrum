create table if not exists public.cutter_usage_events (
  id uuid primary key default gen_random_uuid(),
  source_card_id uuid not null references public.work_cards(id) on delete restrict,
  task_id uuid,
  order_id uuid,
  nomenclature_id uuid not null references public.nomenclatures(id) on delete restrict,
  quantity numeric not null check (quantity > 0),
  is_faceting boolean not null default false,
  pocket_owner text,
  actor_id bigint,
  actor_name text,
  created_at timestamptz not null default now(),
  unique (source_card_id, nomenclature_id)
);

create table if not exists public.cutter_restoration_batches (
  id uuid primary key default gen_random_uuid(),
  batch_number text not null unique,
  usage_event_id uuid not null unique references public.cutter_usage_events(id) on delete restrict,
  source_card_id uuid not null references public.work_cards(id) on delete restrict,
  task_id uuid,
  order_id uuid,
  nomenclature_id uuid not null references public.nomenclatures(id) on delete restrict,
  cutter_name text not null,
  received_qty numeric not null check (received_qty > 0),
  restored_qty numeric not null default 0 check (restored_qty >= 0),
  rejected_qty numeric not null default 0 check (rejected_qty >= 0),
  status text not null default 'pending'
    check (status in ('pending', 'in_progress', 'awaiting_reception', 'completed')),
  source_operator text,
  source_manager text,
  source_machine text,
  assigned_user_id bigint,
  assigned_user_name text,
  started_at timestamptz,
  finished_at timestamptz,
  reception_doc_id uuid,
  completion_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (restored_qty + rejected_qty <= received_qty)
);

create table if not exists public.cutter_restoration_events (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.cutter_restoration_batches(id) on delete restrict,
  event_type text not null,
  restored_qty numeric not null default 0,
  rejected_qty numeric not null default 0,
  actor_id bigint,
  actor_name text,
  note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_cutter_restoration_batches_status_created
  on public.cutter_restoration_batches(status, created_at);
create index if not exists idx_cutter_restoration_batches_nomenclature
  on public.cutter_restoration_batches(nomenclature_id, created_at desc);
create index if not exists idx_cutter_restoration_events_batch
  on public.cutter_restoration_events(batch_id, created_at);

alter table public.cutter_usage_events enable row level security;
alter table public.cutter_restoration_batches enable row level security;
alter table public.cutter_restoration_events enable row level security;

drop policy if exists "cutter usage readable" on public.cutter_usage_events;
create policy "cutter usage readable" on public.cutter_usage_events for select using (true);
drop policy if exists "cutter restoration batches readable" on public.cutter_restoration_batches;
create policy "cutter restoration batches readable" on public.cutter_restoration_batches for select using (true);
drop policy if exists "cutter restoration events readable" on public.cutter_restoration_events;
create policy "cutter restoration events readable" on public.cutter_restoration_events for select using (true);

create or replace function public.is_faceting_cutter(p_nomenclature_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.nomenclatures n
    left join public.nomenclatures cutter_type
      on n.characteristic = cutter_type.id::text
    where n.id = p_nomenclature_id
      and (
        lower(coalesce(n.name, '')) like '%фасоч%'
        or lower(coalesce(n.characteristic, '')) like '%фасоч%'
        or lower(coalesce(cutter_type.name, '')) like '%фасоч%'
      )
  );
$$;

create or replace function public.register_cutter_usage(
  p_source_card_id uuid,
  p_items jsonb,
  p_actor_id bigint default null,
  p_actor_name text default null,
  p_source_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_card public.work_cards%rowtype;
  v_item jsonb;
  v_nom public.nomenclatures%rowtype;
  v_inventory public.inventory%rowtype;
  v_usage public.cutter_usage_events%rowtype;
  v_nom_id uuid;
  v_qty numeric;
  v_faceting boolean;
  v_owner text;
  v_batch_id uuid;
  v_batches jsonb := '[]'::jsonb;
begin
  select * into v_card
  from public.work_cards
  where id = p_source_card_id
  for update;

  if v_card.id is null then
    raise exception 'Work card not found';
  end if;

  v_owner := nullif(coalesce(p_source_metadata->>'manager_name', v_card.manager_name), 'Не вказано');

  for v_item in
    select value from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    v_nom_id := (v_item->>'nomenclature_id')::uuid;
    v_qty := greatest(coalesce((v_item->>'quantity')::numeric, 0), 0);
    if v_qty = 0 then continue; end if;

    select * into v_nom from public.nomenclatures where id = v_nom_id;
    if v_nom.id is null or v_nom.type <> 'consumable' then
      raise exception 'Invalid cutter nomenclature: %', v_nom_id;
    end if;

    -- Unique usage event is the idempotency barrier: a repeated terminal
    -- request can neither deduct stock nor create the restoration batch twice.
    if exists (
      select 1 from public.cutter_usage_events
      where source_card_id = p_source_card_id and nomenclature_id = v_nom_id
    ) then
      continue;
    end if;

    v_faceting := public.is_faceting_cutter(v_nom_id);

    select * into v_inventory
    from public.inventory
    where nomenclature_id = v_nom_id
      and warehouse = 'pocket'
      and pocket_owner is not distinct from v_owner
    order by created_at, id
    limit 1
    for update;

    if v_inventory.id is null then
      insert into public.inventory (
        nomenclature_id, name, unit, total_qty, reserved_qty,
        warehouse, type, pocket_owner, updated_at
      ) values (
        v_nom.id, v_nom.name, coalesce(v_nom.unit, 'шт'), -v_qty, 0,
        'pocket', 'consumable', v_owner, now()
      );
    else
      update public.inventory
      set total_qty = coalesce(total_qty, 0) - v_qty,
          updated_at = now()
      where id = v_inventory.id;
    end if;

    insert into public.cutter_usage_events (
      source_card_id, task_id, order_id, nomenclature_id, quantity,
      is_faceting, pocket_owner, actor_id, actor_name
    ) values (
      v_card.id, v_card.task_id, v_card.order_id, v_nom_id, v_qty,
      v_faceting, v_owner, p_actor_id, p_actor_name
    )
    returning * into v_usage;

    if v_faceting then
      insert into public.cutter_restoration_batches (
        batch_number, usage_event_id, source_card_id, task_id, order_id,
        nomenclature_id, cutter_name, received_qty,
        source_operator, source_manager, source_machine
      ) values (
        'FR-' || to_char(clock_timestamp(), 'YYYYMMDD') || '-' || upper(substr(replace(v_usage.id::text, '-', ''), 1, 6)),
        v_usage.id, v_card.id, v_card.task_id, v_card.order_id,
        v_nom_id, v_nom.name, v_qty,
        coalesce(p_source_metadata->>'operator_name', v_card.operator_name),
        coalesce(p_source_metadata->>'manager_name', v_card.manager_name),
        coalesce(p_source_metadata->>'machine_name', v_card.machine)
      )
      returning id into v_batch_id;

      insert into public.cutter_restoration_events (
        batch_id, event_type, actor_id, actor_name, metadata
      ) values (
        v_batch_id, 'created', p_actor_id, p_actor_name,
        jsonb_build_object('source_card_id', v_card.id, 'quantity', v_qty)
      );

      v_batches := v_batches || jsonb_build_array(v_batch_id);
    end if;
  end loop;

  return jsonb_build_object('created_batch_ids', v_batches);
end;
$$;

create or replace function public.start_cutter_restoration(
  p_batch_id uuid,
  p_actor_id bigint,
  p_actor_name text
)
returns public.cutter_restoration_batches
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch public.cutter_restoration_batches%rowtype;
begin
  if not exists (
    select 1 from public.system_users u
    where u.id = p_actor_id
      and (
        coalesce((u.access_rights->>'cutter_restoration')::boolean, false)
        or lower(coalesce(u.position, '')) in ('адмін', 'admin')
      )
  ) then
    raise exception 'User has no cutter restoration access';
  end if;

  select * into v_batch
  from public.cutter_restoration_batches
  where id = p_batch_id
  for update;

  if v_batch.id is null then raise exception 'Restoration batch not found'; end if;
  if v_batch.status = 'pending' then
    update public.cutter_restoration_batches
    set status = 'in_progress',
        assigned_user_id = p_actor_id,
        assigned_user_name = p_actor_name,
        started_at = now(),
        updated_at = now()
    where id = p_batch_id
    returning * into v_batch;

    insert into public.cutter_restoration_events(batch_id, event_type, actor_id, actor_name)
    values (p_batch_id, 'started', p_actor_id, p_actor_name);
  elsif v_batch.status = 'in_progress' and v_batch.assigned_user_id is distinct from p_actor_id then
    raise exception 'Batch is already assigned to another user';
  end if;

  return v_batch;
end;
$$;

create or replace function public.finish_cutter_restoration(
  p_batch_id uuid,
  p_restored_qty numeric,
  p_rejected_qty numeric,
  p_actor_id bigint,
  p_actor_name text,
  p_note text default null
)
returns public.cutter_restoration_batches
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch public.cutter_restoration_batches%rowtype;
  v_doc_id uuid;
  v_items jsonb;
begin
  if not exists (
    select 1 from public.system_users u
    where u.id = p_actor_id
      and (
        coalesce((u.access_rights->>'cutter_restoration')::boolean, false)
        or lower(coalesce(u.position, '')) in ('адмін', 'admin')
      )
  ) then
    raise exception 'User has no cutter restoration access';
  end if;

  select * into v_batch
  from public.cutter_restoration_batches
  where id = p_batch_id
  for update;

  if v_batch.id is null then raise exception 'Restoration batch not found'; end if;
  if v_batch.status <> 'in_progress' then raise exception 'Batch is not in progress'; end if;
  if v_batch.assigned_user_id is distinct from p_actor_id then
    raise exception 'Only the assigned user can finish this batch';
  end if;
  if coalesce(p_restored_qty, 0) < 0 or coalesce(p_rejected_qty, 0) < 0 then
    raise exception 'Quantities cannot be negative';
  end if;
  if coalesce(p_restored_qty, 0) + coalesce(p_rejected_qty, 0) <> v_batch.received_qty then
    raise exception 'Every cutter in the batch must be classified as restored or rejected';
  end if;

  if p_restored_qty > 0 then
    v_items := jsonb_build_array(jsonb_build_object(
      'name', v_batch.cutter_name,
      'nomenclature_id', v_batch.nomenclature_id,
      'qty', p_restored_qty,
      'expected_qty', p_restored_qty,
      'unit', 'шт',
      'origin', 'cutter_restoration',
      'restoration_batch_id', v_batch.id
    ));

    insert into public.reception_docs (
      items, status, target_warehouse, source_warehouse, created_at
    ) values (
      v_items, 'ordered', 'operational', null, now()
    )
    returning id into v_doc_id;
  end if;

  update public.cutter_restoration_batches
  set restored_qty = p_restored_qty,
      rejected_qty = p_rejected_qty,
      status = case when p_restored_qty > 0 then 'awaiting_reception' else 'completed' end,
      reception_doc_id = v_doc_id,
      completion_note = p_note,
      finished_at = now(),
      updated_at = now()
  where id = p_batch_id
  returning * into v_batch;

  insert into public.cutter_restoration_events (
    batch_id, event_type, restored_qty, rejected_qty,
    actor_id, actor_name, note, metadata
  ) values (
    p_batch_id, 'finished', p_restored_qty, p_rejected_qty,
    p_actor_id, p_actor_name, p_note,
    jsonb_build_object('reception_doc_id', v_doc_id)
  );

  return v_batch;
end;
$$;

create or replace function public.complete_cutter_restoration_after_reception()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch_id uuid;
begin
  if new.status = 'completed' and old.status is distinct from new.status then
    update public.cutter_restoration_batches
    set status = 'completed', updated_at = now()
    where reception_doc_id = new.id
      and status = 'awaiting_reception'
    returning id into v_batch_id;

    if v_batch_id is not null then
      insert into public.cutter_restoration_events (
        batch_id, event_type, metadata
      ) values (
        v_batch_id, 'warehouse_received',
        jsonb_build_object('reception_doc_id', new.id)
      );
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_complete_cutter_restoration_after_reception on public.reception_docs;
create trigger trg_complete_cutter_restoration_after_reception
after update of status on public.reception_docs
for each row execute function public.complete_cutter_restoration_after_reception();

grant select on public.cutter_usage_events to anon, authenticated;
grant select on public.cutter_restoration_batches to anon, authenticated;
grant select on public.cutter_restoration_events to anon, authenticated;
grant execute on function public.is_faceting_cutter(uuid) to anon, authenticated;
grant execute on function public.register_cutter_usage(uuid, jsonb, bigint, text, jsonb) to anon, authenticated;
grant execute on function public.start_cutter_restoration(uuid, bigint, text) to anon, authenticated;
grant execute on function public.finish_cutter_restoration(uuid, numeric, numeric, bigint, text, text) to anon, authenticated;
