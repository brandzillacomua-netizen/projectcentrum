import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { useMES } from '../../../MESContext'
import { supabase } from '../../../supabase'
import { useQualityLossTotals } from '../../VKYA/quality-hold/useQualityLossTotals.js'
import {
  fetchWorkCardHistoryByCardIds,
  fetchWorkCardsByTaskIds,
  isVkyaCard,
  resolveCardOrder
} from '../utils/foremanDashboardHelpers.jsx'
import {
  calculateCurrentVkyaQuantity,
  calculateTerminalMetrics,
  getConfirmedSgpCardQuantity,
  getConfirmedSgpFromCards,
  getConfirmedSgpFromFlow,
  getForemanTaskScopeKey,
  isBzReservationCard
} from '../utils/foremanDashboardMetrics.js'

export const useForemanDashboardData = () => {
  const {
    currentUser, workCards, inventory, nomenclatures, fetchData,
    orders, bomItems, tasks, workCardHistory, workCardScrapTotals = [], workCardFlowTotals = [], fetchModuleData
  } = useMES()

  const [selectedTaskId, setSelectedTaskId] = useState(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedBottlenecks, setExpandedBottlenecks] = useState({})
  const [selectedCellModal, setSelectedCellModal] = useState(null)
  const [inspectCardModal, setInspectCardModal] = useState(null)

  // Extra state for per-order drill-down
  const [orderAllCards, setOrderAllCards] = useState({}) // taskId -> cards[]
  const [loadingCards, setLoadingCards] = useState({})
  const qualityLossTaskIds = useMemo(() => tasks.map(task => task.id).filter(Boolean), [tasks])
  const qualityLossOrderIds = useMemo(() => tasks.map(task => task.order_id).filter(Boolean), [tasks])
  const qualityLoss = useQualityLossTotals(supabase, qualityLossTaskIds, { orderIds: qualityLossOrderIds })
  const sourceRefreshTimerRef = useRef(null)
  const sourceRefreshPromiseRef = useRef(null)

  const refreshSourceData = useCallback(async () => {
    if (sourceRefreshPromiseRef.current) return sourceRefreshPromiseRef.current

    const refreshPromise = (async () => {
      if (typeof fetchModuleData === 'function') {
        await fetchModuleData('/foreman-dashboard')
        return
      }
      if (typeof fetchData === 'function') {
        await fetchData(['orders', 'tasks', 'inventory', 'work_cards', 'nomenclatures', 'bom_items', 'work_card_scrap_totals', 'work_card_flow_totals'])
      }
    })()

    sourceRefreshPromiseRef.current = refreshPromise
    try {
      await refreshPromise
    } finally {
      if (sourceRefreshPromiseRef.current === refreshPromise) sourceRefreshPromiseRef.current = null
    }
  }, [fetchData, fetchModuleData])

  // ── Load data on mount & Realtime subscription ──
  useEffect(() => {
    refreshSourceData()

    const scheduleSourceRefresh = () => {
      if (sourceRefreshTimerRef.current) clearTimeout(sourceRefreshTimerRef.current)
      sourceRefreshTimerRef.current = setTimeout(() => {
        sourceRefreshTimerRef.current = null
        refreshSourceData()
      }, 900)
    }

    const channel = supabase
      .channel('foreman_dashboard_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'work_cards' }, () => {
        scheduleSourceRefresh()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
        scheduleSourceRefresh()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'work_card_history' }, () => {
        scheduleSourceRefresh()
      })
      .subscribe()

    return () => {
      if (sourceRefreshTimerRef.current) clearTimeout(sourceRefreshTimerRef.current)
      supabase.removeChannel(channel)
    }
  }, [refreshSourceData])

  // ── Orders map ──
  const ordersMap = useMemo(() => {
    const m = {}
    orders.forEach(o => { m[o.id] = o })
    return m
  }, [orders])

  // ── Global taskParentMap — task_id → parent nomenclature_id (string) ──
  const globalTaskParentMap = useMemo(() => {
    const m = {}
    tasks.forEach(task => {
      const o = ordersMap[task.order_id]
      if (!o) return
      const pId = o.nomenclature_id || o.order_items?.[0]?.nomenclature_id
      if (pId) m[task.id] = String(pId)
    })
    return m
  }, [tasks, ordersMap])

  // Extra state for per-order drill-down and overall WIP
  const [allTasksCards, setAllTasksCards] = useState([])
  const [allCardsHistory, setAllCardsHistory] = useState([])
  const [loadingAllData, setLoadingAllData] = useState(false)

  const dashboardCards = useMemo(() => {
    return Array.from(new Map([...(workCards || []), ...(allTasksCards || [])].filter(Boolean).map(card => [String(card.id), card])).values())
  }, [workCards, allTasksCards])

  // ── Task scope map (task_id -> array of task_ids for the same order) ──
  const taskScopeIdsMap = useMemo(() => {
    const map = {}
    tasks.forEach(task => {
      const scopeKey = getForemanTaskScopeKey(task)
      const scopedIds = tasks
        .filter(t => getForemanTaskScopeKey(t) === scopeKey)
        .map(t => t.id)
        .filter(Boolean)
      map[task.id] = scopedIds.length > 0 ? scopedIds : [task.id]
    })
    return map
  }, [tasks])

  // ── relevantTasks ──
  const relevantTasks = useMemo(() => {
    const primaryTaskMap = new Map()

    tasks.forEach(t => {
      const orderKey = getForemanTaskScopeKey(t)
      const existing = primaryTaskMap.get(orderKey)
      const stepName = (t.step || '').toLowerCase()
      const isLaser = stepName.includes('розкрій') || stepName.includes('різка') || !t.step

      if (!existing) {
        primaryTaskMap.set(orderKey, t)
      } else {
        const existingStep = (existing.step || '').toLowerCase()
        const existingIsLaser = existingStep.includes('розкрій') || existingStep.includes('різка') || !existing.step
        if (!existingIsLaser && isLaser) {
          primaryTaskMap.set(orderKey, t)
        }
      }
    })

    const primaryTasks = Array.from(primaryTaskMap.values())

    return primaryTasks.filter(t => {
      const stepName = (t.step || '').toLowerCase()
      const isLaser = stepName.includes('розкрій') || stepName.includes('різка') || !t.step

      const scopeIds = taskScopeIdsMap[t.id] || [t.id]
      const orderIds = [t.order_id].filter(Boolean)
      const hasUnfinishedCards = (dashboardCards || []).some(c => {
        const matchesTaskOrOrder = (c.task_id && scopeIds.includes(c.task_id)) || (c.order_id && orderIds.includes(c.order_id))
        if (!matchesTaskOrOrder) return false
        if (c.operation === 'Склад БЗ') return false
        return c.status !== 'completed'
      })
      if (hasUnfinishedCards) return true

      const hasActiveShop2Task = tasks.some(s2 =>
        getForemanTaskScopeKey(s2) === getForemanTaskScopeKey(t) &&
        (s2.step?.includes('Пресування') || s2.step?.includes('ЦЕХ №2') || s2.step?.includes('Доопрацювання')) &&
        s2.status !== 'completed'
      )

      if (t.status !== 'completed' || hasActiveShop2Task) {
        return (t.warehouse_conf === 'true' || t.warehouse_conf === 'partial') && t.engineer_conf && t.director_conf && isLaser
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps, no-restricted-globals, react-hooks/purity
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
      const isRecent = (t.completed_at && new Date(t.completed_at) > threeDaysAgo) ||
        (t.updated_at && new Date(t.updated_at) > threeDaysAgo)
      return isRecent && isLaser
    }).sort((a, b) => {
      if (a.status === 'completed' && b.status !== 'completed') return 1
      if (a.status !== 'completed' && b.status === 'completed') return -1
      return new Date(b.created_at) - new Date(a.created_at)
    })
  }, [tasks, dashboardCards, taskScopeIdsMap])

  // ── Active (non-completed) tasks ──
  const activeTasks = useMemo(() => {
    return relevantTasks.filter(t => {
      const scopeIds = taskScopeIdsMap[t.id] || [t.id]
      const orderIds = [t.order_id].filter(Boolean)
      const hasUnfinishedCards = (dashboardCards || []).some(c => {
        const matchesTaskOrOrder = (c.task_id && scopeIds.includes(c.task_id)) || (c.order_id && orderIds.includes(c.order_id))
        if (!matchesTaskOrOrder) return false
        if (c.operation === 'Склад БЗ') return false
        return c.status !== 'completed'
      })
      if (hasUnfinishedCards) return true

      if (t.status !== 'completed') return true
      const hasActiveShop2Task = tasks.some(s2 =>
        getForemanTaskScopeKey(s2) === getForemanTaskScopeKey(t) &&
        (s2.step?.includes('Пресування') || s2.step?.includes('ЦЕХ №2') || s2.step?.includes('Доопрацювання')) &&
        s2.status !== 'completed'
      )
      return hasActiveShop2Task
    })
  }, [relevantTasks, tasks, dashboardCards, taskScopeIdsMap])

  const flowTotalsRows = useMemo(() => {
    return (workCardFlowTotals || []).filter(Boolean)
  }, [workCardFlowTotals])

  const flowTotalsByTaskNom = useMemo(() => {
    const cache = {}
    flowTotalsRows.forEach(row => {
      const tid = row.task_id
      const nid = row.nomenclature_id ? String(row.nomenclature_id) : null
      if (!tid || !nid) return
      if (!cache[tid]) cache[tid] = {}
      if (!cache[tid][nid]) cache[tid][nid] = []
      cache[tid][nid].push(row)
    })
    return cache
  }, [flowTotalsRows])

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
    return flowTotalsRows
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
        is_scrap_total: true
      }))
  }, [flowTotalsRows])

  const totalsHistoryRows = useMemo(() => {
    return scrapTotalsHistoryRows.length > 0 ? scrapTotalsHistoryRows : flowScrapHistoryRows
  }, [scrapTotalsHistoryRows, flowScrapHistoryRows])

  const dashboardHistory = useMemo(() => {
    const sourceRows = [
      ...(totalsHistoryRows || []),
      ...(workCardHistory || []),
      ...(allCardsHistory || [])
    ]
    return Array.from(new Map(sourceRows.filter(Boolean).map((row, index) => [String(row.id || `${row.card_id}-${row.created_at || row.completed_at || index}`), row])).values())
  }, [workCardHistory, allCardsHistory, totalsHistoryRows])

  // Aggregated card totals are authoritative when available. Mixing them with
  // their underlying history events would count the same defect twice.
  const observedScrapRows = useMemo(() => (
    totalsHistoryRows.length > 0 ? totalsHistoryRows : dashboardHistory
  ), [totalsHistoryRows, dashboardHistory])

  const loadAllTasksCards = async (taskList) => {
    if (!taskList || taskList.length === 0) {
      setAllTasksCards([])
      setAllCardsHistory([])
      return
    }
    try {
      const requestedScopeKeys = new Set(taskList.map(getForemanTaskScopeKey))
      const scopedTaskIds = tasks
        .filter(t => requestedScopeKeys.has(getForemanTaskScopeKey(t)))
        .map(t => t.id)

      const taskIds = scopedTaskIds.length > 0 ? scopedTaskIds : taskList.map(t => t.id)
      const cards = await fetchWorkCardsByTaskIds(taskIds, 'id, task_id, nomenclature_id, status, quantity, operation, used_in_shop2_qty, card_info, created_at')

      if (cards) {
        setAllTasksCards(cards)
        const cardIds = cards.map(c => c.id)
        if (cardIds.length > 0) {
          const history = await fetchWorkCardHistoryByCardIds(cardIds)
          setAllCardsHistory(history)
        } else {
          setAllCardsHistory([])
        }
      }
    } catch (e) {
      console.error(e)
    }
  }

  // ── Load all cards and history for all relevant tasks ──
  useEffect(() => {
    setLoadingAllData(true)
    loadAllTasksCards(relevantTasks).finally(() => setLoadingAllData(false))
  }, [relevantTasks, totalsHistoryRows.length])

  // ── Load all cards for a specific task (for drill-down) ──
  useEffect(() => {
    if (!selectedTaskId) return
    if (orderAllCards[selectedTaskId]) return // already loaded
    setLoadingCards(prev => ({ ...prev, [selectedTaskId]: true }))
    fetchWorkCardsByTaskIds(taskScopeIdsMap[selectedTaskId] || [selectedTaskId], '*')
      .then(data => {
        setOrderAllCards(prev => ({ ...prev, [selectedTaskId]: data || [] }))
        setLoadingCards(prev => ({ ...prev, [selectedTaskId]: false }))
      })
      .catch(error => {
        console.error(error)
        setLoadingCards(prev => ({ ...prev, [selectedTaskId]: false }))
      })
  }, [selectedTaskId, taskScopeIdsMap])

  // ── Index cards by task_id for O(1) lookups ──
  const cardsByTaskId = useMemo(() => {
    const map = {}
    dashboardCards.forEach(c => {
      if (!map[c.task_id]) map[c.task_id] = []
      map[c.task_id].push(c)
    })
    return map
  }, [dashboardCards])


  // ── Production cache ──
  const productionCache = useMemo(() => {
    const cache = {}

    relevantTasks.forEach(task => {
      cache[task.id] = {}
      const scopeIds = taskScopeIdsMap[task.id] || [task.id]
      const taskCards = scopeIds.flatMap(taskId => cardsByTaskId[taskId] || [])
      const snapshot = task.plan_snapshot || {}

      Object.keys(snapshot).forEach(nid => {
        const nomCards = taskCards.filter(c => String(c.nomenclature_id) === nid)
        const flowRows = scopeIds.flatMap(taskId => flowTotalsByTaskNom[taskId]?.[nid] || [])
        const confirmedFromFlow = getConfirmedSgpFromFlow(flowRows, nomCards)
        cache[task.id][nid] = confirmedFromFlow > 0
          ? confirmedFromFlow
          : getConfirmedSgpFromCards(nomCards)
      })
    })
    return cache
  }, [cardsByTaskId, relevantTasks, flowTotalsByTaskNom, taskScopeIdsMap])

  // ── Observed Scrap cache (all defects logged in history indexed by task, order, and nom) ──
  const observedScrapCache = useMemo(() => {
    const cacheByTask = {}
    const cacheByOrder = {}
    const cacheByNom = {}
    const cardMap = {}
    dashboardCards.forEach(c => { cardMap[c.id] = c })

    observedScrapRows.forEach(h => {
      if (!h.card_id && (!h.task_id || !h.nomenclature_id)) return
      const card = cardMap[h.card_id]
      const tid = h.task_id || card?.task_id
      const oid = h.order_id || card?.order_id
      const nid = h.nomenclature_id ? String(h.nomenclature_id) : (card?.nomenclature_id ? String(card.nomenclature_id) : null)
      const scrapQty = Number(h.scrap_qty) || Number(h.total_scrap) || 0
      if (!nid || scrapQty <= 0) return

      if (tid) {
        if (!cacheByTask[tid]) cacheByTask[tid] = {}
        cacheByTask[tid][nid] = (cacheByTask[tid][nid] || 0) + scrapQty
      }
      // Order is only a fallback for legacy rows that have no task link.
      if (oid && !tid) {
        if (!cacheByOrder[oid]) cacheByOrder[oid] = {}
        cacheByOrder[oid][nid] = (cacheByOrder[oid][nid] || 0) + scrapQty
      }
      cacheByNom[nid] = (cacheByNom[nid] || 0) + scrapQty
    })

    return { byTask: cacheByTask, byOrder: cacheByOrder, byNom: cacheByNom }
  }, [observedScrapRows, dashboardCards])

  // ── Final Scrap cache (Cat 4 Util write-offs) ──
  const finalScrapCache = useMemo(() => {
    const cache = {}
    if (qualityLoss.isAvailable && qualityLoss.rows.length > 0) {
      qualityLoss.rows.forEach(row => {
        const tid = row.task_id
        const nid = row.nomenclature_id ? String(row.nomenclature_id) : null
        if (!tid || !nid) return
        if (!cache[tid]) cache[tid] = {}
        cache[tid][nid] = (cache[tid][nid] || 0) + (Number(row.total_scrap) || 0)
      })
      return cache
    }
    return {}
  }, [qualityLoss.rows, qualityLoss.isAvailable])

  const scrapCache = observedScrapCache.byTask

  const scopedScrapCache = useMemo(() => {
    const cache = {}
    const cardMap = {}
    dashboardCards.forEach(c => { cardMap[c.id] = c })
    const lossRows = qualityLoss.isAvailable ? qualityLoss.rows : dashboardHistory

    relevantTasks.forEach(task => {
      const scopeSet = new Set(taskScopeIdsMap[task.id] || [task.id])
      cache[task.id] = {}

      lossRows.forEach(h => {
        if (!h.card_id && (!h.task_id || !h.nomenclature_id)) return
        const card = cardMap[h.card_id]
        const tid = h.task_id || card?.task_id
        const nid = h.nomenclature_id ? String(h.nomenclature_id) : (card?.nomenclature_id ? String(card.nomenclature_id) : null)
        if (!tid || !nid || !scopeSet.has(tid)) return
        const loss = qualityLoss.isAvailable ? Number(h.total_scrap) || 0 : (Number(h.scrap_qty) || Number(h.total_scrap) || 0)
        cache[task.id][nid] = (cache[task.id][nid] || 0) + loss
      })
    })

    return cache
  }, [dashboardHistory, dashboardCards, relevantTasks, taskScopeIdsMap, qualityLoss.rows, qualityLoss.isAvailable])

  // ── Task status map ──
  const taskStatusMap = useMemo(() => {
    const map = {}
    relevantTasks.forEach(task => {
      const shop2Tasks = tasks.filter(s2 =>
        getForemanTaskScopeKey(s2) === getForemanTaskScopeKey(task) &&
        (s2.step?.includes('Пресування') || s2.step?.includes('ЦЕХ №2') || s2.step?.includes('Доопрацювання'))
      )
      const hasActiveShop2Task = shop2Tasks.some(s2 => {
        if (s2.status === 'completed') return false
        const s2Cards = (cardsByTaskId[s2.id] || []).filter(c => c.operation !== 'Склад БЗ')
        if (s2Cards.length === 0) return s2.status === 'waiting' || s2.status === 'in-progress'
        return s2Cards.some(c => c.status !== 'completed')
      })

      const snapshot = task.plan_snapshot || {}
      const taskProd = productionCache[task.id] || {}
      const taskScrap = scopedScrapCache[task.id] || {}
      const scopeIds = taskScopeIdsMap[task.id] || [task.id]
      const taskCards = scopeIds
        .flatMap(taskId => cardsByTaskId[taskId] || [])
        .filter(c => c.operation !== 'Склад БЗ')
      const hasAggregateData = Object.values(taskProd).some(qty => (Number(qty) || 0) > 0) ||
        Object.values(taskScrap).some(qty => (Number(qty) || 0) > 0)

      if (task.status === 'completed' && !hasActiveShop2Task) { map[task.id] = 'completed'; return }
      if (taskCards.length === 0 && !hasAggregateData && task.status !== 'completed') { map[task.id] = 'new'; return }

      let allDone = true
      let hasShortage = false

      Object.keys(snapshot).forEach(nomIdStr => {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        if (!uuidRegex.test(nomIdStr)) return
        const snap = snapshot[nomIdStr]
        if (!snap || snap.need === 0) return
        const need = snap.need || 0
        const produced = taskProd[nomIdStr] || 0
        const stock = Number(snap.stock) || 0
        const fulfilled = produced + stock
        if (fulfilled < need) allDone = false

        const sheets = snap.sheets || 0
        const units = snap.units_per_sheet || 1
        const scrap = taskScrap[nomIdStr] || 0
        const totalBZ = (sheets * units) + stock - need
        if (fulfilled < need && (totalBZ - scrap) < 0) hasShortage = true
      })

      const hasActivePipelineCards = taskCards.some(c =>
        c.operation !== 'Склад БЗ' &&
        c.status !== 'completed' &&
        c.status !== 'at-shop2-buffer'
      )
      const hasBufferCards = taskCards.some(c => c.status === 'at-shop2-buffer')
      const hasActiveCards = hasActivePipelineCards || (hasBufferCards && !allDone)

      if (allDone && !hasActiveCards && !hasActiveShop2Task) map[task.id] = 'ready'
      else if (hasShortage) map[task.id] = 'shortage'
      else if (hasActiveShop2Task || hasActiveCards) map[task.id] = 'in_progress'
      else map[task.id] = 'in_progress'
    })
    return map
  }, [relevantTasks, cardsByTaskId, productionCache, scopedScrapCache, taskScopeIdsMap, tasks])

  // ── Per-task progress ──
  const taskProgressMap = useMemo(() => {
    const map = {}
    relevantTasks.forEach(task => {
      const order = ordersMap[task.order_id]
      const planned = Number(task.planned_sets) || Number(order?.quantity) || 0
      const taskProd = productionCache[task.id] || {}
      const snapshot = task.plan_snapshot || {}

      let minSets = Infinity
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      const snapKeys = Object.keys(snapshot).filter(k => uuidRegex.test(k))

      if (snapKeys.length > 0) {
        snapKeys.forEach(nomIdStr => {
          const snap = snapshot[nomIdStr]
          if (!snap || !snap.need) return
          const nom = nomenclatures.find(n => String(n.id) === nomIdStr)
          if (nom?.type !== 'part') return
          const qtyPer = planned > 0 ? Math.round(snap.need / planned) : 1
          if (qtyPer <= 0) return
          const produced = taskProd[nomIdStr] || 0
          const sets = Math.floor(produced / qtyPer)
          if (sets < minSets) minSets = sets
        })
      }

      map[task.id] = {
        actual: minSets === Infinity ? 0 : Math.min(planned, minSets),
        demand: planned
      }
    })
    return map
  }, [relevantTasks, productionCache, nomenclatures, ordersMap])

  // ── Build WIP rows for a given set of tasks ──
  const buildWipGroups = (filterTaskIds) => {
    if (!nomenclatures || !bomItems || !orders) return []

    const selectedTasks = tasks.filter(t => filterTaskIds.includes(t.id))
    const allTaskIdsForOrders = Array.from(new Set(selectedTasks.flatMap(t => taskScopeIdsMap[t.id] || [t.id])))
    const scopedTaskIdSet = new Set(allTaskIdsForOrders)
    const allTasksForOrders = tasks.filter(t => scopedTaskIdSet.has(t.id))
    const orderIds = Array.from(new Set(selectedTasks.map(t => t.order_id).filter(Boolean)))

    const filterSet = new Set(allTaskIdsForOrders)
    const filteredCards = dashboardCards.filter(c => c.task_id
      ? filterSet.has(c.task_id)
      : (c.order_id && orderIds.includes(c.order_id)))

    const parentToChildren = {}
    const childToParents = {}
    const taskParentMap = {}

    allTaskIdsForOrders.forEach(taskId => {
      const task = tasks.find(t => t.id === taskId)
      if (!task) return
      const order = ordersMap[task.order_id]
      if (!order) return

      let parentId = order.nomenclature_id
      if (!parentId && order.order_items?.length > 0) parentId = order.order_items[0].nomenclature_id
      if (!parentId) return
      parentId = String(parentId)
      taskParentMap[taskId] = parentId

      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      const taskWithSnap = task.plan_snapshot && Object.keys(task.plan_snapshot).some(k => uuidRegex.test(k)) ? task : null

      if (!parentToChildren[parentId]) parentToChildren[parentId] = {}
      if (taskWithSnap) {
        const plannedSets = Number(task.planned_sets) || 1
        Object.entries(task.plan_snapshot).forEach(([childId, entry]) => {
          if (!uuidRegex.test(childId)) return
          const need = Number(entry.need) || 0
          const qtyPer = plannedSets > 0 ? Math.round(need / plannedSets) : need
          parentToChildren[parentId][childId] = qtyPer
          if (!childToParents[childId]) childToParents[childId] = new Set()
          childToParents[childId].add(parentId)
        })
      } else {
        bomItems.filter(b => String(b.parent_id) === parentId).forEach(b => {
          const childId = String(b.child_id)
          parentToChildren[parentId][childId] = Number(b.quantity_per_parent) || 1
          if (!childToParents[childId]) childToParents[childId] = new Set()
          childToParents[childId].add(parentId)
        })
      }
    })

    const groups = {}
    const productNoms = nomenclatures.filter(n => n.type === 'product')
    productNoms.forEach(prod => {
      if (parentToChildren[String(prod.id)]) {
        groups[prod.id] = { id: prod.id, name: prod.name, code: prod.code || '', rows: [], trend: null }
      }
    })

    const parts = nomenclatures.filter(n => n.type === 'part')

    parts.forEach(nom => {
      const parentIds = childToParents[nom.id] ? Array.from(childToParents[nom.id]) : []
      if (parentIds.length === 0) return

      parentIds.forEach(parentId => {
        if (!groups[parentId]) return

        const qtyPerProduct = parentToChildren[parentId]?.[nom.id] || 1

        const demandForParent = (() => {
          let d = 0
          const processedOrderKeys = new Set()
          filterTaskIds.forEach(taskId => {
            if (taskParentMap[taskId] !== parentId) return
            const task = tasks.find(t => t.id === taskId)
            if (!task) return
            const orderKey = getForemanTaskScopeKey(task)
            if (processedOrderKeys.has(orderKey)) return
            processedOrderKeys.add(orderKey)
            d += Number(task?.planned_sets) || 0
          })
          return d * qtyPerProduct
        })()

        const shop2TaskIdsSet = new Set()
        tasks.forEach(t => {
          const step = String(t.step || '').toLowerCase()
          const name = String(t.name || '').toLowerCase()
          if (step.includes('цех №2') || step.includes('цех 2') || step.includes('пресування') || step.includes('фарбування') || step.includes('маляр') || step.includes('доопрацювання') ||
              name.includes('цех №2') || name.includes('цех 2') || name.includes('пресування') || name.includes('фарбування') || name.includes('маляр') || name.includes('доопрацювання')) {
            shop2TaskIdsSet.add(String(t.id))
          }
        })

        const isShop2Card = (c) => {
          if (!c) return false
          if (shop2TaskIdsSet.has(String(c.task_id))) return true
          const info = String(c.card_info || '')
          if (info.includes('[SHOP:2]') || info.includes('[ЦЕХ №2]') || info.includes('[ЦЕХ 2]')) return true
          const op = String(c.operation || '').toLowerCase()
          return op.includes('пресув') || op.includes('прес') || op.includes('фарбуван') || op.includes('маляр') || op.includes('доопрац') || op.includes('пакува') || op.includes('сгп')
        }

        const getPrimaryGenericOp = (info) => {
          const match = String(info || '').match(/\[STAGE:([^\]]+)\]/i)
          if (match) {
            const stage = match[1].toLowerCase()
            if (stage.includes('фарбуван') || stage.includes('маляр') || stage.includes('paint')) return 'малярка'
            if (stage.includes('пресув') || stage.includes('прес')) return 'пресування'
            if (stage.includes('доопрац') || stage.includes('доработ')) return 'доопрацювання'
            if (stage.includes('пакува') || stage.includes('сгп') || stage.includes('пакван')) return 'пакування'
          }
          return null
        }

        const matchOpName = (c, operation) => {
          if (!c) return false
          const rawOp = String(c.operation || '').toLowerCase().trim()
          const info = String(c.card_info || '').toLowerCase()
          const ops = Array.isArray(operation) ? operation : [operation]
          
          const explicitStageMatch = info.match(/\[STAGE:([^\]]+)\]/i)
          const isGenericOp = !rawOp || rawOp === 'цех 2' || rawOp === 'цех №2' || rawOp === 'shop 2' || rawOp === 'shop2'
          const effectiveOp = !isGenericOp ? rawOp : (explicitStageMatch ? explicitStageMatch[1].toLowerCase() : rawOp)

          const primaryGeneric = (isGenericOp && isShop2Card(c) && explicitStageMatch) ? getPrimaryGenericOp(info) : null

          for (const targetOp of ops) {
            const target = String(targetOp).toLowerCase().trim()

            if (target === 'розкрій') {
              if (effectiveOp.includes('розкрій') || effectiveOp.includes('різка') || effectiveOp.includes('laser')) return true
            } else if (target === 'галтовка') {
              if (effectiveOp.includes('галтовка') || effectiveOp.startsWith('галтовка')) return true
            } else if (target === 'прийомка') {
              if (effectiveOp.includes('прийомка')) return true
            } else if (target === 'сортування') {
              if (effectiveOp.includes('сортування')) return true
            } else if (target === 'фарбування' || target === 'малярка') {
              if (effectiveOp.includes('фарбуван') || effectiveOp.includes('маляр') || effectiveOp.includes('paint')) return true
              if (primaryGeneric === 'малярка') return true
            } else if (target === 'пресування') {
              if (effectiveOp.includes('пресув') || effectiveOp.includes('прес')) return true
              if (primaryGeneric === 'пресування') return true
            } else if (target === 'доопрацювання') {
              if (effectiveOp.includes('доопрац') || effectiveOp.includes('доработ')) return true
              if (primaryGeneric === 'доопрацювання') return true
            } else if (target === 'пакування' || target === 'сгп') {
              if (effectiveOp.includes('пакува') || effectiveOp.includes('пакван') || effectiveOp.includes('сгп')) return true
              if (primaryGeneric === 'пакування') return true
            } else {
              if (c.operation === targetOp || effectiveOp === target) return true
            }
          }

          return false
        }

        const matchStatName = (cStatus, statuses, targetOp = '') => {
          const stat = String(cStatus || '').toLowerCase()
          const stats = Array.isArray(statuses) ? statuses : [statuses]
          const targetOpStr = Array.isArray(targetOp) ? targetOp.join(' ') : String(targetOp)
          const targetOpLower = targetOpStr.toLowerCase()
          const isShop1Op = targetOpLower.includes('розкрій') || targetOpLower.includes('різка') || targetOpLower.includes('laser')

          for (const targetStat of stats) {
            if (targetStat === 'new' || targetStat === 'waiting-machines' || targetStat === 'waiting-materials') {
              if (isShop1Op) {
                if (['new', 'waiting-machines'].includes(stat)) return true
              } else {
                if (['new', 'waiting-machines', 'waiting-materials', 'waiting-cutters', 'waiting-buffer', 'waiting', 'waiting_material', 'waiting-warehouse'].includes(stat)) return true
              }
            } else if (targetStat === 'in-progress') {
              if (['in-progress', 'in_progress', 'paused'].includes(stat)) return true
            } else if (targetStat === 'at-buffer') {
              if (['at-buffer', 'waiting-buffer'].includes(stat)) return true
            } else {
              if (stat === targetStat) return true
            }
          }

          return false
        }

        const getCardParentId = (c) => {
          if (!c) return null
          if (c.task_id && taskParentMap[c.task_id]) return taskParentMap[c.task_id]
          if (c.task_id && globalTaskParentMap[c.task_id]) return globalTaskParentMap[c.task_id]
          const ord = resolveCardOrder(c, tasks, ordersMap, orders)
          if (ord) {
            const pId = ord.nomenclature_id || ord.order_items?.[0]?.nomenclature_id
            if (pId) return String(pId)
          }
          return null
        }

        const getQ = (ops, statuses) => {
          return filteredCards.filter(c => {
            if (String(c.nomenclature_id) !== String(nom.id)) return false
            const cardParent = getCardParentId(c)
            if (!cardParent || String(cardParent) !== String(parentId)) return false
            if (isVkyaCard(c)) return false
            return matchOpName(c, ops) && matchStatName(c.status, statuses, ops)
          }).reduce((s, c) => s + (Number(c.quantity) || 0), 0)
        }

        const qWhWait = filteredCards.filter(c => {
          if (String(c.nomenclature_id) !== String(nom.id)) return false
          const cardParent = getCardParentId(c)
          if (cardParent && String(cardParent) !== String(parentId)) return false
          if (c.operation === 'Склад БЗ' || c.operation === 'Склад BZ' || isVkyaCard(c)) return false
          return ['waiting-materials', 'waiting_material', 'waiting-warehouse', 'waiting-cutters'].includes(c.status) || c.operation === 'Склад' || c.operation === 'Очікування Склад'
        }).reduce((s, c) => s + (Number(c.quantity) || 0), 0)
        const qCutWait = getQ(['Розкрій'], ['new', 'waiting-machines'])
        const qCut = getQ(['Розкрій'], ['in-progress', 'paused'])
        const qCutBuf = getQ(['Розкрій'], ['at-buffer'])
        const qGalt = getQ(['Галтовка'], ['in-progress', 'paused'])
        const qGaltBuf = getQ(['Галтовка'], ['at-buffer'])
        const qPriy = getQ(['Прийомка'], ['new', 'in-progress', 'paused', 'at-buffer'])
        const qSortAct = getQ(['Сортування'], ['new', 'in-progress', 'paused', 'at-buffer'])
        const qSort = filteredCards.filter(c => {
          if (String(c.nomenclature_id) !== String(nom.id)) return false
          const cardParent = getCardParentId(c)
          if (cardParent && String(cardParent) !== String(parentId)) return false
          if (isVkyaCard(c)) return false
          return c.status === 'at-shop2-buffer'
        }).reduce((s, c) => s + Math.max(0, (Number(c.quantity) || 0) - (Number(c.used_in_shop2_qty) || 0)), 0)

        const qMalWait = getQ(['Фарбування', 'Малярка'], ['new', 'waiting-machines', 'waiting-materials'])
        const qMal = getQ(['Фарбування', 'Малярка'], ['in-progress', 'paused'])
        const qMalBuf = getQ(['Фарбування', 'Малярка'], ['at-buffer'])
        const qPresWait = getQ(['Пресування'], ['new', 'waiting-machines', 'waiting-materials'])
        const qPres = getQ(['Пресування'], ['in-progress', 'paused'])
        const qPresBuf = getQ(['Пресування'], ['at-buffer'])
        const qDoopWait = getQ(['Доопрацювання'], ['new', 'waiting-machines', 'waiting-materials'])
        const qDoop = getQ(['Доопрацювання'], ['in-progress', 'paused'])
        const qDoopBuf = getQ(['Доопрацювання'], ['at-buffer'])

        let initialStock = 0
        const orderTasks = allTasksForOrders.filter(t => {
          const o = ordersMap[t.order_id]
          if (!o) return false
          const oPid = o.nomenclature_id || o.order_items?.[0]?.nomenclature_id
          return String(oPid) === String(parentId)
        })
        const processedScopeKeys = Array.from(new Set(orderTasks.map(getForemanTaskScopeKey)))
        processedScopeKeys.forEach(scopeKey => {
          const taskWithSnap = orderTasks.find(t => getForemanTaskScopeKey(t) === scopeKey && t.plan_snapshot && t.plan_snapshot[String(nom.id)])
          if (taskWithSnap) {
            const snapEntry = taskWithSnap.plan_snapshot[String(nom.id)] || {}
            const stock = Number(snapEntry.stock) || 0
            initialStock += stock
          }
        })

        const sgpTransferCards = filteredCards.filter(c => {
          if (String(c.nomenclature_id) !== String(nom.id)) return false
          const cardParent = getCardParentId(c)
          if (cardParent && String(cardParent) !== String(parentId)) return false
          return !isVkyaCard(c)
        })
        const confirmedSgpCardsQty = getConfirmedSgpFromCards(sgpTransferCards)

        const flowRowsForThisPart = flowTotalsRows.filter(row => {
          if (String(row.nomenclature_id) !== String(nom.id)) return false
          if (!row.task_id || !filterSet.has(row.task_id)) return false
          return !taskParentMap[row.task_id] || taskParentMap[row.task_id] === parentId
        })
        const flowSgpQty = getConfirmedSgpFromFlow(flowRowsForThisPart, sgpTransferCards)
        const allTaskIdsForParent = allTaskIdsForOrders.filter(tid => !taskParentMap[tid] || taskParentMap[tid] === parentId)
        let qCat4Scrap = 0
        allTaskIdsForParent.forEach(tid => {
          if (finalScrapCache[tid]?.[String(nom.id)] !== undefined) {
            qCat4Scrap += Number(finalScrapCache[tid][String(nom.id)]) || 0
          }
        })
        let indexedCurrentVkyaQty = 0
        allTaskIdsForParent.forEach(tid => {
          const pendingMap = qualityLoss?.pendingVkyaByTask?.[tid]
          if (pendingMap && pendingMap[String(nom.id)]) {
            indexedCurrentVkyaQty += Number(pendingMap[String(nom.id)]) || 0
          }
        })
        const orderIdsForParent = new Set(allTasksForOrders
          .filter(task => taskParentMap[task.id] === parentId)
          .map(task => String(task.order_id || ''))
          .filter(Boolean))
        orderIdsForParent.forEach(orderId => {
          indexedCurrentVkyaQty += Number(qualityLoss?.pendingVkyaByOrder?.[orderId]?.[String(nom.id)]) || 0
        })

        let observedScrapQty = 0
        let returnedToRouteQty = 0
        allTaskIdsForParent.forEach(tid => {
          observedScrapQty += Number(observedScrapCache.byTask?.[tid]?.[String(nom.id)]) || 0
          returnedToRouteQty += Number(qualityLoss?.returnedIndex?.[tid]?.[String(nom.id)]) || 0
        })
        orderIdsForParent.forEach(orderId => {
          observedScrapQty += Number(observedScrapCache.byOrder?.[orderId]?.[String(nom.id)]) || 0
        })

        // All card scrap remains at VKYA while it is in quarantine, category 1,
        // or restoration. Only final util and an actual return to production
        // remove it. The detailed VKYA ledger remains a fallback for legacy
        // records where no card scrap total exists.
        const currentVkyaQty = observedScrapQty > 0
          ? calculateCurrentVkyaQuantity({ observedScrapQty, finalScrapQty: qCat4Scrap, returnedToRouteQty })
          : indexedCurrentVkyaQty

        const { qSgp, qBz, qScrap, qVkya } = calculateTerminalMetrics({
          initialStock,
          flowSgpQty,
          confirmedSgpCardsQty,
          finalScrapQty: qCat4Scrap,
          currentVkyaQty
        })

        const sum = qWhWait + qCutWait + qCut + qCutBuf + qGalt + qGaltBuf + qPriy + qSortAct + qSort + qMalWait + qMal + qMalBuf + qPresWait + qPres + qPresBuf + qDoopWait + qDoop + qDoopBuf + qSgp + qBz + qVkya

        const matchSearch = !searchQuery ||
          nom.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (nom.code || '').toLowerCase().includes(searchQuery.toLowerCase())

        if (matchSearch && (demandForParent > 0 || sum > 0)) {
          groups[parentId].rows.push({
            id: nom.id + '_' + parentId,
            nomId: nom.id,
            parentId,
            name: nom.name,
            code: nom.code || '',
            demand: demandForParent,
            qtyPerProduct,
            qWhWait, qCutWait, qCut, qCutBuf, qGalt, qGaltBuf, qPriy,
            qSortAct, qSort, qMalWait, qMal, qMalBuf, qPresWait, qPres,
            qPresBuf, qDoopWait, qDoop, qDoopBuf, qSgp, qBz, qScrap, qVkya, sum
          })
        }
      })
    })

    return Object.values(groups).filter(g => g.rows.length > 0)
  }

  // ── Overview WIP groups ──
  const overviewGroups = useMemo(() => {
    if (!selectedTaskId) {
      return buildWipGroups(relevantTasks.map(t => t.id))
    }
    return buildWipGroups([selectedTaskId])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTaskId, relevantTasks, activeTasks, dashboardCards, dashboardHistory, flowTotalsRows, inventory, nomenclatures, bomItems, tasks, orders, searchQuery, qualityLoss.rows, qualityLoss.returnedRows, qualityLoss.currentVkyaItems])

  // ── Handle cell click ──
  const handleCellClick = (row, stageKey, stageName, group) => {
    const nomId = String(row.nomId || row.id.split('_')[0] || '')
    const rowParentId = String(row.parentId || '')

    const getCardParentId = (c) => {
      if (!c) return null
      if (c.task_id && globalTaskParentMap[c.task_id]) return globalTaskParentMap[c.task_id]
      const ord = resolveCardOrder(c, tasks, ordersMap, orders)
      if (ord) {
        const pId = ord.nomenclature_id || ord.order_items?.[0]?.nomenclature_id
        if (pId) return String(pId)
      }
      return null
    }

    const modalPrimaryTasks = selectedTaskId
      ? relevantTasks.filter(t => t.id === selectedTaskId)
      : relevantTasks
    const modalTaskIds = new Set(modalPrimaryTasks.flatMap(t => taskScopeIdsMap[t.id] || [t.id]).map(String))

    const nomCards = (dashboardCards || []).filter(c => {
      if (String(c.nomenclature_id) !== nomId) return false
      if (c.task_id && !modalTaskIds.has(String(c.task_id))) return false
      const cardParent = getCardParentId(c)
      if (!cardParent || String(cardParent) !== rowParentId) return false
      return true
    })

    const shop2TaskIdsSet = new Set()
    tasks.forEach(t => {
      const step = String(t.step || '').toLowerCase()
      const name = String(t.name || '').toLowerCase()
      if (step.includes('цех №2') || step.includes('цех 2') || step.includes('пресування') || step.includes('фарбування') || step.includes('маляр') || step.includes('доопрацювання') ||
          name.includes('цех №2') || name.includes('цех 2') || name.includes('пресування') || name.includes('фарбування') || name.includes('маляр') || name.includes('доопрацювання')) {
        shop2TaskIdsSet.add(String(t.id))
      }
    })

    const isShop2Card = (c) => {
      if (!c) return false
      if (shop2TaskIdsSet.has(String(c.task_id))) return true
      const info = String(c.card_info || '')
      if (info.includes('[SHOP:2]') || info.includes('[ЦЕХ №2]') || info.includes('[ЦЕХ 2]')) return true
      const op = String(c.operation || '').toLowerCase()
      return op.includes('пресув') || op.includes('прес') || op.includes('фарбуван') || op.includes('маляр') || op.includes('доопрац') || op.includes('пакува') || op.includes('сгп')
    }

    const getPrimaryGenericOp = (info) => {
      const match = String(info || '').match(/\[STAGE:([^\]]+)\]/i)
      if (match) {
        const stage = match[1].toLowerCase()
        if (stage.includes('фарбуван') || stage.includes('маляр') || stage.includes('paint')) return 'малярка'
        if (stage.includes('пресув') || stage.includes('прес')) return 'пресування'
        if (stage.includes('доопрац') || stage.includes('доработ')) return 'доопрацювання'
        if (stage.includes('пакува') || stage.includes('сгп') || stage.includes('пакван')) return 'пакування'
      }
      return null
    }

    const matchOpName = (c, operation) => {
      if (!c) return false
      if (isVkyaCard(c)) return false
      const rawOp = String(c.operation || '').toLowerCase().trim()
      const info = String(c.card_info || '').toLowerCase()
      const ops = Array.isArray(operation) ? operation : [operation]

      const explicitStageMatch = info.match(/\[STAGE:([^\]]+)\]/i)
      const isGenericOp = !rawOp || rawOp === 'цех 2' || rawOp === 'цех №2' || rawOp === 'shop 2' || rawOp === 'shop2'
      const effectiveOp = !isGenericOp ? rawOp : (explicitStageMatch ? explicitStageMatch[1].toLowerCase() : rawOp)
      const primaryGeneric = (isGenericOp && isShop2Card(c) && explicitStageMatch) ? getPrimaryGenericOp(info) : null

      for (const targetOp of ops) {
        const target = String(targetOp).toLowerCase().trim()

        if (target === 'розкрій') {
          if (effectiveOp.includes('розкрій') || effectiveOp.includes('різка') || effectiveOp.includes('laser')) return true
        } else if (target === 'галтовка') {
          if (effectiveOp.includes('галтовка') || effectiveOp.startsWith('галтовка')) return true
        } else if (target === 'прийомка') {
          if (effectiveOp.includes('прийомка')) return true
        } else if (target === 'сортування') {
          if (effectiveOp.includes('сортування')) return true
        } else if (target === 'фарбування' || target === 'малярка') {
          if (effectiveOp.includes('фарбуван') || effectiveOp.includes('маляр') || effectiveOp.includes('paint')) return true
          if (primaryGeneric === 'малярка') return true
        } else if (target === 'пресування') {
          if (effectiveOp.includes('пресув') || effectiveOp.includes('прес')) return true
          if (primaryGeneric === 'пресування') return true
        } else if (target === 'доопрацювання') {
          if (effectiveOp.includes('доопрац') || effectiveOp.includes('доработ')) return true
          if (primaryGeneric === 'доопрацювання') return true
        } else if (target === 'пакування' || target === 'сгп') {
          if (effectiveOp.includes('пакува') || effectiveOp.includes('пакван') || effectiveOp.includes('сгп')) return true
          if (primaryGeneric === 'пакування') return true
        } else {
          if (c.operation === targetOp || effectiveOp === target) return true
        }
      }

      return false
    }

    const matchStatName = (cStatus, statuses, targetOp = '') => {
      const stat = String(cStatus || '').toLowerCase()
      const stats = Array.isArray(statuses) ? statuses : [statuses]
      const targetOpStr = Array.isArray(targetOp) ? targetOp.join(' ') : String(targetOp)
      const targetOpLower = targetOpStr.toLowerCase()
      const isShop1Op = targetOpLower.includes('розкрій') || targetOpLower.includes('різка') || targetOpLower.includes('laser')

      for (const targetStat of stats) {
        if (targetStat === 'new' || targetStat === 'waiting-machines' || targetStat === 'waiting-materials') {
          if (isShop1Op) {
            if (['new', 'waiting-machines'].includes(stat)) return true
          } else {
            if (['new', 'waiting-machines', 'waiting-materials', 'waiting-cutters', 'waiting-buffer', 'waiting', 'waiting_material', 'waiting-warehouse'].includes(stat)) return true
          }
        } else if (targetStat === 'in-progress') {
          if (['in-progress', 'in_progress', 'paused'].includes(stat)) return true
        } else if (targetStat === 'at-buffer') {
          if (['at-buffer', 'waiting-buffer'].includes(stat)) return true
        } else {
          if (stat === targetStat) return true
        }
      }

      return false
    }

    const matchOpsAndStatus = (ops, statuses) => {
      return nomCards.filter(c => matchOpName(c, ops) && matchStatName(c.status, statuses, ops))
    }

    let matchingCards = []
    if (stageKey === 'qWhWait') matchingCards = nomCards.filter(c => !isVkyaCard(c) && c.operation !== 'Склад БЗ' && (['waiting-materials', 'waiting_material', 'waiting-warehouse', 'waiting-cutters'].includes(c.status) || c.operation === 'Склад' || c.operation === 'Очікування Склад'))
    else if (stageKey === 'qCutWait') matchingCards = matchOpsAndStatus(['Розкрій'], ['new', 'waiting-machines'])
    else if (stageKey === 'qCut') matchingCards = matchOpsAndStatus(['Розкрій'], ['in-progress', 'paused'])
    else if (stageKey === 'qCutBuf') matchingCards = matchOpsAndStatus(['Розкрій'], ['at-buffer'])
    else if (stageKey === 'qGalt') matchingCards = matchOpsAndStatus(['Галтовка'], ['in-progress', 'paused'])
    else if (stageKey === 'qGaltBuf') matchingCards = matchOpsAndStatus(['Галтовка'], ['at-buffer'])
    else if (stageKey === 'qPriy') matchingCards = matchOpsAndStatus(['Прийомка'], ['new', 'in-progress', 'paused', 'at-buffer'])
    else if (stageKey === 'qSortAct') matchingCards = matchOpsAndStatus(['Сортування'], ['new', 'in-progress', 'paused', 'at-buffer'])
    else if (stageKey === 'qSort') matchingCards = nomCards.filter(c => !isVkyaCard(c) && c.status === 'at-shop2-buffer')
    else if (stageKey === 'qMalWait') matchingCards = matchOpsAndStatus(['Фарбування', 'Малярка'], ['new', 'waiting-machines', 'waiting-materials'])
    else if (stageKey === 'qMal') matchingCards = matchOpsAndStatus(['Фарбування', 'Малярка'], ['in-progress', 'paused'])
    else if (stageKey === 'qMalBuf') matchingCards = matchOpsAndStatus(['Фарбування', 'Малярка'], ['at-buffer'])
    else if (stageKey === 'qPresWait') matchingCards = matchOpsAndStatus(['Пресування'], ['new', 'waiting-machines', 'waiting-materials'])
    else if (stageKey === 'qPres') matchingCards = matchOpsAndStatus(['Пресування'], ['in-progress', 'paused'])
    else if (stageKey === 'qPresBuf') matchingCards = matchOpsAndStatus(['Пресування'], ['at-buffer'])
    else if (stageKey === 'qDoopWait') matchingCards = matchOpsAndStatus(['Доопрацювання'], ['new', 'waiting-machines', 'waiting-materials'])
    else if (stageKey === 'qDoop') matchingCards = matchOpsAndStatus(['Доопрацювання'], ['in-progress', 'paused'])
    else if (stageKey === 'qDoopBuf') matchingCards = matchOpsAndStatus(['Доопрацювання'], ['at-buffer'])
    else if (stageKey === 'qSgp') matchingCards = nomCards.filter(c => {
      if (isVkyaCard(c) || isBzReservationCard(c) || c.status !== 'completed') return false
      const op = String(c.operation || '').toLowerCase()
      const info = String(c.card_info || '').toLowerCase()
      return op.includes('сгп') || op.includes('пакування/сгп') || info.includes('[пряма передача]')
    }).map(c => ({ ...c, quantity: getConfirmedSgpCardQuantity(c) }))
    else if (stageKey === 'qBz') {
      matchingCards = [{
        id: `bz-${row.id}`,
        task_id: selectedTaskId || null,
        order_id: null,
        nomenclature_id: nomId,
        card_number: 'БЗ плану',
        operation: 'БЗ, взятий при формуванні наряду',
        status: 'completed',
        quantity: row.qBz || 0,
        card_info: 'Зафіксована стартова кількість із плану наряду'
      }].filter(item => item.quantity > 0)
    }
    else if (stageKey === 'qScrap') {
      matchingCards = (qualityLoss.rows || []).filter(item =>
        modalTaskIds.has(String(item.task_id)) &&
        String(item.nomenclature_id) === nomId
      ).map(item => ({
        ...item,
        id: item.id || `util-${item.task_id}-${item.card_id || nomId}`,
        quantity: Number(item.total_scrap) || 0,
        status: 'final-scrap',
        operation: 'Брак, утиль',
        card_number: item.card_id || 'Утиль'
      })).filter(item => item.quantity > 0)
    }
    else if (stageKey === 'qVkya') {
      const indexedItems = (qualityLoss.currentVkyaItems || []).filter(item =>
        (modalTaskIds.has(String(item.task_id)) || (
          item.scope_match === 'order' &&
          modalPrimaryTasks.some(task => String(task.order_id) === String(item.order_id))
        )) &&
        String(item.nomenclature_id) === nomId
      )
      const sourceRows = (observedScrapRows || []).filter(item =>
        modalTaskIds.has(String(item.task_id)) &&
        String(item.nomenclature_id) === nomId &&
        (Number(item.scrap_qty) || Number(item.total_scrap) || 0) > 0
      )
      let remaining = Math.max(0, Number(row.qVkya) || 0)
      const cardScrapItems = sourceRows.map((item, index) => {
        const sourceQuantity = Number(item.scrap_qty) || Number(item.total_scrap) || 0
        const quantity = Math.min(sourceQuantity, remaining)
        remaining -= quantity
        return {
          ...item,
          id: `vkya-card-scrap-${item.id || item.card_id || index}`,
          quantity,
          status: 'quality-hold',
          operation: 'На ВКЯ',
          card_number: item.card_number || item.card_id || 'ВКЯ',
          card_info: 'Брак по виробничій картці, який ще не повернуто у маршрут і не списано в утиль'
        }
      }).filter(item => item.quantity > 0)
      matchingCards = cardScrapItems.length > 0 ? cardScrapItems : indexedItems
    }
    else matchingCards = nomCards

    setSelectedCellModal({
      row,
      group,
      stageKey,
      stageName,
      cards: matchingCards,
      val: row[stageKey] || 0
    })
  }

  // ── Refresh ──
  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      await refreshSourceData()
      await qualityLoss.reload()
      setOrderAllCards({})
    } catch (e) {
      console.error(e)
    } finally {
      setIsRefreshing(false)
    }
  }

  return {
    currentUser,
    workCards,
    inventory,
    nomenclatures,
    orders,
    bomItems,
    tasks,
    workCardHistory,
    selectedTaskId,
    setSelectedTaskId,
    isRefreshing,
    qualityLossLoading: qualityLoss.loading,
    searchQuery,
    setSearchQuery,
    expandedBottlenecks,
    setExpandedBottlenecks,
    selectedCellModal,
    setSelectedCellModal,
    inspectCardModal,
    setInspectCardModal,
    orderAllCards,
    loadingCards,
    relevantTasks,
    activeTasks,
    ordersMap,
    globalTaskParentMap,
    dashboardCards,
    flowTotalsRows,
    dashboardHistory,
    cardsByTaskId,
    productionCache,
    scrapCache: scopedScrapCache,
    taskStatusMap,
    taskProgressMap,
    overviewGroups,
    handleCellClick,
    handleRefresh
  }
}
