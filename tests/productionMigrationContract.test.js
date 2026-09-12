import { describe, expect, it } from 'vitest'
import { validateProductionMigrationContract } from '../scripts/check-production-migration-contract.mjs'

const root = 'A:/centrum'
const validSql = `
-- rollout-contract: v1
-- risk: high
-- preflight: supabase/diagnostics/20260913010000_example_preflight.sql
-- postcondition: supabase/diagnostics/20260913010000_example_postcondition.sql
-- rollback: supabase/rollbacks/20260913010000_example_rollback.sql
-- transaction: transactional
BEGIN;
SET lock_timeout = '5s';
SET statement_timeout = '60s';
ALTER TABLE public.example ADD COLUMN safe_value TEXT;
COMMIT;
`

const existingFiles = [
  '/supabase/diagnostics/20260913010000_example_preflight.sql',
  '/supabase/diagnostics/20260913010000_example_postcondition.sql',
  '/supabase/rollbacks/20260913010000_example_rollback.sql'
]
const fileExists = path => {
  const normalized = path.replaceAll('\\', '/').toLowerCase()
  return existingFiles.some(suffix => normalized.endsWith(suffix))
}

describe('production migration rollout contract', () => {
  it('accepts a future migration with complete safety artifacts', () => {
    expect(validateProductionMigrationContract({
      fileName: '20260913010000_example.sql',
      sql: validSql,
      repositoryRoot: root,
      fileExists
    })).toEqual([])
  })

  it('does not retroactively reject the established migration history', () => {
    expect(validateProductionMigrationContract({
      fileName: '20260912225500_existing.sql',
      sql: 'ALTER TABLE public.example ADD COLUMN value TEXT;',
      repositoryRoot: root,
      fileExists
    })).toEqual([])
  })

  it('rejects a future migration without rollback, timeouts, and a transaction', () => {
    const errors = validateProductionMigrationContract({
      fileName: '20260913010000_unsafe.sql',
      sql: '-- rollout-contract: v1\n-- risk: critical\nALTER TABLE public.example DROP COLUMN value;',
      repositoryRoot: root,
      fileExists
    })
    expect(errors).toContain('preflight path is required')
    expect(errors).toContain('postcondition path is required')
    expect(errors).toContain('rollback path is required')
    expect(errors).toContain('SET lock_timeout is required')
    expect(errors).toContain('SET statement_timeout is required')
  })

  it('requires a reason when a migration cannot be transactional', () => {
    const sql = validSql
      .replace('-- transaction: transactional', '-- transaction: nontransactional')
      .replace('BEGIN;', '')
      .replace('COMMIT;', '')
    expect(validateProductionMigrationContract({
      fileName: '20260913010000_example.sql',
      sql,
      repositoryRoot: root,
      fileExists
    })).toContain('nontransactional migration requires -- nontransactional-reason: ...')
  })

  it('rejects path traversal disguised as a diagnostics artifact', () => {
    const sql = validSql.replace(
      'supabase/diagnostics/20260913010000_example_preflight.sql',
      'supabase/diagnostics/../migrations/unsafe.sql'
    )
    expect(validateProductionMigrationContract({
      fileName: '20260913010000_example.sql',
      sql,
      repositoryRoot: root,
      fileExists: () => true
    })).toContain('preflight must be a .sql file under supabase/diagnostics/')
  })
})
