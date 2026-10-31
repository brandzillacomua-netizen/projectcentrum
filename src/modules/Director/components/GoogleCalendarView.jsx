import React, { useState, useMemo } from 'react'
import { Truck, AlertTriangle, Clock, Package, Check, Layers, Filter } from 'lucide-react'

export const GoogleCalendarView = ({
  calendarGridDays,
  calendarEventsByDate,
  setSelectedCell,
  setSelectedOrderId
}) => {
  const [activeFilter, setActiveFilter] = useState('all')

  // Calculate monthly KPIs strictly for the current month being viewed
  const kpi = useMemo(() => {
    let total = 0
    let overdue = 0
    let dueToday = 0
    let inProgress = 0
    let shipped = 0
    let totalQty = 0

    calendarGridDays.forEach(cell => {
      // Ignore trailing/leading days from other months in monthly analytics
      if (!cell.isCurrentMonth) return

      const events = calendarEventsByDate[cell.dateKey] || []
      events.forEach(evt => {
        total += 1
        totalQty += Number(evt.qty) || 0
        if (evt.deliveryStatus === 'overdue') overdue += 1
        else if (evt.deliveryStatus === 'due-today') dueToday += 1
        else if (evt.deliveryStatus === 'shipped-ontime' || evt.deliveryStatus === 'shipped-late') shipped += 1
        else inProgress += 1
      })
    })

    return { total, overdue, dueToday, inProgress, shipped, totalQty }
  }, [calendarGridDays, calendarEventsByDate])

  return (
    <div className="google-calendar-container">
      {/* KPI & FILTER BAR */}
      <div className="gcal-kpi-bar">
        <div className="gcal-kpi-filters">
          <button
            className={`gcal-filter-btn ${activeFilter === 'all' ? 'active' : ''}`}
            onClick={() => setActiveFilter('all')}
          >
            <Layers size={14} />
            <span>Всі замовлення</span>
            <span className="gcal-badge-count">{kpi.total}</span>
          </button>

          <button
            className={`gcal-filter-btn btn-overdue ${activeFilter === 'overdue' ? 'active' : ''}`}
            onClick={() => setActiveFilter(activeFilter === 'overdue' ? 'all' : 'overdue')}
          >
            <AlertTriangle size={14} className="text-red-400" />
            <span>Протерміновано</span>
            <span className="gcal-badge-count count-red">{kpi.overdue}</span>
          </button>

          <button
            className={`gcal-filter-btn btn-today ${activeFilter === 'due-today' ? 'active' : ''}`}
            onClick={() => setActiveFilter(activeFilter === 'due-today' ? 'all' : 'due-today')}
          >
            <Clock size={14} className="text-amber-400" />
            <span>Дедлайн сьогодні</span>
            <span className="gcal-badge-count count-amber">{kpi.dueToday}</span>
          </button>

          <button
            className={`gcal-filter-btn btn-progress ${activeFilter === 'in-progress' ? 'active' : ''}`}
            onClick={() => setActiveFilter(activeFilter === 'in-progress' ? 'all' : 'in-progress')}
          >
            <Package size={14} className="text-blue-400" />
            <span>У виробництві</span>
            <span className="gcal-badge-count count-blue">{kpi.inProgress}</span>
          </button>

          <button
            className={`gcal-filter-btn btn-shipped ${activeFilter === 'shipped' ? 'active' : ''}`}
            onClick={() => setActiveFilter(activeFilter === 'shipped' ? 'all' : 'shipped')}
          >
            <Truck size={14} className="text-emerald-400" />
            <span>Відправлено</span>
            <span className="gcal-badge-count count-green">{kpi.shipped}</span>
          </button>
        </div>

        {activeFilter !== 'all' && (
          <div className="gcal-active-filter-hint">
            <Filter size={12} />
            <span>Фільтр активний: показуються лише вибрані замовлення</span>
            <button className="gcal-btn-reset-filter" onClick={() => setActiveFilter('all')}>
              Скинути
            </button>
          </div>
        )}
      </div>

      <div className="gcal-weekdays-header">
        {['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'НД'].map((dayName, idx) => (
          <div key={dayName} className={`gcal-weekday-head ${idx >= 5 ? 'weekend' : ''}`}>
            {dayName}
          </div>
        ))}
      </div>

      <div className="gcal-month-grid">
        {calendarGridDays.map((cell, idx) => {
          const rawEvents = calendarEventsByDate[cell.dateKey] || []
          
          // Filter events if filter is active; if a specific filter is selected, don't show other-month events
          const dayEvents = rawEvents.filter(evt => {
            if (!cell.isCurrentMonth && activeFilter !== 'all') return false
            if (activeFilter === 'all') return true
            if (activeFilter === 'overdue') return evt.deliveryStatus === 'overdue'
            if (activeFilter === 'due-today') return evt.deliveryStatus === 'due-today'
            if (activeFilter === 'in-progress') return evt.deliveryStatus === 'in-progress'
            if (activeFilter === 'shipped') return evt.deliveryStatus === 'shipped-ontime' || evt.deliveryStatus === 'shipped-late'
            return true
          })

          const totalDayQty = rawEvents.reduce((acc, e) => acc + (Number(e.qty) || 0), 0)
          const hasOverdueInDay = cell.isCurrentMonth && rawEvents.some(e => e.deliveryStatus === 'overdue')
          const isAllShippedInDay = cell.isCurrentMonth && rawEvents.length > 0 && rawEvents.every(e => e.deliveryStatus === 'shipped-ontime' || e.deliveryStatus === 'shipped-late')

          return (
            <div
              key={idx}
              className={`gcal-day-cell ${!cell.isCurrentMonth ? 'other-month' : ''} ${cell.isToday ? 'today' : ''} ${cell.isWeekend ? 'weekend' : ''} ${hasOverdueInDay ? 'day-has-overdue' : ''}`}
              onClick={() => {
                if (dayEvents.length > 0) {
                  setSelectedCell({ day: { day: cell.day, fullDate: cell.dateKey }, orders: dayEvents })
                  if (dayEvents.length === 1) setSelectedOrderId(dayEvents[0].id)
                }
              }}
            >
              <div className="gcal-day-top">
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span className={`gcal-day-num ${cell.isToday ? 'today-badge' : ''}`}>
                    {cell.day}
                  </span>
                  {hasOverdueInDay && (
                    <span className="gcal-day-alert-dot" title="У цей день є прострочені замовлення!">
                      ⚠️
                    </span>
                  )}
                </div>

                {cell.isToday && <span className="today-label">СЬОГОДНІ</span>}

                {totalDayQty > 0 && (
                  <span className={`gcal-day-qty-badge ${isAllShippedInDay ? 'all-shipped' : ''}`}>
                    {isAllShippedInDay && <Check size={11} style={{ marginRight: '3px' }} />}
                    {totalDayQty.toLocaleString()} шт
                  </span>
                )}
              </div>

              <div className="gcal-events-list">
                {dayEvents.map((evt, eIdx) => {
                  const status = evt.deliveryStatus || 'in-progress'
                  const isShipped = status === 'shipped-ontime' || status === 'shipped-late'
                  const isOverdue = status === 'overdue'
                  const isToday = status === 'due-today'

                  return (
                    <div
                      key={eIdx}
                      className={`gcal-event-card status-${status}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedCell({ day: { day: cell.day, fullDate: cell.dateKey }, orders: dayEvents })
                        setSelectedOrderId(evt.id)
                      }}
                      title={`${evt.productName} (${evt.customer}) - ${isShipped ? 'Відправлено' : isOverdue ? 'Протерміновано' : 'В роботі'}`}
                    >
                      <div className="gcal-event-head">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', overflow: 'hidden' }}>
                          {isShipped ? (
                            <span className="gcal-icon-shipped" title="Відправлено клієнту">
                              <Truck size={12} />
                            </span>
                          ) : isOverdue ? (
                            <span className="gcal-icon-overdue" title="Дедлайн протерміновано!">
                              <AlertTriangle size={12} />
                            </span>
                          ) : isToday ? (
                            <span className="gcal-icon-today" title="Дедлайн сьогодні!">
                              <Clock size={12} />
                            </span>
                          ) : (
                            <span className="gcal-icon-progress" title="У виробництві">
                              <Package size={12} />
                            </span>
                          )}

                          <span className="gcal-event-num">#{evt.orderNum}</span>
                        </div>

                        <span className="gcal-event-qty">{evt.qty} шт</span>
                      </div>

                      <div className="gcal-event-prod">{evt.productName}</div>
                      <div className="gcal-event-cust">{evt.customer}</div>

                      {/* PROGRESS & STATUS FOOTER */}
                      <div className="gcal-event-footer">
                        <div className="gcal-progress-wrap">
                          <div className="gcal-progress-track">
                            <div
                              className={`gcal-progress-fill fill-${status}`}
                              style={{ width: `${Math.max(5, evt.progressPercent || (isShipped ? 100 : 25))}%` }}
                            />
                          </div>
                          <span className="gcal-progress-label">
                            {isShipped ? (
                              <span style={{ color: '#10b981', fontWeight: 800 }}>✓ Відправлено</span>
                            ) : isOverdue ? (
                              <span style={{ color: '#ef4444', fontWeight: 800 }}>
                                ⚠️ +{evt.daysDiff || 1}д
                              </span>
                            ) : isToday ? (
                              <span style={{ color: '#f59e0b', fontWeight: 800 }}>Сьогодні</span>
                            ) : (
                              <span>{evt.progressPercent || 30}%</span>
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
