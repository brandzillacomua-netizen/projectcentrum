-- Emergency controlled-degradation rollback.
-- It does not mutate production data and does not restore the known-broken v3 body.
-- The web client will use its guarded sequential fallback until the repair is reapplied.

BEGIN;

REVOKE ALL ON FUNCTION public.rpc_transition_work_card_atomic(UUID, JSONB, JSONB, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;

COMMIT;
