begin;

-- Canonical V2 identity map. Legacy UUIDs remain valid inputs for old clients,
-- but every operational write is normalized to the V2 master UUID.
create table if not exists public.nomenclature_v2_aliases (
  legacy_id uuid primary key,
  canonical_id uuid not null references public.nomenclatures_v2(id) on delete restrict,
  match_basis text not null default 'legacy_name',
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);

-- Promote legacy-only catalog rows into V2 without changing their UUID. Rows
-- whose name already exists in V2 are aliases and are not duplicated.
insert into public.nomenclatures_v2 (
  id, code, name, group_id, unit, rule_type, rule_params, status,
  barcode, qr_code, created_at, updated_at
)
select
  v1.id,
  'LEGACY-' || upper(substr(replace(v1.id::text, '-', ''), 1, 20)),
  v1.name,
  case
    when v1.type in ('product', 'finished') then 'cat_fg'
    when v1.type = 'part' then 'cat_parts'
    when lower(coalesce(v1.name, '')) like '%фрез%' then 'grp_mills'
    else 'cat_raw'
  end,
  coalesce(nullif(btrim(v1.unit), ''), 'шт'),
  case
    when v1.type in ('product', 'finished') then 'full_frame'
    when v1.type = 'part' then 'frame_part'
    when lower(coalesce(v1.name, '')) like '%фрез%' then 'mill'
    else 'generic'
  end,
  jsonb_strip_nulls(jsonb_build_object(
    'legacyV1Id', v1.id,
    'unitsPerSheet', coalesce(v1.units_per_sheet, 1),
    'materialType', v1.material_type,
    'description', v1.description,
    'additionalInfo', v1.additional_info,
    'characteristic', v1.characteristic
  )),
  case when v1.type = 'archived' then 'archived' else 'active' end,
  'LEGACY-' || upper(substr(replace(v1.id::text, '-', ''), 1, 20)),
  'LEGACY-' || upper(substr(replace(v1.id::text, '-', ''), 1, 20)),
  coalesce(v1.created_at, clock_timestamp()),
  clock_timestamp()
from public.nomenclatures v1
where not exists (select 1 from public.nomenclatures_v2 v2 where v2.id = v1.id)
  and not exists (
    select 1
      from public.nomenclatures_v2 v2
     where lower(btrim(v2.name)) = lower(btrim(v1.name))
  )
on conflict (id) do nothing;

-- Map every old UUID to one deterministic V2 row. An exact UUID wins; otherwise
-- the unique normalized name match is used.
insert into public.nomenclature_v2_aliases (
  legacy_id, canonical_id, match_basis, updated_at
)
select
  v1.id,
  coalesce(same_id.id, same_name.id),
  case when same_id.id is not null then 'same_id' else 'normalized_name' end,
  clock_timestamp()
from public.nomenclatures v1
left join lateral (
  select v2.id
    from public.nomenclatures_v2 v2
   where v2.id = v1.id
   limit 1
) same_id on true
left join lateral (
  select v2.id
    from public.nomenclatures_v2 v2
   where lower(btrim(v2.name)) = lower(btrim(v1.name))
   order by v2.created_at, v2.id
   limit 1
) same_name on true
where coalesce(same_id.id, same_name.id) is not null
on conflict (legacy_id) do update
set canonical_id = excluded.canonical_id,
    match_basis = excluded.match_basis,
    updated_at = clock_timestamp();

insert into public.nomenclature_v2_aliases (
  legacy_id, canonical_id, match_basis, updated_at
)
select id, id, 'v2_self', clock_timestamp()
from public.nomenclatures_v2
on conflict (legacy_id) do update
set canonical_id = excluded.canonical_id,
    match_basis = excluded.match_basis,
    updated_at = clock_timestamp();

create or replace function public.resolve_nomenclature_v2_id(p_id uuid)
returns uuid
language sql
stable
security definer
set search_path = pg_catalog, public
as $resolve$
  select coalesce(
    (select a.canonical_id from public.nomenclature_v2_aliases a where a.legacy_id = p_id),
    (select v.id from public.nomenclatures_v2 v where v.id = p_id),
    p_id
  )
