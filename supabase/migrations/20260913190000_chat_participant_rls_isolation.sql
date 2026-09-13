-- rollout-contract: v1
-- risk: high
-- transaction: transactional
-- preflight: supabase/diagnostics/20260913190000_chat_participant_isolation_preflight.sql
-- postcondition: supabase/diagnostics/20260913190000_chat_participant_isolation_postcondition.sql
-- rollback: supabase/rollbacks/20260913190000_chat_participant_rls_isolation_rollback.sql
-- Purpose: enforce participant-level isolation for chats, polls, reactions, and Storage objects.

SET lock_timeout = '3s';
SET statement_timeout = '30s';

BEGIN;

LOCK TABLE public.chat_threads,
  public.chat_participants,
  public.chat_messages,
  public.chat_message_reactions,
  public.chat_polls,
  public.chat_poll_options,
  public.chat_poll_votes
  IN SHARE ROW EXCLUSIVE MODE;

DO $precondition$
DECLARE
  policy_count integer;
  unscoped_count integer;
  blocker_count integer;
BEGIN
  IF to_regprocedure('public.mes_current_system_user_id()') IS NULL THEN
    RAISE EXCEPTION 'Chat isolation aborted: identity binding function is missing';
  END IF;

  IF (
    SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relrowsecurity
      AND c.relname = ANY(ARRAY[
        'chat_threads', 'chat_participants', 'chat_messages',
        'chat_message_reactions', 'chat_polls', 'chat_poll_options', 'chat_poll_votes'
      ])
  ) <> 7 THEN
    RAISE EXCEPTION 'Chat isolation aborted: RLS must already be enabled on all 7 chat tables';
  END IF;

  SELECT count(*), count(*) FILTER (
    WHERE roles = ARRAY['authenticated']::name[]
      AND replace(replace(coalesce(qual, ''), '(', ''), ')', '') = 'true'
      AND replace(replace(coalesce(with_check, ''), '(', ''), ')', '') = 'true'
  )
  INTO policy_count, unscoped_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = ANY(ARRAY[
      'chat_threads', 'chat_participants', 'chat_messages',
      'chat_message_reactions', 'chat_polls', 'chat_poll_options', 'chat_poll_votes'
    ]);

  IF policy_count <> 7 OR unscoped_count <> 7 THEN
    RAISE EXCEPTION 'Chat isolation aborted: expected 7 authenticated unscoped policies, found % policies / % unscoped', policy_count, unscoped_count;
  END IF;

  SELECT
    (SELECT count(*) FROM public.chat_threads t
      WHERE NOT EXISTS (SELECT 1 FROM public.chat_participants p WHERE p.thread_id = t.id))
    + (SELECT count(*) FROM public.chat_participants p
      LEFT JOIN public.system_users u ON u.id = p.user_id WHERE u.id IS NULL)
    + (SELECT count(*) FROM public.chat_participants p
      JOIN public.system_users u ON u.id = p.user_id WHERE u.auth_user_id IS NULL)
    + (SELECT count(*) FROM storage.objects o
      WHERE o.bucket_id = 'chat-attachments'
        AND NOT EXISTS (SELECT 1 FROM public.chat_threads t WHERE t.id::text = split_part(o.name, '/', 1)))
  INTO blocker_count;

  IF blocker_count <> 0 THEN
    RAISE EXCEPTION 'Chat isolation aborted: % integrity blocker(s) detected', blocker_count;
  END IF;
END
$precondition$;

