import React from 'react'

export const GoogleCalendarView = ({
  calendarGridDays,
  calendarEventsByDate,
  setSelectedCell,
  setSelectedOrderId
}) => {
  return (
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
                        setSelectedCell({ day: { day: cell.day, fullDate: cell.dateKey }, orders: dayEvents })
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
  )
}
