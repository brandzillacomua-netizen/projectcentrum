create or replace function public.touch_chat_thread()
returns trigger
language plpgsql
as $$
begin
  update public.chat_threads
     set updated_at = now(),
         last_message_at = now(),
         last_message = case
           when new.attachment_type = 'channel_poll' then '[Опитування]'
           when new.attachment_type = 'system_task' then '[Завдання]'
           when new.attachment_url is not null then '[Фото]'
           else '[Повідомлення]'
         end
   where id = new.thread_id;
  return new;
end;
$$;

update public.chat_threads
   set last_message = case
     when last_message is null then null
     when last_message in ('Чат створено', 'Р§Р°С‚ СЃС‚РІРѕСЂРµРЅРѕ') then last_message
     when last_message in ('[Фото]', '[Опитування]', '[Завдання]', '[Повідомлення]') then last_message
     else '[Повідомлення]'
   end
 where last_message is not null;
