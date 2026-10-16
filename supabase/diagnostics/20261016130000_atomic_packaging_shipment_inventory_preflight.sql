-- Read-only report of already-shipped tasks that still have hanging reserves.
select mr.task_id, count(*) as hanging_requests, sum(mr.quantity) as hanging_qty
from public.material_requests mr
join public.tasks t on t.id = mr.task_id
where mr.status = 'issued'
  and mr.details ilike '%ЗАПИТ НА КОМПЛЕКТУВАННЯ%'
  and coalesce((t.plan_snapshot #>> '{_metadata,is_shipped}')::boolean, false)
group by mr.task_id
order by mr.task_id;
