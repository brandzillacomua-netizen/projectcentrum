import { useEffect } from 'react'
import {
  INITIAL_FETCH_RETRY_BASE_MS,
  INITIAL_FETCH_RETRY_JITTER_MS,
  ROUTE_ENTRY_REFRESH_TTL_MS,
  ROUTE_ENTRY_JITTER_MS,
  VISIBILITY_REFRESH_COOLDOWN_MS,
  VISIBILITY_REFRESH_JITTER_MS
} from './dataProfiles.js'

export function useDataLifecycle(state, fetchers) {
  const {
    currentUser,
    isPublicDataRoute,
    routeDataTables,
    routeDataTableKey,
    path,
    normalizedPath,
    needsProductionSummary,
    getInitialFetchDelayMs,
    initialFetchCompletedUserIdRef,
    initialFetchScheduleRef,
    initialFetchTimerRef,
    lastVisibilityRefreshRef,
    currentUserIdRef,
    targetRefreshLastRef,
    fullFetchInFlightRef,
    visibilityRefreshTimerRef
  } = state

  const {
    fetchCritical,
    fetchData,
    refreshProductionSummary,
    getTargetRefreshKey
  } = fetchers

  // ── Auth-gated initial critical data fetch ──
  useEffect(() => {
    let cancelled = false
    if (!currentUser?.id || isPublicDataRoute) {
      initialFetchCompletedUserIdRef.current = null
      initialFetchScheduleRef.current = { userId: null, notBefore: 0 }
      if (initialFetchTimerRef.current) {
        clearTimeout(initialFetchTimerRef.current)
        initialFetchTimerRef.current = null
      }
      return undefined
    }

    if (initialFetchCompletedUserIdRef.current !== currentUser.id && !initialFetchTimerRef.current) {
      lastVisibilityRefreshRef.current = Date.now()
      const scheduledUserId = currentUser.id
      const delay = getInitialFetchDelayMs()

      const runInitialFetch = () => {
        initialFetchTimerRef.current = null
        if (currentUserIdRef.current !== scheduledUserId) return
        fetchCritical()
          .catch(error => console.error('Initial critical data fetch failed:', error))
          .finally(() => {
            if (cancelled) return
            if (currentUserIdRef.current !== scheduledUserId) return
            if (initialFetchCompletedUserIdRef.current === scheduledUserId) return
            if (initialFetchTimerRef.current) return

            const retryDelay = INITIAL_FETCH_RETRY_BASE_MS
              + Math.floor(Math.random() * (INITIAL_FETCH_RETRY_JITTER_MS + 1))
            initialFetchTimerRef.current = setTimeout(runInitialFetch, retryDelay)
          })
      }

      initialFetchTimerRef.current = setTimeout(runInitialFetch, delay)
    }

    return () => {
      cancelled = true
      if (initialFetchTimerRef.current) {
        clearTimeout(initialFetchTimerRef.current)
        initialFetchTimerRef.current = null
      }
    }
  }, [
    currentUser?.id,
    currentUserIdRef,
    fetchCritical,
    getInitialFetchDelayMs,
    initialFetchCompletedUserIdRef,
    initialFetchScheduleRef,
    initialFetchTimerRef,
    isPublicDataRoute,
    lastVisibilityRefreshRef,
    routeDataTableKey
  ])

  // ── Route entry table freshness check & refresh ──
  useEffect(() => {
    if (!currentUser?.id || isPublicDataRoute || routeDataTables.length === 0) return undefined

    let cancelled = false
    const now = Date.now()
    const missingOrStale = routeDataTables.filter(tableName => {
      const lastRun = targetRefreshLastRef.current[getTargetRefreshKey(tableName)] || 0
      return now - lastRun >= ROUTE_ENTRY_REFRESH_TTL_MS
    })
    if (missingOrStale.length === 0) return undefined

    const timer = setTimeout(() => {
      if (cancelled || currentUserIdRef.current !== currentUser.id) return
      const routeTargets = missingOrStale.filter(tableName => {
        const lastRun = targetRefreshLastRef.current[getTargetRefreshKey(tableName)] || 0
        return Date.now() - lastRun >= ROUTE_ENTRY_REFRESH_TTL_MS
      })
      const routeLoad = routeTargets.length > 0 ? fetchData(routeTargets) : Promise.resolve()
      routeLoad
        .then(() => needsProductionSummary ? refreshProductionSummary() : null)
        .catch(error => console.warn(`Route data load failed for ${normalizedPath}:`, error))
    }, Math.floor(Math.random() * (ROUTE_ENTRY_JITTER_MS + 1)))

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [
    currentUser?.id,
    currentUserIdRef,
    fetchData,
    getTargetRefreshKey,
    isPublicDataRoute,
    needsProductionSummary,
    normalizedPath,
    refreshProductionSummary,
    routeDataTableKey,
    routeDataTables,
    targetRefreshLastRef
  ])

  // ── Foreman2 projection models loader ──
  useEffect(() => {
    if (!currentUser?.id || path !== '/foreman2') return
    fetchData(['work_card_scrap_totals', 'work_card_flow_totals'])
      .catch(error => console.warn('Failed to load Foreman2 projections:', error))
  }, [currentUser?.id, fetchData, path])

  // ── Window focus and visibility change re-sync ──
  useEffect(() => {
    if (!currentUser?.id || isPublicDataRoute) return undefined

    const getReactivationTargets = () => {
      const staticTables = new Set([
        'nomenclatures',
        'bom_items',
        'system_users',
        'company_structure',
        'company_positions',
        'customers'
      ])
      return routeDataTables.filter(tableName => !staticTables.has(tableName))
    }

    const handleRefresh = () => {
      const now = Date.now()
      if (fullFetchInFlightRef.current) return
      if (visibilityRefreshTimerRef.current) return
      if (now - lastVisibilityRefreshRef.current < VISIBILITY_REFRESH_COOLDOWN_MS) return

      const delay = Math.floor(Math.random() * VISIBILITY_REFRESH_JITTER_MS)
      visibilityRefreshTimerRef.current = setTimeout(() => {
        visibilityRefreshTimerRef.current = null
        if (document.visibilityState !== 'visible') return
        lastVisibilityRefreshRef.current = Date.now()
        fetchData(getReactivationTargets())
          .then(() => needsProductionSummary ? refreshProductionSummary() : null)
          .catch(error => console.warn('Targeted reactivation refresh failed:', error))
      }, delay)
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        handleRefresh()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleRefresh)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleRefresh)
      if (visibilityRefreshTimerRef.current) {
        clearTimeout(visibilityRefreshTimerRef.current)
        visibilityRefreshTimerRef.current = null
      }
    }
  }, [
    currentUser?.id,
    fetchData,
    fullFetchInFlightRef,
    isPublicDataRoute,
    lastVisibilityRefreshRef,
    needsProductionSummary,
    refreshProductionSummary,
    routeDataTableKey,
    routeDataTables,
    visibilityRefreshTimerRef
  ])
}
