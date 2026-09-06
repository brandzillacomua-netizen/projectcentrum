import React from 'react'
import { Layers, Clock, Play, CheckCircle } from 'lucide-react'
import { ACCENT, ACCENT_RGB } from '../hooks/useReceptionTerminalData'

export default function ReceptionTerminalCardList({
  displayedCards,
  getNom,
  formatDuration,
  setPendingStartCard,
  openCompleteModal,
  isProcessing
}) {
  return (
    <div style={{ flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }} className="custom-scroll">
      {displayedCards.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.15, padding: '50px 0' }}>
          <Layers size={64} />
          <h3 style={{ fontSize: '0.85rem', fontWeight: 800, marginTop: '12px' }}>Немає карток для Прийомки</h3>
        </div>
      ) : (
        displayedCards.map(card => {
          const nom = getNom(card)
          const isWaiting = card.type === 'waiting'
          const timeStr = isWaiting
            ? (card.completed_at ? formatDuration(card.completed_at) : '—')
            : formatDuration(card.started_at)

          return (
            <div key={card.id} style={{ background: 'var(--card-bg, #111116)', border: '1px solid var(--glass-border, rgba(255,255,255,0.03))', borderRadius: '18px', padding: '16px 18px', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '16px', position: 'relative' }} className="hover-lift">
              <div style={{ position: 'absolute', left: 0, top: '15px', bottom: '15px', width: '3px', background: isWaiting ? '#f59e0b' : '#10b981', borderRadius: '0 3px 3px 0' }} />
              <div style={{ flex: '1 1 300px', paddingLeft: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.62rem', color: '#ff9000', fontWeight: 900, textTransform: 'uppercase' }}>
                    Картка #{card.id.slice(-8).toUpperCase()}
                  </span>
                  {(() => {
                    const seqMatch = (card.card_info || '').match(/(\d+\/\d+)/)
                    return seqMatch ? (
                      <span style={{ background: 'rgba(255,144,0,0.15)', color: '#ff9000', border: '1px solid rgba(255,144,0,0.3)', padding: '2px 6px', borderRadius: '6px', fontSize: '0.6rem', fontWeight: 950 }}>{seqMatch[1]}</span>
                    ) : null
                  })()}
                  {isWaiting ? (
                    <span style={{ fontSize: '0.55rem', background: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.25)', padding: '2px 8px', borderRadius: '6px', fontWeight: 900 }}>
                      Буфер Галтовки
                    </span>
                  ) : (
                    <span style={{ fontSize: '0.55rem', background: 'rgba(16,185,129,0.12)', color: '#10b981', border: '1px solid rgba(16,185,129,0.25)', padding: '2px 8px', borderRadius: '6px', fontWeight: 900 }}>
                      Прийомка
                    </span>
                  )}
                </div>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text, #fff)', margin: '0 0 6px 0', lineHeight: 1.3 }}>
                  {nom?.name || 'Невказана деталь'}
                </h4>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted, #6b7280)', fontWeight: 700 }}>
                    К-сть: <strong style={{ color: 'var(--text, #fff)' }}>{card.quantity} шт</strong>
                  </span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted, #6b7280)', fontWeight: 700 }}>
                    Оператор: <span style={{ color: 'var(--text-sub, #aaa)' }}>{(card.operator_name || 'Не вказано').split(' (')[0]}</span>
                  </span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted, #6b7280)', fontWeight: 700 }}>
                    Зміна: <span style={{ color: 'var(--text-sub, #aaa)' }}>{card.shift_name || '—'}</span>
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px', minWidth: '120px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: isWaiting ? 'var(--text-muted, #6b7280)' : '#10b981', fontSize: '0.68rem', fontWeight: 900, fontFamily: 'monospace' }}>
                  <Clock size={12} /> {timeStr}
                </div>
                {isWaiting ? (
                  <button
                    onClick={() => setPendingStartCard(card)}
                    disabled={isProcessing}
                    style={{ background: `rgba(${ACCENT_RGB},0.1)`, border: `1px solid rgba(${ACCENT_RGB},0.2)`, color: ACCENT, padding: '8px 12px', borderRadius: '10px', fontSize: '0.7rem', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Play size={11} fill="currentColor" /> ПРИЙНЯТИ
                  </button>
                ) : (
                  <button
                    onClick={() => openCompleteModal(card)}
                    disabled={isProcessing}
                    style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', color: '#10b981', padding: '8px 12px', borderRadius: '10px', fontSize: '0.7rem', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <CheckCircle size={11} /> ЗАВЕРШИТИ
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
