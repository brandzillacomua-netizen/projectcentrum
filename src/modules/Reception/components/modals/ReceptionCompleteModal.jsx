import React from 'react'
import { CheckCircle, X, RefreshCw } from 'lucide-react'

export default function ReceptionCompleteModal({
  showCompleteModal,
  activeCompletingCard,
  onClose,
  finishedCount,
  setFinishedCount,
  scrapCount,
  setScrapCount,
  submitReceptionComplete,
  getNom,
  isProcessing
}) {
  if (!showCompleteModal || !activeCompletingCard) return null

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px', backdropFilter: 'blur(8px)' }}>
      <div style={{ background: 'var(--card-bg, #0e0e11)', width: '100%', maxWidth: '420px', borderRadius: '28px', border: '1px solid rgba(16,185,129,0.2)', overflow: 'hidden', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
        <div style={{ padding: '20px 24px', background: 'rgba(255,255,255,0.01)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--glass-border, rgba(255,255,255,0.04))' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 950, color: '#10b981', display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'uppercase' }}>
              <CheckCircle size={16} /> Завершити Прийомку
            </h3>
            <div style={{ fontSize: '0.62rem', color: 'var(--text-muted, #555)', marginTop: '2px', fontWeight: 800 }}>Картка #{activeCompletingCard.id.slice(-8).toUpperCase()}</div>
          </div>
          <button onClick={onClose} disabled={isProcessing} style={{ background: 'none', border: 'none', color: 'var(--text-muted, #555)', cursor: 'pointer' }}><X size={20} /></button>
        </div>
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ background: 'var(--bg, rgba(255,255,255,0.01))', border: '1px solid var(--glass-border, rgba(255,255,255,0.03))', padding: '12px 16px', borderRadius: '12px' }}>
            <div style={{ fontSize: '0.55rem', color: 'var(--text-muted, #555)', fontWeight: 900, textTransform: 'uppercase', marginBottom: '4px' }}>Деталь</div>
            <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text, #fff)' }}>{getNom(activeCompletingCard)?.name || 'Невказана деталь'}</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.65rem', color: 'var(--text-muted, #888)', fontWeight: 800, textTransform: 'uppercase', marginBottom: '6px' }}>Прийнято (шт)</label>
              <input
                type="number" min="0" max={activeCompletingCard.quantity || 0}
                value={finishedCount}
                onChange={e => { const val = Math.max(0, parseInt(e.target.value) || 0); setFinishedCount(val); setScrapCount(Math.max(0, (activeCompletingCard.quantity || 0) - val)) }}
                style={{ background: 'var(--input-bg, #121216)', border: '1px solid var(--glass-border, rgba(255,255,255,0.05))', color: 'var(--text, #fff)', padding: '10px 14px', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 800, outline: 'none', width: '100%', textAlign: 'center' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.65rem', color: '#ef4444', fontWeight: 800, textTransform: 'uppercase', marginBottom: '6px' }}>Брак (шт)</label>
              <input
                type="number" min="0" max={activeCompletingCard.quantity || 0}
                value={scrapCount}
                onChange={e => { const val = Math.max(0, parseInt(e.target.value) || 0); setScrapCount(val); setFinishedCount(Math.max(0, (activeCompletingCard.quantity || 0) - val)) }}
                style={{ background: 'var(--input-bg, #121216)', border: '1px solid var(--glass-border, rgba(255,255,255,0.05))', color: '#ef4444', padding: '10px 14px', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 800, outline: 'none', width: '100%', textAlign: 'center' }}
              />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--text-muted, #6b7280)', fontWeight: 800, borderTop: '1px solid var(--glass-border, rgba(255,255,255,0.02))', paddingTop: '12px' }}>
            <span>Разом по картці:</span>
            <span style={{ color: 'var(--text, #fff)' }}>{activeCompletingCard.quantity || 0} шт</span>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={onClose} disabled={isProcessing} style={{ flex: 1, background: 'var(--bg, #1a1a1f)', border: '1px solid var(--glass-border, rgba(255,255,255,0.03))', color: 'var(--text, #fff)', padding: '12px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 900, cursor: 'pointer' }}>СКАСУВАТИ</button>
            <button onClick={submitReceptionComplete} disabled={isProcessing} style={{ flex: 1, background: '#10b981', border: 'none', color: '#000', padding: '12px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              {isProcessing ? <RefreshCw size={14} className="anim-spin" /> : <><CheckCircle size={14} /> ПЕРЕДАТИ НА СОРТУВАННЯ</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
