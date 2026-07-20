-- One bounded database call replaces the client-side N+1 unread counters.
-- This is additive: clients without this RPC keep using their compatibility
-- fallback, so the migration and frontend can be rolled out independently.

create index if not exists idx_chat_messages_unread_lookup
  on public.chat_messages (thread_id, created_at)
  where deleted_at is null;

create or replace function public.chat_unread_counts(p_user_id bigint)
returns table (
  thread_id uuid,
  unread_count bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    cp.thread_id,
    count(cm.id)::bigint as unread_count
  from public.chat_participants cp
  left join public.chat_messages cm
    on cm.thread_id = cp.thread_id
   and cm.deleted_at is null
   and cm.sender_id is distinct from p_user_id
   and cm.created_at > coalesce(cp.last_read_at, '-infinity'::timestamptz)
  where cp.user_id = p_user_id
  group by cp.thread_id;
$$;

revoke all on function public.chat_unread_counts(bigint) from public;
grant execute on function public.chat_unread_counts(bigint) to anon, authenticated;

comment on function public.chat_unread_counts(bigint) is
  'Returns unread message totals per thread for one MES user in a single indexed query.';
