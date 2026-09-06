import React from 'react'
import { Play, X, RefreshCw } from 'lucide-react'

const ACCENT = '#34d399'
const ACCENT_RGB = '52,211,153'

export default function SortingStartConfirmModal({
  pendingStartCard,
  setPendingStartCard,
  isProcessing,
  startSortingCard,
  getNom
}) {
  if (!pendingStartCard) return null

  return (
    <div className="terminal-modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10050, padding: '20px', backdropFilter: 'blur(10px)' }}>
      <div className="terminal-modal-card" style={{ background: '#0e0e12', width: '100%', maxWidth: '420px', borderRadius: '28px', border: `1px solid rgba(${ACCENT_RGB},0.25)`, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }}>
        <div style={{ padding: '20px 24px', background: `rgba(${ACCENT_RGB},0.06)`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid rgba(${ACCENT_RGB},0.1)` }}>
          <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 950, color: ACCENT, display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'uppercase' }}>
            <Play size={16} fill="currentColor" /> Взяти на Сортування
          </h3>
          <button onClick={() => setPendingStartCard(null)} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer' }}><X size={20} /></button>
        </div>
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '16px', padding: '16px 18px' }}>
            <div style={{ fontSize: '0.6rem', color: '#ff9000', fontWeight: 900 }}>#{pendingStartCard.id.slice(-8).toUpperCase()}</div>
            <div style={{ fontSize: '1rem', fontWeight: 900, color: '#fff', marginTop: '6px' }}>{getNom(pendingStartCard)?.name || 'Деталь'}</div>
            <div style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 700, marginTop: '4px' }}>К-сть: <strong style={{ color: '#fff' }}>{pendingStartCard.quantity} шт</strong></div>
          </div>
          <p style={{ margin: 0, fontSize: '0.82rem', color: '#9ca3af', fontWeight: 600, textAlign: 'center' }}>
            Підтвердіть що картка переходить у <strong style={{ color: '#fff' }}>Сортування</strong>.
          </p>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={() => setPendingStartCard(null)} disabled={isProcessing} style={{ flex: 1, background: '#1a1a1f', border: '1px solid rgba(255,255,255,0.05)', color: '#aaa', padding: '14px', borderRadius: '14px', fontSize: '0.8rem', fontWeight: 900, cursor: 'pointer' }}>
              СКАСУВАТИ
            </button>
            <button onClick={() => startSortingCard(pendingStartCard)} disabled={isProcessing} style={{ flex: 2, background: ACCENT, border: 'none', color: '#000', padding: '14px', borderRadius: '14px', fontSize: '0.9rem', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              {isProcessing ? <RefreshCw size={15} className="anim-spin" /> : <><Play size={15} fill="currentColor" /> СОРТУВАТИ</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
