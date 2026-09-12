-- Read-only verification for 20260912210000_repair_atomic_card_transition.sql.

WITH routine AS (
  SELECT
    procedure.oid,
    procedure.proconfig,
    procedure.proacl,
    procedure.proowner,
    pg_get_functiondef(procedure.oid) AS definition
  FROM pg_proc AS procedure
  JOIN pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
  WHERE namespace.nspname = 'public'
    AND procedure.proname = 'rpc_transition_work_card_atomic'
    AND pg_get_function_identity_arguments(procedure.oid) =
      'p_card_id uuid, p_card_update jsonb, p_history_data jsonb, p_idempotency_key text, p_session_id text'
), checks AS (
  SELECT
    EXISTS (SELECT 1 FROM routine) AS function_found,
    COALESCE((SELECT proconfig @> ARRAY['search_path=pg_catalog, public, auth'] FROM routine), FALSE)
      AS fixed_search_path,
    COALESCE((SELECT position('2026-09-12.atomic_contract_v4' IN definition) > 0 FROM routine), FALSE)
      AS correct_version,
    has_function_privilege(
      'authenticated',
      'public.rpc_transition_work_card_atomic(uuid,jsonb,jsonb,text,text)',
      'EXECUTE'
    ) AS authenticated_can_execute,
    has_function_privilege(
      'anon',
      'public.rpc_transition_work_card_atomic(uuid,jsonb,jsonb,text,text)',
      'EXECUTE'
    ) AS anon_can_execute,
    COALESCE((
      SELECT bool_or(privilege.grantee = 0 AND privilege.privilege_type = 'EXECUTE')
      FROM routine
      CROSS JOIN LATERAL aclexplode(COALESCE(routine.proacl, acldefault('f', routine.proowner))) AS privilege
    ), FALSE) AS public_can_execute
)
SELECT jsonb_build_object(
  'status', CASE
    WHEN function_found
      AND fixed_search_path
      AND correct_version
      AND authenticated_can_execute
      AND NOT anon_can_execute
      AND NOT public_can_execute
    THEN 'PASS'
    ELSE 'FAIL'
  END,
  'function_found', function_found,
  'rpc_version', CASE WHEN correct_version THEN '2026-09-12.atomic_contract_v4' ELSE NULL END,
  'fixed_search_path', fixed_search_path,
  'authenticated_can_execute', authenticated_can_execute,
  'anon_can_execute', anon_can_execute,
  'public_can_execute', public_can_execute
) AS atomic_transition_postcondition
FROM checks;