$resolve$;

-- Keep a read-compatible V1 shadow for old reports while V2 remains the master.
insert into public.nomenclatures (
  id, name, type, unit, material_type, units_per_sheet, additional_info, created_at
)
select
  v2.id,
  v2.name,
  case
    when v2.status = 'archived' then 'archived'
    when v2.rule_type = 'full_frame' or v2.group_id in ('cat_fg', 'grp_production_frames') then 'product'
    when v2.rule_type = 'frame_part' or v2.group_id = 'cat_parts' then 'part'
    when v2.rule_type = 'mill' or v2.group_id = 'grp_mills' then 'consumable'
    else 'raw'
  end,
  coalesce(nullif(btrim(v2.unit), ''), 'шт'),
  coalesce(v2.rule_params ->> 'materialType', v2.rule_params ->> 'rawSheet'),
  case
    when coalesce(v2.rule_params ->> 'unitsPerSheet', v2.rule_params ->> 'units_per_sheet', '') ~ '^[0-9]+([.][0-9]+)?$'
      then coalesce(v2.rule_params ->> 'unitsPerSheet', v2.rule_params ->> 'units_per_sheet')::numeric
    else 1
  end,
  v2.rule_params ->> 'additionalInfo',
  coalesce(v2.created_at, clock_timestamp())
from public.nomenclatures_v2 v2
where not exists (select 1 from public.nomenclatures v1 where v1.id = v2.id)
on conflict (id) do nothing;

create or replace function public.sync_nomenclature_v2_to_legacy_shadow()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $sync_v2_to_v1$
begin
  insert into public.nomenclatures (
    id, name, type, unit, material_type, units_per_sheet, additional_info, created_at
  ) values (
    new.id,
    new.name,
    case
      when new.status = 'archived' then 'archived'
      when new.rule_type = 'full_frame' or new.group_id in ('cat_fg', 'grp_production_frames') then 'product'
      when new.rule_type = 'frame_part' or new.group_id = 'cat_parts' then 'part'
      when new.rule_type = 'mill' or new.group_id = 'grp_mills' then 'consumable'
      else 'raw'
    end,
    coalesce(nullif(btrim(new.unit), ''), 'шт'),
    coalesce(new.rule_params ->> 'materialType', new.rule_params ->> 'rawSheet'),
    case
      when coalesce(new.rule_params ->> 'unitsPerSheet', new.rule_params ->> 'units_per_sheet', '') ~ '^[0-9]+([.][0-9]+)?$'
        then coalesce(new.rule_params ->> 'unitsPerSheet', new.rule_params ->> 'units_per_sheet')::numeric
      else 1
    end,
    new.rule_params ->> 'additionalInfo',
    coalesce(new.created_at, clock_timestamp())
  )
  on conflict (id) do update
  set name = excluded.name,
      type = excluded.type,
      unit = excluded.unit,
      material_type = excluded.material_type,
      units_per_sheet = excluded.units_per_sheet,
      additional_info = excluded.additional_info;

  insert into public.nomenclature_v2_aliases (
    legacy_id, canonical_id, match_basis, updated_at
  ) values (new.id, new.id, 'v2_self', clock_timestamp())
  on conflict (legacy_id) do update
  set canonical_id = excluded.canonical_id,
      match_basis = excluded.match_basis,
      updated_at = clock_timestamp();
  return new;
end;
$sync_v2_to_v1$;

create or replace function public.sync_legacy_nomenclature_to_v2()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $sync_v1_to_v2$
declare
  v_canonical_id uuid;
