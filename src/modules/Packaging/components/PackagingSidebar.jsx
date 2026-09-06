import React from 'react'
import { ClipboardList, CheckCircle2, Scan, Clock, Package, X } from 'lucide-react'

export const PackagingSidebar = ({
  batchList,
  selectedBatch,
  setSelectedBatch,
  isDrawerOpen,
  setIsDrawerOpen
}) => {
  return (
    <>
      {isDrawerOpen && (
        <div 
          className="drawer-backdrop" 
          onClick={() => setIsDrawerOpen(false)} 
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 99999, backdropFilter: 'blur(4px)' }}
        />
      )}

      {/* SIDEBAR PANEL */}
      <div className={`side-panel glass-panel ${isDrawerOpen ? 'drawer-open' : ''}`} style={{ background: 'var(--card-bg, #ffffff)', padding: '25px', borderRadius: '28px', border: '1px solid var(--glass-border, #cbd5e1)', boxShadow: 'var(--shadow, 0 4px 20px rgba(0,0,0,0.05))', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '25px' }}>
          <ClipboardList size={22} color="#f43f5e" />
          <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text, #0f172a)', fontWeight: 900, textTransform: 'uppercase' }}>Черга нарядів</h3>
          <span style={{ background: '#f43f5e22', color: '#f43f5e', padding: '4px 10px', borderRadius: '10px', fontSize: '0.7rem', fontWeight: 950 }}>{batchList.length}</span>
          {isDrawerOpen && (
            <button onClick={() => setIsDrawerOpen(false)} style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: 'var(--text-muted, #64748b)', cursor: 'pointer' }}>
              <X size={20} />
            </button>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, overflowY: 'auto', paddingRight: '5px' }}>
          {batchList.map(batch => {
            const isSelected = selectedBatch?.key === batch.key
            const isCompleted = batch.packStatus === 'completed'
            const isReady = batch.packStatus === 'ready'
            const isProc = batch.packStatus === 'processing'
            let statusColor = '#d97706', statusBg = 'rgba(217, 119, 6, 0.12)', statusLabel = 'ОЧІКУЄ ЗАПИТУ'
            if (isCompleted) { statusColor = '#64748b'; statusBg = 'var(--card-header-bg, #f1f5f9)'; statusLabel = 'ЗАПАКОВАНО' }
            else if (isReady) { statusColor = '#059669'; statusBg = 'rgba(16, 185, 129, 0.12)'; statusLabel = 'ГОТОВО ДО ПАКУВАННЯ' }
            else if (isProc) { statusColor = '#2563eb'; statusBg = 'rgba(37, 99, 235, 0.12)'; statusLabel = 'ЗАПИТ В ОБРОБЦІ' }

            return (
              <div 
                key={batch.key} 
                onClick={() => { setSelectedBatch(batch); setIsDrawerOpen(false); }} 
                className={`pack-order-card ${isReady ? 'ready-pulse' : ''}`}
                style={{ 
                  flexShrink: 0, 
                  padding: '14px 16px 14px 20px', 
                  background: isSelected ? `${statusColor}14` : (isCompleted ? 'var(--card-header-bg, #f8fafc)' : 'var(--card-bg, #ffffff)'), 
                  border: `1.5px solid ${isSelected ? statusColor : 'var(--border-color, #e2e8f0)'}`, 
                  boxShadow: isSelected ? `0 4px 14px ${statusColor}22` : 'var(--shadow, 0 2px 6px rgba(0,0,0,0.03))',
                  borderRadius: '16px', 
                  cursor: 'pointer', 
                  transition: 'all 0.2s ease', 
                  position: 'relative', 
                  opacity: isCompleted ? 0.5 : 1, 
                  filter: isCompleted ? 'grayscale(0.8)' : 'none', 
                  overflow: 'hidden' 
                }}
              >
                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px', background: statusColor, boxShadow: isSelected ? `2px 0 10px ${statusColor}44` : 'none' }}></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div className="pack-card-order-num" style={{ fontSize: '0.95rem', fontWeight: 900, color: 'var(--text, #0f172a)' }}>№ {batch.orderNum}{batch.batchIndex ? `/${batch.batchIndex}` : ''}</div>
                  <div style={{ background: statusBg, padding: '3px 6px', borderRadius: '6px', fontSize: '0.55rem', color: statusColor, fontWeight: 950, display: 'flex', alignItems: 'center', gap: '3px', border: `1px solid ${statusColor}33` }}>
                    {isCompleted ? <CheckCircle2 size={9} /> : (isReady ? <Scan size={9} /> : <Clock size={9} />)} {statusLabel}
                  </div>
                </div>
                <div className="pack-card-customer" style={{ fontSize: '0.78rem', color: 'var(--text-muted, #64748b)', fontWeight: 700, marginBottom: '2px' }}>{batch.customer}</div>
                <div className="pack-card-product" style={{ fontSize: '0.92rem', color: '#d97706', fontWeight: 900, marginBottom: '10px', lineHeight: 1.2 }}>{batch.productNames}</div>
                <div className="pack-card-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '10px', borderTop: '1px solid var(--border-color, #e2e8f0)', marginTop: '4px' }}>
                  <span className="pack-card-vol-label" style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748b)', fontWeight: 800 }}>ОБСЯГ:</span>
                  <span style={{ fontSize: '0.88rem', color: '#059669', fontWeight: 900 }}>{batch.plannedSets} шт</span>
                </div>
              </div>
            )
          })}
          {batchList.length === 0 && (
            <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted, #64748b)', border: '2px dashed var(--border-color, #cbd5e1)', borderRadius: '24px' }}>
              <Package size={48} style={{ opacity: 0.2, margin: '0 auto 20px' }} />
              <div style={{ fontSize: '0.85rem', fontWeight: 800 }}>Черга порожня</div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
