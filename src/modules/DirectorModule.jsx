import React, { useState, useMemo } from 'react'
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
import { apiService } from '../services/apiDispatcher'

const DirectorModule = () => {
  const { tasks, orders, approveDirector, nomenclatures, requests, workCards, workCardHistory, inventory } = useMES()
  const [viewDate, setViewDate] = useState(new Date())
  const [isApprovalsOpen, setIsApprovalsOpen] = useState(false)
  const [selectedCell, setSelectedCell] = useState(null)
  const [hoveredPid, setHoveredPid] = useState(null)
  const [selectedOrderId, setSelectedOrderId] = useState(null)
  const [expandedReqs, setExpandedReqs] = useState({})
  const [expandedNaryads, setExpandedNaryads] = useState({})

  const toggleReq = (id) => {
    setExpandedReqs(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const toggleNaryad = (id) => {
    setExpandedNaryads(prev => ({ ...prev, [id]: !prev[id] }))
  }

  // 1. Pending Approvals Data (Only trigger when it's Director's turn)
  const pendingTasks = tasks.filter(t => 
    t.status === 'waiting' && 
    t.warehouse_conf === true && 
    t.engineer_conf === true && 
    !t.director_conf
  )
  const approvedCount = tasks.filter(t => t.status === 'waiting' && t.director_conf).length

  // 2. Matrix Data Preparation
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
    return nomenclatures.filter(n => n.type === 'product' && productIdsInOrders.has(n.id))
  }, [orders, nomenclatures])

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

    // Step 1: Process Orders (Remaining Balance)
    orders.forEach(o => {
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
    tasks.filter(t => t.step === 'Лазерний розкрій' || t.step === 'Лазерна різка').forEach(t => {
      const taskDeadline = toLocalISO(t.planned_deadline || t.created_at)
      if (!taskDeadline) return
      
      const order = orders.find(o => String(o.id) === String(t.order_id))
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
  }, [orders, tasks])

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

                        // Heatmap logic: intensity based on quantity
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
                              verticalAlign: 'top' // To align lists to the top
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
                const order = orders.find(o => o.id === task.order_id)
                const isSkladOk = task.warehouse_conf === true
                const isEngOk = task.engineer_conf === true

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

                    <div className="checks-grid">
                      <div className={`check-item ${isSkladOk ? 'ok' : 'pending'}`}>
                        <Warehouse size={18} />
                        <span>СКЛАД</span>
                        {isSkladOk && <CheckCircle2 size={12} />}
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
          background: #050505; height: 100vh; color: #fff;
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
          padding: 0 40px; height: var(--nav-h); min-height: var(--nav-h); background: #050505;
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
        .order-dossier-dashboard { height: 80vh; overflow-y: auto; display: flex; flex-direction: column; background: #050505; }
        .dossier-main-grid { display: grid; grid-template-columns: 400px 1fr; gap: 2px; background: #111; flex: 1; }
        .dossier-left, .dossier-right { display: flex; flex-direction: column; gap: 2px; background: #050505; padding: 25px; overflow-y: auto; }
        
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

        @media (max-width: 768px) {
          .drawer-content { width: 100%; }
          .modal-content { width: 90%; }
          .matrix-container { padding: 15px; }
          .sticky-col { width: 60px; min-width: 60px; }
          .day-num { font-size: 0.9rem; }
        }
      `}} />
    </div>
  )
}

export default DirectorModule

