import React from 'react'
import { Layers, Clock, Play, AlertTriangle, CheckCircle } from 'lucide-react'

export default function TumblingTerminalCardList({
  displayedCards,
  getNom,
  bottleneckNomenclaturesMap,
  orderKits,
  priorityMap,
  formatDuration,
  getNextTumblingOperation,
  setPendingStartCard,
  openCompleteModal,
  isProcessing
}) {
  return (
    <div style={{ flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }} className="custom-scroll">
      {displayedCards.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.15, padding: '50px 0' }}>
          <Layers size={64} />
          <h3 style={{ fontSize: '0.85rem', fontWeight: 800, marginTop: '12px' }}>Картки відсутні</h3>
        </div>
      ) : (
        displayedCards.map(card => {
          const nom = getNom(card)
          const isWaiting = card.type === 'waiting'
          const isBottleneck = card.isBottleneck || (isWaiting && bottleneckNomenclaturesMap[card.nomenclature_id])
          const pInfo = isBottleneck 
            ? { label: 'КРИТИЧНО', bg: 'rgba(239,68,68,0.15)', text: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }
            : priorityMap[card.galt_priority || 2]

          const timeStr = isWaiting
            ? (card.completed_at ? formatDuration(card.completed_at) : '—')
            : formatDuration(card.started_at)

          return (
            <div key={card.id} style={{ background: 'var(--card-bg, #111116)', border: '1px solid var(--glass-border, rgba(255,255,255,0.03))', borderRadius: '18px', padding: '16px 18px', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '16px', transition: '0.2s', position: 'relative' }} className="hover-lift tumbling-card">

              {/* Strip color */}
              <div style={{ position: 'absolute', left: 0, top: '15px', bottom: '15px', width: '3px', background: isWaiting ? pInfo.text : '#10b981', borderRadius: '0 3px 3px 0' }} />

              {/* Card main info */}
              <div style={{ flex: '1 1 300px', paddingLeft: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                  <span className="card-code" style={{ fontSize: '0.8rem', color: '#ff9000', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Картка #{card.id.slice(-8).toUpperCase()}
                  </span>
                  
                  {(() => {
                    const seqMatch = (card.card_info || '').match(/(\d+\/\d+)/)
                    return seqMatch ? (
                      <span className="card-seq-badge" style={{
                        background: 'rgba(255, 144, 0, 0.15)',
                        color: '#ff9000',
                        border: '1px solid rgba(255, 144, 0, 0.3)',
                        padding: '2px 6px', borderRadius: '6px',
                        fontSize: '0.6rem', fontWeight: 950,
                        zIndex: 1
                      }}>
                        {seqMatch[1]}
                      </span>
                    ) : null
                  })()}
                  
                  {isWaiting ? (
                    <>
                      <span className="card-stage" style={{ fontSize: '0.8rem', background: pInfo.bg, color: pInfo.text, border: pInfo.border, padding: '4px 10px', borderRadius: '8px', fontWeight: 900 }}>
                        Очікує: {getNextTumblingOperation(card.operation)}
                      </span>
                      {(() => {
                        const kit = orderKits.find(k => String(k.orderId) === String(card.order_id))
                        const comp = kit?.components?.find(co => co.id === card.nomenclature_id)
                        const ratio = comp ? comp.kitRatio : 1.0
                        const percent = Math.min(100, Math.round(ratio * 100))

                        if (isBottleneck) {
                          return (
                            <span className="card-stage" style={{ fontSize: '0.85rem', background: 'rgba(239, 68, 68, 0.25)', color: '#ff4444', border: '2px solid #ef4444', padding: '4px 12px', borderRadius: '8px', fontWeight: 950, letterSpacing: '0.5px', boxShadow: '0 0 10px rgba(239, 68, 68, 0.2)' }}>
                              🔥 КРИТИЧНИЙ ПРІОРИТЕТ (Комплект: {percent}%)
                            </span>
                          )
                        }
                        if (ratio < 0.5) {
                          return (
                            <span className="card-stage" style={{ fontSize: '0.85rem', background: 'rgba(245, 158, 11, 0.25)', color: '#f59e0b', border: '2px solid #f59e0b', padding: '4px 12px', borderRadius: '8px', fontWeight: 950, letterSpacing: '0.5px' }}>
                              ⚡ ВИСОКИЙ ПРІОРИТЕТ (Комплект: {percent}%)
                            </span>
                          )
                        }
                        if (ratio < 0.8) {
                          return (
                            <span className="card-stage" style={{ fontSize: '0.85rem', background: 'rgba(59, 130, 246, 0.25)', color: '#3b82f6', border: '2px solid #3b82f6', padding: '4px 12px', borderRadius: '8px', fontWeight: 950, letterSpacing: '0.5px' }}>
                              ✨ СЕРЕДНІЙ ПРІОРИТЕТ (Комплект: {percent}%)
                            </span>
                          )
                        }
                        return (
                          <span className="card-stage" style={{ fontSize: '0.85rem', background: 'rgba(16, 185, 129, 0.25)', color: '#10b981', border: '2px solid #10b981', padding: '4px 12px', borderRadius: '8px', fontWeight: 950, letterSpacing: '0.5px' }}>
                            ✅ НИЗЬКИЙ ПРІОРИТЕТ (Комплект: {percent}%)
                          </span>
                        )
                      })()}
                    </>
                  ) : (
                    <>
                      <span className="card-stage" style={{ fontSize: '0.8rem', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '4px 10px', borderRadius: '8px', fontWeight: 900 }}>
                        У роботі: {card.operation}
                      </span>
                      {(() => {
                        const kit = orderKits.find(k => String(k.orderId) === String(card.order_id))
                        const comp = kit?.components?.find(co => co.id === card.nomenclature_id)
                        const ratio = comp ? comp.kitRatio : 1.0
                        const percent = Math.min(100, Math.round(ratio * 100))
                        const isB = bottleneckNomenclaturesMap[card.nomenclature_id] || false

                        if (isB) {
                          return (
                            <span className="card-stage" style={{ fontSize: '0.85rem', background: 'rgba(239, 68, 68, 0.25)', color: '#ff4444', border: '2px solid #ef4444', padding: '4px 12px', borderRadius: '8px', fontWeight: 950, letterSpacing: '0.5px', boxShadow: '0 0 10px rgba(239, 68, 68, 0.2)' }}>
                              🔥 КРИТИЧНИЙ ПРІОРИТЕТ (Комплект: {percent}%)
                            </span>
                          )
                        }
                        if (ratio < 0.5) {
                          return (
                            <span className="card-stage" style={{ fontSize: '0.85rem', background: 'rgba(245, 158, 11, 0.25)', color: '#f59e0b', border: '2px solid #f59e0b', padding: '4px 12px', borderRadius: '8px', fontWeight: 950, letterSpacing: '0.5px' }}>
                              ⚡ ВИСОКИЙ ПРІОРИТЕТ (Комплект: {percent}%)
                            </span>
                          )
                        }
                        if (ratio < 0.8) {
                          return (
                            <span className="card-stage" style={{ fontSize: '0.85rem', background: 'rgba(59, 130, 246, 0.25)', color: '#3b82f6', border: '2px solid #3b82f6', padding: '4px 12px', borderRadius: '8px', fontWeight: 950, letterSpacing: '0.5px' }}>
                              ✨ СЕРЕДНІЙ ПРІОРИТЕТ (Комплект: {percent}%)
                            </span>
                          )
                        }
                        return (
                          <span className="card-stage" style={{ fontSize: '0.85rem', background: 'rgba(16, 185, 129, 0.25)', color: '#10b981', border: '2px solid #10b981', padding: '4px 12px', borderRadius: '8px', fontWeight: 950, letterSpacing: '0.5px' }}>
                            ✅ НИЗЬКИЙ ПРІОРИТЕТ (Комплект: {percent}%)
                          </span>
                        )
                      })()}
                    </>
                  )}
                </div>

                <h4 className="card-title" style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text, #fff)', margin: '0 0 6px 0', lineHeight: 1.3 }}>
                  {nom?.name || 'Невказана деталь'}
                </h4>

                <div className="card-details" style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted, #6b7280)', fontWeight: 700 }}>
                    К-сть: <strong style={{ color: 'var(--text, #fff)' }}>{card.quantity} шт</strong>
                  </span>
                  {isWaiting ? (
                    <>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted, #6b7280)', fontWeight: 700 }}>
                        Майстер: <span style={{ color: 'var(--text-sub, #aaa)' }}>{(card.manager_name || 'Не вказано').split(' (')[0]}</span>
                      </span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted, #6b7280)', fontWeight: 700 }}>
                        Верстат розкрою: <span style={{ color: 'var(--text-sub, #aaa)' }}>{card.machine || '—'}</span>
                      </span>
                    </>
                  ) : (
                    <>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted, #6b7280)', fontWeight: 700 }}>
                        Виконавець: <span style={{ color: 'var(--text-sub, #aaa)' }}>{(card.operator_name || 'Не вказано').split(' (')[0]}</span>
                      </span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted, #6b7280)', fontWeight: 700 }}>
                        Зміна: <span style={{ color: 'var(--text-sub, #aaa)' }}>{card.shift_name || '—'}</span>
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Timer & Action */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px', minWidth: '120px' }} className="card-action-container">
                <div className="card-timer" style={{ display: 'flex', alignItems: 'center', gap: '4px', color: isWaiting ? 'var(--text-muted, #6b7280)' : '#10b981', fontSize: '0.68rem', fontWeight: 900, fontFamily: 'monospace' }}>
                  <Clock size={12} /> {timeStr}
                </div>
                {isWaiting ? (
                  <button
                    onClick={() => setPendingStartCard(card)}
                    disabled={isProcessing}
                    style={{ background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.2)', color: '#06b6d4', padding: '8px 12px', borderRadius: '10px', fontSize: '0.7rem', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', transition: '0.2s' }}
                    className="btn-cyan card-action-btn"
                  >
                    <Play size={11} fill="currentColor" /> В РОБОТУ
                  </button>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
                    <button
                      onClick={() => openCompleteModal(card)}
                      disabled={isProcessing}
                      style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)', color: '#ef4444', padding: '8px 12px', borderRadius: '10px', fontSize: '0.7rem', fontWeight: 950, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', transition: '0.2s' }}
                      className="card-action-btn"
                      title="Внести кількість браку та передати запис у ВКЯ"
                    >
                      <AlertTriangle size={12} /> ВНЕСТИ БРАК У ВКЯ
                    </button>
                    <button
                      onClick={() => openCompleteModal(card)}
                      disabled={isProcessing}
                      style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', color: '#10b981', padding: '8px 12px', borderRadius: '10px', fontSize: '0.7rem', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', transition: '0.2s' }}
                      className="btn-green card-action-btn"
                    >
                      <CheckCircle size={11} /> ЗАВЕРШИТИ
                    </button>
                  </div>
                )}
              </div>

            </div>
          )
        })
      )}
    </div>
  )
}
