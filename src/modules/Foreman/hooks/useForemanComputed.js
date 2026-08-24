import { useMemo, useEffect } from 'react'
import { countAsProduced, getDisplayPartsForOrderItem, getScrapBreakdown, SHORTAGE_CACHE_KEY, findMachineByName } from '../utils/foremanHelpers'

export function useForemanComputed({
  tasks, orders, allOrdersMap, workCards, workCardHistory,
  workCardScrapTotals = [],
  workCardFinalScrapTotals = [],
  hasFinalScrapProjection = false,
  staticCompletedCards, staticHistory, archiveCards, taskHistory,
  nomenclatures, bomItems, taskDataCacheRef,
  cachedShortageMap,
  staticHistoryLength,
  machines
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

    const activeCardIds = new Set(activeCards.map(c => String(c.id)))
    const uniqueStaticCompleted = staticCompletedCards.filter(c => !activeCardIds.has(String(c.id)))
    const allCards = [...activeCards, ...uniqueStaticCompleted, ...cachedArchiveCards]

    allCards.forEach(card => {
      const tid = card.task_id
      const nid = String(card.nomenclature_id)
      if (!prodCache[tid]) prodCache[tid] = {}
      if (!sCache[tid]) sCache[tid] = {}
      if (!rCache[tid]) rCache[tid] = {}
      if (countAsProduced(card)) {
        prodCache[tid][nid] = (prodCache[tid][nid] || 0) + (Number(card.quantity) || 0)
      }
      const isRedo = (card.card_info || '').includes('[REDO]') || Boolean(card.is_rework)
      if (isRedo) {
        rCache[tid] = true
      }
    })

    const activeHistory = workCardHistory.filter(h => h.card_id && activeCardIds.has(String(h.card_id)))

    const cachedHistory = []
    if (taskDataCacheRef.current?.taskHistory) {
      Object.keys(taskDataCacheRef.current.taskHistory).forEach(tid => {
        const list = taskDataCacheRef.current.taskHistory[tid] || []
        list.forEach(h => { cachedHistory.push(h) })
      })
    }

    const cardsById = new Map(allCards.map(card => [String(card.id), card]))
    workCards.forEach(card => {
      const key = String(card.id)
      if (!cardsById.has(key)) cardsById.set(key, card)
    })

    const totals = (workCardScrapTotals || []).filter(row => (Number(row.total_scrap) || 0) > 0)

    if (totals.length > 0) {
      totals.forEach(row => {
        const scrap = Number(row.total_scrap) || 0
        const cardId = row.card_id ? String(row.card_id) : null
        if (cardId) csCache[cardId] = (csCache[cardId] || 0) + scrap
        const card = cardId ? cardsById.get(cardId) : null
        const tid = row.task_id || card?.task_id
        const nid = String(row.nomenclature_id || card?.nomenclature_id || '')
        if (!tid || !nid) return
        if (!sCache[tid]) sCache[tid] = {}
        sCache[tid][nid] = (sCache[tid][nid] || 0) + scrap
      })
    } else {
      const historyMap = new Map()
      ;[...staticHistory, ...activeHistory, ...cachedHistory].forEach(h => {
        if (h && h.id && !historyMap.has(h.id)) historyMap.set(h.id, h)
      })
      const allHistory = Array.from(historyMap.values())

      allHistory.forEach(h => {
        if (h.card_id) {
          csCache[h.card_id] = (csCache[h.card_id] || 0) + (Number(h.scrap_qty) || 0)
        }
        const card = h.card_id ? cardsById.get(String(h.card_id)) : null
        if (card) {
          const tid = card.task_id
          const nid = String(card.nomenclature_id)
          if (!sCache[tid]) sCache[tid] = {}
          sCache[tid][nid] = (sCache[tid][nid] || 0) + (Number(h.scrap_qty) || 0)
        }
      })
    }

    if (hasFinalScrapProjection) {
      Object.keys(sCache).forEach(taskId => { sCache[taskId] = {} })
      ;(workCardFinalScrapTotals || []).forEach(row => {
        const scrap = Number(row.total_scrap) || 0
        const tid = row.task_id
        const nid = String(row.nomenclature_id || '')
        if (!tid || !nid || scrap <= 0) return
        if (!sCache[tid]) sCache[tid] = {}
        sCache[tid][nid] = (sCache[tid][nid] || 0) + scrap
      })
    }

    return { productionCache: prodCache, scrapCache: sCache, redoCache: rCache, allCardsCache: allCards, cardScrapCache: csCache }
  }, [tasks, workCards, workCardHistory, workCardScrapTotals, workCardFinalScrapTotals, hasFinalScrapProjection, staticCompletedCards, staticHistory, archiveCards, taskHistory])

  // ── taskCardsCountMap ──────────────────────────────────────────────
  const taskCardsCountMap = useMemo(() => {
    const map = {}
    tasks.forEach(task => {
      map[task.id] = allCardsCache.filter(c => c.task_id === task.id && c.operation !== 'Склад БЗ').length
    })
    return map
  }, [tasks, allCardsCache])

  // ── taskReadinessMap ───────────────────────────────────────────────
  const taskReadinessMap = useMemo(() => {
    const map = {}
    tasks.forEach(task => {
      if (task.status === 'completed') { map[task.id] = false; return }
      const snapshot = task.plan_snapshot || {}
      const taskCards = allCardsCache.filter(c => c.task_id === task.id && c.operation !== 'Склад БЗ')

      if (taskCards.length === 0) { map[task.id] = false; return }
      const hasActiveInProgressCards = taskCards.some(c => !countAsProduced(c))
      if (hasActiveInProgressCards) { map[task.id] = false; return }

      const hasUnfinishedRedoCard = taskCards.some(c => ((c.card_info || '').includes('[REDO]') || Boolean(c.is_rework)) && !countAsProduced(c))

      const partIds = Object.keys(snapshot).filter(idStr => {
        if (idStr.startsWith('_') || ['materialSummary', 'arrivals', 'arrival_doc_id', 'arrival_doc', 'nomenclatures', 'selectedCutters', 'consumables'].includes(idStr)) return false
        const snap = snapshot[idStr]
        return snap && typeof snap === 'object' && Number(snap.need || 0) > 0
      })

      if (partIds.length === 0) { map[task.id] = false; return }

      let hasAnyPartShortage = false
      const allPartsSatisfied = partIds.every(nomIdStr => {
        const snap = snapshot[nomIdStr]
        const need = Number(snap?.need) || 0
        if (need === 0) return true

        const nom = nomenclatures.find(n => String(n.id) === String(nomIdStr) || String(n.id) === String(snap?.id) || n.name === nomIdStr || n.nomenclature_code === nomIdStr)
        const targetNomId = nom ? String(nom.id) : (snap?.id ? String(snap.id) : String(nomIdStr))

        const laserCards = allCardsCache.filter(c => c.task_id === task.id && (String(c.nomenclature_id) === targetNomId || String(c.nomenclature_id) === String(nomIdStr) || (nom && String(c.nomenclature_id) === String(nom.id))) && c.operation !== 'Склад БЗ')

        const grossProduced = laserCards
          .filter(c => countAsProduced(c))
          .reduce((sum, c) => sum + (Number(c.quantity) || 0), 0)

        const stockBZ = Number(snap?.stock) || 0
        const netAvailable = grossProduced + stockBZ

        if (netAvailable < need) {
          hasAnyPartShortage = true
        }

        return netAvailable >= need
      })

      map[task.id] = allPartsSatisfied && !hasUnfinishedRedoCard && !hasAnyPartShortage
    })
    return map
  }, [tasks, nomenclatures, staticHistory, workCardHistory, allCardsCache])

  // ── taskShortageMap ────────────────────────────────────────────────
  const taskShortageMapComputed = useMemo(() => {
    const map = {}
    tasks.forEach(task => {
      if (task.status === 'completed') { map[task.id] = false; return }
      const snapshot = task.plan_snapshot || {}
      const taskCards = allCardsCache.filter(c => c.task_id === task.id && c.operation !== 'Склад БЗ')

      if (taskCards.length === 0) { map[task.id] = false; return }

      const hasUnfinishedRedoCard = taskCards.some(c => ((c.card_info || '').includes('[REDO]') || Boolean(c.is_rework)) && !countAsProduced(c))

      const partIds = Object.keys(snapshot).filter(idStr => {
        if (idStr.startsWith('_') || ['materialSummary', 'arrivals', 'arrival_doc_id', 'arrival_doc', 'nomenclatures', 'selectedCutters', 'consumables'].includes(idStr)) return false
        const snap = snapshot[idStr]
        return snap && typeof snap === 'object' && Number(snap.need || 0) > 0
      })

      let hasShortage = false
      partIds.forEach(nomIdStr => {
        if (hasShortage) return
        const snap = snapshot[nomIdStr]
        const need = Number(snap?.need) || 0
        if (need === 0) return

        const nom = nomenclatures.find(n => String(n.id) === String(nomIdStr) || String(n.id) === String(snap?.id) || n.name === nomIdStr || n.nomenclature_code === nomIdStr)
        const targetNomId = nom ? String(nom.id) : (snap?.id ? String(snap.id) : String(nomIdStr))

        const laserCardsAll = allCardsCache.filter(c => c.task_id === task.id && (String(c.nomenclature_id) === targetNomId || String(c.nomenclature_id) === String(nomIdStr) || (nom && String(c.nomenclature_id) === String(nom.id))) && c.operation !== 'Склад БЗ')
        if (laserCardsAll.length === 0) return

        const unitsPerSheet = Number(nom?.units_per_sheet) || 1
        const plan = Number(snap?.plan || snap?.need || need) || 0
        const sheets = Number(snap?.sheets || snap?.count || snap?.sheets_count) || Math.ceil(plan / unitsPerSheet) || 0
        const loadCapacity = Number(snap?.load_capacity || snap?.custom_capacity) || findMachineByName(snap?.machine, machines)?.sheet_capacity || 4
        const targetTotalCards = Math.ceil(sheets / (loadCapacity || 1))

        let generatedSheets = 0
        let generatedQty = 0
        laserCardsAll.forEach(c => {
          generatedSheets += Math.ceil(Number(c.quantity) / (unitsPerSheet || 1))
          generatedQty += Number(c.quantity)
        })

        const isPlanFullyGenerated = 
          (targetTotalCards > 0 && laserCardsAll.length >= targetTotalCards) ||
          (sheets > 0 && generatedSheets >= sheets) ||
          (plan > 0 && generatedQty >= plan)

        const grossProduced = laserCardsAll
          .filter(c => countAsProduced(c))
          .reduce((sum, c) => sum + (Number(c.quantity) || 0), 0)

        const stockBZ = Number(snap?.stock) || 0
        const netAvailable = grossProduced + stockBZ
        const plannedTotalQty = (sheets * unitsPerSheet) + stockBZ
        const spareFromSheets = Math.max(0, plannedTotalQty - need)

        const totalScrap = scrapCache?.[task.id]?.[targetNomId] || 0
        const rawPartShortage = Math.max(0, totalScrap - spareFromSheets)
        const partShortage = Math.min(rawPartShortage, Math.max(0, need - netAvailable))

        const allCardsFinished = laserCardsAll.length > 0 && laserCardsAll.every(c => countAsProduced(c))

        if (partShortage > 0 || (allCardsFinished && netAvailable < need)) {
          hasShortage = true
        }
      })

      map[task.id] = hasShortage || hasUnfinishedRedoCard
    })
    return map
  }, [tasks, nomenclatures, staticHistory, workCardHistory, allCardsCache])


  // ── relevantTasks ──────────────────────────────────────────────────
  const relevantTasks = useMemo(() => {
    const getPriority = (t) => {
      if (t.status === 'completed') return 4
      const cardsCount = taskCardsCountMap?.[t.id] || 0
      if (cardsCount === 0) return 0 // 🔵 1. НОВІ

      const isReady = Boolean(taskReadinessMap?.[t.id])
      const isShortage = !isReady && (
        (t.id in taskShortageMapComputed) ? Boolean(taskShortageMapComputed[t.id]) : Boolean(cachedShortageMap?.[t.id])
      )
      if (isShortage) return 1 // 🔴 2. ЧЕРВОНІ (НЕСТАЧА)

      if (isReady) return 3 // 🟢 4. ГОТОВІ
      return 2 // 🟡 3. ЖОВТІ (В РОБОТІ)
    }

    return tasks
      .filter(t => {
        const step = (t.step || '').toLowerCase()
        if (step.includes('пресування') || step.includes('цех №2') || step.includes('доопрацювання') || step.includes('підготовка')) {
          return false
        }
        return true
      })
      .sort((a, b) => {
        const pA = getPriority(a)
        const pB = getPriority(b)
        if (pA !== pB) return pA - pB
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
