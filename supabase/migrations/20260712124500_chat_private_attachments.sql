update storage.buckets
   set public = false
 where id = 'chat-attachments';

update public.chat_messages
   set attachment_path = regexp_replace(
     attachment_url,
     '^.*/storage/v1/object/public/chat-attachments/',
     ''
   )
 where attachment_path is null
   and attachment_url like '%/storage/v1/object/public/chat-attachments/%';

drop policy if exists chat_attachments_select on storage.objects;
drop policy if exists chat_attachments_insert on storage.objects;
drop policy if exists chat_attachments_update on storage.objects;
drop policy if exists chat_attachments_delete on storage.objects;

create policy chat_attachments_select on storage.objects
for select using (bucket_id = 'chat-attachments');

create policy chat_attachments_insert on storage.objects
for insert with check (bucket_id = 'chat-attachments');

create policy chat_attachments_update on storage.objects
for update using (bucket_id = 'chat-attachments') with check (bucket_id = 'chat-attachments');

create policy chat_attachments_delete on storage.objects
for delete using (bucket_id = 'chat-attachments');
