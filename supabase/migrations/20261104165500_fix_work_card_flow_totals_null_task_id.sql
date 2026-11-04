-- Migration: 20261104165500_fix_work_card_flow_totals_null_task_id.sql
-- Description: Prevent not-null constraint violation on work_card_flow_totals when cards have task_id IS NULL (e.g. Shop 2 standalone cards, rework cards, SGР stock cards)

-- 1. Guard apply_work_card_flow_delta against NULL task_id
create or replace function public.apply_work_card_flow_delta(
  p_card_id uuid,
  p_nomenclature_id uuid,
  p_stage_name text,
  p_good_delta integer,
  p_bz_delta integer,
  p_scrap_delta integer,
  p_event_at timestamptz default now()
)
returns void
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

  -- If card has no task_id (e.g. standalone Shop 2, rework or stock cards), do not attempt to aggregate into task-level flow totals
  if v_card.task_id is null then
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

-- 2. Drop the NOT NULL constraint on task_id if exists to allow general resilience
do $$
begin
  if exists (
    select 1 
    from information_schema.columns 
    where table_schema = 'public' 
      and table_name = 'work_card_flow_totals' 
      and column_name = 'task_id' 
      and is_nullable = 'NO'
  ) then
    alter table public.work_card_flow_totals alter column task_id drop not null;
  end if;
end $$;

