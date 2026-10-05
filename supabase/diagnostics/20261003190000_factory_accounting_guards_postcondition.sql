-- Read-only installed ACL and receipt table checks.
SELECT signature, has_function_privilege('anon',to_regprocedure(signature),'EXECUTE') AS anon_execute FROM unnest(ARRAY['public.rpc_deduct_inventory_atomic(uuid,numeric,numeric)',
'public.rpc_reserve_material_atomic(uuid,numeric,text,text)',
'public.rpc_increment_inventory_stock(uuid,numeric,text,text,text,text)',
'public.rpc_qc_scrap_atomic(uuid,numeric,jsonb,text)',
'public.rpc_submit_sorting_complete_atomic(uuid,numeric,numeric,numeric,text,text)',
'public.rpc_handover_to_sgp_atomic(uuid)',
'public.rpc_handover_task_to_shop2_atomic(uuid)',
'public.vkya_add_route_inventory(uuid,text,integer)',
'public.return_legacy_restoration_to_bz(uuid,text)',
'public.return_vkya_restoration_to_route(uuid,text)','public.vkya_add_route_inventory(uuid,text,integer)','public.return_legacy_restoration_to_bz(uuid,text)','public.return_vkya_restoration_to_route(uuid,text)']) AS signature;
SELECT to_regclass('mes_private.accounting_receipts') IS NOT NULL AS receipts_installed;
