import React from 'react'
import { Play, Clock } from 'lucide-react'

export function TumblingInWorkColumn({
  col3Ref,
  inProgressQueue,
  orders,
  getNom,
  formatLiveDuration
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
        <h2 style={{ fontSize: '0.85rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#10b981', margin: 0 }}>
          Зараз у роботі ({inProgressQueue.length})
        </h2>
        <Play size={14} color="#10b981" fill="currentColor" />
      </div>

      <div ref={col3Ref} style={{
        flex: 1,
        padding: '16px',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        scrollbarWidth: 'none'
      }}>
        {inProgressQueue.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.15 }}>
            <Play size={48} />
            <div style={{ fontSize: '0.75rem', marginTop: '8px' }}>Зараз нічого не обробляється</div>
          </div>
        ) : (
          inProgressQueue.map(card => {
            const nom = getNom(card.nomenclature_id)

            return (
              <div key={card.id} style={{
                background: 'rgba(16, 185, 129, 0.02)',
                border: '1px solid rgba(16, 185, 129, 0.12)',
                borderRadius: '14px',
                padding: '12px 14px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
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
                  <span style={{
                    background: 'rgba(16, 185, 129, 0.15)',
                    color: '#10b981',
                    fontSize: '0.55rem',
                    padding: '2px 6px',
                    borderRadius: '5px',
                    fontWeight: 900,
                    textTransform: 'uppercase'
                  }}>
                    {card.operation?.replace('Галтовка (', '').replace(')', '') || 'Обробка'}
                  </span>
                </div>

                <h4 style={{ fontSize: '0.8rem', fontWeight: 800, margin: '0 0 6px 0', color: '#fff' }}>
                  {nom?.name || 'Невказана деталь'}
                </h4>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.65rem', color: '#888', fontWeight: 700 }}>
                    К-сть: <strong style={{ color: '#fff' }}>{card.quantity} шт</strong>
                  </span>
                  
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '0.75rem',
                    fontFamily: 'monospace',
                    color: '#10b981',
                    fontWeight: 900
                  }}>
                    <Clock size={11} />
                    {formatLiveDuration(card.started_at)}
                  </div>
                </div>

                {card.operator_name && (
                  <div style={{
                    marginTop: '8px',
                    fontSize: '0.62rem',
                    color: '#666',
                    fontWeight: 700
                  }}>
                    Оператор: <span style={{ color: '#aaa' }}>{card.operator_name.split(' (')[0]}</span>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </section>
  )
}
