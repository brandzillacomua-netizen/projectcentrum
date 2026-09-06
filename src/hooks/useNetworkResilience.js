/**
 * Network Resilience React Hook
 * Provides network status monitoring, idempotency protection, and offline queueing.
 */

import { useState, useEffect, useCallback } from 'react'
import {
  generateIdempotencyKey,
  hasBeenProcessed,
  isPending,
  setPending,
  clearPending,
  getCachedResult,
  markAsProcessed
} from '../services/idempotencyService'

import {
  enqueueOfflineMutation,
  getOfflineQueueCount,
  flushOfflineQueue
} from '../services/offlineQueueService'

export function useNetworkResilience(processorFn) {
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true)
  const [queueCount, setQueueCount] = useState(getOfflineQueueCount())
  const [isSyncing, setIsSyncing] = useState(false)

  // Listen to network status changes
  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true)
      if (processorFn) {
        setIsSyncing(true)
        await flushOfflineQueue(processorFn)
        setQueueCount(getOfflineQueueCount())
        setIsSyncing(false)
      }
    }

    const handleOffline = () => {
      setIsOnline(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [processorFn])

  /**
   * Executes a mutation safely with zero-duplicate guarantee.
   */
  const executeSafeMutation = useCallback(async ({
    actionType,
    uniqueId = '',
    key: providedKey,
    mutationFn,
    payload = {}
  }) => {
    const key = providedKey || generateIdempotencyKey(actionType, uniqueId)

    // 1. Check if already processed
    if (hasBeenProcessed(key)) {
      console.warn(`[SafeMutation] Action ${key} was already processed. Returning cached result.`)
      return getCachedResult(key) || { success: true, cached: true }
    }

    // 2. Check if currently in-flight
    if (isPending(key)) {
      console.warn(`[SafeMutation] Action ${key} is currently in-flight. Suppressing duplicate call.`)
      return { success: true, pending: true }
    }

    setPending(key)

    // 3. Handle offline case
    if (!navigator.onLine) {
      clearPending(key)
      enqueueOfflineMutation({ key, actionType, payload })
      setQueueCount(getOfflineQueueCount())
      return { success: true, queued: true, isOffline: true }
    }

    // 4. Execute mutation online
    try {
      const result = await mutationFn()
      markAsProcessed(key, result || { success: true })
      return result || { success: true }
    } catch (error) {
      clearPending(key)

      // Network error during fetch -> enqueue to offline queue
      const isNetErr = !navigator.onLine || error?.name === 'TypeError' || error?.message?.includes('fetch')
      if (isNetErr) {
        console.warn(`[SafeMutation] Network error during ${actionType}. Enqueueing to offline queue.`, error)
        enqueueOfflineMutation({ key, actionType, payload })
        setQueueCount(getOfflineQueueCount())
        return { success: true, queued: true, isOffline: true }
      }

      throw error
    }
  }, [])

  return {
    isOnline,
    isSyncing,
    queueCount,
    executeSafeMutation,
    generateIdempotencyKey
  }
}
