import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabase'

/**
 * Fetches complete `work_card_history` rows for a specific set of active card IDs
 * (bypassing the global store's 500-row cap) and merges them with live store history.
 */
export function useActiveCardsHistory(cardIds, fallbackHistory = [], { enabled = true } = {}) {
  const [fetchedRows, setFetchedRows] = useState([])

  const cardIdsKey = useMemo(() => {
    if (!enabled) return ''
    return Array.from(new Set((cardIds || []).filter(Boolean).map(String)))
      .sort()
      .join(',')
  }, [cardIds, enabled])

  useEffect(() => {
    let cancelled = false
    const ids = cardIdsKey ? cardIdsKey.split(',').filter(Boolean) : []
    if (!enabled || ids.length === 0) {
      setFetchedRows([])
      return () => { cancelled = true }
    }

    const load = async () => {
      try {
        const chunkSize = 40
        const pageSize = 1000
        const allRows = []

        for (let i = 0; i < ids.length; i += chunkSize) {
          const chunk = ids.slice(i, i + chunkSize)
          for (let from = 0; ; from += pageSize) {
            const { data, error } = await supabase
              .from('work_card_history')
              .select('*')
              .in('card_id', chunk)
              .order('created_at', { ascending: true })
              .range(from, from + pageSize - 1)

            if (error) throw error
            allRows.push(...(data || []))
            if (!data || data.length < pageSize) break
          }
        }

        if (!cancelled) setFetchedRows(allRows)
      } catch (err) {
        console.error('Failed to load active cards full history:', err)
      }
    }

    load()
    return () => { cancelled = true }
  }, [cardIdsKey, enabled])

  return useMemo(() => {
    if (!fetchedRows.length) return fallbackHistory || []
    const byId = new Map()
    for (const row of fetchedRows) {
      if (row?.id) byId.set(String(row.id), row)
    }
    for (const row of fallbackHistory || []) {
      if (row?.id) byId.set(String(row.id), { ...byId.get(String(row.id)), ...row })
    }
    return Array.from(byId.values())
  }, [fetchedRows, fallbackHistory])
}
