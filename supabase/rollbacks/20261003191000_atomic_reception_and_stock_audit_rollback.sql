-- Roll the application back first. Retain the append-only audit table and trigger as evidence.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DROP FUNCTION IF EXISTS public.rpc_confirm_reception_atomic(uuid,jsonb,text);
COMMIT;
