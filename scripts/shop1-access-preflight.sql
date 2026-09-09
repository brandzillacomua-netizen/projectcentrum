-- Read-only. Run separately in TEST and PROD. One result, no business RPC calls.
-- Reads definitions and permissions, not users, passwords, tokens or stock data.
SELECT jsonb_build_object(
  'guards', (SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) FROM (
    SELECT n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) arguments,
      p.prosecdef security_definer,p.proconfig settings,pg_get_functiondef(p.oid) definition
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname IN ('verify_app_secret','verify_mes_session_or_app')
    ORDER BY p.proname
  ) x),
  'rls', (SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) FROM (
    SELECT n.nspname,c.relname,c.relrowsecurity enabled,c.relforcerowsecurity forced
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname IN ('tasks','work_cards','material_requests','inventory','work_card_history','cutter_usage_events','cutter_restoration_batches')
    ORDER BY c.relname
  ) x),
  'table_grants', (SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) FROM (
    SELECT table_schema,table_name,grantee,privilege_type FROM information_schema.role_table_grants
    WHERE table_schema IN ('public','shop1_v2') AND grantee IN ('anon','authenticated','service_role')
      AND (table_schema='shop1_v2' OR table_name IN ('tasks','work_cards','material_requests','inventory','work_card_history','cutter_usage_events','cutter_restoration_batches'))
    ORDER BY table_schema,table_name,grantee,privilege_type
  ) x),
  'rpc_access', (SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) FROM (
    SELECT p.proname,pg_get_function_identity_arguments(p.oid) arguments,r.rolname,
      has_function_privilege(r.oid,p.oid,'EXECUTE') can_execute
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      CROSS JOIN pg_roles r
    WHERE n.nspname='public' AND r.rolname IN ('anon','authenticated','service_role')
      AND (p.proname LIKE 'shop1_v2_%' OR p.proname IN ('rpc_deduct_inventory_atomic','rpc_transition_work_card_atomic','register_cutter_usage'))
    ORDER BY p.proname,r.rolname
  ) x),
  'restoration_dependencies', jsonb_build_object(
    'register_cutter_usage',to_regprocedure('public.register_cutter_usage(uuid,jsonb,bigint,text,jsonb)') IS NOT NULL,
    'classifier',to_regprocedure('public.is_faceting_cutter(uuid)') IS NOT NULL,
    'usage_table',to_regclass('public.cutter_usage_events') IS NOT NULL,
    'batches_table',to_regclass('public.cutter_restoration_batches') IS NOT NULL,
    'events_table',to_regclass('public.cutter_restoration_events') IS NOT NULL
  )
) AS shop1_access_preflight;
