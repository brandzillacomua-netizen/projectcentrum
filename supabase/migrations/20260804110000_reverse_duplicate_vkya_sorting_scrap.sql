-- Reverse one unclassified duplicate VKYA scrap entry:
-- naryad 31072026-01, card suffix 88F5E3E1, Kyiv ... P-7-46, 46 pcs.
-- The original classified entry is retained unchanged.

do $correction$
declare
  v_target_count integer;
  v_target_history_id uuid;
  v_card_id uuid;
  v_nomenclature_id uuid;
  v_duplicate_scrap numeric;
  v_classified_twin_count integer;
  v_classified_twin_qty numeric;
  v_inventory_count integer;
  v_scrap_ready_qty numeric;
begin
  create temporary table _duplicate_vkya_scrap on commit drop as
  select h.id as history_id,
         wc.id as card_id,
         h.nomenclature_id,
         h.scrap_qty::numeric as scrap_qty,
         coalesce(classified.quantity, 0)::numeric as classified_qty
    from public.work_card_history h
    join public.work_cards wc on wc.id = h.card_id
    left join lateral (
      select sum(c.quantity)::numeric as quantity
        from public.scrap_classifications c
       where c.source_history_id = h.id
    ) classified on true
   where h.id = 'f297520b-b904-44ed-a742-1eaec7cdb1ca'::uuid
     and wc.id = 'c224f67a-e620-4cb7-9059-895c88f5e3e1'::uuid
     and coalesce(h.scrap_qty, 0) = 46
     and coalesce(classified.quantity, 0) = 0;

  select count(*)
    into v_target_count
    from _duplicate_vkya_scrap;

  if v_target_count <> 1 then
    raise exception 'Duplicate VKYA correction aborted: expected one unclassified 46-piece history row, found %', v_target_count;
  end if;

  select history_id, card_id, nomenclature_id, scrap_qty
    into v_target_history_id, v_card_id, v_nomenclature_id, v_duplicate_scrap
    from _duplicate_vkya_scrap
   limit 1;

  if (select classified_qty from _duplicate_vkya_scrap limit 1) <> 0 then
    raise exception 'Duplicate VKYA correction aborted: target queue row is partially classified (% pieces)',
      (select classified_qty from _duplicate_vkya_scrap limit 1);
  end if;

  if v_duplicate_scrap <> 46 then
    raise exception 'Duplicate VKYA correction aborted: target history scrap is %, expected 46', v_duplicate_scrap;
  end if;

  select count(distinct c.id), coalesce(sum(c.quantity), 0)
    into v_classified_twin_count, v_classified_twin_qty
    from public.scrap_classifications c
   where c.source_history_id = 'a2122796-f25f-441b-92f2-98ae8e018748'::uuid
     and c.card_id = v_card_id
     and c.nomenclature_id = v_nomenclature_id
     and c.source_history_id is distinct from v_target_history_id;

  if v_classified_twin_count = 0 or v_classified_twin_qty <> 46 then
    raise exception 'Duplicate VKYA correction aborted: exact classified twin is invalid (rows %, quantity %)',
      v_classified_twin_count, v_classified_twin_qty;
  end if;

  select count(*), coalesce(sum(i.total_qty), 0)
    into v_inventory_count, v_scrap_ready_qty
    from public.inventory i
   where i.nomenclature_id = v_nomenclature_id
     and i.type = 'scrap_ready';

  if v_inventory_count <> 1 then
    raise exception 'Duplicate VKYA correction aborted: expected one scrap_ready inventory row, found %', v_inventory_count;
  end if;
  if v_scrap_ready_qty < v_duplicate_scrap then
    raise exception 'Duplicate VKYA correction aborted: scrap_ready has %, required %',
      v_scrap_ready_qty, v_duplicate_scrap;
  end if;

  update public.work_card_history h
     set qty_completed = coalesce(h.qty_completed, 0) + v_duplicate_scrap,
         scrap_qty = 0,
         is_archived_scrap = false,
         qc_scrap_comment = concat_ws(
           ' ',
           nullif(btrim(coalesce(h.qc_scrap_comment, '')), ''),
           '[SCRAP_CORRECTION:20260804110000 duplicate unclassified VKYA entry; returned 46 pieces to card]'
         )
   where h.id = v_target_history_id;

  update public.work_cards wc
     set quantity = coalesce(wc.quantity, 0) + v_duplicate_scrap
   where wc.id = v_card_id;

  update public.inventory i
     set total_qty = coalesce(i.total_qty, 0) - v_duplicate_scrap,
         updated_at = now()
   where i.nomenclature_id = v_nomenclature_id
     and i.type = 'scrap_ready';

  raise notice 'Removed duplicate VKYA queue entry % and returned % pieces to card %',
    v_target_history_id, v_duplicate_scrap, v_card_id;
end;
$correction$;
