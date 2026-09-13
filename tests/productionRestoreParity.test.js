import { describe, expect, it } from 'vitest'
import { compareRestoreMetrics } from '../scripts/verify-production-restore-parity.mjs'

const exact = {
  tables: 82,
  functions: 137,
  policies: 83,
  rls_tables: 76,
  private_tables: 1,
  orders: 74,
  tasks: 237,
  work_cards: 1863,
  material_requests: 2469,
  system_users: 139
}

describe('production restore parity', () => {
  it('passes an exact snapshot', () => {
    expect(compareRestoreMetrics(exact, exact).status).toBe('PASS_EXACT')
  })

  it('allows clearly reported live row drift after the backup snapshot', () => {
    const production = { ...exact, work_cards: exact.work_cards + 1 }
    const result = compareRestoreMetrics(production, exact)
    expect(result.status).toBe('PASS_WITH_LIVE_DATA_DRIFT')
    expect(result.liveDataDrift).toContainEqual({ key: 'work_cards', production: 1864, restored: 1863, delta: 1 })
  })

  it('fails structural drift', () => {
    const restored = { ...exact, policies: exact.policies - 1 }
    expect(compareRestoreMetrics(exact, restored).status).toBe('FAIL_STRUCTURE_MISMATCH')
  })
})

