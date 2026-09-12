-- Follow-up for an already deployed P0 migration. Never edit applied migration
-- history to change production behavior.
BEGIN;

REVOKE ALL ON FUNCTION public.sync_system_user_to_auth(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_system_user_to_auth(TEXT) TO service_role;

COMMIT;
