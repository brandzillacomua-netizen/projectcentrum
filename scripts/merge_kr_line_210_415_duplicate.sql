begin;

do $$
declare
  v_keep constant uuid := '076ba504-b3f6-4ec8-8844-fe9515077d9c';
  v_remove constant uuid := '07aff80a-7a90-4fad-af60-a7c48603a4c4';
  v_name constant text := 'KR-Line-210-415-В-3-28';
  v_source_res public.bz_inventory_reservations%rowtype;
  v_target_res public.bz_inventory_reservations%rowtype;
begin
  if not exists (
    select 1 from public.nomenclatures
    where id = v_keep and name = v_name
  ) then
    raise exception 'Canonical nomenclature % was not found', v_keep;
  end if;

  -- If the script has already completed, keep the canonical BZ balance correct.
  if not exists (
    select 1 from public.nomenclatures where id = v_remove
  ) then
    update public.inventory
    set total_qty = 282,
        updated_at = now()
    where nomenclature_id = v_keep
      and type = 'bz'
      and warehouse = 'operational'
      and pocket_owner is null;
    return;
  end if;

  if (
    select count(*) from public.nomenclatures
    where id in (v_keep, v_remove) and name = v_name
  ) <> 2 then
    raise exception 'Preflight failed: expected two exact KR-Line duplicates';
  end if;

  -- Merge BZ reservations without violating unique(operation_id, nomenclature_id).
  for v_source_res in
    select *
    from public.bz_inventory_reservations
    where nomenclature_id = v_remove
    for update
  loop
    select * into v_target_res
    from public.bz_inventory_reservations
    where operation_id = v_source_res.operation_id
      and nomenclature_id = v_keep
    for update;

    if v_target_res.id is null then
      update public.bz_inventory_reservations
      set nomenclature_id = v_keep
      where id = v_source_res.id;
    else
      update public.bz_inventory_reservations
      set requested_qty = requested_qty + v_source_res.requested_qty,
          allocated_qty = allocated_qty + v_source_res.allocated_qty
      where id = v_target_res.id;

      update public.bz_inventory_ledger
      set reservation_id = v_target_res.id,
          nomenclature_id = v_keep
      where reservation_id = v_source_res.id;

      delete from public.bz_inventory_reservations
      where id = v_source_res.id;
    end if;
  end loop;

  update public.bz_inventory_ledger
  set nomenclature_id = v_keep
  where nomenclature_id = v_remove;

  -- Remove a possible conflicting canonical BZ row, then retain the imported
  -- row and assign the requested authoritative balance.
  if exists (
    select 1 from public.inventory
    where nomenclature_id = v_remove
      and type = 'bz'
      and warehouse = 'operational'
      and pocket_owner is null
  ) then
    delete from public.inventory
    where nomenclature_id = v_keep
      and type = 'bz'
      and warehouse = 'operational'
      and pocket_owner is null;

    update public.inventory
    set nomenclature_id = v_keep,
        name = v_name,
        total_qty = 282,
        updated_at = now()
    where nomenclature_id = v_remove
      and type = 'bz'
      and warehouse = 'operational'
      and pocket_owner is null;
  else
    update public.inventory
    set total_qty = 282,
        name = v_name,
        updated_at = now()
    where nomenclature_id = v_keep
      and type = 'bz'
      and warehouse = 'operational'
      and pocket_owner is null;
  end if;

  -- All ordinary UUID references.
  update public.inventory set nomenclature_id = v_keep where nomenclature_id = v_remove;
  update public.work_cards set nomenclature_id = v_keep where nomenclature_id = v_remove;
  update public.work_card_history set nomenclature_id = v_keep where nomenclature_id = v_remove;
  update public.material_requests set nomenclature_id = v_keep where nomenclature_id = v_remove;
  update public.order_items set nomenclature_id = v_keep where nomenclature_id = v_remove;
  update public.orders set nomenclature_id = v_keep where nomenclature_id = v_remove;
  update public.scrap_classifications set nomenclature_id = v_keep where nomenclature_id = v_remove;
  update public.vkya_restoration_cards set nomenclature_id = v_keep where nomenclature_id = v_remove;
  update public.vkya_reclassification_queue set nomenclature_id = v_keep where nomenclature_id = v_remove;
  update public.work_card_scrap_totals set nomenclature_id = v_keep where nomenclature_id = v_remove;
  update public.work_card_flow_totals set nomenclature_id = v_keep where nomenclature_id = v_remove;
  update public.cutter_usage_events set nomenclature_id = v_keep where nomenclature_id = v_remove;
  update public.cutter_restoration_batches set nomenclature_id = v_keep where nomenclature_id = v_remove;
  update public.manual_inventory_issues set nomenclature_id = v_keep where nomenclature_id = v_remove;
  update public.nomenclature_catalog_history set nomenclature_id = v_keep where nomenclature_id = v_remove;

  -- Avoid duplicate parent/child BOM keys before changing the UUID.
  delete from public.bom_items source
  where source.child_id = v_remove
    and exists (
      select 1 from public.bom_items target
      where target.parent_id = source.parent_id
        and target.child_id = v_keep
    );

  delete from public.bom_items source
  where source.parent_id = v_remove
    and exists (
      select 1 from public.bom_items target
      where target.parent_id = v_keep
        and target.child_id = source.child_id
    );

  update public.bom_items set child_id = v_keep where child_id = v_remove;
  update public.bom_items set parent_id = v_keep where parent_id = v_remove;

  -- Move duplicate keys inside task JSON snapshots.
  update public.tasks
  set plan_snapshot =
    (plan_snapshot - v_remove::text)
    || jsonb_build_object(
      v_keep::text,
      coalesce(plan_snapshot -> v_keep::text, '{}'::jsonb)
      || coalesce(plan_snapshot -> v_remove::text, '{}'::jsonb)
      || jsonb_build_object('id', v_keep)
    )
  where plan_snapshot ? v_remove::text;

  -- Catalog profiles have dependent attribute rows. Stop rather than silently
  -- losing catalog metadata if the duplicate unexpectedly owns a profile.
  if exists (
    select 1 from public.nomenclature_catalog_profiles
    where nomenclature_id = v_remove
  ) then
    raise exception 'Duplicate owns a nomenclature catalog profile; manual profile merge required';
  end if;

  delete from public.nomenclatures where id = v_remove;

  if exists (select 1 from public.nomenclatures where id = v_remove) then
    raise exception 'Duplicate nomenclature was not deleted';
  end if;

  if (
    select count(*) from public.inventory
    where nomenclature_id = v_keep
      and type = 'bz'
      and warehouse = 'operational'
      and pocket_owner is null
      and total_qty = 282
  ) <> 1 then
    raise exception 'Final verification failed: canonical BZ is not exactly 282';
  end if;
end
$$;

commit;

select id, name, created_at
from public.nomenclatures
where id in (
  '076ba504-b3f6-4ec8-8844-fe9515077d9c',
  '07aff80a-7a90-4fad-af60-a7c48603a4c4'
);

select id, nomenclature_id, name, type, warehouse, total_qty, reserved_qty
from public.inventory
where nomenclature_id = '076ba504-b3f6-4ec8-8844-fe9515077d9c'
  and type = 'bz';
