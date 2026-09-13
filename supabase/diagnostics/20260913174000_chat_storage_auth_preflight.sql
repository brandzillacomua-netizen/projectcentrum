-- Read-only preflight for the chat attachment Storage boundary.
SELECT jsonb_build_object(
  'chat_storage_auth_preflight', jsonb_build_object(
    'status', CASE
      WHEN NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'chat-attachments') THEN 'BUCKET_NOT_FOUND'
      WHEN EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'chat-attachments' AND public) THEN 'PUBLIC_BUCKET'
      WHEN EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'storage'
          AND tablename = 'objects'
          AND policyname IN (
            'chat_attachments_select',
            'chat_attachments_insert',
            'chat_attachments_update',
            'chat_attachments_delete'
          )
          AND ('public' = ANY(roles) OR 'anon' = ANY(roles))
      ) THEN 'EXPOSED'
      WHEN (
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
      ) = 4 THEN 'ALREADY_SECURE'
      ELSE 'UNEXPECTED_POLICY_STATE'
    END,
    'bucket', (
      SELECT jsonb_build_object(
        'public', public,
        'object_count', (SELECT count(*) FROM storage.objects WHERE bucket_id = 'chat-attachments'),
        'object_bytes', (SELECT coalesce(sum((metadata->>'size')::bigint), 0) FROM storage.objects WHERE bucket_id = 'chat-attachments')
      )
      FROM storage.buckets
      WHERE id = 'chat-attachments'
    ),
    'policies', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'name', policyname,
        'roles', roles,
        'command', cmd,
        'using', qual,
        'check', with_check
      ) ORDER BY policyname)
      FROM pg_policies
      WHERE schemaname = 'storage'
        AND tablename = 'objects'
        AND policyname LIKE 'chat_attachments_%'
    ), '[]'::jsonb)
  )
);

