import React, { useState, useEffect } from 'react'
import { Play, X, RefreshCw, UserCheck } from 'lucide-react'

export function ReworkStartModal({
  pendingStartCard,
  onClose,
  onConfirm,
  isProcessing,
  onShiftPolishers = [],
  allPolishers = []
}) {
  const [showAll, setShowAll] = useState(false)
  const [selectedOperator, setSelectedOperator] = useState('')

  const onShiftList = onShiftPolishers.length > 0 ? onShiftPolishers : []
  const allList = allPolishers.length > 0 ? allPolishers : []
  const visibleList = showAll || onShiftList.length === 0 ? allList : onShiftList

  useEffect(() => {
    if (pendingStartCard) {
      setSelectedOperator('')
      setShowAll(false)
    }
  }, [pendingStartCard])

  if (!pendingStartCard) return null

  const nom = pendingStartCard.nom
  const order = pendingStartCard.order

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.85)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10050,
      padding: '20px',
      backdropFilter: 'blur(8px)'
    }}>
      <div style={{
        background: 'var(--card-bg, #121217)',
        width: '100%',
        maxWidth: '460px',
        borderRadius: '24px',
        border: '1px solid var(--glass-border, rgba(255,255,255,0.15))',
        boxShadow: '0 25px 60px rgba(0,0,0,0.6)',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          background: 'rgba(59, 130, 246, 0.1)',
          borderBottom: '1px solid rgba(59, 130, 246, 0.2)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h3 style={{
            margin: 0,
            fontSize: '1.05rem',
            fontWeight: 900,
            color: '#3b82f6',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            textTransform: 'uppercase'
          }}>
            <Play size={18} fill="currentColor" /> Взяти в роботу (Доопрацювання)
          </h3>
          <button
            onClick={onClose}
            disabled={isProcessing}
            style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}
          >
            <X size={22} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Card Info Box */}
          <div style={{
            background: 'var(--surface-inset, rgba(255,255,255,0.03))',
            border: '1px solid var(--border-subtle, rgba(255,255,255,0.08))',
            borderRadius: '16px',
            padding: '16px 18px'
          }}>
            <div style={{ fontSize: '0.7rem', color: '#ff9000', fontWeight: 900 }}>
              #{pendingStartCard.id.slice(-8).toUpperCase()} {order?.order_num ? `· Замовлення ${order.order_num}` : ''}
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--text, #fff)', marginTop: '4px' }}>
              {nom?.name || 'Невідома деталь'}
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted, #aaa)', fontWeight: 700, marginTop: '6px' }}>
              К-сть на доопрацювання: <strong style={{ color: 'var(--danger, #ef4444)' }}>{pendingStartCard.quantity} шт</strong>
            </div>
          </div>

          {/* Operator Selection */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <label style={{ fontSize: '0.72rem', color: 'var(--text-muted, #aaa)', fontWeight: 900, textTransform: 'uppercase', margin: 0, display: 'flex', alignItems: 'center', gap: '5px' }}>
                <UserCheck size={14} color="#10b981" />
                Лицювальник {!showAll && onShiftList.length > 0 ? `(На роботі сьогодні: ${onShiftList.length})` : ''}
                <span style={{ color: '#ef4444' }}>*</span>
              </label>
              {allList.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowAll(prev => !prev)}
                  style={{
                    background: showAll ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: showAll ? '#60a5fa' : 'var(--text-muted, #aaa)',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    fontSize: '0.68rem',
                    fontWeight: 800,
                    cursor: 'pointer'
                  }}
                >
                  {showAll ? 'Тільки на зміні' : `Показати всіх (${allList.length})`}
                </button>
              )}
            </div>

            <select
              value={selectedOperator}
              onChange={e => setSelectedOperator(e.target.value)}
              style={{
                width: '100%',
                background: 'var(--card-bg, #1a1a22)',
                border: selectedOperator ? '1px solid rgba(59, 130, 246, 0.5)' : '1px solid #ef4444',
                color: 'var(--text, #fff)',
                padding: '12px 14px',
                borderRadius: '12px',
                fontSize: '0.95rem',
                fontWeight: 800,
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="">
                {(!showAll && onShiftList.length === 0)
                  ? '— Сьогодні нікого не відмічено в табелі (натисніть «Показати всіх») —'
                  : '— Оберіть лицювальника —'}
              </option>
              {visibleList.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
            <button
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
              onClick={() => onConfirm(pendingStartCard.id, selectedOperator)}
              disabled={isProcessing || !selectedOperator}
              style={{
                flex: 2,
                background: selectedOperator ? '#3b82f6' : '#333',
                border: 'none',
                color: '#fff',
                padding: '14px',
                borderRadius: '14px',
                fontSize: '0.95rem',
                fontWeight: 900,
                cursor: selectedOperator ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: selectedOperator ? '0 8px 25px rgba(59, 130, 246, 0.35)' : 'none',
                opacity: (!selectedOperator || isProcessing) ? 0.6 : 1
              }}
            >
              {isProcessing ? <RefreshCw size={16} className="anim-spin" /> : <><Play size={16} fill="currentColor" /> ВЗЯТИ В РОБОТУ</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

