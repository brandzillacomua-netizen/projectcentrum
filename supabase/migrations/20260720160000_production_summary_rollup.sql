-- Constant-time all-time production summary rollup.
--
-- IMPORTANT: this migration performs one exact full-history backfill while
-- holding SHARE ROW EXCLUSIVE on public.work_card_history. Reads continue, but
-- INSERT/UPDATE/DELETE wait until the migration commits. Apply through the
-- Supabase migration runner during an off-shift maintenance window.
--
-- Ranged mes_production_summary(p_from, p_to) calls intentionally retain the
-- previous exact work_card_history query. Only the all-time (null, null) call
-- is served from the private singleton projection.

do $production_summary_rollup_guard$
declare
  v_missing_columns text;
begin
  if to_regclass('public.work_card_history') is null then
    raise exception 'production summary rollup requires public.work_card_history'
      using errcode = '42P01';
  end if;

  select string_agg(required_column.name, ', ' order by required_column.name)
    into v_missing_columns
    from (
      values
        ('stage_name'),
        ('qty_completed'),
        ('scrap_qty'),
        ('created_at'),
        ('completed_at')
    ) as required_column(name)
   where not exists (
     select 1
       from information_schema.columns c
      where c.table_schema = 'public'
        and c.table_name = 'work_card_history'
        and c.column_name = required_column.name
   );

  if v_missing_columns is not null then
    raise exception 'production summary rollup cannot be installed; missing work_card_history columns: %', v_missing_columns
      using errcode = '42703';
  end if;
end;
$production_summary_rollup_guard$;

create schema if not exists mes_private;
revoke all on schema mes_private from public;
revoke all on schema mes_private from anon, authenticated;

create table if not exists mes_private.production_summary_rollup (
  singleton_id smallint primary key,
  total_produced numeric not null default 0,
  total_scrap numeric not null default 0,
  history_count bigint not null default 0,
  rebuilt_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint production_summary_rollup_singleton check (singleton_id = 1),
  constraint production_summary_rollup_nonnegative_count check (history_count >= 0)
);

alter table mes_private.production_summary_rollup enable row level security;
revoke all on table mes_private.production_summary_rollup from public;
revoke all on table mes_private.production_summary_rollup from anon, authenticated;

comment on table mes_private.production_summary_rollup is
  'Private singleton projection for constant-time all-time MES production totals. public.work_card_history remains the source of truth.';

create or replace function mes_private.sync_production_summary_rollup()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, mes_private
as $production_summary_rollup_trigger$
declare
  v_delta_produced numeric := 0;
  v_delta_scrap numeric := 0;
  v_delta_count bigint := 0;
  v_old_produced numeric := 0;
  v_old_scrap numeric := 0;
  v_old_count bigint := 0;
