-- Наряд №26072026-01: замінити всі незавершені запити Ф6(120°) на Ф6(90°).
-- Скрипт не змінює вже завершені видачі зі складу.
--
-- Запускайте весь файл одним виконанням у Supabase SQL Editor.

begin;

do $$
declare
  v_order_id uuid;
  v_nom_90_id uuid;
  v_inv_90_id uuid;
  v_nom_90_name text;
  v_tasks_updated integer := 0;
  v_requests_updated integer := 0;
begin
  select o.id
    into v_order_id
  from public.orders o
  where trim(o.order_num) = '26072026-01'
  order by o.created_at desc nulls last
  limit 1;

  if v_order_id is null then
    raise exception 'Наряд/замовлення №26072026-01 не знайдено';
  end if;

  -- Беремо конкретну фасочну Ф6(90°) з оперативного складу.
  -- У поточному довіднику це позиція на кшталт «Фреза фасочна 6x50x90°».
  select n.id, i.id, n.name
    into v_nom_90_id, v_inv_90_id, v_nom_90_name
  from public.nomenclatures n
  join public.inventory i
    on i.nomenclature_id = n.id
  where lower(n.name) like '%фреза%'
    and lower(n.name) like '%фасочн%'
    and n.name ~* '(^|[^0-9])6([^0-9]|$)'
    and n.name ~* '90[[:space:]]*(°|град|\)|$)'
    and coalesce(i.warehouse, 'operational') = 'operational'
  order by
    (coalesce(i.total_qty, 0) - coalesce(i.reserved_qty, 0)) desc,
    i.created_at desc nulls last
  limit 1;

  if v_nom_90_id is null or v_inv_90_id is null then
    raise exception 'На оперативному складі не знайдено номенклатуру фасочної Ф6(90°)';
  end if;

  -- 1. Виправляємо snapshot наряду.
  -- Обидва ключі залишені навмисно: навіть якщо стара конфігурація картки
  -- містить generic Ф6(120), для цього наряду вона має брати обрану Ф6(90).
  update public.tasks t
  set plan_snapshot =
    jsonb_set(
      jsonb_set(
        coalesce(t.plan_snapshot, '{}'::jsonb),
        '{selectedCutters}',
        coalesce(t.plan_snapshot->'selectedCutters', '{}'::jsonb)
          || jsonb_build_object(
            'Фреза ф6 (90)', to_jsonb(v_inv_90_id::text),
            'Фреза ф6 (120)', to_jsonb(v_inv_90_id::text)
          ),
        true
      ),
      '{consumables}',
      coalesce(
        (
          select jsonb_agg(
            case
              when lower(coalesce(item->>'name', '')) like '%фреза%'
                and lower(coalesce(item->>'name', '')) like '%фасочн%'
                and coalesce(item->>'name', '') ~* '120[[:space:]]*(°|град|\)|$)'
              then jsonb_set(item, '{name}', to_jsonb(v_nom_90_name), true)
              else item
            end
          )
          from jsonb_array_elements(
            case
              when jsonb_typeof(t.plan_snapshot->'consumables') = 'array'
              then t.plan_snapshot->'consumables'
              else '[]'::jsonb
            end
          ) as items(item)
        ),
        '[]'::jsonb
      ),
      true
    )
  where t.order_id = v_order_id
    and t.step = 'Розкрій';

  get diagnostics v_tasks_updated = row_count;

  -- 2. Міняємо тільки pending-запити. issued/completed не чіпаємо,
  -- бо за ними резерв або складський рух уже відбувся.
  update public.material_requests mr
  set nomenclature_id = v_nom_90_id,
      inventory_id = v_inv_90_id,
      details = regexp_replace(
        regexp_replace(
          coalesce(mr.details, ''),
          'Фреза[[:space:]]+фасочна[^—]*120[[:space:]]*°?',
          v_nom_90_name,
          'gi'
        ),
        'Фреза[[:space:]]+ф6[[:space:]]*\(120\)',
        v_nom_90_name,
        'gi'
      )
  where mr.task_id in (
    select t.id
    from public.tasks t
    where t.order_id = v_order_id
      and t.step = 'Розкрій'
  )
    and mr.status = 'pending'
    and (
      exists (
        select 1
        from public.nomenclatures old_nom
        where old_nom.id = mr.nomenclature_id
          and lower(old_nom.name) like '%фреза%'
          and old_nom.name ~* '120[[:space:]]*(°|град|\)|$)'
      )
      or coalesce(mr.details, '') ~* 'фреза.*120[[:space:]]*(°|град|\)|$)'
    );

  get diagnostics v_requests_updated = row_count;

  raise notice
    'Готово. Наряд: %, tasks оновлено: %, запитів оновлено: %, обрана фреза: %',
    v_order_id, v_tasks_updated, v_requests_updated, v_nom_90_name;
end
$$;

commit;

-- Контрольний результат після виконання.
select
  o.order_num,
  t.id as task_id,
  t.status as task_status,
  t.plan_snapshot->'selectedCutters' as selected_cutters,
  t.plan_snapshot->'consumables' as consumables
from public.orders o
join public.tasks t on t.order_id = o.id
where trim(o.order_num) = '26072026-01'
  and t.step = 'Розкрій';

select
  mr.id,
  mr.task_id,
  mr.status,
  mr.quantity,
  n.name as cutter_name,
  mr.inventory_id,
  mr.details
from public.material_requests mr
join public.tasks t on t.id = mr.task_id
join public.orders o on o.id = t.order_id
left join public.nomenclatures n on n.id = mr.nomenclature_id
where trim(o.order_num) = '26072026-01'
  and (
    lower(coalesce(n.name, '')) like '%фреза%'
    or lower(coalesce(mr.details, '')) like '%фреза%'
  )
order by mr.created_at, mr.id;
