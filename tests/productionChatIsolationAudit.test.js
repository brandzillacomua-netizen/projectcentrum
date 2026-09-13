import { describe, expect, it } from 'vitest'
import { classifyChatIsolationAudit } from '../scripts/audit-production-chat-isolation.mjs'

describe('production chat isolation audit', () => {
  it('flags authenticated but unscoped chat policies', () => {
    const result = classifyChatIsolationAudit({
      integrity: { participants_without_auth_binding: 0 },
      policies: [{ table: 'chat_messages', name: 'chat_messages_all', using: 'true', check: 'true' }]
    })
    expect(result.status).toBe('EXPOSED')
    expect(result.unscopedPolicies).toContain('chat_messages.chat_messages_all')
  })

  it('reports data blockers separately from exposure', () => {
    const result = classifyChatIsolationAudit({
      integrity: { participants_without_auth_binding: 2 },
      policies: [{ table: 'chat_messages', name: 'chat_messages_member_read', using: 'auth.uid() IS NOT NULL' }]
    })
    expect(result.status).toBe('PASS')
    expect(result.isolationMigrationReady).toBe(false)
    expect(result.blockers).toContainEqual({ name: 'participants_without_auth_binding', count: 2 })
  })

  it('keeps a missing historical attachment as a warning, not an isolation blocker', () => {
    const result = classifyChatIsolationAudit({
      integrity: { attachment_messages_without_object: 1 },
      policies: []
    })
    expect(result.isolationMigrationReady).toBe(true)
    expect(result.warnings).toContainEqual({ name: 'attachment_messages_without_object', count: 1 })
  })
})
