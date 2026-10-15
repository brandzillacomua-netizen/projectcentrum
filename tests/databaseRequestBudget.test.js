import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const readSource = path => readFileSync(new URL(path, import.meta.url), 'utf8')

describe('database request budget', () => {
  it('does not poll the full SGP warehouse dataset every 15 seconds', () => {
    const source = readSource('../src/modules/WarehouseFGP/hooks/useWarehouseRealtime.js')

    expect(source).not.toContain('setInterval(fetchQueueFromDb, 15000)')
    expect(source).toContain('const FALLBACK_REFRESH_MS = 2 * 60 * 1000')
    expect(source).toContain('queueRequestRef.current')
    expect(source).toContain('document.visibilityState === \'visible\'')
  })

  it('keeps the Shop 2 safety refresh at a low fallback frequency', () => {
    const source = readSource('../src/modules/Shop2Module.jsx')

    expect(source).not.toContain('}, 10000)')
    expect(source).toContain('}, 2 * 60 * 1000)')
  })
})
