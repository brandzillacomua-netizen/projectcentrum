-- Employee observations / supervisor notes table for Employee Dossier in Settings

SET lock_timeout = '5s';
SET statement_timeout = '60s';

BEGIN;

CREATE TABLE IF NOT EXISTS public.employee_observations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id BIGINT NOT NULL REFERENCES public.system_users(id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT 'note' CHECK (category IN ('note', 'praise', 'warning', 'incident')),
  title TEXT,
  comment TEXT NOT NULL,
  author_id BIGINT,
  author_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_employee_observations_user_created
  ON public.employee_observations (user_id, created_at DESC);

ALTER TABLE public.employee_observations ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.employee_observations FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.employee_observations TO authenticated, service_role;

DROP POLICY IF EXISTS employee_observations_select_auth ON public.employee_observations;
DROP POLICY IF EXISTS employee_observations_insert_auth ON public.employee_observations;
DROP POLICY IF EXISTS employee_observations_delete_auth ON public.employee_observations;

CREATE POLICY employee_observations_select_auth
  ON public.employee_observations FOR SELECT TO authenticated USING (true);
CREATE POLICY employee_observations_insert_auth
  ON public.employee_observations FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY employee_observations_delete_auth
  ON public.employee_observations FOR DELETE TO authenticated USING (true);

NOTIFY pgrst, 'reload schema';

COMMIT;
