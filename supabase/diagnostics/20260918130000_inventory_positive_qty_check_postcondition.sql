-- Postcondition check for inventory positive qty constraint
SELECT count(*) FROM pg_constraint WHERE conname IN ('check_inventory_total_qty_positive', 'check_inventory_reserved_qty_positive');