begin
  select v2.id into v_canonical_id
    from public.nomenclatures_v2 v2
   where v2.id = new.id
      or lower(btrim(v2.name)) = lower(btrim(new.name))
   order by case when v2.id = new.id then 0 else 1 end, v2.created_at, v2.id
   limit 1;

  if v_canonical_id is null then
    insert into public.nomenclatures_v2 (
      id, code, name, group_id, unit, rule_type, rule_params, status,
      barcode, qr_code, created_at, updated_at
    ) values (
      new.id,
      'LEGACY-' || upper(substr(replace(new.id::text, '-', ''), 1, 20)),
      new.name,
      case
        when new.type in ('product', 'finished') then 'cat_fg'
        when new.type = 'part' then 'cat_parts'
        when lower(coalesce(new.name, '')) like '%фрез%' then 'grp_mills'
        else 'cat_raw'
      end,
      coalesce(nullif(btrim(new.unit), ''), 'шт'),
      case
        when new.type in ('product', 'finished') then 'full_frame'
        when new.type = 'part' then 'frame_part'
        when lower(coalesce(new.name, '')) like '%фрез%' then 'mill'
        else 'generic'
      end,
      jsonb_strip_nulls(jsonb_build_object(
        'legacyV1Id', new.id,
        'unitsPerSheet', coalesce(new.units_per_sheet, 1),
        'materialType', new.material_type,
        'additionalInfo', new.additional_info,
        'characteristic', new.characteristic
      )),
      case when new.type = 'archived' then 'archived' else 'active' end,
      'LEGACY-' || upper(substr(replace(new.id::text, '-', ''), 1, 20)),
      'LEGACY-' || upper(substr(replace(new.id::text, '-', ''), 1, 20)),
      coalesce(new.created_at, clock_timestamp()),
      clock_timestamp()
    ) returning id into v_canonical_id;
  end if;

  insert into public.nomenclature_v2_aliases (
    legacy_id, canonical_id, match_basis, updated_at
  ) values (
    new.id,
    v_canonical_id,
    case when new.id = v_canonical_id then 'same_id' else 'normalized_name' end,
    clock_timestamp()
  )
  on conflict (legacy_id) do update
  set canonical_id = excluded.canonical_id,
      match_basis = excluded.match_basis,
      updated_at = clock_timestamp();
  return new;
end;
$sync_v1_to_v2$;

drop trigger if exists trg_sync_nomenclature_v2_to_legacy_shadow on public.nomenclatures_v2;
create trigger trg_sync_nomenclature_v2_to_legacy_shadow
after insert or update of name, group_id, unit, rule_type, rule_params, status
on public.nomenclatures_v2
for each row execute function public.sync_nomenclature_v2_to_legacy_shadow();

drop trigger if exists trg_sync_legacy_nomenclature_to_v2 on public.nomenclatures;
create trigger trg_sync_legacy_nomenclature_to_v2
after insert on public.nomenclatures
for each row execute function public.sync_legacy_nomenclature_to_v2();

-- Remove operational foreign keys that still point to V1 before re-keying.
do $drop_legacy_operational_fks$
declare
  r record;
  v_tables text[] := array[
    'orders', 'order_items', 'work_cards', 'work_card_history',
    'work_card_history_backup_pre_partition', 'inventory', 'material_requests',
    'machine_operations', 'packaging_boxes', 'scrap_classifications',
    'work_card_scrap_totals', 'work_card_flow_totals', 'vkya_restoration_cards',
    'vkya_restoration_reclassifications', 'vkya_restoration_reclassification',
    'vkya_quality_hold_events', 'quality_hold_events', 'cutter_restoration_batches',
    'manual_inventory_issues', 'bz_inventory_reservations', 'bz_inventory_ledger',
    'inventory_stock_v2', 'replenishment_requests', 'nomenclature_prices'
  ];
begin
  for r in
    select c.conrelid::regclass as table_ref, c.conname
      from pg_constraint c
     where c.contype = 'f'
       and c.confrelid = 'public.nomenclatures'::regclass
       and c.conrelid in (
         select to_regclass('public.' || names.table_name)
           from unnest(v_tables) as names(table_name)
       )
  loop
    execute format('alter table %s drop constraint %I', r.table_ref, r.conname);
  end loop;
