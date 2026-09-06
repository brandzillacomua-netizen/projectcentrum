import React from 'react'
import { Layers, ChevronRight, Clock } from 'lucide-react'

export function TumblingWaitingColumn({
  col2Ref,
  waitingQueue,
  orders,
  getNom,
  getNextTumblingOperation,
  formatWaitingTime
}) {
  return (
    <section style={{
      background: 'rgba(15, 15, 22, 0.6)',
      border: '1px solid rgba(255, 255, 255, 0.03)',
      borderRadius: '20px',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      <div style={{
        padding: '16px 20px',
        background: 'rgba(255, 255, 255, 0.02)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h2 style={{ fontSize: '0.85rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#ff9000', margin: 0 }}>
          Черга очікування ({waitingQueue.length})
        </h2>
        <span style={{ fontSize: '0.6rem', color: '#888', fontWeight: 800 }}>ЧЕРГА FIFO + ДЕДЛАЙН</span>
      </div>

      <div ref={col2Ref} style={{
        flex: 1,
        padding: '16px',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        scrollbarWidth: 'none'
      }}>
        {waitingQueue.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.15 }}>
            <Layers size={48} />
            <div style={{ fontSize: '0.75rem', marginTop: '8px' }}>Черга порожня</div>
          </div>
        ) : (
          waitingQueue.map((card, idx) => {
            const nom = getNom(card.nomenclature_id)
            const nextOp = getNextTumblingOperation(card.operation)

            return (
              <div key={card.id} style={{
                background: '#0d0d12',
                border: card.isBottleneck 
                  ? '1px solid rgba(239, 68, 68, 0.25)' 
                  : '1px solid rgba(255, 255, 255, 0.03)',
                borderRadius: '14px',
                padding: '12px 14px',
                position: 'relative',
                boxShadow: card.isBottleneck ? '0 4px 15px rgba(239,68,68,0.04)' : 'none'
              }}>
                {/* Index & Priority banner */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <span style={{
                      background: card.isBottleneck ? '#ef4444' : '#1e1e2d',
                      color: card.isBottleneck ? '#000' : '#888',
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.65rem',
                      fontWeight: 950
                    }}>
                      {idx + 1}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: '#ff9000', fontWeight: 900 }}>
                      #{card.id.slice(-8).toUpperCase()}
                    </span>
                    {(() => {
                      const order = (orders || []).find(o => String(o.id) === String(card.order_id))
                      return order?.order_num ? (
                        <span style={{ background: 'rgba(255, 255, 255, 0.06)', color: '#aaa', border: '1px solid rgba(255, 255, 255, 0.1)', padding: '1px 6px', borderRadius: '5px', fontSize: '0.6rem', fontWeight: 900 }}>
                          {order.order_num}
                        </span>
                      ) : null
                    })()}
                    {(() => {
                      const seqMatch = (card.card_info || '').match(/(\d+\/\d+)/)
                      return seqMatch ? (
                        <span style={{ background: 'rgba(255, 144, 0, 0.15)', color: '#ff9000', border: '1px solid rgba(255, 144, 0, 0.3)', padding: '1px 6px', borderRadius: '5px', fontSize: '0.6rem', fontWeight: 900 }}>
                          {seqMatch[1]}
                        </span>
                      ) : null
                    })()}
                  </div>
                  
                  {card.isBottleneck ? (
                    <span style={{
                      background: 'rgba(239, 68, 68, 0.15)',
                      color: '#ef4444',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      fontSize: '0.55rem',
                      padding: '2px 6px',
                      borderRadius: '5px',
                      fontWeight: 900,
                      textTransform: 'uppercase'
                    }}>
                      КРИТИЧНО
                    </span>
                  ) : (
                    <span style={{
                      background: 'rgba(59, 130, 246, 0.12)',
                      color: '#3b82f6',
                      border: '1px solid rgba(59, 130, 246, 0.2)',
                      fontSize: '0.55rem',
                      padding: '2px 6px',
                      borderRadius: '5px',
                      fontWeight: 900
                    }}>
                      Черга
                    </span>
                  )}
                </div>

                <h4 style={{ fontSize: '0.8rem', fontWeight: 800, margin: '0 0 6px 0', color: '#fff' }}>
                  {nom?.name || 'Невказана деталь'}
                </h4>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                  <span style={{ fontSize: '0.65rem', color: '#888', fontWeight: 700 }}>
                    К-сть: <strong style={{ color: '#fff' }}>{card.quantity} шт</strong>
                  </span>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.62rem', color: '#777', fontWeight: 800 }}>
                    <Clock size={10} />
                    Очікує: {formatWaitingTime(card.completed_at || card.started_at)}
                  </div>
                </div>

                {/* Step indicator */}
                <div style={{
                  marginTop: '8px',
                  padding: '4px 8px',
                  background: 'rgba(255,255,255,0.02)',
                  borderRadius: '8px',
                  fontSize: '0.62rem',
                  color: '#06b6d4',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <ChevronRight size={10} />
                  Переходить на: {nextOp}
                </div>
              </div>
            )
          })
        )}
      </div>
    </section>
  )
}
