import React from 'react'
import { Pencil, Check, X } from 'lucide-react'
import { useStore } from '../../../store/index.js'
import { WarehouseNomenclatureLink } from './WarehouseNomenclatureLink'

export function WarehouseInventoryList({
  filteredInventory,
  editingInvId,
  setEditingInvId,
  editingInvTotal,
  setEditingInvTotal,
  editingInvReserved,
  setEditingInvReserved,
  handleSaveInventoryQty,
  savingInv
}) {
  const currentUser = useStore(state => state.currentUser)
  const isSuperAdmin = currentUser?.login === 'admin@workshop.local' || currentUser?.position === 'Адмін'

  return (
    <div style={{ background: 'var(--surface-1)', borderRadius: '16px', border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
        <thead>
          <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border-subtle)' }}>
            <th style={{ padding: '12px 16px' }}>Найменування</th>
            <th style={{ padding: '12px 16px', textAlign: 'center' }}>Всього</th>
            <th style={{ padding: '12px 16px', textAlign: 'center' }}>Резерв</th>
            <th style={{ padding: '12px 16px', textAlign: 'center' }}>Доступно</th>
            {isSuperAdmin && <th style={{ padding: '12px 16px', width: '80px' }}>Дії</th>}
          </tr>
        </thead>
        <tbody>
          {filteredInventory.map(item => {
            const isEditing = editingInvId === item.id
            const available = Math.max(0, (Number(item.total_qty) || 0) - (Number(item.reserved_qty) || 0))

            return (
              <tr key={item.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <td style={{ padding: '12px 16px' }}>
                  <strong><WarehouseNomenclatureLink item={item} /></strong>
                </td>
                <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                  {isEditing ? (
                    <input 
                      type="number"
                      value={editingInvTotal}
                      onChange={e => setEditingInvTotal(e.target.value)}
                      style={{ width: '70px', background: 'var(--surface-black)', border: '1px solid var(--border-subtle)', color: 'var(--text-strong)', textAlign: 'center', padding: '4px', borderRadius: '4px' }}
                    />
                  ) : (
                    <span>{item.total_qty} {item.unit}</span>
                  )}
                </td>
                <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                  {isEditing ? (
                    <input 
                      type="number"
                      value={editingInvReserved}
                      onChange={e => setEditingInvReserved(e.target.value)}
                      style={{ width: '70px', background: 'var(--surface-black)', border: '1px solid var(--border-subtle)', color: 'var(--text-strong)', textAlign: 'center', padding: '4px', borderRadius: '4px' }}
                    />
                  ) : (
                    <span>{item.reserved_qty || 0} {item.unit}</span>
                  )}
                </td>
                <td style={{ padding: '12px 16px', textAlign: 'center', color: available > 0 ? '#10b981' : '#ef4444', fontWeight: 800 }}>
                  {available} {item.unit}
                </td>
                {isSuperAdmin && (
                  <td style={{ padding: '12px 16px' }}>
                    {isEditing ? (
                      <div style={{ display: 'flex', gap: '5px' }}>
                        <button onClick={() => handleSaveInventoryQty(item.id)} disabled={savingInv} style={{ background: '#10b981', border: 'none', color: 'var(--surface-black)', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer' }}><Check size={14} /></button>
                        <button onClick={() => setEditingInvId(null)} style={{ background: 'var(--border-subtle)', border: 'none', color: 'var(--text-strong)', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer' }}><X size={14} /></button>
                      </div>
                    ) : (
                      <button 
                        onClick={() => {
                          setEditingInvId(item.id)
                          setEditingInvTotal(item.total_qty || '0')
                          setEditingInvReserved(item.reserved_qty || '0')
                        }}
                        style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer' }}
                      >
                        <Pencil size={14} />
                      </button>
                    )}
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
