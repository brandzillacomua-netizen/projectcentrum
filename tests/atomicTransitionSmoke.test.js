import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const source = readFileSync(
  new URL('../scripts/smoke-atomic-transition-readonly.mjs', import.meta.url),
  'utf8'
)

describe('read-only atomic transition release smoke', () => {
  it('uses a random nonexistent card and the exact production RPC contract', () => {
    expect(source).toContain('const nonexistentCardId = crypto.randomUUID()')
    expect(source).toContain('p_session_id:')
    expect(source).not.toContain('p_client_session')
    expect(source).toContain("result?.card_not_found !== true")
    expect(source).toContain("result?.success !== false")
  })

  it('checks anonymous denial and the deployed RPC version', () => {
    expect(source).toContain('Anonymous atomic RPC must be denied')
    expect(source).toContain("2026-09-12.atomic_contract_v4")
  })
})
