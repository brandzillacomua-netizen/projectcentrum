/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛡️ MES CENTRUM ENTERPRISE: UNLIMITED INDEXEDDB OFFLINE QUEUE SERVICE
 * ═══════════════════════════════════════════════════════════════════════════
 * Zero-Duplicates Guarantee + High-Capacity Persistence.
 * 
 * Migrates offline storage from 5MB localStorage to IndexedDB (virtually unlimited).
 * Keeps an active in-memory cache for 0ms synchronous UI reads (e.g. badge counters).
 * Maintains full backward compatibility with existing calls.
 */

import { hasBeenProcessed, markAsProcessed } from './idempotencyService.js'
import { getIndexedCache, setIndexedCache } from './indexedDbCache.js'

const LEGACY_STORAGE_KEY = 'centrum_offline_queue_v1'
const IDB_QUEUE_KEY = 'centrum_offline_queue_v2'

let memoryQueue = []
let isHydrated = false

// Synchronous bootstrap from localStorage as fast initial seed
try {
  if (typeof localStorage !== 'undefined') {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY)
    if (raw) {
      memoryQueue = JSON.parse(raw)
    }
  }
} catch (e) {
  console.warn('[OfflineQueue] Fast localStorage read error:', e)
}

/**
 * Asynchronously hydrate and migrate queue from IndexedDB
 */
export const hydrateOfflineQueueFromIdb = async () => {
  if (typeof window === 'undefined') return memoryQueue
  try {
    const idbData = await getIndexedCache(IDB_QUEUE_KEY)
    if (Array.isArray(idbData) && idbData.length > 0) {
      // Merge unique items between IDB and memory
      const existingKeys = new Set(idbData.map(i => i.key))
      const combined = [...idbData]
      for (const memItem of memoryQueue) {
        if (!existingKeys.has(memItem.key)) {
          combined.push(memItem)
          existingKeys.add(memItem.key)
        }
      }
      memoryQueue = combined
    } else if (memoryQueue.length > 0) {
      // Migrate existing localStorage records into IndexedDB
      await setIndexedCache(IDB_QUEUE_KEY, memoryQueue).catch(() => {})
    }
    isHydrated = true
  } catch (e) {
    console.warn('[OfflineQueue] IDB hydration error (using memory queue):', e)
  }
  return memoryQueue
}

// Auto-trigger background hydration on load
if (typeof window !== 'undefined') {
  hydrateOfflineQueueFromIdb().catch(() => {})
}

const notifyQueueChanged = (count) => {
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    try {
      window.dispatchEvent(new CustomEvent('mes:offline-queue-changed', { detail: { count } }))
    } catch (_) {}
  }
}

/**
 * Persist queue to IndexedDB (primary, unlimited) and localStorage (secondary best-effort)
 */
const persistQueue = (queue) => {
  memoryQueue = queue
  notifyQueueChanged(queue.length)

  // 1. Asynchronously persist to IndexedDB (Unlimited capacity, non-blocking)
  if (typeof window !== 'undefined') {
    setIndexedCache(IDB_QUEUE_KEY, queue).catch(err => {
      console.warn('[OfflineQueue] Failed to persist queue to IndexedDB:', err)
    })
  }

  // 2. Best-effort mirror to localStorage for synchronous fallbacks, ignoring QuotaExceededError
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(queue))
    }
  } catch (e) {
    // QuotaExceededError is safely ignored because IndexedDB stores the complete queue
    console.warn('[OfflineQueue] LocalStorage quota exceeded, safely relying on IndexedDB:', e?.message || e)
  }
}

// Auto-flush queue when network connection is restored
if (typeof window !== 'undefined') {
  window.addEventListener('online', async () => {
    if (memoryQueue.length === 0) return
    console.info(`[OfflineQueue] Network restored with ${memoryQueue.length} pending items. Triggering auto-sync...`)
    try {
      const { processOfflineMutation } = await import('./offlineProcessor.js')
      await flushOfflineQueue(processOfflineMutation)
    } catch (err) {
      console.warn('[OfflineQueue] Auto-flush on network reconnect failed:', err)
    }
  })
}

/**
 * Enqueues a pending mutation to local storage & IndexedDB
 */
export const enqueueOfflineMutation = ({ key, actionType, payload, timestamp = Date.now() }) => {
  if (hasBeenProcessed(key)) {
    console.info(`[OfflineQueue] Key ${key} already processed. Skipping enqueue.`)
    return
  }

  // Avoid duplicate entries in queue
  if (memoryQueue.some(item => item.key === key)) {
    return
  }

  const updatedQueue = [
    ...memoryQueue,
    {
      key,
      actionType,
      payload,
      timestamp
    }
  ]

  persistQueue(updatedQueue)
  console.info(`[OfflineQueue] Enqueued offline mutation ${actionType} (${key}). Total queued: ${updatedQueue.length}`)
}

/**
 * Gets number of pending queued mutations (0ms synchronous RAM read)
 */
export const getOfflineQueueCount = () => {
  return memoryQueue.length
}

/**
 * Removes a mutation from queue
 */
export const dequeueOfflineMutation = (key) => {
  const filtered = memoryQueue.filter(item => item.key !== key)
  persistQueue(filtered)
}

/**
 * Flushes all pending mutations chronologically using the provided processor
 */
export const flushOfflineQueue = async (processorFn) => {
  if (!isHydrated) {
    await hydrateOfflineQueueFromIdb().catch(() => {})
  }

  if (memoryQueue.length === 0) return { flushed: 0, failed: 0 }

  console.info(`[OfflineQueue] Starting queue flush for ${memoryQueue.length} items...`)
  let flushed = 0
  let failed = 0

  // Clone snapshot of queue to process in strict chronological order
  const queueSnapshot = [...memoryQueue]

  for (const item of queueSnapshot) {
    if (hasBeenProcessed(item.key)) {
      dequeueOfflineMutation(item.key)
      flushed++
      continue
    }

    try {
      const res = await processorFn(item)
      markAsProcessed(item.key, res)
      dequeueOfflineMutation(item.key)
      flushed++
    } catch (e) {
      console.error(`[OfflineQueue] Failed to process queued item ${item.key}:`, e)
      failed++
      // Stop flushing if network error recurs
      if (e?.name === 'TypeError' || e?.message?.includes('fetch')) {
        break
      }
    }
  }

  console.info(`[OfflineQueue] Flush complete. Flushed: ${flushed}, Failed: ${failed}`)
  return { flushed, failed }
}

/**
 * Resets the offline queue (clears memory, localStorage, and IndexedDB)
 */
export const clearOfflineQueue = () => {
  persistQueue([])
  if (typeof window !== 'undefined') {
    setIndexedCache(IDB_QUEUE_KEY, []).catch(() => {})
  }
}
