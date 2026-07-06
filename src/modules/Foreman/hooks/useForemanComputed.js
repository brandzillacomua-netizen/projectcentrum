import { useMemo, useEffect } from 'react'
import { countAsProduced, getDisplayPartsForOrderItem, SHORTAGE_CACHE_KEY } from '../utils/foremanHelpers'

export function useForemanComputed({
  tasks, orders, allOrdersMap, workCards, workCardHistory,
  staticCompletedCards, staticHistory, archiveCards, taskHistory,
  nomenclatures, bomItems, taskDataCacheRef,
  cachedShortageMap,
  staticHistoryLength
}) {
  // ── Merge all cards + compute production/scrap/redo caches ──────────
  const { productionCache, scrapCache, redoCache, allCardsCache, cardScrapCache } = useMemo(() => {
    const prodCache = {}
    const sCache = {}
    const rCache = {}
    const csCache = {}

    const activeTaskIds = new Set(tasks.filter(t => t.status !== 'completed').map(t => t.id))
    const activeCards = workCards.filter(c => activeTaskIds.has(c.task_id))

    const cachedArchiveCards = []
    if (taskDataCacheRef.current?.archiveCards) {
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
      if (isRedo && isActive) rCache[tid][nid] = true
    })

    const activeCardIds = new Set(activeCards.map(c => c.id))
    const activeHistory = workCardHistory.filter(h => h.card_id && activeCardIds.has(h.card_id))

    const cachedHistory = []
    if (taskDataCacheRef.current?.taskHistory) {
      Object.keys(taskDataCacheRef.current.taskHistory).forEach(tid => {
        const list = taskDataCacheRef.current.taskHistory[tid] || []
        list.forEach(h => { cachedHistory.push(h) })
      })
    }

    const historyMap = new Map()
    ;[...staticHistory, ...activeHistory, ...cachedHistory].forEach(h => {
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

    return { productionCache: prodCache, scrapCache: sCache, redoCache: rCache, allCardsCache: allCards, cardScrapCache: csCache }
  }, [tasks, workCards, workCardHistory, staticCompletedCards, staticHistory, archiveCards, taskHistory])

  // ── taskCardsCountMap ──────────────────────────────────────────────
  const taskCardsCountMap = useMemo(() => {
    const map = {}
    tasks.forEach(task => {
      map[task.id] = workCards.filter(c => c.task_id === task.id && c.operation !== 'Склад БЗ').length
    })
    return map
  }, [tasks, workCards])

  // ── taskReadinessMap ───────────────────────────────────────────────
  const taskReadinessMap = useMemo(() => {
    const map = {}
    tasks.forEach(task => {
      if (task.status === 'completed') { map[task.id] = false; return }
      const order = task.orders || orders.find(o => o.id === task.order_id) || allOrdersMap[task.order_id]
      const taskCache = productionCache[task.id] || {}
      const isReady = order?.order_items?.every(item => {
        const rows = getDisplayPartsForOrderItem(task, item, bomItems, nomenclatures)
        const shop1Parts = rows.filter(r => r.nom?.type === 'part')
        if (shop1Parts.length === 0) return true
        return shop1Parts.every(part => {
          const nomId = String(part.nom?.id)
          const snapshot = task.plan_snapshot?.[nomId]
          const need = snapshot ? snapshot.need : (Number(item.quantity) * (Number(part.quantity_per_parent) || 1))
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
  }, [tasks, orders, allOrdersMap, nomenclatures, bomItems, productionCache, allCardsCache, scrapCache])

  // ── taskShortageMap ────────────────────────────────────────────────
  const taskShortageMapComputed = useMemo(() => {
    const map = {}
    tasks.forEach(task => {
      if (task.status === 'completed') { map[task.id] = false; return }
      const snapshot = task.plan_snapshot || {}
      const taskScrap = scrapCache[task.id] || {}
      const taskCards = allCardsCache.filter(c => c.task_id === task.id)

      let hasShortage = false
      Object.keys(snapshot).forEach(nomIdStr => {
        if (hasShortage) return
        const nom = nomenclatures.find(n => String(n.id) === String(nomIdStr))
        if (nom?.type !== 'part') return
        const snap = snapshot[nomIdStr]
        if (!snap) return
        const need = Number(snap.need) || 0
        const stockBZ = Number(snap.stock) || 0
        const unitsPerSheet = Number(snap.units_per_sheet) || Number(nom?.units_per_sheet) || 1
        const nomCards = taskCards.filter(c => String(c.nomenclature_id) === String(nomIdStr))
        const productionCards = nomCards.filter(c => c.operation !== 'Склад БЗ')
        if (nomCards.length === 0) return
        const totalSheets = productionCards.reduce((sum, c) => {
          const cardScrap = cardScrapCache[c.id] || 0
          const originalQty = (Number(c.quantity) || 0) + cardScrap
          return sum + (c.actualSheets ? Number(c.actualSheets) : Math.ceil(originalQty / unitsPerSheet))
        }, 0)
        const plannedSheets = Number(snap.sheets) || 0
        const totalSheetsMax = productionCards.length > 0 ? Math.max(plannedSheets, totalSheets) : plannedSheets
        const totalBZ = (totalSheetsMax * unitsPerSheet) + stockBZ - need
        const groupScrap = taskScrap[nomIdStr] || 0
        const shortage = (totalBZ - groupScrap) < 0 ? Math.abs(totalBZ - groupScrap) : 0
        if (shortage > 0) hasShortage = true
      })
      map[task.id] = hasShortage
    })
    return map
  }, [tasks, scrapCache, nomenclatures, allCardsCache, cardScrapCache])


  // ── relevantTasks ──────────────────────────────────────────────────
  const relevantTasks = useMemo(() => {
    return tasks
      .filter(t => {
        const stepName = (t.step || '').toLowerCase()
        const isLaser = stepName.includes('розкрій') || stepName.includes('різка')
        if (t.status !== 'completed') {
          return (t.warehouse_conf === 'true' || t.warehouse_conf === 'partial') && t.engineer_conf && t.director_conf && isLaser
        }
        const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
        const isRecent = (t.completed_at && new Date(t.completed_at) > threeDaysAgo) || (t.updated_at && new Date(t.updated_at) > threeDaysAgo)
        return isRecent && (isLaser || !t.step)
      })
      .sort((a, b) => {
        if (a.status === 'completed' && b.status !== 'completed') return 1
        if (a.status !== 'completed' && b.status === 'completed') return -1
        const aShortage = taskShortageMapComputed[a.id] || cachedShortageMap[a.id] || false
        const bShortage = taskShortageMapComputed[b.id] || cachedShortageMap[b.id] || false
        if (aShortage && !bShortage) return -1
        if (!aShortage && bShortage) return 1
        return new Date(b.created_at) - new Date(a.created_at)
      })
  }, [tasks, taskReadinessMap, taskShortageMapComputed, cachedShortageMap, taskCardsCountMap, staticHistoryLength])

  const activeQueueCount = useMemo(() => relevantTasks.filter(t => t.status !== 'completed').length, [relevantTasks])

  // Persist shortage map to localStorage so it survives page reloads
  useEffect(() => {
    if (Object.keys(taskShortageMapComputed).length > 0) {
      try { localStorage.setItem(SHORTAGE_CACHE_KEY, JSON.stringify(taskShortageMapComputed)) } catch {}
    }
  }, [taskShortageMapComputed])

  return {
    productionCache, scrapCache, redoCache, allCardsCache, cardScrapCache,
    taskCardsCountMap, taskReadinessMap,
    taskShortageMap: taskShortageMapComputed,
    relevantTasks, activeQueueCount
  }
}