begin
  if tg_op = 'TRUNCATE' then
    update mes_private.production_summary_rollup
       set total_produced = 0,
           total_scrap = 0,
           history_count = 0,
           rebuilt_at = clock_timestamp(),
           updated_at = clock_timestamp()
     where singleton_id = 1;

    if not found then
      raise exception 'production summary rollup is not initialized'
        using errcode = 'P0002';
    end if;
    return null;
  elsif tg_op = 'INSERT' then
    select
      coalesce(sum(
        case
          when lower(btrim(coalesce(h.stage_name, ''))) in (
            'пакування/сгп', 'прийомка', 'склад бз', 'сгп', 'пакування', 'completed'
          ) then coalesce(h.qty_completed, 0)
          else 0
        end
      ), 0)::numeric,
      coalesce(sum(coalesce(h.scrap_qty, 0)), 0)::numeric,
      count(*)::bigint
      into v_delta_produced, v_delta_scrap, v_delta_count
      from new_rows h;
  elsif tg_op = 'DELETE' then
    select
      -coalesce(sum(
        case
          when lower(btrim(coalesce(h.stage_name, ''))) in (
            'пакування/сгп', 'прийомка', 'склад бз', 'сгп', 'пакування', 'completed'
          ) then coalesce(h.qty_completed, 0)
          else 0
        end
      ), 0)::numeric,
      -coalesce(sum(coalesce(h.scrap_qty, 0)), 0)::numeric,
      -(count(*)::bigint)
      into v_delta_produced, v_delta_scrap, v_delta_count
      from old_rows h;
  elsif tg_op = 'UPDATE' then
    select
      coalesce(sum(
        case
          when lower(btrim(coalesce(h.stage_name, ''))) in (
            'пакування/сгп', 'прийомка', 'склад бз', 'сгп', 'пакування', 'completed'
          ) then coalesce(h.qty_completed, 0)
          else 0
        end
      ), 0)::numeric,
      coalesce(sum(coalesce(h.scrap_qty, 0)), 0)::numeric,
      count(*)::bigint
      into v_delta_produced, v_delta_scrap, v_delta_count
      from new_rows h;

    select
      coalesce(sum(
        case
          when lower(btrim(coalesce(h.stage_name, ''))) in (
            'пакування/сгп', 'прийомка', 'склад бз', 'сгп', 'пакування', 'completed'
          ) then coalesce(h.qty_completed, 0)
          else 0
        end
      ), 0)::numeric,
      coalesce(sum(coalesce(h.scrap_qty, 0)), 0)::numeric,
      count(*)::bigint
      into v_old_produced, v_old_scrap, v_old_count
      from old_rows h;

    v_delta_produced := v_delta_produced - v_old_produced;
    v_delta_scrap := v_delta_scrap - v_old_scrap;
    v_delta_count := v_delta_count - v_old_count;
  else
    raise exception 'unsupported production summary trigger operation: %', tg_op
      using errcode = '0A000';
  end if;

  -- Metadata-only history updates do not need to contend on the singleton row.
  if v_delta_produced = 0 and v_delta_scrap = 0 and v_delta_count = 0 then
    return null;
  end if;

  update mes_private.production_summary_rollup
     set total_produced = total_produced + v_delta_produced,
         total_scrap = total_scrap + v_delta_scrap,
         history_count = history_count + v_delta_count,
         updated_at = clock_timestamp()
   where singleton_id = 1;

  if not found then
    -- Never create a partial rollup from a delta. Failing the source write is
    -- safer than silently publishing incorrect all-time production totals.
    raise exception 'production summary rollup is not initialized'
      using errcode = 'P0002';
  end if;

  return null;
end;
$production_summary_rollup_trigger$;

revoke all on function mes_private.sync_production_summary_rollup() from public;
revoke all on function mes_private.sync_production_summary_rollup() from anon, authenticated;

-- Supabase migration batches are transactional. A short lock timeout makes a
-- busy production database fail and roll back cleanly instead of queueing an
-- unexpected write outage. Retry the migration during the off-shift window.
set local lock_timeout = '5s';
lock table public.work_card_history in share row exclusive mode;

-- Exact idempotent backfill. The write lock prevents source changes between
-- this snapshot and trigger installation.
insert into mes_private.production_summary_rollup (
  singleton_id,
  total_produced,
  total_scrap,
  history_count,
  rebuilt_at,
  updated_at
)
select
  1,
  coalesce(sum(coalesce(h.qty_completed, 0)) filter (
    where lower(btrim(coalesce(h.stage_name, ''))) in (
      'пакування/сгп', 'прийомка', 'склад бз', 'сгп', 'пакування', 'completed'
    )
  ), 0)::numeric,
  coalesce(sum(coalesce(h.scrap_qty, 0)), 0)::numeric,
  count(*)::bigint,
  clock_timestamp(),
  clock_timestamp()
from public.work_card_history h
on conflict (singleton_id) do update set
  total_produced = excluded.total_produced,
  total_scrap = excluded.total_scrap,
  history_count = excluded.history_count,
  rebuilt_at = excluded.rebuilt_at,
  updated_at = excluded.updated_at;

drop trigger if exists trg_mes_production_summary_rollup_insert on public.work_card_history;
create trigger trg_mes_production_summary_rollup_insert
after insert on public.work_card_history
referencing new table as new_rows
for each statement execute function mes_private.sync_production_summary_rollup();

