-- Migration: Inventory Positive Quantity Check Constraints
-- rollout-contract: v1
-- risk: low
-- transaction: transactional
-- preflight: supabase/diagnostics/20260918130000_inventory_positive_qty_check_preflight.sql
-- postcondition: supabase/diagnostics/20260918130000_inventory_positive_qty_check_postcondition.sql
-- rollback: supabase/rollbacks/20260918130000_inventory_positive_qty_check_rollback.sql

SET lock_timeout = '5s';
SET statement_timeout = '30s';

BEGIN;

-- 1. Pre-cleaning: normalize negative values to 0 before adding constraint
UPDATE public.inventory
SET total_qty = 0
WHERE total_qty < 0;

UPDATE public.inventory
SET reserved_qty = 0
WHERE reserved_qty < 0;

-- 2. Add CHECK constraints if not existing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_inventory_total_qty_positive'
  ) THEN
    ALTER TABLE public.inventory 
    ADD CONSTRAINT check_inventory_total_qty_positive CHECK (total_qty >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_inventory_reserved_qty_positive'
  ) THEN
    ALTER TABLE public.inventory 
    ADD CONSTRAINT check_inventory_reserved_qty_positive CHECK (reserved_qty >= 0);
  END IF;
END $$;

COMMIT;
