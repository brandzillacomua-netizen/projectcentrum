import { useState } from 'react'
import { Check, X } from 'lucide-react'

export const MaterialDetailModal = ({
  scannedCard,
  setScannedCard,
  scannedRequests,
  setScannedRequests,
  nomenclatures,
  isIssuingCard,
  handleIssueCardMaterials
}) => {
  const [boxNumbers, setBoxNumbers] = useState({})

  if (!scannedCard) return null

  const boxNumber = boxNumbers[scannedCard.id] !== undefined
    ? boxNumbers[scannedCard.id]
    : String(scannedCard.box_number || '')
  const hasBoxNumber = String(scannedCard.box_number || '').trim().length > 0

  const isBoxIssued = Boolean(
    scannedCard.is_box_issued || String(scannedCard.card_info || '').includes('[BOX_ISSUED:true]')
  )
  const cardNom = nomenclatures.find(n => String(n.id) === String(scannedCard.nomenclature_id))
  const cardNomName = cardNom
    ? (cardNom.name + (cardNom.material_type ? ` (${cardNom.material_type})` : ''))
    : (scannedCard.name || 'Номенклатура не вказана')

  // The physical issue timestamp belongs to the box, not to individual material requests.
  let formattedIssueTime = ''
  if (scannedCard.box_issued_at) {
    const issuedAt = new Date(scannedCard.box_issued_at)
    if (!Number.isNaN(issuedAt.getTime())) {
      const pad = (n) => String(n).padStart(2, '0')
      formattedIssueTime = `${pad(issuedAt.getDate())}.${pad(issuedAt.getMonth() + 1)}.${issuedAt.getFullYear()} ${pad(issuedAt.getHours())}:${pad(issuedAt.getMinutes())}`
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', zIndex: 10040, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: 'var(--surface-1)', width: '100%', maxWidth: '500px', borderRadius: '28px', border: '1px solid var(--border-subtle)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px 25px', background: 'var(--surface-2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ color: '#ff9000', fontWeight: 900, fontSize: '0.95rem' }}>ДЕТАЛІ МАТЕРІАЛІВ КАРТКИ</span>
              {isBoxIssued && (
                <span style={{ 
                  background: 'rgba(16, 185, 129, 0.15)', 
                  color: '#10b981', 
                  border: '1px solid rgba(16, 185, 129, 0.4)', 
                  padding: '2px 8px', 
                  borderRadius: '6px', 
                  fontSize: '0.62rem', 
                  fontWeight: 950 
                }}>
                  ВИДАНО
                </span>
              )}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '2px', fontWeight: 700 }}>
              {scannedCard.card_info?.split(' ')[0] || `Картка #${scannedCard.id.substring(0, 8)}`}
            </div>
          </div>
          <button onClick={() => { setScannedCard(null); setScannedRequests([]) }} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}><X size={22} /></button>
        </div>

        {/* Physical Box Location / Issued Indicator */}
        {hasBoxNumber && (
          <div style={{
            background: isBoxIssued
              ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(5, 150, 105, 0.05))'
              : 'linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(37, 99, 235, 0.05))',
            borderBottom: isBoxIssued
              ? '1px solid rgba(16, 185, 129, 0.25)'
              : '1px solid rgba(59, 130, 246, 0.25)',
            padding: '15px 25px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <span style={{ fontSize: '1.8rem' }}>{isBoxIssued ? '📦' : '📍'}</span>
            <div>
              <div style={{ 
                fontSize: '0.62rem', 
                color: isBoxIssued ? '#10b981' : '#3b82f6',
                fontWeight: 900, 
                textTransform: 'uppercase', 
                letterSpacing: '0.05em' 
              }}>
                {isBoxIssued ? 'БОКС ВИДАНО' : 'ЛОКАЦІЯ МАТЕРІАЛІВ НА СКЛАДІ'}
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 1000, color: 'var(--text-strong)', marginTop: '2px' }}>
                БОКС №{scannedCard.box_number} {isBoxIssued && formattedIssueTime && `(в ${formattedIssueTime})`}
              </div>
            </div>
          </div>
        )}

        <div style={{ padding: '25px', display: 'flex', flexDirection: 'column', gap: '15px', maxHeight: '450px', overflowY: 'auto' }}>
          {!isBoxIssued && !hasBoxNumber && (
            <div style={{ background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.35)', borderRadius: '14px', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '7px' }}>
              <label style={{ fontSize: '0.67rem', color: '#f59e0b', fontWeight: 900 }}>
                ЦЕЙ БОКС БУВ ЗІБРАНИЙ БЕЗ НОМЕРА
              </label>
              <input
                type="text"
                value={boxNumber}
                onChange={event => setBoxNumbers(previous => ({ ...previous, [scannedCard.id]: event.target.value }))}
                placeholder="Введіть або відскануйте номер фізичного боксу"
                autoFocus
                style={{ background: 'var(--surface-inset)', border: boxNumber.trim() ? '1px solid #f59e0b' : '1px solid var(--border-subtle)', borderRadius: '10px', padding: '11px 13px', color: 'var(--text-strong)', fontSize: '0.82rem', fontWeight: 900, outline: 'none' }}
              />
              <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>Номер буде збережено в картці під час видачі.</span>
            </div>
          )}

          <div style={{
            background: '#090909',
            border: '1px solid var(--border-subtle)',
            borderRadius: '16px',
            padding: '14px 16px'
          }}>
            <div style={{ fontSize: '0.62rem', color: '#ff9000', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Виконується в картці
            </div>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-strong)', fontWeight: 900, marginTop: '5px', lineHeight: 1.25, wordBreak: 'break-word' }}>
              {cardNomName}
            </div>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '8px', fontSize: '0.68rem', color: '#777', fontWeight: 800 }}>
              <span>К-сть: {scannedCard.quantity || '—'} шт</span>
              <span>Верстат: {scannedCard.machine || scannedCard.machine_name || '—'}</span>
              <span>Матеріали: Склад оперативний</span>
            </div>
          </div>
          {isBoxIssued && (
            <div style={{
              background: 'rgba(16, 185, 129, 0.12)',
              border: '1px solid rgba(16, 185, 129, 0.35)',
              color: '#10b981',
              borderRadius: '14px',
              padding: '14px',
              fontSize: '0.95rem',
              fontWeight: 950,
              textAlign: 'center',
              textTransform: 'uppercase'
            }}>
              Матеріали видано!
            </div>
          )}
          {scannedRequests.map((req, idx) => {
            const nom = nomenclatures.find(n => n.id === req.nomenclature_id)
            const itemName = nom
              ? (nom.name + (nom.material_type ? ` (${nom.material_type})` : ''))
              : (req.details || req.name || `Матеріал ${idx + 1}`)
            const isPending = !isBoxIssued && (req.status === 'pending' || req.status === 'issued')
            const requiredQty = req.displayQty ?? Number(req.quantity)

            return (
              <div key={idx} style={{ padding: '15px', background: 'var(--surface-black)', borderRadius: '16px', border: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ flex: 1, marginRight: '10px' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-strong)' }}>{itemName}</div>
                  <div style={{ fontSize: '0.65rem', color: isPending ? '#ff9000' : '#10b981', fontWeight: 900, textTransform: 'uppercase', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {isPending ? 'Не видано' : <><Check size={10} /> Видано</>}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1rem', fontWeight: 900, color: isPending ? '#ff9000' : 'var(--text-muted)' }}>
                    {requiredQty} шт
                  </div>
                </div>
              </div>
            )
          })}
        </div>
        <div style={{ padding: '20px 25px', background: 'var(--surface-2)', display: 'flex', gap: '15px' }}>
          <button
            onClick={() => { setScannedCard(null); setScannedRequests([]) }}
            style={{ flex: 1, padding: '12px', borderRadius: '10px', background: 'var(--surface-3)', color: 'var(--text-strong)', border: 'none', fontWeight: 900, cursor: 'pointer' }}
          >
            Закрити
          </button>
          {!isBoxIssued && (
            <button
              disabled={isIssuingCard || (!hasBoxNumber && !boxNumber.trim())}
              onClick={() => handleIssueCardMaterials(boxNumber.trim())}
              style={{ flex: 2, padding: '12px', borderRadius: '10px', background: '#ff9000', color: '#000', border: 'none', fontWeight: 900, cursor: (isIssuingCard || (!hasBoxNumber && !boxNumber.trim())) ? 'not-allowed' : 'pointer', opacity: (isIssuingCard || (!hasBoxNumber && !boxNumber.trim())) ? 0.5 : 1 }}
            >
              {isIssuingCard ? 'ОБРОБКА...' : !hasBoxNumber && !boxNumber.trim() ? 'ВКАЖІТЬ НОМЕР БОКСУ' : 'ВИДАТИ БОКС І МАТЕРІАЛИ'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
