-- Rollback for add_inventory_unique_constraint
BEGIN;
DROP INDEX IF EXISTS idx_inventory_nom_type_wh;
COMMIT;
