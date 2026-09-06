import React from 'react'

export const DashboardWipMatrixTable = ({
  groupedDashboardData,
  getGroupTotals,
  totals
}) => {
  const renderValue = (val, type = 'normal', demand = 0) => {
    if (!val) val = 0;

    if (val === 0 && !demand) {
      return <span style={{ color: '#4b5563', fontWeight: 400, opacity: 0.5 }}>0</span>
    }
    let color = '#f3f4f6'
    let bg = 'transparent'
    let border = 'none'
    let padding = '2px 6px'
    let borderRadius = '4px'

    if (type === 'sum') {
      color = '#ff9000'
      bg = 'rgba(255, 144, 0, 0.08)'
      border = '1px solid rgba(255, 144, 0, 0.2)'
    } else if (type === 'sgp' || type === 'bz') {
      color = '#10b981'
      bg = 'rgba(16, 185, 129, 0.08)'
      border = '1px solid rgba(16, 185, 129, 0.2)'
    } else if (type === 'scrap') {
      color = '#ef4444'
      bg = 'rgba(239, 68, 68, 0.08)'
      border = '1px solid rgba(239, 68, 68, 0.2)'
    } else {
      bg = 'rgba(255, 255, 255, 0.04)'
      border = '1px solid rgba(255, 255, 255, 0.08)'
    }

    let displayVal = val;
    if (type === 'sum' && demand > 0) {
      displayVal = `${val} / ${demand}`;
    }

    return (
      <span className={`wip-cell-badge ${type}`} style={{
        fontWeight: 'bold',
        color,
        background: bg,
        border,
        padding,
        borderRadius,
        display: 'inline-block',
        minWidth: '24px',
        textAlign: 'center',
        whiteSpace: 'nowrap'
      }}>
        {displayVal}
      </span>
    )
  }

  return (
    <div className="wip-table-container" style={{ borderRadius: '16px', border: '1px solid var(--glass-border, #27272a)', background: 'var(--bg, #09090b)', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', padding: '1px' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'inherit', fontSize: '0.8rem', color: 'var(--text, #f4f4f5)' }}>
        <thead>
          <tr style={{ background: 'var(--card-bg, #18181b)', color: 'var(--text-muted, #a1a1aa)', textAlign: 'center', borderBottom: '2px solid #27272a' }}>
            <th className="wip-sticky-col" style={{ padding: '14px 18px', textAlign: 'left', fontWeight: 'bold', borderRight: '1px solid #27272a', color: 'var(--text, #f4f4f5)', position: 'sticky', top: 0, left: 0, zIndex: 40, background: 'var(--card-bg, #18181b)' }}>Номенклатура</th>
            <th className="wip-sticky-sum" style={{ padding: '14px 18px', fontWeight: 'bold', borderRight: '1px solid #27272a', background: '#251b14', color: '#ff9000', position: 'sticky', top: 0, zIndex: 40 }}>Сума</th>
            <th style={{ padding: '14px 18px', fontWeight: '500', borderRight: '1px solid #27272a', background: 'var(--card-bg, #18181b)', color: 'var(--text-muted, #a1a1aa)', position: 'sticky', top: 0, zIndex: 10 }}>Очікують Розкрою</th>
            <th style={{ padding: '14px 18px', fontWeight: '500', borderRight: '1px solid #27272a', position: 'sticky', top: 0, zIndex: 10, background: 'var(--card-bg, #18181b)' }}>Розкрій (Робота)</th>
            <th style={{ padding: '14px 18px', fontWeight: '500', borderRight: '1px solid #27272a', background: 'var(--card-bg, #18181b)', color: 'var(--text-muted, #a1a1aa)', position: 'sticky', top: 0, zIndex: 10 }}>Буфер Розкрою</th>
            <th style={{ padding: '14px 18px', fontWeight: '500', borderRight: '1px solid #27272a', position: 'sticky', top: 0, zIndex: 10, background: 'var(--card-bg, #18181b)' }}>Галтовка (Робота)</th>
            <th style={{ padding: '14px 18px', fontWeight: '500', borderRight: '1px solid #27272a', background: 'var(--card-bg, #18181b)', color: 'var(--text-muted, #a1a1aa)', position: 'sticky', top: 0, zIndex: 10 }}>Буфер Галтовки</th>
            <th style={{ padding: '14px 18px', fontWeight: '500', borderRight: '1px solid #27272a', position: 'sticky', top: 0, zIndex: 10, background: 'var(--card-bg, #18181b)' }}>Прийомка (Робота)</th>
            <th style={{ padding: '14px 18px', fontWeight: '500', borderRight: '1px solid #27272a', background: 'var(--card-bg, #18181b)', color: 'var(--text-muted, #a1a1aa)', position: 'sticky', top: 0, zIndex: 10 }}>Сортування (Робота)</th>
            <th style={{ padding: '14px 18px', fontWeight: '500', borderRight: '1px solid #27272a', background: 'var(--card-bg, #18181b)', color: 'var(--text-muted, #a1a1aa)', position: 'sticky', top: 0, zIndex: 10 }}>Буфер Цеху №2</th>
            <th style={{ padding: '14px 18px', fontWeight: '500', borderRight: '1px solid #27272a', background: 'var(--card-bg, #18181b)', color: 'var(--text-muted, #a1a1aa)', position: 'sticky', top: 0, zIndex: 10 }}>Очікують Малярки</th>
            <th style={{ padding: '14px 18px', fontWeight: '500', borderRight: '1px solid #27272a', position: 'sticky', top: 0, zIndex: 10, background: 'var(--card-bg, #18181b)' }}>Малярка (Робота)</th>
            <th style={{ padding: '14px 18px', fontWeight: '500', borderRight: '1px solid #27272a', background: 'var(--card-bg, #18181b)', color: 'var(--text-muted, #a1a1aa)', position: 'sticky', top: 0, zIndex: 10 }}>Буфер Малярки</th>
            <th style={{ padding: '14px 18px', fontWeight: '500', borderRight: '1px solid #27272a', position: 'sticky', top: 0, zIndex: 10, background: 'var(--card-bg, #18181b)' }}>Пресування (Робота)</th>
            <th style={{ padding: '14px 18px', fontWeight: '500', borderRight: '1px solid #27272a', background: 'var(--card-bg, #18181b)', color: 'var(--text-muted, #a1a1aa)', position: 'sticky', top: 0, zIndex: 10 }}>Буфер Пресування</th>
            <th style={{ padding: '14px 18px', fontWeight: '500', borderRight: '1px solid #27272a', position: 'sticky', top: 0, zIndex: 10, background: 'var(--card-bg, #18181b)' }}>Доопрацювання (Робота)</th>
            <th style={{ padding: '14px 18px', fontWeight: '500', borderRight: '1px solid #27272a', background: 'var(--card-bg, #18181b)', color: 'var(--text-muted, #a1a1aa)', position: 'sticky', top: 0, zIndex: 10 }}>Буфер Доопрацювання</th>
            <th style={{ padding: '14px 18px', fontWeight: 'bold', borderRight: '1px solid #27272a', background: '#12251e', color: '#10b981', position: 'sticky', top: 0, zIndex: 10 }}>Склад (СГП)</th>
            <th style={{ padding: '14px 18px', fontWeight: 'bold', borderRight: '1px solid #27272a', background: '#12251e', color: '#10b981', position: 'sticky', top: 0, zIndex: 10 }}>Склад БЗ</th>
            <th style={{ padding: '14px 18px', fontWeight: 'bold', background: '#221414', color: '#ef4444', position: 'sticky', top: 0, zIndex: 10 }}>Брак</th>
          </tr>
        </thead>
        <tbody>
          {groupedDashboardData.length === 0 ? (
            <tr>
              <td colSpan={20} style={{ padding: '40px', textAlign: 'center', color: '#71717a', fontStyle: 'italic', background: 'transparent' }}>
                Немає активних деталей за обраними фільтрами
              </td>
            </tr>
          ) : (
            groupedDashboardData.map(group => {
              const groupTotals = getGroupTotals(group.rows)

              return (
                <React.Fragment key={group.id}>
                  {/* Group Header Row */}
                  <tr className="wip-group-header-row" style={{ background: 'var(--bg, #1c1917)', color: '#fff', borderBottom: '2px solid #27272a' }}>
                    <td colSpan={20} style={{ padding: '14px 18px', textAlign: 'left', fontWeight: 'bold', borderBottom: '1px solid var(--glass-border, #27272a)', position: 'sticky', left: 0, background: 'var(--bg, #1c1917)', zIndex: 2 }}>
                      <div style={{ position: 'sticky', left: '16px', display: 'inline-flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px 12px', maxWidth: 'calc(100vw - 40px)' }}>
                        <span style={{ color: '#ff9000' }}>📦</span>
                        <span style={{ whiteSpace: 'nowrap' }}>{group.name}{group.code ? ` (${group.code})` : ''}</span>
                        {group.trend && (
                          <span style={{ color: 'var(--text-muted, #a1a1aa)', fontSize: '0.78rem', fontWeight: 'normal' }}>
                            (Потенційний тренд: <strong style={{ color: 'var(--text, #fff)' }}>{group.trend.potential}</strong> / {group.trend.demand || 0} компл. | На СГП: <strong style={{ color: '#10b981' }}>{group.trend.actual} компл.</strong>)
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>

                  {/* Group Row Items */}
                  {group.rows.map((row) => (
                    <tr key={row.id} className="wip-row">
                      <td className="wip-sticky-col" style={{ padding: '12px 18px', fontWeight: 'bold', color: 'var(--text, #f4f4f5)', borderRight: '1px solid #27272a', paddingLeft: '30px', position: 'sticky', left: 0, background: 'var(--bg, #09090b)', zIndex: 2 }}>
                        {row.name}
                        {row.code && <span style={{ display: 'block', fontSize: '0.72rem', color: '#71717a', fontWeight: 'normal', marginTop: '2px' }}>Код: {row.code}</span>}
                      </td>
                      <td className="wip-sticky-sum" style={{ padding: '12px 18px', textAlign: 'center', background: '#1c130d', borderRight: '1px solid #27272a', fontWeight: 'bold', position: 'sticky', zIndex: 2 }}>
                        {renderValue(row.sum, 'sum', row.demand)}
                      </td>
                      <td style={{ padding: '12px 18px', textAlign: 'center', borderRight: '1px solid #27272a', background: 'rgba(255, 255, 255, 0.01)' }}>{renderValue(row.qCutWait, 'normal')}</td>
                      <td style={{ padding: '12px 18px', textAlign: 'center', borderRight: '1px solid #27272a' }}>{renderValue(row.qCut, 'normal')}</td>
                      <td style={{ padding: '12px 18px', textAlign: 'center', borderRight: '1px solid #27272a', background: 'rgba(255, 255, 255, 0.01)' }}>{renderValue(row.qCutBuf, 'normal')}</td>
                      <td style={{ padding: '12px 18px', textAlign: 'center', borderRight: '1px solid #27272a' }}>{renderValue(row.qGalt, 'normal')}</td>
                      <td style={{ padding: '12px 18px', textAlign: 'center', borderRight: '1px solid #27272a', background: 'rgba(255, 255, 255, 0.01)' }}>{renderValue(row.qGaltBuf, 'normal')}</td>
                      <td style={{ padding: '12px 18px', textAlign: 'center', borderRight: '1px solid #27272a' }}>{renderValue(row.qPriy, 'normal')}</td>
                      <td style={{ padding: '12px 18px', textAlign: 'center', borderRight: '1px solid #27272a', background: 'rgba(255, 255, 255, 0.01)' }}>{renderValue(row.qSortAct, 'normal')}</td>
                      <td style={{ padding: '12px 18px', textAlign: 'center', borderRight: '1px solid #27272a', background: 'rgba(255, 255, 255, 0.01)' }}>{renderValue(row.qSort, 'normal')}</td>
                      <td style={{ padding: '12px 18px', textAlign: 'center', borderRight: '1px solid #27272a', background: 'rgba(255, 255, 255, 0.01)' }}>{renderValue(row.qMalWait, 'normal')}</td>
                      <td style={{ padding: '12px 18px', textAlign: 'center', borderRight: '1px solid #27272a' }}>{renderValue(row.qMal, 'normal')}</td>
                      <td style={{ padding: '12px 18px', textAlign: 'center', borderRight: '1px solid #27272a', background: 'rgba(255, 255, 255, 0.01)' }}>{renderValue(row.qMalBuf, 'normal')}</td>
                      <td style={{ padding: '12px 18px', textAlign: 'center', borderRight: '1px solid #27272a' }}>{renderValue(row.qPres, 'normal')}</td>
                      <td style={{ padding: '12px 18px', textAlign: 'center', borderRight: '1px solid #27272a', background: 'rgba(255, 255, 255, 0.01)' }}>{renderValue(row.qPresBuf, 'normal')}</td>
                      <td style={{ padding: '12px 18px', textAlign: 'center', borderRight: '1px solid #27272a' }}>{renderValue(row.qDoop, 'normal')}</td>
                      <td style={{ padding: '12px 18px', textAlign: 'center', borderRight: '1px solid #27272a', background: 'rgba(255, 255, 255, 0.01)' }}>{renderValue(row.qDoopBuf, 'normal')}</td>
                      <td style={{ padding: '12px 18px', textAlign: 'center', borderRight: '1px solid #27272a', background: 'rgba(16, 185, 129, 0.02)' }}>{renderValue(row.qSgp, 'sgp')}</td>
                      <td style={{ padding: '12px 18px', textAlign: 'center', background: 'rgba(16, 185, 129, 0.02)' }}>{renderValue(row.qBz, 'bz')}</td>
                      <td style={{ padding: '12px 18px', textAlign: 'center', background: 'rgba(239, 68, 68, 0.02)' }}>{renderValue(row.qScrap, 'scrap')}</td>
                    </tr>
                  ))}

                  {/* Group Subtotals */}
                  <tr className="wip-subtotal-row" style={{ background: '#121214', fontWeight: 'bold', borderTop: '1px solid #27272a', borderBottom: '1px solid var(--glass-border, #27272a)', color: 'var(--text-muted, #a1a1aa)', fontSize: '0.78rem' }}>
                    <td className="wip-sticky-col" style={{ padding: '12px 18px', borderRight: '1px solid #27272a', fontStyle: 'italic', paddingLeft: '30px', position: 'sticky', left: 0, background: '#121214', zIndex: 2 }}>
                      Підсумок по виробу:
                    </td>
                    <td className="wip-sticky-sum" style={{ padding: '12px 18px', textAlign: 'center', background: '#251a12', borderRight: '1px solid #27272a', color: '#ff9000', position: 'sticky', zIndex: 2 }}>
                      {renderValue(groupTotals.sum, 'sum')}
                    </td>
                    <td style={{ padding: '12px 18px', textAlign: 'center', borderRight: '1px solid #27272a', background: 'rgba(255, 255, 255, 0.01)' }}>{renderValue(groupTotals.qCutWait, 'normal')}</td>
                    <td style={{ padding: '12px 18px', textAlign: 'center', borderRight: '1px solid #27272a' }}>{renderValue(groupTotals.qCut, 'normal')}</td>
                    <td style={{ padding: '12px 18px', textAlign: 'center', borderRight: '1px solid #27272a', background: 'rgba(255, 255, 255, 0.01)' }}>{renderValue(groupTotals.qCutBuf, 'normal')}</td>
                    <td style={{ padding: '12px 18px', textAlign: 'center', borderRight: '1px solid #27272a' }}>{renderValue(groupTotals.qGalt, 'normal')}</td>
                    <td style={{ padding: '12px 18px', textAlign: 'center', borderRight: '1px solid #27272a', background: 'rgba(255, 255, 255, 0.01)' }}>{renderValue(groupTotals.qGaltBuf, 'normal')}</td>
                    <td style={{ padding: '12px 18px', textAlign: 'center', borderRight: '1px solid #27272a' }}>{renderValue(groupTotals.qPriy, 'normal')}</td>
                    <td style={{ padding: '12px 18px', textAlign: 'center', borderRight: '1px solid #27272a', background: 'rgba(255, 255, 255, 0.01)' }}>{renderValue(groupTotals.qSortAct, 'normal')}</td>
                    <td style={{ padding: '12px 18px', textAlign: 'center', borderRight: '1px solid #27272a', background: 'rgba(255, 255, 255, 0.01)' }}>{renderValue(groupTotals.qSort, 'normal')}</td>
                    <td style={{ padding: '12px 18px', textAlign: 'center', borderRight: '1px solid #27272a', background: 'rgba(255, 255, 255, 0.01)' }}>{renderValue(groupTotals.qMalWait, 'normal')}</td>
                    <td style={{ padding: '12px 18px', textAlign: 'center', borderRight: '1px solid #27272a' }}>{renderValue(groupTotals.qMal, 'normal')}</td>
                    <td style={{ padding: '12px 18px', textAlign: 'center', borderRight: '1px solid #27272a', background: 'rgba(255, 255, 255, 0.01)' }}>{renderValue(groupTotals.qMalBuf, 'normal')}</td>
                    <td style={{ padding: '12px 18px', textAlign: 'center', borderRight: '1px solid #27272a' }}>{renderValue(groupTotals.qPres, 'normal')}</td>
                    <td style={{ padding: '12px 18px', textAlign: 'center', borderRight: '1px solid #27272a', background: 'rgba(255, 255, 255, 0.01)' }}>{renderValue(groupTotals.qPresBuf, 'normal')}</td>
                    <td style={{ padding: '12px 18px', textAlign: 'center', borderRight: '1px solid #27272a' }}>{renderValue(groupTotals.qDoop, 'normal')}</td>
                    <td style={{ padding: '12px 18px', textAlign: 'center', borderRight: '1px solid #27272a', background: 'rgba(255, 255, 255, 0.01)' }}>{renderValue(groupTotals.qDoopBuf, 'normal')}</td>
                    <td style={{ padding: '12px 18px', textAlign: 'center', borderRight: '1px solid #27272a', background: 'rgba(16, 185, 129, 0.08)', color: '#10b981' }}>{renderValue(groupTotals.qSgp, 'sgp')}</td>
                    <td style={{ padding: '12px 18px', textAlign: 'center', borderRight: '1px solid #27272a', background: 'rgba(16, 185, 129, 0.08)', color: '#10b981' }}>{renderValue(groupTotals.qBz, 'bz')}</td>
                    <td style={{ padding: '12px 18px', textAlign: 'center', background: 'rgba(239, 68, 68, 0.08)', color: '#ef4444' }}>{renderValue(groupTotals.qScrap, 'scrap')}</td>
                  </tr>
                </React.Fragment>
              )
            })
          )}

          {/* Grand Total Row */}
          {groupedDashboardData.length > 0 && (
            <tr className="wip-grandtotal-row" style={{ background: 'var(--card-bg, #18181b)', fontWeight: 'bold', borderTop: '2px solid #ff9000', color: '#fff', fontSize: '0.8rem' }}>
              <td className="wip-sticky-col" style={{ padding: '14px 18px', borderRight: '1px solid #27272a', textTransform: 'uppercase', letterSpacing: '0.5px', position: 'sticky', left: 0, background: 'var(--card-bg, #18181b)', zIndex: 2 }}>ЗАГАЛЬНИЙ WIP РАЗОМ:</td>
              <td className="wip-sticky-sum" style={{ padding: '14px 18px', textAlign: 'center', background: '#2e2014', borderRight: '1px solid #27272a', color: '#ff9000', position: 'sticky', zIndex: 2 }}>
                {renderValue(totals.sum, 'sum')}
              </td>
              <td style={{ padding: '14px 18px', textAlign: 'center', borderRight: '1px solid #27272a', background: 'rgba(255, 255, 255, 0.02)' }}>{renderValue(totals.qCutWait, 'normal')}</td>
              <td style={{ padding: '14px 18px', textAlign: 'center', borderRight: '1px solid #27272a' }}>{renderValue(totals.qCut, 'normal')}</td>
              <td style={{ padding: '14px 18px', textAlign: 'center', borderRight: '1px solid #27272a', background: 'rgba(255, 255, 255, 0.02)' }}>{renderValue(totals.qCutBuf, 'normal')}</td>
              <td style={{ padding: '14px 18px', textAlign: 'center', borderRight: '1px solid #27272a' }}>{renderValue(totals.qGalt, 'normal')}</td>
              <td style={{ padding: '14px 18px', textAlign: 'center', borderRight: '1px solid #27272a', background: 'rgba(255, 255, 255, 0.02)' }}>{renderValue(totals.qGaltBuf, 'normal')}</td>
              <td style={{ padding: '14px 18px', textAlign: 'center', borderRight: '1px solid #27272a' }}>{renderValue(totals.qPriy, 'normal')}</td>
              <td style={{ padding: '14px 18px', textAlign: 'center', borderRight: '1px solid #27272a', background: 'rgba(255, 255, 255, 0.02)' }}>{renderValue(totals.qSortAct, 'normal')}</td>
              <td style={{ padding: '14px 18px', textAlign: 'center', borderRight: '1px solid #27272a', background: 'rgba(255, 255, 255, 0.02)' }}>{renderValue(totals.qSort, 'normal')}</td>
              <td style={{ padding: '14px 18px', textAlign: 'center', borderRight: '1px solid #27272a', background: 'rgba(255, 255, 255, 0.02)' }}>{renderValue(totals.qMalWait, 'normal')}</td>
              <td style={{ padding: '14px 18px', textAlign: 'center', borderRight: '1px solid #27272a' }}>{renderValue(totals.qMal, 'normal')}</td>
              <td style={{ padding: '14px 18px', textAlign: 'center', borderRight: '1px solid #27272a', background: 'rgba(255, 255, 255, 0.02)' }}>{renderValue(totals.qMalBuf, 'normal')}</td>
              <td style={{ padding: '14px 18px', textAlign: 'center', borderRight: '1px solid #27272a' }}>{renderValue(totals.qPres, 'normal')}</td>
              <td style={{ padding: '14px 18px', textAlign: 'center', borderRight: '1px solid #27272a', background: 'rgba(255, 255, 255, 0.02)' }}>{renderValue(totals.qPresBuf, 'normal')}</td>
              <td style={{ padding: '14px 18px', textAlign: 'center', borderRight: '1px solid #27272a' }}>{renderValue(totals.qDoop, 'normal')}</td>
              <td style={{ padding: '14px 18px', textAlign: 'center', borderRight: '1px solid #27272a', background: 'rgba(255, 255, 255, 0.02)' }}>{renderValue(totals.qDoopBuf, 'normal')}</td>
              <td style={{ padding: '14px 18px', textAlign: 'center', borderRight: '1px solid #27272a', background: 'rgba(16, 185, 129, 0.08)', color: '#10b981' }}>{renderValue(totals.qSgp, 'sgp')}</td>
              <td style={{ padding: '14px 18px', textAlign: 'center', borderRight: '1px solid #27272a', background: 'rgba(16, 185, 129, 0.08)', color: '#10b981' }}>{renderValue(totals.qBz, 'bz')}</td>
              <td style={{ padding: '14px 18px', textAlign: 'center', background: 'rgba(239, 68, 68, 0.08)', color: '#ef4444' }}>{renderValue(totals.qScrap, 'scrap')}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