end;
$drop_legacy_operational_fks$;

-- Canonicalize every operational nomenclature_id without touching business
-- quantities, statuses, timestamps or document identifiers.
do $canonicalize_operational_ids$
declare
  v_table text;
  v_tables text[] := array[
    'orders', 'order_items', 'work_cards', 'work_card_history',
    'work_card_history_backup_pre_partition', 'inventory', 'material_requests',
    'machine_operations', 'packaging_boxes', 'scrap_classifications',
    'work_card_scrap_totals', 'work_card_flow_totals', 'vkya_restoration_cards',
    'vkya_restoration_reclassifications', 'vkya_restoration_reclassification',
    'vkya_quality_hold_events', 'quality_hold_events', 'cutter_restoration_batches',
    'manual_inventory_issues', 'bz_inventory_reservations', 'bz_inventory_ledger',
    'inventory_stock_v2', 'replenishment_requests', 'nomenclature_prices'
  ];
begin
  foreach v_table in array v_tables loop
    if to_regclass('public.' || v_table) is not null
       and exists (
         select 1 from information_schema.columns
          where table_schema = 'public'
            and table_name = v_table
            and column_name = 'nomenclature_id'
       ) then
      execute format(
        'update public.%I t set nomenclature_id = a.canonical_id from public.nomenclature_v2_aliases a where t.nomenclature_id = a.legacy_id and t.nomenclature_id is distinct from a.canonical_id',
        v_table
      );
    end if;
  end loop;
end;
$canonicalize_operational_ids$;

-- Repair the only catalog-less historical package from order 01072026-02.
update public.packaging_boxes b
   set nomenclature_id = o.nomenclature_id
  from public.orders o
 where b.id = 'd7326d00-7bcc-4486-b7a0-bc0377540c9e'::uuid
   and b.order_id = o.id
   and not exists (
     select 1 from public.nomenclatures_v2 v2 where v2.id = b.nomenclature_id
   );

-- BOM is already V2, but normalize any legacy aliases that arrive from old plans.
update public.bom_items b
   set parent_id = a.canonical_id
  from public.nomenclature_v2_aliases a
 where b.parent_id = a.legacy_id
   and b.parent_id is distinct from a.canonical_id;

update public.bom_items b
   set child_id = a.canonical_id
  from public.nomenclature_v2_aliases a
 where b.child_id = a.legacy_id
   and b.child_id is distinct from a.canonical_id;

-- Rename root UUID keys in task plans. Nested snapshots remain historical and
-- operational readers resolve them through nomenclature_v2_aliases.
do $canonicalize_task_plan_keys$
declare
  a record;
begin
  for a in
    select legacy_id, canonical_id
      from public.nomenclature_v2_aliases
     where legacy_id is distinct from canonical_id
  loop
    update public.tasks t
       set plan_snapshot =
         jsonb_build_object(
           a.canonical_id::text,
           jsonb_set(
             t.plan_snapshot -> a.legacy_id::text,
             '{id}',
             to_jsonb(a.canonical_id::text),
             true
           )
         ) || (t.plan_snapshot - a.legacy_id::text)
     where t.plan_snapshot is not null
       and jsonb_typeof(t.plan_snapshot) = 'object'
       and t.plan_snapshot ? a.legacy_id::text;
  end loop;
end;
$canonicalize_task_plan_keys$;

create or replace function public.canonicalize_operational_nomenclature_id()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $canonicalize_row$
begin
  if new.nomenclature_id is not null then
    new.nomenclature_id := public.resolve_nomenclature_v2_id(new.nomenclature_id);
  end if;
  return new;
end;
$canonicalize_row$;

create or replace function public.canonicalize_bom_nomenclature_ids()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $canonicalize_bom$
begin
  if new.parent_id is not null then
    new.parent_id := public.resolve_nomenclature_v2_id(new.parent_id);
  end if;
  if new.child_id is not null then
    new.child_id := public.resolve_nomenclature_v2_id(new.child_id);
  end if;
  return new;
