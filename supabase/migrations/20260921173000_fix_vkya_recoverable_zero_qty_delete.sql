-- rollout-contract: v1
-- preflight: 20260921173000_fix_vkya_recoverable_zero_qty_delete_preflight.sql
-- postcondition: 20260921173000_fix_vkya_recoverable_zero_qty_delete_postcondition.sql
-- rollback: 20260921173000_fix_vkya_recoverable_zero_qty_delete_rollback.sql

begin;

set lock_timeout = '5s';
set statement_timeout = '15s';

create or replace function public.vkya_take_recoverable_scrap(
  p_nomenclature_id uuid,
  p_storage_type text,
  p_quantity integer
) returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $body$
declare
  v_row record;
  v_remaining numeric := p_quantity;
  v_available numeric;
  v_take numeric;
begin
  if p_quantity is null or p_quantity <= 0 then raise exception 'Кількість має бути більшою за нуль'; end if;
  if p_storage_type not in ('scrap_cat_1', 'scrap_cat_2') then raise exception 'Невідомий тип партії браку'; end if;

  perform pg_advisory_xact_lock(hashtextextended(
    'vkya-recoverable:' || p_nomenclature_id::text || ':' || p_storage_type, 0
  ));

  select coalesce(sum(total_qty), 0) into v_available
  from public.inventory
  where nomenclature_id = p_nomenclature_id
    and case when type = 'scrap_cat_2' then 'scrap_cat_2' else 'scrap_cat_1' end = p_storage_type
    and type in ('scrap_cat_1', 'scrap_cat_2', 'scrap_cat_3');

  if v_available < p_quantity then
    raise exception 'У складському залишку цієї партії доступно лише % шт.', v_available;
  end if;

  for v_row in
    select id, total_qty
    from public.inventory
    where nomenclature_id = p_nomenclature_id
      and case when type = 'scrap_cat_2' then 'scrap_cat_2' else 'scrap_cat_1' end = p_storage_type
      and type in ('scrap_cat_1', 'scrap_cat_2', 'scrap_cat_3')
      and coalesce(total_qty, 0) > 0 -- FIX: Do not select rows that are already at 0
    order by updated_at nulls first, id
    for update
  loop
    exit when v_remaining <= 0;
    v_take := least(coalesce(v_row.total_qty, 0), v_remaining);
    
    if coalesce(v_row.total_qty, 0) - v_take <= 0 then
      begin
        delete from public.inventory where id = v_row.id;
      exception when foreign_key_violation then
        -- Fallback if the row is referenced by a historical table (e.g. balance repair receipts)
        update public.inventory set total_qty = 0, updated_at = now() where id = v_row.id;
      end;
    else
      update public.inventory
      set total_qty = coalesce(total_qty, 0) - v_take, updated_at = now()
      where id = v_row.id;
    end if;
    v_remaining := v_remaining - v_take;
  end loop;
end;
$body$;

commit;
