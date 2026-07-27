-- Accumulate restoration work by the physical cutter specification rather
-- than by a catalogue UUID. Duplicate catalogue rows for the same diameter,
-- dimensions and angle therefore belong to one working stack.

create or replace function public.cutter_restoration_type_key(p_name text)
returns text
language sql
immutable
parallel safe
as $$
  select regexp_replace(
    translate(
        regexp_replace(
          lower(coalesce(p_name, '')),
          '(фреза|фасочна|фасочная|cutter|ф|градусів|градуса|degrees?|deg|°)',
          '',
          'g'
        ),
        'х×*,',
        'xxx.'
    ),
    '[^a-zа-яіїєґ0-9.x()]',
    '',
    'g'
  )
$$;

create index if not exists cutter_restoration_batches_type_key_pending_idx
  on public.cutter_restoration_batches (
    public.cutter_restoration_type_key(cutter_name),
    created_at
  )
  where status = 'pending';

create or replace function public.start_cutter_restoration_stack(
  p_type_key text,
  p_actor_id bigint,
  p_actor_name text
)
returns setof public.cutter_restoration_batches
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch record;
begin
  if coalesce(p_type_key, '') = '' then
    raise exception 'Cutter type is required';
  end if;

  for v_batch in
    select id
    from public.cutter_restoration_batches
    where public.cutter_restoration_type_key(cutter_name) = p_type_key
      and status = 'pending'
    order by created_at, id
    for update skip locked
  loop
    perform public.start_cutter_restoration(v_batch.id, p_actor_id, p_actor_name);
  end loop;

  return query
  select b.*
  from public.cutter_restoration_batches b
  where public.cutter_restoration_type_key(b.cutter_name) = p_type_key
    and b.status = 'in_progress'
    and b.assigned_user_id is not distinct from p_actor_id
  order by b.created_at, b.id;
end;
$$;

-- The group may contain duplicate catalogue UUIDs, but every row must still
-- describe the same physical cutter specification.
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
    select 1 from public.system_users u
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
    (array_agg(nomenclature_id order by created_at, id))[1],
    (array_agg(cutter_name order by created_at, id))[1]
  into v_total, v_nomenclature_id, v_cutter_name
  from public.cutter_restoration_batches
  where id = any(p_batch_ids)
    and status = 'in_progress'
    and assigned_user_id is not distinct from p_actor_id;

  if (
    select count(distinct public.cutter_restoration_type_key(cutter_name))
    from public.cutter_restoration_batches
    where id = any(p_batch_ids)
  ) <> 1 then
    raise exception 'A restoration stack must contain one physical cutter type';
  end if;

  if v_total <> greatest(coalesce(p_restored_qty, 0), 0)
      + greatest(coalesce(p_rejected_qty, 0), 0) then
    raise exception 'Restored and rejected quantities must equal the selected stack quantity';
  end if;

  if (
    select count(*) from public.cutter_restoration_batches
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
    select * from public.cutter_restoration_batches
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
        'group_size', array_length(p_batch_ids, 1),
        'cutter_type_key', public.cutter_restoration_type_key(v_batch.cutter_name)
      )
    );

    v_restored_left := v_restored_left - v_batch_restored;
    v_finished := v_finished + 1;
  end loop;

  return v_finished;
end;
$$;

revoke all on function public.cutter_restoration_type_key(text) from public;
revoke all on function public.start_cutter_restoration_stack(text,bigint,text) from public;
revoke all on function public.finish_cutter_restoration_group(uuid[],numeric,numeric,bigint,text,text) from public;
grant execute on function public.cutter_restoration_type_key(text) to anon, authenticated;
grant execute on function public.start_cutter_restoration_stack(text,bigint,text) to anon, authenticated;
grant execute on function public.finish_cutter_restoration_group(uuid[],numeric,numeric,bigint,text,text) to anon, authenticated;
