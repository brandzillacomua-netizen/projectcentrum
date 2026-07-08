import React from 'react'
import { X } from 'lucide-react'
import { useScrapReasons } from '../../../hooks/useScrapReasons'

export function Shop1QCModal({
  currentCard,
  qcInspector,
  setQcInspector,
  qcReason,
  setQcReason,
  qcCustomReason,
  setQcCustomReason,
  qcScrapCount,
  setQcScrapCount,
  handleQCScrapOverride,
  isProcessing,
  setShowQCModal,
  getNom
}) {
  const { names: scrapReasons } = useScrapReasons()
  const labelStyle = { display: 'block', fontSize: '0.65rem', color: '#444', fontWeight: 900, textTransform: 'uppercase', marginBottom: '7px' }
  const selectStyle = { width: '100%', background: '#0d0d0d', border: '1px solid #222', color: '#fff', padding: '13px', borderRadius: '12px', fontSize: '0.95rem', fontWeight: 700, boxSizing: 'border-box' }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 10025, padding: '40px 20px', overflowY: 'auto' }}>
      <div style={{ background: '#111', width: '100%', maxWidth: '460px', borderRadius: '26px', border: '1px solid #ef444440', overflow: 'hidden', boxShadow: '0 20px 60px rgba(239,68,68,0.15)', margin: 'auto 0' }}>
        <div style={{ padding: '20px 22px', background: '#161616', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #ef444420' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 950, color: '#ef4444', display: 'flex', alignItems: 'center', gap: '6px' }}>
              🛡️ ВІДДІЛ ВКЯ · ФІКСАЦІЯ БРАКУ
            </h3>
            <div style={{ fontSize: '0.6rem', color: '#888', marginTop: '2px' }}>
              Виявлено додатковий дефект на етапі
            </div>
          </div>
          <button onClick={() => setShowQCModal(false)} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer' }}><X size={22} /></button>
        </div>
        <div style={{ padding: '24px 22px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900 }}>{getNom(currentCard)?.name}</h3>

          {/* Інспектор ВКЯ */}
          <div>
            <label style={labelStyle}>ПІБ Інспектора ВКЯ (або відповідального)</label>
            <input
              type="text"
              placeholder="Введіть ваше прізвище..."
              value={qcInspector}
              onChange={e => setQcInspector(e.target.value)}
              style={{ ...selectStyle, background: '#000' }}
            />
          </div>

          {/* Причина браку */}
          <div>
            <label style={labelStyle}>Причина браку</label>
            <select
              value={qcReason}
              onChange={e => {
                setQcReason(e.target.value)
                if (e.target.value !== 'Інше (коментар)') {
                  setQcCustomReason('')
                }
              }}
              style={{ ...selectStyle, background: '#000' }}
            >
              {scrapReasons.map(reason => <option key={reason} value={reason}>{reason}</option>)}
            </select>
          </div>

          {/* Коментар до причини браку */}
          {qcReason === 'Інше (коментар)' && (
            <div>
              <label style={labelStyle}>Опишіть іншу причину браку</label>
              <input
                type="text"
                placeholder="Введіть коментар..."
                value={qcCustomReason}
                onChange={e => setQcCustomReason(e.target.value)}
                style={{ ...selectStyle, background: '#000' }}
              />
            </div>
          )}

          {/* Лічильник додаткового браку */}
          <div style={{ background: '#0d0d0d', borderRadius: '14px', padding: '18px', textAlign: 'center', border: '1px solid #ef444422' }}>
            <label style={{ color: '#ef4444', fontWeight: 900, fontSize: '0.7rem', textTransform: 'uppercase', display: 'block', marginBottom: '12px' }}>
              КІЛЬКІСТЬ ВИЯВЛЕНОГО БРАКУ
            </label>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '14px' }}>
              <button onClick={() => setQcScrapCount(v => Math.max(0, v - 1))}
                style={{ width: '46px', height: '46px', background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#fff', borderRadius: '10px', fontSize: '1.4rem', cursor: 'pointer' }}>−</button>
              <input type="number" min={0} max={currentCard.quantity} value={qcScrapCount === 0 ? '' : qcScrapCount} placeholder="0"
                onChange={e => {
                  const val = e.target.value
                  setQcScrapCount(val === '' ? 0 : Math.max(0, Math.min(currentCard.quantity, parseInt(val) || 0)))
                }}
                style={{ background: 'transparent', border: 'none', color: '#ef4444', fontSize: '3.2rem', width: '90px', textAlign: 'center', fontWeight: 900 }} />
              <button onClick={() => setQcScrapCount(v => Math.min(currentCard.quantity, v + 1))}
                style={{ width: '46px', height: '46px', background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#fff', borderRadius: '10px', fontSize: '1.4rem', cursor: 'pointer' }}>+</button>
            </div>
            <div style={{ marginTop: '10px', fontSize: '0.72rem', color: '#555' }}>
              Залишиться в картці: <strong style={{ color: '#10b981' }}>{Math.max(0, (currentCard.quantity || 0) - qcScrapCount)} шт</strong>
            </div>
          </div>

          <button onClick={handleQCScrapOverride} disabled={isProcessing || qcScrapCount <= 0}
            style={{
              background: '#ef4444', color: '#fff', border: 'none', padding: '16px', borderRadius: '14px',
              fontSize: '1.05rem', fontWeight: 1000, cursor: 'pointer',
              boxShadow: '0 10px 30px rgba(239,68,68,0.3)',
              opacity: (isProcessing || qcScrapCount <= 0) ? 0.5 : 1
            }}>
            {isProcessing ? 'ЗБЕРЕЖЕННЯ...' : '⚠️ СПИСАТИ У БРАК ВКЯ'}
          </button>
        </div>
      </div>
    </div>
  )
}
