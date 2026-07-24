-- Incremental, cache-friendly VKYA classification queue.
-- The projection turns the append-heavy production history into a small
-- operational read model with a monotonic cursor and tombstones.

create sequence if not exists public.vkya_classification_queue_change_seq;

create index if not exists scrap_classifications_source_history_idx
  on public.scrap_classifications (source_history_id)
  where source_history_id is not null;

create table if not exists public.vkya_classification_queue_projection (
  source_type text not null check (source_type in ('history', 'restoration_return')),
  source_id uuid not null,
  payload jsonb not null,
  is_active boolean not null,
  change_seq bigint not null default nextval('public.vkya_classification_queue_change_seq'),
  changed_at timestamptz not null default clock_timestamp(),
  primary key (source_type, source_id)
);

create index if not exists vkya_queue_projection_active_idx
  on public.vkya_classification_queue_projection (is_active, change_seq);
create index if not exists vkya_queue_projection_change_idx
  on public.vkya_classification_queue_projection (change_seq);

alter table public.vkya_classification_queue_projection enable row level security;
revoke all on table public.vkya_classification_queue_projection from public;
grant select on public.vkya_classification_queue_projection to anon, authenticated;
drop policy if exists "vkya_queue_projection_realtime_read"
  on public.vkya_classification_queue_projection;
create policy "vkya_queue_projection_realtime_read"
  on public.vkya_classification_queue_projection
  for select to anon, authenticated using (true);

create or replace function public.sync_vkya_history_queue_projection()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $projection$
declare
  v_classified numeric;
  v_ready boolean;
begin
  select coalesce(sum(quantity), 0)
  into v_classified
  from public.scrap_classifications
  where source_history_id = new.id;

  v_ready := coalesce(new.scrap_qty, 0) > v_classified
    and (
      coalesce(new.is_archived_scrap, false)
      or coalesce(new.card_info, '') like '%[ЦЕХ №2]%'
    );

  insert into public.vkya_classification_queue_projection (
    source_type, source_id, payload, is_active, change_seq, changed_at
  ) values (
    'history',
    new.id,
    to_jsonb(new) || jsonb_build_object('classified_quantity', v_classified),
    v_ready,
    nextval('public.vkya_classification_queue_change_seq'),
    clock_timestamp()
  )
  on conflict (source_type, source_id) do update set
    payload = excluded.payload,
    is_active = excluded.is_active,
    change_seq = excluded.change_seq,
    changed_at = excluded.changed_at;
  return new;
end;
$projection$;

create or replace function public.sync_vkya_projection_after_classification()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $classification$
declare
  v_history public.work_card_history%rowtype;
  v_classified numeric;
begin
  if new.source_history_id is null then return new; end if;
  select * into v_history from public.work_card_history where id = new.source_history_id;
  if not found then return new; end if;
  select coalesce(sum(quantity), 0) into v_classified
  from public.scrap_classifications where source_history_id = new.source_history_id;

  insert into public.vkya_classification_queue_projection (
    source_type, source_id, payload, is_active, change_seq, changed_at
  ) values (
    'history', v_history.id,
    to_jsonb(v_history) || jsonb_build_object('classified_quantity', v_classified),
    coalesce(v_history.scrap_qty, 0) > v_classified
      and (coalesce(v_history.is_archived_scrap, false) or coalesce(v_history.card_info, '') like '%[ЦЕХ №2]%'),
    nextval('public.vkya_classification_queue_change_seq'), clock_timestamp()
  )
  on conflict (source_type, source_id) do update set
    payload = excluded.payload, is_active = excluded.is_active,
    change_seq = excluded.change_seq, changed_at = excluded.changed_at;
  return new;
end;
$classification$;

create or replace function public.sync_vkya_return_queue_projection()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $return_projection$
begin
  insert into public.vkya_classification_queue_projection (
    source_type, source_id, payload, is_active, change_seq, changed_at
  ) values (
    'restoration_return', new.id, to_jsonb(new),
    new.status = 'pending' and coalesce(new.quantity, 0) > coalesce(new.classified_quantity, 0),
    nextval('public.vkya_classification_queue_change_seq'), clock_timestamp()
  )
  on conflict (source_type, source_id) do update set
    payload = excluded.payload, is_active = excluded.is_active,
    change_seq = excluded.change_seq, changed_at = excluded.changed_at;
  return new;
end;
$return_projection$;

drop trigger if exists trg_vkya_history_queue_projection on public.work_card_history;
create trigger trg_vkya_history_queue_projection
after insert or update of scrap_qty, qc_scrap_comment, is_archived_scrap, card_info
on public.work_card_history
for each row execute function public.sync_vkya_history_queue_projection();

drop trigger if exists trg_vkya_projection_after_classification on public.scrap_classifications;
create trigger trg_vkya_projection_after_classification
after insert on public.scrap_classifications
for each row execute function public.sync_vkya_projection_after_classification();

drop trigger if exists trg_vkya_return_queue_projection on public.vkya_reclassification_queue;
create trigger trg_vkya_return_queue_projection
after insert or update of status, quantity, classified_quantity, updated_at
on public.vkya_reclassification_queue
for each row execute function public.sync_vkya_return_queue_projection();

-- Seed only records that can currently appear in the operational queue.
insert into public.vkya_classification_queue_projection (
  source_type, source_id, payload, is_active
)
select
  'history', h.id,
  to_jsonb(h) || jsonb_build_object(
    'classified_quantity',
    coalesce((select sum(c.quantity) from public.scrap_classifications c where c.source_history_id = h.id), 0)
  ),
  true
from public.work_card_history h
where coalesce(h.scrap_qty, 0) >
  coalesce((select sum(c.quantity) from public.scrap_classifications c where c.source_history_id = h.id), 0)
and (coalesce(h.is_archived_scrap, false) or coalesce(h.card_info, '') like '%[ЦЕХ №2]%')
on conflict (source_type, source_id) do update set
  payload = excluded.payload, is_active = true,
  change_seq = nextval('public.vkya_classification_queue_change_seq'),
  changed_at = clock_timestamp();

insert into public.vkya_classification_queue_projection (
  source_type, source_id, payload, is_active
)
select 'restoration_return', q.id, to_jsonb(q), true
from public.vkya_reclassification_queue q
where q.status = 'pending' and coalesce(q.quantity, 0) > coalesce(q.classified_quantity, 0)
on conflict (source_type, source_id) do update set
  payload = excluded.payload, is_active = true,
  change_seq = nextval('public.vkya_classification_queue_change_seq'),
  changed_at = clock_timestamp();

create or replace function public.vkya_classification_queue_changes(p_after_seq bigint default null)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public
as $changes$
  with cursor_value as (
    select coalesce(max(change_seq), 0) as value
    from public.vkya_classification_queue_projection
  ),
  selected as (
    select source_type, source_id, payload, is_active, change_seq, changed_at
    from public.vkya_classification_queue_projection
    where case
      when p_after_seq is null then is_active
      else change_seq > p_after_seq
    end
    order by change_seq
  )
  select jsonb_build_object(
    'cursor', (select value from cursor_value),
    'changes', coalesce(jsonb_agg(to_jsonb(selected)), '[]'::jsonb)
  )
  from selected;
$changes$;

revoke all on function public.vkya_classification_queue_changes(bigint) from public;
grant execute on function public.vkya_classification_queue_changes(bigint) to anon, authenticated;

do $publication$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1
       from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'vkya_classification_queue_projection'
     ) then
    alter publication supabase_realtime add table public.vkya_classification_queue_projection;
  end if;
end;
$publication$;
