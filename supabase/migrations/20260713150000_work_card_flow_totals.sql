-- Fast work-card flow totals for dashboards and foreman archives.
-- work_card_history remains the audit source of truth; this table is only a
-- small indexed projection for screens that need instant per-stage totals.

create extension if not exists pgcrypto;

create table if not exists public.work_card_flow_totals (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.work_cards(id) on delete cascade,
  task_id uuid not null,
  order_id uuid,
  nomenclature_id uuid not null,
  stage_name text not null,
  total_good integer not null default 0 check (total_good >= 0),
  total_bz integer not null default 0 check (total_bz >= 0),
  total_scrap integer not null default 0 check (total_scrap >= 0),
  first_event_at timestamptz,
  last_event_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (card_id, nomenclature_id, stage_name)
);

create table if not exists public.work_card_flow_total_backfill_progress (
  history_id uuid primary key references public.work_card_history(id) on delete cascade,
  processed_at timestamptz not null default now()
);

create index if not exists idx_work_card_flow_totals_task_nom
  on public.work_card_flow_totals (task_id, nomenclature_id);
create index if not exists idx_work_card_flow_totals_order_nom
  on public.work_card_flow_totals (order_id, nomenclature_id);
create index if not exists idx_work_card_flow_totals_task_stage
  on public.work_card_flow_totals (task_id, stage_name);
create index if not exists idx_work_card_flow_totals_card
  on public.work_card_flow_totals (card_id);

alter table public.work_card_flow_totals enable row level security;
alter table public.work_card_flow_total_backfill_progress enable row level security;

grant select on public.work_card_flow_totals to anon, authenticated;

drop policy if exists "work_card_flow_totals_read" on public.work_card_flow_totals;
create policy "work_card_flow_totals_read" on public.work_card_flow_totals
  for select to anon, authenticated using (true);

drop policy if exists "work_card_flow_total_backfill_progress_no_read" on public.work_card_flow_total_backfill_progress;
create policy "work_card_flow_total_backfill_progress_no_read" on public.work_card_flow_total_backfill_progress
  for select to authenticated using (false);

create or replace function public.is_work_card_bz_stage(p_stage_name text)
returns boolean
language sql
immutable
as $$
  select lower(trim(coalesce(p_stage_name, ''))) in ('склад бз', 'склад bz')
$$;

