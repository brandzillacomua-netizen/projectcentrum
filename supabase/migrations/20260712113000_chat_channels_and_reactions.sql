alter table public.chat_participants
  add column if not exists participant_role text not null default 'member',
  add column if not exists can_post boolean not null default true;

update public.chat_participants
   set participant_role = coalesce(nullif(participant_role, ''), 'member'),
       can_post = coalesce(can_post, true);

create table if not exists public.chat_message_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.chat_messages(id) on delete cascade,
  user_id bigint not null,
  user_login text,
  user_name text not null,
  reaction text not null,
  created_at timestamptz not null default now(),
  constraint chat_message_reactions_reaction_not_empty check (length(trim(reaction)) > 0),
  unique(message_id, user_id, reaction)
);

create index if not exists idx_chat_message_reactions_message
  on public.chat_message_reactions(message_id);

create index if not exists idx_chat_message_reactions_user
  on public.chat_message_reactions(user_id);

create table if not exists public.chat_polls (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.chat_threads(id) on delete cascade,
  message_id uuid references public.chat_messages(id) on delete set null,
  question text not null,
  allow_multiple boolean not null default false,
  created_by bigint,
  created_by_login text,
  created_by_name text,
  closes_at timestamptz,
  created_at timestamptz not null default now(),
  constraint chat_polls_question_not_empty check (length(trim(question)) > 0)
);

create table if not exists public.chat_poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.chat_polls(id) on delete cascade,
  option_text text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint chat_poll_options_text_not_empty check (length(trim(option_text)) > 0)
);

create table if not exists public.chat_poll_votes (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.chat_polls(id) on delete cascade,
  option_id uuid not null references public.chat_poll_options(id) on delete cascade,
  user_id bigint not null,
  user_login text,
  user_name text not null,
  created_at timestamptz not null default now(),
  unique(poll_id, option_id, user_id)
);

create index if not exists idx_chat_polls_thread
  on public.chat_polls(thread_id, created_at desc);

create index if not exists idx_chat_poll_options_poll
  on public.chat_poll_options(poll_id, sort_order);

create index if not exists idx_chat_poll_votes_poll
  on public.chat_poll_votes(poll_id);

create index if not exists idx_chat_poll_votes_user
  on public.chat_poll_votes(user_id);

alter table public.chat_message_reactions enable row level security;
alter table public.chat_polls enable row level security;
alter table public.chat_poll_options enable row level security;
alter table public.chat_poll_votes enable row level security;

drop policy if exists chat_message_reactions_all on public.chat_message_reactions;
create policy chat_message_reactions_all on public.chat_message_reactions
for all using (true) with check (true);

drop policy if exists chat_polls_all on public.chat_polls;
create policy chat_polls_all on public.chat_polls
for all using (true) with check (true);

drop policy if exists chat_poll_options_all on public.chat_poll_options;
create policy chat_poll_options_all on public.chat_poll_options
for all using (true) with check (true);

drop policy if exists chat_poll_votes_all on public.chat_poll_votes;
create policy chat_poll_votes_all on public.chat_poll_votes
for all using (true) with check (true);

do $$
declare
  realtime_for_all boolean;
begin
  select coalesce(puballtables, false)
    into realtime_for_all
    from pg_publication
   where pubname = 'supabase_realtime';

  if realtime_for_all then
    return;
  end if;

  begin
    alter publication supabase_realtime add table public.chat_message_reactions;
  exception
    when duplicate_object then null;
    when undefined_object then null;
  end;

  begin
    alter publication supabase_realtime add table public.chat_polls;
  exception
    when duplicate_object then null;
    when undefined_object then null;
  end;

  begin
    alter publication supabase_realtime add table public.chat_poll_options;
  exception
    when duplicate_object then null;
    when undefined_object then null;
  end;

  begin
    alter publication supabase_realtime add table public.chat_poll_votes;
  exception
    when duplicate_object then null;
    when undefined_object then null;
  end;
end $$;
