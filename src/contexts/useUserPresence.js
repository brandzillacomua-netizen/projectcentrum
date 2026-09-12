import { useEffect } from 'react'

const BASE_INTERVAL_MS = 45000
const JITTER_MS = 15000

export const createPresenceHeartbeat = ({
  userId,
  touchPresence,
  isVisible = () => document.visibilityState === 'visible',
  isOnline = () => navigator.onLine,
  addVisibilityListener = handler => document.addEventListener('visibilitychange', handler),
  removeVisibilityListener = handler => document.removeEventListener('visibilitychange', handler),
  scheduleTimer = (callback, delay) => setTimeout(callback, delay),
  cancelTimer = timer => clearTimeout(timer),
  random = Math.random,
  reportError = error => console.warn('[Presence] Не вдалося оновити статус присутності:', error?.message || error)
}) => {
  let cancelled = false
  let timer = null
  let inFlight = false

  const updatePresence = async () => {
    if (cancelled || inFlight || !isVisible() || !isOnline()) return false
    inFlight = true
    try {
      await touchPresence(userId)
      return true
    } catch (error) {
      reportError(error)
      return false
    } finally {
      inFlight = false
    }
  }

  const schedulePresence = () => {
    if (cancelled) return
    const delay = BASE_INTERVAL_MS + Math.floor(random() * JITTER_MS)
    timer = scheduleTimer(async () => {
      await updatePresence()
      schedulePresence()
    }, delay)
  }

  const handleVisibility = () => {
    if (isVisible()) void updatePresence()
  }

  const start = () => {
    void updatePresence()
    schedulePresence()
    addVisibilityListener(handleVisibility)
  }

  const stop = () => {
    cancelled = true
    if (timer !== null) cancelTimer(timer)
    removeVisibilityListener(handleVisibility)
  }

  return { start, stop, updatePresence }
}

export const useUserPresence = (userId, client) => {
  useEffect(() => {
    if (!userId) return undefined

    const heartbeat = createPresenceHeartbeat({
      userId,
      touchPresence: async id => {
        const { error } = await client.rpc('rpc_touch_user_presence', { p_user_id: id })
        if (error) throw error
      }
    })

    heartbeat.start()
    return heartbeat.stop
  }, [client, userId])
}
