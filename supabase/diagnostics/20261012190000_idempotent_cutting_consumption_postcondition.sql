select
  to_regclass('mes_private.cutting_consumption_receipts') is not null as has_receipts,
  to_regprocedure('public.rpc_consume_cutting_inventory_once(uuid,text,uuid,numeric,numeric,jsonb)') is not null as has_consumption_rpc,
  has_function_privilege(
    'authenticated',
    'public.rpc_consume_cutting_inventory_once(uuid,text,uuid,numeric,numeric,jsonb)',
    'execute'
  ) as authenticated_can_execute;
