-- Read-only postcondition for the chat attachment Storage boundary.
SELECT jsonb_build_object(
  'chat_storage_auth_postcondition', jsonb_build_object(
    'status', CASE
      WHEN EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'chat-attachments' AND NOT public)
        AND (
          SELECT count(*)
          FROM pg_policies
          WHERE schemaname = 'storage'
            AND tablename = 'objects'
            AND policyname IN (
              'chat_attachments_select',
              'chat_attachments_insert',
              'chat_attachments_update',
              'chat_attachments_delete'
            )
            AND roles = ARRAY['authenticated']::name[]
            AND coalesce(qual, with_check, '') ILIKE '%auth.uid()%'
        ) = 4
        AND NOT EXISTS (
          SELECT 1
          FROM pg_policies
          WHERE schemaname = 'storage'
            AND tablename = 'objects'
            AND ('public' = ANY(roles) OR 'anon' = ANY(roles))
            AND (
              coalesce(qual, '') ILIKE '%chat-attachments%'
              OR coalesce(with_check, '') ILIKE '%chat-attachments%'
            )
        )
      THEN 'PASS'
      ELSE 'FAIL'
    END,
    'bucket_private', EXISTS (
      SELECT 1 FROM storage.buckets WHERE id = 'chat-attachments' AND NOT public
    ),
    'authenticated_policies', (
      SELECT count(*)
      FROM pg_policies
      WHERE schemaname = 'storage'
        AND tablename = 'objects'
        AND policyname LIKE 'chat_attachments_%'
        AND roles = ARRAY['authenticated']::name[]
    ),
    'anonymous_policies', (
      SELECT count(*)
      FROM pg_policies
      WHERE schemaname = 'storage'
        AND tablename = 'objects'
        AND ('public' = ANY(roles) OR 'anon' = ANY(roles))
        AND (
          coalesce(qual, '') ILIKE '%chat-attachments%'
          OR coalesce(with_check, '') ILIKE '%chat-attachments%'
        )
    )
  )
);

