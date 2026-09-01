import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { buildQualityLossIndex } from './qualityHoldModel.js'
import { fetchFinalScrapTotals, fetchVkyaReturnedTotals } from './qualityHoldService.js'

export function useQualityLossTotals(supabase, taskIds = []) {
  const taskKey = useMemo(() => [...new Set(taskIds.filter(Boolean).map(String))].sort().join('|'), [taskIds])
  const [rows, setRows] = useState([])
  const [returnedRows, setReturnedRows] = useState([])
  const [isAvailable, setIsAvailable] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const requestRef = useRef(0)

  const reload = useCallback(async () => {
    const requestId = ++requestRef.current
    const ids = taskKey ? taskKey.split('|') : []
    if (ids.length === 0) {
      setRows([])
      setReturnedRows([])
      setIsAvailable(true)
      setError(null)
      return
    }

    setLoading(true)
    try {
      const [nextRows, nextReturned] = await Promise.all([
        fetchFinalScrapTotals(supabase, ids),
        fetchVkyaReturnedTotals(supabase, ids).catch(() => [])
      ])
      if (requestRef.current !== requestId) return
      setRows(nextRows)
      setReturnedRows(nextReturned)
      setIsAvailable(true)
      setError(null)
    } catch (loadError) {
      if (requestRef.current !== requestId) return
      setIsAvailable(false)
      setError(loadError)
    } finally {
      if (requestRef.current === requestId) setLoading(false)
    }
  }, [supabase, taskKey])

  useEffect(() => {
    const timer = setTimeout(reload, 0)
    return () => clearTimeout(timer)
  }, [reload])

  useEffect(() => {
    if (!taskKey) return undefined
    let timer = null
    const scheduleReload = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(reload, 250)
    }
    const channel = supabase
      .channel(`vkya-final-loss-${taskKey.length}-${taskKey.slice(-24)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scrap_classification_categories' }, scheduleReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vkya_quality_resolutions' }, scheduleReload)
      .subscribe()
    return () => {
      if (timer) clearTimeout(timer)
      supabase.removeChannel(channel)
    }
  }, [supabase, taskKey, reload])

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

  return { rows, returnedRows, index, returnedIndex, isAvailable, loading, error, reload }
}
