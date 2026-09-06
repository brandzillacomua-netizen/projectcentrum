import React from 'react'
import { X } from 'lucide-react'

export const OperatorScrapModal = ({
  showScrapModal,
  setShowScrapModal,
  currentCard,
  getNomFromCard,
  scrapCounts,
  setScrapCounts,
  matchesStage,
  getCuttersForCard,
  cuttersBreakdown,
  setCuttersBreakdown,
  handleFinalFinish
}) => {
  if (!showScrapModal || !currentCard) return null

  const nom = getNomFromCard(currentCard)

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.96)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10020, padding: '20px' }}>
      <div style={{ background: '#111', width: '100%', maxWidth: '500px', borderRadius: '32px', border: '1px solid #333', display: 'flex', flexDirection: 'column', maxHeight: '90vh', overflow: 'hidden' }}>
        <div style={{ padding: '25px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#1a1a1a', flexShrink: 0 }}>
          <h3 style={{ margin: 0 }}>ЗАВЕРШИТИ — {currentCard.operation?.toUpperCase()}</h3>
          <button onClick={() => setShowScrapModal(false)} style={{ background: 'transparent', border: 'none', color: '#555' }}><X size={26} /></button>
        </div>
        <div style={{ padding: '30px', textAlign: 'center', overflowY: 'auto', flex: 1 }}>
          <h2 style={{ margin: '0 0 20px' }}>{nom?.name}</h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ background: '#000', padding: '20px', borderRadius: '20px' }}>
              <label style={{ color: '#ef4444', fontWeight: 900, display: 'block', marginBottom: '15px' }}>КІЛЬКІСТЬ БРАКУ</label>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px' }}>
                <button onClick={() => setScrapCounts(p => ({ ...p, [nom?.id]: Math.max(0, (p[nom?.id] || 0) - 1) }))} style={{ width: '50px', height: '50px', background: '#1a1a1a', border: '1px solid #333', color: '#fff', borderRadius: '12px' }}>-</button>
                <input type="number" value={scrapCounts[nom?.id] === 0 ? '' : (scrapCounts[nom?.id] || '')} placeholder="0" onChange={e => { const val = e.target.value; setScrapCounts({ [nom?.id]: val === '' ? 0 : (parseInt(val) || 0) }) }} style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '3rem', width: '100px', textAlign: 'center' }} />
                <button onClick={() => setScrapCounts(p => ({ ...p, [nom?.id]: (p[nom?.id] || 0) + 1 }))} style={{ width: '50px', height: '50px', background: '#1a1a1a', border: '1px solid #333', color: '#fff', borderRadius: '12px' }}>+</button>
              </div>
            </div>

            {matchesStage(currentCard.operation, 'Розкрій') && (() => {
              const cardCutters = getCuttersForCard(currentCard)
              return (
                <div style={{ background: '#000', padding: '20px', borderRadius: '20px', border: '1px solid #eab308', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  <label style={{ color: '#eab308', fontWeight: 900, display: 'block', textTransform: 'uppercase' }}>ФАКТИЧНО ФРЕЗ ВИКОРИСТАНО</label>
                  {cardCutters.map(cutterName => {
                    const currentVal = cuttersBreakdown[cutterName] || 0
                    return (
                      <div key={cutterName} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#111', padding: '10px 15px', borderRadius: '12px', border: '1px solid #222' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#aaa', maxWidth: '60%', textAlign: 'left' }}>{cutterName}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <button onClick={() => setCuttersBreakdown(p => ({ ...p, [cutterName]: Math.max(0, currentVal - 1) }))}
                            type="button"
                            style={{ width: '36px', height: '36px', background: '#1a1a1a', border: '1px solid #333', color: '#fff', borderRadius: '8px', cursor: 'pointer', fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>-</button>
                          <input type="number" min={0} value={currentVal === 0 ? '' : currentVal} placeholder="0"
                            onChange={e => {
                              const val = e.target.value
                              setCuttersBreakdown(p => ({ ...p, [cutterName]: val === '' ? 0 : Math.max(0, parseInt(val) || 0) }))
                            }}
                            style={{ background: 'transparent', border: 'none', color: '#eab308', fontSize: '1.3rem', width: '50px', textAlign: 'center', fontWeight: 900 }} />
                          <button onClick={() => setCuttersBreakdown(p => ({ ...p, [cutterName]: currentVal + 1 }))}
                            type="button"
                            style={{ width: '36px', height: '36px', background: '#1a1a1a', border: '1px solid #333', color: '#fff', borderRadius: '8px', cursor: 'pointer', fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                        </div>
                      </div>
                    )
                  })}
                  <div style={{ borderTop: '1px solid #222', paddingTop: '10px', fontSize: '0.8rem', color: '#555' }}>
                    Всього використано: <strong style={{ color: '#eab308' }}>{Object.values(cuttersBreakdown).reduce((sum, v) => sum + (Number(v) || 0), 0)} шт</strong>
                  </div>
                </div>
              )
            })()}
          </div>

          <button onClick={handleFinalFinish} style={{ width: '100%', background: '#10b981', color: '#fff', border: 'none', padding: '20px', borderRadius: '15px', fontWeight: 900, marginTop: '30px' }}>ПІДТВЕРДИТИ ТА В БУФЕР</button>
        </div>
      </div>
    </div>
  )
}
