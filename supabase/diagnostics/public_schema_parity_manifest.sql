-- Read-only public-schema manifest.
-- Run unchanged in production and staging, then compare the two JSON results.
-- This query reads PostgreSQL catalog metadata only; it never reads business rows.

WITH extension_routines AS (
  SELECT dependency.objid AS routine_oid
  FROM pg_depend AS dependency
  WHERE dependency.classid = 'pg_proc'::regclass
    AND dependency.deptype = 'e'
), manifest_objects AS (
  SELECT
    'relation'::TEXT AS object_kind,
    format('%I.%I', namespace.nspname, relation.relname) AS object_identity,
    md5(concat_ws('|',
      relation.relkind::TEXT,
      relation.relpersistence::TEXT,
      relation.relrowsecurity::TEXT,
      relation.relforcerowsecurity::TEXT,
      CASE
        WHEN relation.relkind IN ('v', 'm') THEN pg_get_viewdef(relation.oid, true)
        ELSE ''
      END
    )) AS object_fingerprint
  FROM pg_class AS relation
  JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
  WHERE namespace.nspname = 'public'
    AND relation.relkind IN ('r', 'p', 'v', 'm', 'S', 'f')

  UNION ALL

  SELECT
    'column',
    format('%I.%I.%I', columns.table_schema, columns.table_name, columns.column_name),
    md5(concat_ws('|',
      columns.ordinal_position::TEXT,
      columns.data_type,
      columns.udt_schema,
      columns.udt_name,
      columns.is_nullable,
      COALESCE(columns.column_default, ''),
      columns.is_identity,
      columns.identity_generation,
      columns.is_generated,
      columns.generation_expression,
      columns.collation_schema,
      columns.collation_name
    ))
  FROM information_schema.columns AS columns
  WHERE columns.table_schema = 'public'

  UNION ALL

  SELECT
    'constraint',
    format('%I.%I.%I', namespace.nspname, relation.relname, constraint_record.conname),
    md5(concat_ws('|',
      constraint_record.contype::TEXT,
      constraint_record.condeferrable::TEXT,
      constraint_record.condeferred::TEXT,
      constraint_record.convalidated::TEXT,
      pg_get_constraintdef(constraint_record.oid, true)
    ))
  FROM pg_constraint AS constraint_record
  JOIN pg_class AS relation ON relation.oid = constraint_record.conrelid
  JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
  WHERE namespace.nspname = 'public'

  UNION ALL

  SELECT
    'index',
    format('%I.%I.%I', indexes.schemaname, indexes.tablename, indexes.indexname),
    md5(indexes.indexdef)
  FROM pg_indexes AS indexes
  WHERE indexes.schemaname = 'public'

  UNION ALL

  SELECT
    'trigger',
    format('%I.%I.%I', namespace.nspname, relation.relname, trigger_record.tgname),
    md5(concat_ws('|',
      trigger_record.tgenabled::TEXT,
      pg_get_triggerdef(trigger_record.oid, true)
    ))
  FROM pg_trigger AS trigger_record
  JOIN pg_class AS relation ON relation.oid = trigger_record.tgrelid
  JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
  WHERE namespace.nspname = 'public'
    AND NOT trigger_record.tgisinternal

  UNION ALL

  SELECT
    'routine',
    procedure.oid::regprocedure::TEXT,
    md5(concat_ws('|',
      procedure.prokind::TEXT,
      procedure.provolatile::TEXT,
      procedure.prosecdef::TEXT,
      procedure.proleakproof::TEXT,
      procedure.proparallel::TEXT,
      procedure.prorettype::regtype::TEXT,
      COALESCE(array_to_string(procedure.proconfig, ','), ''),
      pg_get_functiondef(procedure.oid)
    ))
  FROM pg_proc AS procedure
  JOIN pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
  LEFT JOIN extension_routines ON extension_routines.routine_oid = procedure.oid
  WHERE namespace.nspname = 'public'
    AND extension_routines.routine_oid IS NULL

  UNION ALL

  SELECT
    'policy',
    format('%I.%I.%I', policies.schemaname, policies.tablename, policies.policyname),
    md5(concat_ws('|',
      policies.permissive,
      policies.cmd,
      array_to_string(policies.roles, ','),
      COALESCE(policies.qual, ''),
      COALESCE(policies.with_check, '')
    ))
  FROM pg_policies AS policies
  WHERE policies.schemaname = 'public'

  UNION ALL

  SELECT
    'table_acl',
    format('%I.%I:%s:%s',
      namespace.nspname,
      relation.relname,
      COALESCE(pg_get_userbyid(privilege.grantee), 'PUBLIC'),
      privilege.privilege_type
    ),
    md5(concat_ws('|', privilege.is_grantable::TEXT, pg_get_userbyid(privilege.grantor)))
  FROM pg_class AS relation
  JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
  CROSS JOIN LATERAL aclexplode(COALESCE(relation.relacl, acldefault('r', relation.relowner))) AS privilege
  WHERE namespace.nspname = 'public'
    AND relation.relkind IN ('r', 'p', 'v', 'm', 'S', 'f')

  UNION ALL

  SELECT
    'routine_acl',
    format('%s:%s:%s',
      procedure.oid::regprocedure::TEXT,
      COALESCE(pg_get_userbyid(privilege.grantee), 'PUBLIC'),
      privilege.privilege_type
    ),
    md5(concat_ws('|', privilege.is_grantable::TEXT, pg_get_userbyid(privilege.grantor)))
  FROM pg_proc AS procedure
  JOIN pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
  LEFT JOIN extension_routines ON extension_routines.routine_oid = procedure.oid
  CROSS JOIN LATERAL aclexplode(COALESCE(procedure.proacl, acldefault('f', procedure.proowner))) AS privilege
  WHERE namespace.nspname = 'public'
    AND extension_routines.routine_oid IS NULL

  UNION ALL

  SELECT
    'default_acl',
    format('%s:%I:%s:%s:%s',
      pg_get_userbyid(defaults.defaclrole),
      namespace.nspname,
      defaults.defaclobjtype,
      COALESCE(pg_get_userbyid(privilege.grantee), 'PUBLIC'),
      privilege.privilege_type
    ),
    md5(concat_ws('|', privilege.is_grantable::TEXT, pg_get_userbyid(privilege.grantor)))
  FROM pg_default_acl AS defaults
  JOIN pg_namespace AS namespace ON namespace.oid = defaults.defaclnamespace
  CROSS JOIN LATERAL aclexplode(defaults.defaclacl) AS privilege
  WHERE namespace.nspname = 'public'

  UNION ALL

  SELECT
    'enum_value',
    format('%I.%I.%s', namespace.nspname, type_record.typname, enum_record.enumsortorder),
    md5(enum_record.enumlabel)
  FROM pg_enum AS enum_record
  JOIN pg_type AS type_record ON type_record.oid = enum_record.enumtypid
  JOIN pg_namespace AS namespace ON namespace.oid = type_record.typnamespace
  WHERE namespace.nspname = 'public'
), ordered_manifest AS (
  SELECT object_kind, object_identity, object_fingerprint
  FROM manifest_objects
  ORDER BY object_kind, object_identity
)
SELECT jsonb_build_object(
  'public_schema_manifest', jsonb_build_object(
    'manifest_version', '2026-09-13.v1',
    'database_name', current_database(),
    'object_count', COUNT(*),
    'global_fingerprint', md5(string_agg(
      object_kind || '|' || object_identity || '|' || object_fingerprint,
      E'\n' ORDER BY object_kind, object_identity
    )),
    'counts_by_kind', (
      SELECT jsonb_object_agg(object_kind, object_count ORDER BY object_kind)
      FROM (
        SELECT object_kind, COUNT(*) AS object_count
        FROM ordered_manifest
        GROUP BY object_kind
      ) AS counts
    ),
    'objects', jsonb_agg(
      jsonb_build_object(
        'kind', object_kind,
        'identity', object_identity,
        'fingerprint', object_fingerprint
      ) ORDER BY object_kind, object_identity
    )
  )
) AS result
FROM ordered_manifest;
