-- Work with accumulated cutters as one type-based stack while preserving
-- every source batch for traceability and reception.

create or replace function public.start_cutter_restoration_group(
  p_nomenclature_id uuid,
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
  for v_batch in
    select id
    from public.cutter_restoration_batches
    where nomenclature_id = p_nomenclature_id
      and status = 'pending'
    order by created_at, id
    for update
  loop
    perform public.start_cutter_restoration(v_batch.id, p_actor_id, p_actor_name);
  end loop;

  return query
  select b.*
  from public.cutter_restoration_batches b
  where b.nomenclature_id = p_nomenclature_id
    and b.status = 'in_progress'
    and b.assigned_user_id is not distinct from p_actor_id
  order by b.created_at, b.id;
end;
$$;

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
begin
  if coalesce(array_length(p_batch_ids, 1), 0) = 0 then
    raise exception 'No restoration batches selected';
  end if;

  select coalesce(sum(received_qty), 0)
  into v_total
  from public.cutter_restoration_batches
  where id = any(p_batch_ids)
    and status = 'in_progress'
    and assigned_user_id is not distinct from p_actor_id;

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

  for v_batch in
    select *
    from public.cutter_restoration_batches
    where id = any(p_batch_ids)
    order by created_at, id
    for update
  loop
    v_batch_restored := least(v_batch.received_qty, v_restored_left);
    v_batch_rejected := v_batch.received_qty - v_batch_restored;

    perform public.finish_cutter_restoration(
      v_batch.id,
      v_batch_restored,
      v_batch_rejected,
      p_actor_id,
      p_actor_name,
      p_note
    );

    v_restored_left := v_restored_left - v_batch_restored;
    v_finished := v_finished + 1;
  end loop;

  return v_finished;
end;
$$;

revoke all on function public.start_cutter_restoration_group(uuid,bigint,text) from public;
revoke all on function public.finish_cutter_restoration_group(uuid[],numeric,numeric,bigint,text,text) from public;
grant execute on function public.start_cutter_restoration_group(uuid,bigint,text) to anon, authenticated;
grant execute on function public.finish_cutter_restoration_group(uuid[],numeric,numeric,bigint,text,text) to anon, authenticated;
