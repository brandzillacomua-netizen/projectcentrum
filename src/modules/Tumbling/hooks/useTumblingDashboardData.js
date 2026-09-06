import { useState, useEffect, useMemo, useRef } from 'react'
import { useMES } from '../../../MESContext'
import { getCurrentTime } from '../../../supabase'

export function useTumblingDashboardData() {
  const { workCards, nomenclatures, bomItems, orders, tasks, workCardHistory } = useMES()
  const [currentTime, setCurrentTime] = useState(getCurrentTime())

  // Toggle for full-screen or simulated display properties
  const [isFullScreen, setIsFullScreen] = useState(false)
  const [autoScrollActive, setAutoScrollActive] = useState(true)

  // References for auto-scrolling columns
  const col1Ref = useRef(null)
  const col2Ref = useRef(null)
  const col3Ref = useRef(null)

  // Tick the clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(getCurrentTime()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Auto-scrolling effect for TV monitors (slowly scrolls when content overflows)
  useEffect(() => {
    if (!autoScrollActive) return

    const scrollInterval = setInterval(() => {
      [col2Ref, col3Ref].forEach(ref => {
        if (ref.current) {
          const el = ref.current
          if (el.scrollHeight > el.clientHeight) {
            el.scrollTop += 1
            if (el.scrollTop + el.clientHeight >= el.scrollHeight - 2) {
              el.scrollTop = 0
            }
          }
        }
      })
    }, 45)

    return () => clearInterval(scrollInterval)
  }, [autoScrollActive])

  // Get nomenclature helper
  const getNom = (nomId) => (nomenclatures || []).find(n => n.id === nomId)

  // Check if a work card has completed tumbling
  const hasPassedTumbling = (card) => {
    if (!card) return false
    if (card.status === 'completed') return true

    const op = card.operation || ''
    if (op === 'Галтовка' && card.status === 'at-buffer') return true
    if (op === 'Склад БЗ') return true

    const subsequentStages = ['Прийомка', 'completed', 'Пресування', 'Фарбування', 'Паквання', 'Пакування', 'Сортування', 'Склад СГП', 'Доопрацювання']
    return subsequentStages.some(stage => op.includes(stage))
  }

  // Next sub-stage mapping
  const getNextTumblingOperation = (currentOp) => {
    if (currentOp === 'Розкрій') return 'Галтовка (Вібростіл)'
    if (currentOp === 'Галтовка (Вібростіл)') return 'Галтовка (Мийка)'
    if (currentOp === 'Галтовка (Мийка)') return 'Галтовка (Галтовка)'
    if (currentOp === 'Галтовка (Галтовка)') return 'Галтовка (Сушка)'
    return 'Галтовка (Вібростіл)'
  }

  // Process active orders and compute component kit completion & bottleneck priority
  const orderKits = useMemo(() => {
    const activeOrderIds = new Set((workCards || []).map(c => c.order_id).filter(Boolean))
    
    return Array.from(activeOrderIds).map(orderId => {
      const order = (orders || []).find(o => String(o.id) === String(orderId))
      if (!order) return null

      const targetQty = Number(order.quantity) || 1000
      const parentNom = getNom(order.nomenclature_id)

      const orderBoms = (bomItems || []).filter(b => {
        if (b.parent_id !== order.nomenclature_id) return false
        
        const childNom = getNom(b.child_id)
        if (!childNom) return false
        
        const nameLower = (childNom.name || '').toLowerCase()
        const isExcluded = 
          nameLower.includes('гвинт') ||
          nameLower.includes('метиз') ||
          nameLower.includes('накладк') ||
          nameLower.includes('гайка') ||
          nameLower.includes('шайба') ||
          nameLower.includes('заклепк') ||
          nameLower.includes('болт') ||
          nameLower.includes('шпильк') ||
          nameLower.includes('саморіз') ||
          nameLower.includes('стійка') ||
          nameLower.includes('тримач') ||
          nameLower.includes('демпфер') ||
          nameLower.includes('пластик') ||
          nameLower.includes('кабель') ||
          nameLower.includes('хомут') ||
          nameLower.includes('скло') ||
          nameLower.includes('ніжка') ||
          nameLower.includes('резинк') ||
          nameLower.includes('ущільн') ||
          nameLower.includes('прокладк') ||
          nameLower.includes('стріч') ||
          nameLower.includes('скотч') ||
          nameLower.includes('клей') ||
          nameLower.includes('втулк')
        
        const typeLower = (childNom.type || '').toLowerCase()
        const isExcludedType = typeLower && typeLower !== 'part'
        
        if (isExcluded || isExcludedType) return false

        const hasActiveCard = (workCards || []).some(c => c.nomenclature_id === b.child_id && String(c.order_id) === String(orderId))
        const hasHistoryCard = (workCardHistory || []).some(h => h.nomenclature_id === b.child_id)
        
        return hasActiveCard || hasHistoryCard
      })
      if (orderBoms.length === 0) return null

      const orderCards = (workCards || []).filter(c => String(c.order_id) === String(orderId))

      const components = orderBoms.map(bom => {
        const childNom = getNom(bom.child_id)
        const qtyPerParent = Number(bom.quantity_per_parent) || 1
        const totalNeeded = targetQty * qtyPerParent

        const compCards = orderCards.filter(c => c.nomenclature_id === bom.child_id)

        const bzCards = compCards.filter(c => c.operation === 'Склад БЗ')
        const producedCards = compCards.filter(c => c.operation !== 'Склад БЗ' && hasPassedTumbling(c))

        const bzQty = bzCards.reduce((sum, c) => sum + (Number(c.quantity) || 0), 0)
        const producedQty = producedCards.reduce((sum, c) => sum + (Number(c.quantity) || 0), 0)
        const passedQty = bzQty + producedQty

        const completedKits = passedQty / qtyPerParent
        const kitRatio = targetQty > 0 ? completedKits / targetQty : 0

        let statusText = '⚙️ В черзі'
        let statusColor = '#06b6d4'
        if (compCards.length === 0) {
          statusText = '🔴 Не згенеровано карток'
          statusColor = '#ef4444'
        } else if (kitRatio >= 1) {
          statusText = '✅ Готово'
          statusColor = '#10b981'
        } else if (compCards.some(c => c.status === 'in-progress' && c.operation?.startsWith('Галтовка'))) {
          statusText = '⚡ У роботі'
          statusColor = '#10b981'
        } else if (compCards.some(c => ((c.status === 'at-buffer' && (c.operation === 'Розкрій' || c.operation === 'Галтовка (Вібростіл)' || c.operation === 'Галтовка (Мийка)' || c.operation === 'Галтовка (Галтовка)')) ||
        (c.status === 'new' && (c.operation === 'Галтовка (Вібростіл)' || c.operation === 'Галтовка (Мийка)' || c.operation === 'Галтовка (Галтовка)' || c.operation === 'Галтовка (Сушка)'))) ||
        (c.status === 'new' && (c.operation === 'Галтовка (Вібростіл)' || c.operation === 'Галтовка (Мийка)' || c.operation === 'Галтовка (Галтовка)' || c.operation === 'Галтовка (Сушка)')))) {
          statusText = '⚙️ В черзі'
          statusColor = '#06b6d4'
        } else {
          statusText = '⏳ Чекає розкрою'
          statusColor = '#f59e0b'
        }

        return {
          id: bom.child_id,
          name: childNom?.name || 'Компонент',
          qtyPerParent,
          totalNeeded,
          passedQty,
          bzQty,
          producedQty,
          completedKits,
          kitRatio,
          statusText,
          statusColor,
          cards: compCards
        }
      })

      let bottleneckId = null
      let minRatio = Infinity
      components.forEach(comp => {
        if (comp.kitRatio < minRatio) {
          minRatio = comp.kitRatio
          bottleneckId = comp.id
        }
      })

      const taskObj = (tasks || []).find(t => String(t.order_id) === String(orderId))
      const deadlineStr = taskObj?.planned_deadline || order.deadline || null
      const deadlineDate = deadlineStr ? new Date(deadlineStr) : null

      return {
        orderId,
        orderNum: order.order_num || `Наряд #${String(orderId).slice(-6)}`,
        productName: parentNom?.name || 'Готовий виріб',
        targetQty,
        components,
        bottleneckId,
        deadlineDate,
        deadlineStr
      }
    }).filter(Boolean)
  }, [workCards, orders, bomItems, tasks, nomenclatures, workCardHistory])

  // Urgent Deficit for the Shift
  const shiftDeficits = useMemo(() => {
    const list = []
    orderKits.forEach(kit => {
      kit.components.forEach(comp => {
        if (comp.kitRatio < 1.0) {
          list.push({
            orderNum: kit.orderNum,
            nomenclatureId: comp.id,
            name: comp.name,
            kitRatio: comp.kitRatio,
            percent: Math.min(100, Math.round(comp.kitRatio * 100))
          })
        }
      })
    })
    list.sort((a, b) => a.kitRatio - b.kitRatio)
    return list.slice(0, 3)
  }, [orderKits])

  // Pagination & auto-rotation for active orders
  const [orderPage, setOrderPage] = useState(0)
  const ordersPerPage = 1
  const totalPages = Math.ceil(orderKits.length / ordersPerPage)

  useEffect(() => {
    if (totalPages <= 1) {
      setOrderPage(0)
      return
    }
    const timer = setInterval(() => {
      setOrderPage(prev => (prev + 1) % totalPages)
    }, 10000)
    return () => clearInterval(timer)
  }, [totalPages])

  const displayedKits = useMemo(() => {
    const start = orderPage * ordersPerPage
    return orderKits.slice(start, start + ordersPerPage)
  }, [orderKits, orderPage])

  const bottleneckNomenclaturesMap = useMemo(() => {
    const map = {}
    orderKits.forEach(kit => {
      if (kit.bottleneckId) {
        map[kit.bottleneckId] = true
      }
    })
    return map
  }, [orderKits])

  const getCardDeadline = (card) => {
    const kit = orderKits.find(k => String(k.orderId) === String(card.order_id))
    return kit?.deadlineDate || null
  }

  const waitingQueue = useMemo(() => {
    return (workCards || [])
      .filter(c => c.status === 'at-buffer' && (c.operation === 'Розкрій' || c.operation === 'Галтовка (Вібростіл)' || c.operation === 'Галтовка (Мийка)' || c.operation === 'Галтовка (Галтовка)'))
      .map(card => {
        const isBottleneck = bottleneckNomenclaturesMap[card.nomenclature_id] || false
        const kit = orderKits.find(k => String(k.orderId) === String(card.order_id))
        const comp = kit?.components?.find(co => co.id === card.nomenclature_id)
        const kitRatio = comp ? comp.kitRatio : 1.0
        const deadline = getCardDeadline(card)
        return {
          ...card,
          isBottleneck,
          kitRatio,
          deadline
        }
      })
      .sort((a, b) => {
        if (a.kitRatio !== b.kitRatio) {
          return a.kitRatio - b.kitRatio
        }
        if (a.deadline && b.deadline) {
          return a.deadline - b.deadline
        }
        if (a.deadline) return -1
        if (b.deadline) return 1

        const dateA = new Date(a.completed_at || a.started_at || 0)
        const dateB = new Date(b.completed_at || b.started_at || 0)
        return dateA - dateB
      })
  }, [workCards, bottleneckNomenclaturesMap, orderKits])

  const inProgressQueue = useMemo(() => {
    return (workCards || [])
      .filter(c => c.status === 'in-progress' && c.operation?.startsWith('Галтовка'))
      .sort((a, b) => {
        const dateA = new Date(a.started_at || 0)
        const dateB = new Date(b.started_at || 0)
        return dateA - dateB
      })
  }, [workCards])

  const formatLiveDuration = (isoStart) => {
    if (!isoStart) return '00:00:00'
    const diff = Math.max(0, Math.floor((currentTime.getTime() - new Date(isoStart).getTime()) / 1000))
    const h = Math.floor(diff / 3600)
    const m = Math.floor((diff % 3600) / 60)
    const s = diff % 60
    return [h, m, s].map(v => String(v).padStart(2, '0')).join(':')
  }

  const formatWaitingTime = (isoCompleted) => {
    if (!isoCompleted) return '—'
    const diff = Math.max(0, Math.floor((currentTime.getTime() - new Date(isoCompleted).getTime()) / 1000))
    const m = Math.floor(diff / 60)
    if (m < 60) return `${m} хв`
    const h = Math.floor(m / 60)
    const remM = m % 60
    return `${h} год ${remM} хв`
  }

  return {
    currentTime,
    isFullScreen,
    setIsFullScreen,
    autoScrollActive,
    setAutoScrollActive,
    col1Ref,
    col2Ref,
    col3Ref,
    getNom,
    getNextTumblingOperation,
    orderKits,
    shiftDeficits,
    orderPage,
    totalPages,
    displayedKits,
    waitingQueue,
    inProgressQueue,
    formatLiveDuration,
    formatWaitingTime,
    orders
  }
}
