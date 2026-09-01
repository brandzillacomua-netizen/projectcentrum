import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../../supabase.js'
import { asId, uniqueById } from '../../utils/normalize.js'
import { buildScrapModel, summarizeScrap } from '../scrap/scrapCalculations.js'
import { calculateTaskParts, summarizeTaskState } from '../shortage/shortageCalculations.js'
import { getOrderForTask, getTaskDisplayName, isRelevantForemanTask } from './taskSelectors.js'
import { useQualityLossTotals } from '../../../VKYA/quality-hold/useQualityLossTotals.js'

const fetchHistoryForCards = async (cardIds) => {
  const rows = []
  const chunkSize = 25
  const pageSize = 1000
  for (let i = 0; i < cardIds.length; i += chunkSize) {
    const chunk = cardIds.slice(i, i + chunkSize)
    for (let from = 0; ; from += pageSize) {
      const to = from + pageSize - 1
      const { data, error } = await supabase
        .from('work_card_history')
        .select('id,card_id,nomenclature_id,scrap_qty,stage_name,operator_name,qty_at_start,qty_completed,created_at,completed_at')
        .in('card_id', chunk)
        .order('created_at', { ascending: true })
        .range(from, to)
      if (error) throw error
      rows.push(...(data || []))
      if (!data || data.length < pageSize) break
    }
  }
  return Array.from(new Map(rows.filter(Boolean).map(row => [String(row.id), row])).values())
}

