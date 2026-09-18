-- Preflight for add_inventory_unique_constraint
SELECT count(*) FROM pg_indexes WHERE indexname = 'idx_inventory_nom_type_wh';
