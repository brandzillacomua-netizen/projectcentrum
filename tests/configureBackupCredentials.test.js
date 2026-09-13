import { describe, expect, it } from 'vitest'
import { validateProductionDatabaseUrl } from '../scripts/configure-backup-credentials.mjs'

describe('backup credential configuration', () => {
  it('accepts production direct and session-pooler URIs', () => {
    expect(validateProductionDatabaseUrl(
      'postgresql://postgres:secret@db.hurzutjytlcvtbvihnry.supabase.co:5432/postgres'
    ).ok).toBe(true)
    expect(validateProductionDatabaseUrl(
      'postgresql://postgres.hurzutjytlcvtbvihnry:secret@aws-0-eu-west-1.pooler.supabase.com:5432/postgres'
    ).ok).toBe(true)
  })

  it('rejects missing passwords and non-production projects without echoing credentials', () => {
    expect(validateProductionDatabaseUrl(
      'postgresql://postgres@db.hurzutjytlcvtbvihnry.supabase.co:5432/postgres'
    )).toMatchObject({ ok: false, error: 'Connection string does not contain a database password' })
    expect(validateProductionDatabaseUrl(
      'postgresql://postgres:do-not-echo@db.notproduction.supabase.co:5432/postgres'
    )).toEqual({
      ok: false,
      error: 'Connection string does not belong to the configured production project'
    })
  })
})
