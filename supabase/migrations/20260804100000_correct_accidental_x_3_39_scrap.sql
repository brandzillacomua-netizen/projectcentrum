-- One-time guarded correction requested for X-3-39 in naryads
-- 23072026-01 and 26072026-01. Respectively 1,916 and 1,560 pieces were
-- entered as scrap by mistake and must be returned as good production.

do $correction$
declare
  v_order_count integer;
  v_nomenclature_count integer;
  v_history_count integer;
  v_total_scrap numeric;
  v_first_order_scrap numeric;
  v_second_order_scrap numeric;
  v_classification_count integer;
  v_classified_qty numeric;
  v_unclassified_qty numeric;
  v_category_inventory_count integer;
  v_category_inventory_qty numeric;
  v_legacy_classification_count integer;
  v_reissue_count integer;
  v_inventory_row_count integer;
  v_inventory_qty numeric;
  v_category record;
begin
  create temporary table _x339_scrap_to_correct on commit drop as
  select h.id as history_id,
         wc.id as card_id,
         wc.task_id,
         coalesce(wc.order_id, t.order_id) as order_id,
         case
           when regexp_replace(btrim(o.order_num::text), '[^0-9]', '', 'g') in ('2307202601', '23072026') then '23072026-01'
           when regexp_replace(btrim(o.order_num::text), '[^0-9]', '', 'g') in ('2607202601', '26072026') then '26072026-01'
         end as order_num,
         h.nomenclature_id,
         h.scrap_qty::numeric as scrap_qty
    from public.work_card_history h
    join public.work_cards wc on wc.id = h.card_id
    left join public.tasks t on t.id = wc.task_id
    join public.orders o on o.id = coalesce(wc.order_id, t.order_id)
    join public.nomenclatures n on n.id = h.nomenclature_id
   where (
       regexp_replace(btrim(o.order_num::text), '[^0-9]', '', 'g') in ('2307202601', '2607202601')
       or (
         regexp_replace(btrim(o.order_num::text), '[^0-9]', '', 'g') in ('23072026', '26072026')
         and coalesce(t.batch_index, 1) = 1
       )
     )
     and lower(n.name) ~ '(x|х)[[:space:]-]*3[[:space:]-]*39$'
     and coalesce(h.scrap_qty, 0) > 0;

  select count(distinct o.id)
    into v_order_count
    from public.orders o
   where regexp_replace(btrim(o.order_num::text), '[^0-9]', '', 'g') in
     ('2307202601', '23072026', '2607202601', '26072026');

  if v_order_count <> 2 then
    raise exception 'X-3-39 correction aborted: expected 2 target orders, found %', v_order_count;
  end if;

  select count(*), count(distinct nomenclature_id), coalesce(sum(scrap_qty), 0)
    into v_history_count, v_nomenclature_count, v_total_scrap
    from _x339_scrap_to_correct;

  if v_history_count = 0 then
    raise exception 'X-3-39 correction aborted: no positive scrap history found';
  end if;
  if v_nomenclature_count <> 1 then
    raise exception 'X-3-39 correction aborted: expected one nomenclature, found %', v_nomenclature_count;
  end if;

  select coalesce(sum(scrap_qty), 0)
    into v_first_order_scrap
    from _x339_scrap_to_correct
   where order_num = '23072026-01';
  select coalesce(sum(scrap_qty), 0)
    into v_second_order_scrap
    from _x339_scrap_to_correct
   where order_num = '26072026-01';

  if v_first_order_scrap <> 1916 then
    raise exception 'X-3-39 correction aborted: order 23072026-01 expected 1916 scrap pieces, found %', v_first_order_scrap;
  end if;
  if v_second_order_scrap <> 1560 then
    raise exception 'X-3-39 correction aborted: order 26072026-01 expected 1560 scrap pieces, found %', v_second_order_scrap;
  end if;
  if v_total_scrap <> 3476 then
    raise exception 'X-3-39 correction aborted: expected exactly 3476 scrap pieces in total, found %', v_total_scrap;
  end if;

  select count(*), coalesce(sum(c.quantity), 0)
    into v_classification_count, v_classified_qty
    from public.scrap_classifications c
   where c.source_history_id in (select history_id from _x339_scrap_to_correct);

  if v_classification_count <> 27 then
    raise exception 'X-3-39 correction aborted: expected 27 VKYA classifications, found %', v_classification_count;
  end if;
  v_unclassified_qty := v_total_scrap - v_classified_qty;
  if v_classified_qty <> 3472 or v_unclassified_qty <> 4 then
    raise exception 'X-3-39 correction aborted: expected 3472 classified and 4 unclassified, found % classified and % unclassified',
      v_classified_qty, v_unclassified_qty;
  end if;

  select count(*)
    into v_legacy_classification_count
    from public.work_card_history h
   where h.id in (select history_id from _x339_scrap_to_correct)
     and coalesce(h.qc_scrap_comment, '') like '%[SCRAP_CAT:%';

  if v_legacy_classification_count = 0 then
    raise exception 'X-3-39 correction aborted: classification comments are missing';
  end if;

  select count(*)
    into v_reissue_count
    from public.work_cards wc
   where wc.order_id in (select distinct order_id from _x339_scrap_to_correct)
     and wc.nomenclature_id in (select distinct nomenclature_id from _x339_scrap_to_correct)
     and (coalesce(wc.card_info, '') ilike '%[REDO]%'
       or coalesce(wc.card_info, '') ilike '%довипуск%');

  if v_reissue_count <> 0 then
    raise exception 'X-3-39 correction aborted: % reissue cards already exist', v_reissue_count;
  end if;

  select count(*), coalesce(sum(i.total_qty), 0)
    into v_inventory_row_count, v_inventory_qty
    from public.inventory i
   where i.nomenclature_id = (select nomenclature_id from _x339_scrap_to_correct limit 1)
     and i.type = 'scrap_ready';

  if v_inventory_row_count <> 1 then
    raise exception 'X-3-39 correction aborted: expected one scrap_ready inventory row, found %', v_inventory_row_count;
  end if;
  if v_inventory_qty < v_total_scrap then
    raise exception 'X-3-39 correction aborted: scrap_ready has %, required %', v_inventory_qty, v_total_scrap;
  end if;

  create temporary table _x339_categories_to_reverse on commit drop as
  select cc.category, sum(cc.quantity)::numeric as quantity
    from public.scrap_classification_categories cc
    join public.scrap_classifications c on c.id = cc.classification_id
   where c.source_history_id in (select history_id from _x339_scrap_to_correct)
   group by cc.category;

  if (select coalesce(sum(quantity), 0) from _x339_categories_to_reverse) <> v_classified_qty then
    raise exception 'X-3-39 correction aborted: category allocations do not total classified quantity %', v_classified_qty;
  end if;

  for v_category in select category, quantity from _x339_categories_to_reverse loop
    select count(*), coalesce(sum(i.total_qty), 0)
      into v_category_inventory_count, v_category_inventory_qty
      from public.inventory i
     where i.nomenclature_id = (select nomenclature_id from _x339_scrap_to_correct limit 1)
       and i.type = 'scrap_cat_' || v_category.category::text;

    if v_category_inventory_count > 1 then
      raise exception 'X-3-39 correction aborted: category % has ambiguous inventory rows: %',
        v_category.category, v_category_inventory_count;
    end if;
  end loop;

  -- Reverse the inventory projections created by the 27 VKYA classification
  -- actions before removing their analytical ledger rows.
  for v_category in select category, quantity from _x339_categories_to_reverse loop
    update public.inventory i
       set total_qty = greatest(0, coalesce(i.total_qty, 0) - v_category.quantity),
           updated_at = now()
     where i.nomenclature_id = (select nomenclature_id from _x339_scrap_to_correct limit 1)
       and i.type = 'scrap_cat_' || v_category.category::text;
  end loop;

  delete from public.scrap_classifications c
   where c.source_history_id in (select history_id from _x339_scrap_to_correct);

  -- Return every mistakenly scrapped piece to the factual good quantity while
  -- retaining the original history row and an explicit audit marker.
  update public.work_card_history h
     set qty_completed = coalesce(h.qty_completed, 0) + t.scrap_qty,
         scrap_qty = 0,
         is_archived_scrap = false,
         qc_scrap_comment = concat_ws(
           ' ',
           nullif(btrim(
             regexp_replace(
               regexp_replace(coalesce(h.qc_scrap_comment, ''), '\[SCRAP_CAT:[^]]+\]', '', 'g'),
               '\[SCRAP_REASONS:[^]]+\]', '', 'g'
             )
           ), ''),
           format(
             '[SCRAP_CORRECTION:20260804100000 accidental X-3-39 entry; returned %s pieces to good production]',
             t.scrap_qty
           )
         )
    from _x339_scrap_to_correct t
   where h.id = t.history_id;

  update public.work_cards wc
     set quantity = coalesce(wc.quantity, 0) + corrected.scrap_qty
    from (
      select card_id, sum(scrap_qty)::numeric as scrap_qty
        from _x339_scrap_to_correct
       group by card_id
    ) corrected
   where wc.id = corrected.card_id;

  update public.inventory i
     set total_qty = coalesce(i.total_qty, 0) - v_total_scrap,
         updated_at = now()
   where i.nomenclature_id = (select nomenclature_id from _x339_scrap_to_correct limit 1)
     and i.type = 'scrap_ready';

  raise notice 'Corrected % X-3-39 scrap history rows; returned % pieces to production',
    v_history_count, v_total_scrap;
end;
$correction$;
