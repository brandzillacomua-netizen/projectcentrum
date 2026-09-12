-- Read-only staging inventory. Run only in qpiysrkhvdgctaqmfsew.

WITH project_guard AS (
  SELECT current_database() AS database_name
), table_acl AS (
  SELECT
    table_name,
    grantee,
    privilege_type
  FROM information_schema.table_privileges
  WHERE table_schema = 'public'
    AND grantee IN ('anon', 'PUBLIC')
), column_acl AS (
  SELECT
    table_name,
    column_name,
    grantee,
    privilege_type
  FROM information_schema.column_privileges
  WHERE table_schema = 'public'
    AND grantee IN ('anon', 'PUBLIC')
), exposed_policies AS (
  SELECT
    tablename AS table_name,
    policyname AS policy_name,
    cmd AS command,
    roles,
    qual,
    with_check
  FROM pg_policies
  WHERE schemaname = 'public'
    AND ('anon' = ANY(roles) OR 'public' = ANY(roles))
), routine_acl AS (
  SELECT
    procedure.proname AS routine_name,
    procedure.oid::regprocedure::TEXT AS signature,
    has_function_privilege('anon', procedure.oid, 'EXECUTE') AS anon_has_privilege,
    EXISTS (
      SELECT 1
      FROM pg_depend AS dependency
      WHERE dependency.classid = 'pg_proc'::regclass
        AND dependency.objid = procedure.oid
        AND dependency.deptype = 'e'
    ) AS extension_owned
  FROM pg_proc AS procedure
  JOIN pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
  WHERE namespace.nspname = 'public'
    AND has_function_privilege('anon', procedure.oid, 'EXECUTE')
), rls_state AS (
  SELECT
    relation.relname AS table_name,
    relation.relrowsecurity AS rls_enabled,
    relation.relforcerowsecurity AS rls_forced
  FROM pg_class AS relation
  JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
  WHERE namespace.nspname = 'public'
    AND relation.relkind IN ('r', 'p')
), default_acl AS (
  SELECT
    pg_get_userbyid(defaults.defaclrole) AS owner_name,
    COALESCE(namespace.nspname, '*') AS schema_name,
    defaults.defaclobjtype AS object_type,
    COALESCE(pg_get_userbyid(privilege.grantee), 'PUBLIC') AS grantee,
    privilege.privilege_type
  FROM pg_default_acl AS defaults
  LEFT JOIN pg_namespace AS namespace ON namespace.oid = defaults.defaclnamespace
  CROSS JOIN LATERAL aclexplode(defaults.defaclacl) AS privilege
  WHERE namespace.nspname = 'public'
    AND COALESCE(pg_get_userbyid(privilege.grantee), 'PUBLIC') IN ('anon', 'PUBLIC')
), summary AS (
  SELECT
    (SELECT COUNT(*) FROM table_acl) AS table_privileges,
    (SELECT COUNT(*) FROM column_acl) AS column_privileges,
    (SELECT COUNT(*) FROM exposed_policies) AS exposed_policies,
    (SELECT COUNT(*) FROM routine_acl WHERE NOT extension_owned) AS non_extension_routines,
    (SELECT COUNT(*) FROM rls_state WHERE NOT rls_enabled) AS tables_without_rls,
    (SELECT COUNT(*) FROM default_acl) AS unsafe_defaults
)
SELECT jsonb_build_object(
  'database_name', project_guard.database_name,
  'status', CASE
    WHEN summary.table_privileges = 0
      AND summary.column_privileges = 0
      AND summary.exposed_policies = 0
      AND summary.non_extension_routines = 0
      AND summary.tables_without_rls = 0
      AND summary.unsafe_defaults = 0
    THEN 'LOCKED'
    ELSE 'EXPOSED'
  END,
  'summary', to_jsonb(summary),
  'table_privileges', COALESCE(
    (SELECT jsonb_agg(to_jsonb(acl) ORDER BY acl.table_name, acl.grantee, acl.privilege_type) FROM table_acl AS acl),
    '[]'::JSONB
  ),
  'column_privileges', COALESCE(
    (SELECT jsonb_agg(to_jsonb(acl) ORDER BY acl.table_name, acl.column_name, acl.grantee, acl.privilege_type) FROM column_acl AS acl),
    '[]'::JSONB
  ),
  'policies', COALESCE(
    (SELECT jsonb_agg(to_jsonb(policy) ORDER BY policy.table_name, policy.policy_name) FROM exposed_policies AS policy),
    '[]'::JSONB
  ),
  'routines', COALESCE(
    (SELECT jsonb_agg(to_jsonb(routine) ORDER BY routine.routine_name, routine.signature) FROM routine_acl AS routine),
    '[]'::JSONB
  ),
  'tables_without_rls', COALESCE(
    (SELECT jsonb_agg(to_jsonb(state) ORDER BY state.table_name) FROM rls_state AS state WHERE NOT state.rls_enabled),
    '[]'::JSONB
  ),
  'default_privileges', COALESCE(
    (SELECT jsonb_agg(to_jsonb(acl) ORDER BY acl.owner_name, acl.schema_name, acl.object_type, acl.grantee, acl.privilege_type) FROM default_acl AS acl),
    '[]'::JSONB
  )
) AS staging_anonymous_surface_preflight
FROM summary
CROSS JOIN project_guard;
