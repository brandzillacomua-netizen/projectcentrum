-- Read-only post-deploy verification for Wave C1 catalog RBAC.

WITH expected_grants(table_name, grantee, privilege_type) AS (
  VALUES
    ('system_configs'::TEXT, 'authenticated'::TEXT, 'SELECT'::TEXT),
    ('system_configs', 'authenticated', 'INSERT'),
    ('system_configs', 'authenticated', 'UPDATE'),
    ('scrap_reasons', 'authenticated', 'SELECT'),
    ('scrap_reasons', 'authenticated', 'INSERT'),
    ('scrap_reasons', 'authenticated', 'UPDATE'),
    ('scrap_reasons', 'authenticated', 'DELETE'),
    ('vkya_restoration_stages', 'authenticated', 'SELECT'),
    ('vkya_restoration_stages', 'authenticated', 'INSERT'),
    ('vkya_restoration_stages', 'authenticated', 'UPDATE'),
    ('vkya_restoration_stages', 'authenticated', 'DELETE')
), actual_grants AS (
  SELECT table_name::TEXT, grantee::TEXT, privilege_type::TEXT
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public'
    AND table_name IN ('system_configs', 'scrap_reasons', 'vkya_restoration_stages')
    AND grantee IN ('PUBLIC', 'anon', 'authenticated')
), grant_differences AS (
  SELECT 'MISSING'::TEXT AS difference, expected.*
  FROM expected_grants AS expected
  LEFT JOIN actual_grants AS actual USING (table_name, grantee, privilege_type)
  WHERE actual.table_name IS NULL
  UNION ALL
  SELECT 'UNEXPECTED', actual.*
  FROM actual_grants AS actual
  LEFT JOIN expected_grants AS expected USING (table_name, grantee, privilege_type)
  WHERE expected.table_name IS NULL
), expected_policies(table_name, policy_name, command) AS (
  VALUES
    ('system_configs'::TEXT, 'system_configs_authenticated_read'::TEXT, 'SELECT'::TEXT),
    ('system_configs', 'system_configs_settings_insert', 'INSERT'),
    ('system_configs', 'system_configs_settings_update', 'UPDATE'),
    ('scrap_reasons', 'scrap_reasons_authenticated_read', 'SELECT'),
    ('scrap_reasons', 'scrap_reasons_brak_insert', 'INSERT'),
    ('scrap_reasons', 'scrap_reasons_brak_update', 'UPDATE'),
    ('scrap_reasons', 'scrap_reasons_brak_delete', 'DELETE'),
    ('vkya_restoration_stages', 'vkya_restoration_stages_authenticated_read', 'SELECT'),
    ('vkya_restoration_stages', 'vkya_restoration_stages_brak_insert', 'INSERT'),
    ('vkya_restoration_stages', 'vkya_restoration_stages_brak_update', 'UPDATE'),
    ('vkya_restoration_stages', 'vkya_restoration_stages_brak_delete', 'DELETE')
), actual_policies AS (
  SELECT tablename::TEXT AS table_name, policyname::TEXT AS policy_name, cmd::TEXT AS command,
    roles, qual, with_check
  FROM pg_catalog.pg_policies
  WHERE schemaname = 'public'
    AND tablename IN ('system_configs', 'scrap_reasons', 'vkya_restoration_stages')
), policy_differences AS (
  SELECT 'MISSING'::TEXT AS difference, expected.table_name, expected.policy_name, expected.command
  FROM expected_policies AS expected
  LEFT JOIN actual_policies AS actual USING (table_name, policy_name, command)
  WHERE actual.table_name IS NULL
  UNION ALL
  SELECT 'UNEXPECTED', actual.table_name, actual.policy_name, actual.command
  FROM actual_policies AS actual
  LEFT JOIN expected_policies AS expected USING (table_name, policy_name, command)
  WHERE expected.table_name IS NULL
), unsafe_write_policies AS (
  SELECT table_name, policy_name, command
  FROM actual_policies
  WHERE command IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')
    AND (
      COALESCE(qual, '') = 'true'
      OR COALESCE(with_check, '') = 'true'
      OR COALESCE(qual, with_check, '') NOT LIKE '%auth_user_id%'
    )
), table_health AS (
  SELECT classes.relname AS table_name, classes.relrowsecurity AS rls_enabled
  FROM pg_catalog.pg_class AS classes
  WHERE classes.relnamespace = 'public'::regnamespace
    AND classes.relname IN ('system_configs', 'scrap_reasons', 'vkya_restoration_stages')
), totals AS (
  SELECT
    (SELECT COUNT(*) FROM grant_differences) AS grant_differences,
    (SELECT COUNT(*) FROM policy_differences) AS policy_differences,
    (SELECT COUNT(*) FROM unsafe_write_policies) AS unsafe_write_policies,
    (SELECT COUNT(*) FROM table_health WHERE NOT rls_enabled) AS tables_without_rls,
    (SELECT COUNT(*) FROM table_health) AS target_tables_found
)
SELECT jsonb_build_object(
  'status', CASE
    WHEN grant_differences = 0
      AND policy_differences = 0
      AND unsafe_write_policies = 0
      AND tables_without_rls = 0
      AND target_tables_found = 3
    THEN 'PASS'
    ELSE 'FAIL'
  END,
  'grant_differences', grant_differences,
  'policy_differences', policy_differences,
  'unsafe_write_policies', unsafe_write_policies,
  'tables_without_rls', tables_without_rls,
  'target_tables_found', target_tables_found
) AS wave_c_postcondition
FROM totals;
