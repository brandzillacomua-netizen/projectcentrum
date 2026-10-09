import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { buildCurrentVkyaIndex, buildCurrentVkyaOrderIndex, buildQualityLossIndex } from './qualityHoldModel.js'
import { fetchCurrentVkyaItems, fetchFinalScrapTotals, fetchVkyaReturnedTotals, fetchObservedScrapTotals } from './qualityHoldService.js'

export function useQualityLossTotals(supabase, taskIds = [], { orderIds = [] } = {}) {
  const taskKey = useMemo(() => [...new Set(taskIds.filter(Boolean).map(String))].sort().join('|'), [taskIds])
  const orderKey = useMemo(() => [...new Set(orderIds.filter(Boolean).map(String))].sort().join('|'), [orderIds])
  const [rows, setRows] = useState([])
  const [returnedRows, setReturnedRows] = useState([])
  const [currentVkyaItems, setCurrentVkyaItems] = useState([])
  const [observedScrapRows, setObservedScrapRows] = useState([])
  const [isAvailable, setIsAvailable] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const requestRef = useRef(0)
  const loadedScopeRef = useRef('')
  const inFlightScopesRef = useRef(new Set())
  const scopeKey = `${taskKey}::${orderKey}`

  const reload = useCallback(async () => {
    if (inFlightScopesRef.current.has(scopeKey)) return
    inFlightScopesRef.current.add(scopeKey)
    const requestId = ++requestRef.current
    const ids = taskKey ? taskKey.split('|') : []
    const scopedOrderIds = orderKey ? orderKey.split('|') : []
    if (ids.length === 0 && scopedOrderIds.length === 0) {
      setRows([])
      setReturnedRows([])
      setCurrentVkyaItems([])
      setObservedScrapRows([])
      setIsAvailable(true)
      setError(null)
      setLoading(false)
      loadedScopeRef.current = scopeKey
      inFlightScopesRef.current.delete(scopeKey)
      return
    }

    if (loadedScopeRef.current !== scopeKey) setLoading(true)
    try {
      const [nextRows, nextReturned, nextCurrentVkyaItems, nextObserved] = await Promise.all([
        fetchFinalScrapTotals(supabase, ids, scopedOrderIds),
        fetchVkyaReturnedTotals(supabase, ids, scopedOrderIds).catch(() => []),
        fetchCurrentVkyaItems(supabase, ids, scopedOrderIds).catch(() => []),
        fetchObservedScrapTotals(supabase, ids, scopedOrderIds).catch(() => [])
      ])
      if (requestRef.current !== requestId) return
      setRows(nextRows)
      setReturnedRows(nextReturned)
      setCurrentVkyaItems(nextCurrentVkyaItems)
      setObservedScrapRows(nextObserved)
      setIsAvailable(true)
      setError(null)
      loadedScopeRef.current = scopeKey
    } catch (loadError) {
      if (requestRef.current !== requestId) return
      setIsAvailable(false)
      setError(loadError)
    } finally {
      inFlightScopesRef.current.delete(scopeKey)
      if (requestRef.current === requestId) setLoading(false)
    }
  }, [supabase, taskKey, orderKey, scopeKey])

  useEffect(() => {
    const timer = setTimeout(reload, 0)
    return () => clearTimeout(timer)
  }, [reload])

  useEffect(() => {
    if (!taskKey && !orderKey) return undefined
    let timer = null
    let lastReloadAt = 0
    const scheduleReload = () => {
      if (timer) clearTimeout(timer)
      const elapsed = Date.now() - lastReloadAt
      const delay = Math.max(1200, 4000 - elapsed)
      timer = setTimeout(() => {
        lastReloadAt = Date.now()
        reload()
      }, delay)
    }
    const channel = supabase
      .channel(`vkya-final-loss-${taskKey.length}-${taskKey.slice(-24)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scrap_classification_categories' }, scheduleReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vkya_quality_resolutions' }, scheduleReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vkya_classification_queue_projection' }, scheduleReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vkya_restoration_cards' }, scheduleReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vkya_scrap_lot_allocations' }, scheduleReload)
      .subscribe()
    return () => {
      if (timer) clearTimeout(timer)
      supabase.removeChannel(channel)
    }
  }, [supabase, taskKey, orderKey, reload])

  const index = useMemo(() => buildQualityLossIndex(rows), [rows])

  const returnedIndex = useMemo(() => {
    const byTask = {}
    ;(returnedRows || []).forEach(row => {
      const tid = String(row.task_id || '')
      const nid = String(row.nomenclature_id || '')
      if (!tid || !nid) return
      if (!byTask[tid]) byTask[tid] = {}
      byTask[tid][nid] = (byTask[tid][nid] || 0) + (Number(row.quantity) || 0)
    })
    return byTask
  }, [returnedRows])

  const pendingVkyaByTask = useMemo(() => buildCurrentVkyaIndex(currentVkyaItems), [currentVkyaItems])
  const pendingVkyaByOrder = useMemo(() => buildCurrentVkyaOrderIndex(currentVkyaItems), [currentVkyaItems])

  return { rows, returnedRows, currentVkyaItems, observedScrapRows, index, returnedIndex, pendingVkyaByTask, pendingVkyaByOrder, isAvailable, loading, error, reload }
}
