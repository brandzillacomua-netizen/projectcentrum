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

import { hasBeenProcessed, markAsProcessed } from './idempotencyService'
import { getIndexedCache, setIndexedCache } from './indexedDbCache.js'

export interface OfflineMutation<T = unknown> {
  key: string
  actionType: string
  payload: T
  timestamp: number
  retryCount?: number
}

export interface DeadLetterItem<T = unknown> extends OfflineMutation<T> {
  failedAt: string
  errorReason: string
}

export interface EnqueueOptions<T = unknown> {
  key: string
  actionType: string
  payload: T
  timestamp?: number
}

export interface FlushResult {
  flushed: number
  failed: number
}

const LEGACY_STORAGE_KEY = 'centrum_offline_queue_v1'
const IDB_QUEUE_KEY = 'centrum_offline_queue_v2'
const IDB_DLQ_KEY = 'centrum_offline_dlq_v1'
const MAX_RETRY_ATTEMPTS = 3

let memoryQueue: OfflineMutation[] = []
let memoryDlq: DeadLetterItem[] = []
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
export const hydrateOfflineQueueFromIdb = async (): Promise<OfflineMutation[]> => {
  if (typeof window === 'undefined') return memoryQueue
  try {
    const idbData = (await getIndexedCache(IDB_QUEUE_KEY)) as OfflineMutation[] | null
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

    const dlqData = (await getIndexedCache(IDB_DLQ_KEY)) as DeadLetterItem[] | null
    if (Array.isArray(dlqData)) {
      memoryDlq = dlqData
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

const notifyQueueChanged = (count: number): void => {
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    try {
      window.dispatchEvent(new CustomEvent('mes:offline-queue-changed', { detail: { count } }))
    } catch (_) {}
  }
}

/**
 * Persist queue to IndexedDB (primary, unlimited) and localStorage (secondary best-effort)
 */
const persistQueue = (queue: OfflineMutation[]): void => {
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
    console.warn('[OfflineQueue] LocalStorage quota exceeded, safely relying on IndexedDB:', e)
  }
}

/**
 * Push rejected item to Dead-Letter Queue (DLQ)
 */
export const pushToDeadLetterQueue = async <T = unknown>(item: OfflineMutation<T>, errorReason: unknown): Promise<void> => {
  const dlqItem: DeadLetterItem<T> = {
    ...item,
    failedAt: new Date().toISOString(),
    errorReason: String(errorReason || 'Max retry limit reached')
  }
  memoryDlq = [...memoryDlq, dlqItem as DeadLetterItem]

  if (typeof window !== 'undefined') {
    setIndexedCache(IDB_DLQ_KEY, memoryDlq).catch(() => {})
    try {
      window.dispatchEvent(new CustomEvent('mes:offline-dlq-item', { detail: { item: dlqItem } }))
    } catch (_) {}
  }
  console.warn(`[OfflineQueue] Item ${item.key} moved to Dead-Letter Queue (DLQ):`, errorReason)
}

export const getDeadLetterQueue = (): DeadLetterItem[] => [...memoryDlq]

export const clearDeadLetterQueue = (): void => {
  memoryDlq = []
  if (typeof window !== 'undefined') {
    setIndexedCache(IDB_DLQ_KEY, []).catch(() => {})
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
export const enqueueOfflineMutation = <T = unknown>({ key, actionType, payload, timestamp = Date.now() }: EnqueueOptions<T>): void => {
  if (hasBeenProcessed(key)) {
    console.info(`[OfflineQueue] Key ${key} already processed. Skipping enqueue.`)
    return
  }

  // Avoid duplicate entries in queue
  if (memoryQueue.some(item => item.key === key)) {
    return
  }

  const updatedQueue: OfflineMutation[] = [
    ...memoryQueue,
    {
      key,
      actionType,
      payload,
      timestamp,
      retryCount: 0
    }
  ]

  persistQueue(updatedQueue)
  console.info(`[OfflineQueue] Enqueued offline mutation ${actionType} (${key}). Total queued: ${updatedQueue.length}`)
}

/**
 * Gets number of pending queued mutations (0ms synchronous RAM read)
 */
export const getOfflineQueueCount = (): number => {
  return memoryQueue.length
}

/**
 * Removes a mutation from queue
 */
export const dequeueOfflineMutation = (key: string): void => {
  const filtered = memoryQueue.filter(item => item.key !== key)
  persistQueue(filtered)
}

/**
 * Flushes all pending mutations chronologically using the provided processor
 */
export const flushOfflineQueue = async (processorFn: (item: OfflineMutation) => Promise<unknown>): Promise<FlushResult> => {
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
    } catch (e: any) {
      console.error(`[OfflineQueue] Failed to process queued item ${item.key}:`, e)
      failed++
      
      // Stop flushing if network connectivity issue occurs
      const isNetworkError = e?.name === 'TypeError' || String(e?.message || '').toLowerCase().includes('fetch') || e?.status === 0
      if (isNetworkError) {
        break
      }

      // Track retry count for non-network business/schema errors
      item.retryCount = (item.retryCount || 0) + 1
      if (item.retryCount >= MAX_RETRY_ATTEMPTS) {
        dequeueOfflineMutation(item.key)
        await pushToDeadLetterQueue(item, e?.message || e)
      } else {
        // Update item in memory queue with incremented retryCount
        const updated = memoryQueue.map(q => q.key === item.key ? { ...q, retryCount: item.retryCount } : q)
        persistQueue(updated)
      }
    }
  }

  console.info(`[OfflineQueue] Flush complete. Flushed: ${flushed}, Failed: ${failed}`)
  return { flushed, failed }
}

/**
 * Resets the offline queue (clears memory, localStorage, and IndexedDB)
 */
export const clearOfflineQueue = (): void => {
  persistQueue([])
  if (typeof window !== 'undefined') {
    setIndexedCache(IDB_QUEUE_KEY, []).catch(() => {})
  }
}
