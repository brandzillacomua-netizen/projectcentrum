import React, { useState, useMemo, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  LayoutDashboard,
  Search,
  RefreshCw
} from 'lucide-react'
import { useMES } from '../MESContext'

const DashboardModule = () => {
  const { currentUser, workCards, inventory, nomenclatures, fetchData, orders, bomItems, tasks, supabase, workCardHistory } = useMES()
  const [wipOnly, setWipOnly] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [shippedQuantities, setShippedQuantities] = useState({})
  const [selectedOrderId, setSelectedOrderId] = useState(null)

  const activeOrders = useMemo(() => {
    if (!tasks || !orders) return []
    const activeOrderIds = new Set(
      tasks
        .filter(t => t.status !== 'completed' && t.status !== 'cancelled')
        .map(t => t.order_id)
        .filter(Boolean)
    )
    return orders.filter(o => activeOrderIds.has(o.id) && !(o.order_num && (o.order_num.startsWith('ВБ') || o.order_num.toUpperCase().startsWith('VB'))))
  }, [tasks, orders])

  const filteredWorkCards = useMemo(() => {
    if (!workCards) return []
    if (selectedOrderId && tasks) {
      const orderTaskIds = tasks.filter(t => t.order_id === selectedOrderId).map(t => t.id)
      return workCards.filter(c => orderTaskIds.includes(c.task_id))
    }
    return workCards
  }, [workCards, selectedOrderId, tasks])

  // Load dashboard-specific data on mount
  useEffect(() => {
    if (typeof fetchData === 'function') {
      fetchData(['orders', 'tasks', 'inventory', 'work_cards', 'nomenclatures', 'bom_items'])
    }
  }, [])

  // Fetch all tasks for active orders to count shipped batch quantities
  useEffect(() => {
    if (!orders || orders.length === 0) return
    const activeOrderIds = orders
      .filter(o => o.status !== 'completed' && o.status !== 'shipped' && o.status !== 'cancelled')
      .map(o => o.id)

    if (activeOrderIds.length === 0) {
      setShippedQuantities({})
      return
    }

    supabase
      .from('tasks')
      .select('id, order_id, planned_sets, plan_snapshot, batch_index')
      .in('order_id', activeOrderIds)
      .then(({ data, error }) => {
        if (error) {
          console.error('Error fetching tasks for active orders:', error)
          return
        }
        if (!data) return

        const shippedByOrder = {}
        const seenBatches = new Set()

        data.forEach(t => {
          const isShipped = t.plan_snapshot?._metadata?.is_shipped === true
          if (isShipped) {
            const batchIdx = t.batch_index || '1'
            const key = `${t.order_id}_${batchIdx}`
            if (!seenBatches.has(key)) {
              seenBatches.add(key)
              const qty = Number(t.planned_sets) || 0
              shippedByOrder[t.order_id] = (shippedByOrder[t.order_id] || 0) + qty
            }
          }
        })

        setShippedQuantities(shippedByOrder)
      })
  }, [orders, supabase])

  // Refetch data on mount and provide manual refresh
  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      await fetchData(['orders', 'tasks', 'inventory', 'work_cards', 'work_card_history'])
    } catch (e) {
      console.error(e)
    } finally {
      setIsRefreshing(false)
    }
  }

  const demandData = useMemo(() => {
    if (!orders || !bomItems) return { globalDemand: {}, productDemand: {} }

    if (selectedOrderId) {
      const orderTasks = tasks?.filter(t => t.order_id === selectedOrderId) || []
      const taskWithSnapshot = orderTasks.find(t => t.plan_snapshot && Object.keys(t.plan_snapshot).length > 0)
      const globalDemand = {}
      const productDemand = {}
      const order = orders.find(o => o.id === selectedOrderId)
      if (order) {
        if (order.order_items && order.order_items.length > 0) {
          order.order_items.forEach(it => {
            productDemand[it.nomenclature_id] = (productDemand[it.nomenclature_id] || 0) + (Number(it.quantity) || 0)
          })
        } else if (order.nomenclature_id) {
          productDemand[order.nomenclature_id] = (Number(order.quantity) || 0)
        }
      }
      if (taskWithSnapshot && taskWithSnapshot.plan_snapshot) {
        Object.keys(taskWithSnapshot.plan_snapshot).forEach(nomId => {
          globalDemand[nomId] = taskWithSnapshot.plan_snapshot[nomId].need || 0
        })
      }
      return { globalDemand, productDemand }
    }

    const activeOrders = orders.filter(o => o.status !== 'completed' && o.status !== 'shipped' && o.status !== 'cancelled')

    const productDemand = {}
    activeOrders.forEach(o => {
      const shipped = shippedQuantities[o.id] || 0
      if (o.order_items && o.order_items.length > 0) {
        o.order_items.forEach(it => {
          const remainingQty = Math.max(0, (Number(it.quantity) || 0) - shipped)
          productDemand[it.nomenclature_id] = (productDemand[it.nomenclature_id] || 0) + remainingQty
        })
      } else if (o.nomenclature_id) {
        const remainingQty = Math.max(0, (Number(o.quantity) || 0) - shipped)
        productDemand[o.nomenclature_id] = (productDemand[o.nomenclature_id] || 0) + remainingQty
      }
    })

    const globalDemand = {}
    bomItems.forEach(b => {
      if (productDemand[b.parent_id]) {
        const qty = Number(b.quantity_per_parent) || 1
        globalDemand[b.child_id] = (globalDemand[b.child_id] || 0) + (productDemand[b.parent_id] * qty)
      }
    })
    return { globalDemand, productDemand }
  }, [orders, bomItems, shippedQuantities, selectedOrderId, tasks])

  // Map tasks to parent products to know which order a workCard belongs to
  const taskParentMap = useMemo(() => {
    const map = {}
    if (!tasks || !orders) return map
    tasks.forEach(t => {
      const order = orders.find(o => String(o.id) === String(t.order_id))
      if (order) {
        let parentId = order.nomenclature_id
        if (!parentId && order.order_items && order.order_items.length > 0) {
          parentId = order.order_items[0].nomenclature_id
        }
        if (parentId) {
          map[t.id] = String(parentId)
        }
      }
    })
    return map
  }, [tasks, orders])

  // 2. Generate Grouped Data and Trends
  const { groupedDashboardData, totals, productTrends } = useMemo(() => {
    const groups = {}
    const trends = {}
    const totalsAcc = { qCutWait: 0, qCut: 0, qCutBuf: 0, qGalt: 0, qGaltBuf: 0, qPriy: 0, qSortAct: 0, qSort: 0, qMalWait: 0, qMal: 0, qMalBuf: 0, qPres: 0, qPresBuf: 0, qDoop: 0, qDoopBuf: 0, qSgp: 0, qBz: 0, qScrap: 0, sum: 0 }

    if (!nomenclatures || !bomItems || !orders) return { groupedDashboardData: [], totals: totalsAcc, productTrends: {} }

    // Sequential allocation of global stock to active orders (oldest first)
    const sortedOrdersForAlloc = [...orders]
      .filter(o => o.status !== 'completed' && o.status !== 'shipped' && o.status !== 'cancelled')
      .sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0))

    const sgpRemaining = {}
    const bzRemaining = {}
    const bzShop2Remaining = {}

      ; (inventory || []).forEach(i => {
        const nomId = String(i.nomenclature_id)
        const qty = Number(i.total_qty) || 0
        if (i.type === 'finished' || i.warehouse === 'sgp' || i.warehouse === 'SGP') {
          sgpRemaining[nomId] = (sgpRemaining[nomId] || 0) + qty
        } else if (i.type === 'bz') {
          bzRemaining[nomId] = (bzRemaining[nomId] || 0) + qty
        } else if (i.type === 'bz_shop2') {
          bzShop2Remaining[nomId] = (bzShop2Remaining[nomId] || 0) + qty
        }
      })

    const orderAllocatedSgp = {}
    const orderAllocatedBz = {}
    const orderAllocatedBzShop2 = {}

    sortedOrdersForAlloc.forEach(order => {
      orderAllocatedSgp[order.id] = {}
      orderAllocatedBz[order.id] = {}
      orderAllocatedBzShop2[order.id] = {}

      let prodId = order.nomenclature_id
      if (!prodId && order.order_items && order.order_items.length > 0) {
        prodId = order.order_items[0].nomenclature_id
      }
      if (!prodId) return
      prodId = String(prodId)

      const orderTasks = tasks?.filter(t => t.order_id === order.id) || []
      const plannedTask = orderTasks.find(t => t.planned_sets) || orderTasks[0]
      const totalDemand = Number(plannedTask?.planned_sets) || Number(order.order_items?.[0]?.quantity) || Number(order.quantity) || 0

      const orderBoms = []
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      const taskWithSnapshot = orderTasks.find(t => t.plan_snapshot && Object.keys(t.plan_snapshot).some(k => uuidRegex.test(k)))

      if (taskWithSnapshot) {
        const plannedSets = Number(taskWithSnapshot.planned_sets) || 1
        Object.entries(taskWithSnapshot.plan_snapshot).forEach(([childId, entry]) => {
          if (!uuidRegex.test(childId)) return
          const need = Number(entry.need) || 0
          orderBoms.push({
            child_id: childId,
            quantity_per_parent: plannedSets > 0 ? Math.round(need / plannedSets) : need
          })
        })
      } else {
        bomItems.filter(b => String(b.parent_id) === prodId).forEach(b => {
          orderBoms.push({
            child_id: String(b.child_id),
            quantity_per_parent: Number(b.quantity_per_parent) || 1
          })
        })
      }

      orderBoms.forEach(bomEntry => {
        const childId = String(bomEntry.child_id)
        const qtyPerProduct = Number(bomEntry.quantity_per_parent) || 1
        const needQty = totalDemand * qtyPerProduct

        let remainingNeed = needQty

        // Allocate SGP
        if (sgpRemaining[childId] > 0) {
          const alloc = Math.min(sgpRemaining[childId], remainingNeed)
          orderAllocatedSgp[order.id][childId] = alloc
          sgpRemaining[childId] -= alloc
          remainingNeed -= alloc
        } else {
          orderAllocatedSgp[order.id][childId] = 0
        }

        // Allocate BZ
        if (bzRemaining[childId] > 0) {
          const alloc = Math.min(bzRemaining[childId], remainingNeed)
          orderAllocatedBz[order.id][childId] = alloc
          bzRemaining[childId] -= alloc
          remainingNeed -= alloc
        } else {
          orderAllocatedBz[order.id][childId] = 0
        }

        // Allocate BZ Shop2
        if (bzShop2Remaining[childId] > 0) {
          const alloc = Math.min(bzShop2Remaining[childId], remainingNeed)
          orderAllocatedBzShop2[order.id][childId] = alloc
          bzShop2Remaining[childId] -= alloc
          remainingNeed -= alloc
        } else {
          orderAllocatedBzShop2[order.id][childId] = 0
        }
      })
    })

    const parts = nomenclatures.filter(n => n.type === 'part')
    const parentProducts = nomenclatures.filter(n => n.type === 'product')

    // Pre-populate groups for active parent products
    parentProducts.forEach(prod => {
      const hasBOM = bomItems.some(b => String(b.parent_id) === String(prod.id))
      if (hasBOM) {
        groups[prod.id] = {
          id: prod.id,
          name: prod.name,
          code: prod.code || '',
          rows: [],
          trend: null
        }
      }
    })

    groups['other'] = {
      id: 'other',
      name: 'Інші деталі / Комплектуючі',
      code: '',
      rows: [],
      trend: null
    }

    // Map from parentId -> Set of childIds and their quantity per parent
    // Map from childId -> Set of parentIds
    const activeParentToChildren = {}
    const childToParentsMap = {}

    // Resolve active BOMs based on orders/tasks
    orders.forEach(order => {
      let parentId = order.nomenclature_id
      if (!parentId && order.order_items && order.order_items.length > 0) {
        parentId = order.order_items[0].nomenclature_id
      }
      if (!parentId) return
      parentId = String(parentId)

      if (selectedOrderId && order.id !== selectedOrderId) return

      const orderTasks = tasks?.filter(t => t.order_id === order.id) || []
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      const taskWithSnapshot = orderTasks.find(t => t.plan_snapshot && Object.keys(t.plan_snapshot).some(k => uuidRegex.test(k)))

      if (taskWithSnapshot) {
        const plannedSets = Number(taskWithSnapshot.planned_sets) || 1
        if (!activeParentToChildren[parentId]) activeParentToChildren[parentId] = {}

        Object.entries(taskWithSnapshot.plan_snapshot).forEach(([childId, entry]) => {
          if (childId.startsWith('_') || ['materialSummary', 'selectedCutters', 'consumables'].includes(childId)) return
          const need = Number(entry.need) || 0
          const qtyPerParent = plannedSets > 0 ? Math.round(need / plannedSets) : need

          activeParentToChildren[parentId][childId] = qtyPerParent

          if (!childToParentsMap[childId]) childToParentsMap[childId] = new Set()
          childToParentsMap[childId].add(parentId)
        })
      } else {
        const staticBoms = bomItems.filter(b => String(b.parent_id) === parentId)
        if (!activeParentToChildren[parentId]) activeParentToChildren[parentId] = {}
        staticBoms.forEach(b => {
          const childId = String(b.child_id)
          const qtyPerParent = Number(b.quantity_per_parent) || 1
          activeParentToChildren[parentId][childId] = qtyPerParent

          if (!childToParentsMap[childId]) childToParentsMap[childId] = new Set()
          childToParentsMap[childId].add(parentId)
        })
      }
    })

    // Seed static BOMs for parent products not covered by active orders (if any)
    parentProducts.forEach(prod => {
      const parentId = String(prod.id)
      if (!activeParentToChildren[parentId]) {
        activeParentToChildren[parentId] = {}
        const staticBoms = bomItems.filter(b => String(b.parent_id) === parentId)
        staticBoms.forEach(b => {
          const childId = String(b.child_id)
          activeParentToChildren[parentId][childId] = Number(b.quantity_per_parent) || 1

          if (!childToParentsMap[childId]) childToParentsMap[childId] = new Set()
          childToParentsMap[childId].add(parentId)
        })
      }
    })

    // Populate rows (child parts WIP per group)
    parts.forEach(nom => {
      const parentIds = childToParentsMap[nom.id] ? Array.from(childToParentsMap[nom.id]) : ['other']

      parentIds.forEach(parentId => {
        if (!groups[parentId]) return

        const isOther = parentId === 'other'
        const qtyPerProduct = isOther ? 1 : (activeParentToChildren[parentId]?.[nom.id] || 1)
        const specificDemand = isOther ? 0 : (demandData.productDemand[parentId] || 0) * qtyPerProduct

        const getQty = (operation, statuses) => {
          return (filteredWorkCards || []).filter(c => {
            if (String(c.nomenclature_id) !== String(nom.id)) return false
            // Filter by order via taskParentMap IF not "other"
            if (!isOther && c.task_id && taskParentMap[c.task_id]) {
              if (taskParentMap[c.task_id] !== String(parentId)) return false
            }
            const matchOp = Array.isArray(operation) ? operation.includes(c.operation) : c.operation === operation
            const matchStat = Array.isArray(statuses) ? statuses.includes(c.status) : c.status === statuses
            return matchOp && matchStat
          }).reduce((sum, c) => sum + (Number(c.quantity) || 0), 0)
        }

        const getQtySort = () => {
          return (filteredWorkCards || []).filter(c => {
            if (String(c.nomenclature_id) !== String(nom.id)) return false
            if (!isOther && c.task_id && taskParentMap[c.task_id] && taskParentMap[c.task_id] !== String(parentId)) return false
            return c.status === 'at-shop2-buffer'
          }).reduce((sum, c) => sum + Math.max(0, (Number(c.quantity) || 0) - (Number(c.used_in_shop2_qty) || 0)), 0)
        }

        const qCutWait = getQty(['Розкрій'], 'new')
        const qCut = getQty(['Розкрій'], 'in-progress')
        const qCutBuf = getQty(['Розкрій'], 'at-buffer')
        const qGalt = getQty('Галтовка', 'in-progress')
        const qGaltBuf = getQty('Галтовка', 'at-buffer')
        const qPriyCards = getQty('Прийомка', ['new', 'in-progress', 'at-buffer'])

        const qPriyInv = (inventory || []).filter(i => String(i.nomenclature_id) === String(nom.id) && i.type === 'semi').reduce((sum, i) => sum + (Number(i.total_qty) || 0), 0)
        const qPriy = Math.max(qPriyCards, qPriyInv)

        const qSortAct = getQty('Сортування', ['in-progress', 'at-buffer'])
        const qSortCards = getQtySort()
        const qSortInv = (inventory || []).filter(i => String(i.nomenclature_id) === String(nom.id) && i.type === 'semi_shop2').reduce((sum, i) => sum + (Number(i.total_qty) || 0), 0)
        const qSort = Math.max(qSortCards, qSortInv)

        const qMalWait = getQty(['Фарбування', 'Малярка'], 'new')
        const qMal = getQty(['Фарбування', 'Малярка'], 'in-progress')
        const qMalBuf = getQty(['Фарбування', 'Малярка'], 'at-buffer')
        const qPres = getQty('Пресування', ['new', 'in-progress'])
        const qPresBuf = getQty('Пресування', 'at-buffer')
        const qDoop = getQty('Доопрацювання', ['new', 'in-progress'])
        const qDoopBuf = getQty('Доопрацювання', 'at-buffer')

        // Allocate SGP / BZ stock for the spreadsheet replica view
        let qSgp = 0
        let qBz = 0
        let qScrap = 0

        if (selectedOrderId) {
          const orderTasks = tasks?.filter(t => t.order_id === selectedOrderId) || []
          const orderTaskIds = orderTasks.map(t => t.id)
          qScrap = (workCardHistory || [])
            .filter(h => String(h.nomenclature_id) === String(nom.id) && h.task_id && orderTaskIds.includes(h.task_id))
            .reduce((sum, h) => sum + (Number(h.scrap_qty) || 0), 0)

          const taskWithSnapshot = orderTasks.find(t => t.plan_snapshot && t.plan_snapshot[String(nom.id)])

          if (taskWithSnapshot) {
            // Беремо точну кількість, яку ми забронювали/перемістили з БЗ на СГП для цього наряду
            qSgp = Number(taskWithSnapshot.plan_snapshot[String(nom.id)].stock) || 0
            qBz = orderAllocatedBz[selectedOrderId]?.[nom.id] || 0
          } else {
            qSgp = orderAllocatedSgp[selectedOrderId]?.[nom.id] || 0
            qBz = orderAllocatedBz[selectedOrderId]?.[nom.id] || 0
          }
        } else {
          qScrap = (inventory || []).filter(i => String(i.nomenclature_id) === String(nom.id) && String(i.type).startsWith('scrap')).reduce((sum, i) => sum + (Number(i.total_qty) || 0), 0)

          const activeOrdersForParent = activeOrders.filter(o => {
            let pId = o.nomenclature_id
            if (!pId && o.order_items && o.order_items.length > 0) {
              pId = o.order_items[0].nomenclature_id
            }
            return String(pId) === String(parentId)
          })

          if (activeOrdersForParent.length > 0) {
            activeOrdersForParent.forEach(o => {
              qSgp += orderAllocatedSgp[o.id]?.[nom.id] || 0
              qBz += orderAllocatedBz[o.id]?.[nom.id] || 0
            })
          } else {
            qSgp = (inventory || []).filter(i => String(i.nomenclature_id) === String(nom.id) && (i.type === 'finished' || i.warehouse === 'sgp' || i.warehouse === 'SGP')).reduce((sum, i) => sum + (Number(i.total_qty) || 0), 0)
            qBz = (inventory || []).filter(i => String(i.nomenclature_id) === String(nom.id) && i.type === 'bz').reduce((sum, i) => sum + (Number(i.total_qty) || 0), 0)
          }
        }

        // Sum = WIP на етапах + буферах + кількість на СГП для цього конкретного наряду
        const sum = qCutWait + qCut + qCutBuf + qGalt + qGaltBuf + qPriyCards + qSortAct + qSortCards + qMalWait + qMal + qMalBuf + qPres + qPresBuf + qDoop + qDoopBuf + qSgp

        const row = {
          id: nom.id + (isOther ? '' : '_' + parentId),
          name: nom.name,
          code: nom.code || '',
          type: nom.type,
          demand: specificDemand, // Реальна потреба в штуках
          qtyPerProduct,
          qCutWait,
          qCut,
          qCutBuf,
          qGalt,
          qGaltBuf,
          qPriy: qPriyCards,
          qSortAct,
          qSort: qSortCards,
          qMalWait,
          qMal,
          qMalBuf,
          qPres,
          qPresBuf,
          qDoop,
          qDoopBuf,
          qSgp,
          qBz,
          qScrap,
          sum
        }

        const matchesSearch = row.name.toLowerCase().includes(searchQuery.toLowerCase()) || row.code.toLowerCase().includes(searchQuery.toLowerCase())
        if (matchesSearch) {
          if (wipOnly) {
            const hasActiveOrder = !isOther && (demandData.productDemand[parentId] || 0) > 0
            if (hasActiveOrder) {
              groups[parentId].rows.push(row)
              totalsAcc.qCutWait += qCutWait; totalsAcc.qCut += qCut; totalsAcc.qCutBuf += qCutBuf;
              totalsAcc.qGalt += qGalt; totalsAcc.qGaltBuf += qGaltBuf; totalsAcc.qPriy += qPriyCards;
              totalsAcc.qSortAct += qSortAct; totalsAcc.qSort += qSortCards; totalsAcc.qMalWait += qMalWait;
              totalsAcc.qMal += qMal; totalsAcc.qMalBuf += qMalBuf; totalsAcc.qPres += qPres;
              totalsAcc.qPresBuf += qPresBuf; totalsAcc.qDoop += qDoop; totalsAcc.qDoopBuf += qDoopBuf;
              totalsAcc.qSgp += qSgp; totalsAcc.qBz += qBz; totalsAcc.qScrap += qScrap; totalsAcc.sum += sum;
            }
          } else {
            groups[parentId].rows.push(row)
            totalsAcc.qCutWait += qCutWait; totalsAcc.qCut += qCut; totalsAcc.qCutBuf += qCutBuf;
            totalsAcc.qGalt += qGalt; totalsAcc.qGaltBuf += qGaltBuf; totalsAcc.qPriy += qPriyCards;
            totalsAcc.qSortAct += qSortAct; totalsAcc.qSort += qSortCards; totalsAcc.qMalWait += qMalWait;
            totalsAcc.qMal += qMal; totalsAcc.qMalBuf += qMalBuf; totalsAcc.qPres += qPres;
            totalsAcc.qPresBuf += qPresBuf; totalsAcc.qDoop += qDoop; totalsAcc.qDoopBuf += qDoopBuf;
            totalsAcc.qSgp += qSgp; totalsAcc.qBz += qBz; totalsAcc.qScrap += qScrap; totalsAcc.sum += sum;
          }
        }
      })
    })

    activeOrders.forEach(order => {
      const orderTasks = tasks?.filter(t => t.order_id === order.id) || []
      if (orderTasks.length === 0) return

      // Find the parent product for this order
      let prodId = order.nomenclature_id
      if (!prodId && order.order_items && order.order_items.length > 0) {
        prodId = order.order_items[0].nomenclature_id
      }
      if (!prodId) return
      const prod = nomenclatures.find(n => String(n.id) === String(prodId))
      if (!prod) return

      const displayNum = order.order_num || order.id.split('-')[0]

      let minPotential = Infinity
      let maxWipSetsCalculated = 0
      let bottleneckPartName = ''
      let bottleneckPartCode = ''
      let bottleneckQty = 0
      let bottleneckQtyPerProduct = 1
      let hasValidDetail = false

      // Get BOM items for this order: if snapshot exists, use it; otherwise use static bomItems
      const orderBoms = []
      // UUID regex to filter out non-part keys like 'arrivals'
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      const taskWithSnapshot = orderTasks.find(t => t.plan_snapshot && Object.keys(t.plan_snapshot).some(k => uuidRegex.test(k)))
      if (taskWithSnapshot) {
        const plannedSets = Number(taskWithSnapshot.planned_sets) || 1
        Object.entries(taskWithSnapshot.plan_snapshot).forEach(([childId, entry]) => {
          // Only process valid UUID keys (skip 'arrivals', '_metadata', etc.)
          if (!uuidRegex.test(childId)) return
          const need = Number(entry.need) || 0
          orderBoms.push({
            child_id: childId,
            quantity_per_parent: plannedSets > 0 ? Math.round(need / plannedSets) : need
          })
        })
      } else {
        bomItems.filter(b => String(b.parent_id) === String(prod.id)).forEach(b => {
          orderBoms.push({
            child_id: String(b.child_id),
            quantity_per_parent: Number(b.quantity_per_parent) || 1
          })
        })
      }

      const bottlenecksList = []
      const orderTaskIds = orderTasks.map(t => t.id)
      const orderTaskCards = (workCards || []).filter(c => orderTaskIds.includes(c.task_id))

      orderBoms.forEach(bomEntry => {
        const nom = nomenclatures.find(n => String(n.id) === String(bomEntry.child_id))
        if (!nom || nom.type !== 'part') return

        const qtyPerProduct = Number(bomEntry.quantity_per_parent) || 1

        // Calculate WIP for this order's tasks
        const taskCards = orderTaskCards.filter(c => String(c.nomenclature_id) === String(nom.id))

        const qCutWait = taskCards.filter(c => c.operation === 'Розкрій' && c.status === 'new').reduce((sum, c) => sum + (Number(c.quantity) || 0), 0)
        const qCut = taskCards.filter(c => c.operation === 'Розкрій' && c.status === 'in-progress').reduce((sum, c) => sum + (Number(c.quantity) || 0), 0)
        const qCutBuf = taskCards.filter(c => c.operation === 'Розкрій' && c.status === 'at-buffer').reduce((sum, c) => sum + (Number(c.quantity) || 0), 0)
        const qGalt = taskCards.filter(c => c.operation === 'Галтовка' && c.status === 'in-progress').reduce((sum, c) => sum + (Number(c.quantity) || 0), 0)
        const qGaltBuf = taskCards.filter(c => c.operation === 'Галтовка' && c.status === 'at-buffer').reduce((sum, c) => sum + (Number(c.quantity) || 0), 0)
        const qPriyCards = taskCards.filter(c => c.operation === 'Прийомка').reduce((sum, c) => sum + (Number(c.quantity) || 0), 0)
        const qSortAct = taskCards.filter(c => c.operation === 'Сортування' && ['in-progress', 'at-buffer'].includes(c.status)).reduce((sum, c) => sum + (Number(c.quantity) || 0), 0)
        const qSortCards = taskCards.filter(c => c.status === 'at-shop2-buffer').reduce((sum, c) => sum + Math.max(0, (Number(c.quantity) || 0) - (Number(c.used_in_shop2_qty) || 0)), 0)
        const qMalWait = taskCards.filter(c => ['Фарбування', 'Малярка'].includes(c.operation) && c.status === 'new').reduce((sum, c) => sum + (Number(c.quantity) || 0), 0)
        const qMal = taskCards.filter(c => ['Фарбування', 'Малярка'].includes(c.operation) && c.status === 'in-progress').reduce((sum, c) => sum + (Number(c.quantity) || 0), 0)
        const qMalBuf = taskCards.filter(c => ['Фарбування', 'Малярка'].includes(c.operation) && c.status === 'at-buffer').reduce((sum, c) => sum + (Number(c.quantity) || 0), 0)
        const qPres = taskCards.filter(c => c.operation === 'Пресування' && ['new', 'in-progress'].includes(c.status)).reduce((sum, c) => sum + (Number(c.quantity) || 0), 0)
        const qPresBuf = taskCards.filter(c => c.operation === 'Пресування' && c.status === 'at-buffer').reduce((sum, c) => sum + (Number(c.quantity) || 0), 0)
        const qDoop = taskCards.filter(c => c.operation === 'Доопрацювання' && ['new', 'in-progress'].includes(c.status)).reduce((sum, c) => sum + (Number(c.quantity) || 0), 0)
        const qDoopBuf = taskCards.filter(c => c.operation === 'Доопрацювання' && c.status === 'at-buffer').reduce((sum, c) => sum + (Number(c.quantity) || 0), 0)

        // Use allocated inventory quantities for order-specific bottleneck calculations
        const qBz = orderAllocatedBz[order.id]?.[nom.id] || 0
        const qBzShop2 = orderAllocatedBzShop2[order.id]?.[nom.id] || 0
        const qSgp = orderAllocatedSgp[order.id]?.[nom.id] || 0

        const sumVal = qCutWait + qCut + qCutBuf + qGalt + qGaltBuf + qPriyCards + qSortAct + qSortCards + qMalWait + qMal + qMalBuf + qPres + qPresBuf + qDoop + qDoopBuf + qBz + qBzShop2 + qSgp

        // WIP sets from active production cards
        const activeProductionCards = taskCards.filter(c => c.operation !== 'Склад БЗ')
        const partWipQty = activeProductionCards.reduce((sum, c) => {
          if (c.status === 'completed') return sum
          if (c.status === 'at-shop2-buffer') {
            return sum + Math.max(0, (Number(c.quantity) || 0) - (Number(c.used_in_shop2_qty) || 0))
          }
          return sum + (Number(c.quantity) || 0)
        }, 0)
        const partWipSets = Math.floor(partWipQty / qtyPerProduct)
        if (partWipSets > maxWipSetsCalculated) {
          maxWipSetsCalculated = partWipSets
        }

        const snapshot = taskWithSnapshot?.plan_snapshot?.[String(nom.id)]
        let need = 0
        if (snapshot) {
          need = Number(snapshot.need) || 0
        } else {
          const itemRef = order.order_items?.find(it => it.nomenclature_id === nom.id)
          if (itemRef) {
            need = Number(itemRef.quantity) || 0
          } else {
            (order.order_items || []).forEach(oi => {
              const bom = bomItems.filter(b => b.parent_id === oi.nomenclature_id)
              const bItem = bom.find(b => b.child_id === nom.id)
              if (bItem) {
                need += (Number(oi.quantity) || 0) * (Number(bItem.quantity_per_parent) || 1)
              }
            })
          }
        }

        // Розраховуємо дефіцит виробництва (shortage): Потреба - (WIP + СГП)
        // БЗ не включається сюди, бо БЗ це складські залишки, які не є випущеними під цей наряд деталями
        const productionAndSgpVal = qCutWait + qCut + qCutBuf + qGalt + qGaltBuf + qPriyCards + qSortAct + qSortCards + qMalWait + qMal + qMalBuf + qPres + qPresBuf + qDoop + qDoopBuf + qSgp
        const shortage = Math.max(0, need - productionAndSgpVal)

        // Calculate potential sets
        const potentialSetsForThisPart = Math.floor(sumVal / qtyPerProduct)
        if (potentialSetsForThisPart < minPotential) {
          minPotential = potentialSetsForThisPart
          bottleneckPartName = nom.name
          bottleneckPartCode = nom.code
          bottleneckQty = sumVal
          bottleneckQtyPerProduct = qtyPerProduct
          hasValidDetail = true
        }
        if (shortage > 0) {
          bottlenecksList.push({
            name: nom.name,
            code: nom.code,
            potential: Math.floor(sumVal / qtyPerProduct),
            qty: sumVal,
            needed: need,
            shortage: shortage,
            qtyPerProduct
          })
        }
      })

      if (minPotential === Infinity) minPotential = 0

      let actualSgpSets = Infinity
      let minWipSets = Infinity
      
      orderBoms.forEach(bomEntry => {
        const nom = nomenclatures.find(n => String(n.id) === String(bomEntry.child_id))
        if (!nom || nom.type !== 'part') return
        const qtyPerProduct = Number(bomEntry.quantity_per_parent) || 1
        
        // SGP sets: allocated finished stock
        const currentSgpQty = orderAllocatedSgp[order.id]?.[nom.id] || 0
        const sgpSets = Math.floor(currentSgpQty / qtyPerProduct)
        if (sgpSets < actualSgpSets) {
          actualSgpSets = sgpSets
        }

        // Real WIP sets on production floor
        const taskCards = orderTaskCards.filter(c => String(c.nomenclature_id) === String(nom.id))
        const activeProductionCards = taskCards.filter(c => c.operation !== 'Склад БЗ')
        const partWipQty = activeProductionCards.reduce((sum, c) => {
          if (c.status === 'completed') return sum
          if (c.status === 'at-shop2-buffer') {
            return sum + Math.max(0, (Number(c.quantity) || 0) - (Number(c.used_in_shop2_qty) || 0))
          }
          return sum + (Number(c.quantity) || 0)
        }, 0)
        const partWipSets = Math.floor(partWipQty / qtyPerProduct)
        if (partWipSets < minWipSets) {
          minWipSets = partWipSets
        }
      })
      
      if (actualSgpSets === Infinity) actualSgpSets = 0
      if (minWipSets === Infinity) minWipSets = 0

      const plannedTask = orderTasks.find(t => t.planned_sets) || orderTasks[0]
      const totalDemand = Number(plannedTask?.planned_sets) || Number(order.order_items?.[0]?.quantity) || Number(order.quantity) || 0

      bottlenecksList.sort((a, b) => a.shortage - b.shortage)

      // WIP is the minimum completed sets moving through active shop tasks
      const calculatedWip = minWipSets
      const remainingDemand = Math.max(0, totalDemand - actualSgpSets - calculatedWip)

      trends[order.id] = {
        id: order.id,
        name: `Наряд №${displayNum} (${prod.name})`,
        code: prod.code || '',
        potential: minPotential,
        actual: actualSgpSets,
        demand: totalDemand,
        wip: calculatedWip,
        remainingDemand,
        bottleneck: bottleneckPartName ? `${bottleneckPartName}${bottleneckPartCode ? ` (${bottleneckPartCode})` : ''}` : null,
        bottleneckQty,
        bottleneckNeeded: totalDemand * bottleneckQtyPerProduct,
        bottleneckQtyPerProduct,
        bottlenecks: bottlenecksList
      }
      if (groups[prod.id]) {
        groups[prod.id].trend = trends[order.id]
      }
    })

    const finalGroups = Object.values(groups).filter(g => g.rows.length > 0)

    return { groupedDashboardData: finalGroups, totals: totalsAcc, productTrends: trends }
  }, [nomenclatures, bomItems, orders, workCards, inventory, demandData, taskParentMap, searchQuery, wipOnly, shippedQuantities, activeOrders, workCardHistory])

  const getGroupTotals = (rows) => {
    const res = { qCutWait: 0, qCut: 0, qCutBuf: 0, qGalt: 0, qGaltBuf: 0, qPriy: 0, qSortAct: 0, qSort: 0, qMalWait: 0, qMal: 0, qMalBuf: 0, qPres: 0, qPresBuf: 0, qDoop: 0, qDoopBuf: 0, qSgp: 0, qBz: 0, qScrap: 0, sum: 0 }
    rows.forEach(row => {
      res.qCutWait += row.qCutWait
      res.qCut += row.qCut
      res.qCutBuf += row.qCutBuf
      res.qGalt += row.qGalt
      res.qGaltBuf += row.qGaltBuf
      res.qPriy += row.qPriy
      res.qSortAct += row.qSortAct
      res.qSort += row.qSort
      res.qMalWait += row.qMalWait
      res.qMal += row.qMal
      res.qMalBuf += row.qMalBuf
      res.qPres += row.qPres
      res.qPresBuf += row.qPresBuf
      res.qDoop += row.qDoop
      res.qDoopBuf += row.qDoopBuf
      res.qSgp += row.qSgp
      res.qBz += row.qBz
      res.qScrap += row.qScrap
      res.sum += row.sum
    })
    return res
  }

  const renderValue = (val, type = 'normal', demand = 0) => {
    if (!val) val = 0;

    if (val === 0 && !demand) {
      return <span style={{ color: '#4b5563', fontWeight: 400, opacity: 0.5 }}>0</span>
    }
    let color = '#f3f4f6'
    let bg = 'transparent'
    let border = 'none'
    let padding = '2px 6px'
    let borderRadius = '4px'

    if (type === 'sum') {
      color = '#ff9000'
      bg = 'rgba(255, 144, 0, 0.08)'
      border = '1px solid rgba(255, 144, 0, 0.2)'
    } else if (type === 'sgp' || type === 'bz') {
      color = '#10b981'
      bg = 'rgba(16, 185, 129, 0.08)'
      border = '1px solid rgba(16, 185, 129, 0.2)'
    } else if (type === 'scrap') {
      color = '#ef4444'
      bg = 'rgba(239, 68, 68, 0.08)'
      border = '1px solid rgba(239, 68, 68, 0.2)'
    } else {
      bg = 'rgba(255, 255, 255, 0.04)'
      border = '1px solid rgba(255, 255, 255, 0.08)'
    }

    let displayVal = val;
    if (type === 'sum' && demand > 0) {
      displayVal = `${val} / ${demand}`;
    }

    return (
      <span style={{
        fontWeight: 'bold',
        color,
        background: bg,
        border,
        padding,
        borderRadius,
        display: 'inline-block',
        minWidth: '24px',
        textAlign: 'center',
        whiteSpace: 'nowrap'
      }}>
        {displayVal}
      </span>
    )
  }

  const selectedOrderNum = useMemo(() => {
    if (!selectedOrderId || !orders) return ''
    const order = orders.find(o => String(o.id) === String(selectedOrderId))
    return order?.order_num || selectedOrderId.split('-')[0]
  }, [selectedOrderId, orders])

  return (
    <div className="dashboard-module-v2" style={{ background: '#09090b', minHeight: '100vh', color: '#f4f4f5', display: 'flex', flexDirection: 'column' }}>
      {/* Navigation bar matching look and feel of other modules */}
      <nav className="module-nav" style={{
        flexShrink: 0,
        padding: '0 24px',
        height: '70px',
        background: '#09090b',
        borderBottom: '1px solid #27272a',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <Link to="/" style={{ color: '#a1a1aa', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', transition: 'color 0.2s' }}>
            <ArrowLeft size={18} /> <span className="hide-mobile">На головну</span>
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <LayoutDashboard className="text-secondary" size={24} color="#ff9000" />
            <h1 style={{ fontSize: '1rem', fontWeight: 900, textTransform: 'uppercase', margin: 0, letterSpacing: '0.5px' }}>Дашборд Виробництва (WIP){selectedOrderId ? ` — НАРЯД №${selectedOrderNum}` : ''}</h1>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{ textAlign: 'right', lineHeight: 1.2 }} className="hide-mobile">
            <div style={{ fontSize: '0.85rem', fontWeight: 900, color: '#f4f4f5' }}>{currentUser?.first_name} {currentUser?.last_name}</div>
            <div style={{ fontSize: '0.65rem', color: '#ff9000', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{currentUser?.position}</div>
          </div>
        </div>
      </nav>

      {/* ── TABS ── */}
      <div style={{ display: 'flex', overflowX: 'auto', gap: '10px', padding: '0 24px', marginBottom: '10px', marginTop: '15px' }}>
        <button
          onClick={() => setSelectedOrderId(null)}
          style={{
            background: selectedOrderId === null ? '#ff9000' : '#18181b',
            color: selectedOrderId === null ? '#000' : '#a1a1aa',
            border: `1px solid ${selectedOrderId === null ? '#ff9000' : '#27272a'}`,
            padding: '8px 16px',
            borderRadius: '10px',
            fontWeight: 800,
            fontSize: '0.8rem',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            transition: 'all 0.2s'
          }}
        >
          ЗАГАЛЬНИЙ ДАШБОРД
        </button>
        {activeOrders.map(order => {
          const displayNum = order.order_num || order.id.split('-')[0]
          return (
            <button
              key={order.id}
              onClick={() => setSelectedOrderId(order.id)}
              style={{
                background: selectedOrderId === order.id ? '#3b82f6' : '#18181b',
                color: selectedOrderId === order.id ? '#fff' : '#a1a1aa',
                border: `1px solid ${selectedOrderId === order.id ? '#3b82f6' : '#27272a'}`,
                padding: '8px 16px',
                borderRadius: '10px',
                fontWeight: 800,
                fontSize: '0.8rem',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.2s'
              }}
            >
              НАРЯД №{displayNum}
            </button>
          )
        })}
      </div>

      {/* Module Content Area */}
      <div className="module-content" style={{ padding: '30px', overflowY: 'auto', flex: 1, maxWidth: '1600px', margin: '0 auto', width: '100%' }}>
        <section className="glass-panel" style={{ padding: '30px', borderRadius: '32px', border: '1px solid #27272a', background: 'rgba(15,15,18,0.7)', backdropFilter: 'blur(20px)', boxShadow: '0 20px 40px rgba(0,0,0,0.4)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px', marginBottom: '25px' }}>
            <div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 950, margin: '0 0 5px 0', display: 'flex', alignItems: 'center', gap: '10px', color: '#ffffff', letterSpacing: '0.5px' }}>
                <LayoutDashboard style={{ color: '#ff9000' }} size={24} /> ДАШБОРД ВИРОБНИЦТВА (WIP)
              </h2>
              <p style={{ color: '#a1a1aa', fontSize: '0.78rem', margin: 0 }}>Розподіл деталей та напівфабрикатів за етапами технологічного ланцюжка</p>
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              {/* Refresh Button */}
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                style={{ background: '#18181b', border: '1px solid #27272a', color: '#fff', padding: '10px 14px', borderRadius: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s', fontSize: '0.85rem' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#27272a'; e.currentTarget.style.borderColor = '#ff9000'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#18181b'; e.currentTarget.style.borderColor = '#27272a'; }}
              >
                <RefreshCw className={isRefreshing ? 'anim-spin' : ''} size={16} />
                <span>Оновити дані</span>
              </button>
            </div>
          </div>

          {/* Filters and Search Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px', background: '#09090b', padding: '15px 20px', borderRadius: '18px', marginBottom: '20px', border: '1px solid #27272a' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: '260px' }}>
              <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#71717a' }} />
              <input
                type="text"
                placeholder="Пошук деталі за назвою або кодом..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ width: '100%', padding: '12px 15px 12px 42px', background: '#18181b', border: '1px solid #27272a', borderRadius: '12px', color: '#fff', fontSize: '0.85rem', outline: 'none', transition: 'border-color 0.2s' }}
                onFocus={e => e.target.style.borderColor = '#ff9000'}
                onBlur={e => e.target.style.borderColor = '#27272a'}
              />
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#a1a1aa', fontSize: '0.85rem', cursor: 'pointer', userSelect: 'none' }}>
              <input
                type="checkbox"
                checked={wipOnly}
                onChange={e => setWipOnly(e.target.checked)}
                style={{ width: '18px', height: '18px', accentColor: '#ff9000', cursor: 'pointer' }}
              />
              <span>Тільки ті, на які є замовлення</span>
            </label>
          </div>

          {/* ── BOTTLENECKS & PRODUCT TRENDS PANEL ── */}
          {(() => {
            const filteredTrends = Object.entries(productTrends).filter(([id]) => !selectedOrderId || id === selectedOrderId);
            if (filteredTrends.length === 0) return null;
            return (
              <div style={{ marginBottom: '28px' }}>
                {/* Panel Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem' }}>⚡</div>
                    <div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 900, color: '#fff', letterSpacing: '0.03em', textTransform: 'uppercase' }}>Вузькі Місця & Тренди за нарядами</div>
                      <div style={{ fontSize: '0.65rem', color: '#71717a', fontWeight: 600, marginTop: '1px' }}>Аналіз потенціалу нарядів та обмежувальних деталей</div>
                    </div>
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#52525b', fontWeight: 700, background: '#18181b', border: '1px solid #27272a', padding: '5px 12px', borderRadius: '8px' }}>
                    {filteredTrends.length} наряд(ів)
                  </div>
                </div>

                {/* Trend Cards Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '16px' }}>
                  {filteredTrends.map(([id, trend]) => {
                    const order = orders?.find(o => String(o.id) === String(id))
                    let prodId = order?.nomenclature_id
                    if (!prodId && order?.order_items && order.order_items.length > 0) {
                      prodId = order.order_items[0].nomenclature_id
                    }
                    const hasGroup = groupedDashboardData.some(g => String(g.id) === String(prodId))
                    if (!hasGroup) return null

                    const pct = trend.demand > 0 ? Math.min(100, Math.round((trend.actual / trend.demand) * 100)) : 0
                    const isCritical = pct < 30
                    const isWarning = pct >= 30 && pct < 70
                    const accentColor = isCritical ? '#ef4444' : isWarning ? '#f59e0b' : '#10b981'
                    const accentBg = isCritical ? 'rgba(239,68,68,0.07)' : isWarning ? 'rgba(245,158,11,0.07)' : 'rgba(16,185,129,0.07)'
                    const accentBorder = isCritical ? 'rgba(239,68,68,0.22)' : isWarning ? 'rgba(245,158,11,0.22)' : 'rgba(16,185,129,0.22)'
                    const statusLabel = isCritical ? '🔴 КРИТИЧНИЙ ДЕФІЦИТ' : isWarning ? '🟡 УВАГА' : '🟢 В НОРМІ'
                    // wip = active sets in production
                    const wip = trend.wip || 0
                    const remainingDemand = trend.remainingDemand || 0

                    return (
                      <div key={id} style={{
                        background: 'linear-gradient(145deg, #141417, #0f0f12)',
                        border: `1px solid ${accentBorder}`,
                        borderRadius: '20px',
                        overflow: 'hidden',
                        boxShadow: `0 4px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.03)`,
                        transition: 'transform 0.2s, box-shadow 0.2s',
                      }}
                        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 10px 32px rgba(0,0,0,0.5), 0 0 0 1px ${accentBorder}` }}
                        onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = `0 4px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.03)` }}
                      >
                        {/* Card Top Stripe */}
                        <div style={{ height: '3px', background: `linear-gradient(90deg, ${accentColor}, transparent)` }} />

                        <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: '14px' }}>

                          {/* Header: Name + Status Badge */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                            <div style={{ flex: 1 }}>
                              <span style={{ fontSize: '0.58rem', background: accentBg, color: accentColor, padding: '3px 8px', borderRadius: '6px', fontWeight: 900, letterSpacing: '0.06em', border: `1px solid ${accentBorder}` }}>
                                {statusLabel}
                              </span>
                              <div style={{ fontSize: '0.95rem', fontWeight: 900, color: '#f4f4f5', marginTop: '7px', lineHeight: 1.2 }}>{trend.name}</div>
                              {trend.code && <div style={{ fontSize: '0.62rem', color: '#52525b', fontWeight: 700, marginTop: '3px' }}>КОД: {trend.code}</div>}
                            </div>

                            {/* Ratio */}
                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                              <div style={{ fontSize: '0.55rem', color: '#52525b', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>СГП / Потреба</div>
                              <div style={{ fontSize: '1.4rem', fontWeight: 950, color: accentColor, lineHeight: 1.1, marginTop: '3px' }}>
                                {trend.actual}
                                <span style={{ fontSize: '0.8rem', color: '#71717a', fontWeight: 500 }}> / {trend.demand || 0}</span>
                              </div>
                              <div style={{ fontSize: '0.62rem', color: '#52525b', fontWeight: 700 }}>компл.</div>
                            </div>
                          </div>

                          {/* Progress Bar */}
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', fontWeight: 800, marginBottom: '5px' }}>
                              <span style={{ color: '#71717a' }}>Виконання потреби замовлень</span>
                              <span style={{ color: accentColor }}>{pct}%</span>
                            </div>
                            <div style={{ height: '7px', background: '#09090b', borderRadius: '10px', overflow: 'hidden', border: '1px solid #27272a', position: 'relative' }}>
                              <div style={{ width: `${pct}%`, height: '100%', background: `linear-gradient(90deg, ${accentColor}, ${accentColor}cc)`, borderRadius: '10px', transition: 'width 0.5s ease', boxShadow: `0 0 8px ${accentColor}66` }} />
                            </div>
                          </div>

                          {/* Stats Row */}
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                            <div style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)', borderRadius: '12px', padding: '10px 12px' }}>
                              <div style={{ fontSize: '0.58rem', color: '#6b7280', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>На СГП зараз</div>
                              <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#10b981' }}>{trend.actual} <span style={{ fontSize: '0.65rem', color: '#6b7280', fontWeight: 600 }}>компл.</span></div>
                            </div>
                            <div style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)', borderRadius: '12px', padding: '10px 12px' }}>
                              <div style={{ fontSize: '0.58rem', color: '#6b7280', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>В роботі</div>
                              <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#3b82f6' }}>{wip} <span style={{ fontSize: '0.65rem', color: '#6b7280', fontWeight: 600 }}>компл.</span></div>
                            </div>
                            <div style={{ background: 'rgba(255,144,0,0.06)', border: '1px solid rgba(255,144,0,0.15)', borderRadius: '12px', padding: '10px 12px' }}>
                              <div style={{ fontSize: '0.58rem', color: '#6b7280', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Залишок потреби</div>
                              <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#ff9000' }}>{remainingDemand} <span style={{ fontSize: '0.65rem', color: '#6b7280', fontWeight: 600 }}>компл.</span></div>
                            </div>
                          </div>

                          {/* Bottleneck Details */}
                          {trend.bottlenecks && trend.bottlenecks.length > 0 ? (
                            <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.18)', borderRadius: '12px', padding: '11px 14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                                <span style={{ fontSize: '1rem' }}>⚠️</span>
                                <span style={{ fontSize: '0.65rem', color: '#f87171', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Вузькі місця ({trend.bottlenecks.length})</span>
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto', paddingRight: '4px' }} className="tasks-scroll">
                                {trend.bottlenecks.map(b => (
                                  <div key={b.name} style={{ borderBottom: '1px solid rgba(239,68,68,0.1)', paddingBottom: '6px' }}>
                                    <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#fff', wordBreak: 'break-word' }}>
                                      {b.name} {b.code ? `(${b.code})` : ''}
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                                      <span style={{ fontSize: '0.65rem', color: '#9ca3af' }}>
                                        Деталей: <strong style={{ color: '#fca5a5' }}>{b.qty}</strong> / {b.needed} шт.
                                      </span>
                                      <span style={{ fontSize: '0.65rem', color: '#f87171', fontWeight: 700 }}>
                                        Дефіцит: -{b.shortage} шт.
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div style={{ background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.12)', borderRadius: '12px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '1rem' }}>✅</span>
                              <span style={{ fontSize: '0.72rem', color: '#6ee7b7', fontWeight: 700 }}>Вузьких місць не виявлено</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })()}

          {/* ========================================== */}
          {/* SPREADSHEET REPLICA (GROUPED)       */}
          {/* ========================================== */}
          <div className="wip-table-container" style={{ borderRadius: '16px', border: '1px solid #27272a', background: '#09090b', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', padding: '1px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'inherit', fontSize: '0.8rem', color: '#f4f4f5' }}>
              <thead>
                <tr style={{ background: '#18181b', color: '#a1a1aa', textAlign: 'center', borderBottom: '2px solid #27272a' }}>
                  <th className="wip-sticky-col" style={{ padding: '14px 18px', textAlign: 'left', fontWeight: 'bold', borderRight: '1px solid #27272a', color: '#f4f4f5', position: 'sticky', top: 0, left: 0, zIndex: 40, background: '#18181b' }}>Номенклатура</th>
                  <th className="wip-sticky-sum" style={{ padding: '14px 18px', fontWeight: 'bold', borderRight: '1px solid #27272a', background: '#251b14', color: '#ff9000', position: 'sticky', top: 0, zIndex: 40 }}>Сума</th>
                  <th style={{ padding: '14px 18px', fontWeight: '500', borderRight: '1px solid #27272a', background: '#18181b', color: '#a1a1aa', position: 'sticky', top: 0, zIndex: 10 }}>Очікують Розкрою</th>
                  <th style={{ padding: '14px 18px', fontWeight: '500', borderRight: '1px solid #27272a', position: 'sticky', top: 0, zIndex: 10, background: '#18181b' }}>Розкрій (Робота)</th>
                  <th style={{ padding: '14px 18px', fontWeight: '500', borderRight: '1px solid #27272a', background: '#18181b', color: '#a1a1aa', position: 'sticky', top: 0, zIndex: 10 }}>Буфер Розкрою</th>
                  <th style={{ padding: '14px 18px', fontWeight: '500', borderRight: '1px solid #27272a', position: 'sticky', top: 0, zIndex: 10, background: '#18181b' }}>Галтовка (Робота)</th>
                  <th style={{ padding: '14px 18px', fontWeight: '500', borderRight: '1px solid #27272a', background: '#18181b', color: '#a1a1aa', position: 'sticky', top: 0, zIndex: 10 }}>Буфер Галтовки</th>
                  <th style={{ padding: '14px 18px', fontWeight: '500', borderRight: '1px solid #27272a', position: 'sticky', top: 0, zIndex: 10, background: '#18181b' }}>Прийомка (Робота)</th>
                  <th style={{ padding: '14px 18px', fontWeight: '500', borderRight: '1px solid #27272a', background: '#18181b', color: '#a1a1aa', position: 'sticky', top: 0, zIndex: 10 }}>Сортування (Робота)</th>
                  <th style={{ padding: '14px 18px', fontWeight: '500', borderRight: '1px solid #27272a', background: '#18181b', color: '#a1a1aa', position: 'sticky', top: 0, zIndex: 10 }}>Буфер Цеху №2</th>
                  <th style={{ padding: '14px 18px', fontWeight: '500', borderRight: '1px solid #27272a', background: '#18181b', color: '#a1a1aa', position: 'sticky', top: 0, zIndex: 10 }}>Очікують Малярки</th>
                  <th style={{ padding: '14px 18px', fontWeight: '500', borderRight: '1px solid #27272a', position: 'sticky', top: 0, zIndex: 10, background: '#18181b' }}>Малярка (Робота)</th>
                  <th style={{ padding: '14px 18px', fontWeight: '500', borderRight: '1px solid #27272a', background: '#18181b', color: '#a1a1aa', position: 'sticky', top: 0, zIndex: 10 }}>Буфер Малярки</th>
                  <th style={{ padding: '14px 18px', fontWeight: '500', borderRight: '1px solid #27272a', position: 'sticky', top: 0, zIndex: 10, background: '#18181b' }}>Пресування (Робота)</th>
                  <th style={{ padding: '14px 18px', fontWeight: '500', borderRight: '1px solid #27272a', background: '#18181b', color: '#a1a1aa', position: 'sticky', top: 0, zIndex: 10 }}>Буфер Пресування</th>
                  <th style={{ padding: '14px 18px', fontWeight: '500', borderRight: '1px solid #27272a', position: 'sticky', top: 0, zIndex: 10, background: '#18181b' }}>Доопрацювання (Робота)</th>
                  <th style={{ padding: '14px 18px', fontWeight: '500', borderRight: '1px solid #27272a', background: '#18181b', color: '#a1a1aa', position: 'sticky', top: 0, zIndex: 10 }}>Буфер Доопрацювання</th>
                  <th style={{ padding: '14px 18px', fontWeight: 'bold', borderRight: '1px solid #27272a', background: '#12251e', color: '#10b981', position: 'sticky', top: 0, zIndex: 10 }}>Склад (СГП)</th>
                  <th style={{ padding: '14px 18px', fontWeight: 'bold', borderRight: '1px solid #27272a', background: '#12251e', color: '#10b981', position: 'sticky', top: 0, zIndex: 10 }}>Склад БЗ</th>
                  <th style={{ padding: '14px 18px', fontWeight: 'bold', background: '#221414', color: '#ef4444', position: 'sticky', top: 0, zIndex: 10 }}>Брак</th>
                </tr>
              </thead>
              <tbody>
                {groupedDashboardData.length === 0 ? (
                  <tr>
                    <td colSpan={20} style={{ padding: '40px', textAlign: 'center', color: '#71717a', fontStyle: 'italic', background: 'transparent' }}>
                      Немає активних деталей за обраними фільтрами
                    </td>
                  </tr>
                ) : (
                  groupedDashboardData.map(group => {
                    const groupTotals = getGroupTotals(group.rows)

                    return (
                      <React.Fragment key={group.id}>
                        {/* Group Header Row */}
                        <tr style={{ background: '#1c1917', color: '#fff', borderBottom: '2px solid #27272a' }}>
                          <td colSpan={20} style={{ padding: '14px 18px', textAlign: 'left', fontWeight: 'bold', borderBottom: '1px solid #27272a', position: 'sticky', left: 0, background: '#1c1917', zIndex: 2 }}>
                            <div style={{ position: 'sticky', left: '16px', display: 'inline-flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px 12px', maxWidth: 'calc(100vw - 40px)' }}>
                              <span style={{ color: '#ff9000' }}>📦</span>
                              <span style={{ whiteSpace: 'nowrap' }}>{group.name}{group.code ? ` (${group.code})` : ''}</span>
                              {group.trend && (
                                <span style={{ color: '#a1a1aa', fontSize: '0.78rem', fontWeight: 'normal' }}>
                                  (Потенційний тренд: <strong style={{ color: '#fff' }}>{group.trend.potential}</strong> / {group.trend.demand || 0} компл. | На СГП: <strong style={{ color: '#10b981' }}>{group.trend.actual} компл.</strong>)
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>

                        {/* Group Row Items */}
                        {group.rows.map((row, idx) => (
                          <tr key={row.id} className="wip-row">
                            <td className="wip-sticky-col" style={{ padding: '12px 18px', fontWeight: 'bold', color: '#f4f4f5', borderRight: '1px solid #27272a', paddingLeft: '30px', position: 'sticky', left: 0, background: '#09090b', zIndex: 2 }}>
                              {row.name}
                              {row.code && <span style={{ display: 'block', fontSize: '0.72rem', color: '#71717a', fontWeight: 'normal', marginTop: '2px' }}>Код: {row.code}</span>}
                            </td>
                            <td className="wip-sticky-sum" style={{ padding: '12px 18px', textAlign: 'center', background: '#1c130d', borderRight: '1px solid #27272a', fontWeight: 'bold', position: 'sticky', zIndex: 2 }}>
                              {renderValue(row.sum, 'sum', row.demand)}
                            </td>
                            <td style={{ padding: '12px 18px', textAlign: 'center', borderRight: '1px solid #27272a', background: 'rgba(255, 255, 255, 0.01)' }}>{renderValue(row.qCutWait, 'normal')}</td>
                            <td style={{ padding: '12px 18px', textAlign: 'center', borderRight: '1px solid #27272a' }}>{renderValue(row.qCut, 'normal')}</td>
                            <td style={{ padding: '12px 18px', textAlign: 'center', borderRight: '1px solid #27272a', background: 'rgba(255, 255, 255, 0.01)' }}>{renderValue(row.qCutBuf, 'normal')}</td>
                            <td style={{ padding: '12px 18px', textAlign: 'center', borderRight: '1px solid #27272a' }}>{renderValue(row.qGalt, 'normal')}</td>
                            <td style={{ padding: '12px 18px', textAlign: 'center', borderRight: '1px solid #27272a', background: 'rgba(255, 255, 255, 0.01)' }}>{renderValue(row.qGaltBuf, 'normal')}</td>
                            <td style={{ padding: '12px 18px', textAlign: 'center', borderRight: '1px solid #27272a' }}>{renderValue(row.qPriy, 'normal')}</td>
                            <td style={{ padding: '12px 18px', textAlign: 'center', borderRight: '1px solid #27272a', background: 'rgba(255, 255, 255, 0.01)' }}>{renderValue(row.qSortAct, 'normal')}</td>
                            <td style={{ padding: '12px 18px', textAlign: 'center', borderRight: '1px solid #27272a', background: 'rgba(255, 255, 255, 0.01)' }}>{renderValue(row.qSort, 'normal')}</td>
                            <td style={{ padding: '12px 18px', textAlign: 'center', borderRight: '1px solid #27272a', background: 'rgba(255, 255, 255, 0.01)' }}>{renderValue(row.qMalWait, 'normal')}</td>
                            <td style={{ padding: '12px 18px', textAlign: 'center', borderRight: '1px solid #27272a' }}>{renderValue(row.qMal, 'normal')}</td>
                            <td style={{ padding: '12px 18px', textAlign: 'center', borderRight: '1px solid #27272a', background: 'rgba(255, 255, 255, 0.01)' }}>{renderValue(row.qMalBuf, 'normal')}</td>
                            <td style={{ padding: '12px 18px', textAlign: 'center', borderRight: '1px solid #27272a' }}>{renderValue(row.qPres, 'normal')}</td>
                            <td style={{ padding: '12px 18px', textAlign: 'center', borderRight: '1px solid #27272a', background: 'rgba(255, 255, 255, 0.01)' }}>{renderValue(row.qPresBuf, 'normal')}</td>
                            <td style={{ padding: '12px 18px', textAlign: 'center', borderRight: '1px solid #27272a' }}>{renderValue(row.qDoop, 'normal')}</td>
                            <td style={{ padding: '12px 18px', textAlign: 'center', borderRight: '1px solid #27272a', background: 'rgba(255, 255, 255, 0.01)' }}>{renderValue(row.qDoopBuf, 'normal')}</td>
                            <td style={{ padding: '12px 18px', textAlign: 'center', borderRight: '1px solid #27272a', background: 'rgba(16, 185, 129, 0.02)' }}>{renderValue(row.qSgp, 'sgp')}</td>
                            <td style={{ padding: '12px 18px', textAlign: 'center', background: 'rgba(16, 185, 129, 0.02)' }}>{renderValue(row.qBz, 'bz')}</td>
                            <td style={{ padding: '12px 18px', textAlign: 'center', background: 'rgba(239, 68, 68, 0.02)' }}>{renderValue(row.qScrap, 'scrap')}</td>
                          </tr>
                        ))}

                        {/* Group Subtotals */}
                        <tr style={{ background: '#121214', fontWeight: 'bold', borderTop: '1px solid #27272a', borderBottom: '1px solid #27272a', color: '#a1a1aa', fontSize: '0.78rem' }}>
                          <td className="wip-sticky-col" style={{ padding: '12px 18px', borderRight: '1px solid #27272a', fontStyle: 'italic', paddingLeft: '30px', position: 'sticky', left: 0, background: '#121214', zIndex: 2 }}>
                            Підсумок по виробу:
                          </td>
                          <td className="wip-sticky-sum" style={{ padding: '12px 18px', textAlign: 'center', background: '#251a12', borderRight: '1px solid #27272a', color: '#ff9000', position: 'sticky', zIndex: 2 }}>
                            {renderValue(groupTotals.sum, 'sum')}
                          </td>
                          <td style={{ padding: '12px 18px', textAlign: 'center', borderRight: '1px solid #27272a', background: 'rgba(255, 255, 255, 0.01)' }}>{renderValue(groupTotals.qCutWait, 'normal')}</td>
                          <td style={{ padding: '12px 18px', textAlign: 'center', borderRight: '1px solid #27272a' }}>{renderValue(groupTotals.qCut, 'normal')}</td>
                          <td style={{ padding: '12px 18px', textAlign: 'center', borderRight: '1px solid #27272a', background: 'rgba(255, 255, 255, 0.01)' }}>{renderValue(groupTotals.qCutBuf, 'normal')}</td>
                          <td style={{ padding: '12px 18px', textAlign: 'center', borderRight: '1px solid #27272a' }}>{renderValue(groupTotals.qGalt, 'normal')}</td>
                          <td style={{ padding: '12px 18px', textAlign: 'center', borderRight: '1px solid #27272a', background: 'rgba(255, 255, 255, 0.01)' }}>{renderValue(groupTotals.qGaltBuf, 'normal')}</td>
                          <td style={{ padding: '12px 18px', textAlign: 'center', borderRight: '1px solid #27272a' }}>{renderValue(groupTotals.qPriy, 'normal')}</td>
                          <td style={{ padding: '12px 18px', textAlign: 'center', borderRight: '1px solid #27272a', background: 'rgba(255, 255, 255, 0.01)' }}>{renderValue(groupTotals.qSortAct, 'normal')}</td>
                          <td style={{ padding: '12px 18px', textAlign: 'center', borderRight: '1px solid #27272a', background: 'rgba(255, 255, 255, 0.01)' }}>{renderValue(groupTotals.qSort, 'normal')}</td>
                          <td style={{ padding: '12px 18px', textAlign: 'center', borderRight: '1px solid #27272a', background: 'rgba(255, 255, 255, 0.01)' }}>{renderValue(groupTotals.qMalWait, 'normal')}</td>
                          <td style={{ padding: '12px 18px', textAlign: 'center', borderRight: '1px solid #27272a' }}>{renderValue(groupTotals.qMal, 'normal')}</td>
                          <td style={{ padding: '12px 18px', textAlign: 'center', borderRight: '1px solid #27272a', background: 'rgba(255, 255, 255, 0.01)' }}>{renderValue(groupTotals.qMalBuf, 'normal')}</td>
                          <td style={{ padding: '12px 18px', textAlign: 'center', borderRight: '1px solid #27272a' }}>{renderValue(groupTotals.qPres, 'normal')}</td>
                          <td style={{ padding: '12px 18px', textAlign: 'center', borderRight: '1px solid #27272a', background: 'rgba(255, 255, 255, 0.01)' }}>{renderValue(groupTotals.qPresBuf, 'normal')}</td>
                          <td style={{ padding: '12px 18px', textAlign: 'center', borderRight: '1px solid #27272a' }}>{renderValue(groupTotals.qDoop, 'normal')}</td>
                          <td style={{ padding: '12px 18px', textAlign: 'center', borderRight: '1px solid #27272a', background: 'rgba(255, 255, 255, 0.01)' }}>{renderValue(groupTotals.qDoopBuf, 'normal')}</td>
                          <td style={{ padding: '12px 18px', textAlign: 'center', borderRight: '1px solid #27272a', background: 'rgba(16, 185, 129, 0.08)', color: '#10b981' }}>{renderValue(groupTotals.qSgp, 'sgp')}</td>
                          <td style={{ padding: '12px 18px', textAlign: 'center', borderRight: '1px solid #27272a', background: 'rgba(16, 185, 129, 0.08)', color: '#10b981' }}>{renderValue(groupTotals.qBz, 'bz')}</td>
                          <td style={{ padding: '12px 18px', textAlign: 'center', background: 'rgba(239, 68, 68, 0.08)', color: '#ef4444' }}>{renderValue(groupTotals.qScrap, 'scrap')}</td>
                        </tr>
                      </React.Fragment>
                    )
                  })
                )}

                {/* Grand Total Row */}
                {groupedDashboardData.length > 0 && (
                  <tr style={{ background: '#18181b', fontWeight: 'bold', borderTop: '2px solid #ff9000', color: '#fff', fontSize: '0.8rem' }}>
                    <td className="wip-sticky-col" style={{ padding: '14px 18px', borderRight: '1px solid #27272a', textTransform: 'uppercase', letterSpacing: '0.5px', position: 'sticky', left: 0, background: '#18181b', zIndex: 2 }}>ЗАГАЛЬНИЙ WIP РАЗОМ:</td>
                    <td className="wip-sticky-sum" style={{ padding: '14px 18px', textAlign: 'center', background: '#2e2014', borderRight: '1px solid #27272a', color: '#ff9000', position: 'sticky', zIndex: 2 }}>
                      {renderValue(totals.sum, 'sum')}
                    </td>
                    <td style={{ padding: '14px 18px', textAlign: 'center', borderRight: '1px solid #27272a', background: 'rgba(255, 255, 255, 0.02)' }}>{renderValue(totals.qCutWait, 'normal')}</td>
                    <td style={{ padding: '14px 18px', textAlign: 'center', borderRight: '1px solid #27272a' }}>{renderValue(totals.qCut, 'normal')}</td>
                    <td style={{ padding: '14px 18px', textAlign: 'center', borderRight: '1px solid #27272a', background: 'rgba(255, 255, 255, 0.02)' }}>{renderValue(totals.qCutBuf, 'normal')}</td>
                    <td style={{ padding: '14px 18px', textAlign: 'center', borderRight: '1px solid #27272a' }}>{renderValue(totals.qGalt, 'normal')}</td>
                    <td style={{ padding: '14px 18px', textAlign: 'center', borderRight: '1px solid #27272a', background: 'rgba(255, 255, 255, 0.02)' }}>{renderValue(totals.qGaltBuf, 'normal')}</td>
                    <td style={{ padding: '14px 18px', textAlign: 'center', borderRight: '1px solid #27272a' }}>{renderValue(totals.qPriy, 'normal')}</td>
                    <td style={{ padding: '14px 18px', textAlign: 'center', borderRight: '1px solid #27272a', background: 'rgba(255, 255, 255, 0.02)' }}>{renderValue(totals.qSortAct, 'normal')}</td>
                    <td style={{ padding: '14px 18px', textAlign: 'center', borderRight: '1px solid #27272a', background: 'rgba(255, 255, 255, 0.02)' }}>{renderValue(totals.qSort, 'normal')}</td>
                    <td style={{ padding: '14px 18px', textAlign: 'center', borderRight: '1px solid #27272a', background: 'rgba(255, 255, 255, 0.02)' }}>{renderValue(totals.qMalWait, 'normal')}</td>
                    <td style={{ padding: '14px 18px', textAlign: 'center', borderRight: '1px solid #27272a' }}>{renderValue(totals.qMal, 'normal')}</td>
                    <td style={{ padding: '14px 18px', textAlign: 'center', borderRight: '1px solid #27272a', background: 'rgba(255, 255, 255, 0.02)' }}>{renderValue(totals.qMalBuf, 'normal')}</td>
                    <td style={{ padding: '14px 18px', textAlign: 'center', borderRight: '1px solid #27272a' }}>{renderValue(totals.qPres, 'normal')}</td>
                    <td style={{ padding: '14px 18px', textAlign: 'center', borderRight: '1px solid #27272a', background: 'rgba(255, 255, 255, 0.02)' }}>{renderValue(totals.qPresBuf, 'normal')}</td>
                    <td style={{ padding: '14px 18px', textAlign: 'center', borderRight: '1px solid #27272a' }}>{renderValue(totals.qDoop, 'normal')}</td>
                    <td style={{ padding: '14px 18px', textAlign: 'center', borderRight: '1px solid #27272a', background: 'rgba(255, 255, 255, 0.02)' }}>{renderValue(totals.qDoopBuf, 'normal')}</td>
                    <td style={{ padding: '14px 18px', textAlign: 'center', borderRight: '1px solid #27272a', background: 'rgba(16, 185, 129, 0.12)', color: '#10b981' }}>{renderValue(totals.qSgp, 'sgp')}</td>
                    <td style={{ padding: '14px 18px', textAlign: 'center', borderRight: '1px solid #27272a', background: 'rgba(16, 185, 129, 0.12)', color: '#10b981' }}>{renderValue(totals.qBz, 'bz')}</td>
                    <td style={{ padding: '14px 18px', textAlign: 'center', background: 'rgba(239, 68, 68, 0.12)', color: '#ef4444' }}>{renderValue(totals.qScrap, 'scrap')}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
          .anim-spin { animation: spin 1.2s linear infinite; }
          @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
          .wip-row {
            background: #09090b;
            border-bottom: 1px solid #27272a;
            transition: all 0.2s ease;
          }
          .wip-row:hover {
            background: #18181b !important;
            box-shadow: inset 4px 0 0 0 #ff9000;
          }
          .wip-sticky-col {
            min-width: 240px !important;
            max-width: 240px !important;
            width: 240px !important;
            box-sizing: border-box;
          }
          .wip-sticky-sum {
            position: sticky;
            left: 240px !important;
            min-width: 130px !important;
            max-width: 130px !important;
            width: 130px !important;
            box-sizing: border-box;
            padding-left: 4px !important;
            padding-right: 4px !important;
          }
          .wip-table-container {
            overflow: auto;
            max-height: calc(100vh - 280px);
          }
          @media (max-width: 768px) {
            .wip-sticky-col {
              min-width: 140px !important;
              max-width: 140px !important;
              width: 140px !important;
              font-size: 0.7rem !important;
              padding-left: 12px !important;
              padding-right: 8px !important;
            }
            .wip-sticky-sum {
              left: 140px !important;
              min-width: 105px !important;
              max-width: 105px !important;
              width: 105px !important;
              font-size: 0.7rem !important;
              padding-left: 2px !important;
              padding-right: 2px !important;
            }
            .wip-table-container {
              max-height: calc(100vh - 120px) !important;
            }
          }
          .wip-row:hover td.wip-sticky-col {
            background: #18181b !important;
          }
          .wip-row:hover td.wip-sticky-sum {
            background: #251c14 !important;
          }
        `}} />
    </div>
  )
}

export default DashboardModule