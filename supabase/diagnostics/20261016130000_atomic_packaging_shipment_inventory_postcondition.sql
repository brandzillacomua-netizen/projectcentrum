select
  to_regprocedure('public.complete_packaging_shipment(uuid,uuid[],jsonb)') is not null
    as has_atomic_packaging_shipment;
