-- Fast scrap totals for dashboards and foreman archives.
-- work_card_history remains the audit source of truth; this table is only a
-- small indexed projection for screens that need instant totals.

create extension if not exists pgcrypto;

create table if not exists public.work_card_scrap_totals (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.work_cards(id) on delete cascade,
  task_id uuid not null,
  order_id uuid,
  nomenclature_id uuid not null,
  total_scrap integer not null default 0 check (total_scrap >= 0),
  first_scrap_at timestamptz,
  last_scrap_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (card_id, nomenclature_id)
);

create table if not exists public.work_card_scrap_total_backfill_progress (
  history_id uuid primary key references public.work_card_history(id) on delete cascade,
  processed_at timestamptz not null default now()
);

create index if not exists idx_work_card_scrap_totals_task_nom
  on public.work_card_scrap_totals (task_id, nomenclature_id);
create index if not exists idx_work_card_scrap_totals_order_nom
  on public.work_card_scrap_totals (order_id, nomenclature_id);
create index if not exists idx_work_card_scrap_totals_card
  on public.work_card_scrap_totals (card_id);

alter table public.work_card_scrap_totals enable row level security;
alter table public.work_card_scrap_total_backfill_progress enable row level security;

grant select on public.work_card_scrap_totals to anon, authenticated;

drop policy if exists "work_card_scrap_totals_read" on public.work_card_scrap_totals;
create policy "work_card_scrap_totals_read" on public.work_card_scrap_totals
  for select to anon, authenticated using (true);

drop policy if exists "work_card_scrap_total_backfill_progress_no_read" on public.work_card_scrap_total_backfill_progress;
create policy "work_card_scrap_total_backfill_progress_no_read" on public.work_card_scrap_total_backfill_progress
  for select to authenticated using (false);

