import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../../../supabase'
import { buildSgpReceiptRegistry, isSgpReceiptHistory } from '../utils/sgpReceiptRegistry.js'

// Скільки записів тягнемо за один раз з кожного джерела
const CHUNK = 200
const CARD_COLS = 'id,task_id,order_id,nomenclature_id,operation,operator_name,card_info,status,quantity,completed_at,updated_at,created_at,is_rework'
const HISTORY_FILTER = 'stage_name.ilike.%пакування%,stage_name.ilike.%сгп%'

const upsertById = (prev, rows) => {
  if (!rows || rows.length === 0) return prev
  const map = new Map(prev.map(r => [String(r.id), r]))
  rows.forEach(r => map.set(String(r.id), { ...map.get(String(r.id)), ...r }))
  return [...map.values()]
}

export function useSgpReceiptRegistry({ workCards, tasks, orders, nomenclatures }) {
  const [receiptHistory, setReceiptHistory] = useState([])
  const [receiptCards, setReceiptCards] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [totalCount, setTotalCount] = useState(null)

  // Точна загальна кількість з бази (без завантаження рядків)
  const fetchTotalCount = useCallback(async () => {
    const { data, error } = await supabase.rpc('count_sgp_receipts')
    if (!error && data != null) {
      setTotalCount(Number(data))
      return
    }
    // Fallback, якщо міграція ще не застосована: наближено (можливий перетин)
    const [h, c] = await Promise.all([
      supabase.from('work_card_history').select('id', { count: 'exact', head: true }).or(HISTORY_FILTER).gt('qty_completed', 0),
      supabase.from('work_cards').select('id', { count: 'exact', head: true }).eq('status', 'completed').not('operation', 'ilike', '%склад бз%').not('operation', 'ilike', '%сгп%').not('operation', 'ilike', '%пакування/сгп%')
    ])
    if (!h.error && !c.error) setTotalCount((h.count || 0) + (c.count || 0))
  }, [])

  // Курсори: найстаріший завантажений момент для кожного джерела
  const cursorRef = useRef({ history: null, cards: null, historyDone: false, cardsDone: false })
  const loadingRef = useRef(false)

  // Підтягнути картки, на які посилаються записи історії (лише відсутні)
  const fetchMissingCards = useCallback(async (historyRows, knownCards) => {
    const known = new Set(knownCards.map(c => String(c.id)))
    const ids = [...new Set(historyRows.map(r => r.card_id).filter(Boolean).map(String))].filter(id => !known.has(id))
    if (ids.length === 0) return []
    const batches = []
    for (let i = 0; i < ids.length; i += 100) batches.push(ids.slice(i, i + 100))
    const results = await Promise.all(batches.map(b => supabase.from('work_cards').select(CARD_COLS).in('id', b)))
    const err = results.find(r => r.error)?.error
    if (err) throw err
    return results.flatMap(r => r.data || [])
  }, [])

  const loadChunk = useCallback(async ({ reset = false } = {}) => {
    if (loadingRef.current) return
    loadingRef.current = true
    const cur = cursorRef.current
    if (reset) Object.assign(cur, { history: null, cards: null, historyDone: false, cardsDone: false })
    reset ? setIsLoading(true) : setIsLoadingMore(true)

    try {
      let hQuery = supabase.from('work_card_history').select('*')
        .or(HISTORY_FILTER).gt('qty_completed', 0)
        .order('completed_at', { ascending: false }).limit(CHUNK)
      if (cur.history) hQuery = hQuery.lt('completed_at', cur.history)

      let cQuery = supabase.from('work_cards').select(CARD_COLS)
        .eq('status', 'completed')
        .order('updated_at', { ascending: false }).limit(CHUNK)
      if (cur.cards) cQuery = cQuery.lt('updated_at', cur.cards)

      const [hRes, cRes] = await Promise.all([
        cur.historyDone ? Promise.resolve({ data: [] }) : hQuery,
        cur.cardsDone ? Promise.resolve({ data: [] }) : cQuery
      ])
      if (hRes.error) throw hRes.error
      if (cRes.error) throw cRes.error

      const hRows = hRes.data || []
      const cRows = cRes.data || []
      if (hRows.length < CHUNK) cur.historyDone = true
      if (cRows.length < CHUNK) cur.cardsDone = true
      if (hRows.length) cur.history = hRows[hRows.length - 1].completed_at
      if (cRows.length) cur.cards = cRows[cRows.length - 1].updated_at

      const extraCards = await fetchMissingCards(hRows, cRows)

      setReceiptHistory(prev => upsertById(reset ? [] : prev, hRows))
      setReceiptCards(prev => upsertById(reset ? [] : prev, [...cRows, ...extraCards]))
      setHasMore(!(cur.historyDone && cur.cardsDone))
    } catch (error) {
      console.warn('[WarehouseFGP] Не вдалося завантажити реєстр надходжень СГП:', error)
    } finally {
      loadingRef.current = false
      setIsLoading(false)
      setIsLoadingMore(false)
    }
  }, [fetchMissingCards])

  const loadMore = useCallback(() => {
    if (hasMore) loadChunk()
  }, [hasMore, loadChunk])

  useEffect(() => {
    loadChunk({ reset: true })
    fetchTotalCount()
    let countTimer = null
    const scheduleCount = () => {
      clearTimeout(countTimer)
      countTimer = setTimeout(fetchTotalCount, 2000)
    }

    // Realtime: лише точкові зміни, без повного перезавантаження
    const channel = supabase
      .channel('sgp-receipt-registry-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'work_card_history' }, async ({ new: row }) => {
        if (!row || !isSgpReceiptHistory(row)) return
        setReceiptHistory(prev => upsertById(prev, [row]))
        if (row.card_id) {
          const { data } = await supabase.from('work_cards').select(CARD_COLS).eq('id', row.card_id).maybeSingle()
          if (data) setReceiptCards(prev => upsertById(prev, [data]))
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'work_cards' }, ({ new: card, old }) => {
        if (!card) return
        if (card.status === 'completed') {
          setReceiptCards(prev => upsertById(prev, [card]))
        } else if (old?.status === 'completed' || card.status !== 'completed') {
          // Картку повернули з completed — прибираємо з реєстру
          setReceiptCards(prev => prev.some(c => String(c.id) === String(card.id) && c.status === 'completed')
            ? prev.filter(c => String(c.id) !== String(card.id))
            : prev)
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'work_cards' }, ({ new: card }) => {
        if (card?.status === 'completed') setReceiptCards(prev => upsertById(prev, [card]))
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'work_cards' }, ({ old }) => {
        if (old?.id) setReceiptCards(prev => prev.filter(c => String(c.id) !== String(old.id)))
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'work_cards' }, ({ new: card, old }) => {
        if (card?.status === 'completed' || old?.status === 'completed' || !card) scheduleCount()
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'work_card_history' }, scheduleCount)
      .subscribe()

    return () => {
      clearTimeout(countTimer)
      supabase.removeChannel(channel)
    }
  }, [loadChunk, fetchTotalCount])

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

  return {
    receiptRows,
    isLoading,
    isLoadingMore,
    hasMore,
    totalCount,
    loadMore,
    refreshReceipts: () => { fetchTotalCount(); return loadChunk({ reset: true }) }
  }
}
