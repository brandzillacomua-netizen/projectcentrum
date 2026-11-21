-- Release stale [AUTO_SHOP2_RESERVATION] rows so SGP reserved_qty reflects only:
-- 1) Explicit AUTO_SGP_RESERVATION taken when creating a new naryad
-- 2) Explicitly issued packaging requests awaiting shipment

SET lock_timeout = '5s';
SET statement_timeout = '60s';

BEGIN;

UPDATE public.material_requests
SET
  status = 'cancelled',
  details = COALESCE(details, '') || ' [AUTO_SHOP2_RESERVATION_RELEASED]'
WHERE status = 'issued'
  AND details ILIKE '%[AUTO_SHOP2_RESERVATION]%';

COMMIT;
