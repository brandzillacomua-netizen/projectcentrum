-- A grouped restoration stack must create one reception document, not one
-- document per traceability batch.

create or replace function public.finish_cutter_restoration_group(
  p_batch_ids uuid[],
  p_restored_qty numeric,
  p_rejected_qty numeric,
  p_actor_id bigint,
  p_actor_name text,
  p_note text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch public.cutter_restoration_batches%rowtype;
  v_total numeric;
  v_restored_left numeric := greatest(coalesce(p_restored_qty, 0), 0);
  v_batch_restored numeric;
  v_batch_rejected numeric;
  v_finished integer := 0;
  v_doc_id uuid;
  v_nomenclature_id uuid;
  v_cutter_name text;
  v_items jsonb;
begin
  if not exists (
    select 1
    from public.system_users u
    where u.id = p_actor_id
      and (
        coalesce((u.access_rights->>'cutter_restoration')::boolean, false)
        or lower(coalesce(u.position, '')) in ('адмін', 'admin')
      )
  ) then
    raise exception 'User has no cutter restoration access';
  end if;

  if coalesce(array_length(p_batch_ids, 1), 0) = 0 then
    raise exception 'No restoration batches selected';
  end if;

  select
    coalesce(sum(received_qty), 0),
    min(nomenclature_id::text)::uuid,
    min(cutter_name)
  into v_total, v_nomenclature_id, v_cutter_name
  from public.cutter_restoration_batches
  where id = any(p_batch_ids)
    and status = 'in_progress'
    and assigned_user_id is not distinct from p_actor_id;

  if (
    select count(distinct nomenclature_id)
    from public.cutter_restoration_batches
    where id = any(p_batch_ids)
  ) <> 1 then
    raise exception 'A restoration stack must contain one cutter type';
  end if;

  if v_total <> greatest(coalesce(p_restored_qty, 0), 0)
      + greatest(coalesce(p_rejected_qty, 0), 0) then
    raise exception 'Restored and rejected quantities must equal the selected stack quantity';
  end if;

  if (
    select count(*)
    from public.cutter_restoration_batches
    where id = any(p_batch_ids)
      and status = 'in_progress'
      and assigned_user_id is not distinct from p_actor_id
  ) <> coalesce(array_length(p_batch_ids, 1), 0) then
    raise exception 'One or more restoration batches are unavailable';
  end if;

  if p_restored_qty > 0 then
    v_items := jsonb_build_array(jsonb_build_object(
      'name', v_cutter_name,
      'nomenclature_id', v_nomenclature_id,
      'qty', p_restored_qty,
      'expected_qty', p_restored_qty,
      'unit', 'шт',
      'origin', 'cutter_restoration_group',
      'restoration_batch_ids', to_jsonb(p_batch_ids)
    ));

    insert into public.reception_docs (
      items, status, target_warehouse, source_warehouse, created_at
    ) values (
      v_items, 'ordered', 'operational', null, now()
    )
    returning id into v_doc_id;
  end if;

  for v_batch in
    select *
    from public.cutter_restoration_batches
    where id = any(p_batch_ids)
    order by created_at, id
    for update
  loop
    v_batch_restored := least(v_batch.received_qty, v_restored_left);
    v_batch_rejected := v_batch.received_qty - v_batch_restored;

    update public.cutter_restoration_batches
    set restored_qty = v_batch_restored,
        rejected_qty = v_batch_rejected,
        status = case when p_restored_qty > 0 then 'awaiting_reception' else 'completed' end,
        reception_doc_id = v_doc_id,
        completion_note = p_note,
        finished_at = now(),
        updated_at = now()
    where id = v_batch.id;

    insert into public.cutter_restoration_events (
      batch_id, event_type, restored_qty, rejected_qty,
      actor_id, actor_name, note, metadata
    ) values (
      v_batch.id, 'finished', v_batch_restored, v_batch_rejected,
      p_actor_id, p_actor_name, p_note,
      jsonb_build_object(
        'reception_doc_id', v_doc_id,
        'group_size', array_length(p_batch_ids, 1)
      )
    );

    v_restored_left := v_restored_left - v_batch_restored;
    v_finished := v_finished + 1;
  end loop;

  return v_finished;
end;
$$;

create or replace function public.complete_cutter_restoration_after_reception()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'completed' and old.status is distinct from new.status then
    with completed_batches as (
      update public.cutter_restoration_batches
      set status = 'completed', updated_at = now()
      where reception_doc_id = new.id
        and status = 'awaiting_reception'
      returning id
    )
    insert into public.cutter_restoration_events (
      batch_id, event_type, metadata
    )
    select
      id,
      'warehouse_received',
      jsonb_build_object('reception_doc_id', new.id)
    from completed_batches;
  end if;
  return new;
end;
$$;

revoke all on function public.finish_cutter_restoration_group(uuid[],numeric,numeric,bigint,text,text) from public;
grant execute on function public.finish_cutter_restoration_group(uuid[],numeric,numeric,bigint,text,text) to anon, authenticated;

-- Consolidate legacy per-batch reception documents that are still untouched
-- by the warehouse. One cutter type becomes one ordered reception document.
do $$
declare
  v_group record;
  v_new_doc_id uuid;
begin
  for v_group in
    select
      b.nomenclature_id,
      min(b.cutter_name) as cutter_name,
      b.assigned_user_id,
      array_agg(b.id order by b.created_at, b.id) as batch_ids,
      array_agg(distinct b.reception_doc_id) as old_doc_ids,
      sum(b.restored_qty) as restored_qty
    from public.cutter_restoration_batches b
    join public.reception_docs d on d.id = b.reception_doc_id
    where b.status = 'awaiting_reception'
      and b.reception_doc_id is not null
      and d.status = 'ordered'
      and d.target_warehouse = 'operational'
      and d.items @> '[{"origin":"cutter_restoration"}]'::jsonb
    group by b.nomenclature_id, b.assigned_user_id
    having count(distinct b.reception_doc_id) > 1
  loop
    insert into public.reception_docs (
      items, status, target_warehouse, source_warehouse, created_at
    ) values (
      jsonb_build_array(jsonb_build_object(
        'name', v_group.cutter_name,
        'nomenclature_id', v_group.nomenclature_id,
        'qty', v_group.restored_qty,
        'expected_qty', v_group.restored_qty,
        'unit', 'шт',
        'origin', 'cutter_restoration_group',
        'restoration_batch_ids', to_jsonb(v_group.batch_ids)
      )),
      'ordered',
      'operational',
      null,
      now()
    )
    returning id into v_new_doc_id;

    update public.cutter_restoration_batches
    set reception_doc_id = v_new_doc_id,
        updated_at = now()
    where id = any(v_group.batch_ids);

    insert into public.cutter_restoration_events (
      batch_id, event_type, actor_name, metadata
    )
    select
      batch_id,
      'reception_consolidated',
      'SYSTEM MIGRATION',
      jsonb_build_object(
        'reception_doc_id', v_new_doc_id,
        'replaced_document_count', array_length(v_group.old_doc_ids, 1)
      )
    from unnest(v_group.batch_ids) as source(batch_id);

    delete from public.reception_docs
    where id = any(v_group.old_doc_ids)
      and status = 'ordered';
  end loop;
end;
$$;
