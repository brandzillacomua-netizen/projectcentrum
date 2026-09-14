create or replace function public.rpc_super_delete_order(p_order_id bigint)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $body$
declare
  v_task_ids bigint[];
  v_card_ids bigint[];
  v_crb_ids bigint[];
  v_vrc_ids bigint[];
  v_op_ids bigint[];
  op_id bigint;
begin
  -- 1. Gather all related tasks
  select array_agg(id) into v_task_ids from public.tasks where order_id = p_order_id;
  if v_task_ids is null then v_task_ids := array[]::bigint[]; end if;

  -- 2. Gather all related work_cards
  select array_agg(id) into v_card_ids from public.work_cards 
  where order_id = p_order_id or (array_length(v_task_ids, 1) > 0 and task_id = any(v_task_ids));
  if v_card_ids is null then v_card_ids := array[]::bigint[]; end if;

  -- 3. Gather cutter_restoration_batches
  select array_agg(id) into v_crb_ids from public.cutter_restoration_batches
  where order_id = p_order_id 
     or (array_length(v_card_ids, 1) > 0 and source_card_id = any(v_card_ids))
     or (array_length(v_task_ids, 1) > 0 and task_id = any(v_task_ids));
  if v_crb_ids is null then v_crb_ids := array[]::bigint[]; end if;

  -- 4. Gather vkya_restoration_cards
  select array_agg(id) into v_vrc_ids from public.vkya_restoration_cards
  where source_order_id = p_order_id
     or (array_length(v_card_ids, 1) > 0 and (source_card_id = any(v_card_ids) or route_card_id = any(v_card_ids)))
     or (array_length(v_task_ids, 1) > 0 and source_task_id = any(v_task_ids));
  if v_vrc_ids is null then v_vrc_ids := array[]::bigint[]; end if;

  -- 5. Auto-release BZ reservations
  select array_agg(distinct operation_id) into v_op_ids 
  from public.bz_inventory_reservations
  where status = 'allocated' 
    and (order_id = p_order_id or (array_length(v_task_ids, 1) > 0 and task_id = any(v_task_ids)));
  
  if v_op_ids is null then v_op_ids := array[]::bigint[]; end if;

  foreach op_id in array v_op_ids
  loop
    begin
      perform public.release_bz_reservation(op_id, 'Авто-звільнення при розширеному видаленні замовлення (RPC)');
    exception when others then
      -- Ignore release errors to proceed with deletion
    end;
  end loop;

  -- Phase 1: Deep leaf tables
  if array_length(v_crb_ids, 1) > 0 then
    delete from public.cutter_restoration_events where batch_id = any(v_crb_ids);
  end if;

  if array_length(v_vrc_ids, 1) > 0 then
    delete from public.vkya_scrap_lot_allocations where restoration_card_id = any(v_vrc_ids);
  end if;

  if array_length(v_card_ids, 1) > 0 then
    delete from public.vkya_scrap_lot_allocations where rework_card_id = any(v_card_ids);
    delete from public.vkya_quality_resolutions where source_card_id = any(v_card_ids) or route_card_id = any(v_card_ids);
  end if;

  if array_length(v_task_ids, 1) > 0 then
    delete from public.vkya_scrap_lot_allocations where rework_task_id = any(v_task_ids);
    delete from public.vkya_quality_resolutions where task_id = any(v_task_ids);
  end if;

  delete from public.vkya_scrap_lot_allocations where rework_order_id = p_order_id;
  delete from public.vkya_quality_resolutions where order_id = p_order_id;

  -- Phase 2: Mid-level tables
  if array_length(v_vrc_ids, 1) > 0 then
    delete from public.vkya_restoration_cards where id = any(v_vrc_ids);
  end if;
  
  if array_length(v_crb_ids, 1) > 0 then
    delete from public.cutter_restoration_batches where id = any(v_crb_ids);
  end if;

  if array_length(v_card_ids, 1) > 0 then
    delete from public.vkya_reclassification_queue where source_card_id = any(v_card_ids);
    delete from public.vkya_restoration_cards where source_card_id = any(v_card_ids) or route_card_id = any(v_card_ids);
    delete from public.cutter_usage_events where source_card_id = any(v_card_ids);
    delete from public.work_card_scrap_totals where card_id = any(v_card_ids);
    delete from public.work_card_history where card_id = any(v_card_ids);
  end if;

  if array_length(v_task_ids, 1) > 0 then
    delete from public.vkya_reclassification_queue where source_task_id = any(v_task_ids);
    delete from public.vkya_restoration_cards where source_task_id = any(v_task_ids);
    delete from public.cutter_restoration_batches where task_id = any(v_task_ids);
    delete from public.cutter_usage_events where task_id = any(v_task_ids);
    delete from public.material_requests where task_id = any(v_task_ids);
    delete from public.purchase_requests where task_id = any(v_task_ids);
    delete from public.reception_docs where task_id = any(v_task_ids);
    delete from public.work_card_scrap_totals where task_id = any(v_task_ids);
  end if;

  delete from public.vkya_reclassification_queue where source_order_id = p_order_id;
  delete from public.vkya_restoration_cards where source_order_id = p_order_id;
  delete from public.cutter_restoration_batches where order_id = p_order_id;
  delete from public.cutter_usage_events where order_id = p_order_id;
  delete from public.material_requests where order_id = p_order_id;
  delete from public.purchase_requests where order_id = p_order_id;
  delete from public.reception_docs where order_id = p_order_id;
  delete from public.work_card_scrap_totals where order_id = p_order_id;

  -- Phase 3: Work Cards, Tasks & Order Items
  if array_length(v_card_ids, 1) > 0 then
    delete from public.work_cards where id = any(v_card_ids);
  end if;

  if array_length(v_task_ids, 1) > 0 then
    delete from public.tasks where id = any(v_task_ids);
  end if;

  delete from public.work_cards where order_id = p_order_id;
  delete from public.order_items where order_id = p_order_id;

  -- Phase 4: Order row
  delete from public.orders where id = p_order_id;

end;
$body$;

grant execute on function public.rpc_super_delete_order(bigint) to authenticated;
revoke execute on function public.rpc_super_delete_order(bigint) from anon;
