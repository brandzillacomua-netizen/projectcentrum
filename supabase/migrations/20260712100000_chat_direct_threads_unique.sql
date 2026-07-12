alter table public.chat_threads
  add column if not exists direct_key text;

with pair_threads as (
  select
    t.id,
    'direct:' || string_agg(cp.user_id::text, ':' order by cp.user_id::text) as direct_key,
    coalesce(t.last_message_at, t.updated_at, t.created_at) as activity_at
  from public.chat_threads t
  join public.chat_participants cp on cp.thread_id = t.id
  where t.is_archived = false
  group by t.id, t.last_message_at, t.updated_at, t.created_at
  having count(*) = 2
),
ranked as (
  select
    *,
    row_number() over (partition by direct_key order by activity_at desc, id desc) as rn
  from pair_threads
)
update public.chat_threads t
   set thread_type = 'direct',
       direct_key = case when ranked.rn = 1 then ranked.direct_key else null end,
       is_archived = case when ranked.rn = 1 then t.is_archived else true end,
       updated_at = now()
  from ranked
 where t.id = ranked.id;

create unique index if not exists ux_chat_threads_direct_key_active
  on public.chat_threads (direct_key)
  where direct_key is not null and is_archived = false;
