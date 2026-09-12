import { useState, useCallback, useEffect } from 'react'
import { supabase } from '../../../supabase'

export function useWarehouseRealtime(fetchData) {
  const [liveRequests, setLiveRequests] = useState(null)
  const [isRefreshingQueue, setIsRefreshingQueue] = useState(false)

  const fetchQueueFromDb = useCallback(async () => {
    setIsRefreshingQueue(true)
    try {
      if (typeof fetchData === 'function') {
        fetchData(['material_requests', 'inventory', 'orders', 'tasks', 'nomenclatures', 'work_cards'])
      }
      const { data, error } = await supabase
        .from('material_requests')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(300)
      if (!error && Array.isArray(data)) {
        setLiveRequests(data)
      }
    } catch (err) {
      console.warn('[WarehouseFGP] fetchQueueFromDb error:', err)
    } finally {
      setIsRefreshingQueue(false)
    }
  }, [fetchData])

  useEffect(() => {
    fetchQueueFromDb()
    const interval = setInterval(fetchQueueFromDb, 15000)
    return () => clearInterval(interval)
  }, [fetchQueueFromDb])

  useEffect(() => {
    const channel = supabase.channel('sgp-mat-req-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'material_requests' }, () => {
        fetchQueueFromDb()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'work_cards' }, () => {
        if (typeof fetchData === 'function') fetchData(['work_cards'])
      })
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchQueueFromDb, fetchData])

  return { liveRequests, isRefreshingQueue, fetchQueueFromDb }
}
