-- Server-paged SGP stock balance & movements (Receipts + Expenses + Manual Adjustments)

create or replace function public.get_sgp_stock_analysis(
  p_inventory_ids uuid[],
  p_nomenclature_id uuid default null,
  p_item_name text default null,
  p_tab text default 'receipts',
  p_search text default '',
  p_limit integer default 25,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
set statement_timeout = '20s'
as $sgp_analysis$
declare
  v_nom_ids uuid[];
  v_nom_texts text[];
  v_rec_qty numeric := 0;
  v_rec_count bigint := 0;
  v_inv_ids uuid[];
  v_limit integer := least(greatest(coalesce(p_limit, 25), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_search text := lower(trim(coalesce(p_search, '')));
  v_current_stock numeric := 0;
  v_current_reserved numeric := 0;
  v_total_in_cards numeric := 0;
  v_receipts_count bigint := 0;
  v_total_out numeric := 0;
  v_expenses_count bigint := 0;
  v_adjustments_net numeric := 0;
  v_adjustments_count bigint := 0;
  v_total_rows bigint := 0;
  v_rows jsonb := '[]'::jsonb;
begin
  v_inv_ids := coalesce(p_inventory_ids, '{}'::uuid[]);

  select coalesce(array_agg(distinct x.id), '{}'::uuid[])
  into v_nom_ids
  from (
    select p_nomenclature_id as id where p_nomenclature_id is not null
    union
    select a.legacy_id as id
    from public.nomenclature_v2_aliases a
    where p_nomenclature_id is not null
      and (a.canonical_id = p_nomenclature_id or a.legacy_id = p_nomenclature_id)
    union
    select a.canonical_id as id
    from public.nomenclature_v2_aliases a
    where p_nomenclature_id is not null
      and (a.canonical_id = p_nomenclature_id or a.legacy_id = p_nomenclature_id)
    union
    select inv.nomenclature_id as id
    from public.inventory inv
    where inv.id = any(v_inv_ids) and inv.nomenclature_id is not null
  ) x;

  -- Current inventory totals
  select coalesce(array_agg(x::text), '{}'::text[])
  into v_nom_texts
  from unnest(v_nom_ids) as x;

  select
    coalesce(sum(coalesce(inv.total_qty, 0)), 0),
    coalesce(sum(coalesce(inv.reserved_qty, 0)), 0)
  into v_current_stock, v_current_reserved
  from public.inventory inv
  where inv.id = any(v_inv_ids);

  -- Total incoming from SGP work_card_history
  select
    coalesce(sum(coalesce(h.qty_completed, 0)), 0),
    count(*)
  into v_total_in_cards, v_receipts_count
  from public.work_card_history h
  where h.nomenclature_id = any(v_nom_ids)
    and coalesce(h.qty_completed, 0) > 0
    and lower(coalesce(h.stage_name, '')) ~ '(пакуван|паковк|сгп)';

  -- Incoming via completed reception documents to SGP (rubber, direct acceptance, etc.)
  select
    coalesce(sum(q.qty), 0),
    count(*)
  into v_rec_qty, v_rec_count
  from (
    select
      case
        when coalesce(item ->> 'accepted_qty', item ->> 'actual_qty', item ->> 'qty', '') ~ '^[0-9]+([.,][0-9]+)?$'
          then replace(coalesce(item ->> 'accepted_qty', item ->> 'actual_qty', item ->> 'qty'), ',', '.')::numeric
        else 0
      end as qty
    from public.reception_docs d
    cross join lateral jsonb_array_elements(coalesce(d.items, '[]'::jsonb)) as item
    where d.status = 'completed'
      and d.target_warehouse = 'sgp'
      and (
        (item ->> 'nomenclature_id') = any(v_nom_texts)
        or (
          coalesce(item ->> 'nomenclature_id', '') = ''
          and p_item_name is not null
          and lower(trim(coalesce(item ->> 'name', ''))) = lower(trim(p_item_name))
        )
      )
  ) q
  where q.qty > 0;

  v_total_in_cards := v_total_in_cards + v_rec_qty;
  v_receipts_count := v_receipts_count + v_rec_count;

  -- Total outgoing (completed material_requests for SGP inventory / nomenclature)
  select
    coalesce(sum(coalesce(mr.quantity, 0)), 0),
    count(*)
  into v_total_out, v_expenses_count
  from public.material_requests mr
  where mr.status = 'completed'
    and coalesce(mr.quantity, 0) > 0
    and (
      mr.inventory_id = any(v_inv_ids)
      or (mr.nomenclature_id = any(v_nom_ids) and mr.target_warehouse = 'sgp')
    );

  -- Manual adjustments
  select
    coalesce(sum(case when a.action = 'add' then coalesce(a.delta_qty, 0) else -coalesce(a.delta_qty, 0) end), 0),
    count(*)
  into v_adjustments_net, v_adjustments_count
  from public.inventory_manual_adjustments a
  where a.inventory_id = any(v_inv_ids)
     or (cardinality(v_nom_ids) > 0 and a.nomenclature_id = any(v_nom_ids) and a.warehouse = 'sgp');

  if p_tab = 'expenses' then
    with filtered as (
      select
        mr.id,
        mr.created_at,
        mr.quantity,
        coalesce(nullif(trim(o.order_num), ''), '—') as order_num,
        coalesce(nullif(trim(o.customer), ''), '—') as customer,
        coalesce(mr.details, 'Відвантаження / Видача зі СГП') as details
      from public.material_requests mr
      left join public.orders o on o.id = mr.order_id
      where mr.status = 'completed'
        and coalesce(mr.quantity, 0) > 0
        and (
          mr.inventory_id = any(v_inv_ids)
          or (mr.nomenclature_id = any(v_nom_ids) and mr.target_warehouse = 'sgp')
        )
        and (
          v_search = ''
          or lower(coalesce(o.order_num, '')) like '%' || v_search || '%'
          or lower(coalesce(o.customer, '')) like '%' || v_search || '%'
          or lower(coalesce(mr.details, '')) like '%' || v_search || '%'
        )
    )
    select
      (select count(*) from filtered),
      coalesce((
        select jsonb_agg(row_to_json(p))
        from (
          select * from filtered
          order by created_at desc nulls last
          limit v_limit offset v_offset
        ) p
      ), '[]'::jsonb)
    into v_total_rows, v_rows;

  elsif p_tab = 'adjustments' then
    with filtered as (
      select
        a.id,
        a.created_at,
        a.action,
        a.delta_qty,
        a.qty_before,
        a.qty_after,
        a.reason,
        a.actor_name
      from public.inventory_manual_adjustments a
      where (
        a.inventory_id = any(v_inv_ids)
        or (cardinality(v_nom_ids) > 0 and a.nomenclature_id = any(v_nom_ids) and a.warehouse = 'sgp')
      )
      and (
        v_search = ''
        or lower(coalesce(a.actor_name, '')) like '%' || v_search || '%'
        or lower(coalesce(a.reason, '')) like '%' || v_search || '%'
      )
    )
    select
      (select count(*) from filtered),
      coalesce((
        select jsonb_agg(row_to_json(p))
        from (
          select * from filtered
          order by created_at desc nulls last
          limit v_limit offset v_offset
        ) p
      ), '[]'::jsonb)
    into v_total_rows, v_rows;

  else
    -- Default: 'receipts'
    with filtered as (
      select * from (
        select
          h.id::text as id,
          h.card_id::text as card_id,
          coalesce(h.completed_at, h.created_at) as timestamp,
          h.qty_completed as quantity,
          coalesce(nullif(trim(o.order_num), ''), 'Без наряду') as order_num,
          coalesce(nullif(trim(h.operator_name), ''), 'Система') as operator_name,
          coalesce(nullif(trim(h.stage_name), ''), 'Пакування / СГП') as source
        from public.work_card_history h
        left join public.work_cards wc on wc.id = h.card_id
        left join public.tasks t on t.id = coalesce(wc.task_id, h.task_id)
        left join public.orders o on o.id = coalesce(wc.order_id, t.order_id)
        where h.nomenclature_id = any(v_nom_ids)
          and coalesce(h.qty_completed, 0) > 0
          and lower(coalesce(h.stage_name, '')) ~ '(пакуван|паковк|сгп)'

        union all

        select
          ('reception-' || d.id::text || '-' || idx::text) as id,
          coalesce(nullif(trim(item ->> 'batch_number'), ''), d.id::text) as card_id,
          coalesce(
            case when coalesce(item ->> 'accepted_at', '') ~ '^\d{4}-\d{2}-\d{2}' then (item ->> 'accepted_at')::timestamptz end,
            d.created_at
          ) as timestamp,
          case
            when coalesce(item ->> 'accepted_qty', item ->> 'actual_qty', item ->> 'qty', '') ~ '^[0-9]+([.,][0-9]+)?$'
              then replace(coalesce(item ->> 'accepted_qty', item ->> 'actual_qty', item ->> 'qty'), ',', '.')::numeric
            else 0
          end as quantity,
          coalesce(nullif(trim(item ->> 'batch_number'), ''), '—') as order_num,
          coalesce(nullif(trim(item ->> 'accepted_by'), ''), nullif(trim(item ->> 'operators'), ''), 'СГП') as operator_name,
          coalesce(
            nullif(trim(item ->> 'source_label'), ''),
            case when d.source_warehouse = 'shop2_rubber' then 'Цех №2 • порізка гуми' else 'Прийомка на СГП' end
          ) as source
        from public.reception_docs d
        cross join lateral jsonb_array_elements(coalesce(d.items, '[]'::jsonb)) with ordinality as e(item, idx)
        where d.status = 'completed'
          and d.target_warehouse = 'sgp'
          and (
            (item ->> 'nomenclature_id') = any(v_nom_texts)
            or (
              coalesce(item ->> 'nomenclature_id', '') = ''
              and p_item_name is not null
              and lower(trim(coalesce(item ->> 'name', ''))) = lower(trim(p_item_name))
            )
          )
      ) src
      where src.quantity > 0
        and (
          v_search = ''
          or lower(coalesce(src.card_id, '')) like '%' || v_search || '%'
          or lower(coalesce(src.order_num, '')) like '%' || v_search || '%'
          or lower(coalesce(src.operator_name, '')) like '%' || v_search || '%'
          or lower(coalesce(src.source, '')) like '%' || v_search || '%'
        )
    )
    select
      (select count(*) from filtered),
      coalesce((
        select jsonb_agg(row_to_json(p))
        from (
          select * from filtered
          order by timestamp desc nulls last
          limit v_limit offset v_offset
        ) p
      ), '[]'::jsonb)
    into v_total_rows, v_rows;
  end if;

  return jsonb_build_object(
    'summary', jsonb_build_object(
      'current_stock', v_current_stock,
      'current_reserved', v_current_reserved,
      'total_in_cards', v_total_in_cards,
      'receipts_count', v_receipts_count,
      'total_out', v_total_out,
      'expenses_count', v_expenses_count,
      'adjustments_net', v_adjustments_net,
      'adjustments_count', v_adjustments_count
    ),
    'total_rows', v_total_rows,
    'rows', v_rows
  );
end;
$sgp_analysis$;

revoke all on function public.get_sgp_stock_analysis(uuid[], uuid, text, text, text, integer, integer) from public;
grant execute on function public.get_sgp_stock_analysis(uuid[], uuid, text, text, text, integer, integer) to anon, authenticated;

notify pgrst, 'reload schema';