create or replace function public.apply_work_card_flow_delta(
  p_card_id uuid,
  p_nomenclature_id uuid,
  p_stage_name text,
  p_good_delta integer default 0,
  p_bz_delta integer default 0,
  p_scrap_delta integer default 0,
  p_event_at timestamptz default now()
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_card record;
  v_stage_name text := coalesce(nullif(trim(p_stage_name), ''), 'unknown');
  v_event_at timestamptz := coalesce(p_event_at, now());
  v_has_positive boolean := greatest(
    coalesce(p_good_delta, 0),
    coalesce(p_bz_delta, 0),
    coalesce(p_scrap_delta, 0)
  ) > 0;
begin
  if p_card_id is null or p_nomenclature_id is null then
    return;
  end if;

  if coalesce(p_good_delta, 0) = 0
     and coalesce(p_bz_delta, 0) = 0
     and coalesce(p_scrap_delta, 0) = 0 then
    return;
  end if;

  select id, task_id, order_id, nomenclature_id
    into v_card
    from public.work_cards
   where id = p_card_id;

  if not found then
    return;
  end if;

  insert into public.work_card_flow_totals (
    card_id, task_id, order_id, nomenclature_id, stage_name,
    total_good, total_bz, total_scrap,
    first_event_at, last_event_at, updated_at
  ) values (
    p_card_id, v_card.task_id, v_card.order_id, p_nomenclature_id, v_stage_name,
    greatest(coalesce(p_good_delta, 0), 0),
    greatest(coalesce(p_bz_delta, 0), 0),
    greatest(coalesce(p_scrap_delta, 0), 0),
    case when v_has_positive then v_event_at else null end,
    case when v_has_positive then v_event_at else null end,
    now()
  )
  on conflict (card_id, nomenclature_id, stage_name) do update set
    task_id = excluded.task_id,
    order_id = excluded.order_id,
    total_good = greatest(0, public.work_card_flow_totals.total_good + coalesce(p_good_delta, 0)),
    total_bz = greatest(0, public.work_card_flow_totals.total_bz + coalesce(p_bz_delta, 0)),
    total_scrap = greatest(0, public.work_card_flow_totals.total_scrap + coalesce(p_scrap_delta, 0)),
    first_event_at = case
      when v_has_positive then least(coalesce(public.work_card_flow_totals.first_event_at, v_event_at), v_event_at)
      else public.work_card_flow_totals.first_event_at
    end,
    last_event_at = case
      when v_has_positive then greatest(coalesce(public.work_card_flow_totals.last_event_at, v_event_at), v_event_at)
      else public.work_card_flow_totals.last_event_at
    end,
    updated_at = now();

  delete from public.work_card_flow_totals
   where card_id = p_card_id
     and nomenclature_id = p_nomenclature_id
     and stage_name = v_stage_name
     and total_good <= 0
     and total_bz <= 0
     and total_scrap <= 0;
end;
$$;

create or replace function public.sync_work_card_flow_totals_from_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_good integer;
  v_bz integer;
begin
  if tg_op = 'INSERT' then
    v_bz := case when public.is_work_card_bz_stage(new.stage_name) then coalesce(new.qty_completed, 0)::integer else 0 end;
    v_good := case when public.is_work_card_bz_stage(new.stage_name) then 0 else coalesce(new.qty_completed, 0)::integer end;
    perform public.apply_work_card_flow_delta(
      new.card_id, new.nomenclature_id, new.stage_name,
      v_good, v_bz, coalesce(new.scrap_qty, 0)::integer,
      coalesce(new.completed_at, new.created_at, now())
    );
    return new;
  elsif tg_op = 'UPDATE' then
    v_bz := case when public.is_work_card_bz_stage(old.stage_name) then coalesce(old.qty_completed, 0)::integer else 0 end;
    v_good := case when public.is_work_card_bz_stage(old.stage_name) then 0 else coalesce(old.qty_completed, 0)::integer end;
    perform public.apply_work_card_flow_delta(
      old.card_id, old.nomenclature_id, old.stage_name,
      -v_good, -v_bz, -coalesce(old.scrap_qty, 0)::integer,
      coalesce(old.completed_at, old.created_at, now())
    );

    v_bz := case when public.is_work_card_bz_stage(new.stage_name) then coalesce(new.qty_completed, 0)::integer else 0 end;
    v_good := case when public.is_work_card_bz_stage(new.stage_name) then 0 else coalesce(new.qty_completed, 0)::integer end;
    perform public.apply_work_card_flow_delta(
      new.card_id, new.nomenclature_id, new.stage_name,
      v_good, v_bz, coalesce(new.scrap_qty, 0)::integer,
      coalesce(new.completed_at, new.created_at, now())
    );
    return new;
  elsif tg_op = 'DELETE' then
    v_bz := case when public.is_work_card_bz_stage(old.stage_name) then coalesce(old.qty_completed, 0)::integer else 0 end;
    v_good := case when public.is_work_card_bz_stage(old.stage_name) then 0 else coalesce(old.qty_completed, 0)::integer end;
    perform public.apply_work_card_flow_delta(
      old.card_id, old.nomenclature_id, old.stage_name,
      -v_good, -v_bz, -coalesce(old.scrap_qty, 0)::integer,
      coalesce(old.completed_at, old.created_at, now())
    );
    return old;
  end if;

  return null;
end;
$$;

drop trigger if exists trg_sync_work_card_flow_totals on public.work_card_history;
create trigger trg_sync_work_card_flow_totals
after insert or update or delete on public.work_card_history
for each row execute function public.sync_work_card_flow_totals_from_history();

create or replace function public.rebuild_work_card_flow_totals()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  truncate table public.work_card_flow_totals;

  insert into public.work_card_flow_totals (
    card_id, task_id, order_id, nomenclature_id, stage_name,
    total_good, total_bz, total_scrap,
    first_event_at, last_event_at, updated_at
  )
  select
    h.card_id,
    wc.task_id,
    wc.order_id,
    h.nomenclature_id,
    coalesce(nullif(trim(h.stage_name), ''), 'unknown') as stage_name,
    sum(case when public.is_work_card_bz_stage(h.stage_name) then 0 else coalesce(h.qty_completed, 0) end)::integer as total_good,
    sum(case when public.is_work_card_bz_stage(h.stage_name) then coalesce(h.qty_completed, 0) else 0 end)::integer as total_bz,
    sum(coalesce(h.scrap_qty, 0))::integer as total_scrap,
    min(coalesce(h.completed_at, h.created_at)) as first_event_at,
    max(coalesce(h.completed_at, h.created_at)) as last_event_at,
    now() as updated_at
  from public.work_card_history h
  join public.work_cards wc on wc.id = h.card_id
  where h.card_id is not null
    and h.nomenclature_id is not null
    and (
      coalesce(h.qty_completed, 0) > 0
      or coalesce(h.scrap_qty, 0) > 0
    )
  group by h.card_id, wc.task_id, wc.order_id, h.nomenclature_id, coalesce(nullif(trim(h.stage_name), ''), 'unknown')
  having
    sum(case when public.is_work_card_bz_stage(h.stage_name) then 0 else coalesce(h.qty_completed, 0) end) > 0
    or sum(case when public.is_work_card_bz_stage(h.stage_name) then coalesce(h.qty_completed, 0) else 0 end) > 0
    or sum(coalesce(h.scrap_qty, 0)) > 0;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.backfill_work_card_flow_totals_batch(
  p_limit integer default 100
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 100), 1), 500);
  v_processed integer := 0;
  v_groups integer := 0;
  v_good integer := 0;
  v_bz integer := 0;
  v_scrap integer := 0;
