import React from 'react'
import { X } from 'lucide-react'

export const OperatorDetailStageModal = ({
  detailStage,
  setDetailStage,
  detailTab,
  setDetailTab,
  workCardHistory,
  matchesStage,
  nomenclatures,
  workCards,
  getNomFromCard
}) => {
  if (!detailStage) return null

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', zIndex: 10030, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ width: '100%', maxWidth: '700px', background: '#111', borderRadius: '32px', border: '1px solid #333', overflow: 'hidden' }}>
        <div style={{ padding: '25px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#1a1a1a' }}>
          <h2 style={{ margin: 0, color: '#eab308' }}>{detailStage.toUpperCase()}</h2>
          <button onClick={() => setDetailStage(null)} style={{ background: '#222', border: 'none', color: '#fff', padding: '10px', borderRadius: '10px' }}><X size={20} /></button>
        </div>
        <div style={{ display: 'flex', padding: '15px', gap: '10px' }}>
          <button onClick={() => setDetailTab('work')} style={{ flex: 1, padding: '15px', borderRadius: '15px', border: 'none', background: detailTab === 'work' ? '#3b82f6' : '#222', color: '#fff', fontWeight: 900 }}>У РОБОТІ</button>
          <button onClick={() => setDetailTab('buffer')} style={{ flex: 1, padding: '15px', borderRadius: '15px', border: 'none', background: detailTab === 'buffer' ? '#10b981' : '#222', color: '#fff', fontWeight: 900 }}>БУФЕР</button>
          <button onClick={() => setDetailTab('scrap')} style={{ flex: 1, padding: '15px', borderRadius: '15px', border: 'none', background: detailTab === 'scrap' ? '#ef4444' : '#222', color: '#fff', fontWeight: 900 }}>БРАК</button>
        </div>
        <div style={{ padding: '0 15px 15px', maxHeight: '450px', overflowY: 'auto' }}>
          {(() => {
            const agg = {}
            if (detailTab === 'scrap') {
              workCardHistory
                .filter(h => matchesStage(h.stage_name, detailStage))
                .forEach(h => {
                  if (Number(h.scrap_qty) > 0) {
                    const nom = nomenclatures.find(n => String(n.id) === String(h.nomenclature_id))
                    const name = nom?.name || 'Деталь'
                    agg[name] = (agg[name] || 0) + Number(h.scrap_qty)
                  }
                })
            } else {
              workCards
                .filter(c => {
                  const stageMatch = matchesStage(c.operation, detailStage)
                  const statusMatch = detailTab === 'work'
                    ? c.status === 'in-progress'
                    : ['at-buffer', 'waiting-buffer'].includes(c.status)
                  return stageMatch && statusMatch
                })
                .forEach(c => {
                  const nom = getNomFromCard(c)
                  const name = nom?.name || 'Деталь'
                  agg[name] = (agg[name] || 0) + (c.quantity || 0)
                })
            }
            const items = Object.entries(agg)
            if (items.length === 0) return <div style={{ textAlign: 'center', padding: '50px', color: '#444' }}>Немає даних</div>
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                {items.map(([name, qty], idx) => (
                  <div key={idx} style={{ background: 'rgba(255,255,255,0.02)', padding: '15px 20px', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontWeight: 800 }}>{name}</div>
                    <div style={{ fontWeight: 1000, fontSize: '1.2rem', color: detailTab === 'work' ? '#3b82f6' : detailTab === 'buffer' ? '#10b981' : '#ef4444' }}>{qty} <small style={{ opacity: 0.3 }}>шт</small></div>
                  </div>
                ))}
              </div>
            )
          })()}
        </div>
      </div>
    </div>
  )
}
