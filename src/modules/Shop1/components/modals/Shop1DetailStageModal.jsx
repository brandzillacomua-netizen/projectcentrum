import React from 'react'
import { X } from 'lucide-react'

export function Shop1DetailStageModal({
  detailStage,
  onClose,
  detailTab,
  setDetailTab,
  workCardHistory,
  workCards,
  nomenclatures,
  getNom,
  isProcessing,
  handleArchiveStageScrap
}) {
  if (!detailStage) return null

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 10030, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 20px', overflowY: 'auto' }}>
      <div style={{ width: '100%', maxWidth: '620px', background: '#111', borderRadius: '24px', border: '1px solid #1e1e1e', overflow: 'hidden', margin: 'auto 0' }}>
        <div style={{ padding: '20px 22px', background: '#161616', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, color: '#eab308', fontWeight: 950 }}>{detailStage.toUpperCase()}</h2>
          <button onClick={onClose} style={{ background: '#1e1e1e', border: 'none', color: '#fff', padding: '8px', borderRadius: '8px', cursor: 'pointer' }}>
            <X size={17} />
          </button>
        </div>
        <div style={{ display: 'flex', padding: '12px', gap: '7px' }}>
          {[{ key: 'work', label: 'У РОБОТІ', color: '#3b82f6' }, { key: 'buffer', label: 'БУФЕР', color: '#f59e0b' }, { key: 'scrap', label: 'БРАК', color: '#ef4444' }].map(t => (
            <button
              key={t.key}
              onClick={() => setDetailTab(t.key)}
              style={{
                flex: 1, padding: '11px', borderRadius: '10px', border: 'none', fontWeight: 900, cursor: 'pointer', fontSize: '0.72rem',
                background: detailTab === t.key ? t.color : '#1e1e1e',
                color: detailTab === t.key ? '#fff' : '#444'
              }}>
              {t.label}
            </button>
          ))}
        </div>
        <div style={{ padding: '0 12px 12px', maxHeight: '400px', overflowY: 'auto' }}>
          {(() => {
            const agg = {}
            if (detailTab === 'scrap') {
              const scraps = (workCardHistory || []).filter(h => {
                const matchStage = detailStage === 'Галтовка' ? h.stage_name?.startsWith('Галтовка') : h.stage_name === detailStage
                if (!matchStage || h.is_archived_scrap || Number(h.scrap_qty) <= 0) return false
                const nom = (nomenclatures || []).find(n => String(n.id) === String(h.nomenclature_id))
                return !nom || nom.type === 'part'
              })
              scraps.forEach(h => {
                const nom = (nomenclatures || []).find(n => String(n.id) === String(h.nomenclature_id))
                const nomId = h.nomenclature_id
                const name = nom?.name || 'Деталь'
                if (!agg[nomId]) agg[nomId] = { name, qty: 0, nomId }
                agg[nomId].qty += Number(h.scrap_qty)
              })
            } else {
              (workCards || []).filter(c => {
                const matchOp = detailStage === 'Галтовка' ? c.operation?.startsWith('Галтовка') : c.operation === detailStage
                if (!matchOp) return false
                if (detailTab === 'work' ? c.status !== 'in-progress' : c.status !== 'at-buffer') return false
                const nom = getNom(c)
                return !nom || nom.type === 'part'
              }).forEach(c => {
                const nom = getNom(c)
                const name = nom?.name || 'Деталь'
                const op = c.operation || ''
                const key = `${name}_${op}`
                if (!agg[key]) agg[key] = { name, op, qty: 0 }
                agg[key].qty += (c.quantity || 0)
              })
            }
            const items = Object.values(agg)
            if (!items.length) return <div style={{ textAlign: 'center', padding: '46px', color: '#222', fontSize: '0.78rem' }}>Немає даних</div>
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {items.map((item, i) => (
                  <div key={i} style={{ background: '#0d0d0d', padding: '12px 16px', borderRadius: '9px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '0.85rem' }}>{item.name}</div>
                      {item.op && (
                        <div style={{ fontSize: '0.65rem', color: '#6b7280', marginTop: '3px', fontWeight: 700 }}>
                          {item.op}
                        </div>
                      )}
                      {detailTab === 'scrap' && (
                        <button
                          onClick={() => handleArchiveStageScrap(detailStage, item.nomId)}
                          disabled={isProcessing}
                          style={{ marginTop: '5px', background: '#ef444415', border: '1px solid #ef444430', color: '#ef4444', fontSize: '0.55rem', fontWeight: 900, padding: '3px 8px', borderRadius: '5px', cursor: 'pointer', textTransform: 'uppercase' }}>
                          {isProcessing ? 'Збереження...' : 'Здати на склад'}
                        </button>
                      )}
                    </div>
                    <div style={{ fontWeight: 1000, fontSize: '1.05rem', color: detailTab === 'work' ? '#3b82f6' : detailTab === 'buffer' ? '#f59e0b' : '#ef4444' }}>
                      {item.qty} <small style={{ opacity: 0.3, fontSize: '0.5rem' }}>шт</small>
                    </div>
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
