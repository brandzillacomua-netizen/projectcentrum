import React from 'react'
import { X } from 'lucide-react'

export function Shop1ShiftChangeModal({
  showShiftChangeModal,
  onClose,
  currentCard,
  shiftChangeShift,
  setShiftChangeShift,
  shiftChangeOperator,
  setShiftChangeOperator,
  getFilteredOperators,
  handleShiftChange,
  isProcessing,
  selectStyle = {},
  labelStyle = {}
}) {
  if (!showShiftChangeModal || !currentCard) return null

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 10030, padding: '40px 20px', overflowY: 'auto' }}>
      <div style={{ background: '#111', width: '100%', maxWidth: '420px', borderRadius: '28px', border: '1px solid #f59e0b40', overflow: 'hidden', boxShadow: '0 20px 60px rgba(245,158,11,0.15)', margin: 'auto 0' }}>
        {/* Header */}
        <div style={{ padding: '20px 22px', background: '#161616', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f59e0b20' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 950, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '8px' }}>
              🔄 ПЕРЕЗМІНКА · РОЗКРІЙ
            </h3>
            <div style={{ fontSize: '0.6rem', color: '#555', marginTop: '3px', fontWeight: 700 }}>
              Картка продовжує роботу — змінюється виконавець
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer' }}><X size={22} /></button>
        </div>

        <div style={{ padding: '24px 22px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Поточний оператор */}
          <div style={{ background: '#0d0d0d', borderRadius: '12px', padding: '12px 16px', border: '1px solid #1e1e1e' }}>
            <div style={{ fontSize: '0.55rem', color: '#444', fontWeight: 900, textTransform: 'uppercase', marginBottom: '4px' }}>Поточний виконавець</div>
            <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#888' }}>{currentCard.operator_name || '—'}</div>
            <div style={{ fontSize: '0.6rem', color: '#333', marginTop: '2px' }}>{currentCard.shift_name || '—'}</div>
          </div>

          {/* Нова зміна */}
          <div>
            <label style={labelStyle}>Нова зміна</label>
            <select value={shiftChangeShift} onChange={e => setShiftChangeShift(e.target.value)} style={selectStyle}>
              <option value="">— Оберіть зміну —</option>
              <option value="Зміна 1">Зміна 1</option>
              <option value="Зміна 2">Зміна 2</option>
              <option value="Зміна 3">Зміна 3</option>
              <option value="Зміна 4">Зміна 4</option>
              <option value="Без зміни">Без зміни</option>
            </select>
          </div>

          {/* Новий оператор */}
          <div>
            <label style={labelStyle}>Новий виконавець</label>
            <select
              value={shiftChangeOperator}
              onChange={e => setShiftChangeOperator(e.target.value)}
              disabled={!shiftChangeShift}
              style={{ ...selectStyle, opacity: shiftChangeShift ? 1 : 0.5, cursor: shiftChangeShift ? 'pointer' : 'not-allowed' }}
            >
              <option value="">{shiftChangeShift ? '— Оберіть оператора —' : '— Спочатку оберіть зміну —'}</option>
              {getFilteredOperators && getFilteredOperators('Цех №1', shiftChangeShift, 'Розкрій').map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>

          {/* Кнопка підтвердження */}
          <button
            onClick={handleShiftChange}
            disabled={!shiftChangeOperator || !shiftChangeShift || isProcessing}
            style={{
              background: shiftChangeOperator && shiftChangeShift ? '#f59e0b' : '#222',
              color: shiftChangeOperator && shiftChangeShift ? '#000' : '#444',
              border: 'none',
              padding: '18px',
              borderRadius: '16px',
              fontSize: '1rem',
              fontWeight: 950,
              cursor: shiftChangeOperator && shiftChangeShift ? 'pointer' : 'not-allowed',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              transition: 'all 0.2s'
            }}
          >
            {isProcessing ? 'ЗБЕРЕЖЕННЯ...' : '🔄 ПІДТВЕРДИТИ ПЕРЕЗМІНКУ'}
          </button>

          <div style={{ textAlign: 'center', fontSize: '0.6rem', color: '#333', fontWeight: 700 }}>
            Картка залишається в роботі · Таймер скинеться на нового оператора
          </div>
        </div>
      </div>
    </div>
  )
}
