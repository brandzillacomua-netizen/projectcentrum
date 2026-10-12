begin;

revoke all on function public.rpc_consume_cutting_inventory_once(uuid,text,uuid,numeric,numeric,jsonb)
from public, anon, authenticated, service_role;

drop function if exists public.rpc_consume_cutting_inventory_once(uuid,text,uuid,numeric,numeric,jsonb);
drop table if exists mes_private.cutting_consumption_receipts;

commit;
