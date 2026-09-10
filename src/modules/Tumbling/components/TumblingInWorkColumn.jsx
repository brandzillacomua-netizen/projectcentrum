import React from 'react'
import { Play, Clock } from 'lucide-react'

// Helper to format card sequence number as "№X"
const getCardSeqNumber = (cardInfo, idx) => {
  if (!cardInfo) return `№${idx + 1}`
  const match = String(cardInfo).match(/(?:№\s*|(\d+)\/\d+|(\d+))/i)
  if (match) {
    const num = match[1] || match[2]
    if (num) return `№${num}`
  }
  return `№${idx + 1}`
}

export function TumblingInWorkColumn({
  col3Ref,
  inProgressQueue,
  orders,
  getNom,
  formatLiveDuration
}) {
  return (
    <section className="tumbling-col-panel" style={{
      background: 'var(--col-bg, #0f172a)',
      border: '2px solid var(--col-border, #334155)',
      borderRadius: '20px',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      boxShadow: 'var(--col-shadow, 0 10px 30px rgba(0,0,0,0.15))'
    }}>
      <div style={{
        padding: '14px 20px',
        background: 'var(--col-head-bg, #1e293b)',
        borderBottom: '2px solid var(--col-border, #334155)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 950, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#059669', margin: 0 }}>
          Зараз у роботі ({inProgressQueue.length})
        </h2>
        <Play size={18} color="#059669" fill="currentColor" />
      </div>

      <div ref={col3Ref} style={{
        flex: 1,
        padding: '14px',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        scrollbarWidth: 'none'
      }}>
        {inProgressQueue.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.4 }}>
            <Play size={52} color="#059669" />
            <div style={{ fontSize: '0.9rem', marginTop: '10px', fontWeight: 900 }}>Зараз нічого не обробляється</div>
          </div>
        ) : (
          inProgressQueue.map((card, idx) => {
            const nom = getNom(card.nomenclature_id)
            const order = (orders || []).find(o => String(o.id) === String(card.order_id))
            const seqPill = getCardSeqNumber(card.card_info, idx)

            return (
              <div key={card.id} className="tumbling-inwork-card" style={{
                background: 'var(--card-item-bg, #ffffff)',
                border: '3px solid #059669',
                borderRadius: '16px',
                padding: '14px',
                display: 'grid',
                gridTemplateColumns: 'minmax(140px, auto) 1fr',
                gap: '14px',
                alignItems: 'center',
                boxShadow: '0 8px 24px rgba(5,150,105,0.18)'
              }}>
                {/* LEFT COLUMN: ORDER NUM, SYSTEM CODE, CARD SEQ, STAGE */}
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  alignItems: 'flex-start',
                  borderRight: '2px solid var(--border-subtle, #cbd5e1)',
                  paddingRight: '12px'
                }}>
                  {/* Order Number Badge */}
                  <span className="tumbling-badge-blue">
                    {order?.order_num || `Наряд #${String(card.order_id).slice(-6)}`}
                  </span>

                  {/* Card System Code - GOLD ON DARK SLATE */}
                  <span className="tumbling-badge-gold">
                    #{card.id.slice(-8).toUpperCase()}
                  </span>

                  {/* Card Sequence Pill - e.g. №1 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className="tumbling-badge-green">
                      {seqPill}
                    </span>
                  </div>

                  {/* Stage Pill */}
                  <span className="tumbling-badge-amber">
                    ⚡ {card.operation?.replace('Галтовка (', '').replace(')', '') || 'Обробка'}
                  </span>
                </div>

                {/* RIGHT COLUMN: NOMENCLATURE NAME, QUANTITY, LIVE TIMER */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflow: 'hidden' }}>
                  {/* Nomenclature Name */}
                  <h4 style={{
                    fontSize: '1.15rem',
                    fontWeight: 950,
                    margin: 0,
                    color: 'var(--card-title-color, #0f172a)',
                    lineHeight: 1.25,
                    wordBreak: 'break-word'
                  }}>
                    {nom?.name || 'Невказана деталь'}
                  </h4>

                  {/* Quantity and Live Timer Row */}
                  <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                    <div className="tumbling-badge-qty">
                      К-сть: <strong>{card.quantity} шт</strong>
                    </div>

                    <div className="tumbling-timer-box">
                      <Clock size={16} color="#10b981" />
                      <strong>{formatLiveDuration(card.started_at)}</strong>
                    </div>
                  </div>

                  {card.operator_name && (
                    <div style={{
                      fontSize: '0.78rem',
                      color: 'var(--text-muted, #475569)',
                      fontWeight: 900
                    }}>
                      👤 Оператор: <strong style={{ color: 'var(--text-primary, #0f172a)' }}>{card.operator_name.split(' (')[0]}</strong>
                    </div>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    </section>
  )
}
