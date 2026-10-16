import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  new URL('../supabase/migrations/20261016140000_atomic_warehouse_box_issue.sql', import.meta.url),
  'utf8'
)
const handler = readFileSync(
  new URL('../src/modules/Warehouse/hooks/useWarehouseHandlers.js', import.meta.url),
  'utf8'
)
const computed = readFileSync(
  new URL('../src/modules/Warehouse/hooks/useWarehouseComputed.js', import.meta.url),
  'utf8'
)
const modal = readFileSync(
  new URL('../src/modules/Warehouse/components/MaterialDetailModal.jsx', import.meta.url),
  'utf8'
)

describe('atomic warehouse box issue flow', () => {
  it('persists the physical issue state and material requests in one RPC transaction', () => {
    expect(migration).toMatch(/BEGIN;[\s\S]*create or replace function public\.issue_warehouse_box[\s\S]*COMMIT;/i)
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS is_box_issued boolean NOT NULL DEFAULT false')
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS box_issued_at timestamptz')
    expect(migration).toContain("SET is_box_issued = true")
    expect(migration).toContain("SET status = 'issued'")
    expect(migration).toContain("'[BOX_ISSUED:true]'")
  })

  it('is permission checked, replay safe, and unavailable to anonymous callers', () => {
    expect(migration).toContain("su.access_rights->>'warehouse_boxes'")
    expect(migration).toContain('coalesce(v_card.is_box_issued, false)')
    expect(migration).toContain("'already_issued', true")
    expect(migration).toContain('FROM PUBLIC, anon')
    expect(migration).toContain('TO authenticated, service_role')
  })

  it('shows success only after the RPC confirms the issue', () => {
    expect(handler.match(/rpc\('issue_warehouse_box'/g)?.length).toBe(2)
    expect(handler).toContain('if (issueError) throw issueError')
    expect(handler).toContain("if (!issueResult?.ok) throw new Error")
    expect(handler.indexOf('if (issueError) throw issueError')).toBeLessThan(
      handler.indexOf("alert(issueResult.already_issued")
    )
  })

  it('derives the UI state only from the physical box issue flag', () => {
    expect(computed).toContain('card.is_box_issued')
    expect(computed).not.toContain('isPersistentIssued')
    expect(modal).toContain('const isBoxIssued = Boolean(')
    expect(modal).not.toContain('const isFullyIssued')
    expect(modal).toContain('{!isBoxIssued && (')
  })
})
