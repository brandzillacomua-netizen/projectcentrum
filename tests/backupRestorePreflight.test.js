import { describe, expect, it } from 'vitest'
import {
  projectRefFromDatabaseUrl,
  validateRestoreIsolation
} from '../scripts/backup-restore-preflight.mjs'

describe('backup restore isolation preflight', () => {
  it('extracts direct and pooler Supabase project references', () => {
    expect(projectRefFromDatabaseUrl('postgresql://postgres:x@db.productionref.supabase.co:5432/postgres'))
      .toBe('productionref')
    expect(projectRefFromDatabaseUrl('postgresql://postgres.stagingref:x@aws-0-eu.pooler.supabase.com:6543/postgres'))
      .toBe('stagingref')
  })

  it('blocks production as the restore target', () => {
    const production = 'postgresql://postgres:x@db.hurzutjytlcvtbvihnry.supabase.co:5432/postgres'
    expect(validateRestoreIsolation({
      productionUrl: production,
      targetUrl: production,
      confirmation: 'ISOLATED_STAGING_ONLY'
    })).toEqual(expect.arrayContaining([
      'Restore target resolves to the production database',
      'Restore target uses the production Supabase project reference'
    ]))
  })

  it('requires an explicit isolation confirmation', () => {
    const issues = validateRestoreIsolation({
      productionUrl: 'postgresql://postgres:x@db.productionref.supabase.co:5432/postgres',
      targetUrl: 'postgresql://postgres:x@db.stagingref.supabase.co:5432/postgres',
      confirmation: ''
    })
    expect(issues).toContain('RESTORE_DRILL_CONFIRMATION must equal ISOLATED_STAGING_ONLY')
  })

  it('accepts distinct production and staging projects', () => {
    expect(validateRestoreIsolation({
      productionUrl: 'postgresql://postgres:x@db.productionref.supabase.co:5432/postgres',
      targetUrl: 'postgresql://postgres:x@db.stagingref.supabase.co:5432/postgres',
      confirmation: 'ISOLATED_STAGING_ONLY'
    })).toEqual([])
  })
})