begin
  create temporary table if not exists pg_temp.flow_backfill_batch (
    id uuid primary key,
    card_id uuid not null,
    nomenclature_id uuid not null,
    stage_name text not null,
    good_qty integer not null,
    bz_qty integer not null,
    scrap_qty integer not null,
    event_at timestamptz not null
  ) on commit drop;

  truncate table pg_temp.flow_backfill_batch;

  insert into pg_temp.flow_backfill_batch (
    id, card_id, nomenclature_id, stage_name, good_qty, bz_qty, scrap_qty, event_at
  )
  select
    h.id,
    h.card_id,
    h.nomenclature_id,
    coalesce(nullif(trim(h.stage_name), ''), 'unknown') as stage_name,
    case when public.is_work_card_bz_stage(h.stage_name) then 0 else coalesce(h.qty_completed, 0)::integer end as good_qty,
    case when public.is_work_card_bz_stage(h.stage_name) then coalesce(h.qty_completed, 0)::integer else 0 end as bz_qty,
    coalesce(h.scrap_qty, 0)::integer as scrap_qty,
    coalesce(h.completed_at, h.created_at, now()) as event_at
  from public.work_card_history h
  left join public.work_card_flow_total_backfill_progress p on p.history_id = h.id
  where p.history_id is null
    and h.card_id is not null
    and h.nomenclature_id is not null
    and (
      coalesce(h.qty_completed, 0) > 0
      or coalesce(h.scrap_qty, 0) > 0
    )
  order by coalesce(h.created_at, h.completed_at), h.id
  limit v_limit;

  get diagnostics v_processed = row_count;

  if v_processed = 0 then
    return jsonb_build_object('processed', 0, 'groups', 0, 'good', 0, 'bz', 0, 'scrap', 0);
  end if;

  with grouped as (
    select
      b.card_id,
      wc.task_id,
      wc.order_id,
      b.nomenclature_id,
      b.stage_name,
      sum(b.good_qty)::integer as total_good,
      sum(b.bz_qty)::integer as total_bz,
      sum(b.scrap_qty)::integer as total_scrap,
      min(b.event_at) as first_event_at,
      max(b.event_at) as last_event_at
    from pg_temp.flow_backfill_batch b
    join public.work_cards wc on wc.id = b.card_id
    group by b.card_id, wc.task_id, wc.order_id, b.nomenclature_id, b.stage_name
  ), upserted as (
    insert into public.work_card_flow_totals (
      card_id, task_id, order_id, nomenclature_id, stage_name,
      total_good, total_bz, total_scrap,
      first_event_at, last_event_at, updated_at
    )
    select
      card_id, task_id, order_id, nomenclature_id, stage_name,
      total_good, total_bz, total_scrap,
      first_event_at, last_event_at, now()
    from grouped
    on conflict (card_id, nomenclature_id, stage_name) do update set
      task_id = excluded.task_id,
      order_id = excluded.order_id,
      total_good = public.work_card_flow_totals.total_good + excluded.total_good,
      total_bz = public.work_card_flow_totals.total_bz + excluded.total_bz,
      total_scrap = public.work_card_flow_totals.total_scrap + excluded.total_scrap,
      first_event_at = least(
        coalesce(public.work_card_flow_totals.first_event_at, excluded.first_event_at),
        excluded.first_event_at
      ),
      last_event_at = greatest(
        coalesce(public.work_card_flow_totals.last_event_at, excluded.last_event_at),
        excluded.last_event_at
      ),
      updated_at = now()
    returning total_good, total_bz, total_scrap
  )
  select
    count(*),
    coalesce(sum(total_good), 0)::integer,
    coalesce(sum(total_bz), 0)::integer,
    coalesce(sum(total_scrap), 0)::integer
    into v_groups, v_good, v_bz, v_scrap
    from upserted;

  insert into public.work_card_flow_total_backfill_progress (history_id)
  select id from pg_temp.flow_backfill_batch
  on conflict (history_id) do nothing;

  return jsonb_build_object(
    'processed', v_processed,
    'groups', coalesce(v_groups, 0),
    'good', coalesce(v_good, 0),
    'bz', coalesce(v_bz, 0),
    'scrap', coalesce(v_scrap, 0)
  );
end;
$$;

revoke all on function public.is_work_card_bz_stage(text) from public;
revoke all on function public.apply_work_card_flow_delta(uuid, uuid, text, integer, integer, integer, timestamptz) from public;
revoke all on function public.sync_work_card_flow_totals_from_history() from public;
revoke all on function public.rebuild_work_card_flow_totals() from public;
revoke all on function public.backfill_work_card_flow_totals_batch(integer) from public;
grant execute on function public.rebuild_work_card_flow_totals() to authenticated;
grant execute on function public.backfill_work_card_flow_totals_batch(integer) to anon, authenticated;

-- Do not run the rebuild automatically inside the migration.
-- On a loaded Supabase project, rebuilding from the full history in one query
-- can block PostgREST. Run public.rebuild_work_card_flow_totals() manually
-- during a quiet maintenance window, or backfill in smaller batches.
