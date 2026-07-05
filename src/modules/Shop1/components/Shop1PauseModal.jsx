import React from 'react'
import { X } from 'lucide-react'

export function Shop1PauseModal({
  currentCard,
  pauseReason,
  setPauseReason,
  customPauseReason,
  setCustomPauseReason,
  handlePauseCard,
  isProcessing,
  setShowPauseModal,
  getNom
}) {
  const labelStyle = { display: 'block', fontSize: '0.65rem', color: '#444', fontWeight: 900, textTransform: 'uppercase', marginBottom: '7px' }
  const selectStyle = { width: '100%', background: '#0d0d0d', border: '1px solid #222', color: '#fff', padding: '13px', borderRadius: '12px', fontSize: '0.95rem', fontWeight: 700, boxSizing: 'border-box' }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 10030, padding: '40px 20px', overflowY: 'auto' }}>
      <div style={{ background: '#111', width: '100%', maxWidth: '420px', borderRadius: '28px', border: '1px solid #ef444440', overflow: 'hidden', boxShadow: '0 20px 60px rgba(239,68,68,0.15)', margin: 'auto 0' }}>
        {/* Header */}
        <div style={{ padding: '20px 22px', background: '#161616', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #ef444420' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 950, color: '#ef4444', display: 'flex', alignItems: 'center', gap: '8px' }}>
              🛑 ЗУПИНИТИ ВЕРСТАТ (ПАУЗА)
            </h3>
            <div style={{ fontSize: '0.6rem', color: '#555', marginTop: '3px', fontWeight: 700 }}>
              Призупинити виконання картки розкрою
            </div>
          </div>
          <button onClick={() => setShowPauseModal(false)} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer' }}><X size={22} /></button>
        </div>

        <div style={{ padding: '24px 22px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Деталь */}
          <div style={{ background: '#0d0d0d', borderRadius: '12px', padding: '12px 16px', border: '1px solid #1e1e1e' }}>
            <div style={{ fontSize: '0.55rem', color: '#444', fontWeight: 900, textTransform: 'uppercase', marginBottom: '4px' }}>Поточна картка</div>
            <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#888' }}>{getNom(currentCard)?.name || 'Деталь'}</div>
            <div style={{ fontSize: '0.6rem', color: '#333', marginTop: '2px' }}>{currentCard.machine || 'Верстат не вказано'}</div>
          </div>

          {/* Причина зупинки */}
          <div>
            <label style={labelStyle}>Причина зупинки верстата</label>
            <select 
              value={pauseReason} 
              onChange={e => {
                setPauseReason(e.target.value)
                if (e.target.value !== 'Інша причина (введіть нижче)') {
                  setCustomPauseReason('')
                }
              }} 
              style={selectStyle}
            >
              <option value="Поломка верстата">Поломка верстата</option>
              <option value="Технічне обслуговування">Технічне обслуговування</option>
              <option value="Відсутність матеріалу">Відсутність матеріалу</option>
              <option value="Перерва / Обід">Перерва / Обід</option>
              <option value="Немає файлу розкрою / Програми">Немає файлу розкрою / Програми</option>
              <option value="Інша причина (введіть нижче)">Інша причина (введіть нижче)</option>
            </select>
          </div>

          {/* Інша причина (текстове поле) */}
          {pauseReason === 'Інша причина (введіть нижче)' && (
            <div>
              <label style={labelStyle}>Опишіть іншу причину зупинки</label>
              <input
                type="text"
                placeholder="Введіть коментар..."
                value={customPauseReason}
                onChange={e => setCustomPauseReason(e.target.value)}
                style={{ ...selectStyle, background: '#000' }}
              />
            </div>
          )}

          {/* Кнопка підтвердження */}
          <button
            onClick={handlePauseCard}
            disabled={isProcessing || (pauseReason === 'Інша причина (введіть нижче)' && !customPauseReason.trim())}
            style={{
              background: '#ef4444',
              color: '#fff',
              border: 'none',
              padding: '18px',
              borderRadius: '16px',
              fontSize: '1rem',
              fontWeight: 950,
              cursor: isProcessing ? 'not-allowed' : 'pointer',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              boxShadow: '0 4px 12px rgba(239,68,68,0.2)',
              transition: 'all 0.2s',
              opacity: (isProcessing || (pauseReason === 'Інша причина (введіть нижче)' && !customPauseReason.trim())) ? 0.5 : 1
            }}
          >
            {isProcessing ? 'ЗБЕРЕЖЕННЯ...' : '🛑 ПІДТВЕРДИТИ ЗУПИНКУ'}
          </button>
        </div>
      </div>
    </div>
  )
}
