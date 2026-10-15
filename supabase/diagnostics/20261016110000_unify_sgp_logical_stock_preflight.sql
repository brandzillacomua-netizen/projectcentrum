-- Read-only preflight: list SGP identities currently backed by multiple rows.
select
  translate(
    regexp_replace(lower(trim(coalesce(i.name, ''))), '[[:space:]_-]+', '-', 'g'),
    'авекмнорстх',
    'abekmhopctx'
  ) as logical_identity,
  count(*) as physical_rows,
  sum(coalesce(i.total_qty, 0)) as total_qty,
  sum(coalesce(i.reserved_qty, 0)) as reserved_qty
from public.inventory i
where lower(coalesce(i.type, '')) in ('finished', 'part', 'product', 'bz', 'bz_shop2', 'wip_bz', 'semi', 'semi_shop2')
group by translate(
  regexp_replace(lower(trim(coalesce(i.name, ''))), '[[:space:]_-]+', '-', 'g'),
  'авекмнорстх',
  'abekmhopctx'
)
having count(*) > 1
order by physical_rows desc, logical_identity;
