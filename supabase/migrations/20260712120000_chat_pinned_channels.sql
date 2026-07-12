alter table public.chat_threads
  add column if not exists is_pinned boolean not null default false;

update public.chat_threads
   set is_pinned = true,
       updated_at = now()
 where thread_type = 'channel'
   and coalesce(is_pinned, false) = false;

create index if not exists idx_chat_threads_pinned_updated
  on public.chat_threads(is_pinned desc, updated_at desc);
