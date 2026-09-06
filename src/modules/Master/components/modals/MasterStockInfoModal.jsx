import React from 'react'
import { Info, X } from 'lucide-react'

export function MasterStockInfoModal({
  stockInfoModalData,
  setStockInfoModalData,
  theme
}) {
  if (!stockInfoModalData) return null
  const isLight = theme === 'light'

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: isLight ? 'rgba(15, 23, 42, 0.65)' : 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(8px)',
        zIndex: 10010,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}
      onClick={() => setStockInfoModalData(null)}
    >
      <style>{`
        .stock-info-scroll::-webkit-scrollbar {
          width: 6px;
        }
        .stock-info-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .stock-info-scroll::-webkit-scrollbar-thumb {
          background: ${isLight ? '#cbd5e1' : '#333333'};
          border-radius: 999px;
        }
        .stock-info-scroll::-webkit-scrollbar-thumb:hover {
          background: ${isLight ? '#94a3b8' : '#555555'};
        }
      `}</style>
      <div
        style={{
          background: isLight ? '#ffffff' : '#0a0a0a',
          border: isLight ? '1px solid #cbd5e1' : '1px solid #333',
          borderRadius: '24px',
          padding: '25px 30px',
          width: '95%',
          maxWidth: '520px',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: isLight ? '0 25px 50px -12px rgba(0, 0, 0, 0.25)' : '0 0 30px rgba(168, 85, 247, 0.25)',
          animation: 'fadeIn 0.2s ease-out'
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', borderBottom: isLight ? '1px solid #e2e8f0' : '1px solid #1a1a1a', paddingBottom: '14px', flexShrink: 0 }}>
          <h3 style={{ margin: 0, fontSize: '1.25rem', color: isLight ? '#9333ea' : '#a855f7', fontWeight: 950, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Info size={20} />
            {stockInfoModalData.title}
          </h3>
          <button
            onClick={() => setStockInfoModalData(null)}
            style={{
              background: isLight ? '#f1f5f9' : '#1a1a1a',
              border: isLight ? '1px solid #cbd5e1' : '1px solid #333',
              color: isLight ? '#64748b' : '#aaa',
              width: '34px',
              height: '34px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <X size={16} />
          </button>
        </div>

        <div className="stock-info-scroll" style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', flex: 1, paddingRight: '4px', scrollBehavior: 'smooth' }}>
          {stockInfoModalData.items.map((item, idx) => (
            <div key={idx} style={{ background: isLight ? '#f8fafc' : '#111', border: isLight ? '1px solid #e2e8f0' : '1px solid #222', borderRadius: '14px', padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <div>
                <div style={{ fontWeight: 900, color: isLight ? '#0f172a' : '#fff', fontSize: '1.05rem' }}>{item.thickness}</div>
                <div style={{ fontSize: '0.75rem', color: isLight ? '#64748b' : '#666', marginTop: '2px' }}>Залишок підготовлених листів</div>
              </div>
              <div style={{ display: 'flex', gap: '15px' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.65rem', color: isLight ? '#16a34a' : '#22c55e', fontWeight: 900, textTransform: 'uppercase' }}>Т300</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 950, color: isLight ? '#16a34a' : '#22c55e' }}>{item.t300} <small style={{ fontSize: '0.65rem' }}>шт</small></div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.65rem', color: isLight ? '#0284c7' : '#0ea5e9', fontWeight: 900, textTransform: 'uppercase' }}>Т700</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 950, color: isLight ? '#0284c7' : '#0ea5e9' }}>{item.t700} <small style={{ fontSize: '0.65rem' }}>шт</small></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
