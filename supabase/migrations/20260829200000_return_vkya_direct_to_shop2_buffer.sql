-- Update return_vkya_quantity_to_route so all returned parts from VKYA land directly into Shop 2 Buffer (at-shop2-buffer),
-- allowing the Foreman of Shop 2 to issue production cards for them.

begin;

create or replace function public.return_vkya_quantity_to_route(
  p_source_history_id uuid,
  p_quantity integer,
  p_resolved_by_user_id bigint default null,
  p_resolved_by_name text default null,
  p_notes text default null
) returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $body$
declare
  v_history public.work_card_history%rowtype;
  v_source public.work_cards%rowtype;
  v_classified numeric;
  v_resolved numeric;
  v_available numeric;
  v_target_status text;
  v_target_operation text;
  v_target_inventory text;
  v_route_card_id uuid;
  v_resolution_id uuid;
  v_can_merge boolean;
begin
  if p_quantity is null or p_quantity <= 0 then raise exception 'Кількість має бути більшою за нуль'; end if;

  select * into v_history from public.work_card_history
  where id = p_source_history_id for update;
  if not found or coalesce(v_history.scrap_qty, 0) <= 0 then
    raise exception 'Позицію в черзі ВКЯ не знайдено';
  end if;

  select * into v_source from public.work_cards
  where id = v_history.card_id for update;
  if not found then raise exception 'Початкову робочу картку не знайдено'; end if;

  select coalesce(sum(quantity), 0) into v_classified
  from public.scrap_classifications where source_history_id = v_history.id;
  select coalesce(sum(quantity), 0) into v_resolved
  from public.vkya_quality_resolutions where source_history_id = v_history.id;
  v_available := coalesce(v_history.scrap_qty, 0) - v_classified - v_resolved;
  if p_quantity > v_available then
    raise exception 'Для повернення доступно лише % шт.', greatest(0, v_available);
  end if;

  -- All returned parts from VKYA go directly into Shop 2 Buffer (at-shop2-buffer)
  -- so Foreman of Shop 2 can generate work cards for them.
  v_target_status := 'at-shop2-buffer';
  v_target_operation := 'Сортування';
  v_target_inventory := 'semi_shop2';

  perform public.vkya_take_scrap_ready(v_history.nomenclature_id, p_quantity);

  v_can_merge := v_source.status = v_target_status
    and lower(btrim(coalesce(v_source.operation, ''))) = lower(btrim(coalesce(v_target_operation, '')))
    and v_source.status = 'at-shop2-buffer';

  if v_can_merge then
    update public.work_cards
    set quantity = coalesce(quantity, 0) + p_quantity,
        card_info = concat_ws(' ', nullif(btrim(coalesce(card_info, '')), ''),
          format('[VKYA_RETURN:%s:%s]', p_source_history_id, p_quantity))
    where id = v_source.id
    returning id into v_route_card_id;
  else
    insert into public.work_cards (
      task_id, order_id, nomenclature_id, quantity, operation, status,
      machine, manager_name, shift_name, card_info
    ) values (
      v_source.task_id, v_source.order_id, v_source.nomenclature_id, p_quantity,
      v_target_operation, v_target_status, '—', v_source.manager_name, v_source.shift_name,
      format('[VKYA_RETURN] [SOURCE_CARD:%s] [SOURCE_HISTORY:%s] Повернено в Буфер Цеху №2 з ВКЯ',
        v_source.id, v_history.id)
    ) returning id into v_route_card_id;
  end if;

  if v_target_inventory is not null then
    perform public.vkya_add_route_inventory(v_history.nomenclature_id, v_target_inventory, p_quantity);
  end if;

  insert into public.vkya_quality_resolutions (
    source_history_id, source_card_id, task_id, order_id, nomenclature_id,
    quantity, disposition, route_card_id, resolved_by_user_id, resolved_by_name, notes
  ) values (
    v_history.id, v_source.id, v_source.task_id, v_source.order_id, v_history.nomenclature_id,
    p_quantity, 'returned_to_route', v_route_card_id, p_resolved_by_user_id,
    nullif(btrim(p_resolved_by_name), ''), p_notes
  ) returning id into v_resolution_id;

  return v_route_card_id;
end;
$body$;

revoke all on function public.return_vkya_quantity_to_route(uuid,integer,bigint,text,text) from public;
grant execute on function public.return_vkya_quantity_to_route(uuid,integer,bigint,text,text) to anon, authenticated;

commit;
