create or replace function public.chat_thread_type(p_thread_id uuid)
returns text
language sql
stable
as $$
  select coalesce(thread_type, 'group')
    from public.chat_threads
   where id = p_thread_id
     and coalesce(is_archived, false) = false
$$;

create or replace function public.chat_participant_snapshot(p_thread_id uuid, p_user_id bigint)
returns table (
  user_login text,
  user_name text,
  participant_role text,
  can_post boolean
)
language sql
stable
as $$
  select
    cp.user_login,
    cp.user_name,
    coalesce(cp.participant_role, 'member') as participant_role,
    coalesce(cp.can_post, true) as can_post
  from public.chat_participants cp
  where cp.thread_id = p_thread_id
    and cp.user_id = p_user_id
  limit 1
$$;

create or replace function public.guard_chat_message_write()
returns trigger
language plpgsql
as $$
declare
  participant record;
  v_thread_type text;
begin
  if new.sender_id is null then
    raise exception 'chat sender_id is required';
  end if;

  select *
    into participant
    from public.chat_participant_snapshot(new.thread_id, new.sender_id);

  if participant.user_name is null then
    raise exception 'chat sender is not a participant of this thread';
  end if;

  v_thread_type := public.chat_thread_type(new.thread_id);
  if v_thread_type is null then
    raise exception 'chat thread does not exist or is archived';
  end if;

  if v_thread_type = 'channel' and participant.can_post is not true then
    raise exception 'this user cannot post to this channel';
  end if;

  new.sender_login := participant.user_login;
  new.sender_name := participant.user_name;
  return new;
end;
$$;

drop trigger if exists trg_guard_chat_message_write on public.chat_messages;
create trigger trg_guard_chat_message_write
before insert or update of thread_id, sender_id, sender_login, sender_name, body, attachment_url, attachment_path, attachment_type
on public.chat_messages
for each row execute function public.guard_chat_message_write();

create or replace function public.guard_chat_reaction_write()
returns trigger
language plpgsql
as $$
declare
  participant record;
  v_thread_id uuid;
begin
  if new.user_id is null then
    raise exception 'reaction user_id is required';
  end if;

  select thread_id
    into v_thread_id
    from public.chat_messages
   where id = new.message_id
     and deleted_at is null;

  if v_thread_id is null then
    raise exception 'message does not exist';
  end if;

  select *
    into participant
    from public.chat_participant_snapshot(v_thread_id, new.user_id);

  if participant.user_name is null then
    raise exception 'reaction user is not a participant of this thread';
  end if;

  new.user_login := participant.user_login;
  new.user_name := participant.user_name;
  return new;
end;
$$;

drop trigger if exists trg_guard_chat_reaction_write on public.chat_message_reactions;
create trigger trg_guard_chat_reaction_write
before insert or update of message_id, user_id, user_login, user_name, reaction
on public.chat_message_reactions
for each row execute function public.guard_chat_reaction_write();

create or replace function public.guard_chat_poll_write()
returns trigger
language plpgsql
as $$
declare
  participant record;
begin
  if new.created_by is null then
    raise exception 'poll created_by is required';
  end if;

  select *
    into participant
    from public.chat_participant_snapshot(new.thread_id, new.created_by);

  if participant.user_name is null then
    raise exception 'poll creator is not a participant of this thread';
  end if;

  if public.chat_thread_type(new.thread_id) = 'channel' and participant.can_post is not true then
    raise exception 'this user cannot create polls in this channel';
  end if;

  new.created_by_login := participant.user_login;
  new.created_by_name := participant.user_name;
  return new;
end;
$$;

drop trigger if exists trg_guard_chat_poll_write on public.chat_polls;
create trigger trg_guard_chat_poll_write
before insert or update of thread_id, created_by, created_by_login, created_by_name, question
on public.chat_polls
for each row execute function public.guard_chat_poll_write();

create or replace function public.guard_chat_poll_vote_write()
returns trigger
language plpgsql
as $$
declare
  participant record;
  v_thread_id uuid;
  v_allow_multiple boolean;
begin
  if new.user_id is null then
    raise exception 'vote user_id is required';
  end if;

  select p.thread_id, p.allow_multiple
    into v_thread_id, v_allow_multiple
    from public.chat_polls p
   where p.id = new.poll_id;

  if v_thread_id is null then
    raise exception 'poll does not exist';
  end if;

  select *
    into participant
    from public.chat_participant_snapshot(v_thread_id, new.user_id);

  if participant.user_name is null then
    raise exception 'vote user is not a participant of this thread';
  end if;

  if coalesce(v_allow_multiple, false) is false then
    delete from public.chat_poll_votes
     where poll_id = new.poll_id
       and user_id = new.user_id
       and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);
  end if;

  new.user_login := participant.user_login;
  new.user_name := participant.user_name;
  return new;
end;
$$;

drop trigger if exists trg_guard_chat_poll_vote_write on public.chat_poll_votes;
create trigger trg_guard_chat_poll_vote_write
before insert or update of poll_id, option_id, user_id, user_login, user_name
on public.chat_poll_votes
for each row execute function public.guard_chat_poll_vote_write();
