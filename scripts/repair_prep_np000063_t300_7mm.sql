begin;

do $$
declare
  v_task_id uuid;
  v_material_id uuid;
  v_snapshot jsonb;
  v_new_snapshot jsonb;
  v_new_total numeric;
begin
  select id, plan_snapshot
  into v_task_id, v_snapshot
  from public.tasks
  where step = 'Підготовка'
    and plan_snapshot ->> '_prep_num' = 'НП000063'
  order by created_at desc
  limit 1
  for update;

  if v_task_id is null then
    raise exception 'Наряд підготовки НП000063 не знайдено';
  end if;

  select entry.key::uuid
  into v_material_id
  from jsonb_each(v_snapshot) entry
  where left(entry.key, 1) <> '_'
    and lower(coalesce(entry.value ->> 'name', '')) like '%300%'
    and lower(coalesce(entry.value ->> 'name', '')) like '%7мм%'
    and lower(coalesce(entry.value ->> 'name', '')) like '%непідготовлен%'
  limit 1;

  if v_material_id is null then
    raise exception 'Позицію T300 7мм [Непідготовлений] у НП000063 не знайдено';
  end if;

  v_new_snapshot := v_snapshot - v_material_id::text;

  select coalesce(sum((entry.value ->> 'plan')::numeric), 0)
  into v_new_total
  from jsonb_each(v_new_snapshot) entry
  where left(entry.key, 1) <> '_'
    and jsonb_typeof(entry.value) = 'object';

  delete from public.material_requests
  where task_id = v_task_id
    and nomenclature_id = v_material_id
    and status = 'pending';

  if exists (
    select 1 from public.material_requests
    where task_id = v_task_id
      and nomenclature_id = v_material_id
  ) then
    raise exception 'Запит на T300 7мм уже не pending; автоматичне видалення зупинено';
  end if;

  update public.tasks
  set plan_snapshot = v_new_snapshot,
      planned_sets = v_new_total
  where id = v_task_id;

  if v_new_snapshot ? v_material_id::text then
    raise exception 'Перевірка не пройдена: позиція 7мм залишилася в plan_snapshot';
  end if;
end
$$;

commit;

select
  id,
  plan_snapshot ->> '_prep_num' as prep_number,
  planned_sets,
  plan_snapshot
from public.tasks
where step = 'Підготовка'
  and plan_snapshot ->> '_prep_num' = 'НП000063';
