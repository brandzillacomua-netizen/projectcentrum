import React from 'react'
import { Truck } from 'lucide-react'
import { useMES } from '../../../MESContext'
import { useStore } from '../../../store/index.js'

export function WarehouseReceptionsList({
  pendingDocs,
  processingDocs,
  confirmReception
}) {
  const { refreshTable, supabase } = useMES()
  const nomenclatures = useStore(state => state.nomenclatures)

  if (pendingDocs.length === 0) {
    return (
      <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem', textAlign: 'center', padding: '20px' }}>
        Немає активних документів на прийомку
      </p>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {pendingDocs.map(doc => (
        <div key={doc.id} style={{ padding: '15px 20px', background: 'var(--surface-black)', borderRadius: '18px', border: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.65rem', color: '#0ea5e9', fontWeight: 900, textTransform: 'uppercase', marginBottom: '10px' }}>
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
                  <div key={idx} style={{ background: 'var(--surface-inset)', padding: '5px 10px', borderRadius: '8px', border: '1px solid var(--border-subtle)', display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {itemName}
                    </span>
                    <strong style={{ fontSize: '0.85rem', color: 'var(--text-strong)' }}>{itemQty}</strong>
                  </div>
                )
              })}
            </div>
          </div>
          <button
            disabled={processingDocs.has(doc.id)}
            onClick={async () => {
              try {
                await confirmReception(doc.id)
              } catch (e) {
                alert('Помилка: ' + e.message)
              }
            }}
            style={{ marginLeft: '15px', background: '#10b981', color: '#000', border: 'none', padding: '10px 20px', borderRadius: '10px', fontWeight: 900, cursor: 'pointer' }}
          >
            ПРИЙНЯТИ
          </button>
        </div>
      ))}
    </div>
  )
}
