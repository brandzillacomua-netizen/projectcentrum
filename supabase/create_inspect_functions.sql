-- ═══════════════════════════════════════════════════════════════════════════
-- 🔍 INSPECTION FUNCTIONS — CRM КУЛИЦЯ MES
-- Запустити в Supabase Dashboard → SQL Editor для діагностики політик RLS
-- ═══════════════════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS get_all_policies();
CREATE OR REPLACE FUNCTION get_all_policies()
RETURNS TABLE (
  tablename TEXT,
  policyname TEXT,
  roles TEXT[],
  cmd TEXT,
  qual TEXT,
  with_check TEXT
) SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.tablename::TEXT,
    p.policyname::TEXT,
    p.roles::TEXT[],
    p.cmd::TEXT,
    p.qual::TEXT,
    p.with_check::TEXT
  FROM pg_policies p
  WHERE p.schemaname = 'public';
END;
$$ LANGUAGE plpgsql;

DROP FUNCTION IF EXISTS get_tables_rls_status();
CREATE OR REPLACE FUNCTION get_tables_rls_status()
RETURNS TABLE (
  tablename TEXT,
  rowsecurity BOOLEAN
) SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.tablename::TEXT,
    t.rowsecurity::BOOLEAN
  FROM pg_tables t
  WHERE t.schemaname = 'public';
END;
$$ LANGUAGE plpgsql;
