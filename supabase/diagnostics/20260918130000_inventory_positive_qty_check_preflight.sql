-- Preflight check for inventory positive qty constraint
SELECT count(*) FROM public.inventory WHERE total_qty < 0 OR reserved_qty < 0;
