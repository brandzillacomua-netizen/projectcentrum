import { describe, it, expect, beforeEach } from 'vitest'
import { checkRateLimit, consumeRateLimit, resetRateLimiter } from '../src/services/rateLimiterService.js'

describe('rateLimiterService', () => {
  beforeEach(() => {
    resetRateLimiter()
  })

  it('allows normal consumption within burst capacity', () => {
    const scope = 'operator_scan'
    const result = checkRateLimit(scope)
    expect(result.allowed).toBe(true)

    const consumed = consumeRateLimit(scope)
    expect(consumed).toBe(true)
  })

  it('bypasses rate limit for offline queue retries', () => {
    const scope = 'limited_scope'
    // Consume all tokens with small config
    for (let i = 0; i < 5; i++) {
      consumeRateLimit(scope, { config: { maxTokens: 5, refillRatePerSec: 0.1 } })
    }

    const check = checkRateLimit(scope, { config: { maxTokens: 5, refillRatePerSec: 0.1 } })
    expect(check.allowed).toBe(false)

    // Offline retries must always be allowed
    const offlineCheck = checkRateLimit(scope, { isOfflineRetry: true })
    expect(offlineCheck.allowed).toBe(true)

    const offlineConsume = consumeRateLimit(scope, { isOfflineRetry: true })
    expect(offlineConsume).toBe(true)
  })

  it('resets rate limits cleanly', () => {
    const scope = 'reset_test'
    consumeRateLimit(scope, { config: { maxTokens: 1, refillRatePerSec: 0.1 } })
    expect(checkRateLimit(scope, { config: { maxTokens: 1, refillRatePerSec: 0.1 } }).allowed).toBe(false)

    resetRateLimiter(scope)
    expect(checkRateLimit(scope, { config: { maxTokens: 1, refillRatePerSec: 0.1 } }).allowed).toBe(true)
  })
})
