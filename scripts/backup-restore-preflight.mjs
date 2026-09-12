import { spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

export const PRODUCTION_PROJECT_REF = 'hurzutjytlcvtbvihnry'

export function projectRefFromDatabaseUrl(value) {
  const url = new URL(value)
  const parts = url.hostname.toLowerCase().split('.')
  if (parts[0] === 'db' && parts[1]) return parts[1]
  const poolerUser = decodeURIComponent(url.username || '')
  const match = poolerUser.match(/postgres\.([a-z0-9]+)/i)
  return match?.[1]?.toLowerCase() || null
}

export function validateRestoreIsolation({ productionUrl, targetUrl, confirmation }) {
  const issues = []
  let production
  let target

  try { production = new URL(productionUrl) } catch { issues.push('PRODUCTION_DATABASE_URL is not a valid URL') }
  try { target = new URL(targetUrl) } catch { issues.push('RESTORE_TARGET_DATABASE_URL is not a valid URL') }

  if (production && !['postgres:', 'postgresql:'].includes(production.protocol)) {
    issues.push('PRODUCTION_DATABASE_URL must use postgres:// or postgresql://')
  }
  if (target && !['postgres:', 'postgresql:'].includes(target.protocol)) {
    issues.push('RESTORE_TARGET_DATABASE_URL must use postgres:// or postgresql://')
  }

  if (production && target) {
    const productionIdentity = `${production.hostname}:${production.port}/${production.pathname}`.toLowerCase()
    const targetIdentity = `${target.hostname}:${target.port}/${target.pathname}`.toLowerCase()
    if (productionIdentity === targetIdentity) issues.push('Restore target resolves to the production database')

    const productionRef = projectRefFromDatabaseUrl(productionUrl)
    const targetRef = projectRefFromDatabaseUrl(targetUrl)
    if (targetRef === PRODUCTION_PROJECT_REF || (productionRef && targetRef === productionRef)) {
      issues.push('Restore target uses the production Supabase project reference')
    }
  }

  if (confirmation !== 'ISOLATED_STAGING_ONLY') {
    issues.push('RESTORE_DRILL_CONFIRMATION must equal ISOLATED_STAGING_ONLY')
  }
  return issues
}

export function commandAvailable(command, args = ['--version']) {
  const result = spawnSync(command, args, { encoding: 'utf8', shell: process.platform === 'win32' })
  return !result.error && result.status === 0
}

export function runPreflight(env = process.env) {
  const issues = validateRestoreIsolation({
    productionUrl: env.PRODUCTION_DATABASE_URL || '',
    targetUrl: env.RESTORE_TARGET_DATABASE_URL || '',
    confirmation: env.RESTORE_DRILL_CONFIRMATION || ''
  })

  const tools = {
    supabase: commandAvailable('supabase'),
    psql: commandAvailable('psql')
  }
  if (!tools.supabase) issues.push('Supabase CLI is not available on PATH')
  if (!tools.psql) issues.push('psql is not available on PATH')

  return { status: issues.length === 0 ? 'PASS' : 'BLOCKED', tools, issues }
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const result = runPreflight()
  console.log(JSON.stringify({ backup_restore_preflight: result }, null, 2))
  process.exit(result.status === 'PASS' ? 0 : 1)
}
