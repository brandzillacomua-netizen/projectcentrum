-- Restore `extensions` in search_path for admin user RPCs (needed for pgcrypto gen_salt/crypt in Supabase)
SET lock_timeout = '5s';
SET statement_timeout = '30s';

DO $$
DECLARE
  v_sig TEXT;
BEGIN
  FOR v_sig IN
    SELECT p.oid::regprocedure::TEXT
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'rpc_admin_upsert_user',
        'rpc_admin_delete_user',
        'rpc_admin_import_users',
        'verify_user_password'
      )
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = pg_catalog, public, auth, extensions', v_sig);
  END LOOP;
END $$;
