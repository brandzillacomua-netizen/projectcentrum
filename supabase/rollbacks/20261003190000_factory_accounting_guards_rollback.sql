-- Restore previous function bodies only. Never reopen anonymous writes; retain receipts and audit evidence.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
DO $restore$
DECLARE r record;
BEGIN
 IF (SELECT count(*) FROM mes_private.accounting_function_backup WHERE release='20261003190000_factory_accounting_guards')<>10 THEN RAISE EXCEPTION 'Incomplete function backup'; END IF;
 FOR r IN SELECT * FROM mes_private.accounting_function_backup WHERE release='20261003190000_factory_accounting_guards' LOOP EXECUTE r.definition; END LOOP;
END;
$restore$;
COMMIT;
