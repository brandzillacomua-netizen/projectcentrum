-- Migration: Add a compact polling contract for public machine-call screens
-- rollout-contract: v1
-- risk: low
-- transaction: transactional
-- preflight: supabase/diagnostics/20260914050000_public_machine_call_status_rpc_preflight.sql
-- postcondition: supabase/diagnostics/20260914050000_public_machine_call_status_rpc_postcondition.sql
-- rollback: supabase/rollbacks/20260914050000_public_machine_call_status_rpc_rollback.sql

SET lock_timeout = '5s';
SET statement_timeout = '10s';

BEGIN;

CREATE OR REPLACE FUNCTION public.rpc_public_machine_call_status(p_machine_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
SET statement_timeout = '2s'
AS $$
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', c.id,
        'called_role', c.called_role,
        'created_at', c.created_at
      ) ORDER BY c.created_at
    ),
    '[]'::JSONB
  )
  FROM public.machine_calls AS c
  WHERE c.machine_id = p_machine_id
    AND c.status = 'pending'
$$;

REVOKE ALL ON FUNCTION public.rpc_public_machine_call_status(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_public_machine_call_status(UUID) TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.rpc_public_machine_call_status(UUID) IS
  'Returns only pending public call markers for low-egress QR screen polling.';

COMMIT;
