import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  sha256File,
  validateRestoreContainerInspection,
  verifyBackupManifest
} from '../scripts/restore-production-backup-local.mjs'

describe('isolated production restore guard', () => {
  it('accepts only the labeled running PostgreSQL 17 target', () => {
    expect(validateRestoreContainerInspection([{
      Config: { Image: 'postgres:17.6-alpine', Labels: { 'centrum.purpose': 'isolated-restore-drill' } },
      State: { Running: true, Health: { Status: 'healthy' } }
    }])).toEqual([])
  })

  it('rejects an unlabeled or incompatible target', () => {
    const issues = validateRestoreContainerInspection([{
      Config: { Image: 'postgres:16-alpine', Labels: {} },
      State: { Running: true, Health: { Status: 'healthy' } }
    }])
    expect(issues).toContain('container purpose label mismatch')
    expect(issues).toContain('container PostgreSQL major must be 17')
  })

  it('detects a backup checksum mismatch before restore', async () => {
    const directory = mkdtempSync(resolve(tmpdir(), 'centrum-restore-test-'))
    for (const name of ['roles.sql', 'schema.sql', 'data.sql']) writeFileSync(resolve(directory, name), name)
    const files = []
    for (const name of ['roles.sql', 'schema.sql', 'data.sql']) {
      files.push({ name, bytes: name.length, sha256: await sha256File(resolve(directory, name)) })
    }
    files[1].sha256 = '0'.repeat(64)
    writeFileSync(resolve(directory, 'manifest.json'), JSON.stringify({
      sourceProjectRef: 'hurzutjytlcvtbvihnry', files
    }))
    await expect(verifyBackupManifest(directory)).rejects.toThrow('schema.sql SHA-256')
  })

  it('bootstraps the Supabase owner role only inside the guarded local target', () => {
    const source = readFileSync(resolve('scripts/restore-production-backup-local.mjs'), 'utf8')
    expect(source).toContain("rolname = 'supabase_admin'")
    expect(source).toContain("purpose !== RESTORE_PURPOSE")
  })
})
