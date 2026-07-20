-- Bounded fulfillment queues for Packaging and Shipping.
--
-- The application previously rebuilt these queues from the shared `tasks`
-- bootstrap. That bootstrap intentionally keeps only recent completed tasks,
-- which can hide an older package that is still waiting for fulfillment. This
-- RPC keeps every returned read bounded by batch count while preserving the
-- exact metadata predicates used by the two existing screens.

create index if not exists idx_tasks_packaging_open_batches
  on public.tasks (completed_at desc, order_id, batch_index)
  where status = 'completed'
    and coalesce(plan_snapshot #> '{_metadata,is_packaged}', 'false'::jsonb) <> 'true'::jsonb;

create index if not exists idx_tasks_packaged_batches
  on public.tasks (completed_at desc, order_id, batch_index)
  where plan_snapshot #> '{_metadata,is_packaged}' = 'true'::jsonb;

create index if not exists idx_tasks_shipping_open_batches
  on public.tasks (completed_at desc, order_id, batch_index)
  where status = 'completed'
    and plan_snapshot #> '{_metadata,is_packaged}' = 'true'::jsonb
    and coalesce(plan_snapshot #> '{_metadata,is_shipped}', 'false'::jsonb) <> 'true'::jsonb;

create index if not exists idx_tasks_shipped_batches
  on public.tasks (completed_at desc, order_id, batch_index)
  where plan_snapshot #> '{_metadata,is_shipped}' = 'true'::jsonb;

create or replace function public.mes_fulfillment_queue(
  p_queue text,
  p_open_batch_limit integer default 300,
  p_archive_batch_limit integer default 40
)
returns table (
  queue_state text,
  order_id text,
  batch_index text,
  batch_sort_at timestamptz,
  tasks jsonb
)
language sql
stable
security invoker
set search_path = public
as $$
  with params as (
    select
      lower(trim(coalesce(p_queue, ''))) as queue_name,
      least(greatest(coalesce(p_open_batch_limit, 300), 1), 500) as open_limit,
      least(greatest(coalesce(p_archive_batch_limit, 40), 0), 200) as archive_limit
  ),
  eligible as (
    -- Packaging queue: completed, not-yet-packaged tasks remain open no matter
    -- how old they are. Already packaged batches form the bounded archive.
    select
      t.id,
      t.order_id,
      coalesce(t.batch_index::text, '') as batch_key,
      t.created_at,
      coalesce(t.completed_at, t.created_at) as sort_at,
      to_jsonb(t) as task,
      'open'::text as queue_state
    from public.tasks t
    cross join params p
    where p.queue_name = 'packaging'
      and t.order_id is not null
      and t.status = 'completed'
      and coalesce(t.plan_snapshot #> '{_metadata,is_packaged}', 'false'::jsonb) <> 'true'::jsonb

    union all

    select
      t.id,
      t.order_id,
      coalesce(t.batch_index::text, '') as batch_key,
      t.created_at,
      coalesce(t.completed_at, t.created_at) as sort_at,
      to_jsonb(t) as task,
      'archive'::text as queue_state
    from public.tasks t
    cross join params p
    where p.queue_name = 'packaging'
      and t.order_id is not null
      and t.plan_snapshot #> '{_metadata,is_packaged}' = 'true'::jsonb

    union all

    -- Shipping queue: packaged completed tasks stay open until every task in
    -- the batch is marked shipped. The screen already treats shipped metadata
    -- as authoritative for its archive, regardless of the task status.
    select
      t.id,
      t.order_id,
      coalesce(t.batch_index::text, '') as batch_key,
      t.created_at,
      coalesce(t.completed_at, t.created_at) as sort_at,
      to_jsonb(t) as task,
      'open'::text as queue_state
    from public.tasks t
    cross join params p
    where p.queue_name = 'shipping'
      and t.order_id is not null
      and t.status = 'completed'
      and t.plan_snapshot #> '{_metadata,is_packaged}' = 'true'::jsonb
      and coalesce(t.plan_snapshot #> '{_metadata,is_shipped}', 'false'::jsonb) <> 'true'::jsonb

    union all

    select
      t.id,
      t.order_id,
      coalesce(t.batch_index::text, '') as batch_key,
      t.created_at,
      coalesce(t.completed_at, t.created_at) as sort_at,
      to_jsonb(t) as task,
      'archive'::text as queue_state
    from public.tasks t
    cross join params p
    where p.queue_name = 'shipping'
      and t.order_id is not null
      and t.plan_snapshot #> '{_metadata,is_shipped}' = 'true'::jsonb
  ),
  batch_candidates as (
    select
      e.queue_state,
      e.order_id,
      e.batch_key,
      max(e.sort_at) as batch_sort_at
    from eligible e
    group by e.queue_state, e.order_id, e.batch_key
  ),
  ranked_batches as (
    select
      b.*,
      row_number() over (
        partition by b.queue_state
        order by b.batch_sort_at desc, b.order_id, b.batch_key
      ) as batch_rank
    from batch_candidates b
  ),
  selected_batches as (
    select r.*
    from ranked_batches r
    cross join params p
    where (r.queue_state = 'open' and r.batch_rank <= p.open_limit)
       or (r.queue_state = 'archive' and r.batch_rank <= p.archive_limit)
  )
  select
    s.queue_state,
    s.order_id::text,
    nullif(s.batch_key, '') as batch_index,
    s.batch_sort_at,
    jsonb_agg(e.task order by e.created_at, e.id::text) as tasks
  from selected_batches s
  join eligible e
    on e.queue_state = s.queue_state
   and e.order_id = s.order_id
   and e.batch_key = s.batch_key
  group by s.queue_state, s.order_id, s.batch_key, s.batch_sort_at
  order by
    case when s.queue_state = 'open' then 0 else 1 end,
    s.batch_sort_at desc,
    s.order_id,
    s.batch_key;
$$;

revoke all on function public.mes_fulfillment_queue(text, integer, integer) from public;
grant execute on function public.mes_fulfillment_queue(text, integer, integer) to anon, authenticated;

comment on function public.mes_fulfillment_queue(text, integer, integer) is
  'Returns bounded Packaging or Shipping task batches. Open work is age-independent; archive size is explicitly limited.';

-- Packing-slip numbers used to be calculated by downloading every task and
-- scanning plan_snapshot in the browser. A single atomic counter eliminates
-- that whole-table read and prevents duplicate numbers when two shippers
-- finish at the same time. The one-time migration seed preserves the current
-- maximum; later calls never scan tasks.
create table if not exists public.mes_counters (
  counter_key text primary key,
  counter_value bigint not null check (counter_value >= 0),
  updated_at timestamptz not null default now()
);

alter table public.mes_counters enable row level security;
revoke all on table public.mes_counters from public;

with existing_slips as (
  select max(
    case
      when t.plan_snapshot #>> '{_metadata,packing_slip_number}' ~ '^[0-9]+$'
        then (t.plan_snapshot #>> '{_metadata,packing_slip_number}')::bigint
      else null
    end
  ) as max_value
  from public.tasks t
)
insert into public.mes_counters (counter_key, counter_value)
select 'packing_slip_number', greatest(856::bigint, coalesce(max_value, 856::bigint))
from existing_slips
on conflict (counter_key) do update
set counter_value = greatest(public.mes_counters.counter_value, excluded.counter_value),
    updated_at = now();

create or replace function public.mes_next_packing_slip_number()
returns bigint
language plpgsql
volatile
security definer
set search_path = pg_catalog, public
as $$
declare
  next_value bigint;
begin
  insert into public.mes_counters (counter_key, counter_value, updated_at)
  values ('packing_slip_number', 857, now())
  on conflict (counter_key) do update
  set counter_value = greatest(public.mes_counters.counter_value, 856) + 1,
      updated_at = now()
  returning counter_value into next_value;

  return next_value;
end;
$$;

revoke all on table public.mes_counters from anon, authenticated;
revoke all on function public.mes_next_packing_slip_number() from public;
grant execute on function public.mes_next_packing_slip_number() to anon, authenticated;

comment on function public.mes_next_packing_slip_number() is
  'Atomically reserves the next packing-slip number without reading the tasks table.';
