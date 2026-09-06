import React from 'react'
import { Package, Printer } from 'lucide-react'
import { PALLET_COLORS } from '../utils/shippingHelpers'

export const ShippedBatchCard = React.memo(({ batch, onViewPackingSlip, handleViewPackingSlip }) => {
  const handleView = onViewPackingSlip || handleViewPackingSlip
  const colorObj = PALLET_COLORS.find(c => c.id === batch.batchColor)
  return (
    <div className="shipped-batch-card" style={{
      background: 'var(--card-bg, #0d0d0d)', border: '1px solid var(--border, #1a1a1a)', borderRadius: '20px',
      padding: '18px 20px', position: 'relative', overflow: 'hidden'
    }}>
      {colorObj && (
        <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: colorObj.hex, borderRadius: '20px 0 0 20px' }} />
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: '0.95rem', fontWeight: 900, color: 'var(--text, #888)' }}>#{batch.orderNum} · Партія {batch.batchIndex}</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #444)', marginTop: '3px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>{batch.customer && batch.customer !== '—' ? batch.customer : 'Клієнт не вказаний'}</span>
            {batch.plannedSets > 0 && (
              <span style={{ color: '#ff9000', fontWeight: 800 }}>({batch.plannedSets} компл.)</span>
            )}
          </div>
          {batch.productNames && (
            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary, #666)', marginTop: '3px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Package size={12} color="#888" />
              <span>{batch.productNames}</span>
            </div>
          )}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.6rem', color: '#10b981', fontWeight: 800, background: '#10b98110', padding: '4px 8px', borderRadius: '6px' }}>ВІДПРАВЛЕНО</div>
          {batch.shippedAt && (
            <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary, #333)', marginTop: '4px' }}>
              {new Date(batch.shippedAt).toLocaleDateString('uk-UA')}
            </div>
          )}
        </div>
      </div>
      <div style={{ marginTop: '14px', borderTop: '1px dashed var(--border, #1a1a1a)', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {batch.ttn && (
            <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary, #555)', background: 'var(--card-inner-bg, #111)', padding: '3px 8px', borderRadius: '6px', fontWeight: 700 }}>
              ТТН: {batch.ttn}
            </span>
          )}
          {batch.shippingType && (
            <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary, #555)', background: 'var(--card-inner-bg, #111)', padding: '3px 8px', borderRadius: '6px', fontWeight: 700 }}>
              {batch.shippingType}
            </span>
          )}
          {batch.shippedBy && (
            <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary, #555)', background: 'var(--card-inner-bg, #111)', padding: '3px 8px', borderRadius: '6px', fontWeight: 700 }}>
              👤 {batch.shippedBy}
            </span>
          )}
        </div>
        <button
          onClick={() => handleView && handleView(batch)}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,144,0,0.1)', border: '1px solid rgba(255,144,0,0.2)', color: '#ff9000', borderRadius: '8px', padding: '5px 10px', fontSize: '0.65rem', fontWeight: 800, cursor: 'pointer', transition: '0.2s' }}
          onMouseEnter={e => { e.currentTarget.style.background = '#ff9000'; e.currentTarget.style.color = '#000' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,144,0,0.1)'; e.currentTarget.style.color = '#ff9000' }}
        >
          <Printer size={12} /> Лист {batch.packingSlipNumber ? `№${batch.packingSlipNumber}` : ''}
        </button>
      </div>
    </div>
  )
})

export default ShippedBatchCard

