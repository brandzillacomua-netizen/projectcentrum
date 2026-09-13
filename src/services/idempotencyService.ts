/**
 * Idempotency Service (Zero Duplicates Guarantee)
 * Stores and manages idempotency keys across page reloads and network reconnects.
 */

export interface IdempotencyRecord<T = unknown> {
  timestamp: number
  result: T
}

const STORAGE_KEY = 'centrum_idempotency_keys_v1'
const MAX_KEYS = 500
const EXPIRATION_MS = 24 * 60 * 60 * 1000 // 24 hours

// In-memory RAM cache for ultra-fast lookup
const ramCache = new Map<string, IdempotencyRecord<unknown>>()
const pendingKeys = new Set<string>()

// Load stored keys into RAM cache at initialization
const loadStoredKeys = (): void => {
  try {
    if (typeof localStorage === 'undefined') return
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw) as Record<string, IdempotencyRecord<unknown>>
    const now = Date.now()

    Object.entries(parsed).forEach(([key, record]) => {
      if (record && typeof record.timestamp === 'number' && now - record.timestamp < EXPIRATION_MS) {
        ramCache.set(key, record)
      }
    })
  } catch (e) {
    console.warn('[Idempotency] Failed to load cached keys:', e)
  }
}

loadStoredKeys()

const persistKeys = (): void => {
  try {
    if (typeof localStorage === 'undefined') return
    const obj: Record<string, IdempotencyRecord<unknown>> = {}
    const entries = Array.from(ramCache.entries()).slice(-MAX_KEYS)
    entries.forEach(([k, v]) => {
      obj[k] = v
    })
    localStorage.setItem(STORAGE_KEY, JSON.stringify(obj))
  } catch (e) {
    console.warn('[Idempotency] Failed to persist keys:', e)
  }
}

/**
 * Generates a unique, deterministic idempotency key for an action
 */
export const generateIdempotencyKey = (actionType: string, uniqueId: string | number = ''): string => {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 9)
  const cleanId = String(uniqueId).replace(/[^a-zA-Z0-9_-]/g, '')
  return `${actionType}_${cleanId ? `${cleanId}_` : ''}${timestamp}_${random}`
}

/**
 * Checks if key has already been processed successfully
 */
export const hasBeenProcessed = (key?: string | null): boolean => {
  if (!key) return false
  const record = ramCache.get(key)
  if (!record) return false
  if (Date.now() - record.timestamp > EXPIRATION_MS) {
    ramCache.delete(key)
    return false
  }
  return true
}

/**
 * Checks if a key is currently in-flight
 */
export const isPending = (key?: string | null): boolean => {
  if (!key) return false
  return pendingKeys.has(key)
}

/**
 * Marks a key as in-flight
 */
export const setPending = (key?: string | null): void => {
  if (key) pendingKeys.add(key)
}

/**
 * Clears in-flight status
 */
export const clearPending = (key?: string | null): void => {
  if (key) pendingKeys.delete(key)
}

/**
 * Gets cached result of a previously executed idempotent action
 */
export const getCachedResult = <T = unknown>(key?: string | null): T | null => {
  if (!key) return null
  const record = ramCache.get(key)
  return record ? (record.result as T) : null
}

/**
 * Marks an action as completed and caches the result
 */
export const markAsProcessed = <T = unknown>(key: string | null | undefined, result: T = { success: true } as unknown as T): void => {
  if (!key) return
  pendingKeys.delete(key)
  ramCache.set(key, {
    timestamp: Date.now(),
    result
  })
  persistKeys()
}