CREATE OR REPLACE FUNCTION public.chat_can_access_thread(p_thread_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
  WITH caller AS (SELECT public.mes_current_system_user_id() AS user_id)
  SELECT EXISTS (
    SELECT 1
    FROM public.chat_threads t
    CROSS JOIN caller c
    LEFT JOIN public.chat_participants p
      ON p.thread_id = t.id AND p.user_id = c.user_id
    WHERE t.id = p_thread_id
      AND c.user_id IS NOT NULL
      AND (t.created_by = c.user_id OR p.user_id = c.user_id)
  )
$function$;

CREATE OR REPLACE FUNCTION public.chat_can_access_message(p_message_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.chat_messages m
    WHERE m.id = p_message_id AND public.chat_can_access_thread(m.thread_id)
  )
$function$;

CREATE OR REPLACE FUNCTION public.chat_can_access_poll(p_poll_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.chat_polls p
    WHERE p.id = p_poll_id AND public.chat_can_access_thread(p.thread_id)
  )
$function$;

CREATE OR REPLACE FUNCTION public.chat_can_access_storage_object(p_object_name text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.chat_threads t
    WHERE t.id::text = split_part(p_object_name, '/', 1)
      AND public.chat_can_access_thread(t.id)
  )
$function$;

REVOKE ALL ON FUNCTION public.chat_can_access_thread(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.chat_can_access_message(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.chat_can_access_poll(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.chat_can_access_storage_object(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chat_can_access_thread(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.chat_can_access_message(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.chat_can_access_poll(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.chat_can_access_storage_object(text) TO authenticated, service_role;

DO $drop_legacy_policies$
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
$drop_legacy_policies$;

CREATE POLICY chat_threads_member_select ON public.chat_threads FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL AND public.chat_can_access_thread(id));
CREATE POLICY chat_threads_member_insert ON public.chat_threads FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL AND created_by = public.mes_current_system_user_id());
CREATE POLICY chat_threads_member_update ON public.chat_threads FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL AND public.chat_can_access_thread(id))
  WITH CHECK (auth.uid() IS NOT NULL AND public.chat_can_access_thread(id));
CREATE POLICY chat_threads_member_delete ON public.chat_threads FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL AND public.chat_can_access_thread(id));

CREATE POLICY chat_participants_member_select ON public.chat_participants FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL AND public.chat_can_access_thread(thread_id));
CREATE POLICY chat_participants_member_insert ON public.chat_participants FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL AND public.chat_can_access_thread(thread_id));
CREATE POLICY chat_participants_member_update ON public.chat_participants FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL AND public.chat_can_access_thread(thread_id))
  WITH CHECK (auth.uid() IS NOT NULL AND public.chat_can_access_thread(thread_id));
CREATE POLICY chat_participants_member_delete ON public.chat_participants FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL AND public.chat_can_access_thread(thread_id));

CREATE POLICY chat_messages_member_select ON public.chat_messages FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL AND public.chat_can_access_thread(thread_id));
CREATE POLICY chat_messages_member_insert ON public.chat_messages FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND public.chat_can_access_thread(thread_id)
    AND sender_id = public.mes_current_system_user_id()
  );
CREATE POLICY chat_messages_member_update ON public.chat_messages FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL AND public.chat_can_access_thread(thread_id))
  WITH CHECK (auth.uid() IS NOT NULL AND public.chat_can_access_thread(thread_id));
CREATE POLICY chat_messages_member_delete ON public.chat_messages FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL AND public.chat_can_access_thread(thread_id));

CREATE POLICY chat_reactions_member_select ON public.chat_message_reactions FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL AND public.chat_can_access_message(message_id));
CREATE POLICY chat_reactions_own_insert ON public.chat_message_reactions FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND user_id = public.mes_current_system_user_id()
    AND public.chat_can_access_message(message_id)
  );
CREATE POLICY chat_reactions_own_update ON public.chat_message_reactions FOR UPDATE TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND user_id = public.mes_current_system_user_id()
    AND public.chat_can_access_message(message_id)
  )
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND user_id = public.mes_current_system_user_id()
    AND public.chat_can_access_message(message_id)
  );
CREATE POLICY chat_reactions_own_delete ON public.chat_message_reactions FOR DELETE TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND user_id = public.mes_current_system_user_id()
    AND public.chat_can_access_message(message_id)
  );

CREATE POLICY chat_polls_member_select ON public.chat_polls FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL AND public.chat_can_access_thread(thread_id));
CREATE POLICY chat_polls_member_insert ON public.chat_polls FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND created_by = public.mes_current_system_user_id()
    AND public.chat_can_access_thread(thread_id)
  );
CREATE POLICY chat_polls_member_update ON public.chat_polls FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL AND public.chat_can_access_thread(thread_id))
  WITH CHECK (auth.uid() IS NOT NULL AND public.chat_can_access_thread(thread_id));
CREATE POLICY chat_polls_member_delete ON public.chat_polls FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL AND public.chat_can_access_thread(thread_id));

CREATE POLICY chat_poll_options_member_select ON public.chat_poll_options FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL AND public.chat_can_access_poll(poll_id));
CREATE POLICY chat_poll_options_member_insert ON public.chat_poll_options FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL AND public.chat_can_access_poll(poll_id));
CREATE POLICY chat_poll_options_member_update ON public.chat_poll_options FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL AND public.chat_can_access_poll(poll_id))
  WITH CHECK (auth.uid() IS NOT NULL AND public.chat_can_access_poll(poll_id));
CREATE POLICY chat_poll_options_member_delete ON public.chat_poll_options FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL AND public.chat_can_access_poll(poll_id));

