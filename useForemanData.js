import { useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from '../../../supabase'
import { useMES } from '../../../MESContext'

export const countAsProduced = (card) => {
  if (card.status === 'completed') return true
  if (card.status === 'at-shop2-buffer') return true
  return false
}

export function useForemanData(activeTaskId, setActiveTaskId, setActiveView) {
  const {
    tasks,
    orders,
    workCards,
    nomenclatures,
    bomItems,
    fetchTaskArchiveCards,
    fetchTaskPlanSnapshot,
    fetchData,
    machines
  } = useMES()

  const [archiveCards, setArchiveCards] = useState([])
  const [taskHistory, setTaskHistory] = useState([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [staticCompletedCards, setStaticCompletedCards] = useState([])
  const [staticHistory, setStaticHistory] = useState([])
  const [allOrdersMap, setAllOrdersMap] = useState({})

  const taskDataCacheRef = useRef({
    archiveCards: {},
    taskHistory: {},
    lastWorkCards: null
  })

  // ── Load static completed progress for ALL relevant tasks ──────────────
  useEffect(() => {
    if (tasks.length === 0) return

    const taskIds = tasks.filter(t => t.status !== 'completed').map(t => t.id)
    if (taskIds.length === 0) return

    supabase
      .from('work_cards')
      .select('id, task_id, nomenclature_id, quantity, operation, status, card_info')
      .in('task_id', taskIds)
      .then(async ({ data: cardsData, error: cardsError }) => {
        if (cardsError) {
          console.error('Error fetching cards for static progress:', cardsError)
          return
        }
        
        const completedCards = (cardsData || []).filter(c => c.status === 'completed')
        setStaticCompletedCards(completedCards)

        const cardIds = (cardsData || []).map(c => c.id)
        if (cardIds.length > 0) {
          const chunkSize = 100
          const promises = []
          for (let i = 0; i < cardIds.length; i += chunkSize) {
            const chunk = cardIds.slice(i, i + chunkSize)
            promises.push(
              supabase
                .from('work_card_history')
                .select('id, card_id, nomenclature_id, scrap_qty')
                .in('card_id', chunk)
                .limit(5000)
            )
          }
          const results = await Promise.all(promises)
          const historyData = results.flatMap(res => res.data || [])
          setStaticHistory(historyData)
        } else {
          setStaticHistory([])
        }
      })
  }, [tasks])

  // Sync staticHistory with real-time workCardHistory
  const { workCardHistory } = useMES()
  useEffect(() => {
    if (staticCompletedCards.length === 0 || workCardHistory.length === 0) return
    const completedCardIds = new Set(staticCompletedCards.map(c => String(c.id)))
    const relevantNew = workCardHistory.filter(h => h.card_id && completedCardIds.has(String(h.card_id)))
    if (relevantNew.length === 0) return
    setStaticHistory(prev => {
      const existingIds = new Set(prev.map(h => h.id))
      const toAdd = relevantNew.filter(h => !existingIds.has(h.id))
      if (toAdd.length === 0) return prev
      return [...prev, ...toAdd]
    })
  }, [workCardHistory, staticCompletedCards])

  // Load orders for all relevant tasks
  useEffect(() => {
    if (tasks.length === 0) return

    const neededIds = [...new Set(tasks.map(t => t.order_id).filter(Boolean))]
    const missingIds = neededIds.filter(id =>
      !orders.find(o => String(o.id) === String(id)) &&
      !allOrdersMap[id]
    )

    if (missingIds.length === 0) return

    supabase
      .from('orders')
      .select('*, order_items(*)')
      .in('id', missingIds)
      .then(({ data, error }) => {
        if (error) {
          console.error('Error fetching missing orders for Foreman:', error)
          return
        }
        if (data && data.length > 0) {
          setAllOrdersMap(prev => {
            const next = { ...prev }
            data.forEach(o => { next[o.id] = o })
            return next
          })
        }
      })
  }, [tasks, orders, allOrdersMap])

  // Load archive cards and history on active task change
  useEffect(() => {
    if (activeTaskId) {
      if (taskDataCacheRef.current.lastWorkCards !== workCards) {
        delete taskDataCacheRef.current.archiveCards[activeTaskId]
        delete taskDataCacheRef.current.taskHistory[activeTaskId]
        taskDataCacheRef.current.lastWorkCards = workCards
      }

      if (typeof fetchTaskPlanSnapshot === 'function') {
        fetchTaskPlanSnapshot(activeTaskId).catch(() => {})
      }

      const cachedCards = taskDataCacheRef.current.archiveCards[activeTaskId]
      const cachedHistory = taskDataCacheRef.current.taskHistory[activeTaskId]

      if (cachedCards && cachedHistory) {
        setArchiveCards(cachedCards)
        setTaskHistory(cachedHistory)
        setIsLoadingHistory(false)
        return
      }

      setIsLoadingHistory(true)
      fetchTaskArchiveCards(activeTaskId).then(async (cards) => {
        setArchiveCards(cards || [])

        const activeTaskCards = workCards.filter(c => c.task_id === activeTaskId)
        const allTaskCards = [...activeTaskCards, ...(cards || [])]
        const cardIds = allTaskCards.map(c => c.id)
        let histData = []
        if (cardIds.length > 0) {
          const chunkSize = 100
          const promises = []
          for (let i = 0; i < cardIds.length; i += chunkSize) {
            const chunk = cardIds.slice(i, i + chunkSize)
            promises.push(
              supabase
                .from('work_card_history')
                .select('*')
                .in('card_id', chunk)
                .limit(5000)
            )
          }
          const results = await Promise.all(promises)
          histData = results.flatMap(r => r.data || [])
          setTaskHistory(histData)
        } else {
          setTaskHistory([])
        }

        taskDataCacheRef.current.archiveCards[activeTaskId] = cards || []
        taskDataCacheRef.current.taskHistory[activeTaskId] = histData
        setIsLoadingHistory(false)
      }).catch(() => {
        setIsLoadingHistory(false)
      })
    } else {
      setArchiveCards([])
      setTaskHistory([])
      setIsLoadingHistory(false)
    }
  }, [activeTaskId, workCards, fetchTaskPlanSnapshot, fetchTaskArchiveCards])

  // Compute production, scrap, and redo caches
  const { productionCache, scrapCache, redoCache, allCardsCache, cardScrapCache } = useMemo(() => {
    const prodCache = {}
    const sCache = {}
    const rCache = {}
    const csCache = {}

    const activeTaskIds = new Set(tasks.filter(t => t.status !== 'completed').map(t => t.id))
    const activeCards = workCards.filter(c => activeTaskIds.has(c.task_id))

    const cachedArchiveCards = []
    if (taskDataCacheRef.current && taskDataCacheRef.current.archiveCards) {
      Object.keys(taskDataCacheRef.current.archiveCards).forEach(tid => {
        const list = taskDataCacheRef.current.archiveCards[tid] || []
        list.forEach(c => {
          if (!activeCards.some(ac => ac.id === c.id) && !staticCompletedCards.some(sc => sc.id === c.id)) {
            cachedArchiveCards.push(c)
          }
        })
      })
    }

    const allCards = [...activeCards, ...staticCompletedCards, ...cachedArchiveCards]

    allCards.forEach(card => {
      const tid = card.task_id
      const nid = String(card.nomenclature_id)

      if (!prodCache[tid]) prodCache[tid] = {}
      if (!sCache[tid]) sCache[tid] = {}
      if (!rCache[tid]) rCache[tid] = {}

      if (countAsProduced(card)) {
        prodCache[tid][nid] = (prodCache[tid][nid] || 0) + (Number(card.quantity) || 0)
      }

      const isRedo = (card.card_info || '').includes('[REDO]')
      const isActive = !countAsProduced(card)
      if (isRedo && isActive) {
        rCache[tid][nid] = true
      }
    })

    const activeCardIds = new Set(activeCards.map(c => c.id))
    const activeHistory = workCardHistory.filter(h => h.card_id && activeCardIds.has(h.card_id))

    const cachedHistory = []
    if (taskDataCacheRef.current && taskDataCacheRef.current.taskHistory) {
      Object.keys(taskDataCacheRef.current.taskHistory).forEach(tid => {
        const list = taskDataCacheRef.current.taskHistory[tid] || []
        list.forEach(h => { cachedHistory.push(h) })
      })
    }

    const historyMap = new Map();
    [...staticHistory, ...activeHistory, ...cachedHistory].forEach(h => {
      if (h && h.id && !historyMap.has(h.id)) historyMap.set(h.id, h)
    })
    const allHistory = Array.from(historyMap.values())

    allHistory.forEach(h => {
      if (h.card_id) {
        csCache[h.card_id] = (csCache[h.card_id] || 0) + (Number(h.scrap_qty) || 0)
      }
      const card = allCards.find(c => c.id === h.card_id)
      if (card) {
        const tid = card.task_id
        const nid = String(card.nomenclature_id)
        if (!sCache[tid]) sCache[tid] = {}
        sCache[tid][nid] = (sCache[tid][nid] || 0) + (Number(h.scrap_qty) || 0)
      }
    })

    return {
      productionCache: prodCache,
      scrapCache: sCache,
      redoCache: rCache,
      allCardsCache: allCards,
      cardScrapCache: csCache
    }
  }, [tasks, workCards, workCardHistory, staticCompletedCards, staticHistory, archiveCards, taskHistory])

  // Helper functions
  const getBOMParts = (nomenclatureId) => {
    return bomItems
      .filter(b => b.parent_id === nomenclatureId)
      .map(b => ({
        ...b,
        nom: nomenclatures.find(n => n.id === b.child_id)
      }))
  }

  const getDisplayPartsForOrderItem = (task, it) => {
    if (task?.plan_snapshot) {
      const partsFromSnapshot = Object.values(task.plan_snapshot)
        .filter(p => p && String(p.order_item_id) === String(it.id))
        .map(p => {
          const nom = nomenclatures.find(n => String(n.id) === String(p.id))
          return {
            nom: nom || { id: p.id, name: p.name, nomenclature_code: p.code, material_type: p.material, type: 'part' },
            quantity_per_parent: p.need / (Number(it.quantity) || 1)
          }
        })
      if (partsFromSnapshot.length > 0) return partsFromSnapshot
    }
    const parts = getBOMParts(it.nomenclature_id)
    return parts.length > 0 ? parts : [{ nom: nomenclatures.find(n => n.id === it.nomenclature_id), quantity_per_parent: 1 }]
  }

  const taskCardsCountMap = useMemo(() => {
    const map = {}
    tasks.forEach(task => {
      map[task.id] = workCards.filter(c => c.task_id === task.id && c.operation !== 'Склад БЗ').length
    })
    return map
  }, [tasks, workCards])

  const taskReadinessMap = useMemo(() => {
    const map = {}
    tasks.forEach(task => {
      if (task.status === 'completed') { map[task.id] = false; return }
      const order = task.orders || orders.find(o => o.id === task.order_id) || allOrdersMap[task.order_id]
      const taskCache = productionCache[task.id] || {}

      const isReady = order?.order_items?.every(item => {
        const rows = getDisplayPartsForOrderItem(task, item)
        const shop1Parts = rows.filter(r => r.nom?.type === 'part')
        if (shop1Parts.length === 0) return true
        return shop1Parts.every(part => {
          const nomId = String(part.nom?.id)
          const snapshot = task.plan_snapshot?.[nomId]
          const need = snapshot
            ? snapshot.need
            : (Number(item.quantity) * (Number(part.quantity_per_parent) || 1))
          if (need === 0) return true

          const produced = taskCache[nomId] || 0
          return produced >= need
        })
      })
      const taskCards = allCardsCache.filter(c => c.task_id === task.id)
      const hasActiveInProgressCards = taskCards.some(c => !countAsProduced(c))
      map[task.id] = Boolean(isReady) && !hasActiveInProgressCards
    })
    return map
  }, [tasks, orders, allOrdersMap, nomenclatures, bomItems, productionCache, allCardsCache])

  const taskShortageMap = useMemo(() => {
    const map = {}
    tasks.forEach(task => {
      if (task.status === 'completed') { map[task.id] = false; return }
      const snapshot = task.plan_snapshot || {}
      const taskScrap = scrapCache[task.id] || {}
      const taskRedo = redoCache[task.id] || {}
      const taskCards = allCardsCache.filter(c => c.task_id === task.id)

      let hasShortage = false
      Object.keys(snapshot).forEach(nomId => {
        if (nomId.startsWith('_') || nomId === 'materialSummary' || nomId === 'selectedCutters' || nomId === 'consumables') return
        const entry = snapshot[nomId]
        if (!entry) return
        const sheetsNeeded = Number(entry.sheets) || 0
        if (sheetsNeeded <= 0) return

        const produced = (productionCache[task.id] || {})[nomId] || 0
        const plannedNeed = Number(entry.plan) || 0

        if (produced < plannedNeed) {
          hasShortage = true
        } else if (produced === plannedNeed) {
          const activeCards = taskCards.filter(c => String(c.nomenclature_id) === String(nomId) && !countAsProduced(c))
          if (activeCards.length > 0) {
            hasShortage = true
          }
        }
      })
      map[task.id] = hasShortage
    })
    return map
  }, [tasks, productionCache, scrapCache, redoCache, allCardsCache])

  return {
    archiveCards,
    setArchiveCards,
    taskHistory,
    setTaskHistory,
    isLoadingHistory,
    setIsLoadingHistory,
    staticCompletedCards,
    staticHistory,
    allOrdersMap,
    productionCache,
    scrapCache,
    redoCache,
    allCardsCache,
    cardScrapCache,
    taskCardsCountMap,
    taskReadinessMap,
    taskShortageMap,
    getDisplayPartsForOrderItem,
    getBOMParts
  }
}
