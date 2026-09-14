SELECT
  to_regclass('public.machine_calls') IS NOT NULL AS machine_calls_exists,
  to_regprocedure('public.rpc_public_machine_call_context(uuid)') IS NOT NULL AS context_rpc_exists;
