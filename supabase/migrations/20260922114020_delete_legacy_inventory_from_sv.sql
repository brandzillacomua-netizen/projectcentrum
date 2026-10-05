-- rollout-contract: v1
-- risk: low
-- transaction: transactional
-- preflight: supabase/diagnostics/20260922114020_delete_legacy_inventory_from_sv_preflight.sql
-- postcondition: supabase/diagnostics/20260922114020_delete_legacy_inventory_from_sv_postcondition.sql
-- rollback: supabase/rollbacks/20260922114020_delete_legacy_inventory_from_sv_rollback.sql
SET lock_timeout = '5s';
SET statement_timeout = '60s';

BEGIN;

-- Delete all inventory items from the Production Warehouse (СВ) that belong to legacy nomenclatures
DELETE FROM public.inventory
WHERE warehouse = 'production'
  AND nomenclature_id IN (
    SELECT id
    FROM public.nomenclatures_v2
    WHERE code LIKE 'LEGACY-%'
  );


COMMIT;
