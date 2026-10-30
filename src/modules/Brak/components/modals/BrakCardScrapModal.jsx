import React from 'react'
import { X, Stamp, ShieldAlert } from 'lucide-react'
import { parseQcOpsStamps } from '../../../Shop1/utils/shop1Helpers.js'

export const BrakCardScrapModal = React.memo(({
  scannedCard,
  setScannedCard,
  orders = [],
  nomenclatures = [],
  currentUser,
  systemUsers = [],
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
  handleQCScrapOverride,
  onOpenCardStampModal
}) => {
  // Lock body scroll and prevent background scroll bleeding on mobile touch
  React.useEffect(() => {
    if (!scannedCard) return
    const prevOverflow = document.body.style.overflow
    const prevOverscroll = document.body.style.overscrollBehavior
    const prevTouchAction = document.body.style.touchAction
    document.body.style.overflow = 'hidden'
    document.body.style.overscrollBehavior = 'none'
    document.body.style.touchAction = 'pan-y'
    return () => {
      document.body.style.overflow = prevOverflow
      document.body.style.overscrollBehavior = prevOverscroll
      document.body.style.touchAction = prevTouchAction
    }
  }, [scannedCard])

  // Automatically select/fill current inspector from logged in user if not set
  React.useEffect(() => {
    if ((!qcInspector || !qcInspector.trim()) && (currentUser || systemUsers?.length)) {
      const sysUser = (systemUsers || []).find(u =>
        (currentUser?.id && u.id === currentUser.id) ||
        (currentUser?.login && u.login === currentUser.login)
      )
      const resolved = (sysUser && [sysUser.last_name, sysUser.first_name].filter(Boolean).join(' ').trim()) ||
        (currentUser && [currentUser.last_name, currentUser.first_name].filter(Boolean).join(' ').trim()) ||
        currentUser?.name || currentUser?.username || currentUser?.login || ''
      if (resolved && typeof setQcInspector === 'function') {
        setQcInspector(resolved)
      }
    }
  }, [qcInspector, currentUser, systemUsers, setQcInspector])

  if (!scannedCard) return null

  const nomName = (nomenclatures || []).find(n => n.id === scannedCard.nomenclature_id)?.name || 'Деталь'
  const orderNum = orders?.find(o => o.id === scannedCard.order_id)?.order_num || '—'
  const qcOpsData = parseQcOpsStamps(scannedCard.card_info)
  const stampedOpsCount = Object.keys(qcOpsData?.ops || {}).length
  const sheetsApproved = Boolean(qcOpsData?.sheets?.verified || qcOpsData?.sheets?.approved)
  const hasAnyStamp = stampedOpsCount > 0 || sheetsApproved

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100dvh',
        background: 'rgba(0,0,0,0.88)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100060, // Above mobile-app-topbar (99990)
        padding: '8px',
        boxSizing: 'border-box',
        overflow: 'hidden',
        overscrollBehavior: 'contain',
        touchAction: 'pan-y'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isProcessing) {
          setScannedCard(null)
        }
      }}
    >
      <div
        style={{
          background: 'var(--modal-bg, #111)',
          width: '100%',
          maxWidth: '480px',
          maxHeight: 'calc(100dvh - 16px)',
          borderRadius: '20px',
          border: '1.5px solid rgba(239, 68, 68, 0.4)',
          overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
          display: 'flex',
          flexDirection: 'column'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '12px 16px',
            background: 'var(--card-inner-bg, #161616)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid rgba(239, 68, 68, 0.2)',
            gap: '10px',
            flexShrink: 0
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <h3 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 950, color: '#ef4444', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ShieldAlert size={18} style={{ flexShrink: 0 }} />
              <span>ВІДДІЛ ВКЯ · КАРТКА</span>
            </h3>
            <div style={{ fontSize: '0.64rem', color: 'var(--text-muted, #888)', marginTop: '2px', wordBreak: 'break-word' }}>
              Замовлення №{orderNum} · Картка #{String(scannedCard.id || '').slice(-8).toUpperCase()}
            </div>
          </div>
          <button
            onClick={() => setScannedCard(null)}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted, #555)', cursor: 'pointer', padding: '6px', flexShrink: 0 }}
          >
            <X size={22} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div
          style={{
            padding: '12px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '11px',
            overflowY: 'auto',
            flex: 1,
            overscrollBehavior: 'contain',
            WebkitOverflowScrolling: 'touch'
          }}
        >
          {/* Card Part Name */}
          <div style={{ background: 'var(--card-inner-bg, rgba(255,255,255,0.03))', padding: '10px 14px', borderRadius: '12px', border: '1px solid var(--border-color, rgba(255,255,255,0.08))' }}>
            <div style={{ fontSize: '0.62rem', fontWeight: 800, color: 'var(--text-muted, #94a3b8)', textTransform: 'uppercase' }}>
              Деталь на картці ({scannedCard.quantity || 0} шт):
            </div>
            <div style={{ fontSize: '0.98rem', fontWeight: 950, color: 'var(--text-color, #fff)', marginTop: '2px', wordBreak: 'break-word' }}>
              {nomName}
            </div>
          </div>

          {/* Primary Action Banner: VKYA Stamp Approval */}
          {typeof onOpenCardStampModal === 'function' && (
            <div
              style={{
                background: hasAnyStamp ? 'rgba(16, 185, 129, 0.12)' : 'rgba(16, 185, 129, 0.08)',
                border: '1.5px solid #10b981',
                borderRadius: '16px',
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 950, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                  {hasAnyStamp ? '💮 ОПЕРАЦІЇ ПОГОДЖЕНО' : '💮 ПОГОДЖЕННЯ ОПЕРАЦІЙ ВКЯ'}
                </span>
                {hasAnyStamp && (
                  <span style={{ fontSize: '0.68rem', fontWeight: 900, color: '#047857', background: '#ecfdf5', padding: '2px 8px', borderRadius: '999px' }}>
                    {qcOpsData.lastStamp || 'ВКЯ'} ({stampedOpsCount} опер.{sheetsApproved ? ' · Листи ✓' : ''})
                  </span>
                )}
                {qcOpsData?.lastHourlyCheck && (
                  <span style={{ fontSize: '0.66rem', fontWeight: 900, color: '#0284c7', background: '#f0f9ff', padding: '2px 8px', borderRadius: '999px' }}>
                    ⏱️ {qcOpsData.lastHourlyCheck.sheetText ? `${qcOpsData.lastHourlyCheck.sheetText} · ` : ''}{qcOpsData.lastHourlyCheck.statusText || 'в нормі'} ({qcOpsData.lastHourlyCheck.time})
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => onOpenCardStampModal(scannedCard)}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: '12px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: '#fff',
                  fontSize: '0.86rem',
                  fontWeight: 950,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)'
                }}
              >
                <Stamp size={18} />
                <span>{hasAnyStamp ? 'ВІДКРИТИ / РЕДАГУВАТИ ПЕЧАТКИ' : 'ПОСТАВИТИ ПЕЧАТКУ ВКЯ (ОПЕРАЦІЇ)'}</span>
              </button>
            </div>
          )}

          {/* Section: Scrap Recording */}
          <div
            className="brak-scrap-box"
            style={{
              background: 'var(--card-inner-bg, rgba(239, 68, 68, 0.04))',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              borderRadius: '16px',
              padding: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}
          >
            <div className="brak-scrap-title" style={{ fontSize: '0.7rem', fontWeight: 950, color: '#f87171', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              ⚠️ ФІКСАЦІЯ БРАКУ (КАРАНТИН)
            </div>

            {/* Інспектор ВКЯ */}
            <div>
              <label style={{ color: 'var(--text-muted, #888)', fontWeight: 800, fontSize: '0.66rem', display: 'block', marginBottom: '4px' }}>
                ПІБ Інспектора ВКЯ (або відповідального)
              </label>
              <input
                type="text"
                list="qc-card-inspectors-datalist"
                placeholder="Введіть ваше прізвище..."
                value={qcInspector}
                onChange={e => setQcInspector(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', borderRadius: '10px', border: '1px solid var(--border-color, var(--border-subtle))', background: 'var(--card-inner-bg, #000)', color: 'var(--text-color, #fff)', fontSize: '0.84rem', fontWeight: 800, boxSizing: 'border-box', outline: 'none' }}
              />
              <datalist id="qc-card-inspectors-datalist">
                {(systemUsers || []).map(u => [u.last_name, u.first_name].filter(Boolean).join(' ').trim() || u.name || u.login).filter(Boolean).map(name => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </div>

            {/* Виробничий оператор, якому присвоюється брак */}
            <div className="brak-scrap-assign-box" style={{ background: '#ef444410', border: '1px solid #ef444435', borderRadius: '12px', padding: '10px 12px' }}>
              <label className="brak-scrap-assign-label" style={{ color: '#fca5a5', fontWeight: 900, fontSize: '0.66rem', display: 'block', marginBottom: '4px' }}>
                КОМУ ПРИСВОЇТИ БРАК
              </label>
              {qcCardOperators.length === 1 ? (
                <div style={{ color: 'var(--text-color, #fff)', fontSize: '0.84rem', fontWeight: 900 }}>
                  {qcResponsibleOperator}
                  <div style={{ color: 'var(--text-muted, #777)', fontSize: '0.62rem', fontWeight: 700, marginTop: '2px' }}>
                    Єдиний оператор картки — обрано автоматично
                  </div>
                </div>
              ) : qcCardOperators.length > 1 ? (
                <div>
                  <select
                    value={qcResponsibleOperator}
                    onChange={event => setQcResponsibleOperator(event.target.value)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '10px', border: `1px solid ${qcResponsibleOperator ? '#10b98155' : '#ef444455'}`, background: 'var(--card-inner-bg, #000)', color: 'var(--text-color, #fff)', fontSize: '0.82rem', fontWeight: 800, boxSizing: 'border-box', outline: 'none' }}
                  >
                    <option value="">— Оберіть оператора картки —</option>
                    {qcCardOperators.map(operator => {
                      const cardOp = String(scannedCard?.operator_name || '').toLowerCase().trim()
                      const opNorm = String(operator || '').toLowerCase().trim()
                      const isCurrent = cardOp && (opNorm === cardOp || opNorm.includes(cardOp) || cardOp.includes(opNorm))
                      return (
                        <option key={operator} value={operator}>
                          {operator} {isCurrent ? '⚡ (поточний)' : '⏳ (попередній)'}
                        </option>
                      )
                    })}
                  </select>
                </div>
              ) : (
                <div style={{ color: '#ef4444', fontSize: '0.7rem', fontWeight: 850 }}>
                  У картці не знайдено виробничого оператора. Брак неможливо записати без відповідального.
                </div>
              )}
            </div>

            {/* Причина браку */}
            <div>
              <label style={{ color: 'var(--text-muted, #888)', fontWeight: 800, fontSize: '0.66rem', display: 'block', marginBottom: '4px' }}>
                Причина браку
              </label>
              <select
                value={qcReason}
                onChange={e => {
                  setQcReason(e.target.value)
                  if (e.target.value !== 'Інше (коментар)') {
                    setQcCustomReason('')
                  }
                }}
                style={{ width: '100%', padding: '9px 12px', borderRadius: '10px', border: '1px solid var(--border-color, var(--border-subtle))', background: 'var(--card-inner-bg, #000)', color: 'var(--text-color, #fff)', fontSize: '0.82rem', fontWeight: 800, boxSizing: 'border-box', outline: 'none' }}
              >
                {scrapReasons.filter(reason => scrapReasonRows.find(row => row.name === reason)?.is_active !== false).map(reason => (
                  <option key={reason} value={reason}>{reason}</option>
                ))}
              </select>
            </div>

            {/* Коментар до причини браку */}
            {qcReason === 'Інше (коментар)' && (
              <div>
                <label style={{ color: 'var(--text-muted, #888)', fontWeight: 800, fontSize: '0.66rem', display: 'block', marginBottom: '4px' }}>
                  Опишіть іншу причину браку
                </label>
                <input
                  type="text"
                  placeholder="Введіть коментар..."
                  value={qcCustomReason}
                  onChange={e => setQcCustomReason(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '10px', border: '1px solid var(--border-color, var(--border-subtle))', background: 'var(--card-inner-bg, #000)', color: 'var(--text-color, #fff)', fontSize: '0.84rem', fontWeight: 800, boxSizing: 'border-box', outline: 'none' }}
                />
              </div>
            )}

            {/* Лічильник браку */}
            <div className="brak-scrap-counter-box" style={{ background: 'var(--card-inner-bg, #0d0d0d)', borderRadius: '12px', padding: '10px 12px', textAlign: 'center', border: '1px solid #ef444422' }}>
              <label className="brak-scrap-counter-label" style={{ color: '#ef4444', fontWeight: 900, fontSize: '0.64rem', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                КІЛЬКІСТЬ ВИЯВЛЕНОГО БРАКУ
              </label>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                <button
                  type="button"
                  onClick={() => setQcScrapCount(v => Math.max(0, v - 1))}
                  style={{ width: '40px', height: '40px', background: 'var(--card-bg, var(--border-subtle))', border: '1px solid var(--border-color, var(--border-subtle))', color: 'var(--text-color, #fff)', borderRadius: '10px', fontSize: '1.2rem', cursor: 'pointer' }}
                >
                  −
                </button>
                <input
                  type="number"
                  min={0}
                  max={scannedCard.quantity}
                  value={qcScrapCount === 0 ? '' : qcScrapCount}
                  placeholder="0"
                  onChange={e => {
                    const val = e.target.value
                    setQcScrapCount(val === '' ? 0 : Math.max(0, Math.min(scannedCard.quantity, parseInt(val) || 0)))
                  }}
                  style={{ background: 'transparent', border: 'none', color: '#ef4444', fontSize: '2.1rem', width: '75px', textAlign: 'center', fontWeight: 950, outline: 'none' }}
                />
                <button
                  type="button"
                  onClick={() => setQcScrapCount(v => Math.min(scannedCard.quantity, v + 1))}
                  style={{ width: '40px', height: '40px', background: 'var(--card-bg, var(--border-subtle))', border: '1px solid var(--border-color, var(--border-subtle))', color: 'var(--text-color, #fff)', borderRadius: '10px', fontSize: '1.2rem', cursor: 'pointer' }}
                >
                  +
                </button>
              </div>
              <div style={{ marginTop: '6px', fontSize: '0.68rem', color: 'var(--text-muted, #777)' }}>
                Залишиться в картці: <strong style={{ color: '#10b981' }}>{Math.max(0, (scannedCard.quantity || 0) - qcScrapCount)} шт</strong>
              </div>
            </div>

            <button
              type="button"
              onClick={handleQCScrapOverride}
              disabled={isProcessing || qcScrapCount <= 0 || !qcResponsibleOperator}
              style={{
                background: '#ef4444',
                color: '#fff',
                border: 'none',
                padding: '12px',
                borderRadius: '12px',
                fontSize: '0.92rem',
                fontWeight: 1000,
                cursor: 'pointer',
                boxShadow: '0 8px 24px rgba(239,68,68,0.25)',
                opacity: (isProcessing || qcScrapCount <= 0 || !qcResponsibleOperator) ? 0.45 : 1
              }}
            >
              {isProcessing ? 'ЗБЕРЕЖЕННЯ...' : '⚠️ ПЕРЕДАТИ В КАРАНТИН ВКЯ'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
})
