-- Migration: Redesign nomenclatures table fields
-- Adds characteristic, description, qty_per_unit, option_label, color, and additional_info columns

ALTER TABLE nomenclatures
  ADD COLUMN IF NOT EXISTS characteristic TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS qty_per_unit NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS option_label TEXT,
  ADD COLUMN IF NOT EXISTS color TEXT,
  ADD COLUMN IF NOT EXISTS additional_info TEXT;

-- Data migration: Move existing standard names / descriptions from material_type column to the new description column
-- only for non-detail/non-raw items (hardware, consumables, products) where material_type was used as a workaround.
UPDATE nomenclatures
SET 
  description = material_type,
  material_type = NULL
WHERE type IN ('hardware', 'consumable', 'product') 
  AND material_type IS NOT NULL 
  AND material_type != '' 
  AND material_type != 'Збірка';

-- Verify columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'nomenclatures';
