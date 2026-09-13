-- Controlled rollback to the previous authenticated-only boundary.
-- This does not restore anonymous access, but temporarily removes per-thread isolation.
SET lock_timeout = '3s';
SET statement_timeout = '30s';

BEGIN;

DO $drop_policies$
DECLARE policy_row record;
BEGIN
  FOR policy_row IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = ANY(ARRAY[
        'chat_threads', 'chat_participants', 'chat_messages',
        'chat_message_reactions', 'chat_polls', 'chat_poll_options', 'chat_poll_votes'
      ])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', policy_row.policyname, policy_row.schemaname, policy_row.tablename);
  END LOOP;
END
$drop_policies$;

CREATE POLICY chat_threads_all ON public.chat_threads FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY chat_participants_all ON public.chat_participants FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY chat_messages_all ON public.chat_messages FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY chat_message_reactions_all ON public.chat_message_reactions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY chat_polls_all ON public.chat_polls FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY chat_poll_options_all ON public.chat_poll_options FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY chat_poll_votes_all ON public.chat_poll_votes FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS chat_attachments_select ON storage.objects;
DROP POLICY IF EXISTS chat_attachments_insert ON storage.objects;
DROP POLICY IF EXISTS chat_attachments_update ON storage.objects;
DROP POLICY IF EXISTS chat_attachments_delete ON storage.objects;

CREATE POLICY chat_attachments_select ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'chat-attachments' AND auth.uid() IS NOT NULL);
CREATE POLICY chat_attachments_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chat-attachments' AND auth.uid() IS NOT NULL);
CREATE POLICY chat_attachments_update ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'chat-attachments' AND auth.uid() IS NOT NULL)
  WITH CHECK (bucket_id = 'chat-attachments' AND auth.uid() IS NOT NULL);
CREATE POLICY chat_attachments_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'chat-attachments' AND auth.uid() IS NOT NULL);

DROP FUNCTION IF EXISTS public.chat_can_access_storage_object(text);
DROP FUNCTION IF EXISTS public.chat_can_access_poll(uuid);
DROP FUNCTION IF EXISTS public.chat_can_access_message(uuid);
DROP FUNCTION IF EXISTS public.chat_can_access_thread(uuid);

COMMIT;
