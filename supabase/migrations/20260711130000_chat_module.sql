create extension if not exists pgcrypto;

create table if not exists public.chat_threads (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  thread_type text not null default 'group',
  context_type text,
  context_id text,
  created_by bigint,
  created_by_login text,
  created_by_name text,
  is_archived boolean not null default false,
  last_message text,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chat_participants (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.chat_threads(id) on delete cascade,
  user_id bigint not null,
  user_login text,
  user_name text not null,
  is_muted boolean not null default false,
  last_read_at timestamptz,
  created_at timestamptz not null default now(),
  unique(thread_id, user_id)
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.chat_threads(id) on delete cascade,
  sender_id bigint,
  sender_login text,
  sender_name text not null,
  body text,
  attachment_url text,
  attachment_path text,
  attachment_type text,
  attachment_name text,
  attachment_size integer,
  image_width integer,
  image_height integer,
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz,
  constraint chat_messages_has_content check (
    nullif(trim(coalesce(body, '')), '') is not null
    or attachment_url is not null
  )
);

create index if not exists idx_chat_threads_updated_at on public.chat_threads(updated_at desc);
create index if not exists idx_chat_threads_archived on public.chat_threads(is_archived);
create index if not exists idx_chat_participants_user on public.chat_participants(user_id);
create index if not exists idx_chat_participants_thread on public.chat_participants(thread_id);
create index if not exists idx_chat_messages_thread_created on public.chat_messages(thread_id, created_at desc);

create or replace function public.touch_chat_thread()
returns trigger
language plpgsql
as $$
begin
  update public.chat_threads
     set updated_at = now(),
         last_message_at = now(),
         last_message = case
           when nullif(trim(coalesce(new.body, '')), '') is not null then left(new.body, 240)
           when new.attachment_url is not null then '[Фото]'
           else last_message
         end
   where id = new.thread_id;
  return new;
end;
$$;

drop trigger if exists trg_touch_chat_thread on public.chat_messages;
create trigger trg_touch_chat_thread
after insert on public.chat_messages
for each row execute function public.touch_chat_thread();

alter table public.chat_threads enable row level security;
alter table public.chat_participants enable row level security;
alter table public.chat_messages enable row level security;

drop policy if exists chat_threads_all on public.chat_threads;
create policy chat_threads_all on public.chat_threads
for all using (true) with check (true);

drop policy if exists chat_participants_all on public.chat_participants;
create policy chat_participants_all on public.chat_participants
for all using (true) with check (true);

drop policy if exists chat_messages_all on public.chat_messages;
create policy chat_messages_all on public.chat_messages
for all using (true) with check (true);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-attachments',
  'chat-attachments',
  true,
  1048576,
  array['image/jpeg', 'image/webp', 'image/png']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists chat_attachments_select on storage.objects;
create policy chat_attachments_select on storage.objects
for select using (bucket_id = 'chat-attachments');

drop policy if exists chat_attachments_insert on storage.objects;
create policy chat_attachments_insert on storage.objects
for insert with check (bucket_id = 'chat-attachments');

drop policy if exists chat_attachments_update on storage.objects;
create policy chat_attachments_update on storage.objects
for update using (bucket_id = 'chat-attachments') with check (bucket_id = 'chat-attachments');

drop policy if exists chat_attachments_delete on storage.objects;
create policy chat_attachments_delete on storage.objects
for delete using (bucket_id = 'chat-attachments');

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
    alter publication supabase_realtime add table public.chat_threads;
  exception
    when duplicate_object then null;
    when undefined_object then null;
  end;

  begin
    alter publication supabase_realtime add table public.chat_participants;
  exception
    when duplicate_object then null;
    when undefined_object then null;
  end;

  begin
    alter publication supabase_realtime add table public.chat_messages;
  exception
    when duplicate_object then null;
    when undefined_object then null;
  end;
end $$;
