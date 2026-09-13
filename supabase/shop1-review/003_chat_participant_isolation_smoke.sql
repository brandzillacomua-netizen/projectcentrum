-- Local-only transactional smoke for participant-scoped chat RLS.
-- It changes the auth.uid() stub and inserts two Storage rows only inside a rolled-back transaction.
BEGIN;

CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql STABLE
AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

CREATE TEMP TABLE chat_isolation_context AS
SELECT
  u.auth_user_id,
  own_participation.thread_id AS own_thread_id,
  (
    SELECT t.id
    FROM public.chat_threads t
    WHERE t.id <> own_participation.thread_id
      AND NOT EXISTS (
        SELECT 1 FROM public.chat_participants outsider
        WHERE outsider.thread_id = t.id AND outsider.user_id = u.id
      )
    LIMIT 1
  ) AS foreign_thread_id
FROM public.system_users u
JOIN public.chat_participants own_participation ON own_participation.user_id = u.id
WHERE u.auth_user_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.chat_threads t
    WHERE NOT EXISTS (
      SELECT 1 FROM public.chat_participants outsider
      WHERE outsider.thread_id = t.id AND outsider.user_id = u.id
    )
  )
LIMIT 1;

DO $assert_context$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM chat_isolation_context
    WHERE auth_user_id IS NOT NULL AND own_thread_id IS NOT NULL AND foreign_thread_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Local chat isolation smoke could not build member/non-member context';
  END IF;
END
$assert_context$;

INSERT INTO storage.objects(bucket_id, name, metadata)
SELECT 'chat-attachments', own_thread_id::text || '/rls-smoke-own.webp', '{"size": 1}'::jsonb
FROM chat_isolation_context;

INSERT INTO storage.objects(bucket_id, name, metadata)
SELECT 'chat-attachments', foreign_thread_id::text || '/rls-smoke-foreign.webp', '{"size": 1}'::jsonb
FROM chat_isolation_context;

GRANT SELECT ON chat_isolation_context TO authenticated;
GRANT USAGE ON SCHEMA storage TO authenticated;
GRANT SELECT ON storage.objects TO authenticated;
DO $set_local_claim$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', (SELECT auth_user_id::text FROM chat_isolation_context), false);
END
$set_local_claim$;
SET ROLE authenticated;

DO $assert_isolation$
DECLARE
  own_thread_rows integer;
  foreign_thread_rows integer;
  own_storage_rows integer;
  foreign_storage_rows integer;
BEGIN
  SELECT count(*) INTO own_thread_rows
  FROM public.chat_threads
  WHERE id = (SELECT own_thread_id FROM chat_isolation_context);

  SELECT count(*) INTO foreign_thread_rows
  FROM public.chat_threads
  WHERE id = (SELECT foreign_thread_id FROM chat_isolation_context);

  SELECT count(*) INTO own_storage_rows
  FROM storage.objects
  WHERE name = (SELECT own_thread_id::text || '/rls-smoke-own.webp' FROM chat_isolation_context);

  SELECT count(*) INTO foreign_storage_rows
  FROM storage.objects
  WHERE name = (SELECT foreign_thread_id::text || '/rls-smoke-foreign.webp' FROM chat_isolation_context);

  IF own_thread_rows <> 1 OR foreign_thread_rows <> 0
     OR own_storage_rows <> 1 OR foreign_storage_rows <> 0 THEN
    RAISE EXCEPTION 'Local chat isolation smoke failed: own thread %, foreign thread %, own storage %, foreign storage %',
      own_thread_rows, foreign_thread_rows, own_storage_rows, foreign_storage_rows;
  END IF;
END
$assert_isolation$;

RESET ROLE;
SELECT jsonb_build_object(
  'chat_participant_isolation_local_smoke', jsonb_build_object(
    'status', 'PASS',
    'own_thread_visible', true,
    'foreign_thread_visible', false,
    'own_storage_visible', true,
    'foreign_storage_visible', false,
    'persistent_test_writes', 0
  )
);

ROLLBACK;
