import React from 'react'
import { Truck } from 'lucide-react'

export const WarehousePendingReceptionBanner = ({
  pendingDocsCount,
  onOpenReception
}) => {
  if (!pendingDocsCount || pendingDocsCount <= 0) return null

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.15), rgba(2, 132, 199, 0.05))',
      border: '1px solid rgba(14, 165, 233, 0.3)',
      borderRadius: '20px',
      padding: '15px 25px',
      marginBottom: '25px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      boxShadow: '0 4px 20px rgba(14, 165, 233, 0.15)',
      animation: 'warehouse-reception-attention 1.4s ease-in-out infinite',
      willChange: 'opacity',
      flexWrap: 'wrap',
      gap: '15px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
        <div style={{ background: '#0ea5e9', padding: '12px', borderRadius: '14px', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Truck size={22} />
        </div>
        <div>
          <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#fff' }}>
            У ВАС Є НОВІ ПОСТАВКИ ДЛЯ ПРИЙОМКИ!
          </h4>
          <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#888' }}>
            Очікує підтвердження: <strong style={{ color: '#0ea5e9' }}>{pendingDocsCount}</strong> документ(ів)
          </p>
        </div>
      </div>
      <button
        onClick={onOpenReception}
        style={{
          background: '#0ea5e9', color: '#000', border: 'none',
          padding: '12px 24px', borderRadius: '12px', fontWeight: 900,
          fontSize: '0.8rem', cursor: 'pointer', textTransform: 'uppercase',
          boxShadow: '0 4px 12px rgba(14, 165, 233, 0.3)', transition: '0.2s',
          letterSpacing: '0.05em'
        }}
      >
        Відкрити прийомку
      </button>
    </div>
  )
}
