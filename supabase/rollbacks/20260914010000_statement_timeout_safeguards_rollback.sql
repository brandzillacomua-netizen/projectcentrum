-- Rollback: Statement Timeout Safeguards
DO $$
BEGIN
  ALTER ROLE authenticated RESET statement_timeout;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;
