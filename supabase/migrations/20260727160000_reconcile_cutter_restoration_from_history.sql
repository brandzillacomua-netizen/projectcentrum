-- Keep the cutter restoration queue in sync with factual cutter usage recorded
-- in work_card_history. This is intentionally separate from pocket inventory:
-- terminal versions that wrote this history already handled their own stock
-- deduction, so reconciliation must never deduct a cutter for a second time.

create or replace function public.reconcile_cutter_restoration_from_history()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_created integer := 0;
  v_row_count integer := 0;
begin
  with parsed_history as (
    select distinct on (h.card_id, lower(btrim(cutter.key)))
      h.card_id,
      wc.task_id,
      wc.order_id,
      n.id as nomenclature_id,
      cutter.value::numeric as quantity,
      nullif(wc.manager_name, 'Не вказано') as manager_name,
      h.operator_name,
      h.machine_name,
      h.completed_at
    from public.work_card_history h
    join public.work_cards wc on wc.id = h.card_id
    cross join lateral regexp_matches(
      coalesce(h.card_info, ''),
      '\[CUTTERS_BREAKDOWN:(\{[^\]]+\})\]',
      'g'
    ) as matched(parts)
    cross join lateral jsonb_each_text(matched.parts[1]::jsonb) cutter
    join public.nomenclatures n
      on lower(btrim(n.name)) = lower(btrim(cutter.key))
     and n.type = 'consumable'
    where h.completed_at >= timestamptz '2026-07-24 00:00:00+00'
      and h.stage_name = 'Розкрій'
      and h.card_info like '%[CUTTERS_BREAKDOWN:%'
      and cutter.value::numeric > 0
      and public.is_faceting_cutter(n.id)
    order by
      h.card_id,
      lower(btrim(cutter.key)),
      h.completed_at desc,
      h.id desc
  )
  insert into public.cutter_usage_events (
    source_card_id,
    task_id,
    order_id,
    nomenclature_id,
    quantity,
    is_faceting,
    pocket_owner,
    actor_name,
    created_at
  )
  select
    p.card_id,
    p.task_id,
    p.order_id,
    p.nomenclature_id,
    p.quantity,
    true,
    p.manager_name,
    'SYSTEM HISTORY SYNC',
    p.completed_at
  from parsed_history p
  on conflict (source_card_id, nomenclature_id) do nothing;

  get diagnostics v_row_count = row_count;
  v_created := v_created + v_row_count;

  insert into public.cutter_restoration_batches (
    batch_number,
    usage_event_id,
    source_card_id,
    task_id,
    order_id,
    nomenclature_id,
    cutter_name,
    received_qty,
    source_operator,
    source_manager,
    source_machine,
    created_at,
    updated_at
  )
  select
    'FR-HS-' || upper(substr(replace(u.id::text, '-', ''), 1, 10)),
    u.id,
    u.source_card_id,
    u.task_id,
    u.order_id,
    u.nomenclature_id,
    n.name,
    u.quantity,
    h.operator_name,
    wc.manager_name,
    h.machine_name,
    u.created_at,
    now()
  from public.cutter_usage_events u
  join public.nomenclatures n on n.id = u.nomenclature_id
  join public.work_cards wc on wc.id = u.source_card_id
  left join lateral (
    select wh.operator_name, wh.machine_name
    from public.work_card_history wh
    where wh.card_id = u.source_card_id
      and wh.stage_name = 'Розкрій'
      and wh.card_info like '%[CUTTERS_BREAKDOWN:%'
    order by wh.completed_at desc, wh.id desc
    limit 1
  ) h on true
  where u.is_faceting = true
    and u.created_at >= timestamptz '2026-07-24 00:00:00+00'
    and not exists (
      select 1
      from public.cutter_restoration_batches b
      where b.usage_event_id = u.id
    )
  on conflict (usage_event_id) do nothing;

  get diagnostics v_row_count = row_count;
  v_created := v_created + v_row_count;

  insert into public.cutter_restoration_events (
    batch_id,
    event_type,
    actor_name,
    metadata,
    created_at
  )
  select
    b.id,
    'created',
    'SYSTEM HISTORY SYNC',
    jsonb_build_object(
      'source_card_id', b.source_card_id,
      'quantity', b.received_qty,
      'reason', 'Synchronized from factual CUTTERS_BREAKDOWN history'
    ),
    b.created_at
  from public.cutter_restoration_batches b
  where b.batch_number like 'FR-HS-%'
    and not exists (
      select 1
      from public.cutter_restoration_events e
      where e.batch_id = b.id
        and e.event_type = 'created'
    );

  return v_created;
end;
$$;

revoke all on function public.reconcile_cutter_restoration_from_history() from public;
grant execute on function public.reconcile_cutter_restoration_from_history() to anon, authenticated;

-- Repair everything missed since the restoration workflow was introduced.
select public.reconcile_cutter_restoration_from_history();
