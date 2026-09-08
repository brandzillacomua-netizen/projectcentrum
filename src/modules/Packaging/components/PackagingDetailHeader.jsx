import React from 'react'
import { CheckCircle2, Eye } from 'lucide-react'

export const PackagingDetailHeader = ({
  activeBatchData,
  isWarehouseConfirmed,
  boxSummaryCount,
  showBoxSummary,
  setShowBoxSummary,
  onOpenSplitModal
}) => {
  if (!activeBatchData) return null

  return (
    <div className="detail-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: '16px', borderBottom: '1px solid var(--border-color, #e2e8f0)', marginBottom: '16px' }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px', flexWrap: 'wrap' }}>
          <h2 className="order-detail-title" style={{ margin: 0, fontWeight: 1000, color: 'var(--text, #0f172a)', letterSpacing: '-0.5px', fontSize: '1.4rem' }}>
            Наряд № {activeBatchData.orderNum}{activeBatchData.batchIndex ? `/${activeBatchData.batchIndex}` : ''}
          </h2>
          <span style={{ background: '#f43f5e', color: '#fff', padding: '4px 10px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 950 }}>
            ПАКУВАННЯ
          </span>
          {activeBatchData.batchIndex && (
            <span style={{ background: '#0284c7', color: '#fff', padding: '4px 10px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 950 }}>
              ПАРТІЯ {activeBatchData.batchIndex}
            </span>
          )}
          {isWarehouseConfirmed && (
            <span style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#059669', padding: '4px 10px', borderRadius: '8px', fontSize: '0.72rem', fontWeight: 900, border: '1px solid rgba(16, 185, 129, 0.3)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CheckCircle2 size={13} /> СКЛАД ПІДТВЕРДИВ
            </span>
          )}
        </div>
        <p className="detail-customer-text" style={{ margin: 0, color: 'var(--text-muted, #64748b)', fontSize: '0.9rem', fontWeight: 600 }}>
          Замовник: <strong className="pack-detail-customer-name" style={{ color: 'var(--text, #1e293b)' }}>{activeBatchData.customer}</strong>
        </p>
        <p className="detail-product-text" style={{ margin: '4px 0 0 0', color: 'var(--text-muted, #64748b)', fontSize: '0.9rem', fontWeight: 600 }}>
          Виріб: <strong style={{ color: '#d97706' }}>{activeBatchData.productNames}</strong>
        </p>

        {/* СПОВІЩЕННЯ ПРО РОЗБИВКУ МЕНЕДЖЕРА */}
        {activeBatchData.hasPendingScheduleSplit && (
          <div style={{
            marginTop: '12px',
            background: '#fffbeb',
            border: '1.5px solid #fcd34d',
            borderRadius: '10px',
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            maxWidth: '650px'
          }}>
            <div style={{ fontSize: '0.78rem', color: '#92400e', fontWeight: 800 }}>
              ⚡ Менеджер додав графік відвантажень ({activeBatchData.batchSchedule?.length || 0} партій). Ви можете розділити цей наряд на окремі піднаряди та розподілити вже спаковані коробки.
            </div>
            <button
              type="button"
              onClick={onOpenSplitModal}
              style={{
                background: '#d97706',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                padding: '8px 14px',
                fontWeight: 900,
                fontSize: '0.75rem',
                cursor: 'pointer',
                flexShrink: 0,
                boxShadow: '0 2px 6px rgba(217, 119, 6, 0.3)'
              }}
            >
              ⚡ РОЗДІЛИТИ НАРЯД
            </button>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
        <div className="volume-box" style={{ background: 'var(--card-header-bg, #f8fafc)', border: '1px solid var(--border-color, #e2e8f0)', padding: '10px 18px', borderRadius: '12px', textAlign: 'right' }}>
          <div style={{ fontSize: '0.62rem', color: 'var(--text-muted, #64748b)', textTransform: 'uppercase', fontWeight: 900, marginBottom: '2px' }}>Обсяг пакування</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 1000, color: '#059669' }}>
            {activeBatchData.plannedSets} <span style={{ fontSize: '0.8rem', color: 'var(--text-muted, #64748b)' }}>шт.</span>
          </div>
        </div>

        {/* Кнопка перегляду зведення по коробках */}
        {boxSummaryCount > 0 && (
          <button
            onClick={() => setShowBoxSummary(v => !v)}
            style={{ 
              padding: '8px 14px', 
              background: showBoxSummary ? 'rgba(244, 63, 94, 0.12)' : 'var(--card-header-bg, #f8fafc)', 
              border: `1px solid ${showBoxSummary ? '#f43f5e' : 'var(--border-color, #cbd5e1)'}`, 
              borderRadius: '10px', 
              color: showBoxSummary ? '#e11d48' : 'var(--text, #0f172a)', 
              fontWeight: 900, 
              fontSize: '0.72rem', 
              cursor: 'pointer', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px', 
              transition: '0.2s' 
            }}
          >
            <Eye size={14} /> {showBoxSummary ? 'СПИСОК BOM' : `ЗМІСТ КОРОБОК (${boxSummaryCount})`}
          </button>
        )}
      </div>
    </div>
  )
}

