-- Clean up test rows inserted during debugging
DELETE FROM packaging_boxes WHERE box_number IN ('TEST', 'TEST2');

-- Alter nomenclature_id column from integer to uuid
-- (nomenclatures table uses UUID primary keys)
ALTER TABLE packaging_boxes 
  ALTER COLUMN nomenclature_id TYPE uuid USING nomenclature_id::text::uuid;
