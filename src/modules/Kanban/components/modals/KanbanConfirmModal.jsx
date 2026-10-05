import React from 'react'

export const KanbanConfirmModal = ({ confirmModal, setConfirmModal }) => {
  if (!confirmModal) return null

  return (
    <div className="modal-overlay" style={{ zIndex: 10050 }} onClick={() => setConfirmModal(null)}>
      <div className="modal-box" style={{ maxWidth: '400px', padding: '30px', textAlign: 'center', background: 'var(--surface-1)', border: '1px solid var(--border-subtle)', borderRadius: '24px', boxShadow: '0 20px 50px rgba(0,0,0,0.6)' }} onClick={e => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 15px 0', fontSize: '1.1rem', color: 'var(--text-strong)', fontWeight: 900, letterSpacing: '0.5px' }}>Підтвердження дії</h3>
        <p style={{ margin: '0 0 25px 0', fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>{confirmModal.message}</p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          <button
            type="button"
            onClick={() => setConfirmModal(null)}
            style={{ background: 'var(--fill-subtle)', border: '1px solid var(--border-subtle)', color: 'var(--text-strong)', padding: '10px 20px', borderRadius: '10px', fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer' }}
          >
            Скасувати
          </button>
          <button
            type="button"
            onClick={() => {
              confirmModal.onConfirm()
              setConfirmModal(null)
            }}
            style={{ background: '#ff9000', border: 'none', color: 'var(--surface-black)', padding: '10px 24px', borderRadius: '10px', fontSize: '0.8rem', fontWeight: 900, cursor: 'pointer' }}
          >
            Підтвердити
          </button>
        </div>
      </div>
    </div>
  )
}
