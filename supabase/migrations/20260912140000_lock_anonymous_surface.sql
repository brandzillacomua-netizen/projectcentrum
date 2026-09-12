-- Global anonymous-surface lockdown.
-- Apply after the RPC client and both machine-call migrations are deployed.
-- Direct public-schema access is denied to anon; only the two QR RPCs remain.

DROP TABLE IF EXISTS pg_temp.mes_authenticated_execute_snapshot;
CREATE TEMP TABLE mes_authenticated_execute_snapshot (
  role_name NAME NOT NULL,
  function_oid OID NOT NULL,
  PRIMARY KEY (role_name, function_oid)
);

INSERT INTO mes_authenticated_execute_snapshot(role_name, function_oid)
SELECT role_name, p.oid
FROM (VALUES ('authenticated'::NAME), ('service_role'::NAME)) AS roles(role_name)
CROSS JOIN pg_proc AS p
JOIN pg_namespace AS n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND has_function_privilege(role_name, p.oid, 'EXECUTE');

-- Function EXECUTE defaults to PUBLIC in PostgreSQL. Remove that implicit path,
-- then restore exactly the access authenticated/service roles had beforehand.
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon;

DO $$
DECLARE permission_row RECORD;
BEGIN
  FOR permission_row IN
    SELECT s.role_name, s.function_oid::regprocedure AS function_signature
    FROM mes_authenticated_execute_snapshot AS s
  LOOP
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION %s TO %I',
      permission_row.function_signature,
      permission_row.role_name
    );
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_public_machine_call_context(UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_public_create_machine_call(UUID, TEXT, TEXT, BIGINT) TO anon, authenticated, service_role;

-- Revoke both table-level and any legacy column-level grants.
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM anon;

DO $$
DECLARE column_grant RECORD;
BEGIN
  FOR column_grant IN
    SELECT
      table_schema,
      table_name,
      privilege_type,
      string_agg(format('%I', column_name), ', ' ORDER BY ordinal_position) AS column_list
    FROM information_schema.column_privileges
    JOIN information_schema.columns USING (table_schema, table_name, column_name)
    WHERE grantee = 'anon'
      AND table_schema = 'public'
      AND privilege_type IN ('SELECT', 'INSERT', 'UPDATE', 'REFERENCES')
    GROUP BY table_schema, table_name, privilege_type
  LOOP
    EXECUTE format(
      'REVOKE %s (%s) ON TABLE %I.%I FROM anon',
      column_grant.privilege_type,
      column_grant.column_list,
      column_grant.table_schema,
      column_grant.table_name
    );
  END LOOP;
END;
$$;

-- Remove anon/PUBLIC from policies as well, so an accidental future table grant
-- cannot silently reactivate the old exposure. Existing authenticated predicates
-- remain unchanged.
DO $$
DECLARE
  policy_row RECORD;
  retained_roles TEXT;
BEGIN
  FOR policy_row IN
    SELECT schemaname, tablename, policyname, roles
    FROM pg_policies
    WHERE schemaname = 'public'
      AND ('anon' = ANY(roles) OR 'public' = ANY(roles))
  LOOP
    SELECT string_agg(format('%I', role_name), ', ' ORDER BY role_name)
    INTO retained_roles
    FROM (
      SELECT DISTINCT role_name
      FROM unnest(policy_row.roles) AS role_name
      WHERE role_name NOT IN ('anon', 'public')
      UNION
      SELECT 'authenticated'
      WHERE 'public' = ANY(policy_row.roles)
    ) AS retained;

    IF retained_roles IS NULL THEN
      EXECUTE format(
        'DROP POLICY IF EXISTS %I ON %I.%I',
        policy_row.policyname,
        policy_row.schemaname,
        policy_row.tablename
      );
    ELSE
      EXECUTE format(
        'ALTER POLICY %I ON %I.%I TO %s',
        policy_row.policyname,
        policy_row.schemaname,
        policy_row.tablename,
        retained_roles
      );
    END IF;
  END LOOP;
END;
$$;

-- Safe defaults for objects created by this migration owner in the future.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon;

-- Postconditions: abort the migration if any direct anonymous ACL survived.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_privileges
    WHERE grantee = 'anon' AND table_schema = 'public'
  ) OR EXISTS (
    SELECT 1 FROM information_schema.column_privileges
    WHERE grantee = 'anon' AND table_schema = 'public'
  ) OR EXISTS (
    SELECT 1 FROM information_schema.routine_privileges
    WHERE grantee IN ('anon', 'PUBLIC')
      AND specific_schema = 'public'
      AND routine_name NOT IN ('rpc_public_machine_call_context', 'rpc_public_create_machine_call')
  ) THEN
    RAISE EXCEPTION 'Anonymous lockdown postcondition failed';
  END IF;
END;
$$;

DROP TABLE IF EXISTS pg_temp.mes_authenticated_execute_snapshot;
