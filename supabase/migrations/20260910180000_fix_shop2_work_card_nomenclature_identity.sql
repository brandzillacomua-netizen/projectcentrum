begin;

-- Shop 2 displayed the canonical V2 nomenclature code, but historical Shop 1
-- buffer cards still carried the matching V1 UUID. Since work_cards now points
-- to nomenclatures_v2, generating a Shop 2 card from such a buffer failed with
-- work_cards_nomenclature_id_fkey.
--
-- Only unambiguous, case-insensitive name matches are migrated. Quantities,
-- statuses and card IDs are untouched.
create temporary table mes_nomenclature_id_map on commit drop as
with unique_v1 as (
  select lower(btrim(name)) as normalized_name,
         (array_agg(id order by id))[1] as id
    from public.nomenclatures
   where nullif(btrim(name), '') is not null
   group by lower(btrim(name))
  having count(*) = 1
),
unique_v2 as (
  select lower(btrim(name)) as normalized_name,
         (array_agg(id order by id))[1] as id
    from public.nomenclatures_v2
   where nullif(btrim(name), '') is not null
   group by lower(btrim(name))
  having count(*) = 1
)
select v1.id as legacy_id,
       v2.id as canonical_id
  from unique_v1 v1
  join unique_v2 v2 using (normalized_name)
 where v1.id is distinct from v2.id;

create unique index on mes_nomenclature_id_map (legacy_id);

-- Re-key the physical cards first. This includes the source cards currently in
-- the Shop 2 buffer, so the atomic allocator can find and debit them normally.
update public.work_cards wc
   set nomenclature_id = m.canonical_id
  from mes_nomenclature_id_map m
 where wc.nomenclature_id = m.legacy_id;

-- Keep the active audit history on the same canonical identity as its card.
update public.work_card_history h
   set nomenclature_id = m.canonical_id
  from mes_nomenclature_id_map m
 where h.nomenclature_id = m.legacy_id;

-- The pre-partition backup may still exist on installations that completed the
-- zero-downtime history migration. It is historical data, but keeping its
-- nomenclature identity aligned prevents future repair scripts from restoring
-- obsolete IDs.
do $repair_history_backup$
begin
  if to_regclass('public.work_card_history_backup_pre_partition') is not null then
    execute $sql$
      update public.work_card_history_backup_pre_partition h
         set nomenclature_id = m.canonical_id
        from mes_nomenclature_id_map m
       where h.nomenclature_id = m.legacy_id
    $sql$;
  end if;
end;
$repair_history_backup$;

-- Historical task plans use nomenclature UUIDs as top-level JSON keys. Rename
-- those keys too, preserving every planning field and preferring an existing
-- canonical entry if both keys are already present.
do $repair_task_snapshots$
declare
  m record;
begin
  for m in
    select legacy_id, canonical_id
      from mes_nomenclature_id_map
  loop
    update public.tasks t
       set plan_snapshot =
         jsonb_build_object(
           m.canonical_id::text,
           jsonb_set(
             t.plan_snapshot -> m.legacy_id::text,
             '{id}',
             to_jsonb(m.canonical_id::text),
             true
           )
         ) || (t.plan_snapshot - m.legacy_id::text)
     where t.plan_snapshot is not null
       and jsonb_typeof(t.plan_snapshot) = 'object'
       and t.plan_snapshot ? m.legacy_id::text;
  end loop;
end;
$repair_task_snapshots$;

-- Fail the migration instead of silently claiming success if the affected
-- Drozd beam is not canonical after the repair.
do $verify_shop2_identity$
begin
  if exists (
    select 1
      from public.work_cards wc
      join public.nomenclatures v1 on v1.id = wc.nomenclature_id
     where lower(btrim(v1.name)) = lower(btrim('RND-87-Drozd 9"-Промінь-10-60'))
       and not exists (
         select 1
           from public.nomenclatures_v2 v2
          where v2.id = wc.nomenclature_id
       )
  ) then
    raise exception 'Shop 2 nomenclature identity repair did not complete';
  end if;
end;
$verify_shop2_identity$;

commit;
