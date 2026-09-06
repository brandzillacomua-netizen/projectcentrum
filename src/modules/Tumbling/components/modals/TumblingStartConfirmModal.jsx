import React from 'react'
import { Play, X, RefreshCw } from 'lucide-react'

export default function TumblingStartConfirmModal({
  pendingStartCard,
  onClose,
  onConfirm,
  getNextTumblingOperation,
  getNom,
  isProcessing
}) {
  if (!pendingStartCard) return null

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10050, padding: '20px', backdropFilter: 'blur(10px)' }}>
      <div style={{ background: 'var(--card-bg, #0e0e12)', width: '100%', maxWidth: '420px', borderRadius: '28px', border: '1px solid rgba(6,182,212,0.25)', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }}>

        {/* Header */}
        <div style={{ padding: '20px 24px', background: 'rgba(6,182,212,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(6,182,212,0.1)' }}>
          <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 950, color: '#06b6d4', display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'uppercase' }}>
            <Play size={16} fill="currentColor" /> Взяти в {getNextTumblingOperation(pendingStartCard.operation)}
          </h3>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted, #555)', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Card info block */}
          <div style={{ background: 'var(--bg, rgba(255,255,255,0.02))', border: '1px solid var(--glass-border, rgba(255,255,255,0.05))', borderRadius: '16px', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.6rem', color: '#ff9000', fontWeight: 900, textTransform: 'uppercase' }}>
                #{pendingStartCard.id.slice(-8).toUpperCase()}
              </span>
              {(() => {
                const seqMatch = (pendingStartCard.card_info || '').match(/(\d+\/\d+)/)
                return seqMatch ? (
                  <span style={{ background: 'rgba(255,144,0,0.15)', color: '#ff9000', border: '1px solid rgba(255,144,0,0.3)', padding: '2px 6px', borderRadius: '5px', fontSize: '0.58rem', fontWeight: 950 }}>
                    {seqMatch[1]}
                  </span>
                ) : null
              })()}
            </div>
            <div style={{ fontSize: '1rem', fontWeight: 900, color: 'var(--text, #fff)' }}>
              {getNom(pendingStartCard)?.name || 'Деталь'}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #6b7280)', fontWeight: 700 }}>
              К-сть: <strong style={{ color: 'var(--text, #fff)' }}>{pendingStartCard.quantity} шт</strong>
              {pendingStartCard.machine ? <> · Верстат: <span style={{ color: 'var(--text-sub, #aaa)' }}>{pendingStartCard.machine}</span></> : null}
            </div>
          </div>

          <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted, #9ca3af)', fontWeight: 600, textAlign: 'center', lineHeight: 1.5 }}>
            Підтвердіть що картка переходить у роботу на <strong style={{ color: 'var(--text, #fff)' }}>{getNextTumblingOperation(pendingStartCard.operation)}</strong>.
          </p>

          {/* Buttons */}
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={onClose}
              disabled={isProcessing}
              style={{ flex: 1, background: 'var(--bg, #1a1a1f)', border: '1px solid var(--glass-border, rgba(255,255,255,0.05))', color: 'var(--text-sub, #aaa)', padding: '14px', borderRadius: '14px', fontSize: '0.8rem', fontWeight: 900, cursor: 'pointer' }}
            >
              СКАСУВАТИ
            </button>
            <button
              onClick={() => onConfirm(pendingStartCard)}
              disabled={isProcessing}
              style={{ flex: 2, background: '#06b6d4', border: 'none', color: '#000', padding: '14px', borderRadius: '14px', fontSize: '0.9rem', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 4px 16px rgba(6,182,212,0.25)' }}
            >
              {isProcessing ? <RefreshCw size={15} className="anim-spin" /> : <><Play size={15} fill="currentColor" /> В РОБОТУ</>}
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
