-- Migration: Revoke Anonymous Access from VKYA Classification Queue Changes RPC
-- rollout-contract: v1
-- risk: low
-- transaction: transactional
-- preflight: supabase/diagnostics/20260915000000_revoke_anon_vkya_rpc_preflight.sql
-- postcondition: supabase/diagnostics/20260915000000_revoke_anon_vkya_rpc_postcondition.sql
-- rollback: supabase/rollbacks/20260915000000_revoke_anon_vkya_rpc_rollback.sql

SET lock_timeout = '5s';
SET statement_timeout = '10s';

BEGIN;

revoke execute on function public.vkya_classification_queue_changes(bigint) from anon;

COMMIT;
