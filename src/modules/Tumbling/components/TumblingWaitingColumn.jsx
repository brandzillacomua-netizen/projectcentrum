import React from 'react'
import { Layers, ChevronRight, Clock } from 'lucide-react'

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

export function TumblingWaitingColumn({
  col2Ref,
  waitingQueue,
  orders,
  getNom,
  getNextTumblingOperation,
  formatWaitingTime
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
        <h2 style={{ fontSize: '1rem', fontWeight: 950, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#ff9000', margin: 0 }}>
          Черга очікування ({waitingQueue.length})
        </h2>
        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted, #94a3b8)', fontWeight: 900, textTransform: 'uppercase' }}>
          ЧЕРГА FIFO + ДЕДЛАЙН
        </span>
      </div>

      <div ref={col2Ref} style={{
        flex: 1,
        padding: '14px',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        scrollbarWidth: 'none'
      }}>
        {waitingQueue.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.4 }}>
            <Layers size={52} color="#ff9000" />
            <div style={{ fontSize: '0.9rem', marginTop: '10px', fontWeight: 900 }}>Черга порожня</div>
          </div>
        ) : (
          waitingQueue.map((card, idx) => {
            const nom = getNom(card.nomenclature_id)
            const nextOp = getNextTumblingOperation(card.operation)
            const order = (orders || []).find(o => String(o.id) === String(card.order_id))
            const seqPill = getCardSeqNumber(card.card_info, idx)

            return (
              <div key={card.id} className="tumbling-queue-card" style={{
                background: card.isBottleneck ? 'var(--card-bottleneck-bg, #fff1f1)' : 'var(--card-item-bg, #ffffff)',
                border: card.isBottleneck 
                  ? '3px solid #dc2626' 
                  : '2px solid var(--card-item-border, #cbd5e1)',
                borderRadius: '16px',
                padding: '14px',
                display: 'grid',
                gridTemplateColumns: 'minmax(140px, auto) 1fr',
                gap: '14px',
                alignItems: 'center',
                position: 'relative',
                boxShadow: card.isBottleneck ? '0 8px 24px rgba(220,38,38,0.22)' : '0 4px 14px rgba(0,0,0,0.06)'
              }}>
                {/* LEFT COLUMN: ORDER NUM, SYSTEM CODE, CARD SEQ, PRIORITY */}
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

                  {/* Card Sequence Pill - e.g. №1, №19 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className="tumbling-badge-green">
                      {seqPill}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted, #64748b)', fontWeight: 900 }}>
                      Поз. {idx + 1}
                    </span>
                  </div>

                  {/* Priority / Criticality Badge */}
                  {card.isBottleneck ? (
                    <span className="tumbling-badge-red">
                      🚨 КРИТИЧНО
                    </span>
                  ) : (
                    <span style={{
                      background: '#475569',
                      color: '#ffffff',
                      fontSize: '0.65rem',
                      padding: '3px 8px',
                      borderRadius: '6px',
                      fontWeight: 950,
                      textTransform: 'uppercase',
                      marginTop: '2px'
                    }}>
                      ⚙️ В черзі
                    </span>
                  )}
                </div>

                {/* RIGHT COLUMN: NOMENCLATURE NAME, QUANTITY, WAITING TIME, STEP */}
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

                  {/* Quantity and Waiting Time Row */}
                  <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                    {/* Quantity Badge */}
                    <div className="tumbling-badge-qty">
                      К-сть: <strong>{card.quantity} шт</strong>
                    </div>

                    {/* Waiting Time */}
                    <div className="tumbling-waiting-timer-box">
                      <Clock size={14} color="#0284c7" />
                      Очікує: <strong>{formatWaitingTime(card.completed_at || card.started_at)}</strong>
                    </div>
                  </div>

                  {/* Step indicator */}
                  <div style={{
                    padding: '5px 10px',
                    background: 'var(--step-bg, #e0f2fe)',
                    border: '1px solid var(--step-border, #93c5fd)',
                    borderRadius: '8px',
                    fontSize: '0.78rem',
                    color: 'var(--step-text, #0369a1)',
                    fontWeight: 900,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    <ChevronRight size={15} />
                    Переходить на: <strong style={{ color: 'var(--step-text-bold, #0284c7)' }}>{nextOp}</strong>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </section>
  )
}
