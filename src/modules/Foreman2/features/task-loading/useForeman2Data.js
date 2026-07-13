import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../../supabase.js'
import { asId, uniqueById } from '../../utils/normalize.js'
import { buildScrapModel, summarizeScrap } from '../scrap/scrapCalculations.js'
import { calculateTaskParts, summarizeTaskState } from '../shortage/shortageCalculations.js'
import { getOrderForTask, getTaskDisplayName, isRelevantForemanTask } from './taskSelectors.js'

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
  const allHistory = useMemo(() => uniqueById([...workCardHistory, ...dbHistory]), [workCardHistory, dbHistory])

  const scrapModel = useMemo(() => buildScrapModel(allCards, allHistory), [allCards, allHistory])

  const taskModels = useMemo(() => {
    return relevantTasks.map(task => {
      const order = getOrderForTask(task, orders, orderCache)
      const parts = calculateTaskParts({ task, cards: allCards, scrapModel, nomenclatures })
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
        scrapRows: taskScrapRows
      }
    })
  }, [relevantTasks, orders, orderCache, allCards, scrapModel, nomenclatures])

  const refreshForeman2 = async () => {
    setError(null)
    if (typeof fetchData === 'function') {
      await fetchData(['tasks', 'orders', 'material_requests'])
    }
    setReloadVersion(value => value + 1)
  }

  return {
    loading,
    error,
    taskModels,
    allCards,
    allHistory,
    scrapModel,
    refreshForeman2
  }
}
