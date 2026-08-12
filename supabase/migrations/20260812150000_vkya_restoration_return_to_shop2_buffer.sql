-- Update return_vkya_restoration_to_route to always route restored VKYA parts into Shop 2 Buffer (at-shop2-buffer).

begin;

create or replace function public.return_vkya_restoration_to_route(
  p_restoration_card_id uuid,
  p_returned_by text default null
) returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $body$
declare
  v_restoration public.vkya_restoration_cards%rowtype;
  v_history public.work_card_history%rowtype;
  v_source public.work_cards%rowtype;
  v_target_status text;
  v_target_operation text;
  v_target_inventory text;
  v_route_card_id uuid;
  v_stage text;
  v_can_merge boolean;
begin
  select * into v_restoration
  from public.vkya_restoration_cards
  where id = p_restoration_card_id
  for update;

  if not found then raise exception 'Карту відновлення не знайдено'; end if;
  if v_restoration.route_card_id is not null then return v_restoration.route_card_id; end if;
  if v_restoration.status <> 'completed' or coalesce(v_restoration.completed_quantity, 0) <= 0 then
    raise exception 'Спочатку завершіть карту та вкажіть відновлену кількість';
  end if;
  if v_restoration.source_history_id is null or v_restoration.source_task_id is null then
    raise exception 'Стара карта не містить походження наряду і не може бути повернена автоматично';
  end if;

  select * into v_history
  from public.work_card_history
  where id = v_restoration.source_history_id
  for update;
  if not found then raise exception 'Початковий запис ВКЯ не знайдено'; end if;

  select * into v_source
  from public.work_cards
  where id = coalesce(v_restoration.source_card_id, v_history.card_id)
  for update;
  if not found then raise exception 'Початкову робочу картку не знайдено'; end if;

  -- All restored parts from VKYA return directly to Shop 2 Buffer (at-shop2-buffer)
  -- strictly bound to the original task, order, and nomenclature!
  v_target_status := 'at-shop2-buffer';
  v_target_operation := 'Сортування';
  v_target_inventory := 'semi_shop2';

  v_can_merge := v_source.status = v_target_status
    and lower(btrim(coalesce(v_source.operation, ''))) = lower(btrim(coalesce(v_target_operation, '')))
    and v_source.status = 'at-shop2-buffer';

  if v_can_merge then
    update public.work_cards
    set quantity = coalesce(quantity, 0) + v_restoration.completed_quantity,
        card_info = concat_ws(' ', nullif(btrim(coalesce(card_info, '')), ''),
          format('[VKYA_RESTORED_RETURN:%s:%s]', v_restoration.id, v_restoration.completed_quantity))
    where id = v_source.id
    returning id into v_route_card_id;
  else
    insert into public.work_cards (
      task_id, order_id, nomenclature_id, quantity, operation, status,
      machine, manager_name, shift_name, card_info
    ) values (
      v_restoration.source_task_id, coalesce(v_restoration.source_order_id, v_source.order_id),
      v_restoration.nomenclature_id, v_restoration.completed_quantity,
      v_target_operation, v_target_status, '—', v_source.manager_name, v_source.shift_name,
      format('[VKYA_RESTORED_RETURN] [SOURCE_CARD:%s] [SOURCE_HISTORY:%s] [RESTORATION_CARD:%s] Повернено в Буфер Цеху №2 після відновлення ВКЯ',
        v_source.id, v_history.id, v_restoration.id)
    ) returning id into v_route_card_id;
  end if;

  if v_target_inventory is not null then
    perform public.vkya_add_route_inventory(v_restoration.nomenclature_id, v_target_inventory, v_restoration.completed_quantity);
  end if;

  update public.vkya_restoration_cards
  set route_card_id = v_route_card_id,
      returned_to_route_at = now(),
      returned_to_route_by = nullif(btrim(p_returned_by), ''),
      updated_at = now()
  where id = v_restoration.id;

  return v_route_card_id;
end;
$body$;

revoke all on function public.return_vkya_restoration_to_route(uuid,text) from public;
grant execute on function public.return_vkya_restoration_to_route(uuid,text) to anon, authenticated;

commit;
