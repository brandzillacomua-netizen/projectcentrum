import React from 'react'
import { AlertTriangle } from 'lucide-react'

export const ShortageModal = ({
  shortages,
  setShortages,
  isProcessing,
  sendPurchaseRequest
}) => {
  if (!shortages) return null

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: '#111', border: '1px solid #333', borderRadius: '24px', padding: '30px', width: '100%', maxWidth: '400px' }}>
        <h3 style={{ color: '#ef4444', margin: '0 0 15px', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.05rem', fontWeight: 900 }}>
          <AlertTriangle size={20} /> ДЕФІЦИТ МАТЕРІАЛІВ
        </h3>
        <p style={{ fontSize: '0.8rem', color: '#aaa', margin: '0 0 20px', lineHeight: 1.4 }}>
          Для наряду <strong style={{ color: '#fff' }}>#{shortages.orderNum}</strong> не вистачає наступних матеріалів:
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '200px', overflowY: 'auto', marginBottom: '25px', paddingRight: '5px' }}>
          {shortages.items.map((item, idx) => (
            <div key={idx} style={{ background: '#000', padding: '12px', borderRadius: '12px', border: '1px solid #222', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.78rem', color: '#888', fontWeight: 700 }}>{item.reqDetails || item.name}</span>
              <strong style={{ fontSize: '0.85rem', color: '#ef4444' }}>{item.missingAmount} од.</strong>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => setShortages(null)}
            style={{ flex: 1, padding: '12px', borderRadius: '12px', background: '#222', color: '#fff', border: 'none', fontWeight: 800, cursor: 'pointer', fontSize: '0.8rem' }}
          >
            СКАСУВАТИ
          </button>
          <button
            disabled={isProcessing}
            onClick={sendPurchaseRequest}
            style={{
              flex: 2, padding: '12px', borderRadius: '12px',
              background: '#ef4444', color: '#000', border: 'none',
              fontWeight: 900, cursor: isProcessing ? 'not-allowed' : 'pointer',
              fontSize: '0.8rem', opacity: isProcessing ? 0.5 : 1
            }}
          >
            {isProcessing ? 'НАДСИЛАННЯ...' : 'ЗАМОВИТИ НА СВ'}
          </button>
        </div>
      </div>
    </div>
  )
}
