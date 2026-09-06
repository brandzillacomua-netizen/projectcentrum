import React from 'react'
import { User, Package, Calendar, Truck, ArrowRight } from 'lucide-react'
import { PALLET_COLORS } from '../utils/shippingHelpers'

export const ReadyBatchCard = React.memo(({ batch, onTakeWork, openWorkModal, isProcessing }) => {
  const handleTake = onTakeWork || openWorkModal
  return (
    <div className="batch-card" style={{ position: 'relative' }}>
      {/* Кольорова смуга зліва якщо є колір */}
      {batch.batchColor && (
        <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: PALLET_COLORS.find(c => c.id === batch.batchColor)?.hex || '#888', borderRadius: '28px 0 0 28px' }} />
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div className="batch-order-num" style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--text, #fff)' }}>#{batch.orderNum}</div>
          <div className="batch-index-lbl" style={{ fontSize: '0.65rem', fontWeight: 900, color: 'var(--text-secondary, #555)', marginTop: '2px' }}>ПАРТІЯ {batch.batchIndex}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ background: '#10b98115', color: '#10b981', fontSize: '0.6rem', fontWeight: 900, padding: '5px 10px', borderRadius: '8px' }}>
            ✓ ЗАПАКОВАНО
          </div>
        </div>
      </div>

      <div className="shipping-customer-box" style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'var(--card-inner-bg, #0a0a0a)', padding: '12px 14px', borderRadius: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <User size={14} color="#ff9000" />
            <span className="customer-name-text" style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text, #fff)' }}>
              {batch.customer && batch.customer !== '—' ? batch.customer : 'Клієнт не вказаний'}
            </span>
          </div>
          {batch.plannedSets > 0 && (
            <span style={{ background: 'rgba(255,144,0,0.15)', color: '#ff9000', border: '1px solid rgba(255,144,0,0.3)', padding: '2px 8px', borderRadius: '8px', fontSize: '0.68rem', fontWeight: 900, whiteSpace: 'nowrap', flexShrink: 0 }}>
              {batch.plannedSets} компл.
            </span>
          )}
        </div>

        {batch.productNames && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: 'var(--text-secondary, #888)', fontWeight: 600 }}>
            <Package size={13} color="#ff9000" style={{ flexShrink: 0 }} />
            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{batch.productNames}</span>
          </div>
        )}
      </div>

      {batch.packedBy && (
        <div className="shipping-packed-by" style={{ fontSize: '0.7rem', color: 'var(--text-secondary, #444)', fontWeight: 600 }}>
          📦 Запакував: {batch.packedBy}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '5px', gap: '10px', flexWrap: 'wrap' }}>
        <div className="shipping-deadline" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.7rem', color: 'var(--text-secondary, #444)', fontWeight: 700 }}>
          <Calendar size={12} />
          <span>{batch.deadline ? new Date(batch.deadline).toLocaleDateString('uk-UA') : '—'}</span>
        </div>
        <button
          onClick={() => handleTake && handleTake(batch)}
          disabled={isProcessing}
          className="take-work-btn"
          style={{ whiteSpace: 'nowrap' }}
        >
          <Truck size={16} />
          <span>ВЗЯТИ В РОБОТУ</span>
          <ArrowRight size={14} />
        </button>
      </div>
    </div>
  )
})

export default ReadyBatchCard

