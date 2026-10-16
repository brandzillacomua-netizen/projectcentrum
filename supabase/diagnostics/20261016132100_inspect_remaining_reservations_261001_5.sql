-- READ ONLY: identify every remaining SGP reservation source for shipped order 261001-5.
with
target_order as (
  select id, order_num, status
  from public.orders
  where order_num = '261001-5'
),
target_tasks as (
  select t.id, t.order_id, t.status, t.plan_snapshot
  from public.tasks t
  join target_order o on o.id = t.order_id
),
manifest(nomenclature_name, shipped_qty) as (
  values
    ('F415-ІП27-П-10-38'::text, 14000::numeric),
    ('F415-421-ІП27-В-3-26', 3500),
    ('F415-421-ІП27-Н-3-26', 3500),
    ('F415-ІП27-К-3-9', 3500),
    ('F415-ІП27-Хверх-4-74', 3500),
    ('F415-ІП27-Хниз-4-74', 3500),
    ('F415-ІП27-Хрестик-4-74', 7000),
    ('KF-Пластинка-3-162', 14000)
),
target_nomenclatures as (
  select m.nomenclature_name, m.shipped_qty, n.id as canonical_id, n.code
  from manifest m
  left join public.nomenclatures_v2 n on n.name = m.nomenclature_name
),
target_inventory as (
  select
    tn.nomenclature_name,
    tn.code,
    tn.shipped_qty,
    i.id as inventory_id,
    i.nomenclature_id,
    i.name as inventory_name,
    i.warehouse,
    i.type,
    i.total_qty,
    i.reserved_qty
  from target_nomenclatures tn
  left join public.inventory i
    on (
      i.nomenclature_id = tn.canonical_id
      or exists (
        select 1
        from public.nomenclature_v2_aliases a
        where a.legacy_id = i.nomenclature_id
          and a.canonical_id = tn.canonical_id
      )
    )
    and (
      i.warehouse = 'sgp'
      or lower(coalesce(i.type, '')) in (
        'finished', 'part', 'product', 'bz', 'bz_shop2',
        'wip_bz', 'semi', 'semi_shop2'
      )
    )
),
inventory_summary as (
  select
    nomenclature_name,
    code,
    shipped_qty,
    coalesce(sum(total_qty), 0) as total_qty,
    coalesce(sum(reserved_qty), 0) as reserved_qty,
    coalesce(sum(total_qty - reserved_qty), 0) as free_qty,
    jsonb_agg(
      jsonb_build_object(
        'inventory_id', inventory_id,
        'inventory_name', inventory_name,
        'warehouse', warehouse,
        'type', type,
        'total_qty', total_qty,
        'reserved_qty', reserved_qty
      ) order by inventory_id
    ) filter (where inventory_id is not null) as physical_rows
  from target_inventory
  group by nomenclature_name, code, shipped_qty
),
request_rows as (
  select
    mr.id,
    mr.order_id,
    mr.task_id,
    mr.inventory_id,
    mr.nomenclature_id,
    mr.quantity,
    mr.status,
    mr.details,
    mr.created_at,
    case
      when mr.order_id = (select id from target_order) then true
      when mr.task_id in (select id from target_tasks) then true
      else false
    end as belongs_to_order,
    isummary.nomenclature_name
  from public.material_requests mr
  left join inventory_summary isummary
    on mr.nomenclature_id in (
      select tn.canonical_id
      from target_nomenclatures tn
      where tn.nomenclature_name = isummary.nomenclature_name
    )
    or mr.inventory_id in (
      select ti.inventory_id
      from target_inventory ti
      where ti.nomenclature_name = isummary.nomenclature_name
    )
  where mr.order_id = (select id from target_order)
     or mr.task_id in (select id from target_tasks)
     or mr.inventory_id in (select inventory_id from target_inventory where inventory_id is not null)
),
bz_rows as (
  select r.*
  from public.bz_inventory_reservations r
  where r.order_id = (select id from target_order)
     or r.task_id in (select id from target_tasks)
)
select jsonb_pretty(jsonb_build_object(
  'order', (select to_jsonb(o) from target_order o),
  'inventory', coalesce((
    select jsonb_agg(to_jsonb(s) order by s.nomenclature_name)
    from inventory_summary s
  ), '[]'::jsonb),
  'material_requests', coalesce((
    select jsonb_agg(to_jsonb(r) order by r.created_at, r.id)
    from request_rows r
  ), '[]'::jsonb),
  'bz_reservations', coalesce((
    select jsonb_agg(to_jsonb(b) order by b.created_at, b.id)
    from bz_rows b
  ), '[]'::jsonb),
  'tasks', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', t.id,
      'status', t.status,
      'plan_snapshot', t.plan_snapshot
    ) order by t.id)
    from target_tasks t
  ), '[]'::jsonb)
)) as diagnostic;
