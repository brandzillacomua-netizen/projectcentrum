import { describe, it, expect, beforeEach } from 'vitest'
import { scannerDebounceGuard } from '../src/services/scannerDebounceGuard.js'

describe('Scanner Debounce Guard Unit Tests', () => {
  beforeEach(() => {
    scannerDebounceGuard.reset()
  })

  it('accepts initial scan and rejects immediate duplicate within 700ms', () => {
    const code = `card_test_${Date.now()}`

    // First scan must be accepted
    const firstCheck = scannerDebounceGuard.shouldProcessScan(code, 700)
    expect(firstCheck).toBe(true)

    // Immediate second scan of the same code must be dropped
    const secondCheck = scannerDebounceGuard.shouldProcessScan(code, 700)
    expect(secondCheck).toBe(false)

    // Different code must pass immediately
    const diffCode = `diff_card_${Date.now()}`
    const diffCheck = scannerDebounceGuard.shouldProcessScan(diffCode, 700)
    expect(diffCheck).toBe(true)
  })

  it('correctly executes wrapped operations via withLock', async () => {
    const code = `lock_card_${Date.now()}`
    let executionCount = 0

    const res1 = await scannerDebounceGuard.withLock(code, async () => {
      executionCount++
      return 'done'
    })
    expect(res1).toBe('done')
    expect(executionCount).toBe(1)

    // Immediate second attempt within debounce window is blocked
    const res2 = await scannerDebounceGuard.withLock(code, async () => {
      executionCount++
      return 'done2'
    })
    expect(res2).toBeNull()
    expect(executionCount).toBe(1)
  })
})
