import React from 'react'
import { Truck } from 'lucide-react'
import { supabase } from '../../../supabase'

export const WarehouseReceptionPanel = ({
  showReception,
  pendingDocs,
  nomenclatures,
  processingDocs,
  setProcessingDocs,
  confirmReception,
  refreshTable
}) => {
  if (!showReception) return null

  return (
    <div className="content-card glass-panel" style={{ background: '#111', border: '1px solid #333', borderRadius: '24px', padding: '25px', marginBottom: '30px' }}>
      <h3 style={{ fontSize: '0.85rem', color: '#0ea5e9', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <Truck size={18} /> ОЧІКУЮТЬ ПРИЙОМКИ НА СО
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        {pendingDocs.map(doc => (
          <div key={doc.id} style={{ padding: '15px 20px', background: '#000', borderRadius: '18px', border: '1px solid #1a1a1a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.65rem', color: '#0ea5e9', fontWeight: 900, textTransform: 'uppercase', marginBottom: '10px', letterSpacing: '0.05em' }}>
                ДОКУМЕНТ #{String(doc.id).substring(0, 8)}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {(Array.isArray(doc.items) ? doc.items : []).map((it, idx) => {
                  const nom = (nomenclatures || []).find(n => n.id === it.nomenclature_id)
                  const itemName = nom
                    ? (nom.name + (nom.material_type ? ` (${nom.material_type})` : ''))
                    : (it.reqDetails || it.details || it.name || `Позиція ${idx + 1}`)
                  const itemQty = it.qty ?? it.missingAmount ?? it.needed ?? it.quantity ?? '?'
                  return (
                    <div key={idx} style={{ background: '#0a0a0a', padding: '5px 10px', borderRadius: '8px', border: '1px solid #222', display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.72rem', color: '#888', fontWeight: 700 }}>
                        {itemName}
                      </span>
                      <strong style={{ fontSize: '0.85rem', color: '#fff' }}>{itemQty}</strong>
                    </div>
                  )
                })}
              </div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={async () => {
                    if (window.confirm('Перенаправити прийомку на Склад Виробництва (СВ)?')) {
                      const { error } = await supabase.from('reception_docs').update({ target_warehouse: 'production' }).eq('id', doc.id)
                      if (!error && typeof refreshTable === 'function') refreshTable('reception_docs')
                    }
                  }}
                  style={{ background: 'rgba(255, 144, 0, 0.05)', border: '1px solid rgba(255, 144, 0, 0.3)', color: '#ff9000', padding: '4px 10px', borderRadius: '6px', fontSize: '0.65rem', fontWeight: 800, cursor: 'pointer', transition: '0.2s' }}
                >
                  Перенаправити на СВ
                </button>
              </div>
            </div>
            <button
              disabled={processingDocs.has(doc.id)}
              onClick={async () => {
                setProcessingDocs(prev => new Set(prev).add(doc.id))
                try {
                  await confirmReception(doc.id)
                } finally {
                  setProcessingDocs(prev => {
                    const next = new Set(prev)
                    next.delete(doc.id)
                    return next
                  })
                }
              }}
              style={{ marginLeft: '15px', background: '#10b981', color: '#000', border: 'none', padding: '10px 20px', borderRadius: '10px', fontWeight: 1000, cursor: processingDocs.has(doc.id) ? 'not-allowed' : 'pointer', fontSize: '0.8rem', opacity: processingDocs.has(doc.id) ? 0.5 : 1 }}
            >
              {processingDocs.has(doc.id) ? 'ОБРОБКА...' : 'ПРИЙНЯТИ'}
            </button>
          </div>
        ))}
        {pendingDocs.length === 0 && (
          <p style={{ color: '#333', fontSize: '0.8rem', textAlign: 'center' }}>Немає активних документів на прийомку</p>
        )}
      </div>
    </div>
  )
}