CREATE POLICY chat_poll_votes_member_select ON public.chat_poll_votes FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL AND public.chat_can_access_poll(poll_id));
CREATE POLICY chat_poll_votes_own_insert ON public.chat_poll_votes FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND user_id = public.mes_current_system_user_id()
    AND public.chat_can_access_poll(poll_id)
  );
CREATE POLICY chat_poll_votes_own_update ON public.chat_poll_votes FOR UPDATE TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND user_id = public.mes_current_system_user_id()
    AND public.chat_can_access_poll(poll_id)
  )
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND user_id = public.mes_current_system_user_id()
    AND public.chat_can_access_poll(poll_id)
  );
CREATE POLICY chat_poll_votes_own_delete ON public.chat_poll_votes FOR DELETE TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND user_id = public.mes_current_system_user_id()
    AND public.chat_can_access_poll(poll_id)
  );

DROP POLICY IF EXISTS chat_attachments_select ON storage.objects;
DROP POLICY IF EXISTS chat_attachments_insert ON storage.objects;
DROP POLICY IF EXISTS chat_attachments_update ON storage.objects;
DROP POLICY IF EXISTS chat_attachments_delete ON storage.objects;

CREATE POLICY chat_attachments_select ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'chat-attachments' AND auth.uid() IS NOT NULL AND public.chat_can_access_storage_object(name));
CREATE POLICY chat_attachments_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chat-attachments' AND auth.uid() IS NOT NULL AND public.chat_can_access_storage_object(name));
CREATE POLICY chat_attachments_update ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'chat-attachments' AND auth.uid() IS NOT NULL AND public.chat_can_access_storage_object(name))
  WITH CHECK (bucket_id = 'chat-attachments' AND auth.uid() IS NOT NULL AND public.chat_can_access_storage_object(name));
CREATE POLICY chat_attachments_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'chat-attachments' AND auth.uid() IS NOT NULL AND public.chat_can_access_storage_object(name));

DO $postcondition$
DECLARE
  chat_policy_count integer;
  storage_policy_count integer;
  helper_count integer;
  rls_table_count integer;
  storage_rls_enabled boolean;
BEGIN
  SELECT count(*) INTO chat_policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = ANY(ARRAY[
      'chat_threads', 'chat_participants', 'chat_messages',
      'chat_message_reactions', 'chat_polls', 'chat_poll_options', 'chat_poll_votes'
    ])
    AND roles = ARRAY['authenticated']::name[]
    AND NOT (
      (
        cmd <> 'INSERT'
        AND replace(replace(coalesce(qual, ''), '(', ''), ')', '') IN ('true', '')
      ) OR (
        cmd IN ('INSERT', 'UPDATE', 'ALL')
        AND replace(replace(coalesce(with_check, ''), '(', ''), ')', '') IN ('true', '')
      )
    );

  SELECT count(*) INTO storage_policy_count
  FROM pg_policies
  WHERE schemaname = 'storage'
    AND tablename = 'objects'
    AND policyname LIKE 'chat_attachments_%'
    AND roles = ARRAY['authenticated']::name[]
    AND (
      coalesce(qual, '') ILIKE '%chat_can_access_storage_object%'
      OR coalesce(with_check, '') ILIKE '%chat_can_access_storage_object%'
    );

  SELECT count(*) INTO helper_count
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname IN (
      'chat_can_access_thread', 'chat_can_access_message',
      'chat_can_access_poll', 'chat_can_access_storage_object'
    )
    AND p.prosecdef
    AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
    AND NOT has_function_privilege('anon', p.oid, 'EXECUTE');

  SELECT count(*) INTO rls_table_count
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relrowsecurity
    AND c.relname = ANY(ARRAY[
      'chat_threads', 'chat_participants', 'chat_messages',
      'chat_message_reactions', 'chat_polls', 'chat_poll_options', 'chat_poll_votes'
    ]);

  SELECT c.relrowsecurity INTO storage_rls_enabled
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'storage' AND c.relname = 'objects';

  IF chat_policy_count <> 28 OR storage_policy_count <> 4 OR helper_count <> 4
     OR rls_table_count <> 7 OR storage_rls_enabled IS NOT TRUE THEN
    RAISE EXCEPTION 'Chat isolation postcondition failed: chat policies %, storage policies %, helpers %, RLS tables %, Storage RLS %',
      chat_policy_count, storage_policy_count, helper_count, rls_table_count, storage_rls_enabled;
  END IF;
END
$postcondition$;

COMMIT;
