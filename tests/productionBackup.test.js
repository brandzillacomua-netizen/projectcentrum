import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  assertBackupOutsideRepository,
  createBackupPlan
} from '../scripts/create-production-backup.mjs'

describe('production backup guard', () => {
  it('creates a timestamped three-part backup plan', () => {
    const plan = createBackupPlan('C:/safe-backups', new Date('2026-09-13T12:00:00.000Z'))
    expect(plan.roles).toContain('roles.sql')
    expect(plan.schema).toContain('schema.sql')
    expect(plan.data).toContain('data.sql')
    expect(plan.directory).toContain('centrum-production-2026-09-13T12-00-00-000Z')
  })

  it('keeps the private MES schema in the production dump contract', () => {
    const source = readFileSync(resolve('scripts/create-production-backup.mjs'), 'utf8')
    expect(source).toContain('--schema=public --schema=mes_private --schema-only')
    expect(source).toContain('--schema=public --schema=mes_private --data-only')
  })

  it('rejects backup output inside the repository', () => {
    const repository = resolve('A:/centrum')
    expect(() => assertBackupOutsideRepository(resolve(repository, 'backups'), repository)).toThrow()
  })

  it('accepts backup output outside the repository', () => {
    expect(() => assertBackupOutsideRepository('C:/safe-backups', 'A:/centrum')).not.toThrow()
  })
})
