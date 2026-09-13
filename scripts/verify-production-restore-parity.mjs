import { spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import { validateProductionDatabaseUrl } from './configure-backup-credentials.mjs'
import { redactConnectionStrings } from './check-production-db-connectivity.mjs'
import {
  RESTORE_CONTAINER,
  RESTORE_DATABASE,
  validateRestoreContainerInspection
} from './restore-production-backup-local.mjs'

const METRICS_SQL = `SELECT json_build_object(
  'tables', (SELECT count(*) FROM pg_tables WHERE schemaname = 'public'),
  'functions', (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'),
  'policies', (SELECT count(*) FROM pg_policies WHERE schemaname='public'),
  'rls_tables', (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND c.relrowsecurity),
  'private_tables', (SELECT count(*) FROM pg_tables WHERE schemaname='mes_private'),
  'orders', (SELECT count(*) FROM public.orders),
  'tasks', (SELECT count(*) FROM public.tasks),
  'work_cards', (SELECT count(*) FROM public.work_cards),
  'material_requests', (SELECT count(*) FROM public.material_requests),
  'system_users', (SELECT count(*) FROM public.system_users)
);`

const STRUCTURE_KEYS = ['tables', 'functions', 'policies', 'rls_tables', 'private_tables']
const DATA_KEYS = ['orders', 'tasks', 'work_cards', 'material_requests', 'system_users']

export function compareRestoreMetrics(production, restored) {
  const structuralDifferences = STRUCTURE_KEYS
    .filter(key => production[key] !== restored[key])
    .map(key => ({ key, production: production[key], restored: restored[key] }))
  const liveDataDrift = DATA_KEYS
    .filter(key => production[key] !== restored[key])
    .map(key => ({ key, production: production[key], restored: restored[key], delta: production[key] - restored[key] }))
  return {
    status: structuralDifferences.length ? 'FAIL_STRUCTURE_MISMATCH' : liveDataDrift.length ? 'PASS_WITH_LIVE_DATA_DRIFT' : 'PASS_EXACT',
    structuralDifferences,
    liveDataDrift
  }
}

function runDocker(args, env = process.env) {
  const result = spawnSync('docker', args, { encoding: 'utf8', env, shell: false, maxBuffer: 4 * 1024 * 1024 })
  const output = redactConnectionStrings(`${result.stdout || ''}${result.stderr || ''}`).trim()
  if (result.error || result.status !== 0) throw new Error(output || result.error?.message || `docker exited ${result.status}`)
  return output
}

function parseJsonOutput(output) {
  const line = output.split(/\r?\n/).find(value => value.trim().startsWith('{'))
  if (!line) throw new Error(`Metrics query returned no JSON: ${output}`)
  return JSON.parse(line)
}

function collectProductionMetrics(env) {
  const childEnv = {
    ...env,
    PGOPTIONS: '-c default_transaction_read_only=on',
    MES_METRICS_SQL: METRICS_SQL
  }
  return parseJsonOutput(runDocker([
    'run', '--rm',
    '--env', 'PRODUCTION_DATABASE_URL',
    '--env', 'PGOPTIONS',
    '--env', 'MES_METRICS_SQL',
    'postgres:17.6-alpine',
    'sh', '-c', 'psql --dbname="$PRODUCTION_DATABASE_URL" -X -v ON_ERROR_STOP=1 -Atc "$MES_METRICS_SQL"'
  ], childEnv))
}

function collectRestoredMetrics() {
  const inspection = JSON.parse(runDocker(['inspect', RESTORE_CONTAINER]))
  const issues = validateRestoreContainerInspection(inspection)
  if (issues.length) throw new Error(`Unsafe restore target: ${issues.join('; ')}`)
  return parseJsonOutput(runDocker([
    'exec', RESTORE_CONTAINER,
    'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', RESTORE_DATABASE, '-Atc', METRICS_SQL
  ]))
}

function main() {
  const validation = validateProductionDatabaseUrl(process.env.PRODUCTION_DATABASE_URL)
  if (!validation.ok) throw new Error(validation.error)
  const production = collectProductionMetrics(process.env)
  const restored = collectRestoredMetrics()
  const comparison = compareRestoreMetrics(production, restored)
  console.log(JSON.stringify({ restore_parity: { comparison, production, restored } }, null, 2))
  if (comparison.status === 'FAIL_STRUCTURE_MISMATCH') process.exit(1)
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  try { main() } catch (error) {
    console.error(`Restore parity check failed safely: ${redactConnectionStrings(error?.message || error)}`)
    process.exit(1)
  }
}
