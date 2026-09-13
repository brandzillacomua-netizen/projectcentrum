import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationPath = resolve('supabase/migrations/20260913174000_lock_chat_storage_to_authenticated.sql')
const rollbackPath = resolve('supabase/rollbacks/20260913174000_lock_chat_storage_to_authenticated_rollback.sql')

describe('chat Storage authentication boundary migration', () => {
  const migration = readFileSync(migrationPath, 'utf8')
  const rollback = readFileSync(rollbackPath, 'utf8')

  it('recreates all four policies for authenticated only', () => {
    expect(migration.match(/CREATE POLICY chat_attachments_/g)).toHaveLength(4)
    expect(migration.match(/TO authenticated/g)).toHaveLength(4)
    expect(migration.match(/auth\.uid\(\) IS NOT NULL/g)).toHaveLength(5)
    expect(migration).not.toMatch(/TO\s+(?:PUBLIC|anon)/i)
  })

  it('is transactional with guarded preconditions and postconditions', () => {
    expect(migration).toMatch(/BEGIN;/)
    expect(migration).toMatch(/COMMIT;/)
    expect(migration).toContain('Storage hardening aborted')
    expect(migration).toContain('Storage hardening postcondition failed')
  })

  it('rolls back to denied access instead of anonymous exposure', () => {
    expect(rollback.match(/DROP POLICY IF EXISTS chat_attachments_/g)).toHaveLength(4)
    expect(rollback).not.toMatch(/CREATE POLICY/)
  })
})