create or replace function public.apply_work_card_scrap_delta(
  p_card_id uuid,
  p_nomenclature_id uuid,
  p_delta integer,
  p_event_at timestamptz default now()
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_card record;
  v_event_at timestamptz := coalesce(p_event_at, now());
begin
  if p_card_id is null or p_nomenclature_id is null or coalesce(p_delta, 0) = 0 then
    return;
  end if;

  select id, task_id, order_id, nomenclature_id
    into v_card
    from public.work_cards
   where id = p_card_id;

  if not found then
    return;
  end if;

  insert into public.work_card_scrap_totals (
    card_id, task_id, order_id, nomenclature_id,
    total_scrap, first_scrap_at, last_scrap_at, updated_at
  ) values (
    p_card_id, v_card.task_id, v_card.order_id, p_nomenclature_id,
    greatest(p_delta, 0),
    case when p_delta > 0 then v_event_at else null end,
    case when p_delta > 0 then v_event_at else null end,
    now()
  )
  on conflict (card_id, nomenclature_id) do update set
    task_id = excluded.task_id,
    order_id = excluded.order_id,
    total_scrap = greatest(0, public.work_card_scrap_totals.total_scrap + p_delta),
    first_scrap_at = case
      when p_delta > 0 then least(coalesce(public.work_card_scrap_totals.first_scrap_at, v_event_at), v_event_at)
      else public.work_card_scrap_totals.first_scrap_at
    end,
    last_scrap_at = case
      when p_delta > 0 then greatest(coalesce(public.work_card_scrap_totals.last_scrap_at, v_event_at), v_event_at)
      else public.work_card_scrap_totals.last_scrap_at
    end,
    updated_at = now();

  delete from public.work_card_scrap_totals
   where card_id = p_card_id
     and nomenclature_id = p_nomenclature_id
     and total_scrap <= 0;
end;
$$;

create or replace function public.sync_work_card_scrap_totals_from_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.apply_work_card_scrap_delta(
      new.card_id,
      new.nomenclature_id,
      coalesce(new.scrap_qty, 0)::integer,
      coalesce(new.completed_at, new.created_at, now())
    );
    return new;
  elsif tg_op = 'UPDATE' then
    perform public.apply_work_card_scrap_delta(
      old.card_id,
      old.nomenclature_id,
      -coalesce(old.scrap_qty, 0)::integer,
      coalesce(old.completed_at, old.created_at, now())
    );
    perform public.apply_work_card_scrap_delta(
      new.card_id,
      new.nomenclature_id,
      coalesce(new.scrap_qty, 0)::integer,
      coalesce(new.completed_at, new.created_at, now())
    );
    return new;
  elsif tg_op = 'DELETE' then
    perform public.apply_work_card_scrap_delta(
      old.card_id,
      old.nomenclature_id,
      -coalesce(old.scrap_qty, 0)::integer,
      coalesce(old.completed_at, old.created_at, now())
    );
    return old;
  end if;

  return null;
end;
$$;

drop trigger if exists trg_sync_work_card_scrap_totals on public.work_card_history;
create trigger trg_sync_work_card_scrap_totals
after insert or update or delete on public.work_card_history
for each row execute function public.sync_work_card_scrap_totals_from_history();

create or replace function public.rebuild_work_card_scrap_totals()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  truncate table public.work_card_scrap_totals;

  insert into public.work_card_scrap_totals (
    card_id, task_id, order_id, nomenclature_id,
    total_scrap, first_scrap_at, last_scrap_at, updated_at
  )
  select
    h.card_id,
    wc.task_id,
    wc.order_id,
    h.nomenclature_id,
    sum(coalesce(h.scrap_qty, 0))::integer as total_scrap,
    min(coalesce(h.completed_at, h.created_at)) as first_scrap_at,
    max(coalesce(h.completed_at, h.created_at)) as last_scrap_at,
    now() as updated_at
  from public.work_card_history h
  join public.work_cards wc on wc.id = h.card_id
  where coalesce(h.scrap_qty, 0) > 0
    and h.card_id is not null
    and h.nomenclature_id is not null
  group by h.card_id, wc.task_id, wc.order_id, h.nomenclature_id
  having sum(coalesce(h.scrap_qty, 0)) > 0;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.backfill_work_card_scrap_totals_batch(
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
  v_scrap integer := 0;
begin
  create temporary table if not exists pg_temp.scrap_backfill_batch (
    id uuid primary key,
    card_id uuid not null,
    nomenclature_id uuid not null,
    scrap_qty integer not null,
    event_at timestamptz not null
  ) on commit drop;

  truncate table pg_temp.scrap_backfill_batch;

  insert into pg_temp.scrap_backfill_batch (id, card_id, nomenclature_id, scrap_qty, event_at)
  select
    h.id,
    h.card_id,
    h.nomenclature_id,
    coalesce(h.scrap_qty, 0)::integer,
    coalesce(h.completed_at, h.created_at, now())
  from public.work_card_history h
  left join public.work_card_scrap_total_backfill_progress p on p.history_id = h.id
  where p.history_id is null
    and coalesce(h.scrap_qty, 0) > 0
    and h.card_id is not null
    and h.nomenclature_id is not null
  order by coalesce(h.created_at, h.completed_at), h.id
  limit v_limit;

  get diagnostics v_processed = row_count;

  if v_processed = 0 then
    return jsonb_build_object('processed', 0, 'groups', 0, 'scrap', 0);
  end if;

  with grouped as (
    select
      b.card_id,
      wc.task_id,
      wc.order_id,
      b.nomenclature_id,
      sum(b.scrap_qty)::integer as total_scrap,
      min(b.event_at) as first_scrap_at,
      max(b.event_at) as last_scrap_at
    from pg_temp.scrap_backfill_batch b
    join public.work_cards wc on wc.id = b.card_id
    group by b.card_id, wc.task_id, wc.order_id, b.nomenclature_id
  ), upserted as (
    insert into public.work_card_scrap_totals (
      card_id, task_id, order_id, nomenclature_id,
      total_scrap, first_scrap_at, last_scrap_at, updated_at
    )
    select
      card_id, task_id, order_id, nomenclature_id,
      total_scrap, first_scrap_at, last_scrap_at, now()
    from grouped
    on conflict (card_id, nomenclature_id) do update set
      task_id = excluded.task_id,
      order_id = excluded.order_id,
      total_scrap = public.work_card_scrap_totals.total_scrap + excluded.total_scrap,
      first_scrap_at = least(
        coalesce(public.work_card_scrap_totals.first_scrap_at, excluded.first_scrap_at),
        excluded.first_scrap_at
      ),
      last_scrap_at = greatest(
        coalesce(public.work_card_scrap_totals.last_scrap_at, excluded.last_scrap_at),
        excluded.last_scrap_at
      ),
      updated_at = now()
    returning total_scrap
  )
  select count(*), coalesce(sum(total_scrap), 0)::integer
    into v_groups, v_scrap
    from upserted;

  insert into public.work_card_scrap_total_backfill_progress (history_id)
  select id from pg_temp.scrap_backfill_batch
  on conflict (history_id) do nothing;

  return jsonb_build_object(
    'processed', v_processed,
    'groups', coalesce(v_groups, 0),
    'scrap', coalesce(v_scrap, 0)
  );
end;
$$;

revoke all on function public.apply_work_card_scrap_delta(uuid, uuid, integer, timestamptz) from public;
revoke all on function public.sync_work_card_scrap_totals_from_history() from public;
revoke all on function public.rebuild_work_card_scrap_totals() from public;
revoke all on function public.backfill_work_card_scrap_totals_batch(integer) from public;
grant execute on function public.rebuild_work_card_scrap_totals() to authenticated;
grant execute on function public.backfill_work_card_scrap_totals_batch(integer) to anon, authenticated;

-- Do not run the rebuild automatically inside the migration.
-- On a loaded Supabase project, rebuilding from the full history in one query
-- can block PostgREST. Run public.rebuild_work_card_scrap_totals() manually
-- during a quiet maintenance window, or backfill in smaller batches.
