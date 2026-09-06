import { useState, useMemo, useEffect } from 'react'
import { useMES } from '../../../MESContext'
import { supabase } from '../../../supabase'
import { useQualityLossTotals } from '../../VKYA/quality-hold/useQualityLossTotals.js'
import {
  fetchWorkCardHistoryByCardIds,
  fetchWorkCardsByTaskIds,
  sumFlowField,
  getBestKnownProducedFromFlow
} from '../utils/foremanDashboardHelpers.jsx'

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
  const qualityLoss = useQualityLossTotals(supabase, qualityLossTaskIds)

  // ── Load data on mount ──
  useEffect(() => {
    fetchModuleData('foreman')
    if (typeof fetchData === 'function') {
      fetchData(['orders', 'tasks', 'inventory', 'nomenclatures', 'bom_items', 'work_card_scrap_totals', 'work_card_flow_totals'])
    }
  }, [])

  // ── relevantTasks ──
  const relevantTasks = useMemo(() => {
    return tasks.filter(t => {
      const stepName = (t.step || '').toLowerCase()
      const isLaser = stepName.includes('розкрій') || stepName.includes('різка')

      const hasActiveShop2Task = tasks.some(s2 =>
        String(s2.order_id) === String(t.order_id) &&
        s2.batch_index === t.batch_index &&
        (s2.step?.includes('Пресування') || s2.step?.includes('ЦЕХ №2') || s2.step?.includes('Доопрацювання')) &&
        s2.status !== 'completed'
      )

      if (t.status !== 'completed' || hasActiveShop2Task) {
        return (t.warehouse_conf === 'true' || t.warehouse_conf === 'partial') && t.engineer_conf && t.director_conf && isLaser
      }
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
      const isRecent = (t.completed_at && new Date(t.completed_at) > threeDaysAgo) ||
        (t.updated_at && new Date(t.updated_at) > threeDaysAgo)
      return isRecent && (isLaser || !t.step)
    }).sort((a, b) => {
      if (a.status === 'completed' && b.status !== 'completed') return 1
      if (a.status !== 'completed' && b.status === 'completed') return -1
      return new Date(b.created_at) - new Date(a.created_at)
    })
  }, [tasks])

  // ── Active (non-completed) tasks ──
  const activeTasks = useMemo(() => {
    return relevantTasks.filter(t => {
      if (t.status !== 'completed') return true
      const hasActiveShop2Task = tasks.some(s2 =>
        String(s2.order_id) === String(t.order_id) &&
        s2.batch_index === t.batch_index &&
        (s2.step?.includes('Пресування') || s2.step?.includes('ЦЕХ №2') || s2.step?.includes('Доопрацювання')) &&
        s2.status !== 'completed'
      )
      return hasActiveShop2Task
    })
  }, [relevantTasks, tasks])

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
    const sourceRows = totalsHistoryRows.length > 0
      ? totalsHistoryRows
      : [...(workCardHistory || []), ...(allCardsHistory || [])]
    return Array.from(new Map(sourceRows.filter(Boolean).map(row => [String(row.id || `${row.card_id}-${row.created_at || row.completed_at || Math.random()}`), row])).values())
  }, [workCardHistory, allCardsHistory, totalsHistoryRows])

  const loadAllTasksCards = async (taskList) => {
    if (!taskList || taskList.length === 0) {
      setAllTasksCards([])
      setAllCardsHistory([])
      return
    }
    try {
      const orderIds = Array.from(new Set(taskList.map(t => t.order_id).filter(Boolean)))
      const allTaskIdsForOrders = tasks
        .filter(t => orderIds.includes(t.order_id))
        .map(t => t.id)

      const taskIds = allTaskIdsForOrders.length > 0 ? allTaskIdsForOrders : taskList.map(t => t.id)
      const cards = await fetchWorkCardsByTaskIds(taskIds, 'id, task_id, nomenclature_id, status, quantity, operation, used_in_shop2_qty, card_info, created_at')

      if (cards) {
        setAllTasksCards(cards)
        const cardIds = cards.map(c => c.id)
        if (totalsHistoryRows.length > 0) {
          setAllCardsHistory(totalsHistoryRows)
        } else if (cardIds.length > 0) {
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
    fetchWorkCardsByTaskIds([selectedTaskId], '*')
      .then(data => {
        setOrderAllCards(prev => ({ ...prev, [selectedTaskId]: data || [] }))
        setLoadingCards(prev => ({ ...prev, [selectedTaskId]: false }))
      })
      .catch(error => {
        console.error(error)
        setLoadingCards(prev => ({ ...prev, [selectedTaskId]: false }))
      })
  }, [selectedTaskId])

  // ── Index cards by task_id for O(1) lookups ──
  const cardsByTaskId = useMemo(() => {
    const map = {}
    dashboardCards.forEach(c => {
      if (!map[c.task_id]) map[c.task_id] = []
      map[c.task_id].push(c)
    })
    return map
  }, [dashboardCards])

  const taskScopeIdsMap = useMemo(() => {
    const map = {}
    relevantTasks.forEach(task => {
      const scopedIds = tasks
        .filter(t => String(t.order_id) === String(task.order_id))
        .map(t => t.id)
        .filter(Boolean)
      map[task.id] = scopedIds.length > 0 ? scopedIds : [task.id]
    })
    return map
  }, [relevantTasks, tasks])

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

        const getQ = (ops, statuses) => {
          return nomCards.filter(c => {
            const isMatchOp = ops.some(op => {
              if (op === 'Галтовка') return c.operation === 'Галтовка' || c.operation?.startsWith('Галтовка')
              if (op === 'Сортування') return c.operation === 'Сортування' || c.operation?.startsWith('Сортування') || c.operation?.includes('Сортування')
              return c.operation === op
            })
            return isMatchOp && statuses.includes(c.status)
          }).reduce((s, c) => s + (Number(c.quantity) || 0), 0)
        }

        const qCutWait = getQ(['Розкрій'], ['new', 'waiting-materials', 'waiting-machines'])
        const qCut = getQ(['Розкрій'], ['in-progress', 'paused', 'hold'])
        const qCutBuf = getQ(['Розкрій'], ['at-buffer'])
        const qGalt = getQ(['Галтовка'], ['in-progress'])
        const qGaltBuf = getQ(['Галтовка'], ['at-buffer'])
        const qPriy = getQ(['Прийомка'], ['new', 'in-progress', 'at-buffer'])
        const qSortAct = getQ(['Сортування'], ['new', 'in-progress', 'at-buffer'])
        const qSort = nomCards.filter(c => c.status === 'at-shop2-buffer')
          .reduce((s, c) => s + Math.max(0, (Number(c.quantity) || 0) - (Number(c.used_in_shop2_qty) || 0)), 0)

        const groupProduced = nomCards.filter(c => {
          const op = (c.operation || '').toLowerCase()
          const isShop1 = ['розкрій', 'галтовка', 'прийомка', 'сортування'].some(o => op.includes(o))
          return isShop1 && (c.status === 'completed' || c.status === 'at-shop2-buffer')
        }).reduce((s, c) => s + (Number(c.quantity) || 0), 0)

        const totalShop2Qty = nomCards.filter(c => {
          const op = (c.operation || '').toLowerCase()
          return ['пресування', 'фарбування', 'малярка', 'доопрацювання', 'пакування', 'сгп'].some(o => op.includes(o))
        }).reduce((s, c) => s + (Number(c.quantity) || 0), 0)

        const bzCardsQty = nomCards.filter(c => c.operation === 'Склад БЗ').reduce((s, c) => s + (Number(c.quantity) || 0), 0)
        const flowBzQty = sumFlowField(flowRows, 'total_bz')
        const qBz = flowRows.length > 0
          ? flowBzQty
          : Math.max(0, groupProduced - qSort - totalShop2Qty) + bzCardsQty

        const sum = qCutWait + qCut + qCutBuf + qGalt + qGaltBuf + qPriy + qSortAct + qSort + qBz

        const snap = snapshot[nid] || {}
        const need = Number(snap.need) || 0
        const initialStock = Number(snap.stock) || 0
        const plannedReserve = Math.max(0, ((Number(snap.sheets) || 0) * (Number(snap.units_per_sheet) || 1)) + (Number(snap.stock) || 0) - need)
        const flowProducedRaw = getBestKnownProducedFromFlow(flowRows)
        const flowScrapQty = sumFlowField(flowRows, 'total_scrap')
        const flowProducedNet = Math.max(0, flowProducedRaw - flowScrapQty + plannedReserve)
        const earlyWipQty = qCutWait + qCut + qCutBuf + qGalt + qGaltBuf + qPriy + qSortAct
        const nonReissueEarlyWip = Math.max(0, flowScrapQty - plannedReserve) > 0 ? 0 : earlyWipQty
        const sgpProducedFromCards = Math.max(0, groupProduced - qSort)
        const sgpForProgress = need > 0
          ? Math.min(need, sgpProducedFromCards, Math.max(0, need - nonReissueEarlyWip))
          : sgpProducedFromCards
        cache[task.id][nid] = groupProduced > 0 ? sgpForProgress : (flowProducedRaw > 0 ? Math.min(need || flowProducedNet, flowProducedNet) : sum)
      })
    })
    return cache
  }, [cardsByTaskId, relevantTasks, flowTotalsByTaskNom, taskScopeIdsMap])

  // ── Scrap cache ──
  const scrapCache = useMemo(() => {
    const cache = {}
    if (qualityLoss.isAvailable) {
      qualityLoss.rows.forEach(row => {
        const tid = row.task_id
        const nid = row.nomenclature_id ? String(row.nomenclature_id) : null
        if (!tid || !nid) return
        if (!cache[tid]) cache[tid] = {}
        cache[tid][nid] = (cache[tid][nid] || 0) + (Number(row.total_scrap) || 0)
      })
      return cache
    }
    const cardMap = {}
    dashboardCards.forEach(c => { cardMap[c.id] = c })

    dashboardHistory.forEach(h => {
      if (!h.card_id && (!h.task_id || !h.nomenclature_id)) return
      const card = cardMap[h.card_id]
      const tid = h.task_id || card?.task_id
      const nid = h.nomenclature_id ? String(h.nomenclature_id) : (card?.nomenclature_id ? String(card.nomenclature_id) : null)
      if (!tid || !nid) return
      if (!cache[tid]) cache[tid] = {}
      cache[tid][nid] = (cache[tid][nid] || 0) + (Number(h.scrap_qty) || 0)
    })
    return cache
  }, [dashboardHistory, dashboardCards, qualityLoss.rows, qualityLoss.isAvailable])

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
        const loss = qualityLoss.isAvailable ? Number(h.total_scrap) || 0 : Number(h.scrap_qty) || 0
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
        String(s2.order_id) === String(task.order_id) &&
        s2.batch_index === task.batch_index &&
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
        const produced = taskProd[nomIdStr] || 0
        if (produced < snap.need) allDone = false

        const need = snap.need || 0
        const stock = snap.stock || 0
        const sheets = snap.sheets || 0
        const units = snap.units_per_sheet || 1
        const scrap = taskScrap[nomIdStr] || 0
        const totalBZ = (sheets * units) + stock - need
        if (produced < need && (totalBZ - scrap) < 0) hasShortage = true
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
    const orderIds = Array.from(new Set(selectedTasks.map(t => t.order_id).filter(Boolean)))
    const allTasksForOrders = tasks.filter(t => orderIds.includes(t.order_id))
    const allTaskIdsForOrders = allTasksForOrders.map(t => t.id)

    const filterSet = new Set(allTaskIdsForOrders)
    const filteredCards = dashboardCards.filter(c => c.task_id && filterSet.has(c.task_id))

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
          filterTaskIds.forEach(taskId => {
            if (taskParentMap[taskId] !== parentId) return
            const task = tasks.find(t => t.id === taskId)
            d += Number(task?.planned_sets) || 0
          })
          return d * qtyPerProduct
        })()

        const getQ = (ops, statuses) => {
          const opArr = Array.isArray(ops) ? ops : [ops]
          const stArr = Array.isArray(statuses) ? statuses : [statuses]
          return filteredCards.filter(c => {
            if (String(c.nomenclature_id) !== String(nom.id)) return false
            if (c.task_id && taskParentMap[c.task_id] && taskParentMap[c.task_id] !== parentId) return false
            const isMatchOp = opArr.some(op => op === 'Галтовка' ? (c.operation === 'Галтовка' || c.operation?.startsWith('Галтовка')) : c.operation === op)
            return isMatchOp && stArr.includes(c.status)
          }).reduce((s, c) => s + (Number(c.quantity) || 0), 0)
        }

        const qCutWait = getQ(['Розкрій'], ['new', 'waiting-materials', 'waiting-machines'])
        const qCut = getQ(['Розкрій'], ['in-progress', 'paused', 'hold'])
        const qCutBuf = getQ(['Розкрій'], ['at-buffer'])
        const qGalt = getQ(['Галтовка'], ['in-progress'])
        const qGaltBuf = getQ(['Галтовка'], ['at-buffer'])
        const qPriy = getQ(['Прийомка'], ['new', 'in-progress', 'at-buffer'])
        const qSortAct = getQ(['Сортування'], ['new', 'in-progress', 'at-buffer'])
        const qSort = filteredCards.filter(c => {
          if (String(c.nomenclature_id) !== String(nom.id)) return false
          return c.status === 'at-shop2-buffer'
        }).reduce((s, c) => s + Math.max(0, (Number(c.quantity) || 0) - (Number(c.used_in_shop2_qty) || 0)), 0)

        const qMalWait = getQ(['Фарбування', 'Малярка'], ['new'])
        const qMal = getQ(['Фарбування', 'Малярка'], ['in-progress'])
        const qMalBuf = getQ(['Фарбування', 'Малярка'], ['at-buffer'])
        const qPresWait = getQ(['Пресування'], ['new'])
        const qPres = getQ(['Пресування'], ['in-progress'])
        const qPresBuf = getQ(['Пресування'], ['at-buffer'])
        const qDoopWait = getQ(['Доопрацювання'], ['new'])
        const qDoop = getQ(['Доопрацювання'], ['in-progress'])
        const qDoopBuf = getQ(['Доопрацювання'], ['at-buffer'])

        let initialStock = 0
        let plannedReserve = 0
        const orderTasks = tasks.filter(t => {
          if (!t.order_id || !orderIds.includes(t.order_id)) return false
          const o = ordersMap[t.order_id]
          if (!o) return false
          const oPid = o.nomenclature_id || o.order_items?.[0]?.nomenclature_id
          return String(oPid) === String(parentId)
        })
        const ordersWithTasks = Array.from(new Set(orderTasks.map(t => t.order_id)))
        ordersWithTasks.forEach(oid => {
          const taskWithSnap = orderTasks.find(t => t.order_id === oid && t.plan_snapshot && t.plan_snapshot[String(nom.id)])
          if (taskWithSnap) {
            const snapEntry = taskWithSnap.plan_snapshot[String(nom.id)] || {}
            const stock = Number(snapEntry.stock) || 0
            const sheets = Number(snapEntry.sheets) || 0
            const units = Number(snapEntry.units_per_sheet) || 1
            const need = Number(snapEntry.need) || 0
            initialStock += stock
            plannedReserve += Math.max(0, (sheets * units) + stock - need)
          }
        })

        const completedShop2Qty = filteredCards.filter(c => {
          if (String(c.nomenclature_id) !== String(nom.id)) return false
          if (c.task_id && taskParentMap[c.task_id] && taskParentMap[c.task_id] !== parentId) return false
          const op = (c.operation || '').toLowerCase()
          const isShop2 = ['пресування', 'фарбування', 'малярка', 'доопрацювання', 'пакування', 'сгп'].some(o => op.includes(o))
          return isShop2 && c.status === 'completed'
        }).reduce((s, c) => s + (Number(c.quantity) || 0), 0)

        const totalPotentialSgp = completedShop2Qty + initialStock
        const flowRowsForThisPart = flowTotalsRows.filter(row => {
          if (String(row.nomenclature_id) !== String(nom.id)) return false
          if (!row.task_id || !filterSet.has(row.task_id)) return false
          return !taskParentMap[row.task_id] || taskParentMap[row.task_id] === parentId
        })
        const flowScrapQty = sumFlowField(flowRowsForThisPart, 'total_scrap')
        const flowSgpQty = sumFlowField(flowRowsForThisPart, 'total_good', ['sgp'])
        const netSgpQty = Math.max(0, flowSgpQty - flowScrapQty)

        const groupProduced = filteredCards.filter(c => {
          if (String(c.nomenclature_id) !== String(nom.id)) return false
          if (c.task_id && taskParentMap[c.task_id] && taskParentMap[c.task_id] !== parentId) return false
          const op = (c.operation || '').toLowerCase()
          const isShop1 = ['розкрій', 'галтовка', 'прийомка', 'сортування'].some(o => op.includes(o))
          return isShop1 && (c.status === 'completed' || c.status === 'at-shop2-buffer')
        }).reduce((s, c) => s + (Number(c.quantity) || 0), 0)

        const sgpProduced = Math.max(0, groupProduced - qSort)
        const producedForSgp = groupProduced > 0 ? sgpProduced : netSgpQty
        const earlyWipQty = qCutWait + qCut + qCutBuf + qGalt + qGaltBuf + qPriy + qSortAct + qMalWait + qMal + qMalBuf + qPresWait + qPres + qPresBuf + qDoopWait + qDoop + qDoopBuf
        const nonReissueEarlyWip = Math.max(0, flowScrapQty - plannedReserve) > 0 ? 0 : earlyWipQty
        const qSgp = demandForParent > 0
          ? Math.min(demandForParent, producedForSgp, Math.max(0, demandForParent - nonReissueEarlyWip))
          : Math.max(0, producedForSgp)

        const totalShop2Qty = filteredCards.filter(c => {
          if (String(c.nomenclature_id) !== String(nom.id)) return false
          if (c.task_id && taskParentMap[c.task_id] && taskParentMap[c.task_id] !== parentId) return false
          const op = (c.operation || '').toLowerCase()
          return ['пресування', 'фарбування', 'малярка', 'доопрацювання', 'пакування', 'сгп'].some(o => op.includes(o))
        }).reduce((s, c) => s + (Number(c.quantity) || 0), 0)

        const bzExcess = Math.max(0, totalPotentialSgp - demandForParent)
        const flowBzQty = sumFlowField(flowRowsForThisPart, 'total_bz')
        const qBz = groupProduced > 0
          ? initialStock + Math.max(0, sgpProduced - demandForParent)
          : (flowRowsForThisPart.length > 0
            ? Math.max(flowBzQty, Math.max(0, netSgpQty - demandForParent))
            : Math.max(0, groupProduced - qSort - totalShop2Qty) + bzExcess)

        const cardIdsForThisPart = new Set(filteredCards.filter(c => {
          if (String(c.nomenclature_id) !== String(nom.id)) return false
          if (c.task_id && taskParentMap[c.task_id] && taskParentMap[c.task_id] !== parentId) return false
          return true
        }).map(c => c.id))
        const qScrapByScope = dashboardHistory.filter(h => {
          if (String(h.nomenclature_id) !== String(nom.id)) return false
          if (!h.task_id || !filterSet.has(h.task_id)) return false
          return !taskParentMap[h.task_id] || taskParentMap[h.task_id] === parentId
        }).reduce((s, h) => s + (Number(h.scrap_qty) || 0), 0)
        const qScrapByCard = dashboardHistory.filter(h => h.card_id && cardIdsForThisPart.has(h.card_id)).reduce((s, h) => s + (Number(h.scrap_qty) || 0), 0)
        const qScrap = qScrapByScope || qScrapByCard || flowScrapQty

        const sum = qCutWait + qCut + qCutBuf + qGalt + qGaltBuf + qPriy + qSortAct + qSort + qMalWait + qMal + qMalBuf + qPresWait + qPres + qPresBuf + qDoopWait + qDoop + qDoopBuf + qSgp + qBz

        const matchSearch = !searchQuery ||
          nom.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (nom.code || '').toLowerCase().includes(searchQuery.toLowerCase())

        if (matchSearch && (demandForParent > 0 || qSort > 0)) {
          groups[parentId].rows.push({
            id: nom.id + '_' + parentId,
            nomId: nom.id,
            parentId,
            name: nom.name,
            code: nom.code || '',
            demand: demandForParent,
            qtyPerProduct,
            qCutWait, qCut, qCutBuf, qGalt, qGaltBuf, qPriy,
            qSortAct, qSort, qMalWait, qMal, qMalBuf, qPresWait, qPres,
            qPresBuf, qDoopWait, qDoop, qDoopBuf, qSgp, qBz, qScrap, sum
          })
        }
      })
    })

    return Object.values(groups).filter(g => g.rows.length > 0)
  }

  // ── Overview WIP groups ──
  const overviewGroups = useMemo(() => {
    if (!selectedTaskId) {
      return buildWipGroups(activeTasks.map(t => t.id))
    }
    return buildWipGroups([selectedTaskId])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTaskId, dashboardCards, dashboardHistory, flowTotalsRows, inventory, nomenclatures, bomItems, tasks, orders, searchQuery])

  // ── Handle cell click ──
  const handleCellClick = (row, stageKey, stageName, group) => {
    const nomId = String(row.nomId || row.id.split('_')[0] || '')
    const rowParentId = String(row.parentId || '')
    const nomCards = (dashboardCards || []).filter(c => {
      if (String(c.nomenclature_id) !== nomId) return false
      if (!c.task_id) return false
      const tp = globalTaskParentMap[c.task_id]
      if (tp && tp !== rowParentId) return false
      return true
    })

    const matchOpsAndStatus = (ops, statuses) => {
      const opArr = Array.isArray(ops) ? ops : [ops]
      const stArr = Array.isArray(statuses) ? statuses : [statuses]
      return nomCards.filter(c => {
        const isMatchOp = opArr.some(op => op === 'Галтовка' ? (c.operation === 'Галтовка' || c.operation?.startsWith('Галтовка')) : c.operation === op)
        return isMatchOp && stArr.includes(c.status)
      })
    }

    let matchingCards = []
    if (stageKey === 'qCutWait') matchingCards = matchOpsAndStatus(['Розкрій'], ['new', 'waiting-materials', 'waiting-machines'])
    else if (stageKey === 'qCut') matchingCards = matchOpsAndStatus(['Розкрій'], ['in-progress', 'paused', 'hold'])
    else if (stageKey === 'qCutBuf') matchingCards = matchOpsAndStatus(['Розкрій'], ['at-buffer'])
    else if (stageKey === 'qGalt') matchingCards = matchOpsAndStatus(['Галтовка'], ['in-progress'])
    else if (stageKey === 'qGaltBuf') matchingCards = matchOpsAndStatus(['Галтовка'], ['at-buffer'])
    else if (stageKey === 'qPriy') matchingCards = matchOpsAndStatus(['Прийомка'], ['new', 'in-progress', 'at-buffer'])
    else if (stageKey === 'qSortAct') matchingCards = matchOpsAndStatus(['Сортування'], ['new', 'in-progress', 'at-buffer'])
    else if (stageKey === 'qSort') matchingCards = nomCards.filter(c => c.status === 'at-shop2-buffer')
    else if (stageKey === 'qMalWait') matchingCards = matchOpsAndStatus(['Фарбування', 'Малярка'], ['new'])
    else if (stageKey === 'qMal') matchingCards = matchOpsAndStatus(['Фарбування', 'Малярка'], ['in-progress'])
    else if (stageKey === 'qMalBuf') matchingCards = matchOpsAndStatus(['Фарбування', 'Малярка'], ['at-buffer'])
    else if (stageKey === 'qPresWait') matchingCards = matchOpsAndStatus(['Пресування'], ['new'])
    else if (stageKey === 'qPres') matchingCards = matchOpsAndStatus(['Пресування'], ['in-progress'])
    else if (stageKey === 'qPresBuf') matchingCards = matchOpsAndStatus(['Пресування'], ['at-buffer'])
    else if (stageKey === 'qDoopWait') matchingCards = matchOpsAndStatus(['Доопрацювання'], ['new'])
    else if (stageKey === 'qDoop') matchingCards = matchOpsAndStatus(['Доопрацювання'], ['in-progress'])
    else if (stageKey === 'qDoopBuf') matchingCards = matchOpsAndStatus(['Доопрацювання'], ['at-buffer'])
    else if (stageKey === 'qSgp') matchingCards = nomCards.filter(c => ['пакування', 'сгп'].some(o => (c.operation || '').toLowerCase().includes(o)) && c.status === 'completed')
    else if (stageKey === 'qBz') matchingCards = nomCards.filter(c => c.operation === 'Склад БЗ')
    else if (stageKey === 'qScrap') matchingCards = nomCards.filter(c => Number(c.scrap_qty || 0) > 0)
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
      await fetchData(['orders', 'tasks', 'inventory', 'nomenclatures', 'bom_items', 'work_card_scrap_totals', 'work_card_flow_totals'])
      await loadAllTasksCards(relevantTasks)
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
