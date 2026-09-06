import React from 'react'

export const ShiftCalendarView = ({
  currentYear,
  currentMonth,
  monthNames,
  weekDayNames,
  daysInMonth,
  handleMonthChange,
  handleToggleDayShift,
  categorizedCalendarUsers,
  openAccordions,
  toggleAccordion,
  masterCheckins,
  operatorCheckins,
  formatUserName
}) => {
  const renderCalendarRow = (user) => {
    const initials = `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}`.toUpperCase() || '?'
    const isMaster = ['начальник', 'майстер', 'мастер', 'керівник'].some(kw => String(user.position || '').toLowerCase().includes(kw))
    const uName = formatUserName(user)

    return (
      <tr key={user.id} className="calendar-user-row" style={{
        borderBottom: '1px solid rgba(255,255,255,0.01)',
        transition: 'background 0.2s',
        background: isMaster ? 'rgba(234,179,8,0.02)' : 'transparent'
      }}>
        <td className={`sticky-user-cell ${isMaster ? 'master' : ''}`} style={{
          padding: '10px 16px',
          fontWeight: 800,
          position: 'sticky',
          left: 0,
          zIndex: 9,
          borderRight: '1px solid #1a1a1a'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '28px',
              height: '28px',
              borderRadius: '8px',
              background: isMaster ? 'linear-gradient(135deg, #ff9000, #ff5500)' : 'linear-gradient(135deg, #eab308, #ca8a04)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#000',
              fontWeight: 900,
              fontSize: '0.7rem'
            }}>
              {initials}
            </div>
            <div>
              <div className={`user-name ${isMaster ? 'master' : ''}`} style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
                {uName} {isMaster && <span style={{ fontSize: '0.6rem', background: '#ff9000', color: '#000', padding: '1px 4px', borderRadius: '4px', fontWeight: 900 }}>M</span>}
              </div>
              <div className="user-position" style={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', marginTop: '2px' }}>{user.position || 'Робітник'}</div>
            </div>
          </div>
        </td>

        {Array.from({ length: daysInMonth }).map((_, dayIdx) => {
          const day = dayIdx + 1
          const calendarKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`

          const status = user.shift_calendar?.[calendarKey]

          const hasCheckins = isMaster
            ? masterCheckins[uName]?.[calendarKey]
            : operatorCheckins[uName]?.[calendarKey]

          let bg = 'rgba(255,255,255,0.01)'
          let color = '#333'
          let borderStyle = '1px solid rgba(255,255,255,0.03)'

          if (status === 'Р') { bg = '#22c55e'; color = '#000' }
          else if (status === 'В') { bg = '#3b82f6'; color = '#fff' }
          else if (status === 'Л') { bg = '#ef4444'; color = '#fff' }
          else if (hasCheckins) {
            bg = 'rgba(34, 197, 94, 0.15)'
            color = '#22c55e'
            borderStyle = '1px dashed #22c55e'
          }

          let finalBorder = borderStyle
          if (status && hasCheckins) {
            finalBorder = '2px dashed #22c55e'
          }

          return (
            <td key={dayIdx}
              onClick={() => handleToggleDayShift(user, day)}
              style={{
                padding: '8px 4px',
                textAlign: 'center',
                cursor: 'pointer',
                borderRight: '1px solid rgba(255,255,255,0.01)',
                transition: 'all 0.15s'
              }}
            >
              <div className="calendar-day-badge" style={{
                background: bg,
                color: color,
                borderRadius: '6px',
                width: '24px',
                height: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.68rem',
                fontWeight: 900,
                margin: '0 auto',
                border: finalBorder,
                position: 'relative'
              }} title={hasCheckins ? `Зафіксовано роботу по картках!${status ? ` (За планом: ${status})` : ''}` : ""}>
                {status || (hasCheckins ? '✓' : day)}
                {status && hasCheckins && (
                  <span style={{
                    position: 'absolute',
                    bottom: '-4px',
                    right: '-4px',
                    background: '#22c55e',
                    color: '#000',
                    borderRadius: '50%',
                    width: '10px',
                    height: '10px',
                    fontSize: '0.55rem',
                    fontWeight: 950,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid #000'
                  }}>✓</span>
                )}
              </div>
            </td>
          )
        })}
      </tr>
    )
  }

  return (
    <div className="shift-calendar-view" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header controls */}
      <div className="calendar-header-controls" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={() => handleMonthChange('prev')} className="month-nav-btn">←</button>
          <h2 className="calendar-month-title" style={{ fontSize: '1.1rem', fontWeight: 950, margin: 0, minWidth: '150px', textAlign: 'center' }}>
            {monthNames[currentMonth]} {currentYear}
          </h2>
          <button onClick={() => handleMonthChange('next')} className="month-nav-btn">→</button>
        </div>

        {/* Legend */}
        <div className="calendar-legend" style={{ display: 'flex', gap: '12px', alignItems: 'center', fontSize: '0.68rem', fontWeight: 800 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: 14, height: 14, borderRadius: '4px', background: '#22c55e', display: 'inline-block' }} /> Робочий (Р)</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: 14, height: 14, borderRadius: '4px', background: '#3b82f6', display: 'inline-block' }} /> Вихідний (В)</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: 14, height: 14, borderRadius: '4px', background: '#ef4444', display: 'inline-block' }} /> Лікарняний (Л)</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: 14, height: 14, borderRadius: '4px', background: 'rgba(34, 197, 94, 0.15)', border: '1px dashed #22c55e', display: 'inline-block' }} /> Працював по факту (✓)</span>
        </div>
      </div>

      {/* Calendar Grid organized by Shifts */}
      <div className="calendar-grid-wrapper" style={{ overflowX: 'auto', borderRadius: '24px', maxHeight: '75vh' }}>
        <table className="shift-calendar-table" style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: '0.75rem', textAlign: 'left', minWidth: '800px' }}>
          <thead>
            <tr className="calendar-table-head-row" style={{ position: 'sticky', top: 0, zIndex: 12 }}>
              <th className="sticky-head-cell" style={{ padding: '16px', fontWeight: 900, width: '220px', position: 'sticky', left: 0, zIndex: 13 }}>Співробітник / Категорія</th>
              {Array.from({ length: daysInMonth }).map((_, idx) => (
                <th key={idx} style={{
                  padding: '12px 6px',
                  fontWeight: 900,
                  textAlign: 'center',
                  minWidth: '32px'
                }}>
                  <div>{idx + 1}</div>
                  <div style={{ fontSize: '0.58rem', fontWeight: 700, marginTop: '2px' }}>
                    {weekDayNames[new Date(currentYear, currentMonth, idx + 1).getDay()]}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {categorizedCalendarUsers.map(group => {
              const isOpen = openAccordions[group.title] !== false
              return (
                <React.Fragment key={group.title}>
                  <tr
                    onClick={() => toggleAccordion(group.title)}
                    className="accordion-row"
                    style={{ cursor: 'pointer', userSelect: 'none' }}
                  >
                    <td colSpan={daysInMonth + 1} className="accordion-cell" style={{
                      padding: '10px 16px',
                      fontWeight: 900,
                      fontSize: '0.8rem',
                      position: 'sticky',
                      left: 0,
                      zIndex: 10
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>{isOpen ? '▼' : '►'}</span>
                        <span>{group.title}</span>
                        <span className="accordion-count" style={{ fontSize: '0.68rem', fontWeight: 700 }}>({group.users.length} ос.)</span>
                      </div>
                    </td>
                  </tr>

                  {isOpen && group.users.map(user => renderCalendarRow(user))}
                </React.Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
