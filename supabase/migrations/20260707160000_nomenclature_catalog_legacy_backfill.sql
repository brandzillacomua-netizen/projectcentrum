-- Safe, idempotent legacy classification for Nomenclature LAB.
-- Existing nomenclatures rows are not updated; only catalog profiles are added.

insert into public.nomenclature_catalog_profiles (
  nomenclature_id,
  class_id,
  group_id,
  base_unit_id,
  display_name,
  lifecycle_status,
  migration_state
)
select
  n.id,
  c.id,
  g.id,
  pcs.id,
  n.name,
  'active',
  'suggested'
from public.nomenclatures n
join public.nomenclature_classes c on c.code = case
  when lower(coalesce(n.name, '')) like '%фрез%' or lower(coalesce(n.name, '')) like '%свердл%' then 'tool'
  when lower(coalesce(n.name, '')) like '%болт%'
    or lower(coalesce(n.name, '')) like '%гайк%'
    or lower(coalesce(n.name, '')) like '%шайб%'
    or lower(coalesce(n.name, '')) like '%заклеп%' then 'hardware'
  when lower(coalesce(n.name, '')) like '%лист%'
    or lower(coalesce(n.name, '')) like '%профіл%'
    or lower(coalesce(n.name, '')) like '%труб%' then 'raw_material'
  when lower(coalesce(n.type, '')) in ('raw', 'material') then 'raw_material'
  when lower(coalesce(n.type, '')) in ('hardware', 'fastener') then 'hardware'
  when lower(coalesce(n.type, '')) in ('part', 'detail') then 'part'
  when lower(coalesce(n.type, '')) in ('tool', 'instrument') then 'tool'
  when lower(coalesce(n.type, '')) = 'consumable'
    and (lower(coalesce(n.name, '')) like '%фрез%' or lower(coalesce(n.name, '')) like '%свердл%') then 'tool'
  when lower(coalesce(n.type, '')) in ('product', 'assembly', 'finished') then 'legacy_product'
  else null
end
left join public.nomenclature_catalog_groups g on g.code = case
  when lower(coalesce(n.name, '')) like '%лист%' then 'RAW.SHEET'
  when lower(coalesce(n.name, '')) like '%профіл%' or lower(coalesce(n.name, '')) like '%труб%' then 'RAW.PROFILE'
  when lower(coalesce(n.name, '')) like '%кле%' then 'RAW.CHEM'
  when lower(coalesce(n.name, '')) like '%прес%гайк%' then 'HW.PRESS_NUT'
  when lower(coalesce(n.name, '')) like '%гайк%' then 'HW.NUT'
  when lower(coalesce(n.name, '')) like '%болт%' then 'HW.BOLT'
  when lower(coalesce(n.name, '')) like '%шайб%' then 'HW.WASHER'
  when lower(coalesce(n.name, '')) like '%заклеп%' then 'HW.RIVET'
  when lower(coalesce(n.name, '')) like '%фрез%' then 'TOOL.MILL'
  when lower(coalesce(n.name, '')) like '%свердл%' then 'TOOL.DRILL'
  when lower(coalesce(n.type, '')) in ('part', 'detail') then 'PART'
  when lower(coalesce(n.type, '')) in ('hardware', 'fastener') then 'HW'
  when lower(coalesce(n.type, '')) in ('raw', 'material') then 'RAW'
  when lower(coalesce(n.type, '')) in ('tool', 'instrument') then 'TOOL'
  else null
end
join public.nomenclature_units pcs on pcs.code = 'pcs'
where not exists (
  select 1
  from public.nomenclature_catalog_profiles existing
  where existing.nomenclature_id = n.id
);

-- Extract only confident sheet attributes. Values remain suggestions until reviewed.
insert into public.nomenclature_attribute_values (nomenclature_id, attribute_id, value_text)
select p.nomenclature_id, a.id,
  case
    when upper(coalesce(n.name, '') || ' ' || coalesce(n.material_type, '')) like '%T700%' then 'T700'
    when upper(coalesce(n.name, '') || ' ' || coalesce(n.material_type, '')) like '%Т700%' then 'T700'
    when upper(coalesce(n.name, '') || ' ' || coalesce(n.material_type, '')) like '%T300%' then 'T300'
    when upper(coalesce(n.name, '') || ' ' || coalesce(n.material_type, '')) like '%Т300%' then 'T300'
  end
from public.nomenclature_catalog_profiles p
join public.nomenclatures n on n.id = p.nomenclature_id
join public.nomenclature_catalog_groups g on g.id = p.group_id and g.code = 'RAW.SHEET'
join public.nomenclature_attribute_definitions a on a.code = 'material_grade'
where upper(coalesce(n.name, '') || ' ' || coalesce(n.material_type, '')) similar to '%(T|Т)(300|700)%'
on conflict (nomenclature_id, attribute_id) do nothing;
