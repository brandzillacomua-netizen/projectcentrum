import React from 'react'
import { AlertTriangle } from 'lucide-react'

export const SupplyDeleteItemModal = ({
  itemToDelete,
  setItemToDelete,
  isDeleting,
  confirmDeleteInventoryItem
}) => {
  if (!itemToDelete) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.75)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '20px'
      }}
      onClick={() => !isDeleting && setItemToDelete(null)}
    >
      <div
        style={{
          background: 'var(--modal-bg, #121212)',
          border: '1px solid var(--modal-border, #282828)',
          borderRadius: '24px',
          padding: '28px',
          maxWidth: '460px',
          width: '100%',
          boxShadow: '0 20px 50px rgba(0,0,0,0.8)',
          position: 'relative'
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px' }}>
          <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '12px', borderRadius: '16px', color: '#ef4444', display: 'flex' }}>
            <AlertTriangle size={26} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 900, color: 'var(--text-color, #fff)' }}>
              ПІДТВЕРДЖЕННЯ ВИДАЛЕННЯ
            </h3>
            <span style={{ fontSize: '0.68rem', color: '#ef4444', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Дія незворотна
            </span>
          </div>
        </div>

        <div style={{ background: 'var(--card-inner-bg, #080808)', border: '1px solid var(--border-color, #222)', borderRadius: '16px', padding: '16px', marginBottom: '24px' }}>
          <p style={{ margin: '0 0 8px 0', fontSize: '0.82rem', color: 'var(--text-muted, #888)' }}>
            Ви дійсно бажаєте безповоротно видалити позицію зі склада?
          </p>
          <div style={{ fontSize: '0.95rem', fontWeight: 900, color: 'var(--text-color, #fff)', wordBreak: 'break-word', lineHeight: '1.4' }}>
            {itemToDelete.name}
          </div>
          <div style={{ display: 'flex', gap: '15px', marginTop: '12px', fontSize: '0.78rem', color: 'var(--text-muted, #555)' }}>
            <span>Наявність: <strong style={{ color: '#ff9000' }}>{itemToDelete.total_qty || 0} {itemToDelete.unit || 'шт'}</strong></span>
            <span>ID: <code style={{ color: 'var(--text-muted, #444)' }}>{String(itemToDelete.id).substring(0, 8)}</code></span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button
            type="button"
            disabled={isDeleting}
            onClick={() => setItemToDelete(null)}
            style={{
              background: 'var(--btn-ghost-bg, #1a1a1a)',
              color: 'var(--text-muted, #ccc)',
              border: '1px solid var(--border-color, #333)',
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
