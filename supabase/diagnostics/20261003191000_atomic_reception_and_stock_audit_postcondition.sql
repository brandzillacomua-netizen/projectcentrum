SELECT to_regprocedure('public.rpc_confirm_reception_atomic(uuid,jsonb,text)') IS NOT NULL AS rpc_installed,
has_function_privilege('anon','public.rpc_confirm_reception_atomic(uuid,jsonb,text)','EXECUTE') AS anonymous_execute;
SELECT tgname,tgenabled FROM pg_trigger WHERE tgname='trg_factory_inventory_audit';
