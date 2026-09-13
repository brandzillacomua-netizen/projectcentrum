import { spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import { validateProductionDatabaseUrl } from './configure-backup-credentials.mjs'

export function redactConnectionStrings(value) {
  return String(value || '').replace(/postgres(?:ql)?:\/\/[^@\s]+@/gi, 'postgresql://***@')
}

export function checkProductionConnectivity(env = process.env) {
  const validation = validateProductionDatabaseUrl(env.PRODUCTION_DATABASE_URL)
  if (!validation.ok) return { ok: false, detail: validation.error }

  const result = spawnSync('docker', [
    'run',
    '--rm',
    '--env', 'PRODUCTION_DATABASE_URL',
    'postgres:17.6-alpine',
    'sh', '-c',
    'pg_isready --dbname="$PRODUCTION_DATABASE_URL"'
  ], {
    encoding: 'utf8',
    env,
    shell: false
  })

  const output = redactConnectionStrings(`${result.stdout || ''}${result.stderr || ''}`).trim()
  if (result.error) return { ok: false, detail: result.error.message }
  return { ok: result.status === 0, detail: output || `docker exited with status ${result.status}` }
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const result = checkProductionConnectivity()
  console.log(`${result.ok ? 'PASS' : 'FAIL'} production database connectivity: ${result.detail}`)
  process.exit(result.ok ? 0 : 1)
}
