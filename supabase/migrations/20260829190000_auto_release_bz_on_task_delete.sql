-- ============================================================
-- P1-2: Auto-release BZ reservations when a task is deleted or
-- its status changes to cancelled/deleted.
--
-- Problem: superDeleteOrder / deleteOrder remove tasks rows
-- directly without calling release_bz_reservation(), leaving
-- quantities frozen in inventory(type='wip_bz') permanently.
--
-- Solution:
--   1. BEFORE DELETE trigger on tasks → release BZ for each
--      affected task automatically (DB-level, cannot be skipped).
--   2. reconcile_orphan_bz_reservations() RPC → finds allocated
--      reservations whose task_id no longer exists and releases
--      them (one-time cleanup + cron-safe).
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- Helper: release all 'allocated' BZ reservations for a given
-- task_id. Reuses the existing release_bz_reservation() RPC
-- per operation_id so all ledger entries are written correctly.
-- ────────────────────────────────────────────────────────────
create or replace function public.release_bz_reservations_for_task(
  p_task_id uuid,
  p_reason  text default 'task_deleted'
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_op_id   uuid;
  v_count   integer := 0;
begin
  -- Each task may have had several BZ reserve calls (one per
  -- createNaryad call that was rolled back and retried).
  -- Iterate over every distinct operation_id that is still
  -- 'allocated' for this task.
  for v_op_id in
    select distinct operation_id
    from   public.bz_inventory_reservations
    where  task_id  = p_task_id
      and  status   = 'allocated'
    order  by operation_id
  loop
    begin
      perform public.release_bz_reservation(v_op_id, p_reason);
      v_count := v_count + 1;
    exception when others then
      -- Log and continue: one bad reservation must not block
      -- the rest. The reconciliation RPC can retry later.
      raise warning 'release_bz_reservations_for_task: could not release op % for task %: %',
        v_op_id, p_task_id, sqlerrm;
    end;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.release_bz_reservations_for_task(uuid, text) from public;
grant execute on function public.release_bz_reservations_for_task(uuid, text)
  to anon, authenticated, service_role;

comment on function public.release_bz_reservations_for_task(uuid, text) is
  'Releases all allocated BZ reservations for a given task. '
  'Safe to call multiple times (idempotent via release_bz_reservation).';

-- ────────────────────────────────────────────────────────────
-- Trigger function: fires BEFORE a task row is deleted.
-- This cannot be bypassed by the application layer.
-- ────────────────────────────────────────────────────────────
create or replace function public.trg_release_bz_before_task_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_released integer;
begin
  -- Only act when BZ reservations exist for this task.
  -- Skip if the task has no allocated reservations to avoid
  -- unnecessary overhead on every task delete.
  if not exists (
    select 1
    from   public.bz_inventory_reservations
    where  task_id = old.id
      and  status  = 'allocated'
    limit  1
  ) then
    return old;
  end if;

  v_released := public.release_bz_reservations_for_task(
    old.id,
    'task_deleted:trigger'
  );

  if v_released > 0 then
    raise notice 'BZ auto-release: freed % reservation(s) for deleted task %',
      v_released, old.id;
  end if;

  return old;
end;
$$;

revoke all on function public.trg_release_bz_before_task_delete() from public;

-- Install trigger. BEFORE DELETE fires even when the DELETE is
-- part of a larger transaction, so the ledger row and inventory
-- update happen atomically with the task deletion.
drop trigger if exists trg_auto_release_bz_on_task_delete on public.tasks;
create trigger trg_auto_release_bz_on_task_delete
  before delete on public.tasks
  for each row
  execute function public.trg_release_bz_before_task_delete();

comment on trigger trg_auto_release_bz_on_task_delete on public.tasks is
  'Auto-releases any allocated BZ inventory reservations before a task row '
  'is deleted, preventing permanent wip_bz balance freeze.';

-- ────────────────────────────────────────────────────────────
-- Reconciliation RPC: finds "orphan" allocated reservations
-- whose task_id no longer exists in the tasks table and
-- releases them. Safe to run as a cron job or manually.
-- ────────────────────────────────────────────────────────────
create or replace function public.reconcile_orphan_bz_reservations(
  p_dry_run boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rec     record;
  v_released integer := 0;
  v_skipped  integer := 0;
  v_details  jsonb   := '[]'::jsonb;
  v_reason   text;
begin
  -- Find every distinct (operation_id, task_id) pair where the
  -- reservation is still 'allocated' but the task no longer exists.
  for v_rec in
    select
      r.operation_id,
      r.task_id,
      r.order_id,
      count(*)                              as reservation_count,
      sum(r.allocated_qty)                  as total_allocated,
      min(r.created_at)                     as oldest_at
    from   public.bz_inventory_reservations r
    where  r.status  = 'allocated'
      and  r.task_id is not null
      and  not exists (
             select 1 from public.tasks t
             where  t.id = r.task_id
           )
    group  by r.operation_id, r.task_id, r.order_id
    order  by oldest_at
  loop
    v_reason := format('orphan_cleanup:task_%s_missing', v_rec.task_id);

    v_details := v_details || jsonb_build_array(jsonb_build_object(
      'operation_id',       v_rec.operation_id,
      'task_id',            v_rec.task_id,
      'order_id',           v_rec.order_id,
      'reservation_count',  v_rec.reservation_count,
      'total_allocated',    v_rec.total_allocated,
      'oldest_at',          v_rec.oldest_at,
      'action',             case when p_dry_run then 'would_release' else 'released' end
    ));

    if not p_dry_run then
      begin
        perform public.release_bz_reservation(v_rec.operation_id, v_reason);
        v_released := v_released + 1;
      exception when others then
        raise warning 'reconcile_orphan_bz_reservations: failed for op %: %',
          v_rec.operation_id, sqlerrm;
        v_skipped := v_skipped + 1;
      end;
    else
      v_released := v_released + 1;   -- count as "would release" in dry run
    end if;
  end loop;

  -- Also detect reservations that are 'allocated' but have no
  -- task_id attached yet AND are older than 24 hours (likely
  -- an interrupted createNaryad that never attached).
  declare
    v_unattached integer := 0;
  begin
    select count(distinct operation_id)
    into   v_unattached
    from   public.bz_inventory_reservations
    where  status   = 'allocated'
      and  task_id  is null
      and  created_at < now() - interval '24 hours';

    return jsonb_build_object(
      'dry_run',              p_dry_run,
      'released_operations',  v_released,
      'skipped_operations',   v_skipped,
      'unattached_old_ops',   v_unattached,
      'details',              v_details,
      'run_at',               clock_timestamp()
    );
  end;
end;
$$;

revoke all on function public.reconcile_orphan_bz_reservations(boolean) from public;
grant execute on function public.reconcile_orphan_bz_reservations(boolean)
  to authenticated, service_role;

comment on function public.reconcile_orphan_bz_reservations(boolean) is
  'Finds allocated BZ reservations whose task_id no longer exists and releases them. '
  'Pass p_dry_run=true to preview without changes. '
  'Run periodically (e.g. daily) to clean up any reservations that slipped past the trigger.';

-- ────────────────────────────────────────────────────────────
-- View: live snapshot of wip_bz health.
-- Shows every nomenclature that has wip_bz inventory and how
-- many of its allocated reservations are "orphaned" (no live task).
-- ────────────────────────────────────────────────────────────
create or replace view public.v_wip_bz_health as
select
  n.id                                                        as nomenclature_id,
  n.name                                                      as nomenclature_name,
  coalesce(inv.total_qty, 0)                                  as wip_bz_qty,
  count(r.id) filter (where r.status = 'allocated')           as allocated_reservations,
  count(r.id) filter (
    where r.status = 'allocated'
      and r.task_id is not null
      and not exists (
        select 1 from public.tasks t where t.id = r.task_id
      )
  )                                                           as orphan_reservations,
  sum(r.allocated_qty) filter (
    where r.status = 'allocated'
      and r.task_id is not null
      and not exists (
        select 1 from public.tasks t where t.id = r.task_id
      )
  )                                                           as orphan_qty,
  sum(r.allocated_qty) filter (
    where r.status = 'allocated'
      and (r.task_id is null or exists (
        select 1 from public.tasks t where t.id = r.task_id
      ))
  )                                                           as live_allocated_qty,
  min(r.created_at) filter (where r.status = 'allocated')    as oldest_allocation_at
from   public.nomenclatures n
left join public.inventory inv
       on inv.nomenclature_id = n.id
      and inv.type = 'wip_bz'
left join public.bz_inventory_reservations r
       on r.nomenclature_id = n.id
where  coalesce(inv.total_qty, 0) > 0
    or exists (
         select 1 from public.bz_inventory_reservations rr
         where  rr.nomenclature_id = n.id and rr.status = 'allocated'
       )
group  by n.id, n.name, inv.total_qty
order  by orphan_qty desc nulls last, wip_bz_qty desc;

grant select on public.v_wip_bz_health to anon, authenticated;

comment on view public.v_wip_bz_health is
  'Live wip_bz health check. Rows with orphan_qty > 0 indicate frozen BZ balances '
  'that need reconciliation.';

-- ────────────────────────────────────────────────────────────
-- One-time cleanup: release any existing orphan reservations
-- that predate this migration.
-- Run inline so the migration is self-healing on first apply.
-- ────────────────────────────────────────────────────────────
do $$
declare
  v_result jsonb;
begin
  select public.reconcile_orphan_bz_reservations(false) into v_result;
  raise notice 'P1-2 initial orphan cleanup: %', v_result;
end;
$$;
