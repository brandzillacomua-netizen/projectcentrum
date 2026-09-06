import React from 'react'

export const WarehouseAddInventoryForm = ({
  showAdd,
  activeTab,
  newItem,
  setNewItem,
  managers,
  handleAddInventory
}) => {
  if (!showAdd) return null

  return (
    <form
      onSubmit={handleAddInventory}
      className="stack-mobile"
      style={{ display: 'flex', gap: '10px', padding: '15px', background: '#111', borderRadius: '15px', marginBottom: '20px', alignItems: 'center', flexWrap: 'wrap' }}
    >
      <input
        style={{ flex: 2, minWidth: '200px', background: '#000', border: '1px solid #333', color: '#fff', padding: '10px', borderRadius: '8px' }}
        placeholder="Назва товару..." value={newItem.name}
        onChange={e => setNewItem({ ...newItem, name: e.target.value })} required
      />
      <input
        style={{ flex: 1, minWidth: '100px', background: '#000', border: '1px solid #333', color: '#fff', padding: '10px', borderRadius: '8px' }}
        type="number" placeholder="Кількість" value={newItem.total_qty}
        onChange={e => setNewItem({ ...newItem, total_qty: e.target.value })} required
      />
      {activeTab === 'pocket' && (
        <select
          value={newItem.pocket_owner || ''}
          onChange={e => setNewItem({ ...newItem, pocket_owner: e.target.value })}
          style={{ flex: 1, minWidth: '150px', background: '#000', border: '1px solid #333', color: '#fff', padding: '10px', borderRadius: '8px' }}
          required
        >
          <option value="">-- Оберіть майстра --</option>
          {(managers || []).filter(m => m.toLowerCase().includes('майстер')).map((m, idx) => (
            <option key={idx} value={m}>{m}</option>
          ))}
        </select>
      )}
      <button type="submit" style={{ background: '#ff9000', color: '#000', border: 'none', padding: '10px 30px', borderRadius: '8px', fontWeight: 900, cursor: 'pointer' }}>
        ДОДАТИ
      </button>
    </form>
  )
}
