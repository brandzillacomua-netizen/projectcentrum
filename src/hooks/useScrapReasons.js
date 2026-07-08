import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabase'

export const FALLBACK_SCRAP_REASONS = [
  'Биття цанги', 'Помилка програми', 'Збій станка', 'Кривизна листа',
  'Поломка флешки', "Прив'язка", 'Помилка оператора', 'Інше (коментар)'
]

export function useScrapReasons({ includeInactive = false } = {}) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    let query = supabase.from('scrap_reasons')
      .select('id,name,is_active,sort_order,created_at')
      .order('sort_order', { ascending: true }).order('name', { ascending: true })
    if (!includeInactive) query = query.eq('is_active', true)
    const { data, error } = await query
    if (!error) setRows(data || [])
    else console.warn('[Scrap reasons] Failed to load catalog:', error.message)
    setLoading(false)
  }, [includeInactive])

  useEffect(() => {
    reload()
    const channel = supabase.channel(`scrap-reasons-${includeInactive ? 'all' : 'active'}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scrap_reasons' }, reload).subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [includeInactive, reload])

  return {
    rows,
    names: rows.length ? rows.map(row => row.name) : FALLBACK_SCRAP_REASONS,
    loading,
    reload
  }
}
