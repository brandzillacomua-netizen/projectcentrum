import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { buildQualityLossIndex } from './qualityHoldModel.js'
import { fetchFinalScrapTotals } from './qualityHoldService.js'

export function useQualityLossTotals(supabase, taskIds = []) {
  const taskKey = useMemo(() => [...new Set(taskIds.filter(Boolean).map(String))].sort().join('|'), [taskIds])
  const [rows, setRows] = useState([])
  const [isAvailable, setIsAvailable] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const requestRef = useRef(0)

  const reload = useCallback(async () => {
    const requestId = ++requestRef.current
    const ids = taskKey ? taskKey.split('|') : []
    if (ids.length === 0) {
      setRows([])
      setIsAvailable(true)
      setError(null)
      return
    }

    setLoading(true)
    try {
      const nextRows = await fetchFinalScrapTotals(supabase, ids)
      if (requestRef.current !== requestId) return
      setRows(nextRows)
      setIsAvailable(true)
      setError(null)
    } catch (loadError) {
      if (requestRef.current !== requestId) return
      // During a rolling deployment the view may not exist yet. Consumers keep
      // using the legacy detected-scrap totals until the migration is present.
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
      .subscribe()
    return () => {
      if (timer) clearTimeout(timer)
      supabase.removeChannel(channel)
    }
  }, [supabase, taskKey, reload])

  const index = useMemo(() => buildQualityLossIndex(rows), [rows])
  return { rows, index, isAvailable, loading, error, reload }
}
