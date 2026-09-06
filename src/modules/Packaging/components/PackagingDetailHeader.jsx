import React from 'react'
import { CheckCircle2, Eye } from 'lucide-react'

export const PackagingDetailHeader = ({
  activeBatchData,
  isWarehouseConfirmed,
  boxSummaryCount,
  showBoxSummary,
  setShowBoxSummary
}) => {
  if (!activeBatchData) return null

  return (
    <div className="detail-header-row">
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '8px' }}>
          <h2 className="order-detail-title" style={{ margin: 0, fontWeight: 1000, color: 'var(--text, #0f172a)', letterSpacing: '-1px' }}>
            Наряд № {activeBatchData.orderNum}{activeBatchData.batchIndex ? `/${activeBatchData.batchIndex}` : ''}
          </h2>
          <span style={{ background: '#f43f5e', color: '#fff', padding: '4px 12px', borderRadius: '10px', fontSize: '0.8rem', fontWeight: 950 }}>
            ПАКУВАННЯ
          </span>
          {isWarehouseConfirmed && (
            <span style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#059669', padding: '4px 12px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 900, border: '1px solid rgba(16, 185, 129, 0.3)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CheckCircle2 size={14} /> СКЛАД ПІДТВЕРДИВ
            </span>
          )}
        </div>
        <p className="detail-customer-text" style={{ margin: 0, color: 'var(--text-muted, #64748b)', fontSize: '1rem', fontWeight: 600 }}>
          Замовник: <strong className="pack-detail-customer-name" style={{ color: 'var(--text, #1e293b)' }}>{activeBatchData.customer}</strong>
        </p>
        <p className="detail-product-text" style={{ margin: '4px 0 0 0', color: 'var(--text-muted, #64748b)', fontSize: '1rem', fontWeight: 600 }}>
          Виріб: <strong style={{ color: '#d97706' }}>{activeBatchData.productNames}</strong>
        </p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'flex-end' }}>
        <div className="volume-box" style={{ background: 'var(--card-header-bg, #f8fafc)', border: '1px solid var(--border-color, #e2e8f0)', padding: '12px 20px', borderRadius: '16px' }}>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted, #64748b)', textTransform: 'uppercase', fontWeight: 900, marginBottom: '4px' }}>Обсяг пакування</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 1000, color: '#059669' }}>
            {activeBatchData.plannedSets} <span style={{ fontSize: '0.85rem', color: 'var(--text-muted, #64748b)' }}>шт.</span>
          </div>
        </div>
        {/* Кнопка перегляду зведення по коробках */}
        {boxSummaryCount > 0 && (
          <button
            onClick={() => setShowBoxSummary(v => !v)}
            style={{ 
              padding: '10px 16px', 
              background: showBoxSummary ? 'rgba(244, 63, 94, 0.12)' : 'var(--card-header-bg, #f8fafc)', 
              border: `1px solid ${showBoxSummary ? '#f43f5e' : 'var(--border-color, #cbd5e1)'}`, 
              borderRadius: '12px', 
              color: showBoxSummary ? '#e11d48' : 'var(--text, #0f172a)', 
              fontWeight: 900, 
              fontSize: '0.75rem', 
              cursor: 'pointer', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px', 
              transition: '0.2s' 
            }}
          >
            <Eye size={16} /> {showBoxSummary ? 'СПИСОК BOM' : `ЗМІСТ КОРОБОК (${boxSummaryCount})`}
          </button>
        )}
      </div>
    </div>
  )
}

