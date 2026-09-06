import React from 'react'
import { CheckCircle, X, RefreshCw } from 'lucide-react'
import { ACCENT, ACCENT_RGB } from '../../hooks/usePaintingTerminalData'

export default function PaintingCompleteModal({
  showCompleteModal,
  activeCompletingCard,
  onClose,
  finishedCount,
  setFinishedCount,
  scrapCount,
  setScrapCount,
  submitPaintingComplete,
  getNom,
  isProcessing
}) {
  if (!showCompleteModal || !activeCompletingCard) return null

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '16px', backdropFilter: 'blur(8px)' }}>
      <div style={{ background: 'var(--card-bg, #0e0e11)', width: '100%', maxWidth: '400px', borderRadius: '24px', border: `1px solid rgba(${ACCENT_RGB},0.2)`, overflow: 'hidden', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
        <div style={{ padding: '16px 20px', background: 'rgba(255,255,255,0.01)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--glass-border, rgba(255,255,255,0.04))' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 950, color: ACCENT, display: 'flex', alignItems: 'center', gap: '6px', textTransform: 'uppercase' }}>
              <CheckCircle size={14} /> Завершити Фарбування
            </h3>
            <div style={{ fontSize: '0.6rem', color: 'var(--text-muted, #555)', marginTop: '2px', fontWeight: 800 }}>Картка #{activeCompletingCard.id.slice(-8).toUpperCase()}</div>
          </div>
          <button onClick={onClose} disabled={isProcessing} style={{ background: 'none', border: 'none', color: 'var(--text-muted, #555)', cursor: 'pointer' }}><X size={18} /></button>
        </div>
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ background: 'var(--bg, rgba(255,255,255,0.01))', border: '1px solid var(--glass-border, rgba(255,255,255,0.03))', padding: '10px 14px', borderRadius: '10px' }}>
            <div style={{ fontSize: '0.55rem', color: 'var(--text-muted, #555)', fontWeight: 900, textTransform: 'uppercase', marginBottom: '2px' }}>Деталь</div>
            <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text, #fff)' }}>{getNom(activeCompletingCard)?.name || 'Невказана деталь'}</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.62rem', color: 'var(--text-muted, #888)', fontWeight: 800, textTransform: 'uppercase', marginBottom: '4px' }}>Готових (шт)</label>
              <input
                type="number" min="0" max={activeCompletingCard.quantity || 0}
                value={finishedCount}
                onChange={e => { const val = Math.max(0, parseInt(e.target.value) || 0); setFinishedCount(val); setScrapCount(Math.max(0, (activeCompletingCard.quantity || 0) - val)) }}
                style={{ background: 'var(--input-bg, #121216)', border: '1px solid var(--glass-border, rgba(255,255,255,0.05))', color: 'var(--text, #fff)', padding: '10px', borderRadius: '10px', fontSize: '0.8rem', fontWeight: 800, outline: 'none', width: '100%', textAlign: 'center' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.62rem', color: '#ef4444', fontWeight: 800, textTransform: 'uppercase', marginBottom: '4px' }}>Брак (шт)</label>
              <input
                type="number" min="0" max={activeCompletingCard.quantity || 0}
                value={scrapCount}
                onChange={e => { const val = Math.max(0, parseInt(e.target.value) || 0); setScrapCount(val); setFinishedCount(Math.max(0, (activeCompletingCard.quantity || 0) - val)) }}
                style={{ background: 'var(--input-bg, #121216)', border: '1px solid var(--glass-border, rgba(255,255,255,0.05))', color: '#ef4444', padding: '10px', borderRadius: '10px', fontSize: '0.8rem', fontWeight: 800, outline: 'none', width: '100%', textAlign: 'center' }}
              />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--text-muted, #6b7280)', fontWeight: 800, borderTop: '1px solid var(--glass-border, rgba(255,255,255,0.02))', paddingTop: '10px' }}>
            <span>Разом по картці:</span>
            <span style={{ color: 'var(--text, #fff)' }}>{activeCompletingCard.quantity || 0} шт</span>
          </div>
          <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
            <button onClick={onClose} disabled={isProcessing} style={{ flex: 1, background: 'var(--bg, #1a1a1f)', border: '1px solid var(--glass-border, rgba(255,255,255,0.03))', color: 'var(--text, #fff)', padding: '10px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 900, cursor: 'pointer' }}>
              СКАСУВАТИ
            </button>
            <button onClick={submitPaintingComplete} disabled={isProcessing} style={{ flex: 1, background: ACCENT, border: 'none', color: '#000', padding: '10px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
              {isProcessing ? <RefreshCw size={12} className="anim-spin" /> : <><CheckCircle size={12} /> ПІДТВЕРДИТИ</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
