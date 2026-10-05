import React from 'react'
import { CheckCircle, X, RefreshCw } from 'lucide-react'

const ACCENT = '#34d399'
const ACCENT_RGB = '52,211,153'

export default function SortingCompleteModal({
  showCompleteModal,
  setShowCompleteModal,
  activeCompletingCard,
  isProcessing,
  getNom,
  finishedCount,
  setFinishedCount,
  scrapCount,
  setScrapCount,
  reworkCount,
  setReworkCount,
  submitSortingComplete,
  scanError
}) {
  if (!showCompleteModal || !activeCompletingCard) return null

  const totalQty = activeCompletingCard.quantity || 0

  return (
    <div className="terminal-modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px', backdropFilter: 'blur(8px)' }}>
      <div className="terminal-modal-card" style={{ background: '#0e0e11', width: '100%', maxWidth: '420px', borderRadius: '28px', border: `1px solid rgba(${ACCENT_RGB},0.2)`, overflow: 'hidden', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
        <div style={{ padding: '20px 24px', background: 'var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 950, color: ACCENT, display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'uppercase' }}>
              <CheckCircle size={16} /> Завершити Сортування
            </h3>
            <div style={{ fontSize: '0.62rem', color: 'var(--text-dim)', marginTop: '2px', fontWeight: 800 }}>Картка #{activeCompletingCard.id.slice(-8).toUpperCase()}</div>
          </div>
          <button onClick={() => setShowCompleteModal(false)} disabled={isProcessing} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer' }}><X size={20} /></button>
        </div>
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ background: 'var(--border-subtle)', border: '1px solid var(--border-subtle)', padding: '12px 16px', borderRadius: '12px' }}>
            <div style={{ fontSize: '0.55rem', color: 'var(--text-dim)', fontWeight: 900, textTransform: 'uppercase', marginBottom: '4px' }}>Деталь</div>
            <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-strong)' }}>{getNom(activeCompletingCard)?.name || 'Невказана деталь'}</div>
          </div>
          {/* OK and Scrap inputs */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', marginBottom: '6px' }}>В Цех №2 (OK)</label>
              <input
                type="number" min="0" max={totalQty - reworkCount}
                value={finishedCount}
                onChange={e => { const val = Math.max(0, parseInt(e.target.value) || 0); setFinishedCount(val); setScrapCount(Math.max(0, totalQty - reworkCount - val)) }}
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)', color: 'var(--text-strong)', padding: '10px 14px', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 800, outline: 'none', width: '100%', textAlign: 'center' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.65rem', color: '#ef4444', fontWeight: 800, textTransform: 'uppercase', marginBottom: '6px' }}>Брак (шт)</label>
              <input
                type="number" min="0" max={totalQty - reworkCount}
                value={scrapCount}
                onChange={e => { const val = Math.max(0, parseInt(e.target.value) || 0); setScrapCount(val); setFinishedCount(Math.max(0, totalQty - reworkCount - val)) }}
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)', color: '#ef4444', padding: '10px 14px', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 800, outline: 'none', width: '100%', textAlign: 'center' }}
              />
            </div>
          </div>
          {/* Rework counter */}
          <div style={{ background: 'var(--surface-inset)', borderRadius: '12px', padding: '14px', border: '1px solid #f59e0b22' }}>
            <label style={{ display: 'block', fontSize: '0.65rem', color: '#f59e0b', fontWeight: 800, textTransform: 'uppercase', marginBottom: '10px', textAlign: 'center' }}>НА ДООПРАЦЮВАННЯ (Цех №2)</label>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
              <button onClick={() => { const n = Math.max(0, reworkCount - 1); setReworkCount(n); setFinishedCount(Math.max(0, totalQty - scrapCount - n)) }}
                style={{ width: '40px', height: '40px', background: 'var(--surface-2)', border: '1px solid var(--border-subtle)', color: 'var(--text-strong)', borderRadius: '8px', fontSize: '1.2rem', cursor: 'pointer' }}>−</button>
              <input type="number" min={0} max={totalQty - scrapCount} value={reworkCount === 0 ? '' : reworkCount} placeholder="0"
                onChange={e => { const val = Math.max(0, parseInt(e.target.value) || 0); setReworkCount(val); setFinishedCount(Math.max(0, totalQty - scrapCount - val)) }}
                style={{ background: 'transparent', border: 'none', color: '#f59e0b', fontSize: '2.5rem', width: '80px', textAlign: 'center', fontWeight: 900 }} />
              <button onClick={() => { const n = Math.min(totalQty - scrapCount, reworkCount + 1); setReworkCount(n); setFinishedCount(Math.max(0, totalQty - scrapCount - n)) }}
                style={{ width: '40px', height: '40px', background: 'var(--surface-2)', border: '1px solid var(--border-subtle)', color: 'var(--text-strong)', borderRadius: '8px', fontSize: '1.2rem', cursor: 'pointer' }}>+</button>
            </div>
          </div>
          <div style={{ background: `rgba(${ACCENT_RGB},0.06)`, border: `1px solid rgba(${ACCENT_RGB},0.15)`, borderRadius: '10px', padding: '10px 14px', fontSize: '0.72rem', color: ACCENT, fontWeight: 800, textAlign: 'center' }}>
            ✅ В Цех №2: <strong>{finishedCount}</strong> · Доопр: <strong style={{color:'#f59e0b'}}>{reworkCount}</strong> · Брак: <strong style={{color:'#ef4444'}}>{scrapCount}</strong> / {totalQty} шт
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: '#6b7280', fontWeight: 800, borderTop: '1px solid var(--border-subtle)', paddingTop: '12px' }}>
            <span>Разом по картці:</span>
            <span style={{ color: 'var(--text-strong)' }}>{totalQty} шт</span>
          </div>

          {scanError && (
            <div style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', borderRadius: '10px', padding: '10px 14px', fontSize: '0.72rem', fontWeight: 800, textAlign: 'center' }}>
              ⚠️ {scanError}
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={() => setShowCompleteModal(false)} disabled={isProcessing} style={{ flex: 1, background: '#1a1a1f', border: '1px solid var(--border-subtle)', color: '#fff', padding: '12px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 900, cursor: 'pointer' }}>СКАСУВАТИ</button>
            <button onClick={submitSortingComplete} disabled={isProcessing} style={{ flex: 1, background: ACCENT, border: 'none', color: '#000', padding: '12px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              {isProcessing ? <RefreshCw size={14} className="anim-spin" /> : <><CheckCircle size={14} /> ПЕРЕДАТИ В ЦЕХ №2</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
