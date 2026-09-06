import React from 'react'
import { Play, X, RefreshCw } from 'lucide-react'
import { ACCENT, ACCENT_RGB } from '../../hooks/useReceptionTerminalData'

export default function ReceptionStartConfirmModal({
  pendingStartCard,
  onClose,
  startReceptionCard,
  getNom,
  isProcessing
}) {
  if (!pendingStartCard) return null

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10050, padding: '20px', backdropFilter: 'blur(10px)' }}>
      <div style={{ background: 'var(--card-bg, #0e0e12)', width: '100%', maxWidth: '420px', borderRadius: '28px', border: `1px solid rgba(${ACCENT_RGB},0.25)`, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }}>
        <div style={{ padding: '20px 24px', background: `rgba(${ACCENT_RGB},0.06)`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid rgba(${ACCENT_RGB},0.1)` }}>
          <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 950, color: ACCENT, display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'uppercase' }}>
            <Play size={16} fill="currentColor" /> Взяти на Прийомку
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted, #555)', cursor: 'pointer' }}><X size={20} /></button>
        </div>
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div style={{ background: 'var(--bg, rgba(255,255,255,0.02))', border: '1px solid var(--glass-border, rgba(255,255,255,0.05))', borderRadius: '16px', padding: '16px 18px' }}>
            <div style={{ fontSize: '0.6rem', color: '#ff9000', fontWeight: 900 }}>#{pendingStartCard.id.slice(-8).toUpperCase()}</div>
            <div style={{ fontSize: '1rem', fontWeight: 900, color: 'var(--text, #fff)', marginTop: '6px' }}>{getNom(pendingStartCard)?.name || 'Деталь'}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #6b7280)', fontWeight: 700, marginTop: '4px' }}>К-сть: <strong style={{ color: 'var(--text, #fff)' }}>{pendingStartCard.quantity} шт</strong></div>
          </div>
          <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted, #9ca3af)', fontWeight: 600, textAlign: 'center' }}>
            Підтвердіть що картка переходить у <strong style={{ color: 'var(--text, #fff)' }}>Прийомку</strong>.
          </p>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={onClose} disabled={isProcessing} style={{ flex: 1, background: 'var(--bg, #1a1a1f)', border: '1px solid var(--glass-border, rgba(255,255,255,0.05))', color: 'var(--text-sub, #aaa)', padding: '14px', borderRadius: '14px', fontSize: '0.8rem', fontWeight: 900, cursor: 'pointer' }}>
              СКАСУВАТИ
            </button>
            <button onClick={() => startReceptionCard(pendingStartCard)} disabled={isProcessing} style={{ flex: 2, background: ACCENT, border: 'none', color: '#000', padding: '14px', borderRadius: '14px', fontSize: '0.9rem', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              {isProcessing ? <RefreshCw size={15} className="anim-spin" /> : <><Play size={15} fill="currentColor" /> ПРИЙНЯТИ</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
