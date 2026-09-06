import React from 'react'

export const ProductionMatrixView = ({
  activeProducts,
  daysInMonth,
  matrixData,
  hoveredPid,
  setHoveredPid,
  setSelectedCell,
  setSelectedOrderId
}) => {
  return (
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
              const isToday = day.isToday
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

                    let intensity = 0
                    if (totalQty > 0) {
                      intensity = Math.min(0.2 + (totalQty / 500) * 0.8, 1)
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
  )
}
