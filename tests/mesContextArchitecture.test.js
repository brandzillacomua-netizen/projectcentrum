import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const contextSource = readFileSync(
  new URL('../src/MESContext.jsx', import.meta.url),
  'utf8'
)

describe('MES context architecture boundary', () => {
  it('keeps MESContext as a small composition facade', () => {
    const lines = contextSource.split(/\r?\n/).length
    expect(lines).toBeLessThanOrEqual(200)
  })

  it('forbids direct database and RPC operations in the facade', () => {
    expect(contextSource).not.toMatch(/\bsupabase\s*\.\s*from\s*\(/)
    expect(contextSource).not.toMatch(/\bsupabase\s*\.\s*rpc\s*\(/)
    expect(contextSource).not.toMatch(/\.(insert|update|delete|upsert)\s*\(/)
  })

  it('composes tested domain boundaries instead of embedding their logic', () => {
    for (const boundary of [
      'useData',
      'createAuthActions',
      'createProductionActions',
      'createWarehouseActions',
      'useAppTheme',
      'useUserPresence',
      'createContextSupportActions',
      'userDirectorySelectors'
    ]) {
      expect(contextSource).toContain(boundary)
    }
  })
})
