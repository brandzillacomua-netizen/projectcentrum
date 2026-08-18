-- Create return_legacy_restoration_to_bz function to return unlinked restoration cards directly to BZ stock.

begin;

create or replace function public.return_legacy_restoration_to_bz(
  p_restoration_card_id uuid,
  p_returned_by text default null
) returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $body$
declare
  v_restoration public.vkya_restoration_cards%rowtype;
  v_inventory_id uuid;
  v_inventory_qty numeric;
  v_nom_name text;
  v_nom_unit text;
begin
  select * into v_restoration from public.vkya_restoration_cards
  where id = p_restoration_card_id for update;
  if not found then raise exception 'Карту відновлення не знайдено'; end if;
  if v_restoration.status <> 'completed' then raise exception 'Спочатку завершіть карту відновлення'; end if;
  if v_restoration.completed_quantity <= 0 then raise exception 'Немає відновлених деталей для повернення'; end if;
  if v_restoration.route_card_id is not null or v_restoration.shop2_card_id is not null then
    raise exception 'Карту вже оброблено';
  end if;

  select name, unit into v_nom_name, v_nom_unit
    from public.nomenclatures where id = v_restoration.nomenclature_id;

  select id, total_qty into v_inventory_id, v_inventory_qty
    from public.inventory
   where nomenclature_id = v_restoration.nomenclature_id and type = 'bz'
   order by updated_at desc nulls last limit 1 for update;

  if v_inventory_id is null then
    insert into public.inventory (nomenclature_id, name, unit, total_qty, reserved_qty, type, pocket_owner, updated_at)
    values (v_restoration.nomenclature_id, coalesce(v_nom_name, 'Деталь'), coalesce(v_nom_unit, 'шт'), v_restoration.completed_quantity, 0, 'bz', null, now());
  else
    update public.inventory set total_qty = coalesce(v_inventory_qty, 0) + v_restoration.completed_quantity, updated_at = now()
     where id = v_inventory_id;
  end if;

  update public.vkya_restoration_cards set
    route_card_id = '00000000-0000-0000-0000-000000000000', -- sentinel value for BZ return
    returned_to_route_at = now(),
    returned_to_route_by = nullif(btrim(p_returned_by), ''),
    updated_at = now()
  where id = v_restoration.id;
end;
$body$;

revoke all on function public.return_legacy_restoration_to_bz(uuid,text) from public;
grant execute on function public.return_legacy_restoration_to_bz(uuid,text) to anon, authenticated;

commit;
