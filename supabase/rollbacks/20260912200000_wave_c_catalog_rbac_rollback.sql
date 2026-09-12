-- Emergency rollback for 20260912200000_wave_c_catalog_rbac.sql.
-- Restores the exact authenticated grants and permissive policies observed by preflight.

BEGIN;

REVOKE ALL PRIVILEGES ON TABLE public.system_configs FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.scrap_reasons FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.vkya_restoration_stages FROM PUBLIC, anon, authenticated;

GRANT ALL PRIVILEGES ON TABLE public.system_configs TO authenticated;
GRANT ALL PRIVILEGES ON TABLE public.scrap_reasons TO authenticated;
GRANT ALL PRIVILEGES ON TABLE public.vkya_restoration_stages TO authenticated;

ALTER TABLE public.system_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scrap_reasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vkya_restoration_stages ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  target_table TEXT;
  existing_policy RECORD;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'system_configs',
    'scrap_reasons',
    'vkya_restoration_stages'
  ] LOOP
    FOR existing_policy IN
      SELECT policyname
      FROM pg_catalog.pg_policies
      WHERE schemaname = 'public' AND tablename = target_table
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', existing_policy.policyname, target_table);
    END LOOP;
  END LOOP;
END
$$;

CREATE POLICY "Allow all actions for authenticated users"
  ON public.system_configs
  FOR ALL TO authenticated
  USING (TRUE)
  WITH CHECK (TRUE);

CREATE POLICY scrap_reasons_read ON public.scrap_reasons
  FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY scrap_reasons_insert ON public.scrap_reasons
  FOR INSERT TO authenticated WITH CHECK (TRUE);
CREATE POLICY scrap_reasons_update ON public.scrap_reasons
  FOR UPDATE TO authenticated USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY scrap_reasons_delete ON public.scrap_reasons
  FOR DELETE TO authenticated USING (TRUE);

CREATE POLICY vkya_restoration_stages_read ON public.vkya_restoration_stages
  FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY vkya_restoration_stages_insert ON public.vkya_restoration_stages
  FOR INSERT TO authenticated WITH CHECK (TRUE);
CREATE POLICY vkya_restoration_stages_update ON public.vkya_restoration_stages
  FOR UPDATE TO authenticated USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY vkya_restoration_stages_delete ON public.vkya_restoration_stages
  FOR DELETE TO authenticated USING (TRUE);

COMMIT;
