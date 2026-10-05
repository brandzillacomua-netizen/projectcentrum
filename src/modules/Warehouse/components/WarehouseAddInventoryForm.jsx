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
      style={{ display: 'flex', gap: '10px', padding: '15px', background: 'var(--surface-1)', borderRadius: '15px', marginBottom: '20px', alignItems: 'center', flexWrap: 'wrap' }}
    >
      <input
        style={{ flex: 2, minWidth: '200px', background: 'var(--surface-black)', border: '1px solid var(--border-subtle)', color: 'var(--text-strong)', padding: '10px', borderRadius: '8px' }}
        placeholder="Назва товару..." value={newItem.name}
        onChange={e => setNewItem({ ...newItem, name: e.target.value })} required
      />
      <input
        style={{ flex: 1, minWidth: '100px', background: 'var(--surface-black)', border: '1px solid var(--border-subtle)', color: 'var(--text-strong)', padding: '10px', borderRadius: '8px' }}
        type="number" placeholder="Кількість" value={newItem.total_qty}
        onChange={e => setNewItem({ ...newItem, total_qty: e.target.value })} required
      />
      <button type="submit" style={{ background: '#ff9000', color: '#000', border: 'none', padding: '10px 30px', borderRadius: '8px', fontWeight: 900, cursor: 'pointer' }}>
        ДОДАТИ
      </button>
    </form>
  )
}
