-- Read-only: every signature must resolve. Review production definitions before rollout.
SELECT signature, to_regprocedure(signature) IS NOT NULL AS installed FROM unnest(ARRAY['public.rpc_deduct_inventory_atomic(uuid,numeric,numeric)',
'public.rpc_reserve_material_atomic(uuid,numeric,text,text)',
'public.rpc_increment_inventory_stock(uuid,numeric,text,text,text,text)',
'public.rpc_qc_scrap_atomic(uuid,numeric,jsonb,text)',
'public.rpc_submit_sorting_complete_atomic(uuid,numeric,numeric,numeric,text,text)',
'public.rpc_handover_to_sgp_atomic(uuid)',
'public.rpc_handover_task_to_shop2_atomic(uuid)',
'public.vkya_add_route_inventory(uuid,text,integer)',
'public.return_legacy_restoration_to_bz(uuid,text)',
'public.return_vkya_restoration_to_route(uuid,text)']) AS signature;
SELECT count(*) FILTER (WHERE total_qty < 0 OR reserved_qty < 0 OR total_qty IS NULL) AS invalid_inventory,
 count(*) FILTER (WHERE reserved_qty > total_qty) AS over_reserved FROM public.inventory;
SELECT nomenclature_id,type,warehouse,count(*) FROM public.inventory WHERE nomenclature_id IS NOT NULL AND pocket_owner IS NULL GROUP BY nomenclature_id,type,warehouse HAVING count(*)>1;
