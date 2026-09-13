-- Controlled-degradation rollback.
-- Removes chat attachment access instead of restoring the known anonymous exposure.
SET lock_timeout = '3s';
SET statement_timeout = '30s';

BEGIN;

DROP POLICY IF EXISTS chat_attachments_select ON storage.objects;
DROP POLICY IF EXISTS chat_attachments_insert ON storage.objects;
DROP POLICY IF EXISTS chat_attachments_update ON storage.objects;
DROP POLICY IF EXISTS chat_attachments_delete ON storage.objects;

COMMIT;

