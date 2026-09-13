import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(resolve('supabase/migrations/20260913190000_chat_participant_rls_isolation.sql'), 'utf8')
const rollback = readFileSync(resolve('supabase/rollbacks/20260913190000_chat_participant_rls_isolation_rollback.sql'), 'utf8')

describe('chat participant isolation migration', () => {
  it('uses four guarded security-definer helpers', () => {
    expect(migration.match(/CREATE OR REPLACE FUNCTION public\.chat_can_access_/g)).toHaveLength(4)
    expect(migration.match(/STABLE SECURITY DEFINER/g)).toHaveLength(4)
    expect(migration.match(/SET search_path = pg_catalog, public/g)).toHaveLength(4)
    expect(migration.match(/REVOKE ALL ON FUNCTION public\.chat_can_access_/g)).toHaveLength(4)
  })

  it('replaces seven open policies with twenty-eight operation-scoped policies', () => {
    const policyStatements = migration.match(/CREATE POLICY chat_(?!attachments)[a-z_]+/g) || []
    expect(policyStatements).toHaveLength(28)
    expect(migration).not.toMatch(/FOR ALL TO authenticated/)
    expect(migration).not.toMatch(/CREATE POLICY chat_(?!attachments)[\s\S]{0,120}USING \(true\)/)
    expect(migration).toContain('public.chat_can_access_thread(thread_id)')
    expect(migration).toContain('sender_id = public.mes_current_system_user_id()')
  })

  it('scopes all four Storage policies to chat membership', () => {
    expect(migration.match(/CREATE POLICY chat_attachments_/g)).toHaveLength(4)
    expect(migration.match(/public\.chat_can_access_storage_object\(name\)/g)).toHaveLength(5)
  })

  it('has an authenticated-only controlled rollback', () => {
    expect(rollback.match(/CREATE POLICY chat_(?!attachments)[a-z_]+/g)).toHaveLength(7)
    expect(rollback.match(/CREATE POLICY chat_attachments_/g)).toHaveLength(4)
    expect(rollback).not.toMatch(/TO\s+(?:PUBLIC|anon)/i)
  })
})
