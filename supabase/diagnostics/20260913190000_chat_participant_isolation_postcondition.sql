-- Read-only postcondition for participant-scoped chat isolation.
WITH chat_policies AS (
  SELECT
    count(*) AS policy_count,
    count(*) FILTER (WHERE roles = ARRAY['authenticated']::name[]) AS authenticated_count,
    count(*) FILTER (
      WHERE (
        cmd <> 'INSERT'
        AND replace(replace(coalesce(qual, ''), '(', ''), ')', '') IN ('true', '')
      ) OR (
        cmd IN ('INSERT', 'UPDATE', 'ALL')
        AND replace(replace(coalesce(with_check, ''), '(', ''), ')', '') IN ('true', '')
      )
    ) AS unscoped_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = ANY(ARRAY[
      'chat_threads', 'chat_participants', 'chat_messages',
      'chat_message_reactions', 'chat_polls', 'chat_poll_options', 'chat_poll_votes'
    ])
), storage_policies AS (
  SELECT
    count(*) AS policy_count,
    count(*) FILTER (
      WHERE roles = ARRAY['authenticated']::name[]
        AND (
          coalesce(qual, '') ILIKE '%chat_can_access_storage_object%'
          OR coalesce(with_check, '') ILIKE '%chat_can_access_storage_object%'
        )
    ) AS participant_scoped_count,
    count(*) FILTER (WHERE 'public' = ANY(roles) OR 'anon' = ANY(roles)) AS anonymous_count
  FROM pg_policies
  WHERE schemaname = 'storage'
    AND tablename = 'objects'
    AND policyname LIKE 'chat_attachments_%'
), helpers AS (
  SELECT count(*) AS helper_count,
         count(*) FILTER (WHERE p.prosecdef) AS security_definer_count,
         count(*) FILTER (
           WHERE has_function_privilege('authenticated', p.oid, 'EXECUTE')
             AND NOT has_function_privilege('anon', p.oid, 'EXECUTE')
         ) AS authenticated_only_count
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname IN (
      'chat_can_access_thread', 'chat_can_access_message',
      'chat_can_access_poll', 'chat_can_access_storage_object'
    )
)
SELECT jsonb_build_object(
  'chat_participant_isolation_postcondition', jsonb_build_object(
    'status', CASE
      WHEN c.policy_count = 28
        AND c.authenticated_count = 28
        AND c.unscoped_count = 0
        AND s.policy_count = 4
        AND s.participant_scoped_count = 4
        AND s.anonymous_count = 0
        AND h.helper_count = 4
        AND h.security_definer_count = 4
        AND h.authenticated_only_count = 4
        AND (
          SELECT count(*) FROM pg_class pc JOIN pg_namespace pn ON pn.oid = pc.relnamespace
          WHERE pn.nspname = 'public' AND pc.relrowsecurity
            AND pc.relname = ANY(ARRAY[
              'chat_threads', 'chat_participants', 'chat_messages',
              'chat_message_reactions', 'chat_polls', 'chat_poll_options', 'chat_poll_votes'
            ])
        ) = 7
        AND (
          SELECT sc.relrowsecurity FROM pg_class sc JOIN pg_namespace sn ON sn.oid = sc.relnamespace
          WHERE sn.nspname = 'storage' AND sc.relname = 'objects'
        )
      THEN 'PASS' ELSE 'FAIL'
    END,
    'chat_policies', c.policy_count,
    'authenticated_chat_policies', c.authenticated_count,
    'unscoped_chat_policies', c.unscoped_count,
    'storage_policies', s.policy_count,
    'participant_scoped_storage_policies', s.participant_scoped_count,
    'anonymous_storage_policies', s.anonymous_count,
    'guard_helpers', h.helper_count,
    'security_definer_helpers', h.security_definer_count,
    'authenticated_only_helpers', h.authenticated_only_count
    , 'rls_enabled_chat_tables', (
      SELECT count(*) FROM pg_class pc JOIN pg_namespace pn ON pn.oid = pc.relnamespace
      WHERE pn.nspname = 'public' AND pc.relrowsecurity
        AND pc.relname = ANY(ARRAY[
          'chat_threads', 'chat_participants', 'chat_messages',
          'chat_message_reactions', 'chat_polls', 'chat_poll_options', 'chat_poll_votes'
        ])
    )
    , 'storage_rls_enabled', (
      SELECT sc.relrowsecurity FROM pg_class sc JOIN pg_namespace sn ON sn.oid = sc.relnamespace
      WHERE sn.nspname = 'storage' AND sc.relname = 'objects'
    )
  )
)
FROM chat_policies c CROSS JOIN storage_policies s CROSS JOIN helpers h;
