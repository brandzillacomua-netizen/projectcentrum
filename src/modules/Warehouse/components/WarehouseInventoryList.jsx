import React from 'react'
import { Pencil, Check, X } from 'lucide-react'
import { useMES } from '../../../MESContext'

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
  const { currentUser } = useMES()
  const isSuperAdmin = currentUser?.login === 'admin@workshop.local' || currentUser?.position === 'Адмін'

  return (
    <div style={{ background: '#111', borderRadius: '16px', border: '1px solid #222', overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
        <thead>
          <tr style={{ background: '#181818', borderBottom: '1px solid #222' }}>
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
              <tr key={item.id} style={{ borderBottom: '1px solid #222' }}>
                <td style={{ padding: '12px 16px' }}>
                  <strong>{item.name}</strong>
                </td>
                <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                  {isEditing ? (
                    <input 
                      type="number"
                      value={editingInvTotal}
                      onChange={e => setEditingInvTotal(e.target.value)}
                      style={{ width: '70px', background: '#000', border: '1px solid #333', color: '#fff', textAlign: 'center', padding: '4px', borderRadius: '4px' }}
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
                      style={{ width: '70px', background: '#000', border: '1px solid #333', color: '#fff', textAlign: 'center', padding: '4px', borderRadius: '4px' }}
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
                        <button onClick={() => handleSaveInventoryQty(item.id)} disabled={savingInv} style={{ background: '#10b981', border: 'none', color: '#000', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer' }}><Check size={14} /></button>
                        <button onClick={() => setEditingInvId(null)} style={{ background: '#333', border: 'none', color: '#fff', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer' }}><X size={14} /></button>
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
