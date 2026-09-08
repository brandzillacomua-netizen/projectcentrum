-- Migration: Remove pocket from register_cutter_usage
-- Cutters are now deducted directly from operational warehouse (СО) with atomic reservation release.
-- register_cutter_usage is preserved for recording cutter_usage_events and cutter_restoration_batches.

create or replace function public.register_cutter_usage(
  p_source_card_id uuid,
  p_items jsonb,
  p_actor_id bigint default null,
  p_actor_name text default null,
  p_source_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_card public.work_cards%rowtype;
  v_item jsonb;
  v_nom public.nomenclatures%rowtype;
  v_usage public.cutter_usage_events%rowtype;
  v_nom_id uuid;
  v_qty numeric;
  v_faceting boolean;
  v_owner text;
  v_batch_id uuid;
  v_batches jsonb := '[]'::jsonb;
begin
  select * into v_card
  from public.work_cards
  where id = p_source_card_id
  for update;

  if v_card.id is null then
    raise exception 'Work card not found';
  end if;

  v_owner := nullif(coalesce(p_source_metadata->>'manager_name', v_card.manager_name), 'Не вказано');

  for v_item in
    select value from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    v_nom_id := (v_item->>'nomenclature_id')::uuid;
    v_qty := greatest(coalesce((v_item->>'quantity')::numeric, 0), 0);
    if v_qty = 0 then continue; end if;

    select * into v_nom from public.nomenclatures where id = v_nom_id;
    if v_nom.id is null or v_nom.type <> 'consumable' then
      raise exception 'Invalid cutter nomenclature: %', v_nom_id;
    end if;

    -- Idempotency barrier: a repeated terminal request won't duplicate usage events or restoration batches.
    if exists (
      select 1 from public.cutter_usage_events
      where source_card_id = p_source_card_id and nomenclature_id = v_nom_id
    ) then
      continue;
    end if;

    v_faceting := public.is_faceting_cutter(v_nom_id);

    insert into public.cutter_usage_events (
      source_card_id, task_id, order_id, nomenclature_id, quantity,
      is_faceting, pocket_owner, actor_id, actor_name
    ) values (
      v_card.id, v_card.task_id, v_card.order_id, v_nom_id, v_qty,
      v_faceting, null, p_actor_id, p_actor_name
    )
    returning * into v_usage;

    if v_faceting then
      insert into public.cutter_restoration_batches (
        batch_number, usage_event_id, source_card_id, task_id, order_id,
        nomenclature_id, cutter_name, received_qty,
        source_operator, source_manager, source_machine
      ) values (
        'FR-' || to_char(clock_timestamp(), 'YYYYMMDD') || '-' || upper(substr(replace(v_usage.id::text, '-', ''), 1, 6)),
        v_usage.id, v_card.id, v_card.task_id, v_card.order_id,
        v_nom_id, v_nom.name, v_qty,
        coalesce(p_source_metadata->>'operator_name', v_card.operator_name),
        coalesce(p_source_metadata->>'manager_name', v_card.manager_name),
        coalesce(p_source_metadata->>'machine_name', v_card.machine)
      )
      returning id into v_batch_id;

      insert into public.cutter_restoration_events (
        batch_id, event_type, actor_id, actor_name, metadata
      ) values (
        v_batch_id, 'created', p_actor_id, p_actor_name,
        jsonb_build_object('source_card_id', v_card.id, 'quantity', v_qty)
      );

      v_batches := v_batches || jsonb_build_array(v_batch_id);
    end if;
  end loop;

  return jsonb_build_object('created_batch_ids', v_batches);
end;
$$;
