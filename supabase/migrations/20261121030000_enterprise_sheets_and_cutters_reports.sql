-- Enterprise 1C-style DB-driven reports for Sheets and Cutters
-- All aggregations run in PostgreSQL on demand when the user clicks "Сформувати звіт".

create index if not exists idx_wch_created_at_stage
  on public.work_card_history (created_at, stage_name);
create index if not exists idx_reception_docs_status_created
  on public.reception_docs (status, created_at);
create index if not exists idx_cutter_usage_events_created
  on public.cutter_usage_events (created_at);

create or replace function public.get_sheets_report_1c(
  p_start timestamptz,
  p_end timestamptz
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
set statement_timeout = '30s'
as $sheets_report$
declare
  v_result jsonb;
begin
  with cutting_history_raw as (
    select
      coalesce(h.card_id, h.id) as effective_card_id,
      max(h.task_id::text)::uuid as task_id,
      max(h.nomenclature_id::text)::uuid as part_nomenclature_id,
      sum(coalesce(h.qty_completed, 0)) as qty_produced,
      sum(coalesce(h.scrap_qty, 0)) as scrap_qty,
      max(h.card_info) as hist_card_info
    from public.work_card_history h
    where h.created_at >= p_start
      and h.created_at < p_end
      and h.stage_name = 'Розкрій'
      and (
        coalesce(h.qty_completed, 0) > 0
        or coalesce(h.scrap_qty, 0) > 0
        or h.card_info like '%[SHEETS_DEDUCTED:true]%'
      )
    group by coalesce(h.card_id, h.id)
  ),
  cutting_cards as materialized (
    select
      chr.effective_card_id as card_id,
      coalesce(wc.task_id, chr.task_id) as task_id,
      coalesce(wc.order_id, t.order_id) as order_id,
      coalesce(nullif(trim(o.order_num), ''), 'Без наряду') as order_num,
      coalesce(nullif(trim(o.customer), ''), '—') as customer,
      chr.qty_produced,
      chr.scrap_qty,
      coalesce(
        nullif(trim(t.plan_snapshot -> (coalesce(wc.nomenclature_id, chr.part_nomenclature_id)::text) ->> 'material'), ''),
        nullif(trim(pn.material_type), ''),
        'Не вказано'
      ) as material_name,
      coalesce(
        nullif(
          replace(
            substring(coalesce(wc.card_info, chr.hist_card_info, '') from '\[SHEETS:([0-9]+(?:[.,][0-9]+)?)\]'),
            ',', '.'
          ),
          ''
        )::numeric,
        nullif(
          replace(
            substring(coalesce(wc.card_info, chr.hist_card_info, '') from '\(([0-9]+(?:[.,][0-9]+)?)\s*л\.\)'),
            ',', '.'
          ),
          ''
        )::numeric,
        case
          when (chr.qty_produced + chr.scrap_qty) > 0 then
            ceil(
              (chr.qty_produced + chr.scrap_qty)::numeric /
              greatest(
                coalesce(
                  case
                    when coalesce(t.plan_snapshot -> (coalesce(wc.nomenclature_id, chr.part_nomenclature_id)::text) ->> 'unitsPerSheet', '') ~ '^[0-9]+([.,][0-9]+)?$'
                      then nullif(replace(t.plan_snapshot -> (coalesce(wc.nomenclature_id, chr.part_nomenclature_id)::text) ->> 'unitsPerSheet', ',', '.'), '')::numeric
                    else null
                  end,
                  pn.units_per_sheet,
                  1
                ),
                1
              )
            )
          else 0
        end
      ) as sheets_count
    from cutting_history_raw chr
    left join public.work_cards wc on wc.id = chr.effective_card_id
    left join public.tasks t on t.id = coalesce(wc.task_id, chr.task_id)
    left join public.orders o on o.id = coalesce(wc.order_id, t.order_id)
    left join public.nomenclatures pn on pn.id = coalesce(wc.nomenclature_id, chr.part_nomenclature_id)
  ),
  sheet_nomenclatures as materialized (
    select
      n.id,
      n.id::text as id_text,
      n.name
    from public.nomenclatures n
    left join public.nomenclatures_v2 v2 on v2.id = n.id
    where (
      v2.group_id in ('grp_raw_sheets', 'grp_prepared_sheets')
      or (
        coalesce(n.type, '') not in ('part', 'product', 'consumable', 'archived')
        and n.name ~* '(лист|sheet)'
        and n.name !~* 'непідготовлений'
      )
    )
  ),
  manual_issues_rows as (
    select
      m.id,
      m.nomenclature_id,
      sn.name as material_name,
      m.quantity,
      m.unit,
      m.stock_before,
      m.stock_after,
      m.issued_by_name,
      m.source_module,
      m.created_at
    from public.manual_inventory_issues m
    join sheet_nomenclatures sn on sn.id = m.nomenclature_id
    where m.created_at >= p_start
      and m.created_at < p_end
  ),
  supplied_rows as (
    select
      sn.name as material_name,
      sum(
        case
          when coalesce(item ->> 'qty', item ->> 'quantity', item ->> 'needed', '') ~ '^[0-9]+([.,][0-9]+)?$'
            then replace(coalesce(item ->> 'qty', item ->> 'quantity', item ->> 'needed'), ',', '.')::numeric
          else 0
        end
      ) as supplied_qty
    from public.reception_docs d
    cross join lateral jsonb_array_elements(coalesce(d.items, '[]'::jsonb)) as item
    join sheet_nomenclatures sn on sn.id_text = (item ->> 'nomenclature_id')
    where d.status in ('completed', 'shipped')
      and d.created_at >= p_start
      and d.created_at < p_end
    group by sn.name
  ),
  stock_by_material as (
    select
      sn.name as material_name,
      sum(coalesce(inv.total_qty, 0)) as stock_total,
      sum(coalesce(inv.reserved_qty, 0)) as stock_reserved,
      sum(greatest(coalesce(inv.total_qty, 0) - coalesce(inv.reserved_qty, 0), 0)) as stock_available
    from sheet_nomenclatures sn
    left join public.inventory inv on inv.nomenclature_id = sn.id
    group by sn.name
  ),
  order_material_groups as (
    select
      order_num,
      max(customer) as customer,
      max(order_id::text) as order_id,
      material_name,
      sum(sheets_count) as sheets_count,
      count(*) as cards_count,
      sum(qty_produced) as qty_produced,
      sum(scrap_qty) as scrap_qty
    from cutting_cards
    where sheets_count > 0 or qty_produced > 0 or scrap_qty > 0
    group by order_num, material_name
  ),
  orders_tree as (
    select
      order_num,
      max(customer) as customer,
      max(order_id) as order_id,
      sum(sheets_count) as total_sheets,
      sum(cards_count) as cards_count,
      sum(qty_produced) as qty_produced,
      sum(scrap_qty) as scrap_qty,
      jsonb_agg(
        jsonb_build_object(
          'material_name', material_name,
          'sheets_count', sheets_count,
          'cards_count', cards_count,
          'qty_produced', qty_produced,
          'scrap_qty', scrap_qty
        )
        order by sheets_count desc, material_name asc
      ) as materials
    from order_material_groups
    group by order_num
  ),
  manual_by_material as (
    select
      nomenclature_id,
      material_name,
      sum(quantity) as total_qty,
      count(*) as issues_count,
      jsonb_agg(
        jsonb_build_object(
          'id', id,
          'created_at', created_at,
          'quantity', quantity,
          'unit', unit,
          'stock_before', stock_before,
          'stock_after', stock_after,
          'issued_by_name', issued_by_name,
          'source_module', source_module
        )
        order by created_at desc
      ) as items
    from manual_issues_rows
    group by nomenclature_id, material_name
  ),
  material_summary as (
    select
      m_name as material_name,
      coalesce(o_agg.used_orders, 0) as used_orders,
      coalesce(m_agg.manual_issued, 0) as manual_issued,
      coalesce(o_agg.used_orders, 0) + coalesce(m_agg.manual_issued, 0) as total_out,
      coalesce(sup.supplied_qty, 0) as supplied,
      coalesce(st.stock_total, 0) as stock_total,
      coalesce(st.stock_reserved, 0) as stock_reserved,
      coalesce(st.stock_available, 0) as stock_available
    from (
      select material_name as m_name from cutting_cards
      union
      select material_name as m_name from manual_issues_rows
      union
      select material_name as m_name from supplied_rows
      union
      select material_name as m_name from stock_by_material where stock_total > 0 or stock_reserved > 0
    ) all_names
    left join (
      select material_name, sum(sheets_count) as used_orders
      from cutting_cards
      group by material_name
    ) o_agg on o_agg.material_name = all_names.m_name
    left join (
      select material_name, sum(quantity) as manual_issued
      from manual_issues_rows
      group by material_name
    ) m_agg on m_agg.material_name = all_names.m_name
    left join supplied_rows sup on sup.material_name = all_names.m_name
    left join stock_by_material st on st.material_name = all_names.m_name
  )
  select jsonb_build_object(
    'summary', jsonb_build_object(
      'total_used_orders', coalesce((select sum(total_sheets) from orders_tree), 0),
      'total_manual_issued', coalesce((select sum(quantity) from manual_issues_rows), 0),
      'total_supplied', coalesce((select sum(supplied_qty) from supplied_rows), 0),
      'total_cards', coalesce((select sum(cards_count) from orders_tree), 0),
      'total_qty_produced', coalesce((select sum(qty_produced) from orders_tree), 0),
      'total_scrap', coalesce((select sum(scrap_qty) from orders_tree), 0),
      'stock_total', coalesce((select sum(stock_total) from stock_by_material), 0),
      'stock_reserved', coalesce((select sum(stock_reserved) from stock_by_material), 0),
      'stock_available', coalesce((select sum(stock_available) from stock_by_material), 0)
    ),
    'by_order', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'order_num', order_num,
          'customer', customer,
          'order_id', order_id,
          'total_sheets', total_sheets,
          'cards_count', cards_count,
          'qty_produced', qty_produced,
          'scrap_qty', scrap_qty,
          'materials', materials
        )
        order by total_sheets desc, order_num desc
      )
      from orders_tree
    ), '[]'::jsonb),
    'manual_issues', jsonb_build_object(
      'total_qty', coalesce((select sum(quantity) from manual_issues_rows), 0),
      'issues_count', coalesce((select count(*) from manual_issues_rows), 0),
      'by_material', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'nomenclature_id', nomenclature_id,
            'material_name', material_name,
            'total_qty', total_qty,
            'issues_count', issues_count,
            'items', items
          )
          order by total_qty desc, material_name asc
        )
        from manual_by_material
      ), '[]'::jsonb)
    ),
    'by_material', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'material_name', material_name,
          'used_orders', used_orders,
          'manual_issued', manual_issued,
          'total_out', total_out,
          'supplied', supplied,
          'stock_total', stock_total,
          'stock_reserved', stock_reserved,
          'stock_available', stock_available
        )
        order by total_out desc, stock_total desc, material_name asc
      )
      from material_summary
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$sheets_report$;

