-- Add explicit Shop 2 routing flags (pressing & painting) to nomenclatures_v2 and nomenclatures
-- Verified against live public schema:
--   nomenclatures_v2: id (uuid), code (text), name (text), rule_params (jsonb)
--   nomenclatures: id (uuid), name (text) [no code, no rule_params]
--   nomenclature_catalog_profiles: nomenclature_id (uuid), catalog_code (text)

alter table public.nomenclatures_v2
  add column if not exists requires_pressing boolean not null default false,
  add column if not exists requires_painting boolean not null default false;

alter table public.nomenclatures
  add column if not exists requires_pressing boolean not null default false,
  add column if not exists requires_painting boolean not null default false;

-- 1) Backfill nomenclatures_v2 from rule_params JSONB safely
update public.nomenclatures_v2
set
  requires_pressing = coalesce(
    case
      when lower(rule_params->>'requiresPressing') in ('true', 't', '1', 'yes') then true
      when lower(rule_params->>'requiresPressing') in ('false', 'f', '0', 'no') then false
      else null
    end,
    case
      when lower(rule_params->>'requires_pressing') in ('true', 't', '1', 'yes') then true
      when lower(rule_params->>'requires_pressing') in ('false', 'f', '0', 'no') then false
      else null
    end,
    requires_pressing,
    false
  ),
  requires_painting = coalesce(
    case
      when lower(rule_params->>'requiresPainting') in ('true', 't', '1', 'yes') then true
      when lower(rule_params->>'requiresPainting') in ('false', 'f', '0', 'no') then false
      else null
    end,
    case
      when lower(rule_params->>'requires_painting') in ('true', 't', '1', 'yes') then true
      when lower(rule_params->>'requires_painting') in ('false', 'f', '0', 'no') then false
      else null
    end,
    requires_painting,
    false
  )
where rule_params is not null;

-- 2) Sync flags from nomenclatures_v2 into legacy nomenclatures via matching UUID id or catalog profile code
update public.nomenclatures n
set
  requires_pressing = coalesce(n.requires_pressing, false) or coalesce(v2.requires_pressing, false),
  requires_painting = coalesce(n.requires_painting, false) or coalesce(v2.requires_painting, false)
from public.nomenclatures_v2 v2
left join public.nomenclature_catalog_profiles p
  on p.catalog_code = v2.code
where n.id = v2.id
   or (p.nomenclature_id is not null and n.id = p.nomenclature_id);
