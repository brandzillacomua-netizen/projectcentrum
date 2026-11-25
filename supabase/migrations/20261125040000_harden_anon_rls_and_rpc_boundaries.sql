-- Harden anonymous access boundaries on rubber_cutting_batches and internal RPCs.
-- Preserves full functionality for authenticated MES users while blocking anon/PUBLIC.

DO $$
BEGIN
  IF to_regclass('public.rubber_cutting_batches') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON TABLE public.rubber_cutting_batches FROM PUBLIC, anon';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.rubber_cutting_batches TO authenticated, service_role';
    EXECUTE 'DROP POLICY IF EXISTS rubber_cutting_batches_mes_access ON public.rubber_cutting_batches';
    EXECUTE 'DROP POLICY IF EXISTS rubber_cutting_batches_authenticated_access ON public.rubber_cutting_batches';
    EXECUTE 'CREATE POLICY rubber_cutting_batches_authenticated_access ON public.rubber_cutting_batches FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL)';
  END IF;
END $$;

DO $$
DECLARE
  fn record;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = ANY(ARRAY[
        'rpc_submit_sorting_complete_atomic',
        'get_sheets_report_1c',
        'get_cutters_report_1c',
        'get_sheets_report_cards_1c',
        'adjust_inventory_manually',
        'get_inventory_adjustments_journal',
        'get_operational_stock_history',
        'get_sgp_stock_analysis',
        'dispatch_vkya_restoration_to_shop2'
      ])
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', fn.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', fn.sig);
  END LOOP;
END $$;
