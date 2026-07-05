import React from 'react'
import { Package } from 'lucide-react'

export const RegistryView = ({
  receptionDocs,
  nomenclatures,
  expandedDoc,
  setExpandedDoc
}) => {
  const list = (receptionDocs || [])
    .filter(d => 
      d.target_warehouse === 'operational' || 
      d.source_warehouse === 'operational' || 
      d.target_warehouse === 'pocket' || 
      d.source_warehouse === 'pocket'
    )

  if (list.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '60px', color: '#333', fontSize: '0.85rem' }}>Історія порожня</div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
      {list.map(doc => (
        <div key={doc.id} style={{ background: '#111', borderRadius: '20px', border: '1px solid #222', overflow: 'hidden' }}>
          <div 
            onClick={() => setExpandedDoc(expandedDoc === doc.id ? null : doc.id)}
            style={{ padding: '20px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
              <div style={{ background: '#0a0a0a', padding: '12px', borderRadius: '12px', color: doc.status === 'completed' ? '#10b981' : '#ff9000' }}>
                <Package size={20} />
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>#{String(doc.id).substring(0, 8)}</div>
                <div style={{ fontSize: '0.65rem', color: '#444' }}>{new Date(doc.created_at).toLocaleDateString()}</div>
              </div>
            </div>
            <div style={{ 
              fontSize: '0.6rem', fontWeight: 900, textTransform: 'uppercase', 
              padding: '5px 12px', borderRadius: '20px', 
              background: doc.status === 'completed' ? '#10b98122' : '#ff900022',
              color: doc.status === 'completed' ? '#10b981' : '#ff9000'
            }}>
              {doc.status === 'completed' ? 'ВИКОНАНО' : 'В ДОРОЗІ'}
            </div>
          </div>
          
          {expandedDoc === doc.id && (
            <div style={{ padding: '20px', background: '#0a0a0a', borderTop: '1px solid #222' }}>
              <div style={{ marginBottom: '15px' }}>
                {(Array.isArray(doc.items) ? doc.items : []).map((it, idx) => {
                  const nom = (nomenclatures || []).find(n => n.id === it.nomenclature_id)
                  const itemName = nom ? (nom.name + (nom.material_type ? ` (${nom.material_type})` : '')) : (it.reqDetails || it.details || it.name || `Позиція ${idx + 1}`)
                  const itemQty = it.qty ?? it.missingAmount ?? it.needed ?? it.quantity ?? '?'
                  return (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #111' }}>
                      <span style={{ fontSize: '0.8rem', color: '#888' }}>{itemName}</span>
                      <strong style={{ fontSize: '0.8rem', color: '#fff' }}>{itemQty}</strong>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
