import React, { useState, useEffect } from 'react'
import { CheckCircle, X, RefreshCw } from 'lucide-react'
import { OperatorMultiSelect } from '../../../../components/common/OperatorMultiSelect.jsx'

const ACCENT = '#34d399'
const ACCENT_RGB = '52,211,153'

export default function SortingCompleteModal({
  showCompleteModal,
  setShowCompleteModal,
  activeCompletingCard,
  isProcessing,
  getNom,
  finishedCount,
  setFinishedCount,
  scrapCount,
  setScrapCount,
  reworkCount,
  setReworkCount,
  submitSortingComplete,
  scanError,
  selectedOperator,
  setSelectedOperator,
  operators = [],
  onShiftOperators = [],
  allStageOperators = []
}) {
  const [localOperator, setLocalOperator] = useState('')

  useEffect(() => {
    if (showCompleteModal && activeCompletingCard) {
      const cardOp = activeCompletingCard.operator_name
      const isCardOpValid = cardOp && cardOp !== 'Команда' && cardOp !== 'Сортування'
      setLocalOperator(isCardOpValid ? cardOp : (selectedOperator || ''))
    }
  }, [showCompleteModal, activeCompletingCard, selectedOperator])

  if (!showCompleteModal || !activeCompletingCard) return null

  const totalQty = activeCompletingCard.quantity || 0
  const onShiftList = (onShiftOperators && onShiftOperators.length > 0) ? onShiftOperators : []
  const allList = (allStageOperators && allStageOperators.length > 0) ? allStageOperators : operators
  const effectiveOperator = localOperator || selectedOperator || ''

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
          background: '#0e0e12',
          width: '100%',
          maxWidth: '540px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '24px',
          border: `1px solid rgba(${ACCENT_RGB}, 0.3)`,
          overflow: 'hidden',
          boxShadow: '0 25px 70px rgba(0,0,0,0.7)'
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
          <div>
            <h3
              style={{
                margin: 0,
                fontSize: '1rem',
                fontWeight: 950,
                color: ACCENT,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                textTransform: 'uppercase'
              }}
            >
              <CheckCircle size={17} /> Завершити Сортування
            </h3>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', marginTop: '2px', fontWeight: 800 }}>
              Картка #{activeCompletingCard.id.slice(-8).toUpperCase()}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowCompleteModal(false)}
            disabled={isProcessing}
            style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: '4px' }}
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
          <div
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid var(--border-subtle, rgba(255,255,255,0.08))',
              padding: '12px 16px',
              borderRadius: '14px'
            }}
          >
            <div style={{ fontSize: '0.62rem', color: 'var(--text-dim)', fontWeight: 900, textTransform: 'uppercase', marginBottom: '2px' }}>
              Деталь
            </div>
            <div style={{ fontSize: '0.95rem', fontWeight: 900, color: 'var(--text-strong)' }}>
              {getNom(activeCompletingCard)?.name || 'Невказана деталь'}
            </div>
          </div>

          <OperatorMultiSelect
            label="Сортувальник / Лицювальник"
            onShiftOperators={onShiftList}
            allStageOperators={allList}
            selectedOperator={effectiveOperator}
            setSelectedOperator={(val) => {
              setLocalOperator(val)
              if (setSelectedOperator) setSelectedOperator(val)
            }}
            accentColor={ACCENT}
            accentRgb={ACCENT_RGB}
            inline={true}
            maxHeight="160px"
            compact={true}
          />

          {/* OK and Scrap inputs */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', marginBottom: '6px' }}>
                В Цех №2 (OK)
              </label>
              <input
                type="number"
                min="0"
                max={totalQty - reworkCount}
                value={finishedCount}
                onChange={e => {
                  const val = Math.max(0, parseInt(e.target.value) || 0)
                  setFinishedCount(val)
                  setScrapCount(Math.max(0, totalQty - reworkCount - val))
                }}
                style={{
                  background: 'var(--surface-2, #181820)',
                  border: '1px solid var(--border-subtle, rgba(255,255,255,0.12))',
                  color: 'var(--text-strong, #fff)',
                  padding: '10px 14px',
                  borderRadius: '12px',
                  fontSize: '0.95rem',
                  fontWeight: 800,
                  outline: 'none',
                  width: '100%',
                  textAlign: 'center'
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.68rem', color: '#ef4444', fontWeight: 800, textTransform: 'uppercase', marginBottom: '6px' }}>
                Брак (шт)
              </label>
              <input
                type="number"
                min="0"
                max={totalQty - reworkCount}
                value={scrapCount}
                onChange={e => {
                  const val = Math.max(0, parseInt(e.target.value) || 0)
                  setScrapCount(val)
                  setFinishedCount(Math.max(0, totalQty - reworkCount - val))
                }}
                style={{
                  background: 'var(--surface-2, #181820)',
                  border: '1px solid var(--border-subtle, rgba(255,255,255,0.12))',
                  color: '#ef4444',
                  padding: '10px 14px',
                  borderRadius: '12px',
                  fontSize: '0.95rem',
                  fontWeight: 800,
                  outline: 'none',
                  width: '100%',
                  textAlign: 'center'
                }}
              />
            </div>
          </div>

          {/* Rework counter */}
          <div style={{ background: 'rgba(245, 158, 11, 0.05)', borderRadius: '14px', padding: '14px', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
            <label style={{ display: 'block', fontSize: '0.68rem', color: '#f59e0b', fontWeight: 900, textTransform: 'uppercase', marginBottom: '8px', textAlign: 'center' }}>
              НА ДООПРАЦЮВАННЯ (Цех №2)
            </label>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
              <button
                type="button"
                onClick={() => {
                  const n = Math.max(0, reworkCount - 1)
                  setReworkCount(n)
                  setFinishedCount(Math.max(0, totalQty - scrapCount - n))
                }}
                style={{
                  width: '42px',
                  height: '42px',
                  background: 'var(--surface-2, #1e1e28)',
                  border: '1px solid var(--border-subtle, rgba(255,255,255,0.15))',
                  color: '#fff',
                  borderRadius: '10px',
                  fontSize: '1.4rem',
                  cursor: 'pointer'
                }}
              >
                −
              </button>
              <input
                type="number"
                min={0}
                max={totalQty - scrapCount}
                value={reworkCount === 0 ? '' : reworkCount}
                placeholder="0"
                onChange={e => {
                  const val = Math.max(0, parseInt(e.target.value) || 0)
                  setReworkCount(val)
                  setFinishedCount(Math.max(0, totalQty - scrapCount - val))
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#f59e0b',
                  fontSize: '2.2rem',
                  width: '80px',
                  textAlign: 'center',
                  fontWeight: 950
                }}
              />
              <button
                type="button"
                onClick={() => {
                  const n = Math.min(totalQty - scrapCount, reworkCount + 1)
                  setReworkCount(n)
                  setFinishedCount(Math.max(0, totalQty - scrapCount - n))
                }}
                style={{
                  width: '42px',
                  height: '42px',
                  background: 'var(--surface-2, #1e1e28)',
                  border: '1px solid var(--border-subtle, rgba(255,255,255,0.15))',
                  color: '#fff',
                  borderRadius: '10px',
                  fontSize: '1.4rem',
                  cursor: 'pointer'
                }}
              >
                +
              </button>
            </div>
          </div>

          <div style={{ background: `rgba(${ACCENT_RGB},0.08)`, border: `1px solid rgba(${ACCENT_RGB},0.2)`, borderRadius: '12px', padding: '10px 14px', fontSize: '0.78rem', color: ACCENT, fontWeight: 800, textAlign: 'center' }}>
            ✅ В Цех №2: <strong>{finishedCount}</strong> · Доопр: <strong style={{ color: '#f59e0b' }}>{reworkCount}</strong> · Брак: <strong style={{ color: '#ef4444' }}>{scrapCount}</strong> / {totalQty} шт
          </div>

          {scanError && (
            <div style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', borderRadius: '12px', padding: '10px 14px', fontSize: '0.78rem', fontWeight: 800, textAlign: 'center' }}>
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
            onClick={() => setShowCompleteModal(false)}
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
            onClick={() => submitSortingComplete(effectiveOperator)}
            disabled={isProcessing || !effectiveOperator}
            style={{
              flex: 2,
              background: effectiveOperator ? ACCENT : '#26262e',
              border: 'none',
              color: effectiveOperator ? '#000' : '#666',
              padding: '14px',
              borderRadius: '14px',
              fontSize: '0.92rem',
              fontWeight: 950,
              cursor: effectiveOperator ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: effectiveOperator ? `0 8px 24px rgba(${ACCENT_RGB}, 0.35)` : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            {isProcessing ? <RefreshCw size={16} className="anim-spin" /> : <><CheckCircle size={16} /> ПІДТВЕРДИТИ В ЦЕХ №2</>}
          </button>
        </div>
      </div>
    </div>
  )
}
