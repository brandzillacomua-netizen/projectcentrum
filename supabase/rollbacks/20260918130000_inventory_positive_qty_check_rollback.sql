-- Rollback for inventory positive qty constraint
BEGIN;
ALTER TABLE public.inventory DROP CONSTRAINT IF EXISTS check_inventory_total_qty_positive;
ALTER TABLE public.inventory DROP CONSTRAINT IF EXISTS check_inventory_reserved_qty_positive;
COMMIT;
