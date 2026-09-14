SELECT
  to_regprocedure('public.rpc_public_machine_call_status(uuid)') IS NOT NULL AS status_rpc_exists,
  has_function_privilege('anon', 'public.rpc_public_machine_call_status(uuid)', 'EXECUTE') AS anon_can_execute,
  NOT has_table_privilege('anon', 'public.machine_calls', 'SELECT') AS raw_table_stays_private;
