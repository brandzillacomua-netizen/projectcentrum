-- Read-only diagnostic. This query does not modify any data.
select
  h.id as history_id,
  wc.id as card_id,
  left(replace(upper(wc.id::text), '-', ''), 8) as card_prefix,
  right(replace(upper(wc.id::text), '-', ''), 8) as card_suffix,
  left(replace(upper(h.id::text), '-', ''), 8) as history_prefix,
  right(replace(upper(h.id::text), '-', ''), 8) as history_suffix,
  o.order_num,
  t.batch_index,
  n.name as detail_name,
  h.stage_name,
  h.operator_name,
  h.scrap_qty,
  coalesce(classified.quantity, 0) as classified_qty,
  coalesce(h.scrap_qty, 0) - coalesce(classified.quantity, 0) as remaining_qty,
  h.is_archived_scrap,
  h.qc_scrap_comment,
  h.created_at,
  h.completed_at
from public.work_card_history h
join public.work_cards wc on wc.id = h.card_id
left join public.tasks t on t.id = wc.task_id
left join public.orders o on o.id = coalesce(wc.order_id, t.order_id)
left join public.nomenclatures n on n.id = h.nomenclature_id
left join lateral (
  select sum(c.quantity)::numeric as quantity
  from public.scrap_classifications c
  where c.source_history_id = h.id
) classified on true
where coalesce(h.scrap_qty, 0) > 0
  and (
    replace(lower(wc.id::text), '-', '') like '%88e5e3e1%'
    or replace(lower(h.id::text), '-', '') like '%88e5e3e1%'
    or (
      regexp_replace(coalesce(o.order_num::text, ''), '[^0-9]', '', 'g') like '31072026%'
      and lower(coalesce(n.name, '')) ~ '(п|p)[[:space:]-]*7[[:space:]-]*46$'
    )
  )
order by coalesce(h.completed_at, h.created_at) desc;
