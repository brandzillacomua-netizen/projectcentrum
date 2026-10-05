-- rollout-contract: v1
-- risk: low
-- transaction: transactional
-- preflight: supabase/diagnostics/20260922080917_archive_legacy_nomenclatures_preflight.sql
-- postcondition: supabase/diagnostics/20260922080917_archive_legacy_nomenclatures_postcondition.sql
-- rollback: supabase/rollbacks/20260922080917_archive_legacy_nomenclatures_rollback.sql
SET lock_timeout = '5s';
SET statement_timeout = '60s';

BEGIN;

-- Archive all legacy nomenclatures that are still active
UPDATE public.nomenclatures_v2
SET 
  status = 'archived',
  updated_at = clock_timestamp()
WHERE code LIKE 'LEGACY-%'
  AND status = 'active';


COMMIT;
