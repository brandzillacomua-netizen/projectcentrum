-- Виправляє першоджерело для деталі
-- «Київ К-ІП9/10/31/36/37-9-10-11-Н-3-14» на малому верстаті:
-- у machine_operations Ф6(120) замінюється на Ф6(90).
--
-- Запускайте весь файл одним виконанням у Supabase SQL Editor.

begin;

do $$
declare
  v_part_id uuidFailed to run sql query: ERROR:  42804: COALESCE types jsonb and text[] cannot be matched
QUERY:  update public.machine_operations mo
  set side2_cut_ops = (
    select coalesce(
      array_agg(
        case
          when op_item ~ '^__CUTTER__(Reference)?:'
            and split_part(op_item, ':', 2)::uuid = any(v_f6_120_ids)
          then
            split_part(op_item, ':', 1)
            || ':' || v_f6_90_id::text
            || ':' || split_part(op_item, ':', 3)
          else op_item
        end
        order by ordinal
      ),
      array[]::text[]
    )
    from unnest(coalesce(mo.side2_cut_ops, array[]::text[]))
      with ordinality as source(op_item, ordinal)
  )
  where mo.nomenclature_id = v_part_id
    and (
      lower(coalesce(mo.machine_type, '')) like '%1200x800%'
      or lower(coalesce(mo.machine_type, '')) like '%1200х800%'
      or lower(coalesce(mo.machine_type, '')) like '%малий%'
      or lower(coalesce(mo.machine_id::text, '')) like '%1200x800%'
      or lower(coalesce(mo.machine_id::text, '')) like '%1200х800%'
      or lower(coalesce(mo.machine_id::text, '')) like '%малий%'
    )
    and exists (
      select 1
      from unnest(coalesce(mo.side2_cut_ops, array[]::text[])) as current_ops(op_item)
      where op_item ~ '^__CUTTER__(Reference)?:'
        and split_part(op_item, ':', 2)::uuid = any(v_f6_120_ids)
    )
CONTEXT:  PL/pgSQL function inline_code_block line 42 at SQL statement;
  v_f6_90_id uuid;
  v_f6_120_ids uuid[];
  v_updated integer := 0;
begin
  select n.id
    into v_part_id
  from public.nomenclatures n
  where trim(n.name) = 'Київ К-ІП9/10/31/36/37-9-10-11-Н-3-14'
  limit 1;

  if v_part_id is null then
    raise exception 'Не знайдено деталь Київ К-ІП9/10/31/36/37-9-10-11-Н-3-14';
  end if;

  select n.id
    into v_f6_90_id
  from public.nomenclatures n
  where lower(n.name) like '%фреза%'
    and n.name ~* 'ф[[:space:]]*6[[:space:]]*\([[:space:]]*90[[:space:]]*\)'
  order by
    case when n.type = 'cutter_type' then 0 else 1 end,
    n.created_at desc nulls last
  limit 1;

  if v_f6_90_id is null then
    raise exception 'Не знайдено системний тип «Фреза ф6 (90)»';
  end if;

  select array_agg(n.id)
    into v_f6_120_ids
  from public.nomenclatures n
  where lower(n.name) like '%фреза%'
    and n.name ~* 'ф[[:space:]]*6[[:space:]]*\([[:space:]]*120[[:space:]]*\)';

  if coalesce(array_length(v_f6_120_ids, 1), 0) = 0 then
    raise exception 'Не знайдено системний тип «Фреза ф6 (120)»';
  end if;

  update public.machine_operations mo
  set side2_cut_ops = (
    select coalesce(
      jsonb_agg(
        to_jsonb(
        case
          when op_item ~ '^__CUTTER__(Reference)?:'
            and split_part(op_item, ':', 2) in (
              select old_id::text
              from unnest(v_f6_120_ids) as old_ids(old_id)
            )
          then
            split_part(op_item, ':', 1)
            || ':' || v_f6_90_id::text
            || ':' || split_part(op_item, ':', 3)
          else op_item
        end)
        order by ordinal
      ),
      '[]'::jsonb
    )
    from jsonb_array_elements_text(coalesce(mo.side2_cut_ops, '[]'::jsonb))
      with ordinality as source(op_item, ordinal)
  )
  where mo.nomenclature_id = v_part_id
    and (
      lower(coalesce(mo.machine_type, '')) like '%1200x800%'
      or lower(coalesce(mo.machine_type, '')) like '%1200х800%'
      or lower(coalesce(mo.machine_type, '')) like '%малий%'
      or lower(coalesce(mo.machine_id::text, '')) like '%1200x800%'
      or lower(coalesce(mo.machine_id::text, '')) like '%1200х800%'
      or lower(coalesce(mo.machine_id::text, '')) like '%малий%'
    )
    and exists (
      select 1
      from jsonb_array_elements_text(coalesce(mo.side2_cut_ops, '[]'::jsonb))
        as current_ops(op_item)
      where op_item ~ '^__CUTTER__(Reference)?:'
        and split_part(op_item, ':', 2) in (
          select old_id::text
          from unnest(v_f6_120_ids) as old_ids(old_id)
        )
    );

  get diagnostics v_updated = row_count;

  if v_updated = 0 then
    raise exception
      'Не оновлено жодного запису: для цієї деталі на малому верстаті не знайдено Ф6(120)';
  end if;

  raise notice 'Оновлено конфігурацій machine_operations: %', v_updated;
end
$$;

commit;

-- Контроль: після виконання тут має бути «Фреза ф6 (90)», а не (120).
select
  part.name as part_name,
  mo.machine_type,
  mo.machine_id,
  cutter.name as cutter_name,
  split_part(cutter_op.op_item, ':', 3) as consumption_per_sheet
from public.machine_operations mo
join public.nomenclatures part on part.id = mo.nomenclature_id
cross join lateral jsonb_array_elements_text(coalesce(mo.side2_cut_ops, '[]'::jsonb))
  as cutter_op(op_item)
left join public.nomenclatures cutter
  on cutter.id::text = split_part(cutter_op.op_item, ':', 2)
where trim(part.name) = 'Київ К-ІП9/10/31/36/37-9-10-11-Н-3-14'
  and cutter_op.op_item ~ '^__CUTTER__(Reference)?:'
order by mo.machine_type, cutter.name;

-- Діагностика старого наряду: завершені запити лише показуємо,
-- але не переписуємо, щоб не спотворити вже проведений складський рух.
select
  mr.id,
  mr.status,
  mr.quantity,
  n.name as cutter_name,
  mr.details
from public.material_requests mr
join public.tasks t on t.id = mr.task_id
join public.orders o on o.id = t.order_id
left join public.nomenclatures n on n.id = mr.nomenclature_id
where trim(o.order_num) = '26072026-01'
  and (
    coalesce(n.name, '') ~* '120[[:space:]]*(°|град|\)|$)'
    or coalesce(mr.details, '') ~* 'фреза.*120[[:space:]]*(°|град|\)|$)'
  )
order by mr.status, mr.created_at;
