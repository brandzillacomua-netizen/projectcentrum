-- Wave C1: least-privilege RBAC for low-volume catalogs and system configuration.
-- Scope is intentionally limited to three existing tables.

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.system_configs') IS NULL
    OR to_regclass('public.scrap_reasons') IS NULL
    OR to_regclass('public.vkya_restoration_stages') IS NULL THEN
    RAISE EXCEPTION 'Wave C1 precondition failed: one or more target tables do not exist';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.system_users AS users
    WHERE users.auth_user_id IS NOT NULL
      AND (
        LOWER(COALESCE(users.access_rights->>'settings', 'false')) IN ('true', '1')
        OR (
          (
            LOWER(COALESCE(users.position, '')) LIKE '%адмін%'
            OR LOWER(COALESCE(users.login, '')) = 'admin@workshop.local'
          )
          AND LOWER(COALESCE(users.access_rights->>'settings', 'true')) NOT IN ('false', '0')
        )
      )
  ) THEN
    RAISE EXCEPTION 'Wave C1 precondition failed: no settings writer exists';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.system_users AS users
    WHERE users.auth_user_id IS NOT NULL
      AND LOWER(COALESCE(users.access_rights->>'brak', 'false')) IN ('true', '1')
  ) THEN
    RAISE EXCEPTION 'Wave C1 precondition failed: no brak writer exists';
  END IF;
END
$$;

REVOKE ALL PRIVILEGES ON TABLE public.system_configs FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.scrap_reasons FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.vkya_restoration_stages FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE ON TABLE public.system_configs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.scrap_reasons TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.vkya_restoration_stages TO authenticated;

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

CREATE POLICY system_configs_authenticated_read
  ON public.system_configs
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY system_configs_settings_insert
  ON public.system_configs
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.system_users AS users
      WHERE users.auth_user_id = auth.uid()
        AND (
          LOWER(COALESCE(users.access_rights->>'settings', 'false')) IN ('true', '1')
          OR (
            (
              LOWER(COALESCE(users.position, '')) LIKE '%адмін%'
              OR LOWER(COALESCE(users.login, '')) = 'admin@workshop.local'
            )
            AND LOWER(COALESCE(users.access_rights->>'settings', 'true')) NOT IN ('false', '0')
          )
        )
    )
  );

CREATE POLICY system_configs_settings_update
  ON public.system_configs
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.system_users AS users
      WHERE users.auth_user_id = auth.uid()
        AND (
          LOWER(COALESCE(users.access_rights->>'settings', 'false')) IN ('true', '1')
          OR (
            (
              LOWER(COALESCE(users.position, '')) LIKE '%адмін%'
              OR LOWER(COALESCE(users.login, '')) = 'admin@workshop.local'
            )
            AND LOWER(COALESCE(users.access_rights->>'settings', 'true')) NOT IN ('false', '0')
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.system_users AS users
      WHERE users.auth_user_id = auth.uid()
        AND (
          LOWER(COALESCE(users.access_rights->>'settings', 'false')) IN ('true', '1')
          OR (
            (
              LOWER(COALESCE(users.position, '')) LIKE '%адмін%'
              OR LOWER(COALESCE(users.login, '')) = 'admin@workshop.local'
            )
            AND LOWER(COALESCE(users.access_rights->>'settings', 'true')) NOT IN ('false', '0')
          )
        )
    )
  );

CREATE POLICY scrap_reasons_authenticated_read
  ON public.scrap_reasons
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY scrap_reasons_brak_insert
  ON public.scrap_reasons
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.system_users AS users
      WHERE users.auth_user_id = auth.uid()
        AND LOWER(COALESCE(users.access_rights->>'brak', 'false')) IN ('true', '1')
    )
  );

CREATE POLICY scrap_reasons_brak_update
  ON public.scrap_reasons
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.system_users AS users
      WHERE users.auth_user_id = auth.uid()
        AND LOWER(COALESCE(users.access_rights->>'brak', 'false')) IN ('true', '1')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.system_users AS users
      WHERE users.auth_user_id = auth.uid()
        AND LOWER(COALESCE(users.access_rights->>'brak', 'false')) IN ('true', '1')
    )
  );

CREATE POLICY scrap_reasons_brak_delete
  ON public.scrap_reasons
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.system_users AS users
      WHERE users.auth_user_id = auth.uid()
        AND LOWER(COALESCE(users.access_rights->>'brak', 'false')) IN ('true', '1')
    )
  );

CREATE POLICY vkya_restoration_stages_authenticated_read
  ON public.vkya_restoration_stages
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY vkya_restoration_stages_brak_insert
  ON public.vkya_restoration_stages
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.system_users AS users
      WHERE users.auth_user_id = auth.uid()
        AND LOWER(COALESCE(users.access_rights->>'brak', 'false')) IN ('true', '1')
    )
  );

CREATE POLICY vkya_restoration_stages_brak_update
  ON public.vkya_restoration_stages
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.system_users AS users
      WHERE users.auth_user_id = auth.uid()
        AND LOWER(COALESCE(users.access_rights->>'brak', 'false')) IN ('true', '1')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.system_users AS users
      WHERE users.auth_user_id = auth.uid()
        AND LOWER(COALESCE(users.access_rights->>'brak', 'false')) IN ('true', '1')
    )
  );

CREATE POLICY vkya_restoration_stages_brak_delete
  ON public.vkya_restoration_stages
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.system_users AS users
      WHERE users.auth_user_id = auth.uid()
        AND LOWER(COALESCE(users.access_rights->>'brak', 'false')) IN ('true', '1')
    )
  );

DO $$
DECLARE
  unexpected_grants JSONB;
BEGIN
  SELECT COALESCE(jsonb_agg(to_jsonb(grants)), '[]'::JSONB)
  INTO unexpected_grants
  FROM information_schema.role_table_grants AS grants
  WHERE grants.table_schema = 'public'
    AND grants.table_name IN ('system_configs', 'scrap_reasons', 'vkya_restoration_stages')
    AND grants.grantee IN ('PUBLIC', 'anon', 'authenticated')
    AND (
      grants.grantee IN ('PUBLIC', 'anon')
      OR grants.privilege_type IN ('TRUNCATE', 'TRIGGER', 'REFERENCES')
      OR (grants.table_name = 'system_configs' AND grants.privilege_type = 'DELETE')
    );

  IF jsonb_array_length(unexpected_grants) > 0 THEN
    RAISE EXCEPTION 'Wave C1 postcondition failed: unexpected grants remain: %', unexpected_grants;
  END IF;

  IF (SELECT COUNT(*) FROM pg_catalog.pg_policies
      WHERE schemaname = 'public'
        AND tablename IN ('system_configs', 'scrap_reasons', 'vkya_restoration_stages')) <> 11 THEN
    RAISE EXCEPTION 'Wave C1 postcondition failed: expected exactly 11 policies';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('system_configs', 'scrap_reasons', 'vkya_restoration_stages')
      AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')
      AND (COALESCE(qual, '') = 'true' OR COALESCE(with_check, '') = 'true')
  ) THEN
    RAISE EXCEPTION 'Wave C1 postcondition failed: unrestricted write policy remains';
  END IF;
END
$$;

COMMIT;