export function useForeman2Data({ mes }) {
  const {
    tasks = [],
    orders = [],
    workCards = [],
    workCardHistory = [],
    nomenclatures = [],
    workCardScrapTotals = [],
    workCardFlowTotals = [],
    fetchData
  } = mes

  const [dbCards, setDbCards] = useState([])
  const [dbHistory, setDbHistory] = useState([])
  const [orderCache, setOrderCache] = useState({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [reloadVersion, setReloadVersion] = useState(0)

  const relevantTasks = useMemo(() => {
    return tasks
      .filter(isRelevantForemanTask)
      .sort((a, b) => {
        if (a.status === 'completed' && b.status !== 'completed') return 1
        if (a.status !== 'completed' && b.status === 'completed') return -1
        return new Date(b.created_at || 0) - new Date(a.created_at || 0)
      })
  }, [tasks])

  const qualityLossTaskIds = useMemo(() => relevantTasks.map(task => task.id).filter(Boolean), [relevantTasks])
  const qualityLoss = useQualityLossTotals(supabase, qualityLossTaskIds)

  const taskIdKey = useMemo(() => relevantTasks.map(task => asId(task.id)).sort().join('|'), [relevantTasks])

  useEffect(() => {
    if (typeof fetchData === 'function') {
      fetchData(['tasks', 'orders', 'nomenclatures', 'machines', 'material_requests']).catch(() => {})
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      if (relevantTasks.length === 0) {
        setDbCards([])
        setDbHistory([])
        return
      }

      setLoading(true)
      setError(null)
      try {
        const taskIds = relevantTasks.map(task => task.id)
        const { data: cards, error: cardsError } = await supabase
          .from('work_cards')
          .select('*')
          .in('task_id', taskIds)
          .limit(10000)
        if (cardsError) throw cardsError

        const cardIds = (cards || []).map(card => card.id)
        const history = cardIds.length > 0 ? await fetchHistoryForCards(cardIds) : []

        if (!cancelled) {
          setDbCards(cards || [])
          setDbHistory(history)
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Не вдалося завантажити Foreman2')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [taskIdKey, reloadVersion])

  useEffect(() => {
    let cancelled = false
    const knownIds = new Set([
      ...orders.map(order => asId(order.id)),
      ...Object.keys(orderCache).map(asId)
    ])
    const missingOrderIds = [...new Set(relevantTasks.map(task => asId(task.order_id)).filter(Boolean))]
      .filter(orderId => !knownIds.has(orderId))

    if (missingOrderIds.length === 0) return undefined

    supabase
      .from('orders')
      .select('*, order_items(*)')
      .in('id', missingOrderIds)
      .then(({ data }) => {
        if (cancelled || !data) return
        setOrderCache(prev => {
          const next = { ...prev }
          data.forEach(order => { next[asId(order.id)] = order })
          return next
        })
      })

    return () => { cancelled = true }
  }, [relevantTasks, orders, orderCache])

  const allCards = useMemo(() => uniqueById([...workCards, ...dbCards]), [workCards, dbCards])
  
  const scrapTotalsHistoryRows = useMemo(() => {
    return (workCardScrapTotals || [])
      .filter(row => (Number(row.total_scrap) || 0) > 0)
      .map(row => ({
        id: `scrap-total-${row.id || `${row.card_id}-${row.nomenclature_id}`}`,
        card_id: row.card_id,
        task_id: row.task_id,
        order_id: row.order_id,
        nomenclature_id: row.nomenclature_id,
        scrap_qty: Number(row.total_scrap) || 0,
        created_at: row.last_scrap_at || row.updated_at,
        completed_at: row.last_scrap_at || row.updated_at,
        is_scrap_total: true
      }))
  }, [workCardScrapTotals])

  const flowScrapHistoryRows = useMemo(() => {
    return (workCardFlowTotals || [])
      .filter(row => (Number(row.total_scrap) || 0) > 0)
      .map(row => ({
        id: `flow-scrap-total-${row.id || `${row.card_id}-${row.nomenclature_id}-${row.stage_name}`}`,
        card_id: row.card_id,
        task_id: row.task_id,
        order_id: row.order_id,
        nomenclature_id: row.nomenclature_id,
        scrap_qty: Number(row.total_scrap) || 0,
        created_at: row.last_event_at || row.updated_at,
        completed_at: row.last_event_at || row.updated_at,
        is_scrap_total: true,
        stage_name: row.stage_name,
        operator_name: row.operator_name
      }))
  }, [workCardFlowTotals])

  const totalsHistoryRows = useMemo(() => {
    return scrapTotalsHistoryRows.length > 0 ? scrapTotalsHistoryRows : flowScrapHistoryRows
  }, [scrapTotalsHistoryRows, flowScrapHistoryRows])

  const allHistory = useMemo(() => {
    const historyMap = new Map()
    // Always include detailed history logs from dbHistory / workCardHistory
    ;[...workCardHistory, ...dbHistory].forEach(row => {
      if (!row) return
      const key = String(row.id || `${row.card_id}-${row.created_at}`)
      historyMap.set(key, row)
    })
    const existingCardIds = new Set(Array.from(historyMap.values()).map(r => String(r.card_id)).filter(Boolean))
    // Append totals history rows ONLY for cards without detailed history rows
    totalsHistoryRows.forEach(row => {
      if (!row) return
      if (row.card_id && existingCardIds.has(String(row.card_id))) return
      const key = String(row.id || `total-${row.card_id}-${row.nomenclature_id}`)
      if (!historyMap.has(key)) {
        historyMap.set(key, row)
      }
    })
    return Array.from(historyMap.values())
  }, [workCardHistory, dbHistory, totalsHistoryRows])

  const scrapModel = useMemo(() => buildScrapModel(allCards, allHistory), [allCards, allHistory])

  const flowTotalsByTaskNom = useMemo(() => {
    const cache = {}
    ;(workCardFlowTotals || []).forEach(row => {
      const tid = row.task_id
      const nid = row.nomenclature_id ? String(row.nomenclature_id) : null
      if (!tid || !nid) return
      if (!cache[tid]) cache[tid] = {}
      if (!cache[tid][nid]) cache[tid][nid] = []
      cache[tid][nid].push(row)
    })
    return cache
  }, [workCardFlowTotals])

  const taskModels = useMemo(() => {
    return relevantTasks.map(task => {
      const order = getOrderForTask(task, orders, orderCache)
      const parts = calculateTaskParts({
        task,
        cards: allCards,
        scrapModel,
        nomenclatures,
        flowTotalsByTaskNom,
        finalScrapByTask: qualityLoss.index.byTask,
        vkyaReturnedByTask: qualityLoss.returnedIndex,
        hasFinalScrapProjection: qualityLoss.isAvailable
      })
      const summary = summarizeTaskState({ task, cards: allCards, parts })
      const taskScrapRows = scrapModel.scrapRows.filter(row => asId(row.taskId) === asId(task.id))
      const scrapSummary = summarizeScrap(taskScrapRows, nomenclatures)

      return {
        id: asId(task.id),
        task,
        order,
        title: getTaskDisplayName(task, order),
        parts,
        summary,
        scrapSummary,
        scrapRows: taskScrapRows,
        isLoading: loading || qualityLoss.loading
      }
    })
  }, [relevantTasks, orders, orderCache, allCards, scrapModel, nomenclatures, flowTotalsByTaskNom, qualityLoss.index, qualityLoss.returnedIndex, qualityLoss.isAvailable, loading, qualityLoss.loading])

  const refreshForeman2 = async () => {
    setError(null)
    if (typeof fetchData === 'function') {
      await fetchData(['tasks', 'orders', 'material_requests'])
    }
    setReloadVersion(value => value + 1)
  }

  return {
    loading: loading || qualityLoss.loading,
    error,
    taskModels,
    allCards,
    allHistory,
    scrapModel,
    nomenclatures,
    refreshForeman2
  }
}
