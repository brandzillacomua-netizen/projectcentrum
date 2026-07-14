import React from 'react'
import { X } from 'lucide-react'
import { CHAIN } from '../hooks/useShop1Data'

export function Shop1CompleteModal({
  currentCard,
  finalOperator,
  setFinalOperator,
  selectedShift,
  getFilteredOperators,
  cuttersBreakdown,
  setCuttersBreakdown,
  getCuttersForCard,
  scrapCount,
  setScrapCount,
  scrapOperator,
  setScrapOperator,
  cardOperators,
  handleRequestRework,
  handleCompleteToBuffer,
  isProcessing,
  setShowCompleteModal,
  galtPriority,
  setGaltPriority
}) {
  const labelStyle = { display: 'block', fontSize: '0.65rem', color: '#444', fontWeight: 900, textTransform: 'uppercase', marginBottom: '7px' }
  const selectStyle = { width: '100%', background: '#0d0d0d', border: '1px solid #222', color: '#fff', padding: '13px', borderRadius: '12px', fontSize: '0.95rem', fontWeight: 700, boxSizing: 'border-box' }
  const btnPrimary = { background: '#3b82f6', color: '#fff', border: 'none', padding: '18px', borderRadius: '14px', fontSize: '1.1rem', fontWeight: 900, cursor: 'pointer', width: '100%', transition: 'opacity 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }
  const btnGreen = { background: '#10b981', color: '#fff', border: 'none', padding: '18px', borderRadius: '14px', fontSize: '1.1rem', fontWeight: 900, cursor: 'pointer', width: '100%', transition: 'opacity 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 10020, padding: '40px 20px', overflowY: 'auto' }}>
      <div style={{ background: '#111', width: '100%', maxWidth: '440px', borderRadius: '28px', border: '1px solid #10b98140', overflow: 'hidden', boxShadow: '0 20px 60px rgba(16,185,129,0.15)', margin: 'auto 0' }}>
        {/* Header */}
        <div style={{ padding: '20px 22px', background: '#161616', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #10b98120' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 950, color: '#10b981' }}>
              ✓ ЗАВЕРШИТИ ЕТАП: {currentCard.operation?.toUpperCase()}
            </h3>
            <div style={{ fontSize: '0.6rem', color: '#555', marginTop: '3px', fontWeight: 700 }}>
              Вкажіть фактичні показники для здачі в буфер
            </div>
          </div>
          <button onClick={() => setShowCompleteModal(false)} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer' }}><X size={22} /></button>
        </div>

        <div style={{ padding: '24px 22px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Зміна */}
          <div>
            <label style={labelStyle}>Зміна (для здачі)</label>
            <select value={selectedShift} disabled style={{ ...selectStyle, opacity: 0.5, cursor: 'not-allowed' }}>
              <option value={selectedShift}>{selectedShift || 'Без зміни'}</option>
            </select>
          </div>

          {/* Фінальний оператор */}
          <div>
            <label style={labelStyle}>Фінальний оператор (якщо змінився)</label>
            <select value={finalOperator} onChange={e => setFinalOperator(e.target.value)} disabled={!selectedShift} style={{ ...selectStyle, opacity: selectedShift ? 1 : 0.5, cursor: selectedShift ? 'pointer' : 'not-allowed' }}>
              <option value="">{selectedShift ? `— Залишити поточного (${currentCard.operator_name}) —` : '— Спочатку оберіть зміну —'}</option>
              {getFilteredOperators('Цех №1', selectedShift, currentCard.operation).map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>

          {/* Пріоритет Галтовки (Тільки для Розкрою) */}
          {currentCard.operation === 'Розкрій' && (
            <div>
              <label style={labelStyle}>Пріоритет галтовки для наступного кроку</label>
              <div style={{ display: 'flex', gap: '10px' }}>
                {[1, 2, 3].map(p => {
                  const colors = { 1: '#ef4444', 2: '#3b82f6', 3: '#10b981' }
                  const names = { 1: 'ВИСОКИЙ', 2: 'СЕРЕДНІЙ', 3: 'НИЗЬКИЙ' }
                  const activePri = galtPriority === p
                  return (
                    <button
                      key={p}
                      onClick={() => setGaltPriority(p)}
                      type="button"
                      style={{
                        flex: 1,
                        background: activePri ? colors[p] : '#111',
                        color: activePri ? '#000' : '#888',
                        border: `1px solid ${activePri ? colors[p] : '#333'}`,
                        padding: '10px',
                        borderRadius: '10px',
                        fontSize: '0.75rem',
                        fontWeight: 950,
                        cursor: 'pointer'
                      }}
                    >
                      {names[p]}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Фактична кількість фрез (Тільки для Розкрою) */}
          {currentCard.operation === 'Розкрій' && (() => {
            const cardCutters = [...getCuttersForCard(currentCard)].sort((a, b) => {
              const getDiam = (str) => {
                const m = str.match(/(\d+(?:[.,]\d+)?)[xх]/i)
                return m ? parseFloat(m[1].replace(',', '.')) : 999
              }
              return getDiam(a) - getDiam(b)
            })
            return (
              <div style={{ background: '#0d0d0d', borderRadius: '14px', padding: '18px', border: '1px solid #eab30822', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <label style={{ color: '#eab308', fontWeight: 900, fontSize: '0.7rem', textTransform: 'uppercase', display: 'block', textAlign: 'center' }}>
                  ФАКТИЧНА КІЛЬКІСТЬ ФРЕЗ
                </label>
                {cardCutters.map(cutterName => {
                  const rawVal = cuttersBreakdown[cutterName]
                  const currentVal = rawVal !== undefined ? rawVal : ''
                  return (
                    <div key={cutterName} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#121212', padding: '10px 15px', borderRadius: '10px', border: '1px solid #222' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#aaa', maxWidth: '60%', textAlign: 'left' }}>{cutterName}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button onClick={() => setCuttersBreakdown(p => ({ ...p, [cutterName]: Math.max(0, (Number(currentVal) || 0) - 1) }))}
                          type="button"
                          style={{ width: '32px', height: '32px', background: '#1c1c1c', border: '1px solid #333', color: '#fff', borderRadius: '6px', cursor: 'pointer', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                        <input type="number" min={0} value={currentVal} placeholder="0"
                          onChange={e => {
                            const val = e.target.value
                            setCuttersBreakdown(p => ({ ...p, [cutterName]: val === '' ? '' : Math.max(0, parseInt(val) || 0) }))
                          }}
                          style={{ background: 'transparent', border: 'none', color: '#eab308', fontSize: '1.2rem', width: '50px', textAlign: 'center', fontWeight: 900 }} />
                        <button onClick={() => setCuttersBreakdown(p => ({ ...p, [cutterName]: (Number(currentVal) || 0) + 1 }))}
                          type="button"
                          style={{ width: '32px', height: '32px', background: '#1c1c1c', border: '1px solid #333', color: '#fff', borderRadius: '6px', cursor: 'pointer', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                      </div>
                    </div>
                  )
                })}
                <div style={{ borderTop: '1px solid #222', paddingTop: '10px', textAlign: 'center', fontSize: '0.72rem', color: '#555' }}>
                  Всього використано: <strong style={{ color: '#eab308' }}>{Object.values(cuttersBreakdown).reduce((sum, v) => sum + (Number(v) || 0), 0)} шт</strong>
                </div>
              </div>
            )
          })()}

          {/* Лічильник браку */}
          <div style={{ background: '#0d0d0d', borderRadius: '14px', padding: '18px', textAlign: 'center' }}>
            <label style={{ color: '#ef4444', fontWeight: 900, fontSize: '0.7rem', textTransform: 'uppercase', display: 'block', marginBottom: '12px' }}>
              КІЛЬКІСТЬ БРАКУ
            </label>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '14px' }}>
              <button onClick={() => setScrapCount(v => Math.max(0, v - 1))}
                style={{ width: '46px', height: '46px', background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#fff', borderRadius: '10px', fontSize: '1.4rem', cursor: 'pointer' }}>−</button>
              <input type="number" min={0} max={currentCard.quantity} value={scrapCount === 0 ? '' : scrapCount} placeholder="0"
                onChange={e => {
                  const val = e.target.value
                  setScrapCount(val === '' ? 0 : Math.max(0, Math.min(currentCard.quantity, parseInt(val) || 0)))
                }}
                style={{ background: 'transparent', border: 'none', color: '#ef4444', fontSize: '3.2rem', width: '90px', textAlign: 'center', fontWeight: 900 }} />
              <button onClick={() => setScrapCount(v => Math.min(currentCard.quantity, v + 1))}
                style={{ width: '46px', height: '46px', background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#fff', borderRadius: '10px', fontSize: '1.4rem', cursor: 'pointer' }}>+</button>
            </div>
            <div style={{ marginTop: '10px', fontSize: '0.72rem', color: '#555' }}>
              Добре: <strong style={{ color: '#10b981' }}>{Math.max(0, (currentCard.quantity || 0) - scrapCount)} шт</strong>
              {' · '}Брак: <strong style={{ color: '#ef4444' }}>{scrapCount} шт</strong>
            </div>
          </div>

          {scrapCount > 0 && cardOperators.length > 0 && (
            <div style={{ background: '#1c1212', borderRadius: '14px', padding: '15px 18px', border: '1px solid #ef444425' }}>
              <label style={{ color: '#f87171', fontWeight: 900, fontSize: '0.7rem', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                Кому присвоїти брак?
              </label>
              <select
                value={scrapOperator}
                onChange={e => setScrapOperator(e.target.value)}
                style={{ ...selectStyle, background: '#000', borderColor: '#ef444430', color: '#fca5a5' }}
              >
                <option value="">— Оберіть оператора —</option>
                {cardOperators.map(o => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </div>
          )}

          {Math.max(0, (currentCard.quantity || 0) - scrapCount) === 0 ? (
            <button onClick={handleRequestRework} disabled={isProcessing}
              style={{ ...btnPrimary, background: '#ef4444', boxShadow: '0 10px 30px rgba(239,68,68,0.3)', opacity: isProcessing ? 0.5 : 1 }}>
              {isProcessing ? 'ЗБЕРЕЖЕННЯ...' : '♻ ЗАМОВИТИ ДОВИПУСК'}
            </button>
          ) : (
            <button onClick={handleCompleteToBuffer} disabled={isProcessing}
              style={{ ...btnGreen, opacity: isProcessing ? 0.5 : 1 }}>
              {isProcessing ? 'ЗБЕРЕЖЕННЯ...' : (
                currentCard.operation === CHAIN[CHAIN.length - 1]
                  ? '✓ ПРИЙНЯТО · ЗАВЕРШИТИ'
                  : `✓ В БУФЕР ${currentCard.operation?.toUpperCase()}`
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
