import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join, normalize, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const CONTRACT_CUTOFF = '20260913000000'
const allowedRisks = new Set(['low', 'medium', 'high', 'critical'])
const allowedTransactions = new Set(['transactional', 'nontransactional'])

const headerValue = (sql, name) => {
  const match = sql.match(new RegExp(`^\\s*--\\s*${name}\\s*:\\s*(.+?)\\s*$`, 'im'))
  return match?.[1]?.trim() || ''
}

const isRepositoryPath = (repositoryRoot, candidate) => {
  const absolute = resolve(repositoryRoot, candidate)
  const pathFromRoot = relative(repositoryRoot, absolute)
  return pathFromRoot !== '' && !pathFromRoot.startsWith('..') && !normalize(pathFromRoot).startsWith(`..\\`)
}

const normalizedRepositoryPath = candidate => normalize(candidate).replaceAll('\\', '/')

export function validateProductionMigrationContract({
  fileName,
  sql,
  repositoryRoot,
  fileExists = existsSync
}) {
  const timestamp = fileName.match(/^(\d{14})_/)?.[1]
  if (!timestamp || timestamp < CONTRACT_CUTOFF) return []

  const errors = []
  const contract = headerValue(sql, 'rollout-contract')
  const risk = headerValue(sql, 'risk').toLowerCase()
  const preflight = headerValue(sql, 'preflight').replaceAll('\\', '/')
  const postcondition = headerValue(sql, 'postcondition').replaceAll('\\', '/')
  const rollback = headerValue(sql, 'rollback').replaceAll('\\', '/')
  const transaction = headerValue(sql, 'transaction').toLowerCase()

  if (contract !== 'v1') errors.push('missing "-- rollout-contract: v1"')
  if (!allowedRisks.has(risk)) errors.push('risk must be low, medium, high, or critical')
  if (!allowedTransactions.has(transaction)) {
    errors.push('transaction must be transactional or nontransactional')
  }

  for (const [label, path, requiredPrefix] of [
    ['preflight', preflight, 'supabase/diagnostics/'],
    ['postcondition', postcondition, 'supabase/diagnostics/'],
    ['rollback', rollback, 'supabase/rollbacks/']
  ]) {
    if (!path) {
      errors.push(`${label} path is required`)
      continue
    }
    const normalizedPath = normalizedRepositoryPath(path)
    if (!normalizedPath.startsWith(requiredPrefix) || !normalizedPath.endsWith('.sql')) {
      errors.push(`${label} must be a .sql file under ${requiredPrefix}`)
      continue
    }
    if (!isRepositoryPath(repositoryRoot, normalizedPath) || !fileExists(resolve(repositoryRoot, normalizedPath))) {
      errors.push(`${label} file does not exist: ${path}`)
    }
  }

  if (rollback && !rollback.split('/').at(-1)?.startsWith(timestamp)) {
    errors.push('rollback filename must start with the migration timestamp')
  }

  if (!/^\s*SET\s+lock_timeout\s*=/im.test(sql)) {
    errors.push('SET lock_timeout is required')
  }
  if (!/^\s*SET\s+statement_timeout\s*=/im.test(sql)) {
    errors.push('SET statement_timeout is required')
  }

  if (transaction === 'transactional') {
    if (!/^\s*BEGIN\s*;/im.test(sql) || !/^\s*COMMIT\s*;/im.test(sql)) {
      errors.push('transactional migration must contain BEGIN; and COMMIT;')
    }
  }
  if (transaction === 'nontransactional' && !headerValue(sql, 'nontransactional-reason')) {
    errors.push('nontransactional migration requires -- nontransactional-reason: ...')
  }

  return errors
}

export function checkProductionMigrationContracts(repositoryRoot) {
  const migrationsRoot = join(repositoryRoot, 'supabase', 'migrations')
  const violations = []
  for (const fileName of readdirSync(migrationsRoot).filter(name => name.endsWith('.sql')).sort()) {
    const sql = readFileSync(join(migrationsRoot, fileName), 'utf8')
    for (const error of validateProductionMigrationContract({ fileName, sql, repositoryRoot })) {
      violations.push(`${fileName}: ${error}`)
    }
  }
  return violations
}

const isMain = import.meta.url === pathToFileURL(process.argv[1] || '').href
if (isMain) {
  const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  const violations = checkProductionMigrationContracts(repositoryRoot)
  if (violations.length) {
    console.error('Production migration contract violations:')
    for (const violation of violations) console.error(`- ${violation}`)
    process.exit(1)
  }
  console.log(`Production migration contract passed for migrations from ${CONTRACT_CUTOFF}.`)
}
