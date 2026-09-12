import { describe, expect, it, vi } from 'vitest'
import { createPresenceHeartbeat } from '../src/contexts/useUserPresence.js'

const flush = () => new Promise(resolve => setTimeout(resolve, 0))

const createHarness = overrides => {
  const scheduled = []
  const listeners = new Set()
  const touchPresence = vi.fn().mockResolvedValue(undefined)
  const cancelTimer = vi.fn()
  const heartbeat = createPresenceHeartbeat({
    userId: 139,
    touchPresence,
    isVisible: () => true,
    isOnline: () => true,
    addVisibilityListener: handler => listeners.add(handler),
    removeVisibilityListener: handler => listeners.delete(handler),
    scheduleTimer: (callback, delay) => {
      const timer = { callback, delay }
      scheduled.push(timer)
      return timer
    },
    cancelTimer,
    random: () => 0.5,
    reportError: vi.fn(),
    ...overrides
  })
  return { heartbeat, touchPresence, scheduled, listeners, cancelTimer }
}

describe('user presence heartbeat', () => {
  it('touches immediately and schedules a jittered sequential refresh', async () => {
    const harness = createHarness()
    harness.heartbeat.start()
    await flush()

    expect(harness.touchPresence).toHaveBeenCalledWith(139)
    expect(harness.scheduled[0].delay).toBe(52500)
    expect(harness.listeners.size).toBe(1)

    await harness.scheduled[0].callback()
    expect(harness.touchPresence).toHaveBeenCalledTimes(2)
    expect(harness.scheduled).toHaveLength(2)
  })

  it('does not call the RPC while hidden or offline', async () => {
    const hidden = createHarness({ isVisible: () => false })
    hidden.heartbeat.start()
    await flush()
    expect(hidden.touchPresence).not.toHaveBeenCalled()

    const offline = createHarness({ isOnline: () => false })
    offline.heartbeat.start()
    await flush()
    expect(offline.touchPresence).not.toHaveBeenCalled()
  })

  it('coalesces overlapping updates into one RPC', async () => {
    let resolveTouch
    const touchPresence = vi.fn(() => new Promise(resolve => { resolveTouch = resolve }))
    const harness = createHarness({ touchPresence })

    const first = harness.heartbeat.updatePresence()
    const second = harness.heartbeat.updatePresence()
    expect(await second).toBe(false)
    expect(touchPresence).toHaveBeenCalledTimes(1)

    resolveTouch()
    expect(await first).toBe(true)
  })

  it('reports RPC failures without breaking the timer loop', async () => {
    const reportError = vi.fn()
    const failure = new Error('temporary outage')
    const harness = createHarness({
      touchPresence: vi.fn().mockRejectedValue(failure),
      reportError
    })
    harness.heartbeat.start()
    await flush()
    expect(reportError).toHaveBeenCalledWith(failure)
    expect(harness.scheduled).toHaveLength(1)
  })

  it('cancels the active timer and listener on cleanup', () => {
    const harness = createHarness()
    harness.heartbeat.start()
    const timer = harness.scheduled[0]
    harness.heartbeat.stop()
    expect(harness.cancelTimer).toHaveBeenCalledWith(timer)
    expect(harness.listeners.size).toBe(0)
  })
})
