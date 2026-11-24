-- Add painting_units_per_shelf (capacity per painting shelf/cassette) to nomenclatures_v2 and nomenclatures
SET lock_timeout = '5s';
SET statement_timeout = '30s';

ALTER TABLE public.nomenclatures_v2
  ADD COLUMN IF NOT EXISTS painting_units_per_shelf INTEGER;

ALTER TABLE public.nomenclatures
  ADD COLUMN IF NOT EXISTS painting_units_per_shelf INTEGER;

UPDATE public.nomenclatures_v2
SET painting_units_per_shelf = NULLIF(
  regexp_replace(
    COALESCE(rule_params->>'paintingUnitsPerShelf', rule_params->>'painting_units_per_shelf', ''),
    '[^0-9]',
    '',
    'g'
  ),
  ''
)::INTEGER
WHERE rule_params IS NOT NULL
  AND painting_units_per_shelf IS NULL
  AND COALESCE(rule_params->>'paintingUnitsPerShelf', rule_params->>'painting_units_per_shelf', '') ~ '^[0-9]+$';
