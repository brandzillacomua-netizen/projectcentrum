-- Restore cutter restoration batches missed by the legacy terminal path.
-- Inventory is intentionally NOT deducted here: the legacy client already
-- deducted the recorded factual quantity when each card was completed.

with parsed_history as (
  select distinct on (h.card_id, lower(cutter.key))
    h.card_id,
    wc.task_id,
    wc.order_id,
    n.id as nomenclature_id,
    cutter.value::numeric as quantity,
    wc.manager_name,
    h.operator_name,
    h.machine_name,
    h.completed_at
  from public.work_card_history h
  join public.work_cards wc on wc.id = h.card_id
  cross join lateral jsonb_each_text(
    substring(h.card_info from '\[CUTTERS_BREAKDOWN:(\{.*\})\]')::jsonb
  ) cutter
  join public.nomenclatures n
    on lower(btrim(n.name)) = lower(btrim(cutter.key))
   and n.type = 'consumable'
  where h.completed_at >= timestamptz '2026-07-24 00:00:00+00'
    and h.card_info like '%[CUTTERS_BREAKDOWN:%'
    and lower(cutter.key) like '%фасоч%'
    and cutter.value::numeric > 0
  order by h.card_id, lower(cutter.key), h.completed_at desc, h.id desc
)
insert into public.cutter_usage_events (
  source_card_id, task_id, order_id, nomenclature_id, quantity,
  is_faceting, pocket_owner, actor_name, created_at
)
select
  p.card_id, p.task_id, p.order_id, p.nomenclature_id, p.quantity,
  true, nullif(p.manager_name, 'Не вказано'), 'SYSTEM BACKFILL', p.completed_at
from parsed_history p
on conflict (source_card_id, nomenclature_id) do nothing;

insert into public.cutter_restoration_batches (
  batch_number, usage_event_id, source_card_id, task_id, order_id,
  nomenclature_id, cutter_name, received_qty,
  source_operator, source_manager, source_machine, created_at, updated_at
)
select
  'FR-BF-' || upper(substr(replace(u.id::text, '-', ''), 1, 10)),
  u.id, u.source_card_id, u.task_id, u.order_id,
  u.nomenclature_id, n.name, u.quantity,
  h.operator_name, wc.manager_name, h.machine_name,
  u.created_at, now()
from public.cutter_usage_events u
join public.nomenclatures n on n.id = u.nomenclature_id
join public.work_cards wc on wc.id = u.source_card_id
left join lateral (
  select wh.operator_name, wh.machine_name
  from public.work_card_history wh
  where wh.card_id = u.source_card_id
    and wh.card_info like '%[CUTTERS_BREAKDOWN:%'
  order by wh.completed_at desc, wh.id desc
  limit 1
) h on true
where u.is_faceting = true
  and u.created_at >= timestamptz '2026-07-24 00:00:00+00'
  and not exists (
    select 1 from public.cutter_restoration_batches b
    where b.usage_event_id = u.id
  );

insert into public.cutter_restoration_events (
  batch_id, event_type, actor_name, metadata, created_at
)
select
  b.id, 'created', 'SYSTEM BACKFILL',
  jsonb_build_object(
    'source_card_id', b.source_card_id,
    'quantity', b.received_qty,
    'reason', 'Recovered from factual CUTTERS_BREAKDOWN history'
  ),
  b.created_at
from public.cutter_restoration_batches b
where b.batch_number like 'FR-BF-%'
  and not exists (
    select 1 from public.cutter_restoration_events e
    where e.batch_id = b.id and e.event_type = 'created'
  );
