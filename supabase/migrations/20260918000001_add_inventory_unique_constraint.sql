-- Migration: Add Inventory Unique Constraint
-- rollout-contract: v1
-- risk: low
-- transaction: transactional
-- preflight: supabase/diagnostics/20260918000001_add_inventory_unique_constraint_preflight.sql
-- postcondition: supabase/diagnostics/20260918000001_add_inventory_unique_constraint_postcondition.sql
-- rollback: supabase/rollbacks/20260918000001_add_inventory_unique_constraint_rollback.sql

SET lock_timeout = '5s';
SET statement_timeout = '15s';

BEGIN;

-- 1. Deduplicate existing rows sharing the same (nomenclature_id, type, warehouse)
DO $$
DECLARE
  rec RECORD;
  master_id UUID;
BEGIN
  FOR rec IN
    SELECT nomenclature_id, type, COALESCE(warehouse, 'production') AS warehouse, COUNT(*) as cnt
    FROM public.inventory
    WHERE nomenclature_id IS NOT NULL
    GROUP BY nomenclature_id, type, COALESCE(warehouse, 'production')
    HAVING COUNT(*) > 1
  LOOP
    -- Find master row (largest total_qty)
    SELECT id INTO master_id
    FROM public.inventory
    WHERE nomenclature_id = rec.nomenclature_id 
      AND type = rec.type 
      AND COALESCE(warehouse, 'production') = rec.warehouse
    ORDER BY total_qty DESC, id ASC
    LIMIT 1;

    -- Update master row total_qty & reserved_qty with sum of duplicates
    UPDATE public.inventory
    SET total_qty = (
      SELECT COALESCE(SUM(total_qty), 0)
      FROM public.inventory 
      WHERE nomenclature_id = rec.nomenclature_id 
        AND type = rec.type 
        AND COALESCE(warehouse, 'production') = rec.warehouse
    ),
    reserved_qty = (
      SELECT COALESCE(SUM(reserved_qty), 0)
      FROM public.inventory 
      WHERE nomenclature_id = rec.nomenclature_id 
        AND type = rec.type 
        AND COALESCE(warehouse, 'production') = rec.warehouse
    )
    WHERE id = master_id;

    -- Delete duplicate non-master rows
    DELETE FROM public.inventory
    WHERE nomenclature_id = rec.nomenclature_id 
      AND type = rec.type 
      AND COALESCE(warehouse, 'production') = rec.warehouse
      AND id <> master_id;
  END LOOP;
END $$;

-- 2. Create Unique Partial Index to physically prevent future duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_nom_type_wh 
ON public.inventory (nomenclature_id, type, COALESCE(warehouse, 'production')) 
WHERE nomenclature_id IS NOT NULL;

COMMIT;
