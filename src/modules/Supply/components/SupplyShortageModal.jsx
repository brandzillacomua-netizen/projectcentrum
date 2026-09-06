import React from 'react'
import { AlertTriangle } from 'lucide-react'

export const SupplyShortageModal = ({
  shortageModal,
  setShortageModal,
  isProcessing,
  handleManualShortagePR,
  confirmForwardToProcurement
}) => {
  if (!shortageModal) return null

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: 'var(--modal-bg, #111)', border: '1px solid var(--modal-border, #333)', borderRadius: '24px', padding: '30px', width: '100%', maxWidth: '450px' }}>
        <h3 style={{ color: '#ef4444', margin: '0 0 15px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <AlertTriangle size={24} /> ПІДТВЕРДЖЕННЯ ЗАКУПІВЛІ
        </h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted, #888)', marginBottom: '20px' }}>
          На СВ не вистачає наступних позицій. Буде надіслано запит у відділ Постачання лише на дефіцитну кількість:
        </p>
        <div style={{ background: 'var(--card-inner-bg, #000)', padding: '15px', borderRadius: '12px', marginBottom: '25px', maxHeight: '300px', overflowY: 'auto' }}>
          {shortageModal.deficitItems?.map((i, idx) => (
            <div key={idx} style={{ fontSize: '0.85rem', marginBottom: '10px', borderBottom: '1px solid var(--border-color, #111)', paddingBottom: '8px' }}>
              <div style={{ fontWeight: 700, color: 'var(--text-color, #aaa)', marginBottom: '5px' }}>{i.name}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted, #555)' }}>Потрібно: <strong style={{ color: 'var(--text-color, #888)' }}>{Number(i.qty || i.needed || 0)}</strong></div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted, #555)' }}>В наявності: <strong style={{ color: '#10b981' }}>{Number(i.available ?? i.stock ?? 0)}</strong></div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', paddingTop: '5px', borderTop: '1px dashed var(--border-color, #222)' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 900, color: 'var(--text-muted, #666)' }}>ДЕФІЦИТ (ДО ЗАКУПІВЛІ):</span>
                <strong style={{ color: '#ef4444', fontSize: '0.9rem' }}>{Number(i.missing || i.missingAmount || 0)} од.</strong>
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => setShortageModal(null)}
            style={{ flex: 1, padding: '12px', borderRadius: '10px', background: 'var(--btn-ghost-bg, #222)', color: 'var(--text-color, #fff)', border: 'none', cursor: 'pointer', fontWeight: 800 }}
          >
            НАЗАД
          </button>
          <button
            onClick={shortageModal.draftItems ? handleManualShortagePR : confirmForwardToProcurement}
            style={{ flex: 2, padding: '12px', borderRadius: '10px', background: '#ef4444', color: '#fff', border: 'none', fontWeight: 950, cursor: 'pointer' }}
          >
            {isProcessing ? 'ОБРОБКА...' : 'НАДІСЛАТИ ЗАПИТ'}
          </button>
        </div>
      </div>
    </div>
  )
}
