import React from 'react'
import { Layers, Clock, Play, CheckCircle } from 'lucide-react'
import { ACCENT, ACCENT_RGB } from '../hooks/usePaintingTerminalData'

export default function PaintingTerminalCardList({
  displayedCards,
  getNom,
  formatDuration,
  setPendingStartCard,
  openCompleteModal,
  isProcessing
}) {
  return (
    <div style={{ flex: 1, padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }} className="custom-scroll cards-container">
      {displayedCards.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.15, padding: '50px 0' }}>
          <Layers size={48} />
          <h3 style={{ fontSize: '0.8rem', fontWeight: 800, marginTop: '10px' }}>Картки відсутні</h3>
        </div>
      ) : (
        displayedCards.map(card => {
          const nom = getNom(card)
          const isWaiting = card.type === 'waiting'
          const timeStr = isWaiting
            ? (card.completed_at ? formatDuration(card.completed_at) : '—')
            : formatDuration(card.started_at)

          return (
            <div key={card.id} style={{ background: 'var(--card-bg, #111116)', border: '1px solid var(--glass-border, rgba(255,255,255,0.03))', borderRadius: '16px', padding: '14px 16px', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '12px', position: 'relative' }} className="hover-lift painting-card">
              <div style={{ position: 'absolute', left: 0, top: '12px', bottom: '12px', width: '3px', background: isWaiting ? '#f59e0b' : ACCENT, borderRadius: '0 3px 3px 0' }} />
              <div style={{ flex: '1 1 200px', paddingLeft: '6px', minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.62rem', color: '#ff9000', fontWeight: 900, textTransform: 'uppercase' }} className="card-code">
                    Картка #{card.id.slice(-8).toUpperCase()}
                  </span>
                  {(() => {
                    const seqMatch = (card.card_info || '').match(/(\d+\/\d+)/)
                    return seqMatch ? (
                      <span style={{ background: 'rgba(255,144,0,0.15)', color: '#ff9000', border: '1px solid rgba(255,144,0,0.3)', padding: '1px 4px', borderRadius: '4px', fontSize: '0.58rem', fontWeight: 950 }} className="card-seq">{seqMatch[1]}</span>
                    ) : null
                  })()}
                  {isWaiting ? (
                    <span style={{ fontSize: '0.55rem', background: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.25)', padding: '1px 6px', borderRadius: '4px', fontWeight: 900 }}>
                      Буфер
                    </span>
                  ) : (
                    <span style={{ fontSize: '0.55rem', background: `rgba(${ACCENT_RGB},0.12)`, color: ACCENT, border: `1px solid rgba(${ACCENT_RGB},0.25)`, padding: '1px 6px', borderRadius: '4px', fontWeight: 900 }}>
                      У роботі
                    </span>
                  )}
                </div>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text, #fff)', margin: '0 0 6px 0', lineHeight: 1.3, wordBreak: 'break-word' }} className="card-title">
                  {nom?.name || 'Невказана деталь'}
                </h4>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }} className="card-details">
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted, #6b7280)', fontWeight: 700 }}>
                    К-сть: <strong style={{ color: 'var(--text, #fff)' }}>{card.quantity} шт</strong>
                  </span>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted, #6b7280)', fontWeight: 700 }}>
                    Виконавець: <span style={{ color: 'var(--text-sub, #aaa)' }}>{(card.operator_name || 'Не вказано').split(' (')[0]}</span>
                  </span>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted, #6b7280)', fontWeight: 700 }}>
                    Зміна: <span style={{ color: 'var(--text-sub, #aaa)' }}>{card.shift_name || '—'}</span>
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: '10px', width: '100%', borderTop: '1px solid var(--glass-border, rgba(255,255,255,0.02))', paddingTop: '8px', marginTop: '4px' }} className="card-mobile-footer">
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: isWaiting ? 'var(--text-muted, #6b7280)' : ACCENT, fontSize: '0.68rem', fontWeight: 900, fontFamily: 'monospace' }} className="card-timer">
                  <Clock size={12} /> {timeStr}
                </div>
                {isWaiting ? (
                  <button
                    onClick={() => setPendingStartCard(card)}
                    disabled={isProcessing}
                    style={{ background: `rgba(${ACCENT_RGB},0.1)`, border: `1px solid rgba(${ACCENT_RGB},0.2)`, color: ACCENT, padding: '6px 12px', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                    className="action-btn"
                  >
                    <Play size={10} fill="currentColor" /> В РОБОТУ
                  </button>
                ) : (
                  <button
                    onClick={() => openCompleteModal(card)}
                    disabled={isProcessing}
                    style={{ background: `rgba(${ACCENT_RGB},0.1)`, border: `1px solid rgba(${ACCENT_RGB},0.2)`, color: ACCENT, padding: '6px 12px', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                    className="action-btn"
                  >
                    <CheckCircle size={10} /> ЗАВЕРШИТИ
                  </button>
                )}
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
