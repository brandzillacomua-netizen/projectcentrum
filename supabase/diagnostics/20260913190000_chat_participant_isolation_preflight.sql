-- Read-only preflight for participant-scoped chat isolation.
WITH chat_policy_state AS (
  SELECT count(*) AS policy_count,
         count(*) FILTER (
           WHERE roles = ARRAY['authenticated']::name[]
             AND replace(replace(coalesce(qual, ''), '(', ''), ')', '') = 'true'
             AND replace(replace(coalesce(with_check, ''), '(', ''), ')', '') = 'true'
         ) AS unscoped_authenticated_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = ANY(ARRAY[
      'chat_threads', 'chat_participants', 'chat_messages',
      'chat_message_reactions', 'chat_polls', 'chat_poll_options', 'chat_poll_votes'
    ])
), integrity AS (
  SELECT
    (SELECT count(*) FROM public.chat_threads t
      WHERE NOT EXISTS (SELECT 1 FROM public.chat_participants p WHERE p.thread_id = t.id)
    ) AS threads_without_participants,
    (SELECT count(*) FROM public.chat_participants p
      LEFT JOIN public.system_users u ON u.id = p.user_id
      WHERE u.id IS NULL
    ) AS participants_without_mes_user,
    (SELECT count(*) FROM public.chat_participants p
      JOIN public.system_users u ON u.id = p.user_id
      WHERE u.auth_user_id IS NULL
    ) AS participants_without_auth_binding,
    (SELECT count(*) FROM storage.objects o
      WHERE o.bucket_id = 'chat-attachments'
        AND NOT EXISTS (
          SELECT 1 FROM public.chat_threads t
          WHERE t.id::text = split_part(o.name, '/', 1)
        )
    ) AS storage_objects_without_thread
)
SELECT jsonb_build_object(
  'chat_participant_isolation_preflight', jsonb_build_object(
    'status', CASE
      WHEN to_regprocedure('public.mes_current_system_user_id()') IS NULL THEN 'IDENTITY_FUNCTION_MISSING'
      WHEN (
        SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relrowsecurity
          AND c.relname = ANY(ARRAY[
            'chat_threads', 'chat_participants', 'chat_messages',
            'chat_message_reactions', 'chat_polls', 'chat_poll_options', 'chat_poll_votes'
          ])
      ) <> 7 THEN 'RLS_NOT_ENABLED'
      WHEN p.policy_count <> 7 OR p.unscoped_authenticated_count <> 7 THEN 'UNEXPECTED_POLICY_STATE'
      WHEN i.threads_without_participants <> 0
        OR i.participants_without_mes_user <> 0
        OR i.participants_without_auth_binding <> 0
        OR i.storage_objects_without_thread <> 0 THEN 'DATA_BLOCKERS'
      ELSE 'READY'
    END,
    'current_chat_policies', p.policy_count,
    'unscoped_authenticated_policies', p.unscoped_authenticated_count,
    'rls_enabled_tables', (
      SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relrowsecurity
        AND c.relname = ANY(ARRAY[
          'chat_threads', 'chat_participants', 'chat_messages',
          'chat_message_reactions', 'chat_polls', 'chat_poll_options', 'chat_poll_votes'
        ])
    ),
    'threads_without_participants', i.threads_without_participants,
    'participants_without_mes_user', i.participants_without_mes_user,
    'participants_without_auth_binding', i.participants_without_auth_binding,
    'storage_objects_without_thread', i.storage_objects_without_thread
  )
)
FROM chat_policy_state p CROSS JOIN integrity i;
