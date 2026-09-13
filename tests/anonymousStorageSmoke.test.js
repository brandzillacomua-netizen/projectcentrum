import { describe, expect, it } from 'vitest'
import { classifyAnonymousStorageList } from '../scripts/smoke-anon-storage.mjs'

describe('anonymous Storage smoke classification', () => {
  it('passes explicit authorization failures', () => {
    expect(classifyAnonymousStorageList(401, { message: 'Unauthorized' }).ok).toBe(true)
    expect(classifyAnonymousStorageList(403, { message: 'Forbidden' }).ok).toBe(true)
  })

  it('passes a successful list filtered to zero rows by RLS', () => {
    expect(classifyAnonymousStorageList(200, []).ok).toBe(true)
  })

  it('fails when anon can see any object', () => {
    const result = classifyAnonymousStorageList(200, [{ name: 'redacted' }])
    expect(result.ok).toBe(false)
    expect(result.detail).toContain('1 object')
  })
})