drop trigger if exists trg_mes_production_summary_rollup_update on public.work_card_history;
create trigger trg_mes_production_summary_rollup_update
after update on public.work_card_history
referencing old table as old_rows new table as new_rows
for each statement execute function mes_private.sync_production_summary_rollup();

drop trigger if exists trg_mes_production_summary_rollup_delete on public.work_card_history;
create trigger trg_mes_production_summary_rollup_delete
after delete on public.work_card_history
referencing old table as old_rows
for each statement execute function mes_private.sync_production_summary_rollup();

drop trigger if exists trg_mes_production_summary_rollup_truncate on public.work_card_history;
create trigger trg_mes_production_summary_rollup_truncate
after truncate on public.work_card_history
for each statement execute function mes_private.sync_production_summary_rollup();

-- This helper exposes only the same aggregate already returned by
-- mes_production_summary. Keeping it separate lets ranged calls retain the
-- previous SECURITY INVOKER behavior against work_card_history.
create or replace function public.mes_production_summary_rollup_all_time()
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, mes_private
as $production_summary_rollup_reader$
declare
  v_result jsonb;
begin
  select jsonb_build_object(
    'totalProduced', r.total_produced,
    'totalScrap', r.total_scrap,
    'historyCount', r.history_count
  )
    into v_result
    from mes_private.production_summary_rollup r
   where r.singleton_id = 1;

  if not found then
    raise exception 'production summary rollup is not initialized'
      using errcode = 'P0002';
  end if;

  return v_result;
end;
$production_summary_rollup_reader$;

revoke all on function public.mes_production_summary_rollup_all_time() from public;
grant execute on function public.mes_production_summary_rollup_all_time() to anon, authenticated, service_role;

comment on function public.mes_production_summary_rollup_all_time() is
  'Returns the private constant-time all-history MES production rollup. No source rows are exposed.';

create or replace function public.mes_production_summary(
  p_from timestamptz default null,
  p_to timestamptz default null
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = pg_catalog, public
as $mes_production_summary$
begin
  if p_from is null and p_to is null then
    return public.mes_production_summary_rollup_all_time();
  end if;

  -- Preserve the exact legacy semantics for open, closed and one-sided ranges.
  return (
    select jsonb_build_object(
      'totalProduced', coalesce(sum(coalesce(h.qty_completed, 0)) filter (
        where lower(btrim(coalesce(h.stage_name, ''))) in (
          'пакування/сгп', 'прийомка', 'склад бз', 'сгп', 'пакування', 'completed'
        )
      ), 0),
      'totalScrap', coalesce(sum(coalesce(h.scrap_qty, 0)), 0),
      'historyCount', count(*)
    )
    from public.work_card_history h
    where (p_from is null or coalesce(h.completed_at, h.created_at) >= p_from)
      and (p_to is null or coalesce(h.completed_at, h.created_at) <= p_to)
  );
end;
$mes_production_summary$;

revoke all on function public.mes_production_summary(timestamptz, timestamptz) from public;
grant execute on function public.mes_production_summary(timestamptz, timestamptz) to anon, authenticated, service_role;

comment on function public.mes_production_summary(timestamptz, timestamptz) is
  'Uses a private incremental rollup for all-time totals and the exact source history for ranged totals.';

-- Rollback guidance (run only after reverting the frontend expectation):
--   drop trigger if exists trg_mes_production_summary_rollup_insert on public.work_card_history;
--   drop trigger if exists trg_mes_production_summary_rollup_update on public.work_card_history;
--   drop trigger if exists trg_mes_production_summary_rollup_delete on public.work_card_history;
--   drop trigger if exists trg_mes_production_summary_rollup_truncate on public.work_card_history;
--   drop function if exists mes_private.sync_production_summary_rollup();
--   drop function if exists public.mes_production_summary_rollup_all_time();
--   drop table if exists mes_private.production_summary_rollup;
-- Restore public.mes_production_summary from 20260706_production_statistics.sql
-- in the same rollback migration; do not leave the public RPC missing.