end;
$canonicalize_bom$;

-- Install normalization guards and V2 FKs on every operational root table.
do $install_v2_guards$
declare
  v_relation regclass;
  v_table text;
  v_constraint text;
  v_relkind text;
  v_has_column boolean;
  v_has_v2_fk boolean;
  v_existing_fk record;
  v_tables text[] := array[
    'orders', 'order_items', 'work_cards', 'work_card_history',
    'work_card_history_backup_pre_partition', 'inventory', 'material_requests',
    'machine_operations', 'packaging_boxes', 'scrap_classifications',
    'work_card_scrap_totals', 'work_card_flow_totals', 'vkya_restoration_cards',
    'vkya_restoration_reclassifications', 'vkya_restoration_reclassification',
    'vkya_quality_hold_events', 'quality_hold_events', 'cutter_restoration_batches',
    'manual_inventory_issues', 'bz_inventory_reservations', 'bz_inventory_ledger',
    'inventory_stock_v2', 'replenishment_requests', 'nomenclature_prices'
  ];
begin
  foreach v_table in array v_tables loop
    v_relation := to_regclass('public.' || quote_ident(v_table));
    if v_relation is null then
      continue;
    end if;

    select exists (
      select 1
        from pg_attribute a
       where a.attrelid = v_relation
         and a.attname = 'nomenclature_id'
         and a.attnum > 0
         and not a.attisdropped
    ) into v_has_column;
    if not v_has_column then
      continue;
    end if;

    select c.relkind::text into v_relkind from pg_class c where c.oid = v_relation;

    -- Only physical and partitioned tables can receive row triggers/FKs.
    if v_relkind not in ('r', 'p') then
      continue;
    end if;

    execute format('drop trigger if exists trg_canonicalize_nomenclature_v2 on %s', v_relation);
    execute format(
      'create trigger trg_canonicalize_nomenclature_v2 before insert or update of nomenclature_id on %s for each row execute function public.canonicalize_operational_nomenclature_id()',
      v_relation
    );

    select exists (
      select 1
        from pg_constraint c
        join pg_attribute att
          on att.attrelid = c.conrelid
         and att.attnum = any(c.conkey)
       where c.contype = 'f'
         and c.conrelid = v_relation
         and c.confrelid = 'public.nomenclatures_v2'::regclass
         and att.attname = 'nomenclature_id'
    ) into v_has_v2_fk;

    if not v_has_v2_fk then
      v_constraint := left(v_table || '_nomenclature_id_v2_fkey', 63);
        -- A previous repair may have left a constraint with this name that
        -- points to V1, another column, or is otherwise not the V2 FK detected
        -- above. Reusing the migration must therefore free the exact name.
        execute format(
          'alter table %s drop constraint if exists %I',
          v_relation,
          v_constraint
        );

      if v_relkind = 'p' then
          -- PostgreSQL does not support NOT VALID foreign keys on partitioned
          -- tables. Create this FK as validated in one operation.
          execute format(
            'alter table %s add constraint %I foreign key (nomenclature_id) references public.nomenclatures_v2(id) on delete restrict',
            v_relation,
            v_constraint
          );
      else
          execute format(
            'alter table %s add constraint %I foreign key (nomenclature_id) references public.nomenclatures_v2(id) on delete restrict not valid',
            v_relation,
            v_constraint
          );
          execute format('alter table %s validate constraint %I', v_relation, v_constraint);
      end if;
    end if;

    for v_existing_fk in
        select c.conname
          from pg_constraint c
          join pg_attribute att
            on att.attrelid = c.conrelid
           and att.attnum = any(c.conkey)
         where c.contype = 'f'
           and c.conrelid = v_relation
           and c.confrelid = 'public.nomenclatures_v2'::regclass
           and att.attname = 'nomenclature_id'
           and not c.convalidated
    loop
      execute format(
        'alter table %s validate constraint %I',
        v_relation,
        v_existing_fk.conname
      );
    end loop;
  end loop;
end;
$install_v2_guards$;

