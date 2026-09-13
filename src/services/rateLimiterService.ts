/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛡️ MES CENTRUM ENTERPRISE: RATE LIMITER SERVICE (TOKEN BUCKET ENGINE)
 * ═══════════════════════════════════════════════════════════════════════════
 * High-performance burst protection for high-value RPC operations and barcode scans.
 * Prevents rapid script floods while guaranteeing zero interruption for operator scans.
 */

export interface RateLimiterConfig {
  maxTokens: number
  refillRatePerSec: number
  windowMs?: number
}

export interface RateLimitOptions {
  cost?: number
  isOfflineRetry?: boolean
  config?: Partial<RateLimiterConfig>
}

export interface RateLimitCheckResult {
  allowed: boolean
  tokensRemaining: number
  resetMs: number
}

interface Bucket {
  tokens: number
  lastRefill: number
  cfg: RateLimiterConfig
}

const buckets = new Map<string, Bucket>()

const DEFAULT_CONFIG: RateLimiterConfig = {
  maxTokens: 60,         // Burst capacity (allows up to 60 rapid scans)
  refillRatePerSec: 2,   // Refills 2 tokens per second (120/min sustained)
  windowMs: 60000
}

/**
 * Gets or initializes a rate limiter bucket for a given scope
 */
function getBucket(scope: string, config: Partial<RateLimiterConfig> = {}): Bucket {
  const cfg: RateLimiterConfig = { ...DEFAULT_CONFIG, ...config }
  const now = Date.now()
  let bucket = buckets.get(scope)

  if (!bucket) {
    bucket = {
      tokens: cfg.maxTokens,
      lastRefill: now,
      cfg
    }
    buckets.set(scope, bucket)
    return bucket
  }

  // Refill tokens based on elapsed time
  const elapsedSec = (now - bucket.lastRefill) / 1000
  if (elapsedSec > 0) {
    const refilledTokens = elapsedSec * cfg.refillRatePerSec
    bucket.tokens = Math.min(cfg.maxTokens, bucket.tokens + refilledTokens)
    bucket.lastRefill = now
  }

  return bucket
}

/**
 * Checks if a consume request is allowed under rate limiting rules.
 * Automatically bypasses rate limits for offline queue retries.
 */
export function checkRateLimit(scope: string = 'default', options: RateLimitOptions = {}): RateLimitCheckResult {
  if (options.isOfflineRetry) {
    return { allowed: true, tokensRemaining: DEFAULT_CONFIG.maxTokens, resetMs: 0 }
  }

  const bucket = getBucket(scope, options.config)
  const cost = typeof options.cost === 'number' && Number.isInteger(options.cost) && options.cost > 0 ? options.cost : 1

  if (bucket.tokens >= cost) {
    return {
      allowed: true,
      tokensRemaining: Math.floor(bucket.tokens - cost),
      resetMs: 0
    }
  }

  const missingTokens = cost - bucket.tokens
  const waitTimeMs = Math.ceil((missingTokens / bucket.cfg.refillRatePerSec) * 1000)

  return {
    allowed: false,
    tokensRemaining: Math.floor(bucket.tokens),
    resetMs: waitTimeMs
  }
}

/**
 * Attempts to consume tokens for an operation.
 * Returns true if allowed and consumed, false if rate limited.
 */
export function consumeRateLimit(scope: string = 'default', options: RateLimitOptions = {}): boolean {
  if (options.isOfflineRetry) return true

  const check = checkRateLimit(scope, options)
  if (!check.allowed) return false

  const bucket = getBucket(scope, options.config)
  const cost = typeof options.cost === 'number' && Number.isInteger(options.cost) && options.cost > 0 ? options.cost : 1
  bucket.tokens -= cost

  return true
}

/**
 * Resets a specific scope or all rate limit buckets
 */
export function resetRateLimiter(scope: string | null = null): void {
  if (scope) {
    buckets.delete(scope)
  } else {
    buckets.clear()
  }
}
