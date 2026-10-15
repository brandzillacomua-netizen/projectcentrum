import { useState, useCallback, useEffect, useRef } from 'react'
import { supabase } from '../../../supabase'

const FALLBACK_REFRESH_MS = 2 * 60 * 1000
const REALTIME_DEBOUNCE_MS = 1200

export function useWarehouseRealtime(fetchData) {
  const [liveRequests, setLiveRequests] = useState(null)
  const [isRefreshingQueue, setIsRefreshingQueue] = useState(false)
  const fetchDataRef = useRef(fetchData)
  const queueRequestRef = useRef(null)
  const queueRefreshTimerRef = useRef(null)
  const workCardsRefreshTimerRef = useRef(null)

  useEffect(() => {
    fetchDataRef.current = fetchData
  }, [fetchData])

  const runQueueRefresh = useCallback(async (includeRelatedData = false) => {
    if (queueRequestRef.current) return queueRequestRef.current

    const request = (async () => {
      setIsRefreshingQueue(true)
      try {
        if (includeRelatedData && typeof fetchDataRef.current === 'function') {
          await fetchDataRef.current(['inventory', 'orders', 'tasks', 'nomenclatures', 'work_cards'])
        }
        const { data, error } = await supabase
          .from('material_requests')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(300)
        if (error) throw error
        if (Array.isArray(data)) setLiveRequests(data)
      } catch (err) {
        console.warn('[WarehouseFGP] runQueueRefresh error:', err)
      } finally {
        setIsRefreshingQueue(false)
        queueRequestRef.current = null
      }
    })()

    queueRequestRef.current = request
    return request
  }, [])

  const fetchQueueFromDb = useCallback(() => runQueueRefresh(true), [runQueueRefresh])

  const scheduleQueueRefresh = useCallback(() => {
    if (queueRefreshTimerRef.current) clearTimeout(queueRefreshTimerRef.current)
    queueRefreshTimerRef.current = setTimeout(() => {
      queueRefreshTimerRef.current = null
      if (document.visibilityState === 'visible') runQueueRefresh(false)
    }, REALTIME_DEBOUNCE_MS)
  }, [runQueueRefresh])

  const scheduleWorkCardsRefresh = useCallback(() => {
    if (workCardsRefreshTimerRef.current) clearTimeout(workCardsRefreshTimerRef.current)
    workCardsRefreshTimerRef.current = setTimeout(() => {
      workCardsRefreshTimerRef.current = null
      if (document.visibilityState === 'visible' && typeof fetchDataRef.current === 'function') {
        fetchDataRef.current(['work_cards']).catch(() => {})
      }
    }, REALTIME_DEBOUNCE_MS)
  }, [])

  useEffect(() => {
    fetchQueueFromDb()
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') runQueueRefresh(false)
    }, FALLBACK_REFRESH_MS)
    return () => clearInterval(interval)
  }, [fetchQueueFromDb, runQueueRefresh])

  useEffect(() => {
    const channel = supabase.channel('sgp-mat-req-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'material_requests' }, scheduleQueueRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'work_cards' }, scheduleWorkCardsRefresh)
      .subscribe()
    return () => {
      if (queueRefreshTimerRef.current) clearTimeout(queueRefreshTimerRef.current)
      if (workCardsRefreshTimerRef.current) clearTimeout(workCardsRefreshTimerRef.current)
      supabase.removeChannel(channel)
    }
  }, [scheduleQueueRefresh, scheduleWorkCardsRefresh])

  return { liveRequests, isRefreshingQueue, fetchQueueFromDb }
}
