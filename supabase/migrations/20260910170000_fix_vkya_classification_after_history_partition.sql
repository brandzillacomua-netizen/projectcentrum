begin;

-- The work_card_history partition swap renamed the former table to
-- work_card_history_backup_pre_partition. Foreign keys created before the swap
-- continued to reference that backup table, so every new VKYA history ID was
-- rejected even though it existed in the current partitioned history.
do $drop_legacy_history_fks$
declare
  v_constraint record;
  v_backup regclass := to_regclass('public.work_card_history_backup_pre_partition');
begin
  if v_backup is null then
    return;
  end if;

  for v_constraint in
    select conrelid::regclass as table_name, conname
      from pg_constraint
     where contype = 'f'
       and confrelid = v_backup
  loop
    execute format(
      'alter table %s drop constraint if exists %I',
      v_constraint.table_name,
      v_constraint.conname
    );
  end loop;
end;
$drop_legacy_history_fks$;

-- A client-generated key makes a network retry return the original result
-- instead of recording the same classification and inventory movement twice.
create table if not exists public.mes_scrap_classification_receipts (
  idempotency_key uuid primary key,
  classification_id uuid not null references public.scrap_classifications(id) on delete cascade,
  recorded_at timestamptz not null default clock_timestamp()
);

alter table public.mes_scrap_classification_receipts enable row level security;
revoke all on table public.mes_scrap_classification_receipts from public, anon, authenticated;

create or replace function public.record_scrap_classification_atomic(
  p_idempotency_key uuid,
  p_source_history_id uuid,
  p_card_id uuid,
  p_task_id uuid,
  p_order_id uuid,
  p_nomenclature_id uuid,
  p_order_number text,
  p_card_sequence integer,
  p_source_operator_name text,
  p_source_stage_name text,
  p_source_machine_name text,
  p_quantity integer,
  p_classified_by_user_id bigint,
  p_classified_by_name text,
  p_categories jsonb,
  p_reasons jsonb,
  p_notes text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = pg_catalog, public
as $classification_atomic$
declare
  v_classification_id uuid;
  v_category jsonb;
  v_category_number integer;
  v_category_qty numeric;
begin
  if p_idempotency_key is null then
    raise exception 'idempotency_key is required' using errcode = '22004';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_idempotency_key::text, 0));

  select classification_id into v_classification_id
    from public.mes_scrap_classification_receipts
   where idempotency_key = p_idempotency_key;
  if found then
    return v_classification_id;
  end if;

  -- record_scrap_classification validates category/reason totals and the
  -- current history capacity through trg_validate_vkya_classification_capacity.
  v_classification_id := public.record_scrap_classification(
    p_source_history_id,
    p_card_id,
    p_task_id,
    p_order_id,
    p_nomenclature_id,
    p_order_number,
    p_card_sequence,
    p_source_operator_name,
    p_source_stage_name,
    p_source_machine_name,
    p_quantity,
    p_classified_by_user_id,
    p_classified_by_name,
    p_categories,
    p_reasons,
    p_notes
  );

  for v_category in
    select value from jsonb_array_elements(coalesce(p_categories, '[]'::jsonb))
  loop
    v_category_number := (v_category->>'category')::integer;
    v_category_qty := (v_category->>'quantity')::numeric;
    if v_category_number not between 1 and 4 then
      raise exception 'Invalid scrap category %', v_category_number using errcode = '22023';
    end if;
    if v_category_qty > 0 then
      perform public.rpc_increment_inventory_stock(
        p_nomenclature_id,
        v_category_qty,
        'scrap_cat_' || v_category_number::text,
        null,
        'шт'
      );
    end if;
  end loop;

  insert into public.mes_scrap_classification_receipts(idempotency_key, classification_id)
  values (p_idempotency_key, v_classification_id);

  return v_classification_id;
end;
$classification_atomic$;

revoke all on function public.record_scrap_classification_atomic(
  uuid, uuid, uuid, uuid, uuid, uuid, text, integer, text, text, text,
  integer, bigint, text, jsonb, jsonb, text
) from public;
grant execute on function public.record_scrap_classification_atomic(
  uuid, uuid, uuid, uuid, uuid, uuid, text, integer, text, text, text,
  integer, bigint, text, jsonb, jsonb, text
) to anon, authenticated, service_role;

comment on function public.record_scrap_classification_atomic(
  uuid, uuid, uuid, uuid, uuid, uuid, text, integer, text, text, text,
  integer, bigint, text, jsonb, jsonb, text
) is 'Atomically records a VKYA classification, its category/reason facts and inventory category balances exactly once.';

-- Reverse only the confirmed orphan inventory writes visible in the two VKYA
-- videos. No classification ledger rows exist for these attempts, so the
-- correct category quantities will be added once when the operators retry.
create table if not exists public.mes_vkya_balance_repair_receipts (
  repair_key text primary key,
  inventory_id uuid not null references public.inventory(id) on delete restrict,
  removed_qty numeric not null check (removed_qty > 0),
  repaired_at timestamptz not null default clock_timestamp()
);

revoke all on table public.mes_vkya_balance_repair_receipts from public, anon, authenticated;

do $repair_video_attempts$
declare
  v_row public.inventory%rowtype;
begin
  if not exists (
    select 1 from public.mes_vkya_balance_repair_receipts
     where repair_key = 'vkya-video-20260907-left-ray-cat1'
  ) then
    select * into v_row from public.inventory
     where id = 'd7f5f04f-bba5-4d18-a0bc-549646096bd6'::uuid for update;
    if v_row.total_qty is distinct from 8 then
      raise exception 'VKYA repair stopped: expected left-ray cat1 balance 8, found %', v_row.total_qty;
    end if;
    update public.inventory set total_qty = 0, updated_at = clock_timestamp() where id = v_row.id;
    insert into public.mes_vkya_balance_repair_receipts values (
      'vkya-video-20260907-left-ray-cat1', v_row.id, 8, clock_timestamp()
    );
  end if;

  if not exists (
    select 1 from public.mes_vkya_balance_repair_receipts
     where repair_key = 'vkya-video-20260907-left-ray-cat4'
  ) then
    select * into v_row from public.inventory
     where id = 'bb02ac2a-2f3a-434b-940e-42f415c1109a'::uuid for update;
    if v_row.total_qty is distinct from 4 then
      raise exception 'VKYA repair stopped: expected left-ray cat4 balance 4, found %', v_row.total_qty;
    end if;
    update public.inventory set total_qty = 0, updated_at = clock_timestamp() where id = v_row.id;
    insert into public.mes_vkya_balance_repair_receipts values (
      'vkya-video-20260907-left-ray-cat4', v_row.id, 4, clock_timestamp()
    );
  end if;

  if not exists (
    select 1 from public.mes_vkya_balance_repair_receipts
     where repair_key = 'vkya-video-20260907-crossbar-cat1'
  ) then
    select * into v_row from public.inventory
     where id = 'd982bf2a-e316-4991-a59d-8d4025d120e1'::uuid for update;
    if v_row.total_qty is distinct from 336 then
      raise exception 'VKYA repair stopped: expected crossbar cat1 balance 336, found %', v_row.total_qty;
    end if;
    update public.inventory set total_qty = 0, updated_at = clock_timestamp() where id = v_row.id;
    insert into public.mes_vkya_balance_repair_receipts values (
      'vkya-video-20260907-crossbar-cat1', v_row.id, 336, clock_timestamp()
    );
  end if;
end;
$repair_video_attempts$;

commit;
