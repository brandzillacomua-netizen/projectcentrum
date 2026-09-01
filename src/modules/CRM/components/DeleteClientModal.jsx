import React, { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, Trash2, X } from 'lucide-react'

export const DeleteClientModal = ({ isOpen, clientName, onConfirm, onCancel }) => {
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        if (onCancel) onCancel()
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (onConfirm) onConfirm()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onConfirm, onCancel])

  if (!isOpen) return null

  const modalContent = (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget && onCancel) onCancel()
      }}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 999999,
        background: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        boxSizing: 'border-box'
      }}
    >
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '460px',
          borderRadius: '24px',
          background: 'var(--card-bg, #ffffff)',
          border: '1px solid var(--glass-border, #cbd5e1)',
          padding: '28px',
          boxShadow: '0 25px 60px rgba(0,0,0,0.35)',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          color: 'var(--text, #0f172a)',
          animation: 'modalPop 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          position: 'relative'
        }}
      >
        {/* Header Icon */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{
            width: '52px',
            height: '52px',
            borderRadius: '16px',
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#ef4444',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <AlertTriangle size={28} />
          </div>

          <button
            onClick={onCancel}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted, #64748b)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '8px'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content text */}
        <div>
          <h3 style={{ margin: '0 0 8px', fontSize: '1.25rem', fontWeight: 950, color: 'var(--text, #0f172a)' }}>
            Видалити клієнта з бази?
          </h3>
          <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted, #475569)', lineHeight: 1.5 }}>
            Ви дійсно бажаєте видалити клієнта <strong style={{ color: '#ef4444' }}>"{clientName}"</strong>? Цю дію неможливо скасувати.
          </p>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1,
              padding: '12px 18px',
              borderRadius: '12px',
              border: '1px solid var(--glass-border, #cbd5e1)',
              background: 'rgba(0,0,0,0.04)',
              color: 'var(--text, #0f172a)',
              fontWeight: 850,
              fontSize: '0.88rem',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            Скасувати <small style={{ opacity: 0.5, fontSize: '0.7rem' }}>(Esc)</small>
          </button>

          <button
            onClick={onConfirm}
            autoFocus
            style={{
              flex: 1.4,
              padding: '12px 18px',
              borderRadius: '12px',
              border: 'none',
              background: 'linear-gradient(135deg, #ef4444, #dc2626)',
              color: '#ffffff',
              fontWeight: 950,
              fontSize: '0.88rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 4px 18px rgba(239, 68, 68, 0.4)'
            }}
          >
            <Trash2 size={16} /> Так, Видалити <small style={{ opacity: 0.7, fontSize: '0.7rem' }}>(Enter)</small>
          </button>
        </div>
      </div>
      <style>{`
        @keyframes modalPop {
          from { opacity: 0; transform: scale(0.95) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  )

  return createPortal(modalContent, document.body)
}
