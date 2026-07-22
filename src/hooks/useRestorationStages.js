import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabase'

export function useRestorationStages({ includeInactive = false } = {}) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    let query = supabase.from('vkya_restoration_stages').select('*')
      .order('sort_order', { ascending: true }).order('name', { ascending: true })
    if (!includeInactive) query = query.eq('is_active', true)
    const { data, error } = await query
    if (!error) setRows(data || [])
    else console.warn('[VKYA restoration stages] Failed to load catalog:', error.message)
    setLoading(false)
  }, [includeInactive])

  useEffect(() => {
    const timer = window.setTimeout(reload, 0)
    const channel = supabase.channel(`vkya-restoration-stages-${includeInactive ? 'all' : 'active'}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vkya_restoration_stages' }, reload).subscribe()
    return () => { window.clearTimeout(timer); supabase.removeChannel(channel) }
  }, [includeInactive, reload])

  return { rows, loading, reload }
}
