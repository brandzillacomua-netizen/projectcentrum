-- Read-only catalog inspection. Run separately in PROD and TEST.
-- Returns all six sections in one row. Contains no data-changing statements.
SELECT jsonb_build_object(
  'columns', (SELECT COALESCE(jsonb_agg(to_jsonb(section_rows)), '[]'::jsonb) FROM (SELECT table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('tasks','work_cards','material_requests','inventory','work_card_history',
    'cutter_usage_events','cutter_restoration_batches')
ORDER BY table_name, ordinal_position) AS section_rows),
  'triggers', (SELECT COALESCE(jsonb_agg(to_jsonb(section_rows)), '[]'::jsonb) FROM (SELECT n.nspname AS schema_name, c.relname AS table_name,
       t.tgname AS trigger_name, pg_get_triggerdef(t.oid) AS definition,
       pg_get_functiondef(t.tgfoid) AS function_definition
FROM pg_trigger t
JOIN pg_class c ON c.oid=t.tgrelid
JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE NOT t.tgisinternal AND n.nspname='public'
  AND c.relname IN ('tasks','work_cards','material_requests','inventory')
ORDER BY c.relname,t.tgname) AS section_rows),
  'functions', (SELECT COALESCE(jsonb_agg(to_jsonb(section_rows)), '[]'::jsonb) FROM (SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS arguments,
       p.prosecdef AS security_definer, pg_get_functiondef(p.oid) AS definition
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname IN (
 'rpc_transition_work_card_atomic','rpc_deduct_inventory_atomic',
 'rpc_increment_inventory_stock','register_cutter_usage','reconcile_inventory_reserve')
ORDER BY p.proname) AS section_rows),
  'policies', (SELECT COALESCE(jsonb_agg(to_jsonb(section_rows)), '[]'::jsonb) FROM (SELECT schemaname,tablename,policyname,roles,cmd,qual,with_check
FROM pg_policies
WHERE schemaname='public' AND tablename IN ('tasks','work_cards','material_requests','inventory')
ORDER BY tablename,policyname) AS section_rows),
  'constraints', (SELECT COALESCE(jsonb_agg(to_jsonb(section_rows)), '[]'::jsonb) FROM (SELECT c.relname AS table_name,k.conname,pg_get_constraintdef(k.oid) AS definition
FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid
JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname IN ('tasks','work_cards','material_requests','inventory')
ORDER BY c.relname,k.conname) AS section_rows),
  'indexes', (SELECT COALESCE(jsonb_agg(to_jsonb(section_rows)), '[]'::jsonb) FROM (SELECT schemaname,tablename,indexname,indexdef FROM pg_indexes
WHERE schemaname='public' AND tablename IN ('tasks','work_cards','material_requests','inventory')
ORDER BY tablename,indexname) AS section_rows)
) AS shop1_preflight;

