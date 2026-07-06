-- Projects inside the management task module.
create table if not exists public.task_projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  color text not null default '#8b5cf6',
  status text not null default 'active' check (status in ('active', 'archived')),
  member_logins jsonb not null default '[]'::jsonb,
  department_ids jsonb not null default '[]'::jsonb,
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.management_tasks
  add column if not exists project_id uuid references public.task_projects(id) on delete cascade;

create index if not exists management_tasks_project_id_idx on public.management_tasks(project_id);
create index if not exists task_projects_created_by_idx on public.task_projects(created_by);

alter table public.task_projects enable row level security;
drop policy if exists "task_projects_mes_access" on public.task_projects;
create policy "task_projects_mes_access" on public.task_projects
  for all to anon, authenticated using (true) with check (true);

grant select, insert, update, delete on public.task_projects to anon, authenticated;

-- supabase_realtime у цьому проєкті створена як FOR ALL TABLES,
-- тому нова таблиця автоматично входить до публікації.

