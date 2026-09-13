-- Migration: Fix execution context and grants for mes_fulfillment_queue and mes_next_packing_slip_number RPCs
-- rollout-contract: v1
-- risk: low
-- transaction: transactional
-- preflight: supabase/diagnostics/20260914030000_fix_fulfillment_queue_permissions_preflight.sql
-- postcondition: supabase/diagnostics/20260914030000_fix_fulfillment_queue_permissions_postcondition.sql
-- rollback: supabase/rollbacks/20260914030000_fix_fulfillment_queue_permissions_rollback.sql

SET lock_timeout = '5s';
SET statement_timeout = '10s';

BEGIN;

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
security definer
set search_path = public, pg_temp
as $$
  with params as (
    select
      lower(trim(coalesce(p_queue, ''))) as queue_name,
      least(greatest(coalesce(p_open_batch_limit, 300), 1), 500) as open_limit,
      least(greatest(coalesce(p_archive_batch_limit, 40), 0), 200) as archive_limit
  ),
  eligible as (
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

grant execute on function public.mes_fulfillment_queue(text, integer, integer) to authenticated, service_role;
grant execute on function public.mes_next_packing_slip_number() to authenticated, service_role;

COMMIT;
