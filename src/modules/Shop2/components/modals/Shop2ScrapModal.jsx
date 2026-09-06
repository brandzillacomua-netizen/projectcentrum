import React from 'react'
import { X } from 'lucide-react'

export const Shop2ScrapModal = ({
  showScrapModal,
  setShowScrapModal,
  currentCard,
  getNomFromCard = () => null,
  scrapCounts,
  setScrapCounts,
  handleFinalFinish,
  isProcessing
}) => {
  if (!showScrapModal || !currentCard) return null
  const nom = typeof getNomFromCard === 'function' ? getNomFromCard(currentCard) : null
  const currentScrap = scrapCounts[nom?.id] || 0

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.96)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10020, padding: '20px' }}>
      <div style={{ background: '#111', width: '100%', maxWidth: '500px', borderRadius: '32px', border: '1px solid #333', overflow: 'hidden' }}>
        <div style={{ padding: '25px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#1a1a1a' }}>
          <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 950 }}>ЗАВЕРШЕННЯ ЕТАПУ (ЦЕХ №2)</h3>
          <button onClick={() => setShowScrapModal(false)} style={{ background: 'transparent', border: 'none', color: '#555', cursor: 'pointer' }}><X size={26} /></button>
        </div>
        <div style={{ padding: '30px', textAlign: 'center' }}>
          <h2 style={{ margin: '0 0 20px', fontSize: '1.4rem' }}>{nom?.name || 'Деталь'}</h2>
          <div style={{ background: '#000', padding: '25px', borderRadius: '24px' }}>
            <label style={{ color: '#ef4444', fontWeight: 900, display: 'block', marginBottom: '15px', fontSize: '0.75rem' }}>КІЛЬКІСТЬ БРАКОВАНИХ ДЕТАЛЕЙ</label>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '20px' }}>
              <button onClick={() => setScrapCounts(p => ({ ...p, [nom?.id]: Math.max(0, currentScrap - 1) }))} style={{ width: '60px', height: '60px', background: '#1a1a1a', border: '1px solid #333', color: '#fff', borderRadius: '15px', fontSize: '1.5rem', cursor: 'pointer' }}>-</button>
              <input type="number" min="0" max={currentCard.quantity || 0} value={currentScrap === 0 ? '' : currentScrap} placeholder="0" onChange={e => { const val = e.target.value; const qty = val === '' ? 0 : Math.min(Number(currentCard.quantity || 0), Math.max(0, parseInt(val) || 0)); setScrapCounts(p => ({ ...p, [nom?.id]: qty })) }} style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '3.5rem', width: '120px', textAlign: 'center', fontWeight: 900 }} />
              <button onClick={() => setScrapCounts(p => ({ ...p, [nom?.id]: Math.min(Number(currentCard.quantity || 0), currentScrap + 1) }))} style={{ width: '60px', height: '60px', background: '#1a1a1a', border: '1px solid #333', color: '#fff', borderRadius: '15px', fontSize: '1.5rem', cursor: 'pointer' }}>+</button>
            </div>
          </div>
          <button disabled={isProcessing} onClick={handleFinalFinish} style={{ width: '100%', background: '#10b981', color: '#fff', border: 'none', padding: '20px', borderRadius: '18px', fontSize: '1.3rem', fontWeight: 900, marginTop: '30px', cursor: 'pointer', opacity: isProcessing ? 0.5 : 1 }}>ПІДТВЕРДИТИ</button>
        </div>
      </div>
    </div>
  )
}
