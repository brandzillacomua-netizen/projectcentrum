import React, { useState, useEffect } from 'react'
import { Play, X, RefreshCw } from 'lucide-react'
import { OperatorMultiSelect } from '../../../components/common/OperatorMultiSelect.jsx'

export function ReworkStartModal({
  pendingStartCard,
  onClose,
  onConfirm,
  isProcessing,
  onShiftPolishers = [],
  allPolishers = []
}) {
  const [selectedOperator, setSelectedOperator] = useState('')

  const onShiftList = onShiftPolishers.length > 0 ? onShiftPolishers : []
  const allList = allPolishers.length > 0 ? allPolishers : []

  useEffect(() => {
    if (pendingStartCard) {
      setSelectedOperator('')
    }
  }, [pendingStartCard])

  if (!pendingStartCard) return null

  const nom = pendingStartCard.nom
  const order = pendingStartCard.order

  const selectedCount = String(selectedOperator || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean).length

  return (
    <div
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
        style={{
          background: 'var(--card-bg, #121217)',
          width: '100%',
          maxWidth: '540px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '24px',
          border: '1px solid rgba(59, 130, 246, 0.3)',
          boxShadow: '0 25px 70px rgba(0,0,0,0.7)',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div
          style={{
            flexShrink: 0,
            padding: '16px 20px',
            background: 'rgba(59, 130, 246, 0.1)',
            borderBottom: '1px solid rgba(59, 130, 246, 0.2)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <h3
            style={{
              margin: 0,
              fontSize: '1rem',
              fontWeight: 950,
              color: '#3b82f6',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              textTransform: 'uppercase',
              letterSpacing: '0.02em'
            }}
          >
            <Play size={17} fill="currentColor" /> Взяти в роботу (Доопрацювання)
          </h3>
          <button
            type="button"
            onClick={onClose}
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
              background: 'var(--surface-inset, rgba(255,255,255,0.03))',
              border: '1px solid var(--border-subtle, rgba(255,255,255,0.08))',
              borderRadius: '16px',
              padding: '14px 16px'
            }}
          >
            <div style={{ fontSize: '0.68rem', color: '#ff9000', fontWeight: 900 }}>
              #{pendingStartCard.id.slice(-8).toUpperCase()} {order?.order_num ? `· Замовлення ${order.order_num}` : ''}
            </div>
            <div
              style={{
                fontSize: '1.05rem',
                fontWeight: 900,
                color: 'var(--text, #fff)',
                marginTop: '4px'
              }}
            >
              {nom?.name || 'Невідома деталь'}
            </div>
            <div
              style={{
                fontSize: '0.8rem',
                color: 'var(--text-muted, #aaa)',
                fontWeight: 700,
                marginTop: '4px'
              }}
            >
              К-сть на доопрацювання: <strong style={{ color: 'var(--danger, #ef4444)' }}>{pendingStartCard.quantity} шт</strong>
            </div>
          </div>

          {/* Inline Multi-Select */}
          <OperatorMultiSelect
            label="Лицювальник (Доопрацювання)"
            onShiftOperators={onShiftList}
            allStageOperators={allList}
            selectedOperator={selectedOperator}
            setSelectedOperator={setSelectedOperator}
            accentColor="#3b82f6"
            accentRgb="59,130,246"
            inline={true}
            maxHeight="240px"
            compact={true}
          />
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
            onClick={onClose}
            disabled={isProcessing}
            style={{
              flex: 1,
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)',
              color: 'var(--text-muted, #aaa)',
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
            onClick={() => onConfirm(pendingStartCard.id, selectedOperator)}
            disabled={isProcessing || !selectedOperator}
            style={{
              flex: 2,
              background: selectedOperator ? '#3b82f6' : '#26262e',
              border: 'none',
              color: '#fff',
              padding: '14px',
              borderRadius: '14px',
              fontSize: '0.92rem',
              fontWeight: 950,
              cursor: selectedOperator ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: selectedOperator ? '0 8px 25px rgba(59, 130, 246, 0.35)' : 'none',
              opacity: (!selectedOperator || isProcessing) ? 0.6 : 1,
              transition: 'all 0.15s ease'
            }}
          >
            {isProcessing ? (
              <RefreshCw size={16} className="anim-spin" />
            ) : (
              <>
                <Play size={16} fill="currentColor" />
                {selectedCount > 1 ? `ВЗЯТИ В РОБОТУ (${selectedCount})` : 'ВЗЯТИ В РОБОТУ'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
