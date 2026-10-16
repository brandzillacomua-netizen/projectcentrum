SET lock_timeout = '5s';
SET statement_timeout = '60s';

BEGIN;

DROP FUNCTION IF EXISTS public.issue_warehouse_box(uuid, jsonb);
DROP INDEX IF EXISTS public.idx_work_cards_box_issued;
ALTER TABLE public.work_cards
  DROP COLUMN IF EXISTS box_issued_at,
  DROP COLUMN IF EXISTS is_box_issued;

COMMIT;
