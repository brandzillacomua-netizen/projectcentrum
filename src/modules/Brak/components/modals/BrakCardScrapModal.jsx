import React from 'react'
import { X } from 'lucide-react'

export const BrakCardScrapModal = React.memo(({
  scannedCard,
  setScannedCard,
  orders = [],
  nomenclatures = [],
  qcInspector,
  setQcInspector,
  qcCardOperators = [],
  qcResponsibleOperator,
  setQcResponsibleOperator,
  qcReason,
  setQcReason,
  scrapReasons = [],
  scrapReasonRows = [],
  qcCustomReason,
  setQcCustomReason,
  qcScrapCount,
  setQcScrapCount,
  isProcessing,
  handleQCScrapOverride
}) => {
  if (!scannedCard) return null

  const nomName = (nomenclatures || []).find(n => n.id === scannedCard.nomenclature_id)?.name || 'Деталь'
  const orderNum = orders?.find(o => o.id === scannedCard.order_id)?.order_num || '—'

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10060, padding: '20px' }}>
      <div style={{ background: 'var(--modal-bg, #111)', width: '100%', maxWidth: '460px', borderRadius: '26px', border: '1px solid #ef444440', overflow: 'hidden', boxShadow: '0 20px 60px rgba(239,68,68,0.15)' }}>
        <div style={{ padding: '20px 22px', background: 'var(--card-inner-bg, #161616)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #ef444420' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 950, color: '#ef4444', display: 'flex', alignItems: 'center', gap: '6px' }}>
              🛡️ ВІДДІЛ ВКЯ · ФІКСАЦІЯ БРАКУ
            </h3>
            <div style={{ fontSize: '0.6rem', color: 'var(--text-muted, #888)', marginTop: '2px' }}>
              Замовлення №{orderNum} · Картка #{scannedCard.id.slice(0, 8).toUpperCase()}
            </div>
          </div>
          <button onClick={() => setScannedCard(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted, #555)', cursor: 'pointer' }}>
            <X size={22} />
          </button>
        </div>
        <div style={{ padding: '24px 22px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900, color: 'var(--text-color, #fff)' }}>
            {nomName}
          </h3>

          {/* Інспектор ВКЯ */}
          <div>
            <label style={{ color: 'var(--text-muted, #888)', fontWeight: 800, fontSize: '0.7rem', display: 'block', marginBottom: '8px' }}>ПІБ Інспектора ВКЯ (або відповідального)</label>
            <input
              type="text"
              placeholder="Введіть ваше прізвище..."
              value={qcInspector}
              onChange={e => setQcInspector(e.target.value)}
              style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border-color, #333)', background: 'var(--card-inner-bg, #000)', color: 'var(--text-color, #fff)', fontSize: '0.9rem', fontWeight: 800, boxSizing: 'border-box', outline: 'none' }}
            />
          </div>

          {/* Виробничий оператор, якому присвоюється брак */}
          <div style={{ background: '#ef444410', border: '1px solid #ef444435', borderRadius: '14px', padding: '14px' }}>
            <label style={{ color: '#fca5a5', fontWeight: 900, fontSize: '0.7rem', display: 'block', marginBottom: '8px' }}>КОМУ ПРИСВОЇТИ БРАК</label>
            {qcCardOperators.length === 1 ? (
              <div style={{ color: 'var(--text-color, #fff)', fontSize: '0.9rem', fontWeight: 900 }}>
                {qcResponsibleOperator}
                <div style={{ color: 'var(--text-muted, #777)', fontSize: '0.64rem', fontWeight: 700, marginTop: '4px' }}>Єдиний оператор картки — обрано автоматично</div>
              </div>
            ) : qcCardOperators.length > 1 ? (
              <select
                value={qcResponsibleOperator}
                onChange={event => setQcResponsibleOperator(event.target.value)}
                style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: `1px solid ${qcResponsibleOperator ? '#10b98155' : '#ef444455'}`, background: 'var(--card-inner-bg, #000)', color: 'var(--text-color, #fff)', fontSize: '0.9rem', fontWeight: 800, boxSizing: 'border-box', outline: 'none' }}
              >
                <option value="">— Оберіть оператора картки —</option>
                {qcCardOperators.map(operator => <option key={operator} value={operator}>{operator}</option>)}
              </select>
            ) : (
              <div style={{ color: '#ef4444', fontSize: '0.72rem', fontWeight: 850 }}>У картці не знайдено виробничого оператора. Брак неможливо записати без відповідального.</div>
            )}
          </div>

          {/* Причина браку */}
          <div>
            <label style={{ color: 'var(--text-muted, #888)', fontWeight: 800, fontSize: '0.7rem', display: 'block', marginBottom: '8px' }}>Причина браку</label>
            <select
              value={qcReason}
              onChange={e => {
                setQcReason(e.target.value)
                if (e.target.value !== 'Інше (коментар)') {
                  setQcCustomReason('')
                }
              }}
              style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border-color, #333)', background: 'var(--card-inner-bg, #000)', color: 'var(--text-color, #fff)', fontSize: '0.9rem', fontWeight: 800, boxSizing: 'border-box', outline: 'none' }}
            >
              {scrapReasons.filter(reason => scrapReasonRows.find(row => row.name === reason)?.is_active !== false).map(reason => <option key={reason} value={reason}>{reason}</option>)}
            </select>
          </div>

          {/* Коментар до причини браку */}
          {qcReason === 'Інше (коментар)' && (
            <div>
              <label style={{ color: 'var(--text-muted, #888)', fontWeight: 800, fontSize: '0.7rem', display: 'block', marginBottom: '8px' }}>Опишіть іншу причину браку</label>
              <input
                type="text"
                placeholder="Введіть коментар..."
                value={qcCustomReason}
                onChange={e => setQcCustomReason(e.target.value)}
                style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border-color, #333)', background: 'var(--card-inner-bg, #000)', color: 'var(--text-color, #fff)', fontSize: '0.9rem', fontWeight: 800, boxSizing: 'border-box', outline: 'none' }}
              />
            </div>
          )}

          {/* Лічильник додаткового браку */}
          <div style={{ background: 'var(--card-inner-bg, #0d0d0d)', borderRadius: '14px', padding: '18px', textAlign: 'center', border: '1px solid #ef444422' }}>
            <label style={{ color: '#ef4444', fontWeight: 900, fontSize: '0.7rem', textTransform: 'uppercase', display: 'block', marginBottom: '12px' }}>
              КІЛЬКІСТЬ ВИЯВЛЕНОГО БРАКУ
            </label>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '14px' }}>
              <button 
                onClick={() => setQcScrapCount(v => Math.max(0, v - 1))}
                style={{ width: '46px', height: '46px', background: 'var(--card-bg, #1a1a1a)', border: '1px solid var(--border-color, #2a2a2a)', color: 'var(--text-color, #fff)', borderRadius: '10px', fontSize: '1.4rem', cursor: 'pointer' }}
              >−</button>
              <input 
                type="number" min={0} max={scannedCard.quantity} value={qcScrapCount === 0 ? '' : qcScrapCount} placeholder="0"
                onChange={e => {
                  const val = e.target.value
                  setQcScrapCount(val === '' ? 0 : Math.max(0, Math.min(scannedCard.quantity, parseInt(val) || 0)))
                }}
                style={{ background: 'transparent', border: 'none', color: '#ef4444', fontSize: '3.2rem', width: '90px', textAlign: 'center', fontWeight: 900, outline: 'none' }} 
              />
              <button 
                onClick={() => setQcScrapCount(v => Math.min(scannedCard.quantity, v + 1))}
                style={{ width: '46px', height: '46px', background: 'var(--card-bg, #1a1a1a)', border: '1px solid var(--border-color, #2a2a2a)', color: 'var(--text-color, #fff)', borderRadius: '10px', fontSize: '1.4rem', cursor: 'pointer' }}
              >+</button>
            </div>
            <div style={{ marginTop: '10px', fontSize: '0.72rem', color: 'var(--text-muted, #555)' }}>
              Залишиться в картці: <strong style={{ color: '#10b981' }}>{Math.max(0, (scannedCard.quantity || 0) - qcScrapCount)} шт</strong>
            </div>
          </div>

          <button 
            onClick={handleQCScrapOverride} 
            disabled={isProcessing || qcScrapCount <= 0 || !qcResponsibleOperator}
            style={{
              background: '#ef4444', color: '#fff', border: 'none', padding: '16px', borderRadius: '14px',
              fontSize: '1.05rem', fontWeight: 1000, cursor: 'pointer',
              boxShadow: '0 10px 30px rgba(239,68,68,0.3)',
              opacity: (isProcessing || qcScrapCount <= 0 || !qcResponsibleOperator) ? 0.5 : 1
            }}
          >
            {isProcessing ? 'ЗБЕРЕЖЕННЯ...' : '⚠️ ПЕРЕДАТИ В КАРАНТИН ВКЯ'}
          </button>
        </div>
      </div>
    </div>
  )
})
