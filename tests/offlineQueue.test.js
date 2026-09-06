import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  enqueueOfflineMutation,
  dequeueOfflineMutation,
  getOfflineQueueCount,
  flushOfflineQueue,
  clearOfflineQueue
} from '../src/services/offlineQueueService.js'
import { executeAtomicCardTransition } from '../src/services/atomicCardTransitionService.js'
import { processOfflineMutation } from '../src/services/offlineProcessor.js'

describe('Offline Queue & Resilience Service', () => {
  beforeEach(() => {
    clearOfflineQueue()
  })

  it('enqueues mutations and guards against duplicate keys', () => {
    expect(getOfflineQueueCount()).toBe(0)

    const key = `test_scan_${Date.now()}`
    enqueueOfflineMutation({
      key,
      actionType: 'START_WORK_CARD',
      payload: { cardId: 'test-card-1', updateData: { status: 'in-progress' } }
    })

    expect(getOfflineQueueCount()).toBe(1)

    // Enqueueing the exact same key must be deduplicated
    enqueueOfflineMutation({
      key,
      actionType: 'START_WORK_CARD',
      payload: { cardId: 'test-card-1', updateData: { status: 'in-progress' } }
    })

    expect(getOfflineQueueCount()).toBe(1)
  })

  it('flushes queued mutations in chronological order using processorFn', async () => {
    const executed = []
    const processorMock = vi.fn(async (item) => {
      executed.push(item.key)
      return { success: true }
    })

    enqueueOfflineMutation({
      key: 'item-1',
      actionType: 'START_WORK_CARD',
      payload: { cardId: 'card-1' }
    })
    enqueueOfflineMutation({
      key: 'item-2',
      actionType: 'TRANSITION_WORK_CARD',
      payload: { cardId: 'card-2' }
    })

    expect(getOfflineQueueCount()).toBe(2)

    const result = await flushOfflineQueue(processorMock)

    expect(result.flushed).toBe(2)
    expect(result.failed).toBe(0)
    expect(executed).toEqual(['item-1', 'item-2'])
    expect(getOfflineQueueCount()).toBe(0)
  })

  it('executeAtomicCardTransition gracefully buffers mutation when offline', async () => {
    // Simulate browser going offline
    const originalOnLine = navigator.onLine
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })

    try {
      const cardId = 'a1111111-2222-3333-4444-555555555555'
      const cardUpdate = {
        status: 'in-progress',
        operation: 'Розкрій',
        operator_name: 'Петренко Іван'
      }

      const res = await executeAtomicCardTransition({
        cardId,
        cardUpdate,
        allowOfflineQueue: true
      })

      expect(res.success).toBe(true)
      expect(res.queued).toBe(true)
      expect(res.isOffline).toBe(true)
      expect(getOfflineQueueCount()).toBeGreaterThan(0)
    } finally {
      Object.defineProperty(navigator, 'onLine', { value: originalOnLine, configurable: true })
    }
  })

  it('processOfflineMutation handles TRANSITION_WORK_CARD without throwing', async () => {
    const mockItem = {
      key: `replay_trans_${Date.now()}`,
      actionType: 'TRANSITION_WORK_CARD',
      payload: {
        cardId: 'a1111111-2222-3333-4444-555555555555',
        cardUpdate: { status: 'in-progress' },
        historyData: null
      }
    }

    // Should return result object cleanly (even if DB is mocked / returns conflict or RPC fallback)
    const res = await processOfflineMutation(mockItem)
    expect(res).toBeDefined()
    expect(typeof res.success).toBe('boolean')
  })
})
