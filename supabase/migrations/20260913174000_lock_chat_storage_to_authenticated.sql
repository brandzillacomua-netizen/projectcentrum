-- rollout-contract: v1
-- risk: medium
-- transaction: transactional
-- preflight: supabase/diagnostics/20260913174000_chat_storage_auth_preflight.sql
-- postcondition: supabase/diagnostics/20260913174000_chat_storage_auth_postcondition.sql
-- rollback: supabase/rollbacks/20260913174000_lock_chat_storage_to_authenticated_rollback.sql
-- Purpose: prevent anon/PUBLIC access to private chat attachments without changing stored objects.

SET lock_timeout = '3s';
SET statement_timeout = '30s';

BEGIN;

DO $precondition$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'chat-attachments') THEN
    RAISE EXCEPTION 'Storage hardening aborted: chat-attachments bucket does not exist';
  END IF;
  IF EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'chat-attachments' AND public) THEN
    RAISE EXCEPTION 'Storage hardening aborted: chat-attachments bucket must be private first';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    RAISE EXCEPTION 'Storage hardening aborted: authenticated role does not exist';
  END IF;
END
$precondition$;

DROP POLICY IF EXISTS chat_attachments_select ON storage.objects;
DROP POLICY IF EXISTS chat_attachments_insert ON storage.objects;
DROP POLICY IF EXISTS chat_attachments_update ON storage.objects;
DROP POLICY IF EXISTS chat_attachments_delete ON storage.objects;

CREATE POLICY chat_attachments_select ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'chat-attachments' AND auth.uid() IS NOT NULL);

CREATE POLICY chat_attachments_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chat-attachments' AND auth.uid() IS NOT NULL);

CREATE POLICY chat_attachments_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'chat-attachments' AND auth.uid() IS NOT NULL)
  WITH CHECK (bucket_id = 'chat-attachments' AND auth.uid() IS NOT NULL);

CREATE POLICY chat_attachments_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'chat-attachments' AND auth.uid() IS NOT NULL);

DO $postcondition$
DECLARE
  secure_policy_count integer;
BEGIN
  SELECT count(*)
  INTO secure_policy_count
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
    AND coalesce(qual, with_check, '') ILIKE '%auth.uid()%';

  IF secure_policy_count <> 4 THEN
    RAISE EXCEPTION 'Storage hardening postcondition failed: expected 4 authenticated policies, found %', secure_policy_count;
  END IF;
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND ('public' = ANY(roles) OR 'anon' = ANY(roles))
      AND (
        coalesce(qual, '') ILIKE '%chat-attachments%'
        OR coalesce(with_check, '') ILIKE '%chat-attachments%'
      )
  ) THEN
    RAISE EXCEPTION 'Storage hardening postcondition failed: anonymous policy survived';
  END IF;
END
$postcondition$;

COMMIT;

