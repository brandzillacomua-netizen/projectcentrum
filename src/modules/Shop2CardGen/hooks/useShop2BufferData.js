import { useMemo } from 'react'

export const SHOP2_STAGES = [
  'Пресування',
  'Фарбування',
  'Доопрацювання',
  'Пакування'
]

export function isShop2WorkCard(card, shop2TaskIdsSet = new Set()) {
  if (!card) return false
  if (shop2TaskIdsSet.has(String(card.task_id))) return true
  const info = String(card.card_info || '')
  if (info.includes('[SHOP:2]') || info.includes('[ЦЕХ №2]') || info.includes('[ЦЕХ 2]')) return true
  const op = String(card.operation || '').toLowerCase()
  if (['пресування', 'фарбування', 'малярка', 'доопрацювання', 'пакування', 'сгп'].some(o => op.includes(o))) return true
  return false
}

export function useShop2BufferData({
  orders = [],
  tasks = [],
  workCards = [],
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

    const getPartEntry = (nomId, sampleCard = null, orderId = '') => {
      const nom = nomenclatures.find(n => String(n.id) === String(nomId))
      let key = String(nomId)
      if (groupBy === 'order') {
        key = `${nomId}_${orderId}`
      }

      if (!partMap.has(key)) {
        partMap.set(key, {
          key,
          nomId: String(nomId),
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

    // Process Work Cards (only for active, non-completed/shipped orders)
    workCards.forEach(card => {
      const nomId = String(card.nomenclature_id || '')
      const orderId = String(card.order_id || '')
      if (!nomId) return

      // Skip cards belonging to completed, shipped or cancelled orders
      if (orderId) {
        const ord = orders.find(o => String(o.id) === orderId)
        if (ord && (ord.status === 'completed' || ord.status === 'shipped' || ord.status === 'cancelled')) {
          return
        }
      }

      const isShop2Card = isShop2WorkCard(card, shop2TaskIdsSet)
      const partEntry = getPartEntry(nomId, card, orderId)
      const orderSub = getOrderSubEntry(partEntry, orderId)

      const scrap = Number(card.scrap_qty || 0)

      if (!isShop2Card) {
        // ROUTE 1: Shop 1 cards physically delivered to Shop 2 buffer ('at-shop2-buffer', 'at-buffer', 'completed' on sorting, or 'Склад БЗ')
        // ROUTE 2: Returned from VKYA or Rework/Dovypusk cards completed/at-buffer
        const op = String(card.operation || '')
        const status = String(card.status || '')
        const isSortedOrBuffer = status === 'at-shop2-buffer'

        if (isSortedOrBuffer) {
          const qty = Number(card.quantity || 0)
          const used = Number(card.used_in_shop2_qty || 0)

          partEntry.totalReceived += qty
          partEntry.usedInShop2Qty += used

          orderSub.totalReceived += qty
          orderSub.usedInShop2Qty += used
        } else if (op === 'Склад БЗ' || op.toLowerCase().includes('склад бз') || op.toLowerCase().includes('склад bz')) {
          const qty = Number(card.quantity || 0)
          partEntry.bzCardQty = (partEntry.bzCardQty || 0) + qty
          orderSub.bzCardQty = (orderSub.bzCardQty || 0) + qty
        } else if (card.status !== 'completed' && card.status !== 'cancelled') {
          const qty = Number(card.quantity || 0)
          partEntry.shop1WipQty = (partEntry.shop1WipQty || 0) + qty
          orderSub.shop1WipQty = (orderSub.shop1WipQty || 0) + qty
        }
      } else {
        // Active or Completed Shop 2 Cards
        const qty = Number(card.quantity || 0)
        if (['new', 'in-progress', 'waiting-cutters', 'waiting-materials', 'waiting-buffer', 'at-buffer'].includes(card.status)) {
          partEntry.inProgressQty += qty
          orderSub.inProgressQty += qty
        } else if (card.status === 'completed') {
          partEntry.completedQty += qty
          orderSub.completedQty += qty
        }

        if (scrap > 0) {
          partEntry.shop2ScrapQty += scrap
          orderSub.shop2ScrapQty += scrap
        }
      }
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
          const snapEntry = matchedTasks[0]?.plan_snapshot?.[partEntry.nomId]

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
        const subNetPack = sub.completedQty

        ordersList.push({
          ...sub,
          plannedReqQty: reqQty,
          stockBzQty,
          availableQty: subAvail,
          netPackagingQty: subNetPack
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
      const netPackagingQty = partEntry.completedQty

      // Total Covered / Pipeline Qty for СУМА (Є / ПОТРЕБА): ВЗЯТО З БЗ + В РОБОТІ (ЦЕХ 1) + ОТРЕДАНО/В РОБОТІ (ЦЕХ 2) - БРАК
      const totalCoveredQty = Math.max(0, stockBzQty + awaitingShop1Qty + partEntry.totalReceived - partEntry.shop2ScrapQty)

      results.push({
        ...partEntry,
        totalReceived: totalCoveredQty,
        productFamily,
        totalOrderRequirement,
        awaitingShop1Qty,
        stockBzQty,
        availableQty,
        netPackagingQty,
        ordersList
      })
    })

    return results
  }, [workCards, tasks, orders, nomenclatures, bomItems, shop2TaskIdsSet, groupBy])

  // Filtered & Sorted rows
  const filteredRows = useMemo(() => {
    let list = bufferRows.filter(row => {
      if (selectedOrderId !== 'all') {
        const hasOrder = row.ordersList.some(o => String(o.orderId) === String(selectedOrderId))
        if (!hasOrder) return false
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
      sec.totalPackagingYield += row.netPackagingQty
      sec.totalRequirement += row.totalOrderRequirement
    })

    return Array.from(sectionsMap.values())
  }, [filteredRows])

  // Deficit Rows where scrap occurred in Shop 2
  const deficitRows = useMemo(() => {
    return bufferRows.filter(r => r.shop2ScrapQty > 0)
  }, [bufferRows])

  const totalDeficitQty = useMemo(() => {
    return deficitRows.reduce((sum, r) => sum + r.shop2ScrapQty, 0)
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
