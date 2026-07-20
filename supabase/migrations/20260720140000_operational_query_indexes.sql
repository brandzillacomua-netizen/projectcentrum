-- Indexes for the bounded operational reads used by terminals and dashboards.
-- Current production tables are small enough for a regular additive migration;
-- re-check pg_stat_user_indexes after rollout and remove only demonstrably
-- unused duplicates in a later, separately approved migration.

create index if not exists idx_tasks_active_created_desc
  on public.tasks (created_at desc, id)
  where status <> 'completed';

create index if not exists idx_tasks_recent_completed_desc
  on public.tasks (completed_at desc, id)
  where status = 'completed';

create index if not exists idx_work_cards_active_created_desc
  on public.work_cards (created_at desc, id)
  where status <> 'completed';

create index if not exists idx_work_cards_task_status_created
  on public.work_cards (task_id, status, created_at desc);

create index if not exists idx_material_requests_active_created_desc
  on public.material_requests (created_at desc, id)
  where status <> 'completed';

create index if not exists idx_material_requests_completed_created_desc
  on public.material_requests (created_at desc, id)
  where status = 'completed';

create index if not exists idx_material_requests_task_status_created
  on public.material_requests (task_id, status, created_at desc);

create index if not exists idx_work_card_history_effective_completed
  on public.work_card_history ((coalesce(completed_at, created_at)) desc);