create or replace function public.get_cutters_report_1c(
  p_start timestamptz,
  p_end timestamptz
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
set statement_timeout = '30s'
as $cutters_report$
declare
  v_result jsonb;
begin
  with cutter_nomenclatures as materialized (
    select
      n.id,
      n.id::text as id_text,
      n.name
    from public.nomenclatures n
    left join public.nomenclatures_v2 v2 on v2.id = n.id
    where (
      v2.rule_type = 'mill'
      or v2.group_id = 'grp_mills'
      or n.name ~* '(фрез|cut-|тип\s*ф)'
    )
  ),
  usage_rows as materialized (
    select
      e.id,
      e.source_card_id as card_id,
      e.nomenclature_id,
      coalesce(cn.name, 'Невідома фреза') as cutter_name,
      e.quantity,
      e.is_faceting,
      e.pocket_owner,
      coalesce(nullif(trim(e.actor_name), ''), '—') as actor_name,
      e.created_at,
      coalesce(nullif(trim(o.order_num), ''), 'Без наряду') as order_num,
      coalesce(nullif(trim(o.customer), ''), '—') as customer,
      coalesce(nullif(trim(wc.machine), ''), nullif(trim(m.name), ''), '—') as machine_name,
      coalesce(pn.name, '—') as part_name
    from public.cutter_usage_events e
    left join cutter_nomenclatures cn on cn.id = e.nomenclature_id
    left join public.work_cards wc on wc.id = e.source_card_id
    left join public.machines m on m.id = wc.machine_id
    left join public.tasks t on t.id = coalesce(e.task_id, wc.task_id)
    left join public.orders o on o.id = coalesce(e.order_id, wc.order_id, t.order_id)
    left join public.nomenclatures pn on pn.id = wc.nomenclature_id
    where e.quantity > 0
      and e.created_at >= p_start
      and e.created_at < p_end
  ),
  manual_rows as (
    select
      m.id,
      m.nomenclature_id,
      cn.name as cutter_name,
      m.quantity,
      m.unit,
      m.stock_before,
      m.stock_after,
      m.issued_by_name,
      m.source_module,
      m.created_at
    from public.manual_inventory_issues m
    join cutter_nomenclatures cn on cn.id = m.nomenclature_id
    where m.created_at >= p_start
      and m.created_at < p_end
  ),
  supplied_rows as (
    select
      cn.id as nomenclature_id,
      cn.name as cutter_name,
      sum(
        case
          when coalesce(item ->> 'qty', item ->> 'quantity', item ->> 'needed', '') ~ '^[0-9]+([.,][0-9]+)?$'
            then replace(coalesce(item ->> 'qty', item ->> 'quantity', item ->> 'needed'), ',', '.')::numeric
          else 0
        end
      ) as supplied_qty
    from public.reception_docs d
    cross join lateral jsonb_array_elements(coalesce(d.items, '[]'::jsonb)) as item
    join cutter_nomenclatures cn on cn.id_text = (item ->> 'nomenclature_id')
    where d.status = 'completed'
      and d.created_at >= p_start
      and d.created_at < p_end
    group by cn.id, cn.name
  ),
  stock_by_cutter as (
    select
      cn.id as nomenclature_id,
      cn.name as cutter_name,
      sum(coalesce(inv.total_qty, 0)) as stock_total,
      sum(coalesce(inv.reserved_qty, 0)) as stock_reserved,
      sum(greatest(coalesce(inv.total_qty, 0) - coalesce(inv.reserved_qty, 0), 0)) as stock_available
    from cutter_nomenclatures cn
    left join public.inventory inv on inv.nomenclature_id = cn.id
    group by cn.id, cn.name
  ),
  cutter_order_groups as (
    select
      nomenclature_id,
      cutter_name,
      order_num,
      max(customer) as customer,
      sum(quantity) as total_qty,
      count(*) as events_count,
      jsonb_agg(
        jsonb_build_object(
          'id', id,
          'card_id', card_id,
          'created_at', created_at,
          'quantity', quantity,
          'actor_name', actor_name,
          'machine_name', machine_name,
          'part_name', part_name,
          'is_faceting', is_faceting,
          'pocket_owner', pocket_owner
        )
        order by created_at desc
      ) as events
    from usage_rows
    group by nomenclature_id, cutter_name, order_num
  ),
  cutters_tree as (
    select
      cn_all.nomenclature_id,
      cn_all.cutter_name,
      coalesce(u.used_actual, 0) as used_actual,
      coalesce(u.events_count, 0) as events_count,
      coalesce(man.manual_issued, 0) as manual_issued,
      coalesce(sup.supplied_qty, 0) as supplied,
      coalesce(st.stock_total, 0) as stock_total,
      coalesce(st.stock_reserved, 0) as stock_reserved,
      coalesce(st.stock_available, 0) as stock_available,
      coalesce(u.by_order, '[]'::jsonb) as by_order
    from (
      select nomenclature_id, cutter_name from usage_rows
      union
      select nomenclature_id, cutter_name from manual_rows
      union
      select nomenclature_id, cutter_name from supplied_rows
      union
      select nomenclature_id, cutter_name from stock_by_cutter where stock_total > 0 or stock_reserved > 0
    ) cn_all
    left join (
      select
        nomenclature_id,
        sum(total_qty) as used_actual,
        sum(events_count) as events_count,
        jsonb_agg(
          jsonb_build_object(
            'order_num', order_num,
            'customer', customer,
            'total_qty', total_qty,
            'events_count', events_count,
            'events', events
          )
          order by total_qty desc, order_num desc
        ) as by_order
      from cutter_order_groups
      group by nomenclature_id
    ) u on u.nomenclature_id = cn_all.nomenclature_id
    left join (
      select nomenclature_id, sum(quantity) as manual_issued
      from manual_rows
      group by nomenclature_id
    ) man on man.nomenclature_id = cn_all.nomenclature_id
    left join supplied_rows sup on sup.nomenclature_id = cn_all.nomenclature_id
    left join stock_by_cutter st on st.nomenclature_id = cn_all.nomenclature_id
  ),
  orders_tree as (
    select
      order_num,
      max(customer) as customer,
      sum(total_qty) as total_qty,
      sum(events_count) as events_count,
      jsonb_agg(
        jsonb_build_object(
          'nomenclature_id', nomenclature_id,
          'cutter_name', cutter_name,
          'total_qty', total_qty,
          'events_count', events_count,
          'events', events
        )
        order by total_qty desc, cutter_name asc
      ) as cutters
    from cutter_order_groups
    group by order_num
  ),
  manual_by_cutter as (
    select
      nomenclature_id,
      cutter_name,
      sum(quantity) as total_qty,
      count(*) as issues_count,
      jsonb_agg(
        jsonb_build_object(
          'id', id,
          'created_at', created_at,
          'quantity', quantity,
          'unit', unit,
          'stock_before', stock_before,
          'stock_after', stock_after,
          'issued_by_name', issued_by_name,
          'source_module', source_module
        )
        order by created_at desc
      ) as items
    from manual_rows
    group by nomenclature_id, cutter_name
  )
  select jsonb_build_object(
    'summary', jsonb_build_object(
      'total_used_actual', coalesce((select sum(quantity) from usage_rows), 0),
      'total_manual_issued', coalesce((select sum(quantity) from manual_rows), 0),
      'total_supplied', coalesce((select sum(supplied_qty) from supplied_rows), 0),
      'events_count', coalesce((select count(*) from usage_rows), 0),
      'unique_cutters', coalesce((select count(distinct nomenclature_id) from usage_rows), 0),
      'stock_total', coalesce((select sum(stock_total) from stock_by_cutter), 0),
      'stock_reserved', coalesce((select sum(stock_reserved) from stock_by_cutter), 0),
      'stock_available', coalesce((select sum(stock_available) from stock_by_cutter), 0)
    ),
    'by_cutter', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'nomenclature_id', nomenclature_id,
          'cutter_name', cutter_name,
          'used_actual', used_actual,
          'manual_issued', manual_issued,
          'supplied', supplied,
          'stock_total', stock_total,
          'stock_reserved', stock_reserved,
          'stock_available', stock_available,
          'events_count', events_count,
          'by_order', by_order
        )
        order by used_actual desc, manual_issued desc, stock_total desc, cutter_name asc
      )
      from cutters_tree
    ), '[]'::jsonb),
    'by_order', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'order_num', order_num,
          'customer', customer,
          'total_qty', total_qty,
          'events_count', events_count,
          'cutters', cutters
        )
        order by total_qty desc, order_num desc
      )
      from orders_tree
    ), '[]'::jsonb),
    'manual_issues', jsonb_build_object(
      'total_qty', coalesce((select sum(quantity) from manual_rows), 0),
      'issues_count', coalesce((select count(*) from manual_rows), 0),
      'by_cutter', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'nomenclature_id', nomenclature_id,
            'cutter_name', cutter_name,
            'total_qty', total_qty,
            'issues_count', issues_count,
            'items', items
          )
          order by total_qty desc, cutter_name asc
        )
        from manual_by_cutter
      ), '[]'::jsonb)
    )
  ) into v_result;

  return v_result;
