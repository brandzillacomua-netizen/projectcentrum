do $preflight$
begin
  if to_regclass('public.material_requests') is null then
    raise exception 'Missing public.material_requests';
  end if;
  if to_regclass('public.inventory') is null then
    raise exception 'Missing public.inventory';
  end if;
  if to_regprocedure('public.reconcile_inventory_reserve()') is null then
    raise exception 'Missing reservation reconciliation trigger function';
  end if;
end;
$preflight$;
