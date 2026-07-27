begin;

create or replace function public.sync_vkya_history_queue_projection_delete()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $projection_delete$
begin
  insert into public.vkya_classification_queue_projection (
    source_type, source_id, payload, is_active, change_seq, changed_at
  ) values (
    'history',
    old.id,
    to_jsonb(old),
    false,
    nextval('public.vkya_classification_queue_change_seq'),
    clock_timestamp()
  )
  on conflict (source_type, source_id) do update set
    payload = excluded.payload,
    is_active = false,
    change_seq = excluded.change_seq,
    changed_at = excluded.changed_at;
  return old;
end;
$projection_delete$;

drop trigger if exists trg_vkya_history_queue_projection_delete
  on public.work_card_history;
create trigger trg_vkya_history_queue_projection_delete
after delete on public.work_card_history
for each row execute function public.sync_vkya_history_queue_projection_delete();

-- Repair any projection rows orphaned by deletions made before this trigger.
update public.vkya_classification_queue_projection projection
set is_active = false,
    change_seq = nextval('public.vkya_classification_queue_change_seq'),
    changed_at = clock_timestamp()
where projection.source_type = 'history'
  and projection.is_active
  and not exists (
    select 1
    from public.work_card_history history
    where history.id = projection.source_id
  );

commit;
