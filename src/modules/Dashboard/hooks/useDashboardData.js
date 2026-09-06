import React, { useState, useMemo, useEffect } from 'react'
import { useMES } from '../../../MESContext'

export const useDashboardData = () => {
  const { currentUser, workCards, inventory, nomenclatures, fetchData, orders, bomItems, tasks, supabase, workCardHistory } = useMES()
  const [wipOnly, setWipOnly] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [shippedQuantities, setShippedQuantities] = useState({})
  const [selectedOrderId, setSelectedOrderId] = useState(null)
  const [orderAllCards, setOrderAllCards] = useState([])
  const [isLoadingCards, setIsLoadingCards] = useState(false)

  // Fetch ALL work cards (including completed) for the selected order's tasks
  useEffect(() => {
    if (!selectedOrderId || !tasks) {
      setOrderAllCards([])
      return
    }
    const orderTaskIds = tasks.filter(t => String(t.order_id) === String(selectedOrderId)).map(t => t.id)
    if (orderTaskIds.length === 0) {
      setOrderAllCards([])
      return
    }

    setIsLoadingCards(true)
    supabase
      .from('work_cards')
      .select('*')
      .in('task_id', orderTaskIds)
      .then(({ data, error }) => {
        if (error) {
          console.error('Error fetching all cards for selected order:', error)
          return
        }
        setOrderAllCards(data || [])
      })
      .finally(() => {
        setIsLoadingCards(false)
      })
  }, [selectedOrderId, tasks, supabase])

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

    const activeOrdersList = orders.filter(o => o.status !== 'completed' && o.status !== 'shipped' && o.status !== 'cancelled')

    const productDemand = {}
    activeOrdersList.forEach(o => {
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

  // Generate Grouped Data and Trends
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

    ;(inventory || []).forEach(i => {
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

    // Populate rows
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

        let qSgp = 0
        let qBz = 0
        let qScrap = 0

        if (selectedOrderId) {
          const orderTasks = tasks?.filter(t => t.order_id === selectedOrderId) || []
          const orderTaskIds = orderTasks.map(t => t.id)
          qScrap = (workCardHistory || [])
            .filter(h => String(h.nomenclature_id) === String(nom.id) && h.task_id && orderTaskIds.includes(h.task_id))
            .reduce((sum, h) => sum + (Number(h.scrap_qty) || 0), 0)

          const orderAllTaskCards = orderAllCards.filter(c => String(c.nomenclature_id) === String(nom.id))
          
          const completedShop2Qty = orderAllTaskCards.filter(c => {
            const op = (c.operation || '').toLowerCase()
            const isShop2 = ['пресування', 'фарбування', 'малярка', 'доопрацювання'].some(o => op.includes(o))
            return isShop2 && c.status === 'completed'
          }).reduce((sum, c) => sum + (Number(c.quantity) || 0), 0)

          const taskWithSnapshot = orderTasks.find(t => t.plan_snapshot && t.plan_snapshot[String(nom.id)])
          const initialStock = taskWithSnapshot ? (Number(taskWithSnapshot.plan_snapshot[String(nom.id)].stock) || 0) : 0

          const totalPotentialSgp = completedShop2Qty + initialStock
          qSgp = Math.min(specificDemand, totalPotentialSgp)

          const completedShop1Qty = orderAllTaskCards.filter(c => {
            const op = (c.operation || '').toLowerCase()
            const isShop1 = ['розкрій', 'галтовка', 'прийомка', 'сортування'].some(o => op.includes(o))
            const isSgpOrBzCard = c.operation === 'Склад БЗ'
            const isCompleted = c.status === 'completed' || c.status === 'at-shop2-buffer'
            return (isShop1 && isCompleted) || isSgpOrBzCard
          }).reduce((sum, c) => sum + (Number(c.quantity) || 0), 0)

          const totalShop2Qty = orderAllTaskCards.filter(c => {
            const op = (c.operation || '').toLowerCase()
            return ['пресування', 'фарбування', 'малярка', 'доопрацювання'].some(o => op.includes(o))
          }).reduce((sum, c) => sum + (Number(c.quantity) || 0), 0)

          const bzExcess = Math.max(0, totalPotentialSgp - specificDemand)
          qBz = Math.max(0, completedShop1Qty - qSortCards - totalShop2Qty) + bzExcess
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

        const sum = qCutWait + qCut + qCutBuf + qGalt + qGaltBuf + qPriyCards + qSortAct + qSortCards + qMalWait + qMal + qMalBuf + qPres + qPresBuf + qDoop + qDoopBuf + qSgp + (selectedOrderId ? qBz : 0)

        const row = {
          id: nom.id + (isOther ? '' : '_' + parentId),
          name: nom.name,
          code: nom.code || '',
          type: nom.type,
          demand: specificDemand,
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

        const qBz = orderAllocatedBz[order.id]?.[nom.id] || 0
        const qBzShop2 = orderAllocatedBzShop2[order.id]?.[nom.id] || 0
        const qSgp = orderAllocatedSgp[order.id]?.[nom.id] || 0

        let qSgpVal = qSgp
        if (selectedOrderId && order.id === selectedOrderId) {
          const orderAllTaskCards = orderAllCards.filter(c => String(c.nomenclature_id) === String(nom.id))
          const completedSgpQty = orderAllTaskCards
            .filter(c => (c.operation === 'Пакування/СГП' || c.operation === 'Склад СГП') && c.status === 'completed')
            .reduce((sum, c) => sum + (Number(c.quantity) || 0), 0)
          const activeQty = orderAllTaskCards.filter(c => {
            if (c.status === 'completed') return false
            if (c.operation === 'Склад БЗ') return false
            return true
          }).reduce((sum, c) => {
            if (c.status === 'at-shop2-buffer') {
              return sum + Math.max(0, (Number(c.quantity) || 0) - (Number(c.used_in_shop2_qty) || 0))
            }
            return sum + (Number(c.quantity) || 0)
          }, 0)
          qSgpVal = completedSgpQty + activeQty
        }

        const sumVal = qSgpVal + (selectedOrderId && order.id === selectedOrderId ? 0 : qCutWait + qCut + qCutBuf + qGalt + qGaltBuf + qPriyCards + qSortAct + qSortCards + qMalWait + qMal + qMalBuf + qPres + qPresBuf + qDoop + qDoopBuf + qBz + qBzShop2)

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

        const shortage = Math.max(0, need - sumVal)
        const potentialSetsForThisPart = Math.floor(sumVal / qtyPerProduct)
        if (potentialSetsForThisPart < minPotential) {
          minPotential = potentialSetsForThisPart
          bottleneckPartName = nom.name
          bottleneckPartCode = nom.code
          bottleneckQty = sumVal
          bottleneckQtyPerProduct = qtyPerProduct
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

      let bzReservedSets = Infinity
      let hasSnapshot = false
      orderTasks.forEach(t => {
        if (t.plan_snapshot) {
          hasSnapshot = true
          orderBoms.forEach(bomEntry => {
            const nom = nomenclatures.find(n => String(n.id) === String(bomEntry.child_id))
            if (!nom || nom.type !== 'part') return
            const qtyPerProduct = Number(bomEntry.quantity_per_parent) || 1
            const entry = t.plan_snapshot[String(bomEntry.child_id)]
            const stock = entry ? (Number(entry.stock) || 0) : 0
            const sets = Math.floor(stock / qtyPerProduct)
            if (sets < bzReservedSets) {
              bzReservedSets = sets
            }
          })
        }
      })
      if (bzReservedSets === Infinity || !hasSnapshot) bzReservedSets = 0

      const completedTasksSets = orderTasks
        .filter(t => t.status === 'completed')
        .reduce((sum, t) => sum + (Number(t.planned_sets) || 0), 0)

      let actualSgpSets = 0
      let actualWipSets = 0

      if (selectedOrderId && order.id === selectedOrderId) {
        let minCompletedSets = Infinity
        let minWipSets = Infinity

        orderBoms.forEach(bomEntry => {
          const nom = nomenclatures.find(n => String(n.id) === String(bomEntry.child_id))
          if (!nom || nom.type !== 'part') return
          const qtyPerProduct = Number(bomEntry.quantity_per_parent) || 1

          const orderAllTaskCards = orderAllCards.filter(c => String(c.nomenclature_id) === String(bomEntry.child_id))

          const completedSgpQty = orderAllTaskCards
            .filter(c => (c.operation === 'Пакування/СГП' || c.operation === 'Склад СГП') && c.status === 'completed')
            .reduce((sum, c) => sum + (Number(c.quantity) || 0), 0)

          const bzAcceptedQty = orderAllTaskCards
            .filter(c => c.operation === 'Склад БЗ' && c.status === 'completed')
            .reduce((sum, c) => sum + (Number(c.quantity) || 0), 0)

          const otherWipQty = orderAllTaskCards.filter(c => {
            if (c.status === 'completed') return false
            if (c.operation === 'Склад БЗ') return false
            if (c.operation === 'Пакування/СГП' || c.operation === 'Склад СГП') return false
            if (c.status === 'at-shop2-buffer') return false
            return true
          }).reduce((sum, c) => sum + (Number(c.quantity) || 0), 0)

          const bzRemainingQty = Math.max(0, bzAcceptedQty - completedSgpQty)
          const totalWipQty = bzRemainingQty + otherWipQty

          const completedSets = qtyPerProduct > 0 ? Math.floor(completedSgpQty / qtyPerProduct) : 0
          const wipSets = qtyPerProduct > 0 ? Math.floor(totalWipQty / qtyPerProduct) : 0

          if (completedSets < minCompletedSets) minCompletedSets = completedSets
          if (wipSets < minWipSets) minWipSets = wipSets
        })

        actualSgpSets = minCompletedSets === Infinity ? 0 : minCompletedSets
        actualWipSets = minWipSets === Infinity ? 0 : minWipSets
      } else {
        let minAllocatedSets = Infinity
        orderBoms.forEach(bomEntry => {
          const nom = nomenclatures.find(n => String(n.id) === String(bomEntry.child_id))
          if (!nom || nom.type !== 'part') return
          const qtyPerProduct = Number(bomEntry.quantity_per_parent) || 1
          const currentSgpQty = orderAllocatedSgp[order.id]?.[nom.id] || 0
          const sets = Math.floor(currentSgpQty / qtyPerProduct)
          if (sets < minAllocatedSets) minAllocatedSets = sets
        })
        actualSgpSets = minAllocatedSets === Infinity ? 0 : minAllocatedSets
        actualWipSets = Math.max(0, minPotential - actualSgpSets)
      }

      const plannedTask = orderTasks.find(t => t.planned_sets) || orderTasks[0]
      const totalDemand = Number(plannedTask?.planned_sets) || Number(order.order_items?.[0]?.quantity) || Number(order.quantity) || 0

      bottlenecksList.sort((a, b) => a.shortage - b.shortage)

      const calculatedWip = actualWipSets
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
  }, [nomenclatures, bomItems, orders, workCards, inventory, demandData, taskParentMap, searchQuery, wipOnly, shippedQuantities, activeOrders, workCardHistory, orderAllCards])

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

  const selectedOrderNum = useMemo(() => {
    if (!selectedOrderId || !orders) return ''
    const order = orders.find(o => String(o.id) === String(selectedOrderId))
    return order?.order_num || selectedOrderId.split('-')[0]
  }, [selectedOrderId, orders])

  return {
    currentUser,
    wipOnly,
    setWipOnly,
    searchQuery,
    setSearchQuery,
    isRefreshing,
    handleRefresh,
    selectedOrderId,
    setSelectedOrderId,
    selectedOrderNum,
    activeOrders,
    groupedDashboardData,
    totals,
    productTrends,
    getGroupTotals,
    orders
  }
}
