-- Wave C preflight: low-volume configuration and catalog tables.
-- Read-only. Returns one consolidated JSON result for easy review.

WITH candidate_tables(table_name, write_right) AS (
  VALUES
    ('system_configs'::TEXT, 'settings'::TEXT),
    ('nomenclature_prices'::TEXT, 'economy'::TEXT),
    ('scrap_reasons'::TEXT, 'brak'::TEXT),
    ('vkya_restoration_stages'::TEXT, 'brak'::TEXT)
), table_health AS (
  SELECT
    candidates.table_name,
    candidates.write_right,
    COALESCE(classes.relrowsecurity, FALSE) AS rls_enabled,
    COALESCE(classes.relforcerowsecurity, FALSE) AS rls_forced,
    CASE
      WHEN classes.oid IS NULL THEN NULL
      ELSE GREATEST(classes.reltuples, 0)::BIGINT
    END AS estimated_row_count,
    CASE WHEN classes.oid IS NULL THEN 'TABLE_NOT_FOUND' ELSE 'OK' END AS table_status
  FROM candidate_tables AS candidates
  LEFT JOIN pg_catalog.pg_class AS classes
    ON classes.relname = candidates.table_name
   AND classes.relnamespace = 'public'::regnamespace
), relevant_grants AS (
  SELECT
    grants.table_name,
    grants.grantee,
    grants.privilege_type
  FROM information_schema.role_table_grants AS grants
  WHERE grants.table_schema = 'public'
    AND grants.table_name IN (SELECT table_name FROM candidate_tables)
    AND grants.grantee IN ('anon', 'authenticated', 'PUBLIC')
), relevant_policies AS (
  SELECT
    policies.tablename AS table_name,
    policies.policyname AS policy_name,
    policies.permissive,
    policies.roles,
    policies.cmd,
    policies.qual AS using_expression,
    policies.with_check AS check_expression
  FROM pg_catalog.pg_policies AS policies
  WHERE policies.schemaname = 'public'
    AND policies.tablename IN (SELECT table_name FROM candidate_tables)
), required_rights(access_right) AS (
  VALUES ('settings'::TEXT), ('economy'::TEXT), ('brak'::TEXT)
), right_holders AS (
  SELECT
    required_rights.access_right,
    COUNT(users.id) FILTER (
      WHERE LOWER(COALESCE(users.access_rights->>required_rights.access_right, 'false')) IN ('true', '1')
    ) AS explicitly_authorized_users,
    COUNT(users.id) FILTER (
      WHERE required_rights.access_right = 'settings'
        AND (
          LOWER(COALESCE(users.position, '')) LIKE '%адмін%'
          OR LOWER(COALESCE(users.login, '')) = 'admin@workshop.local'
        )
    ) AS settings_admin_fallback_users
  FROM required_rights
  CROSS JOIN public.system_users AS users
  GROUP BY required_rights.access_right
)
SELECT jsonb_build_object(
  'tables', COALESCE(
    (SELECT jsonb_agg(to_jsonb(table_health) ORDER BY table_health.table_name) FROM table_health),
    '[]'::JSONB
  ),
  'grants', COALESCE(
    (SELECT jsonb_agg(to_jsonb(relevant_grants) ORDER BY relevant_grants.table_name, relevant_grants.grantee, relevant_grants.privilege_type) FROM relevant_grants),
    '[]'::JSONB
  ),
  'policies', COALESCE(
    (SELECT jsonb_agg(to_jsonb(relevant_policies) ORDER BY relevant_policies.table_name, relevant_policies.cmd, relevant_policies.policy_name) FROM relevant_policies),
    '[]'::JSONB
  ),
  'authorized_users', COALESCE(
    (SELECT jsonb_agg(to_jsonb(right_holders) ORDER BY right_holders.access_right) FROM right_holders),
    '[]'::JSONB
  )
) AS wave_c_preflight;
