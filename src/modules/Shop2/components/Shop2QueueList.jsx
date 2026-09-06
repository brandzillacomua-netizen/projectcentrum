import React from 'react'
import { ClipboardList, Camera, X } from 'lucide-react'

export function Shop2QueueList({
  queuedCards,
  selectedCardId,
  setSelectedCardId,
  setIsDrawerOpen,
  setScanError,
  setIsScanning,
  getNomFromCard = () => null,
  isMobile = false
}) {
  const renderQueue = () => (
    <div className="tasks-scroll" style={{ flex: 1, overflowY: 'auto', padding: '0 15px 25px' }}>
      {queuedCards.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 10px', color: '#444', fontSize: '0.8rem' }}>
          Немає карток в черзі для Цеху №2. Відскануйте першу...
        </div>
      )}
      {queuedCards.map(card => {
        const nom = typeof getNomFromCard === 'function' ? getNomFromCard(card) : null
        const isActive = String(selectedCardId) === String(card.id)
        return (
          <div key={card.id} onClick={() => { setSelectedCardId(card.id); if (isMobile) setIsDrawerOpen(false); setScanError(null); }} style={{ background: isActive ? '#8b5cf6' : '#1a1a1a', borderRadius: '12px', padding: '15px', marginBottom: '10px', cursor: 'pointer', border: '1px solid', borderColor: isActive ? '#8b5cf6' : '#333', transition: '0.2s', color: '#fff' }}>
            <div style={{ marginBottom: '4px' }}>
              <strong style={{ display: 'block', fontSize: '0.9rem', fontWeight: 800 }}>{nom?.name || 'Без назви'}</strong>
              <span style={{ fontSize: '0.65rem', color: '#8b5cf6', fontWeight: 800 }}>#{card.id.slice(-8).toUpperCase()}</span>
              <div style={{ fontSize: '0.65rem', opacity: 0.7 }}>{card.quantity} шт | Етап: {card.status === 'at-buffer' ? `Буфер ${card.operation?.toLowerCase()}` : (card.operation || '—')}</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
              <span style={{ fontSize: '0.6rem', background: isActive ? 'rgba(0,0,0,0.2)' : 'rgba(139, 92, 246, 0.1)', color: isActive ? '#fff' : '#8b5cf6', padding: '2px 6px', borderRadius: '4px', fontWeight: 900, textTransform: 'uppercase' }}>ОЧІКУЄ</span>
              <span style={{ fontSize: '0.65rem', fontWeight: 800 }}>{card.estimated_time || 0} хв</span>
            </div>
          </div>
        )
      })}
    </div>
  )

  if (isMobile) {
    return (
      <div style={{ position: 'fixed', left: 0, top: 0, bottom: 0, width: '300px', background: '#121212', zIndex: 100000, transition: '0.3s', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #222' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 900 }}>ОБЕРІТЬ КАРТУ</span>
          <X size={20} onClick={() => setIsDrawerOpen(false)} style={{ cursor: 'pointer' }} />
        </div>
        {renderQueue()}
        <div style={{ padding: '15px', borderTop: '1px solid #1a1a1a' }}>
          <button onClick={() => setIsScanning(true)}
            style={{ width: '100%', background: '#8b5cf615', border: '1px solid #8b5cf630', color: '#8b5cf6', padding: '14px', borderRadius: '12px', fontWeight: 900, fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <Camera size={18} /> СКАНУВАТИ
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="side-panel hide-mobile" style={{ width: '300px', background: '#121212', borderRight: '1px solid #222', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
      <div style={{ padding: '20px', fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 800, color: '#555', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <ClipboardList size={16} /> ЧЕРГА ЦЕХ №2 ({queuedCards.length})
      </div>
      {renderQueue()}
      <div style={{ padding: '15px', borderTop: '1px solid #1a1a1a' }}>
        <button onClick={() => setIsScanning(true)}
          style={{ width: '100%', background: '#8b5cf615', border: '1px solid #8b5cf630', color: '#8b5cf6', padding: '14px', borderRadius: '12px', fontWeight: 900, fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          <Camera size={18} /> СКАНУВАТИ
        </button>
      </div>
    </div>
  )
}
