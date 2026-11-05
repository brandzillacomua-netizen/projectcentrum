import React, { useState, useMemo } from 'react'
import {
  Truck,
  AlertTriangle,
  Clock,
  Package,
  Check,
  Layers,
  Filter,
  ListFilter,
  Calendar as CalendarIcon,
  ChevronRight
} from 'lucide-react'

export const GoogleCalendarView = ({
  calendarGridDays,
  calendarEventsByDate,
  setSelectedCell,
  setSelectedOrderId
}) => {
  const [activeFilter, setActiveFilter] = useState('all')
  const [mobileCalendarMode, setMobileCalendarMode] = useState('calendar') // 'calendar' (phone style) | 'agenda' (all list) | 'grid'
  const [selectedDateKey, setSelectedDateKey] = useState('')

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

  // Active selected date for the phone calendar
  const activeDateKey = useMemo(() => {
    if (selectedDateKey) {
      const existsInCurrentMonth = calendarGridDays.some(c => c.isCurrentMonth && c.dateKey === selectedDateKey)
      if (existsInCurrentMonth) return selectedDateKey
    }

    // Default to today if in current month
    const todayCell = calendarGridDays.find(c => c.isCurrentMonth && c.isToday)
    if (todayCell?.dateKey) return todayCell.dateKey

    // Otherwise first day with events
    const firstWithEvents = calendarGridDays.find(c => c.isCurrentMonth && (calendarEventsByDate[c.dateKey] || []).length > 0)
    if (firstWithEvents?.dateKey) return firstWithEvents.dateKey

    // Fallback to first day of month
    const firstDay = calendarGridDays.find(c => c.isCurrentMonth)
    return firstDay?.dateKey || ''
  }, [calendarGridDays, selectedDateKey, calendarEventsByDate])

  // Selected day details for the phone calendar view
  const selectedDayCell = useMemo(() => {
    return calendarGridDays.find(c => c.dateKey === activeDateKey && c.isCurrentMonth) || null
  }, [calendarGridDays, activeDateKey])

  const selectedDayEvents = useMemo(() => {
    if (!activeDateKey) return []
    const rawEvents = calendarEventsByDate[activeDateKey] || []
    return rawEvents.filter(evt => {
      if (activeFilter === 'all') return true
      if (activeFilter === 'overdue') return evt.deliveryStatus === 'overdue'
      if (activeFilter === 'due-today') return evt.deliveryStatus === 'due-today'
      if (activeFilter === 'in-progress') return evt.deliveryStatus === 'in-progress'
      if (activeFilter === 'shipped') return evt.deliveryStatus === 'shipped-ontime' || evt.deliveryStatus === 'shipped-late'
      return true
    })
  }, [activeDateKey, calendarEventsByDate, activeFilter])

  const selectedDayMeta = useMemo(() => {
    if (!activeDateKey) return { dayNum: '', title: '', weekday: '', isToday: false, totalQty: 0, hasOverdue: false, isAllShipped: false }
    try {
      const d = new Date(activeDateKey)
      const dayNum = d.getDate()
      const monthName = d.toLocaleDateString('uk-UA', { month: 'long' })
      const weekday = d.toLocaleDateString('uk-UA', { weekday: 'long' })
      const capWeekday = weekday.charAt(0).toUpperCase() + weekday.slice(1)
      const isToday = selectedDayCell?.isToday || false
      const rawEvents = calendarEventsByDate[activeDateKey] || []
      const totalQty = rawEvents.reduce((acc, e) => acc + (Number(e.qty) || 0), 0)
      const hasOverdue = rawEvents.some(e => e.deliveryStatus === 'overdue')
      const isAllShipped = rawEvents.length > 0 && rawEvents.every(e => e.deliveryStatus === 'shipped-ontime' || e.deliveryStatus === 'shipped-late')

      return {
        dayNum,
        title: `${dayNum} ${monthName}`,
        weekday: capWeekday,
        isToday,
        totalQty,
        hasOverdue,
        isAllShipped
      }
    } catch {
      return { dayNum: '', title: activeDateKey, weekday: '', isToday: false, totalQty: 0, hasOverdue: false, isAllShipped: false }
    }
  }, [activeDateKey, selectedDayCell, calendarEventsByDate])

  const formatCompactQty = (num) => {
    if (!num) return ''
    if (num >= 1000) {
      const k = (num / 1000).toFixed(1).replace('.0', '')
      return `${k}k`
    }
    return String(num)
  }

  // Agenda days for mobile list view
  const agendaDays = useMemo(() => {
    return calendarGridDays
      .filter(cell => cell.isCurrentMonth)
      .map(cell => {
        const rawEvents = calendarEventsByDate[cell.dateKey] || []
        const dayEvents = rawEvents.filter(evt => {
          if (activeFilter === 'all') return true
          if (activeFilter === 'overdue') return evt.deliveryStatus === 'overdue'
          if (activeFilter === 'due-today') return evt.deliveryStatus === 'due-today'
          if (activeFilter === 'in-progress') return evt.deliveryStatus === 'in-progress'
          if (activeFilter === 'shipped') return evt.deliveryStatus === 'shipped-ontime' || evt.deliveryStatus === 'shipped-late'
          return true
        })

        const totalDayQty = rawEvents.reduce((acc, e) => acc + (Number(e.qty) || 0), 0)
        const hasOverdueInDay = rawEvents.some(e => e.deliveryStatus === 'overdue')
        const isAllShippedInDay = rawEvents.length > 0 && rawEvents.every(e => e.deliveryStatus === 'shipped-ontime' || e.deliveryStatus === 'shipped-late')

        let weekdayName = ''
        if (cell.dateKey) {
          try {
            const d = new Date(cell.dateKey)
            weekdayName = d.toLocaleDateString('uk-UA', { weekday: 'long' })
            weekdayName = weekdayName.charAt(0).toUpperCase() + weekdayName.slice(1)
          } catch {}
        }

        return {
          ...cell,
          weekdayName,
          dayEvents,
          totalDayQty,
          hasOverdueInDay,
          isAllShippedInDay
        }
      })
      .filter(cell => cell.dayEvents.length > 0 || (cell.isToday && activeFilter === 'all'))
  }, [calendarGridDays, calendarEventsByDate, activeFilter])

  return (
    <div className="google-calendar-container">
      {/* KPI & FILTER BAR */}
      <div className="gcal-kpi-bar">
        {/* On mobile: Phone Calendar vs All List vs Grid switch */}
        <div className="gcal-mobile-view-switch">
          <button
            className={`gcal-switch-btn ${mobileCalendarMode === 'calendar' ? 'active' : ''}`}
            onClick={() => setMobileCalendarMode('calendar')}
          >
            <CalendarIcon size={14} />
            <span>Календар дня</span>
          </button>
          <button
            className={`gcal-switch-btn ${mobileCalendarMode === 'agenda' ? 'active' : ''}`}
            onClick={() => setMobileCalendarMode('agenda')}
          >
            <ListFilter size={14} />
            <span>Всі списком ({kpi.total})</span>
          </button>
          <button
            className={`gcal-switch-btn ${mobileCalendarMode === 'grid' ? 'active' : ''}`}
            onClick={() => setMobileCalendarMode('grid')}
          >
            <Layers size={14} />
            <span>Сітка</span>
          </button>
        </div>

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
            <span>Фільтр: показуються лише вибрані замовлення</span>
            <button className="gcal-btn-reset-filter" onClick={() => setActiveFilter('all')}>
              Скинути
            </button>
          </div>
        )}
      </div>

      {/* ── PHONE CALENDAR VIEW: COMPACT MONTH GRID + SELECTED DAY'S ORDERS ── */}
      <div className={`phone-calendar-view ${mobileCalendarMode === 'calendar' ? 'is-visible-mobile' : 'is-hidden-mobile'}`}>
        <div className="phone-cal-widget">
          <div className="phone-cal-weekdays">
            {['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'НД'].map((dayName, idx) => (
              <div key={dayName} className={`phone-cal-weekday ${idx >= 5 ? 'weekend' : ''}`}>
                {dayName}
              </div>
            ))}
          </div>

          <div className="phone-cal-grid">
            {calendarGridDays.map((cell, idx) => {
              const rawEvents = calendarEventsByDate[cell.dateKey] || []
              const totalDayQty = rawEvents.reduce((acc, e) => acc + (Number(e.qty) || 0), 0)
              const hasOverdue = cell.isCurrentMonth && rawEvents.some(e => e.deliveryStatus === 'overdue')
              const hasToday = cell.isCurrentMonth && rawEvents.some(e => e.deliveryStatus === 'due-today')
              const hasProgress = cell.isCurrentMonth && rawEvents.some(e => e.deliveryStatus === 'in-progress')
              const hasShipped = cell.isCurrentMonth && rawEvents.some(e => e.deliveryStatus === 'shipped-ontime' || e.deliveryStatus === 'shipped-late')
              const isSelected = cell.isCurrentMonth && cell.dateKey === activeDateKey

              return (
                <button
                  key={idx}
                  type="button"
                  className={`phone-cal-cell ${!cell.isCurrentMonth ? 'other-month' : ''} ${cell.isToday ? 'is-today' : ''} ${cell.isWeekend ? 'weekend' : ''} ${isSelected ? 'is-selected' : ''}`}
                  onClick={() => {
                    if (cell.dateKey) setSelectedDateKey(cell.dateKey)
                  }}
                >
                  <span className="phone-cal-num">{cell.day}</span>

                  <div className="phone-cal-dots">
                    {hasOverdue && <span className="p-dot dot-overdue" />}
                    {hasToday && <span className="p-dot dot-today" />}
                    {hasProgress && <span className="p-dot dot-progress" />}
                    {hasShipped && <span className="p-dot dot-shipped" />}
                  </div>

                  {totalDayQty > 0 && cell.isCurrentMonth && (
                    <span className="phone-cal-qty-pill">
                      {formatCompactQty(totalDayQty)}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Selected day's orders section */}
        <div className="phone-day-details-panel">
          <div className="phone-day-details-header">
            <div className="phone-day-header-left">
              <span className={`phone-day-badge ${selectedDayMeta.isToday ? 'today-badge' : ''}`}>
                {selectedDayMeta.dayNum || '—'}
              </span>
              <div className="phone-day-header-text">
                <span className="phone-day-title">{selectedDayMeta.title}</span>
                <span className="phone-day-weekday">{selectedDayMeta.weekday}</span>
              </div>
            </div>

            <div className="phone-day-header-right">
              {selectedDayMeta.isToday && (
                <span className="today-label">СЬОГОДНІ</span>
              )}
              {selectedDayMeta.hasOverdue && (
                <span className="gcal-agenda-overdue-tag">⚠️ Прострочено</span>
              )}
              {selectedDayMeta.totalQty > 0 && (
                <span className={`gcal-day-qty-badge ${selectedDayMeta.isAllShipped ? 'all-shipped' : ''}`}>
                  {selectedDayMeta.isAllShipped && <Check size={11} style={{ marginRight: '3px' }} />}
                  {selectedDayMeta.totalQty.toLocaleString()} шт
                </span>
              )}
            </div>
          </div>

          {selectedDayEvents.length === 0 ? (
            <div className="phone-day-empty">
              <CalendarIcon size={32} color="#52525b" />
              <p>Замовлень на цей день не заплановано</p>
              {!selectedDayMeta.isToday && (
                <button
                  type="button"
                  className="btn-jump-today"
                  style={{ alignSelf: 'center', marginTop: '4px' }}
                  onClick={() => {
                    const todayCell = calendarGridDays.find(c => c.isCurrentMonth && c.isToday)
                    if (todayCell?.dateKey) setSelectedDateKey(todayCell.dateKey)
                  }}
                >
                  <Clock size={13} />
                  <span>Перейти до сьогодні</span>
                </button>
              )}
            </div>
          ) : (
            <div className="phone-day-cards-list">
              {selectedDayEvents.map((evt, eIdx) => {
                const status = evt.deliveryStatus || 'in-progress'
                const isShipped = status === 'shipped-ontime' || status === 'shipped-late'
                const isOverdue = status === 'overdue'
                const isToday = status === 'due-today'

                return (
                  <div
                    key={eIdx}
                    className={`gcal-agenda-card status-${status}`}
                    onClick={() => {
                      if (selectedDayCell) {
                        setSelectedCell({ day: { day: selectedDayCell.day, fullDate: selectedDayCell.dateKey }, orders: selectedDayEvents })
                      }
                      setSelectedOrderId(evt.id)
                    }}
                  >
                    <div className="gcal-agenda-card-head">
                      <div className="gcal-agenda-card-num-group">
                        <span className="gcal-event-num">#{evt.orderNum}</span>
                        <span className="gcal-agenda-card-qty">{evt.qty} шт</span>
                      </div>

                      <div className="gcal-agenda-status-pill">
                        {isShipped ? (
                          <span className="pill-shipped"><Truck size={12} /> Відправлено</span>
                        ) : isOverdue ? (
                          <span className="pill-overdue"><AlertTriangle size={12} /> +{evt.daysDiff || 1}д</span>
                        ) : isToday ? (
                          <span className="pill-today"><Clock size={12} /> Сьогодні</span>
                        ) : (
                          <span className="pill-progress"><Package size={12} /> В роботі</span>
                        )}
                      </div>
                    </div>

                    <div className="gcal-agenda-card-prod">{evt.productName}</div>
                    <div className="gcal-agenda-card-cust">{evt.customer}</div>

                    <div className="gcal-agenda-card-footer">
                      <div className="gcal-progress-wrap" style={{ flex: 1 }}>
                        <div className="gcal-progress-track">
                          <div
                            className={`gcal-progress-fill fill-${status}`}
                            style={{ width: `${Math.max(5, evt.progressPercent || (isShipped ? 100 : 25))}%` }}
                          />
                        </div>
                        <span className="gcal-progress-label">
                          {isShipped ? '✓ Готово' : `${evt.progressPercent || 30}%`}
                        </span>
                      </div>
                      <ChevronRight size={16} className="gcal-agenda-arrow" />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* MOBILE AGENDA VIEW */}
      <div className={`gcal-agenda-view ${mobileCalendarMode === 'agenda' ? 'is-visible-mobile' : 'is-hidden-mobile'}`}>
        {agendaDays.length === 0 ? (
          <div className="gcal-agenda-empty">
            <Package size={36} color="#71717a" />
            <p>За обраним фільтром замовлень у цьому місяці немає</p>
            {activeFilter !== 'all' && (
              <button className="gcal-btn-reset-filter" onClick={() => setActiveFilter('all')}>
                Показати всі замовлення
              </button>
            )}
          </div>
        ) : (
          agendaDays.map(cell => (
            <div
              key={cell.dateKey || cell.day}
              className={`gcal-agenda-day-block ${cell.isToday ? 'is-today' : ''} ${cell.hasOverdueInDay ? 'has-overdue' : ''}`}
            >
              <div className="gcal-agenda-day-header">
                <div className="gcal-agenda-date-info">
                  <span className={`gcal-agenda-day-badge ${cell.isToday ? 'today-badge' : ''}`}>
                    {cell.day}
                  </span>
                  <div className="gcal-agenda-day-titles">
                    <span className="gcal-agenda-weekday">{cell.weekdayName}</span>
                    {cell.isToday && <span className="today-label">СЬОГОДНІ</span>}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {cell.hasOverdueInDay && (
                    <span className="gcal-agenda-overdue-tag">⚠️ Прострочено</span>
                  )}
                  {cell.totalDayQty > 0 && (
                    <span className={`gcal-day-qty-badge ${cell.isAllShippedInDay ? 'all-shipped' : ''}`}>
                      {cell.isAllShippedInDay && <Check size={11} style={{ marginRight: '3px' }} />}
                      {cell.totalDayQty.toLocaleString()} шт
                    </span>
                  )}
                </div>
              </div>

              {cell.dayEvents.length === 0 ? (
                <div className="gcal-agenda-no-orders">
                  <span>Немає запланованих замовлень на цей день</span>
                </div>
              ) : (
                <div className="gcal-agenda-cards-list">
                  {cell.dayEvents.map((evt, eIdx) => {
                    const status = evt.deliveryStatus || 'in-progress'
                    const isShipped = status === 'shipped-ontime' || status === 'shipped-late'
                    const isOverdue = status === 'overdue'
                    const isToday = status === 'due-today'

                    return (
                      <div
                        key={eIdx}
                        className={`gcal-agenda-card status-${status}`}
                        onClick={() => {
                          setSelectedCell({ day: { day: cell.day, fullDate: cell.dateKey }, orders: cell.dayEvents })
                          setSelectedOrderId(evt.id)
                        }}
                      >
                        <div className="gcal-agenda-card-head">
                          <div className="gcal-agenda-card-num-group">
                            <span className="gcal-event-num">#{evt.orderNum}</span>
                            <span className="gcal-agenda-card-qty">{evt.qty} шт</span>
                          </div>

                          <div className="gcal-agenda-status-pill">
                            {isShipped ? (
                              <span className="pill-shipped"><Truck size={12} /> Відправлено</span>
                            ) : isOverdue ? (
                              <span className="pill-overdue"><AlertTriangle size={12} /> +{evt.daysDiff || 1}д</span>
                            ) : isToday ? (
                              <span className="pill-today"><Clock size={12} /> Сьогодні</span>
                            ) : (
                              <span className="pill-progress"><Package size={12} /> В роботі</span>
                            )}
                          </div>
                        </div>

                        <div className="gcal-agenda-card-prod">{evt.productName}</div>
                        <div className="gcal-agenda-card-cust">{evt.customer}</div>

                        <div className="gcal-agenda-card-footer">
                          <div className="gcal-progress-wrap" style={{ flex: 1 }}>
                            <div className="gcal-progress-track">
                              <div
                                className={`gcal-progress-fill fill-${status}`}
                                style={{ width: `${Math.max(5, evt.progressPercent || (isShipped ? 100 : 25))}%` }}
                              />
                            </div>
                            <span className="gcal-progress-label">
                              {isShipped ? '✓ Готово' : `${evt.progressPercent || 30}%`}
                            </span>
                          </div>
                          <ChevronRight size={16} className="gcal-agenda-arrow" />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* MONTH GRID VIEW */}
      <div className={`gcal-grid-scroll-wrap ${mobileCalendarMode === 'grid' ? 'is-visible-mobile' : 'is-hidden-mobile'}`}>
        <div className="gcal-grid-mobile-hint">
          <span>← Прокручуйте дні горизонтально →</span>
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
    </div>
  )
}
