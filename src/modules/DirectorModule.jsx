import React, { useState, useMemo, useEffect } from 'react'
import { useMES } from '../MESContext'
import { apiService } from '../services/apiDispatcher'

import { DirectorHeader } from './Director/components/DirectorHeader'
import { GoogleCalendarView } from './Director/components/GoogleCalendarView'
import { ProductionMatrixView } from './Director/components/ProductionMatrixView'
import { ApprovalsDrawer } from './Director/components/ApprovalsDrawer'
import { OrderDossierModal } from './Director/components/OrderDossierModal'
import './Director/DirectorStyles.css'

const toLocalISO = (dateVal) => {
  if (!dateVal) return null
  try {
    if (typeof dateVal === 'string' && dateVal.includes('.')) {
      const [d, m, y] = dateVal.split('.')
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
    }
    const d = new Date(dateVal)
    if (isNaN(d.getTime())) return null
    const year = d.getFullYear()
    const mon = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${mon}-${day}`
  } catch (e) { return null }
}

const DirectorModule = () => {
  const { tasks, orders, approveDirector, nomenclatures, requests, workCards, supabase } = useMES()
  const [viewDate, setViewDate] = useState(new Date())
  const [viewMode, setViewMode] = useState('calendar') // 'calendar' | 'matrix'
  const [isApprovalsOpen, setIsApprovalsOpen] = useState(false)
  const [selectedCell, setSelectedCell] = useState(null)
  const [hoveredPid, setHoveredPid] = useState(null)
  const [selectedOrderId, setSelectedOrderId] = useState(null)
  const [expandedReqs, setExpandedReqs] = useState({})
  const [expandedNaryads, setExpandedNaryads] = useState({})
  const [allOrdersMap, setAllOrdersMap] = useState({})

  const calendarGridDays = useMemo(() => {
    const year = viewDate.getFullYear()
    const month = viewDate.getMonth()

    const firstDayOfMonth = new Date(year, month, 1)
    let firstDayIndex = (firstDayOfMonth.getDay() + 6) % 7

    const lastDateOfMonth = new Date(year, month + 1, 0).getDate()
    const lastDateOfPrevMonth = new Date(year, month, 0).getDate()

    const days = []
    const todayKey = toLocalISO(new Date())

    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const prevDay = lastDateOfPrevMonth - i
      const d = new Date(year, month - 1, prevDay)
      const dateKey = toLocalISO(d)
      days.push({
        day: prevDay,
        isCurrentMonth: false,
        dateKey,
        isToday: dateKey === todayKey,
        isWeekend: false,
        dayOfWeek: (d.getDay() + 6) % 7
      })
    }

    for (let d = 1; d <= lastDateOfMonth; d++) {
      const dateObj = new Date(year, month, d)
      const dateKey = toLocalISO(dateObj)
      const dayOfWeek = (dateObj.getDay() + 6) % 7
      days.push({
        day: d,
        isCurrentMonth: true,
        dateKey,
        isToday: dateKey === todayKey,
        isWeekend: dayOfWeek === 5 || dayOfWeek === 6,
        dayOfWeek
      })
    }

    const totalSlots = days.length <= 35 ? 35 : 42
    const nextDaysCount = totalSlots - days.length
    for (let i = 1; i <= nextDaysCount; i++) {
      const d = new Date(year, month + 1, i)
      const dateKey = toLocalISO(d)
      days.push({
        day: i,
        isCurrentMonth: false,
        dateKey,
        isToday: dateKey === todayKey,
        isWeekend: false,
        dayOfWeek: (d.getDay() + 6) % 7
      })
    }

    return days
  }, [viewDate])

  const calendarEventsByDate = useMemo(() => {
    const map = {}
    const addEvent = (dateKey, event) => {
      if (!dateKey) return
      if (!map[dateKey]) map[dateKey] = []
      map[dateKey].push(event)
    }

    const combinedOrders = [...orders]
    Object.values(allOrdersMap).forEach(o => {
      if (!combinedOrders.find(co => String(co.id) === String(o.id))) {
        combinedOrders.push(o)
      }
    })

    combinedOrders.forEach(o => {
      const orderDeadline = toLocalISO(o.deadline)
      if (!orderDeadline) return

      const orderTasks = tasks.filter(t => String(t.order_id) === String(o.id))
      const batches = {}
      orderTasks.forEach(t => {
        const key = t.batch_index || `task_${t.id}`
        const qty = Number(t.planned_sets) || 0
        if (!batches[key] || qty > batches[key]) {
          batches[key] = qty
        }
      })
      const totalPlanned = Object.values(batches).reduce((acc, q) => acc + q, 0)
      const totalOrderQty = o.order_items?.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0) || Number(o.quantity) || 0

      const productName = o.order_items?.map(it => {
        const nom = nomenclatures.find(n => String(n.id) === String(it.nomenclature_id))
        return nom ? nom.name : null
      }).filter(Boolean).join(', ') || 'Замовлення'

      addEvent(orderDeadline, {
        id: o.id,
        orderNum: o.order_num,
        customer: o.customer || 'Замовник не вказаний',
        productName,
        qty: totalOrderQty > 0 ? totalOrderQty : (totalPlanned || 1),
        status: o.status || 'in-progress',
        isOrder: true
      })
    })

    tasks.filter(t => t.step === 'Розкрій' || t.step === 'Різка' || String(t.step).includes('ЦЕХ')).forEach(t => {
      const taskDeadline = toLocalISO(t.planned_deadline || t.created_at)
      if (!taskDeadline) return

      const order = combinedOrders.find(o => String(o.id) === String(t.order_id))
      const batchQty = Number(t.planned_sets) || 0

      if (order && batchQty > 0) {
        const productName = order.order_items?.map(it => {
          const nom = nomenclatures.find(n => String(n.id) === String(it.nomenclature_id))
          return nom ? nom.name : null
        }).filter(Boolean).join(', ') || 'Партія'

        const existing = (map[taskDeadline] || []).find(e => String(e.id) === String(order.id))
        if (!existing) {
          addEvent(taskDeadline, {
            id: order.id,
            taskId: t.id,
            orderNum: `${order.order_num}${t.batch_index ? `/${t.batch_index}` : ''}`,
            customer: order.customer || 'Партія',
            productName,
            qty: batchQty,
            status: t.status === 'completed' ? 'completed' : 'in-progress',
            isBatch: true
          })
        }
      }
    })

    return map
  }, [orders, allOrdersMap, tasks, nomenclatures])

  useEffect(() => {
    if (!tasks || tasks.length === 0) return
    const neededOrderIds = [...new Set(tasks.map(t => t.order_id).filter(Boolean))]
    const missingIds = neededOrderIds.filter(id => 
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
          console.error('DirectorModule: Error fetching missing orders:', error)
          return
        }
        if (data && data.length > 0) {
          setAllOrdersMap(prev => {
            const next = { ...prev }
            data.forEach(o => { next[o.id] = o; })
            return next
          })
        }
      })
  }, [tasks, orders, supabase])

  const toggleReq = (id) => {
    setExpandedReqs(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const toggleNaryad = (id) => {
    setExpandedNaryads(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const pendingTasks = tasks.filter(t => 
    t.status !== 'completed' && t.status !== 'cancelled' && 
    (t.warehouse_conf === 'true' || t.warehouse_conf === 'partial') && 
    t.engineer_conf === true && 
    !t.director_conf
  )

  const daysInMonth = useMemo(() => {
    const year = viewDate.getFullYear()
    const month = viewDate.getMonth()
    const lastDay = new Date(year, month + 1, 0).getDate()
    const todayKey = toLocalISO(new Date())

    return Array.from({ length: lastDay }, (_, i) => {
      const d = new Date(year, month, i + 1)
      const fullDate = toLocalISO(d)
      return {
        day: i + 1,
        weekday: d.toLocaleDateString('uk-UA', { weekday: 'short' }),
        fullDate,
        isToday: fullDate === todayKey
      }
    })
  }, [viewDate])

  const activeProducts = useMemo(() => {
    const productIdsInOrders = new Set()
    orders.forEach(o => {
      o.order_items?.forEach(item => productIdsInOrders.add(item.nomenclature_id))
    })
    Object.values(allOrdersMap).forEach(o => {
      o.order_items?.forEach(item => productIdsInOrders.add(item.nomenclature_id))
    })
    return nomenclatures.filter(n => n.type === 'product' && productIdsInOrders.has(n.id))
  }, [orders, allOrdersMap, nomenclatures])

  const matrixData = useMemo(() => {
    const map = {}
    
    const addEntry = (dateKey, pid, entry) => {
       if (!dateKey) return
       if (!map[dateKey]) map[dateKey] = {}
       if (!map[dateKey][pid]) map[dateKey][pid] = []
       map[dateKey][pid].push(entry)
    }

    const combinedOrders = [...orders]
    Object.values(allOrdersMap).forEach(o => {
      if (!combinedOrders.find(co => co.id === o.id)) {
        combinedOrders.push(o)
      }
    })

    combinedOrders.forEach(o => {
      const orderDeadline = toLocalISO(o.deadline)
      if (!orderDeadline) return

      const orderTasks = tasks.filter(t => String(t.order_id) === String(o.id))
      const batches = {}
      orderTasks.forEach(t => {
        const key = t.batch_index || `task_${t.id}`
        const qty = Number(t.planned_sets) || 0
        if (!batches[key] || qty > batches[key]) {
          batches[key] = qty
        }
      })
      const totalPlanned = Object.values(batches).reduce((acc, q) => acc + q, 0)

      o.order_items?.forEach(item => {
        const totalQty = Number(item.quantity) || 0
        const itemRemaining = Math.max(0, totalQty - totalPlanned)

        if (itemRemaining > 0) {
          addEntry(orderDeadline, item.nomenclature_id, {
            orderNum: o.order_num,
            customer: o.customer,
            qty: itemRemaining,
            id: o.id,
            isPartialRemaining: true
          })
        }
      })
    })

    tasks.filter(t => t.step === 'Розкрій' || t.step === 'Різка').forEach(t => {
      const taskDeadline = toLocalISO(t.planned_deadline || t.created_at)
      if (!taskDeadline) return
      
      const order = combinedOrders.find(o => String(o.id) === String(t.order_id))
      const batchQty = Number(t.planned_sets) || 0
      
      if (order && batchQty > 0) {
        order.order_items?.forEach(item => {
          addEntry(taskDeadline, item.nomenclature_id, {
             orderNum: `${order.order_num}${t.batch_index ? `/${t.batch_index}` : ''}`,
             customer: order.customer,
             qty: batchQty,
             id: order.id,
             taskId: t.id,
             isBatch: true
          })
        })
      }
    })

    return map
  }, [orders, allOrdersMap, tasks])

  const parseRequestDetails = (details) => {
    if (!details) return { main: '—', sub: '' }
    const parts = details.split(': ')
    const prefix = parts[0] || ''
    const content = parts[1] || ''
    
    if (content.includes(' — ')) {
      const [mat, rest] = content.split(' — ')
      const [qtyInfo, metaRaw] = rest.split(' (')
      
      let breakdown = []
      if (metaRaw && metaRaw.includes('Для: ')) {
         const forPart = metaRaw.split('Для: ')[1]?.replace(')', '')
         if (forPart) {
           breakdown = forPart.split(', ').map(item => {
             const [label, q] = item.split(': ')
             return { label: label?.trim(), qty: q?.trim() }
           })
         }
      }

      return {
        prefix,
        material: mat.trim(),
        qty: qtyInfo.trim(),
        breakdown
      }
    }
    return { prefix, material: content, qty: '', breakdown: [] }
  }

  const changeMonth = (offset) => {
    const newDate = new Date(viewDate)
    newDate.setMonth(newDate.getMonth() + offset)
    setViewDate(newDate)
  }

  const getStatusLabel = (s) => {
    const map = {
      'pending': 'ОЧІКУЄ',
      'in-progress': 'В РОБОТІ',
      'completed': 'ВИКОНАНО',
      'shipped': 'ВІДВАНТАЖЕНО',
      'packaged': 'УПАКОВАНО'
    }
    return map[s] || s?.toUpperCase()
  }

  const totalPlannedSets = useMemo(() => {
    return Object.values(matrixData).reduce((sum, prods) =>
      sum + Object.values(prods).reduce((ps, ordersList) =>
        ps + ordersList.reduce((os, o) => os + o.qty, 0), 0), 0
    )
  }, [matrixData])

  return (
    <div className="director-console">
      {/* HEADER SECTION */}
      <DirectorHeader
        viewDate={viewDate}
        changeMonth={changeMonth}
        setViewDate={setViewDate}
        viewMode={viewMode}
        setViewMode={setViewMode}
        setIsApprovalsOpen={setIsApprovalsOpen}
        pendingTasksCount={pendingTasks.length}
        totalPlannedSets={totalPlannedSets}
      />

      <main className="dashboard-body">
        {viewMode === 'calendar' ? (
          <GoogleCalendarView
            calendarGridDays={calendarGridDays}
            calendarEventsByDate={calendarEventsByDate}
            setSelectedCell={setSelectedCell}
            setSelectedOrderId={setSelectedOrderId}
          />
        ) : (
          <ProductionMatrixView
            activeProducts={activeProducts}
            daysInMonth={daysInMonth}
            matrixData={matrixData}
            hoveredPid={hoveredPid}
            setHoveredPid={setHoveredPid}
            setSelectedCell={setSelectedCell}
            setSelectedOrderId={setSelectedOrderId}
          />
        )}
      </main>

      {/* APPROVALS DRAWER */}
      <ApprovalsDrawer
        isOpen={isApprovalsOpen}
        onClose={() => setIsApprovalsOpen(false)}
        pendingTasks={pendingTasks}
        orders={orders}
        allOrdersMap={allOrdersMap}
        nomenclatures={nomenclatures}
        approveDirector={approveDirector}
      />

      {/* CELL DETAILS & DOSSIER MODAL */}
      <OrderDossierModal
        selectedCell={selectedCell}
        selectedOrderId={selectedOrderId}
        setSelectedCell={setSelectedCell}
        setSelectedOrderId={setSelectedOrderId}
        orders={orders}
        allOrdersMap={allOrdersMap}
        tasks={tasks}
        requests={requests}
        workCards={workCards}
        nomenclatures={nomenclatures}
        expandedReqs={expandedReqs}
        toggleReq={toggleReq}
        expandedNaryads={expandedNaryads}
        toggleNaryad={toggleNaryad}
        parseRequestDetails={parseRequestDetails}
        getStatusLabel={getStatusLabel}
      />
    </div>
  )
}

export default DirectorModule
