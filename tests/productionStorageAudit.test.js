import { describe, expect, it } from 'vitest'
import { classifyStorageAudit } from '../scripts/audit-production-storage.mjs'

describe('production storage audit classification', () => {
  it('flags PUBLIC bucket-only write policies', () => {
    const result = classifyStorageAudit({
      policies: [{ name: 'chat_attachments_insert', roles: ['public'], command: 'INSERT', check: "bucket_id = 'chat-attachments'" }],
      anon_privileges: { insert: true }
    })
    expect(result.status).toBe('EXPOSED')
    expect(result.anonWriteGrant).toBe(true)
  })

  it('passes authenticated identity-bound policies without anon writes', () => {
    const result = classifyStorageAudit({
      policies: [{ name: 'chat_attachments_insert', roles: ['authenticated'], command: 'INSERT', check: "bucket_id = 'chat-attachments' AND auth.uid() IS NOT NULL" }],
      anon_privileges: { insert: false, update: false, delete: false }
    })
    expect(result.status).toBe('PASS')
  })

  it('does not confuse a standard table grant with effective RLS access', () => {
    const result = classifyStorageAudit({
      policies: [{ name: 'chat_attachments_insert', roles: ['authenticated'], command: 'INSERT', check: "bucket_id = 'chat-attachments' AND auth.uid() IS NOT NULL" }],
      anon_privileges: { insert: true, update: true, delete: true }
    })
    expect(result.status).toBe('PASS')
    expect(result.anonWriteGrant).toBe(true)
  })
})
