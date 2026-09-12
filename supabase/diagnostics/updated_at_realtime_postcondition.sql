-- Read-only verification for 20260912225500_add_updated_at_to_realtime_tables.sql.

WITH target(table_name) AS (
  VALUES ('tasks'), ('orders'), ('work_cards'), ('material_requests')
), relation_state AS (
  SELECT
    target.table_name,
    relation.oid AS relation_oid,
    attribute.attnotnull,
    format_type(attribute.atttypid, attribute.atttypmod) AS column_type,
    pg_get_expr(default_value.adbin, default_value.adrelid) AS column_default
  FROM target
  LEFT JOIN pg_namespace AS namespace
    ON namespace.nspname = 'public'
  LEFT JOIN pg_class AS relation
    ON relation.relnamespace = namespace.oid
   AND relation.relname = target.table_name
   AND relation.relkind IN ('r', 'p')
  LEFT JOIN pg_attribute AS attribute
    ON attribute.attrelid = relation.oid
   AND attribute.attname = 'updated_at'
   AND attribute.attnum > 0
   AND NOT attribute.attisdropped
  LEFT JOIN pg_attrdef AS default_value
    ON default_value.adrelid = relation.oid
   AND default_value.adnum = attribute.attnum
), trigger_state AS (
  SELECT
    relation_state.table_name,
    trigger_row.oid IS NOT NULL AS trigger_found,
    trigger_row.tgenabled AS trigger_enabled,
    procedure.proname AS trigger_function
  FROM relation_state
  LEFT JOIN pg_trigger AS trigger_row
    ON trigger_row.tgrelid = relation_state.relation_oid
   AND trigger_row.tgname = 'trg_' || relation_state.table_name || '_updated_at'
   AND NOT trigger_row.tgisinternal
  LEFT JOIN pg_proc AS procedure ON procedure.oid = trigger_row.tgfoid
), index_state AS (
  SELECT
    relation_state.table_name,
    index_row.indexrelid IS NOT NULL AS index_found,
    COALESCE(index_row.indisvalid, FALSE) AS index_valid,
    COALESCE(index_row.indisready, FALSE) AS index_ready
  FROM relation_state
  LEFT JOIN pg_namespace AS namespace ON namespace.nspname = 'public'
  LEFT JOIN pg_class AS index_relation
    ON index_relation.relnamespace = namespace.oid
   AND index_relation.relname = 'idx_' || relation_state.table_name || '_updated_at'
  LEFT JOIN pg_index AS index_row
    ON index_row.indexrelid = index_relation.oid
   AND index_row.indrelid = relation_state.relation_oid
), routine_state AS (
  SELECT
    COUNT(*) = 1 AS function_found,
    COALESCE(bool_and(NOT procedure.prosecdef), FALSE) AS security_invoker,
    COALESCE(bool_and(procedure.prorettype = 'pg_catalog.trigger'::regtype), FALSE) AS returns_trigger
  FROM pg_proc AS procedure
  JOIN pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
  WHERE namespace.nspname = 'public'
    AND procedure.proname = 'auto_update_updated_at'
    AND pg_get_function_identity_arguments(procedure.oid) = ''
), combined AS (
  SELECT
    relation_state.table_name,
    relation_state.relation_oid IS NOT NULL AS table_found,
    relation_state.column_type = 'timestamp with time zone'
      AND relation_state.attnotnull
      AND relation_state.column_default IS NOT NULL AS column_ready,
    relation_state.column_type,
    relation_state.attnotnull,
    relation_state.column_default,
    trigger_state.trigger_found,
    trigger_state.trigger_enabled,
    trigger_state.trigger_function,
    index_state.index_found,
    index_state.index_valid,
    index_state.index_ready
  FROM relation_state
  JOIN trigger_state USING (table_name)
  JOIN index_state USING (table_name)
), totals AS (
  SELECT
    COUNT(*) FILTER (WHERE table_found) AS tables_found,
    COUNT(*) FILTER (WHERE column_ready) AS columns_ready,
    COUNT(*) FILTER (
      WHERE trigger_found
        AND trigger_enabled <> 'D'
        AND trigger_function = 'auto_update_updated_at'
    ) AS triggers_ready,
    COUNT(*) FILTER (WHERE index_found AND index_valid AND index_ready) AS indexes_ready,
    jsonb_agg(to_jsonb(combined) ORDER BY table_name) AS details
  FROM combined
)
SELECT jsonb_build_object(
  'status', CASE
    WHEN totals.tables_found = 4
      AND totals.columns_ready = 4
      AND totals.triggers_ready = 4
      AND totals.indexes_ready = 4
      AND routine_state.function_found
      AND routine_state.security_invoker
      AND routine_state.returns_trigger
    THEN 'PASS'
    ELSE 'FAIL'
  END,
  'tables_found', totals.tables_found,
  'columns_ready', totals.columns_ready,
  'triggers_ready', totals.triggers_ready,
  'indexes_ready', totals.indexes_ready,
  'function_found', routine_state.function_found,
  'security_invoker', routine_state.security_invoker,
  'returns_trigger', routine_state.returns_trigger,
  'details', totals.details
) AS updated_at_realtime_postcondition
FROM totals
CROSS JOIN routine_state;
