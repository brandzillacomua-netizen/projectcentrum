import React from 'react'
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
  if (!scannedCard) return null

  const isFullyIssued = scannedRequests.length > 0 && scannedRequests.every(r => r.status === 'completed')
  const cardNom = nomenclatures.find(n => String(n.id) === String(scannedCard.nomenclature_id))
  const cardNomName = cardNom
    ? (cardNom.name + (cardNom.material_type ? ` (${cardNom.material_type})` : ''))
    : (scannedCard.name || 'Номенклатура не вказана')

  // Calculate last issue time based on updated_at/created_at of completed requests
  const completedRequests = scannedRequests.filter(r => r.status === 'completed')
  let formattedIssueTime = ''
  if (completedRequests.length > 0) {
    const times = completedRequests.map(r => new Date(r.updated_at || r.created_at).getTime()).filter(t => !isNaN(t))
    if (times.length > 0) {
      const maxTime = new Date(Math.max(...times))
      const pad = (n) => String(n).padStart(2, '0')
      formattedIssueTime = `${pad(maxTime.getDate())}.${pad(maxTime.getMonth() + 1)}.${maxTime.getFullYear()} ${pad(maxTime.getHours())}:${pad(maxTime.getMinutes())}`
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', zIndex: 10040, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: '#111', width: '100%', maxWidth: '500px', borderRadius: '28px', border: '1px solid #333', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px 25px', background: '#1a1a1a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ color: '#ff9000', fontWeight: 900, fontSize: '0.95rem' }}>ДЕТАЛІ МАТЕРІАЛІВ КАРТКИ</span>
              {isFullyIssued && (
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
            <div style={{ fontSize: '0.72rem', color: '#666', marginTop: '2px', fontWeight: 700 }}>
              {scannedCard.card_info?.split(' ')[0] || `Картка #${scannedCard.id.substring(0, 8)}`}
            </div>
          </div>
          <button onClick={() => { setScannedCard(null); setScannedRequests([]) }} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}><X size={22} /></button>
        </div>

        {/* Physical Box Location / Issued Indicator */}
        {scannedCard.box_number && (
          <div style={{
            background: isFullyIssued 
              ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(5, 150, 105, 0.05))'
              : 'linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(37, 99, 235, 0.05))',
            borderBottom: isFullyIssued
              ? '1px solid rgba(16, 185, 129, 0.25)'
              : '1px solid rgba(59, 130, 246, 0.25)',
            padding: '15px 25px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <span style={{ fontSize: '1.8rem' }}>{isFullyIssued ? '📦' : '📍'}</span>
            <div>
              <div style={{ 
                fontSize: '0.62rem', 
                color: isFullyIssued ? '#10b981' : '#3b82f6', 
                fontWeight: 900, 
                textTransform: 'uppercase', 
                letterSpacing: '0.05em' 
              }}>
                {isFullyIssued ? 'БОКС ВИДАНО' : 'ЛОКАЦІЯ МАТЕРІАЛІВ НА СКЛАДІ'}
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 1000, color: '#fff', marginTop: '2px' }}>
                БОКС №{scannedCard.box_number} {isFullyIssued && formattedIssueTime && `(в ${formattedIssueTime})`}
              </div>
            </div>
          </div>
        )}

        <div style={{ padding: '25px', display: 'flex', flexDirection: 'column', gap: '15px', maxHeight: '450px', overflowY: 'auto' }}>
          <div style={{
            background: '#090909',
            border: '1px solid #1a1a1a',
            borderRadius: '16px',
            padding: '14px 16px'
          }}>
            <div style={{ fontSize: '0.62rem', color: '#ff9000', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Виконується в картці
            </div>
            <div style={{ fontSize: '0.9rem', color: '#fff', fontWeight: 900, marginTop: '5px', lineHeight: 1.25, wordBreak: 'break-word' }}>
              {cardNomName}
            </div>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '8px', fontSize: '0.68rem', color: '#777', fontWeight: 800 }}>
              <span>К-сть: {scannedCard.quantity || '—'} шт</span>
              <span>Верстат: {scannedCard.machine || scannedCard.machine_name || '—'}</span>
              <span>Матеріали: Склад оперативний</span>
            </div>
          </div>
          {isFullyIssued && (
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
            const isPending = req.status === 'pending' || req.status === 'issued'
            const requiredQty = req.displayQty ?? Number(req.quantity)

            return (
              <div key={idx} style={{ padding: '15px', background: '#000', borderRadius: '16px', border: '1px solid #1a1a1a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ flex: 1, marginRight: '10px' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#fff' }}>{itemName}</div>
                  <div style={{ fontSize: '0.65rem', color: isPending ? '#ff9000' : '#10b981', fontWeight: 900, textTransform: 'uppercase', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {isPending ? 'Не видано' : <><Check size={10} /> Видано</>}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1rem', fontWeight: 900, color: isPending ? '#ff9000' : '#888' }}>
                    {requiredQty} шт
                  </div>
                </div>
              </div>
            )
          })}
        </div>
        <div style={{ padding: '20px 25px', background: '#1a1a1a', display: 'flex', gap: '15px' }}>
          <button
            onClick={() => { setScannedCard(null); setScannedRequests([]) }}
            style={{ flex: 1, padding: '12px', borderRadius: '10px', background: '#222', color: '#fff', border: 'none', fontWeight: 900, cursor: 'pointer' }}
          >
            Закрити
          </button>
          {!isFullyIssued && scannedRequests.some(r => r.status === 'pending' || r.status === 'issued') && (
            <button
              disabled={isIssuingCard}
              onClick={handleIssueCardMaterials}
              style={{ flex: 2, padding: '12px', borderRadius: '10px', background: '#ff9000', color: '#000', border: 'none', fontWeight: 900, cursor: isIssuingCard ? 'not-allowed' : 'pointer', opacity: isIssuingCard ? 0.5 : 1 }}
            >
              {isIssuingCard ? 'ОБРОБКА...' : 'ВИДАТИ МАТЕРІАЛИ'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
