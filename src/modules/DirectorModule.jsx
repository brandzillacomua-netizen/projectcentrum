import React, { useState, useMemo, useEffect } from 'react'
import {
  ShieldCheck,
  ArrowLeft,
  CheckCircle2,
  Clock,
  LayoutDashboard,
  Warehouse,
  FileCode,
  Calendar,
  Layers,
  ChevronLeft,
  ChevronRight,
  Package,
  X,
  Bell,
  Info
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useMES } from '../MESContext'
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
  const { tasks, orders, approveDirector, nomenclatures, requests, workCards, workCardHistory, inventory, supabase } = useMES()
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

  // ── Load orders for ALL tasks in state (pagination-independent) ───────────────
  useEffect(() => {
    if (!tasks || tasks.length === 0) return;
    const neededOrderIds = [...new Set(tasks.map(t => t.order_id).filter(Boolean))];
    const missingIds = neededOrderIds.filter(id => 
      !orders.find(o => String(o.id) === String(id)) && 
      !allOrdersMap[id]
    );
    if (missingIds.length === 0) return;

    supabase
      .from('orders')
      .select('*, order_items(*)')
      .in('id', missingIds)
      .then(({ data, error }) => {
        if (error) {
          console.error('DirectorModule: Error fetching missing orders:', error);
          return;
        }
        if (data && data.length > 0) {
          setAllOrdersMap(prev => {
            const next = { ...prev };
            data.forEach(o => { next[o.id] = o; });
            return next;
          });
        }
      });
  }, [tasks, orders, supabase]);

  const toggleReq = (id) => {
    setExpandedReqs(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const toggleNaryad = (id) => {
    setExpandedNaryads(prev => ({ ...prev, [id]: !prev[id] }))
  }

  // 1. Pending Approvals Data (Only trigger when it's Director's turn)
  const pendingTasks = tasks.filter(t => 
    t.status === 'waiting' && 
    (t.warehouse_conf === 'true' || t.warehouse_conf === 'partial') && 
    t.engineer_conf === true && 
    !t.director_conf
  )
  const approvedCount = tasks.filter(t => t.status === 'waiting' && t.director_conf).length

  // 2. Matrix Data Preparation
  const daysInMonth = useMemo(() => {
    const year = viewDate.getFullYear()
    const month = viewDate.getMonth()
    const lastDay = new Date(year, month + 1, 0).getDate()
    return Array.from({ length: lastDay }, (_, i) => {
      const d = new Date(year, month, i + 1)
      return {
        day: i + 1,
        weekday: d.toLocaleDateString('uk-UA', { weekday: 'short' }),
        fullDate: toLocalISO(d)
      }
    })
  }, [viewDate])

  // Get products that have orders in this month (or in general to keep columns consistent)
  const activeProducts = useMemo(() => {
    const productIdsInOrders = new Set()
    orders.forEach(o => {
      o.order_items?.forEach(item => productIdsInOrders.add(item.nomenclature_id))
    })
    // Also check allOrdersMap
    Object.values(allOrdersMap).forEach(o => {
      o.order_items?.forEach(item => productIdsInOrders.add(item.nomenclature_id))
    })
    return nomenclatures.filter(n => n.type === 'product' && productIdsInOrders.has(n.id))
  }, [orders, allOrdersMap, nomenclatures])

  // Map orders to (Date, Product) - Intelligent scheduling logic
  const matrixData = useMemo(() => {
    const map = {}
    
    // Helper to add qty to map
    const addEntry = (dateKey, pid, entry) => {
       if (!dateKey) return
       if (!map[dateKey]) map[dateKey] = {}
       if (!map[dateKey][pid]) map[dateKey][pid] = []
       map[dateKey][pid].push(entry)
    }

    // Combine current orders and our local cache
    const combinedOrders = [...orders];
    Object.values(allOrdersMap).forEach(o => {
      if (!combinedOrders.find(co => co.id === o.id)) {
        combinedOrders.push(o);
      }
    });

    // Step 1: Process Orders (Remaining Balance)
    combinedOrders.forEach(o => {
      const orderDeadline = toLocalISO(o.deadline)
      if (!orderDeadline) return

      // Find all tasks related to this order to calculate planned sets (grouping by batch to avoid double counting stages)
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

    // Step 2: Process Tasks (Planned Batches)
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
    // Typical format: "СКЛАД ОПЕРАТИВНИЙ: Лист T300 (3мм) — 6 л. (Разом: 222 шт | Для: ...)"
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

  return (
    <div className="director-console">
      {/* MONOLITHIC STICKY HEADER GROUP */}
      <div className="sticky-dashboard-header">
        <nav className="glass-nav-director">
          <div className="nav-left">
            <Link to="/" className="btn-back-director">
              <ArrowLeft size={18} /> <span>НАЗАД</span>
            </Link>
            <div className="brand-group">
              <LayoutDashboard className="text-orange" size={24} />
              <h1>DIRECTOR <span className="text-dim">DASHBOARD</span></h1>
            </div>
          </div>

          <div className="nav-right">
            <button className="btn-notifications" style={{ position: 'relative' }} onClick={() => setIsApprovalsOpen(true)}>
              <Bell size={20} />
              {pendingTasks.length > 0 && <span className="badge-count anim-pulse">{pendingTasks.length}</span>}
              <span className="btn-label">ПІДТВЕРДЖЕННЯ</span>
            </button>
          </div>
        </nav>

        <div className="strategic-header">
          <div className="month-selector-group">
            <button className="nav-btn" onClick={() => changeMonth(-1)}><ChevronLeft size={20} /></button>
            <div className="month-info-badge">
              <span className="month-name-compact">{viewDate.toLocaleDateString('uk-UA', { month: 'long' }).toUpperCase()}</span>
              <span className="year-divider">|</span>
              <span className="year-val-compact">{viewDate.getFullYear()}</span>
            </div>
            <button className="nav-btn" onClick={() => changeMonth(1)}><ChevronRight size={20} /></button>
          </div>

          <div className="header-meta-actions">
            <div className="gcal-view-toggle-group">
              <button
                className={`gcal-toggle-btn ${viewMode === 'calendar' ? 'active' : ''}`}
                onClick={() => setViewMode('calendar')}
              >
                <Calendar size={16} /> <span>КАЛЕНДАР</span>
              </button>
              <button
                className={`gcal-toggle-btn ${viewMode === 'matrix' ? 'active' : ''}`}
                onClick={() => setViewMode('matrix')}
              >
                <Layers size={16} /> <span>МАТРИЦЯ</span>
              </button>
            </div>

            <button onClick={() => setViewDate(new Date())} className="btn-jump-today">
              <Calendar size={16} />
              <span>СЬОГОДНІ</span>
            </button>
            <div className="analysis-summary-mini">
              <span className="meta-label">ЗАГАЛЬНИЙ ПЛАН:</span>
              <span className="meta-val text-orange">
                {Object.values(matrixData).reduce((sum, prods) =>
                  sum + Object.values(prods).reduce((ps, orders) =>
                    ps + orders.reduce((os, o) => os + o.qty, 0), 0), 0
                )} ШТ
              </span>
            </div>
          </div>
        </div>
      </div>

      <main className="dashboard-body">
        {viewMode === 'calendar' ? (
          <div className="google-calendar-container">
            <div className="gcal-weekdays-header">
              {['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'НД'].map((dayName, idx) => (
                <div key={dayName} className={`gcal-weekday-head ${idx >= 5 ? 'weekend' : ''}`}>
                  {dayName}
                </div>
              ))}
            </div>

            <div className="gcal-month-grid">
              {calendarGridDays.map((cell, idx) => {
                const dayEvents = calendarEventsByDate[cell.dateKey] || []
                const totalDayQty = dayEvents.reduce((acc, e) => acc + (Number(e.qty) || 0), 0)

                return (
                  <div
                    key={idx}
                    className={`gcal-day-cell ${!cell.isCurrentMonth ? 'other-month' : ''} ${cell.isToday ? 'today' : ''} ${cell.isWeekend ? 'weekend' : ''}`}
                    onClick={() => {
                      if (dayEvents.length > 0) {
                        setSelectedCell({ day: { day: cell.day, fullDate: cell.dateKey }, orders: dayEvents })
                        if (dayEvents.length === 1) setSelectedOrderId(dayEvents[0].id)
                      }
                    }}
                  >
                    <div className="gcal-day-top">
                      <span className={`gcal-day-num ${cell.isToday ? 'today-badge' : ''}`}>
                        {cell.day}
                      </span>
                      {cell.isToday && <span className="today-label">СЬОГОДНІ</span>}
                      {totalDayQty > 0 && (
                        <span className="gcal-day-qty-badge">
                          {totalDayQty.toLocaleString()} шт
                        </span>
                      )}
                    </div>

                    <div className="gcal-events-list">
                      {dayEvents.map((evt, eIdx) => {
                        const statusColor = evt.status === 'completed' || evt.status === 'shipped' || evt.status === 'packaged'
                          ? '#10b981'
                          : (evt.status === 'pending' ? '#38bdf8' : '#ff9000')

                        return (
                          <div
                            key={eIdx}
                            className="gcal-event-card"
                            style={{ borderLeftColor: statusColor }}
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedOrderId(evt.id)
                            }}
                          >
                            <div className="gcal-event-head">
                              <span className="gcal-event-num">#{evt.orderNum}</span>
                              <span className="gcal-event-qty">{evt.qty} шт</span>
                            </div>
                            <div className="gcal-event-prod">{evt.productName}</div>
                            <div className="gcal-event-cust">{evt.customer}</div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="matrix-section">
            <div className="matrix-content-area">
              <table className="production-grid">
                <thead>
                  <tr>
                    <th className="sticky-col-strategic first-col">ДАТА</th>
                    {activeProducts.map(p => (
                      <th
                        key={p.id}
                        className={`product-head ${hoveredPid === p.id ? 'col-highlight' : ''}`}
                        onMouseEnter={() => setHoveredPid(p.id)}
                        onMouseLeave={() => setHoveredPid(null)}
                      >
                        <div className="product-name-horizontal">{p.name}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {daysInMonth.map(day => {
                    const isToday = day.fullDate === toLocalISO(new Date())
                    const isWeekend = day.weekday === 'сб' || day.weekday === 'нд'

                    return (
                      <tr key={day.day} className={`matrix-row ${isToday ? 'is-today' : ''} ${isWeekend ? 'is-weekend' : ''}`}>
                        <td className="sticky-col-strategic date-col">
                          <div className="date-block-compact">
                            <span className="day-num-small">{day.day}</span>
                            <span className="day-name-small">{day.weekday}</span>
                          </div>
                        </td>
                        {activeProducts.map(p => {
                          const cellOrders = matrixData[day.fullDate]?.[p.id] || []
                          const totalQty = cellOrders.reduce((sum, o) => sum + o.qty, 0)

                          let intensity = 0;
                          if (totalQty > 0) {
                            intensity = Math.min(0.2 + (totalQty / 500) * 0.8, 1);
                          }

                          return (
                            <td
                              key={p.id}
                              className={`analysis-cell ${totalQty > 0 ? 'has-data' : ''} ${hoveredPid === p.id ? 'col-highlight' : ''}`}
                              style={totalQty > 0 ? {
                                '--load-intensity': intensity,
                                backgroundColor: `rgba(255, 144, 0, ${intensity * 0.15})`,
                                verticalAlign: 'top'
                              } : {}}
                              onMouseEnter={() => setHoveredPid(p.id)}
                              onMouseLeave={() => setHoveredPid(null)}
                            >
                              {totalQty > 0 && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '12px' }}>
                                  <div style={{ display: 'flex', justifyContent: 'flex-start', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px' }}>
                                    <span style={{ fontSize: '0.65rem', fontWeight: 900, color: '#ff9000', letterSpacing: '1px' }}>РАЗОМ: <span style={{ fontSize: '1rem', color: '#fff' }}>{totalQty}</span></span>
                                  </div>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    {cellOrders.map((o, idx) => (
                                      <div 
                                        key={idx} 
                                        onClick={(e) => { 
                                          e.stopPropagation()
                                          setSelectedCell({ day, product: p, orders: cellOrders })
                                          setSelectedOrderId(o.id)
                                        }}
                                        style={{ 
                                          background: 'rgba(5,5,5,0.6)', 
                                          borderRadius: '8px', 
                                          padding: '10px', 
                                          display: 'flex', 
                                          flexDirection: 'column', 
                                          alignItems: 'flex-start', 
                                          cursor: 'pointer', 
                                          border: '1px solid rgba(255,144,0,0.15)',
                                          transition: 'all 0.2s'
                                        }}
                                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,144,0,0.1)'; e.currentTarget.style.borderColor = '#ff9000'; }}
                                        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(5,5,5,0.6)'; e.currentTarget.style.borderColor = 'rgba(255,144,0,0.15)'; }}
                                      >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: '4px' }}>
                                          <span style={{ fontSize: '0.7rem', color: '#ff9000', fontWeight: 900 }}>#{o.orderNum}</span>
                                          <span style={{ fontSize: '0.8rem', color: '#fff', fontWeight: 900 }}>{o.qty} шт</span>
                                        </div>
                                        <span style={{ fontSize: '0.75rem', color: '#aaa', fontWeight: 600, textAlign: 'left', lineHeight: 1.2 }}>{o.customer}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot className="strategic-footer">
                  <tr>
                    <td className="sticky-col-strategic footer-label-cell">РАЗОМ ПЛАН</td>
                    {activeProducts.map(p => {
                      const totalMonthQty = daysInMonth.reduce((sum, day) => {
                        const dayOrders = matrixData[day.fullDate]?.[p.id] || []
                        return sum + dayOrders.reduce((s, o) => s + o.qty, 0)
                      }, 0)

                      return (
                        <td key={p.id} className="footer-total-cell">
                          {totalMonthQty > 0 ? <span className="month-sum">{totalMonthQty}</span> : '-'}
                        </td>
                      )
                    })}
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* APPROVALS DRAWER */}
      {isApprovalsOpen && (
        <div className="drawer-overlay" onClick={() => setIsApprovalsOpen(false)}>
          <div className="drawer-content glass-panel anim-slide-right" onClick={e => e.stopPropagation()}>
            <div className="drawer-header">
              <div className="header-title">
                <ShieldCheck className="text-orange" size={24} />
                <h3>ПІДТВЕРДЖЕННЯ НАРЯДІВ <span className="count-tag">{pendingTasks.length}</span></h3>
              </div>
              <button className="btn-close" onClick={() => setIsApprovalsOpen(false)}><X size={24} /></button>
            </div>

            <div className="drawer-body">
              {pendingTasks.map(task => {
                const order = orders.find(o => String(o.id) === String(task.order_id)) || allOrdersMap[task.order_id]
                const isSkladOk = task.warehouse_conf === 'true' || task.warehouse_conf === 'partial'
                const isEngOk = task.engineer_conf === true

                const orderItems = order?.order_items || []
                let prodName = ''
                let prodQty = ''

                if (orderItems.length > 0) {
                  prodName = orderItems.map(it => {
                    const nom = nomenclatures.find(n => String(n.id) === String(it.nomenclature_id))
                    return nom ? nom.name : null
                  }).filter(Boolean).join(', ')

                  const totalItemQty = orderItems.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0)
                  prodQty = task.planned_sets ? `${task.planned_sets} компл.` : (totalItemQty > 0 ? `${totalItemQty} шт` : '')
                }

                if (!prodName && order?.nomenclature_id) {
                  const nom = nomenclatures.find(n => String(n.id) === String(order.nomenclature_id))
                  if (nom) prodName = nom.name
                }

                if (!prodQty && task.planned_sets) {
                  prodQty = `${task.planned_sets} компл.`
                }

                if (!prodName) prodName = '—'

                return (
                  <div key={task.id} className="approval-card glass-panel">
                    <div className="card-top">
                      <div className="order-info">
                        <span className="order-label">ЗАМОВЛЕННЯ</span>
                        <h4 className="order-num">#{order?.order_num}</h4>
                        <p className="order-cust">{order?.customer}</p>
                      </div>
                      <div className="order-time">
                        <Clock size={14} /> {new Date(task.created_at).toLocaleDateString()}
                      </div>
                    </div>

                    <div className="order-product-badge-block" style={{ marginBottom: '16px', padding: '12px 14px', background: 'rgba(255, 144, 0, 0.06)', border: '1px solid rgba(255, 144, 0, 0.2)', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.62rem', fontWeight: 900, color: '#ff9000', textTransform: 'uppercase', letterSpacing: '0.5px' }}>ВИРІБ / ПРОДУКЦІЯ</span>
                        {prodQty && (
                          <span style={{ fontSize: '0.82rem', fontWeight: 950, color: '#10b981', background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '2px 8px', borderRadius: '6px' }}>
                            {prodQty}
                          </span>
                        )}
                      </div>
                      <div className="opbb-name" style={{ fontSize: '0.95rem', fontWeight: 950, color: 'var(--text, #ffffff)', lineHeight: 1.3 }}>
                        {prodName}
                      </div>
                    </div>

                    <div className="checks-grid">
                      <div className={`check-item ${task.warehouse_conf === 'true' ? 'ok' : (task.warehouse_conf === 'partial' ? 'partial' : 'pending')}`} style={task.warehouse_conf === 'partial' ? { background: 'rgba(234,179,8,0.1)', color: '#eab308', border: '1px solid rgba(234,179,8,0.2)' } : {}}>
                        <Warehouse size={18} />
                        <span>{task.warehouse_conf === 'partial' ? 'ЧАСТК. СКЛАД' : 'СКЛАД'}</span>
                        {(task.warehouse_conf === 'true' || task.warehouse_conf === 'partial') && <CheckCircle2 size={12} />}
                      </div>
                      <div className={`check-item ${isEngOk ? 'ok' : 'pending'}`}>
                        <FileCode size={18} />
                        <span>ІНЖЕНЕР</span>
                        {isEngOk && <CheckCircle2 size={12} />}
                      </div>
                    </div>

                    <button
                      onClick={() => apiService.submitApproveDirector(task.id, approveDirector)}
                      disabled={!(isSkladOk && isEngOk)}
                      className={`btn-approve ${(isSkladOk && isEngOk) ? 'ready' : 'locked'}`}
                    >
                      ФІНАЛЬНИЙ ПІДПИС
                    </button>
                  </div>
                )
              })}

              {pendingTasks.length === 0 && (
                <div className="empty-state">
                  <CheckCircle2 size={60} className="text-dim" />
                  <p>УСІ НАРЯДИ ПІДПИСАНО</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CELL DETAILS MODAL */}
      {selectedCell && (
        <div className="modal-overlay" onClick={() => { setSelectedCell(null); setSelectedOrderId(null); }}>
          <div className="modal-content glass-panel-premium anim-scale-up" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="header-title">
                {selectedOrderId ? (
                  <button className="btn-back-modal" onClick={() => setSelectedOrderId(null)}>
                    <ArrowLeft size={16} /> <span>НАЗАД</span>
                  </button>
                ) : (
                  <>
                    <Package className="text-orange" size={20} />
                    <h4>{selectedCell.product.name}</h4>
                  </>
                )}
              </div>
              <button className="btn-close" onClick={() => { setSelectedCell(null); setSelectedOrderId(null); }}><X size={20} /></button>
            </div>

            <div className="modal-body">
              {!selectedOrderId ? (
                <>
                  <div className="modal-meta-row">
                    <span className="date-badge">{selectedCell.day.day} {selectedCell.day.fullDate}</span>
                    <span className="total-highlight">Всього: {selectedCell.orders.reduce((s, o) => s + o.qty, 0)} шт</span>
                  </div>
                  <div className="orders-list">
                    {selectedCell.orders.map((o, idx) => (
                      <div key={idx} className="order-item-card" onClick={() => setSelectedOrderId(o.id)}>
                        <div className="order-main-info">
                          <span className="mini-num">#{o.orderNum}</span>
                          <span className="mini-cust">{o.customer}</span>
                        </div>
                        <div className="order-right-info">
                          <strong className="mini-qty">{o.qty} шт</strong>
                          <ChevronRight size={14} className="icon-arrow" />
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (() => {
                const orderData = orders.find(o => o.id === selectedOrderId)
                const orderTasks = tasks.filter(t => String(t.order_id) === String(selectedOrderId))
                const orderReqs = requests.filter(r => String(r.order_id) === String(selectedOrderId))
                const orderCards = workCards.filter(c => String(c.order_id) === String(selectedOrderId))

                return (
                  <div className="order-dossier-dashboard">
                    <div className="dossier-main-grid">
                      {/* LEFT COLUMN: PRIMARY INFO */}
                      <div className="dossier-left">
                        <div className="dossier-card header-card">
                          <div className="dossier-header-top">
                            <div className="title-group">
                              <span className="overline">ДОСЬЄ ЗАМОВЛЕННЯ #{orderData?.order_num}</span>
                              <h2 className="customer-name">{orderData?.customer}</h2>
                            </div>
                            <div className={`status-pill status-${orderData?.status}`}>
                              {getStatusLabel(orderData?.status)}
                            </div>
                          </div>
                          <div className="header-meta">
                            <div className="meta-item">
                              <Clock size={16} />
                              <div className="meta-info">
                                <span className="m-label">СТВОРЕНО</span>
                                <span className="m-val">{orderData?.created_at ? new Date(orderData.created_at).toLocaleDateString() : '—'}</span>
                              </div>
                            </div>
                            <div className="meta-item highlight">
                              <Calendar size={16} />
                              <div className="meta-info">
                                <span className="m-label">ДЕДЛАЙН</span>
                                <span className="m-val">{orderData?.deadline ? new Date(orderData.deadline).toLocaleDateString() : '—'}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="dossier-card">
                          <h4 className="section-title"><Package size={16} /> 1. СКЛАД ЗАМОВЛЕННЯ</h4>
                          <div className="items-grid">
                            {orderData?.order_items?.map((item, id) => {
                               const nom = nomenclatures.find(n => n.id === item.nomenclature_id)
                               return (
                                 <div key={id} className="item-pill">
                                   <span className="i-name">{nom?.name || 'Продукція'}</span>
                                   <span className="i-qty">{item.quantity} шт</span>
                                 </div>
                               )
                            })}
                          </div>
                        </div>

                        <div className="dossier-card">
                          <h4 className="section-title"><Warehouse size={16} /> 3. ЗАПИТИ ДЛЯ СКЛАДУ</h4>
                          <div className="requests-stack">
                            {orderReqs.length === 0 ? <div className="empty-hint">Запитів немає...</div> : (() => {
                              // Grouping by task_id or specific task-related grouping
                              const groups = {}
                              orderReqs.forEach(r => {
                                const key = r.task_id || 'manual'
                                if (!groups[key]) groups[key] = []
                                groups[key].push(r)
                              })

                              return Object.entries(groups).map(([taskId, reqs]) => {
                                const firstReq = reqs[0]
                                const isPending = reqs.some(r => r.status === 'pending')
                                const task = tasks.find(t => String(t.id) === String(taskId))
                                const taskLabel = task 
                                  ? `#${orderData?.order_num}${task.batch_index ? `/${task.batch_index}` : ''}`
                                  : taskId
                                
                                return (
                                  <div key={taskId} className={`request-bar ${isPending ? 'status-pending' : 'status-completed'}`}>
                                    <div 
                                      className="r-doc-header" 
                                      style={{ cursor: 'pointer' }}
                                      onClick={() => toggleReq(taskId)}
                                    >
                                      <div className="r-doc-id">ЗАЯВКА НА СКЛАД {taskId !== 'manual' ? `[НАРЯД ${taskLabel}]` : '[ВИТРАТНІ]'}</div>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                        <span className={`r-pill ${isPending ? 'pending' : 'issued'}`}>{isPending ? 'В РОБОТІ' : 'ГОТОВО'}</span>
                                        {expandedReqs[taskId] ? <ChevronRight size={16} style={{ transform: 'rotate(90deg)', transition: '0.3s' }} /> : <ChevronRight size={16} style={{ transition: '0.3s' }} />}
                                      </div>
                                    </div>
                                    
                                    {expandedReqs[taskId] && (
                                      <div className="r-doc-body anim-expand">
                                        {reqs.map((r, ri) => {
                                          const p = parseRequestDetails(r.details)
                                          return (
                                            <div key={ri} className="r-item-block" style={{ marginBottom: ri < reqs.length - 1 ? '20px' : 0 }}>
                                              <div className="r-main-row">
                                                <span className="r-mat-large">{p.material}</span>
                                                <span className="r-qty-large">{p.qty}</span>
                                              </div>
                                              
                                              {p.breakdown.length > 0 && (
                                                <div className="r-breakdown-box">
                                                  {p.breakdown.map((b, bi) => (
                                                    <div key={bi} className="b-row">
                                                      <span className="b-label">{b.label}</span>
                                                      <span className="b-val">{b.qty}</span>
                                                    </div>
                                                  ))}
                                                </div>
                                              )}
                                            </div>
                                          )
                                        })}
                                      </div>
                                    )}
                                    
                                    <div className="r-doc-footer">
                                      <span>ДАТА: {new Date(firstReq.created_at).toLocaleDateString()}</span>
                                      <span>КІЛЬКІСТЬ ПОЗИЦІЙ: {reqs.length}</span>
                                    </div>
                                  </div>
                                )
                              })
                            })()}
                          </div>
                        </div>
                      </div>

                      {/* RIGHT COLUMN: PRODUCTION STATUS */}
                      <div className="dossier-right">
                        <div className="dossier-card">
                          <h4 className="section-title"><Layers size={16} /> 2. ВИРОБНИЧІ НАРЯДИ</h4>
                          <div className="naryad-stack">
                            {orderTasks.length === 0 ? <div className="empty-hint">Наряди ще не сформовано...</div> : orderTasks.map(t => {
                              const isExpanded = expandedNaryads[t.id]
                              const snapshot = t.plan_snapshot || {}
                              const materialSummary = snapshot.materialSummary || {}
                              let materials = Object.values(materialSummary)

                              if (materials.length === 0) {
                                const snapIds = Object.keys(snapshot).filter(k => !k.startsWith('_') && k !== 'arrivals' && k !== 'materialSummary')
                                materials = snapIds.map(id => {
                                  const s = snapshot[id]
                                  if (!s) return null
                                  return {
                                    matName: s.name || 'Деталь',
                                    totalUnits: s.plan || s.need || 0,
                                    components: [s.code || 'Без коду']
                                  }
                                }).filter(Boolean)
                              }

                              return (
                                <div key={t.id} className="naryad-row-container">
                                  <div 
                                    className="naryad-row" 
                                    style={{ cursor: 'pointer' }}
                                    onClick={() => toggleNaryad(t.id)}
                                  >
                                    <div className="n-left">
                                      <span className="n-date">{new Date(t.created_at).toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                                      <span className="n-info">Наряд <strong>#{orderData?.order_num}{t.batch_index ? `/${t.batch_index}` : ''}</strong> на <strong>{t.planned_sets || '—'} од.</strong></span>
                                      <span className="n-step">{t.step} | Верстат: {t.machine || '—'}</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                      <div className={`n-status status-${t.status}`}>{t.status.toUpperCase()}</div>
                                      {isExpanded ? <ChevronRight size={16} style={{ transform: 'rotate(90deg)', transition: '0.3s' }} /> : <ChevronRight size={16} style={{ transition: '0.3s' }} />}
                                    </div>
                                  </div>
                                  
                                  {isExpanded && (
                                    <div className="naryad-details anim-expand">
                                      <div className="details-grid">
                                        <div className="details-col">
                                          <div className="d-label">ПЛАН МАТЕРІАЛІВ (BOM):</div>
                                          <div className="bom-list">
                                            {materials.length === 0 ? (
                                              <div className="empty-hint">Дані про матеріали відсутні</div>
                                            ) : (
                                              <>
                                                {/* Materials Category */}
                                                {materials.filter(m => (m.sheets || 0) > 0).length > 0 && (
                                                  <div className="bom-category">
                                                    <div className="cat-header">ОСНОВНІ МАТЕРІАЛИ</div>
                                                    {materials.filter(m => (m.sheets || 0) > 0).map((m, mi) => (
                                                      <div key={mi} className="bom-item">
                                                        <div className="m-info">
                                                          <span className="m-name">{m.matName}</span>
                                                          <span className="m-tech highlight">
                                                            {m.sheets} л. <span className="dim">|</span> {m.totalUnits} шт
                                                          </span>
                                                        </div>
                                                        <div className="m-comps">{m.components?.join(', ')}</div>
                                                      </div>
                                                    ))}
                                                  </div>
                                                )}

                                                {/* Hardware / Components Category */}
                                                {materials.filter(m => !(m.sheets || 0)).length > 0 && (
                                                  <div className="bom-category">
                                                    <div className="cat-header">КОМПЛЕКТУЮЧІ ТА МЕТИЗИ</div>
                                                    <div className="hardware-grid">
                                                      {materials.filter(m => !(m.sheets || 0)).map((m, mi) => (
                                                        <div key={mi} className="hw-item">
                                                          <span className="hw-name">{m.matName}</span>
                                                          <span className="hw-qty">{m.totalUnits} шт</span>
                                                        </div>
                                                      ))}
                                                    </div>
                                                  </div>
                                                )}
                                              </>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </div>

                        <div className="dossier-card flex-1">
                          <h4 className="section-title"><Clock size={16} /> 4. ПОТОЧНИЙ СТАН: АКТИВНІ КАРТКИ</h4>
                          <div className="cards-stack">
                            {orderCards.length === 0 ? <div className="empty-hint">Немає активних карток у виробництві...</div> : orderCards.map(c => {
                               const statusColors = { new: '#333', 'in-progress': '#ff9000', 'at-buffer': '#3b82f6', completed: '#10b981' }
                               return (
                                 <div key={c.id} className="card-mini" style={{ borderLeft: `4px solid ${statusColors[c.status] || '#fff'}` }}>
                                   <div className="c-info">
                                     <div className="c-op">{c.operation}</div>
                                     <div className="c-meta">{c.operator || 'Без оператора'} | {c.machine || '—'}</div>
                                   </div>
                                   <div className="c-qty-group">
                                     <span className="c-qty">{c.quantity}</span>
                                     <span className="c-status">{c.status}</span>
                                   </div>
                                 </div>
                               )
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })()}
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{
        __html: `
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800;900&display=swap');

        .director-console {
          background: var(--bg, #050505); height: 100vh; color: var(--text, #fff);
          font-family: 'Outfit', sans-serif; display: flex; flex-direction: column; width: 100%;
          overflow: hidden;
        }

        .text-orange { color: #ff9000; }
        .text-dim { color: #333; }

        /* TOP HEADERS — fixed height, never scroll */
        .sticky-dashboard-header {
          flex-shrink: 0; background: #050505; width: 100%; z-index: 2000;
        }

        .glass-nav-director {
          display: flex; justify-content: space-between; align-items: center;
          padding: 0 40px 0 75px; height: var(--nav-h); min-height: var(--nav-h); background: #050505;
          border-bottom: 1px solid #111;
        }
        .nav-left { display: flex; align-items: center; gap: 40px; }
        .btn-back-director {
          display: flex; gap: 10px; align-items: center; color: #555;
          text-decoration: none; font-weight: 800; font-size: 0.85rem;
          padding: 10px 18px; border-radius: 14px; transition: all 0.3s;
          background: rgba(255,255,255,0.02);
        }
        .btn-back-director:hover { color: #fff; background: rgba(255,255,255,0.08); }
        .brand-group { display: flex; align-items: center; gap: 15px; }
        .brand-group h1 { font-size: 1.3rem; font-weight: 950; margin: 0; letter-spacing: 2px; }

        .nav-right { display: flex; gap: 20px; }
        .btn-notifications {
          display: flex; align-items: center; gap: 12px; background: rgba(255,255,255,0.03);
          color: #fff; border: 1px solid rgba(255,255,255,0.05); padding: 10px 25px; border-radius: 14px;
          font-weight: 800; font-size: 0.8rem; cursor: pointer; position: relative;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          min-width: 180px; justify-content: center;
        }
        .btn-notifications:hover { 
          background: rgba(255,255,255,0.08); 
          border-color: rgba(255,144,0,0.5);
          transform: translateY(-1px);
        }

        .badge-count {
          position: absolute; top: -8px; right: -8px; background: #ef4444; color: #fff;
          min-width: 20px; height: 20px; border-radius: 10px; border: 2px solid #050505;
          display: flex; align-items: center; justify-content: center; font-size: 0.65rem;
          font-weight: 1000; box-shadow: 0 4px 10px rgba(239, 68, 68, 0.4);
        }
        
        @keyframes pulse-red {
          0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
          70% { transform: scale(1.05); box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); }
          100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }
        .anim-pulse { animation: pulse-red 2s infinite; }

        /* BODY — the ONE scroll container for the whole table */
        .dashboard-body { flex: 1; overflow: auto; display: flex; flex-direction: column; width: 100%; }
        
        .strategic-header {
           height: 70px; min-height: 70px; padding: 0 40px; display: flex; align-items: center; justify-content: space-between;
           border-bottom: 1px solid #111; background: #050505; 
        }
        .month-selector-group { display: flex; align-items: center; gap: 20px; }
        .month-info-badge { 
          display: flex; align-items: center; gap: 15px; background: #111; padding: 10px 25px; 
          border-radius: 12px; border: 1px solid #222;
        }
        .month-name-compact { font-size: 1.1rem; font-weight: 1000; color: #fff; letter-spacing: 2px; }
        .year-divider { color: #333; font-weight: 100; }
        .year-val-compact { font-size: 1.1rem; font-weight: 900; color: #666; }
        
        .nav-btn { background: #1a1a1a; border: none; color: #555; width: 36px; height: 36px; border-radius: 10px; cursor: pointer; transition: 0.3s; }
        .nav-btn:hover { background: #ff9000; color: #000; transform: scale(1.1); }

        .header-meta-actions { display: flex; align-items: center; gap: 30px; }
        .btn-jump-today { background: transparent; border: 1px solid #222; color: #666; padding: 8px 16px; border-radius: 8px; font-weight: 800; font-size: 0.7rem; cursor: pointer; }
        .btn-jump-today:hover { border-color: #ff9000; color: #fff; }
        .analysis-summary-mini { display: flex; align-items: center; gap: 10px; font-size: 0.75rem; font-weight: 900; }
        .meta-label { color: #444; }

        /* ANALYSIS MATRIX */
        /* No overflow on matrix-content-area — dashboard-body owns the scroll */
        .matrix-content-area { width: 100%; flex: 1; min-width: 0; }
        .production-grid { border-collapse: separate; border-spacing: 0; width: auto; table-layout: fixed; }
        
        /* thead sticks at top:0 of the dashboard-body scroll container */
        .production-grid th { 
          background: #080808; padding: 15px 25px; border-bottom: 2px solid #222; 
          position: sticky; top: 0; z-index: 1800; text-align: left; border-right: 1px solid #111; 
        }
        .sticky-col-strategic { 
          position: sticky; left: 0; z-index: 1000 !important; background: #050505 !important; 
          width: 70px; min-width: 70px; border-right: 1px solid #222; 
        }
        thead th.sticky-col-strategic { z-index: 1900 !important; top: 0; border-bottom: 2px solid #333; background: #080808 !important; }
        .product-head { width: 280px; min-width: 280px; }
        
        .matrix-row { transition: background 0.1s; height: 45px; }
        .matrix-row:hover { background: rgba(255,255,255,0.03) !important; }
        .date-col { text-align: center; }
        .date-block-compact { display: flex; flex-direction: column; align-items: center; justify-content: center; }
        .day-num-small { font-size: 1.1rem; font-weight: 1000; color: #fff; line-height: 1; }
        .day-name-small { font-size: 0.6rem; color: #333; font-weight: 900; text-transform: uppercase; margin-top: 2px; }

        .analysis-cell { border-bottom: 1px solid #111; border-right: 1px solid #111; text-align: center; cursor: default; transition: background 0.2s; position: relative; }
        .analysis-cell:hover::after { content: ''; position: absolute; inset: 0; background: rgba(255,255,255,0.05); pointer-events: none; }
        .col-highlight { position: relative; }
        .col-highlight::before { content: ''; position: absolute; inset: 0; background: rgba(255,255,255,0.015); pointer-events: none; }
        .analysis-cell.col-highlight.has-data { border-left: 1px solid rgba(255,144,0,0.2); border-right: 1px solid rgba(255,144,0,0.2); }
        
        /* Crosshair Effect on Hover */
        .production-grid:hover tr:hover td { background: rgba(255,255,255,0.02); }
        
        .qty-analysis-val { font-size: 1rem; font-weight: 1000; color: #ff9000; text-shadow: 0 0 15px rgba(255,144,0,0.3); }

        .matrix-row.is-today .date-col { background: #1a1500 !important; border-right: 2px solid #ff9000; }
        .matrix-row.is-today .day-num-small { color: #ff9000; }
        .matrix-row.is-weekend { background: rgba(255,255,255,0.01); }
        .matrix-row.is-weekend .day-name-small { color: #ff3e3e; }

        /* STRATEGIC FOOTER */
        .strategic-footer { position: sticky; bottom: 0; z-index: 900; }
        .strategic-footer tr td { background: #0a0a0a !important; height: 60px; border-top: 1px solid #333; border-bottom: none; border-right: 1px solid #111; text-align: center; }
        .footer-label-cell { font-size: 0.7rem; font-weight: 1000; color: #555; letter-spacing: 1px; text-transform: uppercase; }
        .month-sum { font-size: 1.2rem; font-weight: 1000; color: #ff9000; }

        /* DRAWER */
        .drawer-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.9); z-index: 2000; backdrop-filter: blur(15px); }
        .drawer-content { 
          position: absolute; right: 0; top: 0; bottom: 0; width: 500px; 
          background: #050505; display: flex; flex-direction: column; border-left: 1px solid #222;
        }
        /* ... same or similar for drawer ... */
        .drawer-header { padding: 30px; display: flex; justify-content: space-between; border-bottom: 1px solid #111; }
        .header-title { display: flex; align-items: center; gap: 15px; }
        .header-title h3 { font-size: 1.1rem; font-weight: 900; margin: 0; }
        .count-tag { background: #ff9000; color: #000; font-size: 0.7rem; padding: 2px 8px; border-radius: 8px; }
        .btn-close { background: transparent; border: none; color: #444; cursor: pointer; transition: 0.3s; }
        .btn-close:hover { color: #fff; }

        .drawer-body { padding: 25px; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 20px; }
        
        .approval-card { padding: 25px; border: 1px solid #222; }
        .card-top { display: flex; justify-content: space-between; margin-bottom: 20px; }
        .order-label { display: block; font-size: 0.6rem; color: #555; font-weight: 900; margin-bottom: 4px; }
        .order-num { font-size: 1.4rem; font-weight: 900; margin: 0; }
        .order-cust { font-size: 0.85rem; color: #888; margin: 5px 0 0 0; }
        .order-time { color: #333; font-size: 0.75rem; font-weight: 800; display: flex; align-items: center; gap: 5px; }

        .checks-grid { display: flex; gap: 10px; margin-bottom: 20px; }
        .check-item { flex: 1; display: flex; align-items: center; gap: 8px; padding: 12px; border-radius: 12px; font-size: 0.65rem; font-weight: 800; border: 1px solid transparent; }
        .check-item.ok { background: rgba(16, 185, 129, 0.05); color: #10b981; border-color: rgba(16, 185, 129, 0.2); }
        .check-item.ok svg { color: #10b981; }
        .check-item.pending { background: #000; color: #444; border-color: #1a1a1a; }
        
        .btn-approve {
          width: 100%; padding: 15px; border-radius: 14px; border: none;
          font-weight: 900; text-transform: uppercase; cursor: pointer; transition: 0.3s;
        }
        .btn-approve.ready { background: #10b981; color: #000; }
        .btn-approve.ready:hover { transform: translateY(-2px); box-shadow: 0 10px 20px -5px rgba(16, 185, 129, 0.4); }
        .btn-approve.locked { background: #111; color: #444; cursor: not-allowed; }

        /* MODAL REDESIGN */
        .modal-overlay { 
          position: fixed; inset: 0; 
          background: rgba(0,0,0,0.85); 
          z-index: 2000; 
          display: flex; align-items: center; justify-content: center; 
          backdrop-filter: blur(12px); 
          animation: fadeIn 0.3s ease;
        }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

        .glass-panel-premium {
          background: linear-gradient(135deg, rgba(20,20,20,0.9), rgba(5,5,5,0.95));
          border: 1px solid rgba(255,144,0,0.3);
          border-radius: 30px;
          box-shadow: 0 30px 60px -12px rgba(0,0,0,0.8), 0 0 40px rgba(255,144,0,0.05);
          backdrop-filter: blur(20px);
          overflow: hidden;
        }

        .modal-content { width: 1000px; max-width: 95vw; padding: 0; }
        .modal-header { padding: 20px 30px; border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.02); }
        .modal-body { padding: 0; }

        /* DOSSIER DASHBOARD */
        .order-dossier-dashboard { height: 80vh; overflow-y: auto; display: flex; flex-direction: column; background: var(--bg, #050505); }
        .dossier-main-grid { display: grid; grid-template-columns: 400px 1fr; gap: 2px; background: var(--border, #111); flex: 1; }
        .dossier-left, .dossier-right { display: flex; flex-direction: column; gap: 2px; background: var(--bg, #050505); padding: 25px; overflow-y: auto; }
        
        .dossier-card { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.03); border-radius: 20px; padding: 25px; margin-bottom: 20px; }
        .dossier-card.header-card { background: linear-gradient(135deg, rgba(255,144,0,0.1), transparent); border-color: rgba(255,144,0,0.2); }
        
        .dossier-header-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
        .overline { font-size: 0.7rem; color: #ff9000; font-weight: 1000; letter-spacing: 2px; text-transform: uppercase; }
        .customer-name { font-size: 1.8rem; font-weight: 1000; color: #fff; margin: 5px 0 0 0; line-height: 1.1; }
        
        .status-pill { padding: 6px 14px; border-radius: 10px; font-size: 0.75rem; font-weight: 900; text-transform: uppercase; }
        .status-completed { background: rgba(16, 185, 129, 0.2); color: #10b981; }
        .status-in-progress { background: rgba(59, 130, 246, 0.2); color: #3b82f6; }
        .status-pending { background: #111; color: #555; }

        .header-meta { display: flex; gap: 30px; }
        .meta-item { display: flex; align-items: center; gap: 12px; }
        .meta-item svg { color: #444; }
        .meta-item.highlight svg { color: #ff9000; }
        .meta-info { display: flex; flex-direction: column; }
        .m-label { font-size: 0.6rem; color: #555; font-weight: 900; }
        .m-val { font-size: 0.85rem; color: #fff; font-weight: 800; }

        .section-title { font-size: 0.7rem; color: #555; font-weight: 1000; letter-spacing: 1.5px; margin: 0 0 20px 0; display: flex; align-items: center; gap: 10px; text-transform: uppercase; }
        
        .items-grid { display: flex; flex-wrap: wrap; gap: 10px; }
        .item-pill { background: #111; padding: 10px 18px; border-radius: 12px; display: flex; gap: 15px; align-items: center; border: 1px solid #1a1a1a; }
        .i-name { font-size: 0.8rem; color: #888; font-weight: 700; }
        .i-qty { font-size: 0.9rem; color: #fff; font-weight: 1000; }

        .requests-stack, .naryad-stack, .cards-stack { display: flex; flex-direction: column; gap: 15px; }
        .request-bar { 
          background: #080808; border: 1px solid #1a1a1a; border-radius: 20px; 
          overflow: hidden; display: flex; flex-direction: column;
          box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        }
        .request-bar.status-pending { border-color: rgba(255,144,0,0.3); }
        
        .r-doc-header { 
          background: rgba(255,255,255,0.02); padding: 12px 20px; 
          display: flex; justify-content: space-between; align-items: center;
          border-bottom: 1px solid #111;
        }
        .r-doc-id { font-size: 0.6rem; font-weight: 1000; color: #444; letter-spacing: 1px; }
        .r-pill { font-size: 0.55rem; font-weight: 1000; padding: 2px 8px; border-radius: 6px; }
        .r-pill.pending { background: #ff9000; color: #000; }
        .r-pill.issued { background: #10b981; color: #000; }

        .r-doc-body { padding: 20px; }
        .anim-expand { animation: expandDown 0.3s ease-out; }
        @keyframes expandDown { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
        .r-main-row { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 8px; }
        .r-item-block { background: rgba(255,255,255,0.01); padding: 12px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.02); }
        .r-mat-large { font-size: 1rem; color: #fff; font-weight: 800; }
        .r-qty-large { font-size: 1.1rem; color: #ff9000; font-weight: 1000; }

        .r-breakdown-box { 
          background: rgba(0,0,0,0.4); border: 1px solid #111; border-radius: 10px; padding: 10px 15px;
          margin-top: 5px;
        }
        .b-title { font-size: 0.6rem; color: #333; font-weight: 900; margin-bottom: 10px; letter-spacing: 1px; }
        .b-row { display: flex; justify-content: space-between; font-size: 0.75rem; padding: 6px 0; border-bottom: 1px solid #0a0a0a; }
        .b-row:last-child { border-bottom: none; }
        .b-label { color: #888; font-weight: 600; }
        .b-val { color: #fff; font-weight: 800; }

        .r-doc-footer { 
          padding: 10px 20px; background: rgba(0,0,0,0.2); border-top: 1px solid #111;
          display: flex; justify-content: space-between; font-size: 0.6rem; color: #333; font-weight: 800;
        }

        .naryad-row-container { margin-bottom: 12px; }
        .naryad-row { display: flex; justify-content: space-between; align-items: center; background: #080808; padding: 15px 20px; border-radius: 15px; border: 1px solid #111; }
        
        .naryad-details { background: rgba(0,0,0,0.5); padding: 20px; border-radius: 0 0 15px 15px; border: 1px solid #111; border-top: none; }
        .details-grid { display: grid; grid-template-columns: 1fr; gap: 20px; }
        .d-label { font-size: 0.6rem; color: #444; font-weight: 900; margin-bottom: 15px; letter-spacing: 1px; }
        
        .bom-list { display: flex; flex-direction: column; gap: 15px; }
        .bom-category { 
          background: rgba(255,255,255,0.02); border-radius: 16px; padding: 15px;
          border: 1px solid rgba(255,255,255,0.05);
        }
        .cat-header {
          font-size: 0.65rem; font-weight: 900; color: #555; letter-spacing: 1px;
          margin-bottom: 12px; text-transform: uppercase;
        }
        .bom-item { margin-bottom: 12px; }
        .bom-item:last-child { margin-bottom: 0; }
        .m-info { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4px; }
        .m-name { font-weight: 800; font-size: 0.95rem; color: #fff; }
        .m-tech { font-size: 0.85rem; font-weight: 900; }
        .m-tech.highlight { color: #ff9000; }
        .m-tech .dim { color: #333; margin: 0 5px; }
        .m-comps { font-size: 0.7rem; color: #666; line-height: 1.4; font-weight: 600; }

        .hardware-grid { 
          display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px;
        }
        .hw-item {
          background: rgba(255,255,255,0.03); padding: 8px 12px; border-radius: 10px;
          display: flex; justify-content: space-between; align-items: center;
          border: 1px solid rgba(255,255,255,0.03);
        }
        .hw-name { font-size: 0.8rem; font-weight: 700; color: #aaa; }
        .hw-qty { font-size: 0.85rem; font-weight: 900; color: #fff; }

        .card-mini { display: flex; justify-content: space-between; align-items: center; background: #0a0a0a; padding: 15px 20px; border-radius: 15px; }
        .c-op { font-size: 0.9rem; color: #fff; font-weight: 900; }
        .c-meta { font-size: 0.7rem; color: #444; font-weight: 600; margin-top: 2px; }
        .c-qty-group { display: flex; flex-direction: column; align-items: flex-end; }
        .c-qty { font-size: 1.3rem; color: #ff9000; font-weight: 1000; line-height: 1; }
        .c-status { font-size: 0.6rem; color: #333; font-weight: 900; text-transform: uppercase; margin-top: 3px; }

        .empty-hint { font-size: 0.8rem; color: #333; font-style: italic; }

        .modal-meta-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; }
        .date-badge { background: rgba(255,144,0,0.1); color: #ff9000; padding: 6px 14px; border-radius: 10px; font-size: 0.7rem; font-weight: 900; }
        .total-highlight { color: #888; font-size: 0.8rem; font-weight: 700; }

        .orders-list { display: flex; flex-direction: column; gap: 10px; }
        .order-item-card { 
          display: flex; justify-content: space-between; align-items: center; 
          background: rgba(255,255,255,0.03); padding: 16px 20px; border-radius: 18px; 
          border: 1px solid rgba(255,255,255,0.02); cursor: pointer; transition: all 0.3s;
        }
        .order-item-card:hover { 
          background: rgba(255,144,0,0.08); 
          border-color: rgba(255,144,0,0.3); 
          transform: translateX(5px); 
        }
        .order-item-card:hover .icon-arrow { color: #ff9000; transform: translateX(3px); }

        .order-main-info { display: flex; flex-direction: column; gap: 4px; }
        .mini-num { font-size: 0.7rem; color: #ff9000; font-weight: 900; }
        .mini-cust { font-size: 0.9rem; color: #fff; font-weight: 700; }
        .order-right-info { display: flex; align-items: center; gap: 12px; }
        .mini-qty { font-size: 1.1rem; color: #fff; font-weight: 950; }
        .icon-arrow { color: #333; transition: 0.3s; }

        /* DETAILED VIEW */
        .btn-back-modal { 
          background: rgba(255,255,255,0.05); border: none; color: #fff; 
          padding: 8px 14px; border-radius: 10px; cursor: pointer; 
          display: flex; align-items: center; gap: 8px; font-size: 0.7rem; font-weight: 900;
        }
        .btn-back-modal:hover { background: #ff9000; color: #000; }

        .order-top-summary { margin-bottom: 30px; }
        .order-id-large { font-size: 0.75rem; color: #555; font-weight: 900; letter-spacing: 1px; }
        .order-cust-large { font-size: 1.6rem; font-weight: 1000; color: #fff; margin: 5px 0 0 0; }

        .items-breakdown { background: rgba(0,0,0,0.3); padding: 20px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.03); margin-bottom: 25px; }
        .section-label { font-size: 0.6rem; font-weight: 1000; color: #333; letter-spacing: 2px; display: block; margin-bottom: 15px; }
        .items-list-scroll { max-height: 200px; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; }
        .detail-item-row { display: flex; justify-content: space-between; font-size: 0.85rem; border-bottom: 1px solid #111; padding-bottom: 8px; }
        .item-name { color: #888; font-weight: 600; }
        .item-qty { color: #fff; font-weight: 900; }

        .order-status-badge-row { display: flex; justify-content: space-between; align-items: center; padding: 0 10px; }
        .status-label { font-size: 0.75rem; font-weight: 900; color: #444; }
        .status-val { font-size: 0.8rem; font-weight: 1000; padding: 10px 20px; border-radius: 12px; }
        .status-pending { background: #1a1a1a; color: #555; }
        .status-in-progress { background: rgba(59, 130, 246, 0.1); color: #3b82f6; }
        .status-completed { background: rgba(16, 185, 129, 0.1); color: #10b981; }

        .anim-scale-up { animation: scaleUp 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
        @keyframes scaleUp { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }

        /* GOOGLE CALENDAR VIEW STYLING (GLOBAL) */
        .gcal-view-toggle-group {
          display: flex;
          background: #111;
          border: 1px solid #222;
          border-radius: 12px;
          padding: 3px;
          gap: 4px;
        }
        .gcal-toggle-btn {
          background: transparent;
          border: none;
          color: #888;
          padding: 7px 14px;
          border-radius: 99px;
          font-weight: 800;
          font-size: 0.78rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: all 0.2s;
        }
        .gcal-toggle-btn.active {
          background: #ff9000;
          color: #000;
          box-shadow: 0 2px 6px rgba(255, 144, 0, 0.4);
        }

        .google-calendar-container {
          display: flex;
          flex-direction: column;
          height: 100%;
          width: 100%;
          background: var(--bg, #050505);
          padding: 12px 16px 24px;
          box-sizing: border-box;
          overflow-y: auto;
          overflow-x: hidden;
        }

        .gcal-weekdays-header {
          display: grid;
          grid-template-columns: repeat(7, minmax(0, 1fr));
          gap: 6px;
          margin-bottom: 6px;
          flex-shrink: 0;
          width: 100%;
          box-sizing: border-box;
        }

        .gcal-weekday-head {
          text-align: center;
          font-size: 0.75rem;
          font-weight: 900;
          color: #888;
          padding: 8px 4px;
          background: #0d0d0d;
          border-radius: 10px;
          border: 1px solid #1a1a1a;
          letter-spacing: 1px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .gcal-weekday-head.weekend {
          color: #f59e0b;
          background: rgba(245, 158, 11, 0.06);
          border-color: rgba(245, 158, 11, 0.2);
        }

        .gcal-month-grid {
          display: grid;
          grid-template-columns: repeat(7, minmax(0, 1fr));
          grid-auto-rows: minmax(130px, 1fr);
          gap: 6px;
          flex: 1;
          width: 100%;
          box-sizing: border-box;
        }

        .gcal-day-cell {
          background: #0d0d0d;
          border: 1px solid #1a1a1a;
          border-radius: 12px;
          padding: 8px;
          display: flex;
          flex-direction: column;
          gap: 6px;
          transition: all 0.2s;
          min-height: 120px;
          min-width: 0;
          position: relative;
          cursor: pointer;
          box-sizing: border-box;
        }
        .gcal-day-cell:hover {
          border-color: #333;
          background: #111;
        }
        .gcal-day-cell.other-month {
          opacity: 0.3;
          background: #070707;
        }
        .gcal-day-cell.today {
          border-color: #ff9000;
          background: rgba(255, 144, 0, 0.04);
          box-shadow: inset 0 0 15px rgba(255, 144, 0, 0.05);
        }
        .gcal-day-cell.weekend {
          background: #090b0d;
        }

        .gcal-day-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          gap: 4px;
        }

        .gcal-day-num {
          font-size: 0.85rem;
          font-weight: 900;
          color: #ccc;
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .gcal-day-num.today-badge {
          background: #ff9000;
          color: #000;
          font-weight: 1000;
        }
        .today-label {
          font-size: 0.58rem;
          font-weight: 950;
          color: #ff9000;
          letter-spacing: 0.5px;
        }

        .gcal-day-qty-badge {
          font-size: 0.65rem;
          font-weight: 950;
          color: #ff9000;
          background: rgba(255, 144, 0, 0.12);
          padding: 2px 5px;
          border-radius: 5px;
          border: 1px solid rgba(255, 144, 0, 0.2);
          white-space: nowrap;
        }

        .gcal-events-list {
          display: flex;
          flex-direction: column;
          gap: 5px;
          overflow-y: auto;
          max-height: 180px;
          min-width: 0;
        }

        .gcal-event-card {
          background: #141414;
          border: 1px solid #222;
          border-left-width: 4px;
          border-radius: 8px;
          padding: 6px 8px;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 0;
        }
        .gcal-event-card:hover {
          background: #1c1c1c;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.5);
        }

        .gcal-event-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 4px;
        }
        .gcal-event-num {
          font-size: 0.72rem;
          font-weight: 950;
          color: #ff9000;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .gcal-event-qty {
          font-size: 0.72rem;
          font-weight: 900;
          color: #fff;
          white-space: nowrap;
          flex-shrink: 0;
        }
        .gcal-event-prod {
          font-size: 0.72rem;
          font-weight: 800;
          color: #e2e8f0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .gcal-event-cust {
          font-size: 0.62rem;
          color: #888;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        /* Light theme overrides for Director Google Calendar & Dossier */
        .light-theme .google-calendar-container,
        body.light-theme .google-calendar-container,
        .light-theme .modal-body,
        body.light-theme .modal-body,
        .light-theme .order-dossier-dashboard,
        body.light-theme .order-dossier-dashboard {
          background: #f8fafc !important;
        }
        .light-theme .dossier-main-grid,
        body.light-theme .dossier-main-grid {
          background: #cbd5e1 !important;
        }
        .light-theme .dossier-left,
        body.light-theme .dossier-left,
        .light-theme .dossier-right,
        body.light-theme .dossier-right {
          background: #f8fafc !important;
        }
        .light-theme .gcal-weekday-head,
        body.light-theme .gcal-weekday-head {
          background: #ffffff !important;
          border-color: #cbd5e1 !important;
          color: #334155 !important;
        }
        .light-theme .gcal-day-cell,
        body.light-theme .gcal-day-cell {
          background: #ffffff !important;
          border-color: #cbd5e1 !important;
        }
        .light-theme .gcal-day-cell:hover,
        body.light-theme .gcal-day-cell:hover {
          border-color: #94a3b8 !important;
          background: #f8fafc !important;
        }
        .light-theme .gcal-day-cell.other-month,
        body.light-theme .gcal-day-cell.other-month {
          opacity: 0.45 !important;
          background: #f1f5f9 !important;
        }

        .light-theme .gcal-day-num,
        body.light-theme .gcal-day-num {
          color: #0f172a !important;
        }
        .light-theme .gcal-day-qty-badge,
        body.light-theme .gcal-day-qty-badge {
          background: #fff7ed !important;
          border-color: #fdba74 !important;
          color: #ea580c !important;
        }
        .light-theme .gcal-event-card,
        body.light-theme .gcal-event-card {
          background: #f1f5f9 !important;
          border-color: #cbd5e1 !important;
        }
        .light-theme .gcal-event-card:hover,
        body.light-theme .gcal-event-card:hover {
          background: #e2e8f0 !important;
          border-color: #94a3b8 !important;
        }
        .light-theme .gcal-event-num,
        body.light-theme .gcal-event-num {
          color: #d97706 !important;
        }
        /* Light theme overrides for Matrix View & Approvals Drawer */
        .light-theme .production-grid th,
        body.light-theme .production-grid th {
          background: #f1f5f9 !important;
          border-bottom-color: #cbd5e1 !important;
          border-right-color: #e2e8f0 !important;
          color: #0f172a !important;
        }
        .light-theme .sticky-col-strategic,
        body.light-theme .sticky-col-strategic {
          background: #ffffff !important;
          border-right-color: #cbd5e1 !important;
        }
        .light-theme thead th.sticky-col-strategic,
        body.light-theme thead th.sticky-col-strategic {
          background: #f1f5f9 !important;
          border-bottom-color: #cbd5e1 !important;
          border-right-color: #cbd5e1 !important;
          color: #0f172a !important;
        }
        .light-theme .date-col,
        body.light-theme .date-col {
          background: #ffffff !important;
        }
        .light-theme .day-num-small,
        body.light-theme .day-num-small {
          color: #0f172a !important;
        }
        .light-theme .day-name-small,
        body.light-theme .day-name-small {
          color: #64748b !important;
        }
        .light-theme .analysis-cell,
        body.light-theme .analysis-cell {
          border-bottom-color: #e2e8f0 !important;
          border-right-color: #e2e8f0 !important;
          background: #ffffff !important;
        }
        .light-theme .analysis-cell:hover,
        body.light-theme .analysis-cell:hover {
          background: #f8fafc !important;
        }
        .light-theme .matrix-row.is-today .date-col,
        body.light-theme .matrix-row.is-today .date-col {
          background: #fff7ed !important;
          border-right-color: #ff9000 !important;
        }
        .light-theme .matrix-row.is-today .day-num-small,
        body.light-theme .matrix-row.is-today .day-num-small {
          color: #ea580c !important;
        }
        .light-theme .matrix-row.is-weekend .date-col,
        body.light-theme .matrix-row.is-weekend .date-col {
          background: #fff1f2 !important;
        }
        .light-theme .matrix-row.is-weekend .day-name-small,
        body.light-theme .matrix-row.is-weekend .day-name-small {
          color: #e11d48 !important;
        }
        .light-theme .strategic-footer tr td,
        body.light-theme .strategic-footer tr td {
          background: #f1f5f9 !important;
          border-top-color: #cbd5e1 !important;
          border-right-color: #e2e8f0 !important;
          color: #0f172a !important;
        }
        .light-theme .footer-label-cell,
        body.light-theme .footer-label-cell {
          color: #475569 !important;
        }
        .light-theme .drawer-overlay,
        body.light-theme .drawer-overlay {
          background: rgba(15, 23, 42, 0.4) !important;
        }
        .light-theme .drawer-content,
        body.light-theme .drawer-content {
          background: #ffffff !important;
          border-left-color: #cbd5e1 !important;
          color: #0f172a !important;
          box-shadow: -10px 0 40px rgba(15, 23, 42, 0.15) !important;
        }
        .light-theme .drawer-header,
        body.light-theme .drawer-header {
          border-bottom-color: #e2e8f0 !important;
        }
        .light-theme .header-title h3,
        body.light-theme .header-title h3 {
          color: #0f172a !important;
        }
        .light-theme .approval-card,
        body.light-theme .approval-card {
          background: #f8fafc !important;
          border-color: #cbd5e1 !important;
          color: #0f172a !important;
        }
        .light-theme .order-label,
        body.light-theme .order-label {
          color: #64748b !important;
        }
        .light-theme .order-num,
        body.light-theme .order-num {
          color: #0f172a !important;
        }
        .light-theme .order-cust,
        body.light-theme .order-cust {
          color: #475569 !important;
        }
        .light-theme .order-time,
        body.light-theme .order-time {
          color: #64748b !important;
        }
        .light-theme .order-product-badge-block,
        body.light-theme .order-product-badge-block {
          background: #fff7ed !important;
          border-color: #fed7aa !important;
        }
        .light-theme .opbb-name,
        body.light-theme .opbb-name {
          color: #0f172a !important;
        }
        .light-theme .check-item.pending,
        body.light-theme .check-item.pending {
          background: #ffffff !important;
          color: #64748b !important;
          border-color: #cbd5e1 !important;
        }
        .light-theme .gcal-event-prod,
        body.light-theme .gcal-event-prod {
          color: #0f172a !important;
        }
        .light-theme .gcal-event-cust,
        body.light-theme .gcal-event-cust {
          color: #475569 !important;
        }

        @media (max-width: 768px) {
          .drawer-content { width: 100%; }
          .modal-content { width: 95vw; max-width: 95vw; border-radius: 20px; }
          .matrix-container { padding: 10px; }
          .sticky-col-strategic { width: 60px; min-width: 60px; }
          .day-num-small { font-size: 0.95rem; }
          
          /* Navigation Bar optimization */
          .glass-nav-director {
            padding: 0 15px 0 75px !important;
            height: 70px;
          }
          .brand-group { gap: 8px; }
          .brand-group h1 { font-size: 1rem !important; }
          .brand-group h1 .text-dim { display: none !important; }
          .brand-group svg { width: 20px; height: 20px; }
          
          /* Confirm button in nav always visible & compact */
          .btn-notifications {
            min-width: auto !important;
            padding: 8px 12px !important;
            border-radius: 10px;
            gap: 8px !important;
          }
          .btn-notifications .btn-label {
            display: inline-block !important;
            font-size: 0.7rem !important;
          }
          
          /* Strategic Header (Calendar & Meta) */
          .strategic-header {
            height: auto;
            min-height: auto;
            padding: 12px 15px !important;
            flex-direction: column;
            gap: 12px;
            align-items: stretch;
            border-bottom: 1px solid #222;
          }
          .month-selector-group {
            justify-content: space-between;
            width: 100%;
          }
          .month-info-badge {
            padding: 6px 16px;
            font-size: 0.9rem;
          }
          .month-name-compact, .year-val-compact {
            font-size: 0.9rem;
          }
          .header-meta-actions {
            justify-content: space-between;
            width: 100%;
            gap: 10px;
          }
          .analysis-summary-mini {
            font-size: 0.7rem;
          }

          .google-calendar-container {
            padding: 10px;
          }
          .gcal-month-grid {
            grid-auto-rows: minmax(90px, 1fr);
            gap: 4px;
          }
          .gcal-day-cell {
            padding: 6px;
            min-height: 90px;
          }

          /* Table details modal stacking */
          .dossier-main-grid {
            grid-template-columns: 1fr !important;
            height: auto;
          }
          .order-dossier-dashboard {
            height: 80vh;
          }
          .dossier-left, .dossier-right {
            padding: 15px !important;
            overflow-y: visible;
          }
          
          /* Adjust cells spacing */
          .product-head {
            width: 200px;
            min-width: 200px;
          }
          .product-name-horizontal {
            font-size: 0.8rem;
          }
        }
      `}} />
    </div>
  )
}

export default DirectorModule

