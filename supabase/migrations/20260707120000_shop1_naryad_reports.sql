-- Lightweight archive + one-shot detail endpoint for Shop 1 naryad reports.
-- The UI never downloads the complete task/history archive.

create extension if not exists pg_trgm;

create index if not exists idx_tasks_report_created
  on public.tasks (created_at desc, id);
create index if not exists idx_tasks_report_order
  on public.tasks (order_id, created_at desc);
create index if not exists idx_work_cards_task_report
  on public.work_cards (task_id, id);
create index if not exists idx_work_card_history_card_completed
  on public.work_card_history (card_id, completed_at);
create index if not exists idx_material_requests_task_report
  on public.material_requests (task_id);
create index if not exists idx_orders_order_num_trgm
  on public.orders using gin (order_num gin_trgm_ops);
create index if not exists idx_orders_customer_trgm
  on public.orders using gin (customer gin_trgm_ops);

drop function if exists public.shop1_naryad_catalog(text, integer, integer);

create function public.shop1_naryad_catalog(
  p_search text default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  task_id uuid,
  order_id uuid,
  order_num text,
  customer text,
  status text,
  batch_index integer,
  created_at timestamptz,
  completed_at timestamptz,
  task_count bigint,
  card_count bigint,
  total_count bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  with grouped as (
    select
      (array_agg(t.id order by t.created_at))[1] as task_id,
      t.order_id,
      o.order_num::text as order_num,
      o.customer::text as customer,
      case
        when bool_and(t.status = 'completed') then 'completed'
        when bool_or(t.status = 'in-progress') then 'in-progress'
        when bool_or(t.status = 'paused') then 'paused'
        else max(t.status)::text
      end as status,
      t.batch_index::integer as batch_index,
      min(t.created_at)::timestamptz as created_at,
      max(t.completed_at)::timestamptz as completed_at,
      count(distinct t.id) as task_count,
      count(distinct wc.id) as card_count,
      max(coalesce(t.completed_at, t.created_at)) as last_activity
    from public.tasks t
    -- An archive row is a production naryad only while its source order exists.
    -- Inner join prevents orphan technical tasks from being shown as fake numbers.
    join public.orders o on o.id = t.order_id
    left join public.work_cards wc on wc.task_id = t.id
    where nullif(trim(p_search), '') is null
       or o.order_num ilike '%' || trim(p_search) || '%'
       or o.customer ilike '%' || trim(p_search) || '%'
       or t.id::text ilike '%' || trim(p_search) || '%'
    group by t.order_id, o.order_num, o.customer, t.batch_index
  )
  select
    g.task_id, g.order_id, g.order_num, g.customer, g.status, g.batch_index,
    g.created_at, g.completed_at, g.task_count, g.card_count,
    count(*) over() as total_count
  from grouped g
  order by g.last_activity desc, g.task_id desc
  limit least(greatest(coalesce(p_limit, 50), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

create or replace function public.shop1_naryad_report(p_task_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with anchor as (
    select t.order_id, t.batch_index
    from public.tasks t
    where t.id = p_task_id
  ), target_tasks as materialized (
    select t.id, t.plan_snapshot
    from public.tasks t
    join anchor a on a.order_id = t.order_id
      and t.batch_index is not distinct from a.batch_index
  ), selected_cards as materialized (
    select wc.id, wc.created_at, wc.card_info,
      row_number() over (order by wc.created_at, wc.id) as card_number
    from public.work_cards wc
    join target_tasks tt on tt.id = wc.task_id
  ), history as (
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'id', h.id,
        'card_id', h.card_id,
        'nomenclature_id', h.nomenclature_id,
        'stage_name', h.stage_name,
        'operator_name', h.operator_name,
        'shift_name', h.shift_name,
        'machine_name', h.machine_name,
        'started_at', h.started_at,
        'completed_at', h.completed_at,
        'created_at', h.created_at,
        'qty_completed', h.qty_completed,
        'scrap_qty', h.scrap_qty,
        'cutters_used', h.cutters_used,
        'card_info', h.card_info
      ) order by coalesce(h.completed_at, h.created_at)
    ), '[]'::jsonb) value
    from public.work_card_history h
    join selected_cards sc on sc.id = h.card_id
  ), requests as (
    select coalesce(jsonb_agg(
      to_jsonb(mr) || jsonb_build_object(
        'nomenclature', case when n.id is null then null else jsonb_build_object('id', n.id, 'name', n.name) end
      ) order by mr.created_at
    ), '[]'::jsonb) value
    from public.material_requests mr
    left join public.nomenclatures n on n.id = mr.nomenclature_id
    where mr.task_id in (select id from target_tasks)
  )
  select jsonb_build_object(
    'historyRows', history.value,
    'taskCards', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'card_number', card_number, 'card_info', card_info) order by card_number), '[]'::jsonb) from selected_cards),
    'materialRequests', requests.value,
    'planSnapshot', (select tt.plan_snapshot from target_tasks tt where tt.plan_snapshot is not null limit 1),
    'orderItems', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'nomenclature_id', oi.nomenclature_id,
        'quantity', oi.quantity,
        'name', n.name
      )), '[]'::jsonb)
      from anchor a
      join public.order_items oi on oi.order_id = a.order_id
      left join public.nomenclatures n on n.id = oi.nomenclature_id
    ),
    'taskCount', (select count(*) from target_tasks)
  )
  from history cross join requests;
$$;

grant execute on function public.shop1_naryad_catalog(text, integer, integer) to authenticated;
grant execute on function public.shop1_naryad_report(uuid) to authenticated;
