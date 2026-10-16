import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  new URL('../supabase/migrations/20261016130000_atomic_packaging_shipment_inventory.sql', import.meta.url),
  'utf8'
)

describe('atomic packaging shipment migration', () => {
  it('uses UUID identifiers and restricts execution to shipping staff', () => {
    expect(migration).toContain('p_order_id uuid')
    expect(migration).toContain('p_task_ids uuid[]')
    expect(migration).toContain("su.access_rights->>'shipping'")
    expect(migration).toContain("raise exception 'Shipping permission required'")
    expect(migration).toContain('from public, anon')
    expect(migration).toContain('to authenticated')
  })

  it('consumes issued requests and completes them in the same transaction', () => {
    expect(migration).toMatch(/BEGIN;[\s\S]*create or replace function public\.complete_packaging_shipment[\s\S]*COMMIT;/i)
    expect(migration).toContain("mr.status = 'issued'")
    expect(migration).toContain('set total_qty = total_qty - v_inventory.qty')
    expect(migration).toContain("set status = 'completed'")
    expect(migration).toContain("'is_shipped', true")
  })

  it('is replay-safe because only still-issued requests are deducted', () => {
    expect(migration.match(/mr\.status = 'issued'/g)?.length).toBeGreaterThanOrEqual(3)
    expect(migration).toContain("where mr.task_id = any(p_task_ids)")
  })
})
