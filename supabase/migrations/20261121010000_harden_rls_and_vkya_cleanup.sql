-- =============================================================================
-- Migration: Harden RLS boundaries safely (guarded by to_regclass checks)
-- =============================================================================

-- 1. rubber_cutting_batches: remove PUBLIC/anon write access, restrict to authenticated
DO $$
BEGIN
  IF to_regclass('public.rubber_cutting_batches') IS NOT NULL THEN
    REVOKE ALL ON TABLE public.rubber_cutting_batches FROM PUBLIC, anon;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.rubber_cutting_batches TO authenticated, service_role;

    DROP POLICY IF EXISTS rubber_cutting_batches_mes_access ON public.rubber_cutting_batches;
    DROP POLICY IF EXISTS rubber_cutting_batches_select_auth ON public.rubber_cutting_batches;
    DROP POLICY IF EXISTS rubber_cutting_batches_insert_auth ON public.rubber_cutting_batches;
    DROP POLICY IF EXISTS rubber_cutting_batches_update_auth ON public.rubber_cutting_batches;
    DROP POLICY IF EXISTS rubber_cutting_batches_delete_auth ON public.rubber_cutting_batches;

    CREATE POLICY rubber_cutting_batches_select_auth
      ON public.rubber_cutting_batches FOR SELECT TO authenticated USING (true);
    CREATE POLICY rubber_cutting_batches_insert_auth
      ON public.rubber_cutting_batches FOR INSERT TO authenticated WITH CHECK (true);
    CREATE POLICY rubber_cutting_batches_update_auth
      ON public.rubber_cutting_batches FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
    CREATE POLICY rubber_cutting_batches_delete_auth
      ON public.rubber_cutting_batches FOR DELETE TO authenticated USING (true);
  END IF;
END $$;

-- 2. work_card_comments: remove broad ALL & anon write access
DO $$
BEGIN
  IF to_regclass('public.work_card_comments') IS NOT NULL THEN
    REVOKE ALL ON TABLE public.work_card_comments FROM PUBLIC, anon, authenticated;
    GRANT SELECT, INSERT ON TABLE public.work_card_comments TO authenticated, service_role;

    DROP POLICY IF EXISTS work_card_comments_select_all ON public.work_card_comments;
    DROP POLICY IF EXISTS work_card_comments_insert_all ON public.work_card_comments;
    DROP POLICY IF EXISTS work_card_comments_select_auth ON public.work_card_comments;
    DROP POLICY IF EXISTS work_card_comments_insert_auth ON public.work_card_comments;

    CREATE POLICY work_card_comments_select_auth
      ON public.work_card_comments FOR SELECT TO authenticated USING (true);
    CREATE POLICY work_card_comments_insert_auth
      ON public.work_card_comments FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
END $$;

-- 3. cutting_operation_timings: remove broad ALL & anon write access
DO $$
BEGIN
  IF to_regclass('public.cutting_operation_timings') IS NOT NULL THEN
    REVOKE ALL ON TABLE public.cutting_operation_timings FROM PUBLIC, anon, authenticated;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.cutting_operation_timings TO authenticated, service_role;

    DROP POLICY IF EXISTS cutting_op_timings_select_all ON public.cutting_operation_timings;
    DROP POLICY IF EXISTS cutting_op_timings_insert_all ON public.cutting_operation_timings;
    DROP POLICY IF EXISTS cutting_op_timings_update_all ON public.cutting_operation_timings;
    DROP POLICY IF EXISTS cutting_op_timings_delete_all ON public.cutting_operation_timings;
    DROP POLICY IF EXISTS cutting_op_timings_select_auth ON public.cutting_operation_timings;
    DROP POLICY IF EXISTS cutting_op_timings_insert_auth ON public.cutting_operation_timings;
    DROP POLICY IF EXISTS cutting_op_timings_update_auth ON public.cutting_operation_timings;
    DROP POLICY IF EXISTS cutting_op_timings_delete_auth ON public.cutting_operation_timings;

    CREATE POLICY cutting_op_timings_select_auth
      ON public.cutting_operation_timings FOR SELECT TO authenticated USING (true);
    CREATE POLICY cutting_op_timings_insert_auth
      ON public.cutting_operation_timings FOR INSERT TO authenticated WITH CHECK (true);
    CREATE POLICY cutting_op_timings_update_auth
      ON public.cutting_operation_timings FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
    CREATE POLICY cutting_op_timings_delete_auth
      ON public.cutting_operation_timings FOR DELETE TO authenticated USING (true);
  END IF;
END $$;

-- 4. Revoke anonymous EXECUTE on rpc_submit_sorting_complete_atomic
DO $$
DECLARE
  v_sig TEXT;
BEGIN
  FOR v_sig IN
    SELECT p.oid::regprocedure::TEXT
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'rpc_submit_sorting_complete_atomic'
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', v_sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', v_sig);
  END LOOP;
END $$;

-- 5. Fix search_path on SECURITY DEFINER admin RPCs
DO $$
DECLARE
  v_sig TEXT;
BEGIN
  FOR v_sig IN
    SELECT p.oid::regprocedure::TEXT
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('rpc_admin_upsert_user', 'rpc_admin_delete_user')
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = pg_catalog, public, auth', v_sig);
  END LOOP;
END $$;
