import { useMemo } from 'react'
import { SHOP2_STAGE_NAMES, isShop2Operation, isPackagingOperation } from '../constants/shop2Stages'
import { resolveCanonicalNomId } from '../../Nomenclature/utils/nomenclatureHelpers'
import { buildShop2ScrapByCard, buildShop2UtilRows, resolveShop2CardScrap } from '../utils/shop2BufferCalculations'

export const SHOP2_STAGES = SHOP2_STAGE_NAMES.filter(name => !name.toLowerCase().includes('пакування') && !name.toLowerCase().includes('сгп'))

export function isShop2WorkCard(card, shop2TaskIdsSet = new Set()) {
  if (!card) return false
  if (shop2TaskIdsSet.has(String(card.task_id))) return true
  const info = String(card.card_info || '')
  if (info.includes('[SHOP:2]') || info.includes('[ЦЕХ №2]') || info.includes('[ЦЕХ 2]')) return true
  return isShop2Operation(card.operation)
}

export function useShop2BufferData({
  orders = [],
  tasks = [],
  workCards = [],
  workCardHistory = [],
  workCardScrapTotals = [],
  currentVkyaItems = [],
  observedScrapRows = [],
  returnedRows = [],
  finalScrapRows = [],
  inventory = [],
  nomenclatures = [],
  bomItems = [],
  searchTerm = '',
  selectedOrderId = 'all',
  groupBy = 'product', // 'product' (Sections by Finished Product) | 'part' | 'order'
  sortBy = 'available_desc' // 'available_desc' | 'name_asc' | 'product_asc'
}) {
  const shop2TaskIdsSet = useMemo(() => {
    const set = new Set()
    tasks.forEach(t => {
      const step = String(t.step || '').toLowerCase()
      const name = String(t.name || '').toLowerCase()
      if (step.includes('цех №2') || step.includes('цех 2') || step.includes('пресування') || step.includes('фарбування') || step.includes('маляр') ||
          name.includes('цех №2') || name.includes('цех 2') || name.includes('пресування') || name.includes('фарбування') || name.includes('маляр')) {
        set.add(String(t.id))
      }
    })
    return set
  }, [tasks])

  // Helper to detect finished product / family from part name or order
  const getProductFamily = (nomName = '', ordersList = []) => {
    if (ordersList && ordersList.length > 0) {
      for (const ord of ordersList) {
        if (ord.productName && ord.productName !== '—' && !ord.productName.toLowerCase().includes('нейтральний')) {
          return ord.productName
        }
        if (ord.customer && ord.customer !== '—') {
          return ord.customer
        }
      }
    }

    const nameStr = String(nomName).trim()
    const matchPrefix = nameStr.match(/^([А-Яа-яA-Za-z0-9]+[\s\-_]+[А-Яа-яA-Za-z0-9/]+)/)
    if (matchPrefix) {
      return matchPrefix[1]
    }

    const parts = nameStr.split(/[-_\s]+/)
    if (parts.length > 1) {
      return `${parts[0]} ${parts[1]}`
    }
    return parts[0] || 'Виріб без категорії'
  }

  const bufferRows = useMemo(() => {
    const partMap = new Map()
    const historyScrapByCard = buildShop2ScrapByCard(workCardHistory)
    const utilByOrderPart = new Map()

    ;(finalScrapRows || []).forEach(row => {
      const sourceCard = workCards.find(card => String(card.id) === String(row.card_id || ''))
      const belongsToShop2 = shop2TaskIdsSet.has(String(row.task_id || '')) || isShop2WorkCard(sourceCard, shop2TaskIdsSet)
      if (!belongsToShop2) return

      const canonicalNomId = resolveCanonicalNomId(row.nomenclature_id, nomenclatures) || String(row.nomenclature_id || '')
      const orderId = String(row.order_id || sourceCard?.order_id || 'no-order')
      const utilQty = Math.max(0, Number(row.total_scrap) || 0)
      if (!canonicalNomId || utilQty <= 0) return

      const scopeKey = `${canonicalNomId}|${orderId}`
      utilByOrderPart.set(scopeKey, (utilByOrderPart.get(scopeKey) || 0) + utilQty)
    })

    const getPartEntry = (nomId, sampleCard = null, orderId = '') => {
      const canonicalNomId = resolveCanonicalNomId(nomId, nomenclatures) || String(nomId || '')
      const nom = nomenclatures.find(n => String(n.id) === canonicalNomId)
      let key = canonicalNomId
      if (groupBy === 'order') {
        key = `${canonicalNomId}_${orderId}`
      }

      if (!partMap.has(key)) {
        partMap.set(key, {
          key,
          nomId: canonicalNomId,
          orderId: String(orderId),
          nomName: nom?.name || sampleCard?.name || 'Невідома деталь',
          nomCode: nom?.nomenclature_code || nom?.code || '',
          material: nom?.material_type || nom?.material || '',
          unitsPerSheet: Number(nom?.units_per_sheet) || 1,
          totalReceived: 0,
          usedInShop2Qty: 0,
          inProgressQty: 0,
          completedQty: 0,
          shop2ScrapQty: 0,
          shop2UtilQty: 0,
          shop1VkyaQty: 0,
          ordersMap: new Map()
        })
      }
      return partMap.get(key)
    }

    const getOrderSubEntry = (partEntry, orderId) => {
      const oKey = String(orderId || 'no-order')
      if (!partEntry.ordersMap.has(oKey)) {
        const order = orders.find(o => String(o.id) === oKey)
        const finishedNom = order?.nomenclature_id ? nomenclatures.find(n => String(n.id) === String(order.nomenclature_id)) : null
        partEntry.ordersMap.set(oKey, {
          orderId: oKey,
          orderNum: order?.order_num || (orderId ? `№ ${orderId.substring(0, 8)}` : 'Без наряду'),
          customer: order?.customer || '—',
          productName: finishedNom?.name || order?.customer || '—',
          totalReceived: 0,
          usedInShop2Qty: 0,
          inProgressQty: 0,
          completedQty: 0,
          shop2ScrapQty: 0,
          shop2UtilQty: 0,
          shop1VkyaQty: 0,
          availableQty: 0
        })
      }
      return partEntry.ordersMap.get(oKey)
    }

    // 0. Seed partMap with ALL active orders in work and their required parts
    const activeOrders = orders.filter(o => 
      o.status !== 'completed' && 
      o.status !== 'shipped' && 
      o.status !== 'cancelled'
    )

    activeOrders.forEach(ord => {
      const orderId = String(ord.id)
      const finishedNomId = ord.nomenclature_id || ord.order_items?.[0]?.nomenclature_id
      const ordTasks = tasks.filter(t => String(t.order_id) === orderId)
      const partIdsSet = new Set()

      ordTasks.forEach(t => {
        if (t.plan_snapshot) {
          Object.keys(t.plan_snapshot).forEach(nomKey => {
            const nomObj = nomenclatures.find(n => String(n.id) === String(nomKey))
            if (nomObj?.type === 'part' || (!nomObj?.type && nomObj)) {
              partIdsSet.add(String(nomKey))
            }
          })
        }
      })

      if (finishedNomId && partIdsSet.size === 0) {
        (bomItems || []).forEach(b => {
          if (String(b.parent_id) === String(finishedNomId)) {
            const childNom = nomenclatures.find(n => String(n.id) === String(b.child_id))
            if (childNom?.type === 'part' || (!childNom?.type && childNom)) {
              partIdsSet.add(String(b.child_id))
            }
          }
        })
      }

      partIdsSet.forEach(partId => {
        const partEntry = getPartEntry(partId, null, orderId)
        getOrderSubEntry(partEntry, orderId)
      })
    })

    // Process Work Cards
    workCards.forEach(card => {
      const nomId = String(card.nomenclature_id || '')
      const orderId = String(card.order_id || '')
      if (!nomId) return

      const status = String(card.status || '')
      const op = String(card.operation || '')
      const isSortedOrBuffer = status === 'at-shop2-buffer'

      // Skip cards belonging to completed, shipped or cancelled orders UNLESS they are physical buffer stock
      if (orderId && !isSortedOrBuffer) {
        const ord = orders.find(o => String(o.id) === orderId)
        if (ord && (ord.status === 'completed' || ord.status === 'shipped' || ord.status === 'cancelled')) {
          return
        }
      }

      const isShop2Card = isShop2WorkCard(card, shop2TaskIdsSet)
      const partEntry = getPartEntry(nomId, card, orderId)
      const orderSub = getOrderSubEntry(partEntry, orderId)

      const scrap = resolveShop2CardScrap(card, historyScrapByCard)

      if (isSortedOrBuffer) {
        const qty = Number(card.quantity || 0)
        const used = Number(card.used_in_shop2_qty || 0)

        partEntry.totalReceived += qty
        partEntry.usedInShop2Qty += used

        orderSub.totalReceived += qty
        orderSub.usedInShop2Qty += used
      } else if (!isShop2Card) {
        if (op === 'Склад БЗ' || op.toLowerCase().includes('склад бз') || op.toLowerCase().includes('склад bz')) {
          const qty = Number(card.quantity || 0)
          partEntry.bzCardQty = (partEntry.bzCardQty || 0) + qty
          orderSub.bzCardQty = (orderSub.bzCardQty || 0) + qty
        } else if (card.status !== 'completed' && card.status !== 'cancelled') {
          const qty = Number(card.quantity || 0)
          const stat = String(card.status || '').toLowerCase()
          const opLower = String(card.operation || '').toLowerCase()
          
          const isVkya = [
            'quality-hold', 'on-hold', 'hold', 'at-vkya', 'in-vkya',
            'quarantine', 'restoration'
          ].includes(stat) || stat.includes('vkya') || stat.includes('вкя') || stat.includes('карантин') ||
          opLower.includes('вкя') || opLower.includes('vkya') || opLower.includes('карантин') ||
          opLower.includes('відновл') || opLower.includes('rework') || opLower.includes('restoration') ||
          opLower.includes('контроль вкя') || opLower.includes('доробка') || opLower.includes('переробка') ||
          opLower.includes('брак') || opLower.includes('додатков')

          if (isVkya) {
            partEntry.shop1VkyaQty = (partEntry.shop1VkyaQty || 0) + qty
            orderSub.shop1VkyaQty = (orderSub.shop1VkyaQty || 0) + qty
          } else {
            partEntry.shop1WipQty = (partEntry.shop1WipQty || 0) + qty
            orderSub.shop1WipQty = (orderSub.shop1WipQty || 0) + qty
          }
        }
      } else {
        // Active or Completed Shop 2 Cards
        const qty = Number(card.quantity || 0)
        const opLower = String(card.operation || '').toLowerCase()
        const infoLower = String(card.card_info || '').toLowerCase()
        const isPack = isPackagingOperation(card.operation) ||
                       isPackagingOperation(card.card_info) ||
                       opLower.includes('пакуван') ||
                       opLower.includes('сгп') ||
                       opLower.includes('sgp') ||
                       infoLower.includes('пакуван') ||
                       infoLower.includes('сгп') ||
                       infoLower.includes('sgp')

        if (card.status === 'completed') {
          partEntry.completedQty += qty
          orderSub.completedQty += qty
        } else if (['new', 'in-progress', 'waiting-cutters', 'waiting-materials', 'waiting-buffer', 'at-buffer'].includes(card.status)) {
          partEntry.inProgressQty += qty
          orderSub.inProgressQty += qty
        }

        if (scrap > 0) {
          partEntry.shop2ScrapQty += scrap
          orderSub.shop2ScrapQty += scrap
        }
      }
    })

    // Process current VKYA items (quarantine, restoration) ONLY to include them in Shop 2 scrap quantity
    ;(currentVkyaItems || []).forEach(item => {
      let belongsToShop2 = shop2TaskIdsSet.has(String(item.task_id || ''))

      if (!belongsToShop2 && item.original_operation && isShop2Operation(item.original_operation)) {
        belongsToShop2 = true
      }
      
      if (!belongsToShop2 && item.source_history_id) {
        const histRow = workCardHistory.find(h => String(h.id) === String(item.source_history_id))
        if (histRow) {
          const srcCard = workCards.find(c => String(c.id) === String(histRow.card_id))
          if (srcCard && isShop2WorkCard(srcCard, shop2TaskIdsSet)) {
            belongsToShop2 = true
          }
        }
      }

      if (belongsToShop2) {
        const canonicalNomId = resolveCanonicalNomId(item.nomenclature_id, nomenclatures) || String(item.nomenclature_id || '')
        const orderId = String(item.order_id || '')
        const vkyaQty = Math.max(0, Number(item.quantity) || 0)
        if (!canonicalNomId || vkyaQty <= 0) return

        const partEntry = getPartEntry(canonicalNomId, null, orderId)
        const orderSub = getOrderSubEntry(partEntry, orderId)
        
        partEntry.shop2ScrapQty += vkyaQty
        orderSub.shop2ScrapQty += vkyaQty
      }
    })

    // Shop 1 VKYA = observed card scrap − final util (cat 4) − returned to route.
    // Same formula as Foreman Dashboard (calculateCurrentVkyaQuantity).
    const cardById = new Map(workCards.map(c => [String(c.id), c]))
    const isShop1Row = (row) => {
      if (shop2TaskIdsSet.has(String(row.task_id || ''))) return false
      const card = row.card_id ? cardById.get(String(row.card_id)) : null
      if (card && isShop2WorkCard(card, shop2TaskIdsSet)) return false
      return true
    }
    const shop1VkyaByScope = new Map()
    const addScope = (row, qty) => {
      if (!qty || !isShop1Row(row)) return
      const card = row.card_id ? cardById.get(String(row.card_id)) : null
      const nomId = resolveCanonicalNomId(row.nomenclature_id || card?.nomenclature_id, nomenclatures) || String(row.nomenclature_id || card?.nomenclature_id || '')
      if (!nomId) return
      const orderId = String(row.order_id || card?.order_id || '')
      const key = `${nomId}|${orderId}`
      shop1VkyaByScope.set(key, (shop1VkyaByScope.get(key) || 0) + qty)
    }

    const activeObservedScrapRows = (observedScrapRows && observedScrapRows.length > 0)
      ? observedScrapRows
      : ((workCardScrapTotals && workCardScrapTotals.length > 0)
          ? workCardScrapTotals
          : (workCardHistory || [])
              .filter(h => Number(h?.scrap_qty) > 0)
              .map(h => ({
                card_id: h.card_id,
                task_id: h.task_id,
                order_id: h.order_id,
                nomenclature_id: h.nomenclature_id,
                total_scrap: Number(h.scrap_qty) || 0
              }))
        )

    ;(activeObservedScrapRows || []).forEach(r => addScope(r, Number(r.total_scrap ?? r.scrap_qty) || 0))
    ;(finalScrapRows || []).forEach(r => addScope(r, -(Number(r.total_scrap ?? r.quantity) || 0)))
    ;(returnedRows || []).forEach(r => addScope(r, -(Number(r.quantity) || 0)))

    partMap.forEach(partEntry => {
      let partVkya = 0
      partEntry.ordersMap.forEach(orderSub => {
        const mathVkya = Math.max(0, shop1VkyaByScope.get(`${partEntry.nomId}|${orderSub.orderId}`) || 0)
        const cardVkya = Number(orderSub.shop1VkyaQty || 0)
        if (mathVkya > cardVkya) {
          const extra = mathVkya - cardVkya
          orderSub.shop1VkyaQty = mathVkya
          // Scrap still sits inside active Shop 1 card quantity — move it out of WIP
          const wip = Number(orderSub.shop1WipQty || 0)
          const moved = Math.min(wip, extra)
          orderSub.shop1WipQty = wip - moved
          partEntry.shop1WipQty = Math.max(0, Number(partEntry.shop1WipQty || 0) - moved)
        }
        partVkya += Number(orderSub.shop1VkyaQty || 0)
      })
      partEntry.shop1VkyaQty = Math.max(Number(partEntry.shop1VkyaQty || 0), partVkya)
    })

    // Legacy fallback: VKYA ledger items for Shop 1 when no card scrap totals exist
    const historyById = new Map((workCardHistory || []).map(h => [String(h.id), h]))
    const ledgerShop1ByScope = new Map()
    ;(currentVkyaItems || []).forEach(item => {
      let belongsToShop2 = shop2TaskIdsSet.has(String(item.task_id || ''))
      if (!belongsToShop2 && item.original_operation && isShop2Operation(item.original_operation)) belongsToShop2 = true
      if (!belongsToShop2 && item.source_history_id) {
        const histRow = historyById.get(String(item.source_history_id))
        const srcCard = histRow ? cardById.get(String(histRow.card_id)) : null
        if (srcCard && isShop2WorkCard(srcCard, shop2TaskIdsSet)) belongsToShop2 = true
      }
      if (belongsToShop2) return
      const nomId = resolveCanonicalNomId(item.nomenclature_id, nomenclatures) || String(item.nomenclature_id || '')
      const key = `${nomId}|${String(item.order_id || '')}`
      ledgerShop1ByScope.set(key, (ledgerShop1ByScope.get(key) || 0) + Math.max(0, Number(item.quantity) || 0))
    })
    partMap.forEach(partEntry => {
      let partVkya = 0
      partEntry.ordersMap.forEach(orderSub => {
        const key = `${partEntry.nomId}|${orderSub.orderId}`
        if (!shop1VkyaByScope.has(key)) {
          const ledgerQty = ledgerShop1ByScope.get(key) || 0
          const cardVkya = Number(orderSub.shop1VkyaQty || 0)
          if (ledgerQty > cardVkya) {
            const extra = ledgerQty - cardVkya
            orderSub.shop1VkyaQty = ledgerQty
            const wip = Number(orderSub.shop1WipQty || 0)
            const moved = Math.min(wip, extra)
            orderSub.shop1WipQty = wip - moved
            partEntry.shop1WipQty = Math.max(0, Number(partEntry.shop1WipQty || 0) - moved)
          }
        }
        partVkya += Number(orderSub.shop1VkyaQty || 0)
      })
      partEntry.shop1VkyaQty = Math.max(Number(partEntry.shop1VkyaQty || 0), partVkya)
    })

    // Calculate final available buffer qty, BOM-based active order requirement & net packaging yield for each part row
    const results = []
    partMap.forEach(partEntry => {
      let totalOrderRequirement = 0
      const ordersList = []
      
      partEntry.ordersMap.forEach(sub => {
        const matchedOrd = orders.find(o => String(o.id) === String(sub.orderId))
        let reqQty = 0
        let stockBzQty = 0

        if (matchedOrd) {
          // Find matching tasks with plan_snapshot stock reservation
          const matchedTasks = tasks.filter(t => String(t.order_id) === String(matchedOrd.id) && t.plan_snapshot)
          let snapEntry = matchedTasks[0]?.plan_snapshot?.[partEntry.nomId]
          if (!snapEntry && matchedTasks[0]?.plan_snapshot) {
            const nomObj = nomenclatures.find(n => String(n.id) === String(partEntry.nomId))
            const legacyIds = (nomObj?.legacy_ids || []).map(String)
            for (const legId of legacyIds) {
              if (matchedTasks[0].plan_snapshot[legId]) {
                snapEntry = matchedTasks[0].plan_snapshot[legId]
                break
              }
            }
          }

          if (snapEntry && Number(snapEntry.stock) > 0) {
            stockBzQty = Number(snapEntry.stock)
          }

          if (snapEntry && Number(snapEntry.need) > 0) {
            reqQty = Number(snapEntry.need)
          } else {
            // Find BOM quantity per parent
            const parentId = matchedOrd.nomenclature_id || matchedOrd.order_items?.[0]?.nomenclature_id
            const bomItem = (bomItems || []).find(b => String(b.parent_id) === String(parentId) && String(b.child_id) === String(partEntry.nomId))
            const qtyPerParent = Number(bomItem?.quantity_per_parent || 1)
            const sets = Number(matchedOrd.planned_qty || matchedOrd.quantity || 1)
            reqQty = sets * qtyPerParent
          }

          // Sum ONLY if the order is active (not completed / not cancelled)
          if (matchedOrd.status !== 'completed' && matchedOrd.status !== 'cancelled') {
            totalOrderRequirement += reqQty
          }
        } else {
          reqQty = sub.totalReceived
          totalOrderRequirement += reqQty
        }

        if (stockBzQty === 0 && sub.bzCardQty > 0) {
          stockBzQty = sub.bzCardQty
        }

        const subAvail = Math.max(0, sub.totalReceived - sub.usedInShop2Qty)
        const subUsedShop2 = Number(sub.usedInShop2Qty || 0)
        const subInProg = Number(sub.inProgressQty || 0)
        const subScrap = Number(sub.shop2ScrapQty || 0)
        const subUtil = utilByOrderPart.get(`${partEntry.nomId}|${sub.orderId}`) || 0
        const subCompleted = Number(sub.completedQty || 0)
        const subNetPack = subCompleted
        const subShop1Vkya = Number(sub.shop1VkyaQty || 0)

        ordersList.push({
          ...sub,
          plannedReqQty: reqQty,
          stockBzQty,
          shop2UtilQty: subUtil,
          availableQty: subAvail,
          netPackagingQty: subNetPack,
          shop1VkyaQty: subShop1Vkya
        })
      })

      if (totalOrderRequirement <= 0) {
        totalOrderRequirement = partEntry.totalReceived
      }

      const productFamily = getProductFamily(partEntry.nomName, ordersList)
      const awaitingShop1Qty = Number(partEntry.shop1WipQty || 0)
      const stockBzQty = ordersList.reduce((sum, o) => sum + (o.stockBzQty || 0), 0)
      
      // Available Qty in Buffer ready for Shop 2 RK creation (ONLY physical cuts delivered minus used in Shop 2)
      const availableQty = Math.max(0, partEntry.totalReceived - partEntry.usedInShop2Qty)
      const totalUsedShop2 = Number(partEntry.usedInShop2Qty || 0)
      const totalInProgShop2 = Number(partEntry.inProgressQty || 0)
      const totalScrapShop2 = Number(partEntry.shop2ScrapQty || 0)
      const totalUtilShop2 = ordersList.reduce((sum, order) => sum + Number(order.shop2UtilQty || 0), 0)
      const totalCompletedShop2 = Number(partEntry.completedQty || 0)
      const netPackagingQty = totalCompletedShop2

      // Total Covered / Pipeline Qty for СУМА (Є / ПОТРЕБА): ВЗЯТО З БЗ + В РОБОТІ (ЦЕХ 1) + ОТРЕДАНО/В РОБОТІ (ЦЕХ 2) - БРАК
      const totalCoveredQty = Math.max(0, stockBzQty + awaitingShop1Qty + partEntry.totalReceived - partEntry.shop2ScrapQty)

      results.push({
        ...partEntry,
        totalReceived: totalCoveredQty,
        productFamily,
        totalOrderRequirement,
        awaitingShop1Qty,
        stockBzQty,
        shop2UtilQty: totalUtilShop2,
        availableQty,
        netPackagingQty,
        ordersList
      })
    })

    return results
  }, [workCards, workCardHistory, workCardScrapTotals, finalScrapRows, observedScrapRows, returnedRows, currentVkyaItems, tasks, orders, nomenclatures, bomItems, shop2TaskIdsSet, groupBy])

  // Filtered & Sorted rows
  const filteredRows = useMemo(() => {
    let list = bufferRows.filter(row => {
      if (selectedOrderId !== 'all') {
        const hasOrder = row.ordersList.some(o => String(o.orderId) === String(selectedOrderId))
        if (!hasOrder) return false
      } else {
        const hasActiveProduction = (row.availableQty > 0) ||
                                    (row.inProgressQty > 0) ||
                                    (row.awaitingShop1Qty > 0) ||
                                    (row.shop2ScrapQty > 0)
        if (!hasActiveProduction) return false
      }

      if (searchTerm) {
        const term = searchTerm.toLowerCase()
        const matchName = row.nomName.toLowerCase().includes(term)
        const matchCode = row.nomCode.toLowerCase().includes(term)
        const matchFamily = row.productFamily.toLowerCase().includes(term)
        const matchOrder = row.ordersList.some(o => o.orderNum.toLowerCase().includes(term) || o.customer.toLowerCase().includes(term))
        if (!matchName && !matchCode && !matchFamily && !matchOrder) return false
      }

      return true
    })

    return [...list].sort((a, b) => {
      if (sortBy === 'available_desc') {
        return b.availableQty - a.availableQty
      }
      if (sortBy === 'name_asc') {
        return a.nomName.localeCompare(b.nomName, 'uk')
      }
      if (sortBy === 'product_asc') {
        return a.productFamily.localeCompare(b.productFamily, 'uk')
      }
      return 0
    })
  }, [bufferRows, selectedOrderId, searchTerm, sortBy])

  // Group rows by Product Family into sections if groupBy === 'product'
  const productSections = useMemo(() => {
    const sectionsMap = new Map()
    filteredRows.forEach(row => {
      const family = row.productFamily || 'Інші вироби'
      if (!sectionsMap.has(family)) {
        sectionsMap.set(family, {
          title: family,
          totalAvailable: 0,
          totalCovered: 0,
          totalScrap: 0,
          totalUtil: 0,
          totalPackagingYield: 0,
          totalRequirement: 0,
          rows: []
        })
      }
      const sec = sectionsMap.get(family)
      sec.rows.push(row)
      sec.totalAvailable += row.availableQty
      sec.totalCovered += (row.totalReceived || 0)
      sec.totalScrap += row.shop2ScrapQty
      sec.totalUtil += row.shop2UtilQty
      sec.totalPackagingYield += row.netPackagingQty
      sec.totalRequirement += row.totalOrderRequirement
    })

    return Array.from(sectionsMap.values())
  }, [filteredRows])

  // Only VKYA category 4 is final util and may create a Shop 1 rerun request.
  const deficitRows = useMemo(() => {
    return buildShop2UtilRows(bufferRows)
  }, [bufferRows])

  const totalDeficitQty = useMemo(() => {
    return deficitRows.reduce((sum, row) => sum + row.shop2UtilQty, 0)
  }, [deficitRows])

  return {
    bufferRows,
    filteredRows,
    productSections,
    deficitRows,
    totalDeficitQty,
    shop2TaskIdsSet,
    stages: SHOP2_STAGES
  }
}
