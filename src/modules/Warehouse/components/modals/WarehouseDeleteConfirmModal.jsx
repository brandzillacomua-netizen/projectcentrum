import React from 'react'
import { AlertTriangle } from 'lucide-react'

export const WarehouseDeleteConfirmModal = ({
  itemToDelete,
  setItemToDelete,
  isDeleting,
  confirmDeleteInventoryItem
}) => {
  if (!itemToDelete) return null

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.82)',
      backdropFilter: 'blur(10px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
      padding: '20px'
    }}>
      <div style={{
        background: '#111',
        border: '1px solid rgba(239, 68, 68, 0.4)',
        borderRadius: '24px',
        padding: '28px',
        maxWidth: '460px',
        width: '100%',
        boxShadow: '0 25px 60px rgba(0,0,0,0.9), 0 0 35px rgba(239,68,68,0.2)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px' }}>
          <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '12px', borderRadius: '16px', color: '#ef4444', display: 'flex' }}>
            <AlertTriangle size={26} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 900, color: '#fff' }}>
              ПІДТВЕРДЖЕННЯ ВИДАЛЕННЯ
            </h3>
            <span style={{ fontSize: '0.68rem', color: '#ef4444', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Дія незворотна
            </span>
          </div>
        </div>

        <div style={{ background: '#080808', border: '1px solid #222', borderRadius: '16px', padding: '16px', marginBottom: '24px' }}>
          <p style={{ margin: '0 0 8px 0', fontSize: '0.82rem', color: '#888' }}>
            Ви дійсно бажаєте безповоротно видалити позицію зі склада?
          </p>
          <div style={{ fontSize: '0.95rem', fontWeight: 900, color: '#fff', wordBreak: 'break-word', lineHeight: '1.4' }}>
            {itemToDelete.name}
          </div>
          <div style={{ display: 'flex', gap: '15px', marginTop: '12px', fontSize: '0.78rem', color: '#555' }}>
            <span>Наявність: <strong style={{ color: '#ff9000' }}>{itemToDelete.total_qty || 0} {itemToDelete.unit || 'шт'}</strong></span>
            <span>ID: <code style={{ color: '#444' }}>{String(itemToDelete.id).substring(0, 8)}</code></span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button
            type="button"
            disabled={isDeleting}
            onClick={() => setItemToDelete(null)}
            style={{
              background: '#1a1a1a',
              color: '#ccc',
              border: '1px solid #333',
              padding: '12px 22px',
              borderRadius: '12px',
              fontWeight: 800,
              fontSize: '0.82rem',
              cursor: 'pointer'
            }}
          >
            Скасувати
          </button>
          <button
            type="button"
            disabled={isDeleting}
            onClick={confirmDeleteInventoryItem}
            style={{
              background: 'linear-gradient(135deg, #ef4444, #dc2626)',
              color: '#fff',
              border: 'none',
              padding: '12px 24px',
              borderRadius: '12px',
              fontWeight: 900,
              fontSize: '0.82rem',
              cursor: isDeleting ? 'wait' : 'pointer',
              boxShadow: '0 4px 15px rgba(239, 68, 68, 0.4)',
              opacity: isDeleting ? 0.6 : 1
            }}
          >
            {isDeleting ? 'Видалення...' : 'Видалити остаточно'}
          </button>
        </div>
      </div>
    </div>
  )
}
