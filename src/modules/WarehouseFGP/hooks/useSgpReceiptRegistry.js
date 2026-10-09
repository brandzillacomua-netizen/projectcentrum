import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../supabase'
import { buildSgpReceiptRegistry } from '../utils/sgpReceiptRegistry.js'

const RECEIPT_STAGE = 'Пакування/СГП'

export function useSgpReceiptRegistry({ workCards, tasks, orders, nomenclatures }) {
  const [receiptHistory, setReceiptHistory] = useState([])
  const [receiptCards, setReceiptCards] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchReceipts = useCallback(async () => {
    try {
      setIsLoading(true)

      const pageSize = 1000
      let allHistoryRows = []
      let offset = 0

      while (true) {
        const { data, error } = await supabase
          .from('work_card_history')
          .select('*')
          .or('stage_name.ilike.%пакування%,stage_name.ilike.%пакування%,stage_name.ilike.%сгп%')
          .gt('qty_completed', 0)
          .order('completed_at', { ascending: false })
          .range(offset, offset + pageSize - 1)

        if (error) throw error
        if (!data || data.length === 0) break
        allHistoryRows.push(...data)
        if (data.length < pageSize) break
        offset += pageSize
      }

      setReceiptHistory(allHistoryRows)

      const cardIds = [...new Set(allHistoryRows.map(row => row.card_id).filter(Boolean))]
      if (cardIds.length === 0) {
        setReceiptCards([])
        return
      }

      const batches = []
      for (let index = 0; index < cardIds.length; index += 100) {
        batches.push(cardIds.slice(index, index + 100))
      }
      const results = await Promise.all(batches.map(ids => supabase
        .from('work_cards')
        .select('id,task_id,order_id,nomenclature_id,operation,operator_name,card_info')
        .in('id', ids)))
      const cardsError = results.find(result => result.error)?.error
      if (cardsError) throw cardsError
      setReceiptCards(results.flatMap(result => result.data || []))
    } catch (error) {
      console.warn('[WarehouseFGP] Не вдалося завантажити реєстр надходжень СГП:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchReceipts()
    const channel = supabase
      .channel('sgp-receipt-registry-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'work_card_history' }, fetchReceipts)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'work_cards' }, fetchReceipts)
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchReceipts])

  const combinedCards = useMemo(() => {
    const byId = new Map((workCards || []).map(card => [String(card.id), card]))
    receiptCards.forEach(card => byId.set(String(card.id), { ...byId.get(String(card.id)), ...card }))
    return [...byId.values()]
  }, [workCards, receiptCards])

  const receiptRows = useMemo(() => buildSgpReceiptRegistry({
    history: receiptHistory,
    workCards: combinedCards,
    tasks,
    orders,
    nomenclatures
  }), [receiptHistory, combinedCards, tasks, orders, nomenclatures])

  return { receiptRows, isLoading, refreshReceipts: fetchReceipts }
}