drop trigger if exists trg_canonicalize_bom_nomenclature_v2 on public.bom_items;
create trigger trg_canonicalize_bom_nomenclature_v2
before insert or update of parent_id, child_id on public.bom_items
for each row execute function public.canonicalize_bom_nomenclature_ids();

-- Read-only post-deployment integrity audit used by support and CI smoke checks.
create or replace function public.audit_nomenclature_v2_integrity()
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $audit$
declare
  r record;
  v_non_v2 bigint;
  v_total bigint;
  v_refs jsonb := '[]'::jsonb;
  v_legacy_fk_count bigint;
  v_bom_non_v2 bigint;
  v_task_snapshot_non_v2 bigint;
begin
  for r in
    select c.table_name, c.column_name
      from information_schema.columns c
     where c.table_schema = 'public'
       and c.column_name = 'nomenclature_id'
       and c.table_name not in (
         'nomenclatures', 'nomenclatures_v2', 'nomenclature_v2_aliases',
         'nomenclature_catalog_profiles', 'nomenclature_attribute_values',
         'nomenclature_unit_conversions', 'nomenclature_catalog_history'
       )
     order by c.table_name
  loop
    execute format(
      'select count(*) filter (where nomenclature_id is not null), count(*) filter (where nomenclature_id is not null and not exists (select 1 from public.nomenclatures_v2 v2 where v2.id = t.nomenclature_id)) from public.%I t',
      r.table_name
    ) into v_total, v_non_v2;
    v_refs := v_refs || jsonb_build_object(
      'table', r.table_name,
      'column', r.column_name,
      'populated', v_total,
      'non_v2', v_non_v2
    );
  end loop;

  select count(*) into v_legacy_fk_count
    from pg_constraint c
   where c.contype = 'f'
     and c.confrelid = 'public.nomenclatures'::regclass
     and not exists (
       select 1
         from pg_class rel
         join pg_namespace ns on ns.oid = rel.relnamespace
        where rel.oid = c.conrelid
          and ns.nspname = 'public'
          and rel.relname in (
            'nomenclature_catalog_profiles', 'nomenclature_attribute_values',
            'nomenclature_unit_conversions', 'nomenclature_catalog_history'
          )
     );

  select count(*) into v_bom_non_v2
    from public.bom_items b
   where not exists (select 1 from public.nomenclatures_v2 v2 where v2.id = b.parent_id)
      or not exists (select 1 from public.nomenclatures_v2 v2 where v2.id = b.child_id);

  select count(*) into v_task_snapshot_non_v2
    from public.tasks t
    cross join lateral jsonb_object_keys(
      case when jsonb_typeof(t.plan_snapshot) = 'object' then t.plan_snapshot else '{}'::jsonb end
    ) as snapshot_key(value)
   where t.plan_snapshot is not null
     and jsonb_typeof(t.plan_snapshot) = 'object'
     and snapshot_key.value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     and not exists (
       select 1 from public.nomenclatures_v2 v2
        where v2.id = snapshot_key.value::uuid
     );

  return jsonb_build_object(
    'catalog_v2_rows', (select count(*) from public.nomenclatures_v2),
    'alias_rows', (select count(*) from public.nomenclature_v2_aliases),
    'legacy_operational_foreign_keys', v_legacy_fk_count,
    'bom_rows_with_non_v2_ids', v_bom_non_v2,
    'task_snapshot_non_v2_uuid_keys', v_task_snapshot_non_v2,
    'references', v_refs
  );
end;
$audit$;

revoke all on function public.resolve_nomenclature_v2_id(uuid) from public;
grant execute on function public.resolve_nomenclature_v2_id(uuid) to anon, authenticated, service_role;
revoke all on function public.audit_nomenclature_v2_integrity() from public;
grant execute on function public.audit_nomenclature_v2_integrity() to authenticated, service_role;

commit;

-- Supabase SQL Editor displays this final report after a successful cutover.
select public.audit_nomenclature_v2_integrity();