end;
$cutters_report$;

revoke all on function public.get_sheets_report_1c(timestamptz, timestamptz) from public;
revoke all on function public.get_cutters_report_1c(timestamptz, timestamptz) from public;
grant execute on function public.get_sheets_report_1c(timestamptz, timestamptz) to anon, authenticated;
grant execute on function public.get_cutters_report_1c(timestamptz, timestamptz) to anon, authenticated;

create or replace function public.get_sheets_report_cards_1c(
  p_start timestamptz,
  p_end timestamptz,
  p_order_num text,
  p_material_name text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
set statement_timeout = '15s'
as $sheets_cards$
declare
  v_cards jsonb;
begin
  with cutting_history_raw as (
    select
      coalesce(h.card_id, h.id) as effective_card_id,
      max(h.task_id::text)::uuid as task_id,
      max(h.nomenclature_id::text)::uuid as part_nomenclature_id,
      max(coalesce(nullif(trim(h.machine_name), ''), nullif(trim(h.machine), ''))) as machine_name,
      string_agg(distinct nullif(trim(h.operator_name), ''), ', ') as operator_name,
      max(coalesce(h.completed_at, h.created_at)) as completed_at,
      sum(coalesce(h.qty_completed, 0)) as qty_produced,
      sum(coalesce(h.scrap_qty, 0)) as scrap_qty,
      max(h.card_info) as hist_card_info
    from public.work_card_history h
    where h.created_at >= p_start
      and h.created_at < p_end
      and h.stage_name = 'Розкрій'
      and (
        coalesce(h.qty_completed, 0) > 0
        or coalesce(h.scrap_qty, 0) > 0
        or h.card_info like '%[SHEETS_DEDUCTED:true]%'
      )
    group by coalesce(h.card_id, h.id)
  ),
  matched_cards as (
    select
      chr.effective_card_id as card_id,
      coalesce(pn.name, 'Невідома деталь') as part_name,
      coalesce(
        chr.machine_name,
        nullif(trim(wc.machine), ''),
        nullif(trim(m.name), ''),
        '—'
      ) as machine_name,
      coalesce(nullif(trim(chr.operator_name), ''), '—') as operator_name,
      chr.completed_at,
      chr.qty_produced,
      chr.scrap_qty,
      (
        coalesce(wc.is_rework, false)
        or coalesce(wc.card_info, chr.hist_card_info, '') like '%[REDO]%'
      ) as is_redo,
      coalesce(nullif(trim(o.order_num), ''), 'Без наряду') as order_num,
      coalesce(
        nullif(trim(t.plan_snapshot -> (coalesce(wc.nomenclature_id, chr.part_nomenclature_id)::text) ->> 'material'), ''),
        nullif(trim(pn.material_type), ''),
        'Не вказано'
      ) as material_name,
      coalesce(
        nullif(
          replace(
            substring(coalesce(wc.card_info, chr.hist_card_info, '') from '\[SHEETS:([0-9]+(?:[.,][0-9]+)?)\]'),
            ',', '.'
          ),
          ''
        )::numeric,
        nullif(
          replace(
            substring(coalesce(wc.card_info, chr.hist_card_info, '') from '\(([0-9]+(?:[.,][0-9]+)?)\s*л\.\)'),
            ',', '.'
          ),
          ''
        )::numeric,
        case
          when (chr.qty_produced + chr.scrap_qty) > 0 then
            ceil(
              (chr.qty_produced + chr.scrap_qty)::numeric /
              greatest(
                coalesce(
                  case
                    when coalesce(t.plan_snapshot -> (coalesce(wc.nomenclature_id, chr.part_nomenclature_id)::text) ->> 'unitsPerSheet', '') ~ '^[0-9]+([.,][0-9]+)?$'
                      then nullif(replace(t.plan_snapshot -> (coalesce(wc.nomenclature_id, chr.part_nomenclature_id)::text) ->> 'unitsPerSheet', ',', '.'), '')::numeric
                    else null
                  end,
                  pn.units_per_sheet,
                  1
                ),
                1
              )
            )
          else 0
        end
      ) as sheets_count
    from cutting_history_raw chr
    left join public.work_cards wc on wc.id = chr.effective_card_id
    left join public.machines m on m.id = wc.machine_id
    left join public.tasks t on t.id = coalesce(wc.task_id, chr.task_id)
    left join public.orders o on o.id = coalesce(wc.order_id, t.order_id)
    left join public.nomenclatures pn on pn.id = coalesce(wc.nomenclature_id, chr.part_nomenclature_id)
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'card_id', card_id,
        'part_name', part_name,
        'machine_name', machine_name,
        'operator_name', operator_name,
        'completed_at', completed_at,
        'sheets_count', sheets_count,
        'qty_produced', qty_produced,
        'scrap_qty', scrap_qty,
        'is_redo', is_redo
      )
      order by completed_at desc nulls last
    ),
    '[]'::jsonb
  )
  into v_cards
  from matched_cards
  where order_num = p_order_num
    and material_name = p_material_name
    and (sheets_count > 0 or qty_produced > 0 or scrap_qty > 0);

  return v_cards;
end;
$sheets_cards$;

revoke all on function public.get_sheets_report_cards_1c(timestamptz, timestamptz, text, text) from public;
grant execute on function public.get_sheets_report_cards_1c(timestamptz, timestamptz, text, text) to anon, authenticated;

notify pgrst, 'reload schema';
