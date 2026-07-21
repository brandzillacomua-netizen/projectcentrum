-- Guaranteed, idempotent delivery of Shop 1 sorting scrap to the VKYA queue.
--
-- The legacy clients wrote the card, inventory, Shop 2 arrival and history in
-- parallel HTTP requests. A transient failure could advance the card while the
-- work_card_history insert (the VKYA source) was lost. This receipt makes the
-- two sorting history rows one atomic database operation and prevents a retry
-- from duplicating scrap for the same card.

create table if not exists public.mes_sorting_history_receipts (
  card_id uuid primary key references public.work_cards(id) on delete cascade,
  sorting_history_id uuid references public.work_card_history(id) on delete restrict,
  buffer_history_id uuid references public.work_card_history(id) on delete restrict,
  scrap_qty numeric not null check (scrap_qty >= 0),
  recorded_at timestamptz not null default clock_timestamp()
);

alter table public.mes_sorting_history_receipts enable row level security;
revoke all on table public.mes_sorting_history_receipts from public;
revoke all on table public.mes_sorting_history_receipts from anon, authenticated;

comment on table public.mes_sorting_history_receipts is
  'Internal idempotency receipts for atomic Sorting/VKYA history delivery.';

create or replace function public.record_sorting_history_once(
  p_card_id uuid,
  p_nomenclature_id uuid,
  p_operator_name text,
  p_buffer_operator_name text,
  p_shift_name text,
  p_qty_at_start numeric,
  p_qty_completed numeric,
  p_scrap_qty numeric,
  p_started_at timestamptz,
  p_stage_completed_at timestamptz,
  p_buffer_completed_at timestamptz,
  p_manager_name text default null,
  p_machine_name text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, public
as $sorting_delivery$
declare
  v_receipt public.mes_sorting_history_receipts%rowtype;
  v_sorting_history_id uuid;
  v_buffer_history_id uuid;
  v_card public.work_cards%rowtype;
begin
  if p_card_id is null or p_nomenclature_id is null then
    raise exception 'card_id and nomenclature_id are required' using errcode = '22004';
  end if;
  if coalesce(p_qty_at_start, 0) < 0
     or coalesce(p_qty_completed, 0) < 0
     or coalesce(p_scrap_qty, 0) < 0 then
    raise exception 'sorting quantities cannot be negative' using errcode = '22003';
  end if;
  if coalesce(p_qty_completed, 0) + coalesce(p_scrap_qty, 0) > coalesce(p_qty_at_start, 0) then
    raise exception 'completed plus scrap quantity exceeds starting quantity' using errcode = '22003';
  end if;

  -- Serialize competing retries for the same card and validate that callers
  -- cannot attach a VKYA record to an unrelated nomenclature.
  select * into v_card
    from public.work_cards
   where id = p_card_id
   for update;
  if not found then
    raise exception 'work card % does not exist', p_card_id using errcode = 'P0002';
  end if;
  if v_card.nomenclature_id is distinct from p_nomenclature_id then
    raise exception 'nomenclature mismatch for work card %', p_card_id using errcode = '22023';
  end if;
  if v_card.operation is distinct from 'Сортування'
     or v_card.status not in ('in-progress', 'at-buffer', 'at-shop2-buffer') then
    raise exception 'work card % is not in a sortable state (% / %)', p_card_id, v_card.operation, v_card.status
      using errcode = '55000';
  end if;

  select * into v_receipt
    from public.mes_sorting_history_receipts
   where card_id = p_card_id;
  if found then
    if v_receipt.scrap_qty is distinct from coalesce(p_scrap_qty, 0) then
      raise exception 'sorting retry for card % has a different scrap quantity', p_card_id
        using errcode = '22023';
    end if;
    return jsonb_build_object(
      'created', false,
      'sortingHistoryId', v_receipt.sorting_history_id,
      'bufferHistoryId', v_receipt.buffer_history_id,
      'scrapQty', v_receipt.scrap_qty
    );
  end if;

  insert into public.work_card_history (
    card_id, nomenclature_id, stage_name, operator_name,
    qty_at_start, qty_completed, scrap_qty,
    started_at, completed_at, is_archived_scrap,
    shift_name, manager_name, machine_name
  ) values (
    p_card_id, p_nomenclature_id, 'Сортування', nullif(btrim(p_operator_name), ''),
    coalesce(p_qty_at_start, 0), coalesce(p_qty_completed, 0), coalesce(p_scrap_qty, 0),
    coalesce(p_started_at, clock_timestamp()), coalesce(p_stage_completed_at, clock_timestamp()),
    coalesce(p_scrap_qty, 0) > 0,
    nullif(btrim(p_shift_name), ''), nullif(btrim(p_manager_name), ''), nullif(btrim(p_machine_name), '')
  ) returning id into v_sorting_history_id;

  insert into public.work_card_history (
    card_id, nomenclature_id, stage_name, operator_name,
    qty_at_start, qty_completed, scrap_qty,
    started_at, completed_at, is_archived_scrap,
    shift_name, manager_name, machine_name
  ) values (
    p_card_id, p_nomenclature_id, 'Буфер Сортування', nullif(btrim(p_buffer_operator_name), ''),
    coalesce(p_qty_completed, 0), coalesce(p_qty_completed, 0), 0,
    coalesce(p_stage_completed_at, p_started_at, clock_timestamp()),
    coalesce(p_buffer_completed_at, clock_timestamp()), false,
    nullif(btrim(p_shift_name), ''), nullif(btrim(p_manager_name), ''), nullif(btrim(p_machine_name), '')
  ) returning id into v_buffer_history_id;

  insert into public.mes_sorting_history_receipts (
    card_id, sorting_history_id, buffer_history_id, scrap_qty
  ) values (
    p_card_id, v_sorting_history_id, v_buffer_history_id, coalesce(p_scrap_qty, 0)
  );

  return jsonb_build_object(
    'created', true,
    'sortingHistoryId', v_sorting_history_id,
    'bufferHistoryId', v_buffer_history_id,
    'scrapQty', coalesce(p_scrap_qty, 0)
  );
end;
$sorting_delivery$;

revoke all on function public.record_sorting_history_once(
  uuid, uuid, text, text, text, numeric, numeric, numeric,
  timestamptz, timestamptz, timestamptz, text, text
) from public;
grant execute on function public.record_sorting_history_once(
  uuid, uuid, text, text, text, numeric, numeric, numeric,
  timestamptz, timestamptz, timestamptz, text, text
) to anon, authenticated;

comment on function public.record_sorting_history_once(
  uuid, uuid, text, text, text, numeric, numeric, numeric,
  timestamptz, timestamptz, timestamptz, text, text
) is 'Atomically records Sorting and Buffer Sorting history once per card so VKYA scrap cannot be lost or duplicated.';
