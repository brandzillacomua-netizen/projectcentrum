import React, { useEffect } from 'react'
import { Play, X, RefreshCw } from 'lucide-react'
import { OperatorMultiSelect } from '../../../../components/common/OperatorMultiSelect.jsx'

const ACCENT = '#34d399'
const ACCENT_RGB = '52,211,153'

export default function SortingStartConfirmModal({
  pendingStartCard,
  setPendingStartCard,
  isProcessing,
  startSortingCard,
  getNom,
  selectedOperator,
  setSelectedOperator,
  operators = [],
  onShiftOperators = [],
  allStageOperators = [],
  scanError
}) {
  const onShiftList = (onShiftOperators && onShiftOperators.length > 0) ? onShiftOperators : []
  const allList = (allStageOperators && allStageOperators.length > 0) ? allStageOperators : operators

  useEffect(() => {
    if (pendingStartCard) {
      if (setSelectedOperator) {
        setSelectedOperator('')
      }
    }
  }, [pendingStartCard, setSelectedOperator])

  if (!pendingStartCard) return null

  const selectedCount = String(selectedOperator || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean).length

  return (
    <div
      className="terminal-modal-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.85)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10050,
        padding: '12px',
        backdropFilter: 'blur(10px)'
      }}
    >
      <div
        className="terminal-modal-card"
        style={{
          background: '#0d0d12',
          width: '100%',
          maxWidth: '540px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '24px',
          border: `1px solid rgba(${ACCENT_RGB}, 0.35)`,
          boxShadow: '0 25px 70px rgba(0,0,0,0.7)',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div
          style={{
            flexShrink: 0,
            padding: '16px 20px',
            background: `rgba(${ACCENT_RGB}, 0.08)`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: `1px solid rgba(${ACCENT_RGB}, 0.15)`
          }}
        >
          <h3
            style={{
              margin: 0,
              fontSize: '1rem',
              fontWeight: 950,
              color: ACCENT,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              textTransform: 'uppercase',
              letterSpacing: '0.02em'
            }}
          >
            <Play size={17} fill="currentColor" /> Взяти на Сортування
          </h3>
          <button
            type="button"
            onClick={() => setPendingStartCard(null)}
            disabled={isProcessing}
            style={{
              background: 'none',
              border: 'none',
              color: '#888',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <X size={22} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '18px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}
        >
          {/* Card Info Box */}
          <div
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid var(--border-subtle, rgba(255,255,255,0.08))',
              borderRadius: '16px',
              padding: '14px 16px'
            }}
          >
            <div style={{ fontSize: '0.68rem', color: '#ff9000', fontWeight: 900 }}>
              #{pendingStartCard.id.slice(-8).toUpperCase()}
            </div>
            <div
              style={{
                fontSize: '1.05rem',
                fontWeight: 900,
                color: 'var(--text-strong, #fff)',
                marginTop: '4px'
              }}
            >
              {getNom(pendingStartCard)?.name || 'Деталь'}
            </div>
            <div
              style={{
                fontSize: '0.8rem',
                color: 'var(--text-muted, #9ca3af)',
                fontWeight: 700,
                marginTop: '4px'
              }}
            >
              К-сть: <strong style={{ color: 'var(--text-strong, #fff)' }}>{pendingStartCard.quantity} шт</strong>
            </div>
          </div>

          {/* Inline Multi-Select */}
          <OperatorMultiSelect
            label="Сортувальник / Лицювальник"
            onShiftOperators={onShiftList}
            allStageOperators={allList}
            selectedOperator={selectedOperator}
            setSelectedOperator={setSelectedOperator}
            accentColor={ACCENT}
            accentRgb={ACCENT_RGB}
            inline={true}
            maxHeight="240px"
            compact={true}
          />

          {scanError && (
            <div
              style={{
                background: 'rgba(239,68,68,0.12)',
                border: '1px solid rgba(239,68,68,0.3)',
                color: '#ef4444',
                borderRadius: '12px',
                padding: '10px 14px',
                fontSize: '0.78rem',
                fontWeight: 800,
                textAlign: 'center'
              }}
            >
              ⚠️ {scanError}
            </div>
          )}
        </div>

        {/* Sticky Footer */}
        <div
          style={{
            flexShrink: 0,
            padding: '14px 20px',
            background: 'rgba(12,12,16,0.95)',
            borderTop: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            gap: '12px'
          }}
        >
          <button
            type="button"
            onClick={() => setPendingStartCard(null)}
            disabled={isProcessing}
            style={{
              flex: 1,
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)',
              color: '#bbb',
              padding: '14px',
              borderRadius: '14px',
              fontSize: '0.85rem',
              fontWeight: 900,
              cursor: 'pointer'
            }}
          >
            СКАСУВАТИ
          </button>
          <button
            type="button"
            onClick={() => startSortingCard(pendingStartCard, selectedOperator)}
            disabled={isProcessing || !selectedOperator}
            style={{
              flex: 2,
              background: selectedOperator ? ACCENT : '#26262e',
              border: 'none',
              color: selectedOperator ? '#000' : '#666',
              padding: '14px',
              borderRadius: '14px',
              fontSize: '0.92rem',
              fontWeight: 950,
              cursor: selectedOperator ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: selectedOperator ? `0 8px 24px rgba(${ACCENT_RGB}, 0.35)` : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            {isProcessing ? (
              <RefreshCw size={16} className="anim-spin" />
            ) : (
              <>
                <Play size={16} fill="currentColor" />
                {selectedCount > 1 ? `СОРТУВАТИ (${selectedCount})` : 'СОРТУВАТИ'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
