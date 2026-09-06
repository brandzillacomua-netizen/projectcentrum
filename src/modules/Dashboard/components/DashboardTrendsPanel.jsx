import React from 'react'

export const DashboardTrendsPanel = ({
  productTrends,
  selectedOrderId,
  orders,
  groupedDashboardData
}) => {
  const filteredTrends = Object.entries(productTrends).filter(([id]) => !selectedOrderId || id === selectedOrderId)
  if (filteredTrends.length === 0) return null

  return (
    <div style={{ marginBottom: '28px' }}>
      {/* Panel Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem' }}>⚡</div>
          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: 900, color: '#fff', letterSpacing: '0.03em', textTransform: 'uppercase' }}>Вузькі Місця & Тренди за нарядами</div>
            <div style={{ fontSize: '0.65rem', color: '#71717a', fontWeight: 600, marginTop: '1px' }}>Аналіз потенціалу нарядів та обмежувальних деталей</div>
          </div>
        </div>
        <div style={{ fontSize: '0.7rem', color: '#52525b', fontWeight: 700, background: 'var(--card-bg, #18181b)', border: '1px solid var(--glass-border, #27272a)', padding: '5px 12px', borderRadius: '8px' }}>
          {filteredTrends.length} наряд(ів)
        </div>
      </div>

      {/* Trend Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '16px' }}>
        {filteredTrends.map(([id, trend]) => {
          const order = orders?.find(o => String(o.id) === String(id))
          let prodId = order?.nomenclature_id
          if (!prodId && order?.order_items && order.order_items.length > 0) {
            prodId = order.order_items[0].nomenclature_id
          }
          const hasGroup = groupedDashboardData.some(g => String(g.id) === String(prodId))
          if (!hasGroup) return null

          const pct = trend.demand > 0 ? Math.min(100, Math.round((trend.actual / trend.demand) * 100)) : 0
          const isCritical = pct < 30
          const isWarning = pct >= 30 && pct < 70
          const accentColor = isCritical ? '#ef4444' : isWarning ? '#f59e0b' : '#10b981'
          const accentBg = isCritical ? 'rgba(239,68,68,0.07)' : isWarning ? 'rgba(245,158,11,0.07)' : 'rgba(16,185,129,0.07)'
          const accentBorder = isCritical ? 'rgba(239,68,68,0.22)' : isWarning ? 'rgba(245,158,11,0.22)' : 'rgba(16,185,129,0.22)'
          const statusLabel = isCritical ? '🔴 КРИТИЧНИЙ ДЕФІЦИТ' : isWarning ? '🟡 УВАГА' : '🟢 В НОРМІ'
          const wip = trend.wip || 0
          const remainingDemand = trend.remainingDemand || 0

          return (
            <div key={id} className="dashboard-trend-card" style={{
              background: 'var(--card-bg, linear-gradient(145deg, #141417, #0f0f12))',
              border: `1px solid ${accentBorder}`,
              borderRadius: '20px',
              overflow: 'hidden',
              boxShadow: `0 4px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.03)`,
              transition: 'transform 0.2s, box-shadow 0.2s',
            }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 10px 32px rgba(0,0,0,0.5), 0 0 0 1px ${accentBorder}` }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = `0 4px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.03)` }}
            >
              {/* Card Top Stripe */}
              <div style={{ height: '3px', background: `linear-gradient(90deg, ${accentColor}, transparent)` }} />

              <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: '14px' }}>

                {/* Header: Name + Status Badge */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: '0.58rem', background: accentBg, color: accentColor, padding: '3px 8px', borderRadius: '6px', fontWeight: 900, letterSpacing: '0.06em', border: `1px solid ${accentBorder}` }}>
                      {statusLabel}
                    </span>
                    <div className="trend-card-name" style={{ fontSize: '0.95rem', fontWeight: 900, color: 'var(--text, #f4f4f5)', marginTop: '7px', lineHeight: 1.2 }}>{trend.name}</div>
                    {trend.code && <div style={{ fontSize: '0.62rem', color: '#52525b', fontWeight: 700, marginTop: '3px' }}>КОД: {trend.code}</div>}
                  </div>

                  {/* Ratio */}
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: '0.55rem', color: '#52525b', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>СГП / Потреба</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 950, color: accentColor, lineHeight: 1.1, marginTop: '3px' }}>
                      {trend.actual}
                      <span style={{ fontSize: '0.8rem', color: '#71717a', fontWeight: 500 }}> / {trend.demand || 0}</span>
                    </div>
                    <div style={{ fontSize: '0.62rem', color: '#52525b', fontWeight: 700 }}>компл.</div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', fontWeight: 800, marginBottom: '5px' }}>
                    <span style={{ color: '#71717a' }}>Виконання потреби замовлень</span>
                    <span style={{ color: accentColor }}>{pct}%</span>
                  </div>
                  <div style={{ height: '7px', background: 'var(--bg, #09090b)', borderRadius: '10px', overflow: 'hidden', border: '1px solid var(--glass-border, #27272a)', position: 'relative' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: `linear-gradient(90deg, ${accentColor}, ${accentColor}cc)`, borderRadius: '10px', transition: 'width 0.5s ease', boxShadow: `0 0 8px ${accentColor}66` }} />
                  </div>
                </div>

                {/* Stats Row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                  <div className="trend-stat-box sgp" style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)', borderRadius: '12px', padding: '10px 12px' }}>
                    <div style={{ fontSize: '0.58rem', color: '#6b7280', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>На СГП зараз</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#10b981' }}>{trend.actual} <span style={{ fontSize: '0.65rem', color: '#6b7280', fontWeight: 600 }}>компл.</span></div>
                  </div>
                  <div className="trend-stat-box wip" style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)', borderRadius: '12px', padding: '10px 12px' }}>
                    <div style={{ fontSize: '0.58rem', color: '#6b7280', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>В роботі</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#3b82f6' }}>{wip} <span style={{ fontSize: '0.65rem', color: '#6b7280', fontWeight: 600 }}>компл.</span></div>
                  </div>
                  <div className="trend-stat-box rem" style={{ background: 'rgba(255,144,0,0.06)', border: '1px solid rgba(255,144,0,0.15)', borderRadius: '12px', padding: '10px 12px' }}>
                    <div style={{ fontSize: '0.58rem', color: '#6b7280', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Залишок потреби</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#ff9000' }}>{remainingDemand} <span style={{ fontSize: '0.65rem', color: '#6b7280', fontWeight: 600 }}>компл.</span></div>
                  </div>
                </div>

                {/* Bottleneck Details */}
                {trend.bottlenecks && trend.bottlenecks.length > 0 ? (
                  <div className="trend-bottlenecks-box" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.18)', borderRadius: '12px', padding: '11px 14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                      <span style={{ fontSize: '1rem' }}>⚠️</span>
                      <span style={{ fontSize: '0.65rem', color: '#f87171', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Вузькі місця ({trend.bottlenecks.length})</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto', paddingRight: '4px' }} className="tasks-scroll">
                      {trend.bottlenecks.map(b => (
                        <div key={b.name} style={{ borderBottom: '1px solid rgba(239,68,68,0.1)', paddingBottom: '6px' }}>
                          <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text, #fff)', wordBreak: 'break-word' }}>
                            {b.name} {b.code ? `(${b.code})` : ''}
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                            <span style={{ fontSize: '0.65rem', color: '#9ca3af' }}>
                              Деталей: <strong style={{ color: '#fca5a5' }}>{b.qty}</strong> / {b.needed} шт.
                            </span>
                            <span style={{ fontSize: '0.65rem', color: '#f87171', fontWeight: 700 }}>
                              Дефіцит: -{b.shortage} шт.
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div style={{ background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.12)', borderRadius: '12px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '1rem' }}>✅</span>
                    <span style={{ fontSize: '0.72rem', color: '#6ee7b7', fontWeight: 700 }}>Вузьких місць не виявлено</span>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
