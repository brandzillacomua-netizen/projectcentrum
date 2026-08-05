-- Completing a restoration card produces exactly two outcomes:
-- restored quantity and irreversible category-4 scrap.

begin;

alter table public.vkya_restoration_cards
  add column if not exists final_scrap_quantity integer not null default 0
    check (final_scrap_quantity >= 0 and final_scrap_quantity <= quantity);

create or replace function public.complete_vkya_restoration_card(
  p_card_id uuid,
  p_completed_quantity integer,
  p_final_scrap_quantity integer
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $body$
declare
  v_card public.vkya_restoration_cards%rowtype;
  v_inventory public.inventory%rowtype;
  v_classification_id uuid;
begin
  select * into v_card
  from public.vkya_restoration_cards
  where id = p_card_id
  for update;

  if not found then raise exception 'Карту відновлення не знайдено'; end if;
  if v_card.status <> 'in_progress' then raise exception 'Карта не перебуває в роботі'; end if;
  if p_completed_quantity is null or p_completed_quantity < 0
     or p_final_scrap_quantity is null or p_final_scrap_quantity < 0
     or p_completed_quantity + p_final_scrap_quantity <> v_card.quantity then
    raise exception 'Відновлено + утиль мають дорівнювати кількості карти (%)', v_card.quantity;
  end if;

  update public.vkya_restoration_cards
  set status = 'completed',
      completed_quantity = p_completed_quantity,
      final_scrap_quantity = p_final_scrap_quantity,
      completed_at = now(),
      updated_at = now()
  where id = v_card.id;

  if p_final_scrap_quantity > 0 then
    select * into v_inventory
    from public.inventory
    where nomenclature_id = v_card.nomenclature_id
      and type = 'scrap_cat_4'
    order by updated_at desc nulls last, id
    limit 1
    for update;

    if found then
      update public.inventory
      set total_qty = coalesce(total_qty, 0) + p_final_scrap_quantity,
          updated_at = now()
      where id = v_inventory.id;
    else
      insert into public.inventory (nomenclature_id, name, unit, total_qty, type, updated_at)
      values (
        v_card.nomenclature_id, v_card.nomenclature_name,
        coalesce(v_card.unit, 'шт'), p_final_scrap_quantity, 'scrap_cat_4', now()
      );
    end if;

    insert into public.scrap_classifications (
      source_history_id, card_id, task_id, order_id, nomenclature_id,
      order_number, source_operator_name, source_stage_name,
      quantity, classified_by_name, notes
    ) values (
      null, v_card.source_card_id, v_card.source_task_id, v_card.source_order_id,
      v_card.nomenclature_id, null, v_card.operator_name,
      v_card.restoration_stage || ' (ВКЯ)', p_final_scrap_quantity,
      coalesce(v_card.operator_name, v_card.created_by_name, 'Термінал відновлення ВКЯ'),
      format('[VKYA_RESTORATION_FINAL_SCRAP:%s] Остаточний утиль після відновлення', v_card.id)
    ) returning id into v_classification_id;

    insert into public.scrap_classification_categories (classification_id, category, quantity)
    values (v_classification_id, 4, p_final_scrap_quantity);
  end if;

  return jsonb_build_object(
    'restored_quantity', p_completed_quantity,
    'final_scrap_quantity', p_final_scrap_quantity
  );
end;
$body$;

revoke all on function public.complete_vkya_restoration_card(uuid,integer,integer) from public;
grant execute on function public.complete_vkya_restoration_card(uuid,integer,integer) to anon, authenticated;

commit;
