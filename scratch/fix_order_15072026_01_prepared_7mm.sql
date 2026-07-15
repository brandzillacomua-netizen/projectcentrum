begin;

do $$
declare
  v_order_id uuid;
  v_old_nom_id uuid;
  v_new_nom_id uuid;
  v_new_inventory_id uuid;
  v_updated_requests integer;
begin
  select id
    into v_order_id
  from orders
  where order_num = '15072026-01';

  if v_order_id is null then
    raise exception 'Замовлення 15072026-01 не знайдено';
  end if;

  select id
    into v_old_nom_id
  from nomenclatures
  where name = 'Лист Т300 (7мм) [Непідготовлений]';

  select id
    into v_new_nom_id
  from nomenclatures
  where name = 'Лист Т300 (7мм) [Підготовлений]';

  if v_old_nom_id is null or v_new_nom_id is null then
    raise exception 'Не знайдено підготовлену або непідготовлену номенклатуру Т300 7мм';
  end if;

  select id
    into v_new_inventory_id
  from inventory
  where nomenclature_id = v_new_nom_id
    and warehouse = 'operational'
  order by id
  limit 1;

  if v_new_inventory_id is null then
    raise exception 'На оперативному складі не знайдено запис для підготовленого Т300 7мм';
  end if;

  update material_requests
  set nomenclature_id = v_new_nom_id,
      inventory_id = v_new_inventory_id,
      details = replace(details, '[Непідготовлений]', '[Підготовлений]')
  where order_id = v_order_id
    and nomenclature_id = v_old_nom_id
    and card_id is null;

  get diagnostics v_updated_requests = row_count;

  update tasks
  set plan_snapshot = jsonb_set(
    plan_snapshot #- array['materialSummary', v_old_nom_id::text],
    array['materialSummary', v_new_nom_id::text],
    jsonb_set(
      jsonb_set(
        jsonb_set(
          plan_snapshot #> array['materialSummary', v_old_nom_id::text],
          '{matName}',
          to_jsonb('Лист Т300 (7мм) [Підготовлений]'::text)
        ),
        '{nomenclature_id}',
        to_jsonb(v_new_nom_id::text)
      ),
      '{inventory_id}',
      to_jsonb(v_new_inventory_id::text)
    ),
    true
  )
  where order_id = v_order_id
    and plan_snapshot #> array['materialSummary', v_old_nom_id::text] is not null;

  raise notice 'Оновлено загальних заявок: %', v_updated_requests;
end $$;

commit;

-- Перевірка: має повернути тільки [Підготовлений] для Т300 7мм.
select
  mr.id,
  mr.quantity,
  mr.status,
  n.name as nomenclature,
  i.name as inventory_name,
  i.warehouse,
  mr.details
from material_requests mr
join orders o on o.id = mr.order_id
left join nomenclatures n on n.id = mr.nomenclature_id
left join inventory i on i.id = mr.inventory_id
where o.order_num = '15072026-01'
  and mr.card_id is null
  and mr.details ilike '%Т300 (7мм)%';
