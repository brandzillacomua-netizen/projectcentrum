import pg from 'pg'
import fs from 'node:fs'

const out = { at: new Date().toISOString(), mode: 'READ ONLY; aggregate data and schema only', checks: {} }
const client = new pg.Client({ connectionString: process.env.PRODUCTION_DATABASE_URL, connectionTimeoutMillis: 12000, options: '-c default_transaction_read_only=on -c statement_timeout=20000' })
try {
  await client.connect()
  await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY')
  const queries = {
    readOnly: `SELECT current_setting('transaction_read_only') AS read_only`,
    inventory: `SELECT count(*) AS rows, count(*) FILTER(WHERE total_qty < 0) AS negative_total, count(*) FILTER(WHERE reserved_qty < 0) AS negative_reserve, count(*) FILTER(WHERE reserved_qty > total_qty) AS over_reserved, count(*) FILTER(WHERE total_qty IS NULL OR reserved_qty IS NULL) AS null_quantities, count(*) FILTER(WHERE nomenclature_id IS NULL) AS missing_nomenclature FROM public.inventory`,
    stockGroups: `SELECT warehouse, type, count(*) AS rows, count(*) FILTER(WHERE reserved_qty > total_qty) AS over_reserved FROM public.inventory GROUP BY warehouse,type ORDER BY warehouse,type`,
    duplicates: `SELECT count(*) AS duplicate_groups FROM (SELECT nomenclature_id,type,warehouse,pocket_owner FROM public.inventory WHERE nomenclature_id IS NOT NULL GROUP BY nomenclature_id,type,warehouse,pocket_owner HAVING count(*)>1) s`,
    constraints: `SELECT conname, pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid='public.inventory'::regclass`,
    indexes: `SELECT indexname,indexdef FROM pg_indexes WHERE schemaname='public' AND tablename='inventory'`,
    triggers: `SELECT c.relname AS table_name,t.tgname,pg_get_triggerdef(t.oid) AS definition FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN ('inventory','material_requests','work_cards') AND NOT t.tgisinternal`,
    policies: `SELECT tablename,policyname,roles,cmd,qual,with_check FROM pg_policies WHERE schemaname='public' AND tablename IN ('inventory','inventory_logs','work_cards','material_requests')`,
    functions: `SELECT p.proname,pg_get_function_identity_arguments(p.oid) AS args,p.prosecdef,has_function_privilege('anon',p.oid,'EXECUTE') AS anon_execute,has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_execute,pg_get_functiondef(p.oid) AS definition FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('rpc_deduct_inventory_atomic','rpc_reserve_material_atomic','rpc_increment_inventory_stock','rpc_handover_task_to_shop2_atomic','rpc_handover_to_sgp_atomic','rpc_transition_work_card_atomic','rpc_qc_scrap_atomic')`,
    cards: `SELECT status, count(*) AS rows, count(*) FILTER(WHERE quantity<0) AS negative_quantity, count(*) FILTER(WHERE nomenclature_id IS NULL) AS missing_nomenclature FROM public.work_cards GROUP BY status`,
    requests: `SELECT status,count(*) AS rows,count(*) FILTER(WHERE quantity<0) AS negative_quantity,count(*) FILTER(WHERE inventory_id IS NULL) AS missing_inventory FROM public.material_requests GROUP BY status`,
    orphanRequests: `SELECT count(*) AS missing_inventory_reference FROM public.material_requests r LEFT JOIN public.inventory i ON i.id=r.inventory_id WHERE r.inventory_id IS NOT NULL AND i.id IS NULL`,
    logs: `SELECT count(*) AS rows, max(created_at) AS latest FROM public.inventory_logs`,
    migrations: `SELECT version FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 15`
  }
  for (const [name, sql] of Object.entries(queries)) {
    await client.query('SAVEPOINT audit_check')
    try { out.checks[name] = (await client.query(sql)).rows }
    catch(e) { await client.query('ROLLBACK TO SAVEPOINT audit_check'); out.checks[name] = { errorCode: e.code, message: e.message } }
    await client.query('RELEASE SAVEPOINT audit_check')
  }
  await client.query('ROLLBACK')
} catch(e) {
  out.connectionError = { code: e.code, message: String(e.message).replace(/postgres(?:ql)?:\/\/[^\s]+/gi, '[redacted]') }
} finally { await client.end().catch(()=>{}) }
fs.mkdirSync('docs/audits', { recursive: true })
fs.writeFileSync('docs/audits/factory-data-readonly-2026-10-03.json',JSON.stringify(out,null,2))
const summary = structuredClone(out)
if (Array.isArray(summary.checks.functions)) summary.checks.functions = summary.checks.functions.map(({definition,...rest})=>rest)
console.log(JSON.stringify(summary,null,2))
