-- Archive all legacy nomenclatures that are still active
UPDATE public.nomenclatures_v2
SET 
  status = 'archived',
  updated_at = clock_timestamp()
WHERE code LIKE 'LEGACY-%'
  AND status = 'active';
