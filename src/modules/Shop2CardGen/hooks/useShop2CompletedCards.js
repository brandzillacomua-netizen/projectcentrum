import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../../supabase'

const COMPLETED_CARD_FIELDS = '*'

export function useShop2CompletedCards() {
  const [completedCards, setCompletedCards] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  const reload = useCallback(async () => {
    try {
      setIsLoading(true)

      const fetchAllChunks = async (queryBuilder) => {
        const pageSize = 1000
        let allRows = []
        let offset = 0
        while (true) {
          const { data, error } = await queryBuilder(offset, offset + pageSize - 1)
          if (error) throw error
          if (!data || data.length === 0) break
          allRows.push(...data)
          if (data.length < pageSize) break
          offset += pageSize
        }
        return allRows
      }

      const completedRows = await fetchAllChunks((from, to) =>
        supabase
          .from('work_cards')
          .select(COMPLETED_CARD_FIELDS)
          .eq('status', 'completed')
          .order('completed_at', { ascending: false })
          .range(from, to)
      )

      const uniqueCards = new Map()
      completedRows.forEach(card => {
        uniqueCards.set(String(card.id), card)
      })

      const sortedCards = [...uniqueCards.values()].sort((a, b) => (
        new Date(b.completed_at || b.created_at || 0).getTime() -
        new Date(a.completed_at || a.created_at || 0).getTime()
      ))

      setCompletedCards(sortedCards)
    } catch (error) {
      console.warn('[Shop2CardGen] Не вдалося завантажити архів виконаних карток:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    reload()
    const channel = supabase
      .channel('shop2-completed-cards-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'work_cards' }, reload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'work_card_history' }, reload)
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [reload])

  return { completedCards, isLoading, reload }
}
