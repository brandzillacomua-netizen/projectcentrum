import React, { useState } from 'react'
import { Package, X } from 'lucide-react'

export const PackagingPackerModal = ({
  packersList,
  onClose,
  onConfirmComplete
}) => {
  const [selectedPackerId, setSelectedPackerId] = useState('')

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.85)',
      backdropFilter: 'blur(16px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2000,
      padding: '20px'
    }}>
      <div className="packaging-modal-window" style={{
        background: 'var(--card-bg, #ffffff)',
        border: '1px solid var(--border-color, #e2e8f0)',
        borderRadius: '28px',
        width: '100%',
        maxWidth: '460px',
        padding: '32px',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
        boxShadow: 'var(--shadow, 0 30px 80px rgba(0,0,0,0.15))'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '46px', height: '46px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, #a855f7, #ec4899)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 8px 20px rgba(168,85,247,0.4)'
            }}>
              <Package size={22} color="#fff" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 950, color: 'var(--text, #0f172a)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Хто запакував?
              </h3>
              <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: 'var(--text-muted, #64748b)' }}>
                Оберіть співробітника для закриття наряду
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#888', cursor: 'pointer', padding: '8px', display: 'flex' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Packer selector */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <label style={{ fontSize: '0.68rem', fontWeight: 900, color: '#a855f7', textTransform: 'uppercase', letterSpacing: '1px' }}>Пакувальник</label>
          <div style={{ position: 'relative' }}>
            <select
              className="packer-select"
              value={selectedPackerId}
              onChange={e => setSelectedPackerId(e.target.value)}
              style={{
                width: '100%',
                padding: '14px 16px',
                background: 'rgba(168,85,247,0.08)',
                border: '1.5px solid rgba(168,85,247,0.3)',
                borderRadius: '14px',
                color: '#fff',
                fontSize: '0.95rem',
                fontWeight: 700,
                outline: 'none',
                cursor: 'pointer',
                appearance: 'none',
                boxSizing: 'border-box'
              }}
            >
              <option value="" disabled style={{ background: '#0d0617', color: '#888' }}>-- Оберіть пакувальника --</option>
              {packersList.map(u => (
                <option key={u.id} value={u.id} style={{ background: '#0d0617', color: '#fff' }}>
                  {u.first_name || u.last_name ? `${u.first_name || ''} ${u.last_name || ''}`.trim() : u.login}
                </option>
              ))}
            </select>
            <div style={{
              position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)',
              pointerEvents: 'none', color: '#a855f7'
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </div>
          </div>
          {packersList.length === 0 && (
            <p style={{ margin: 0, fontSize: '0.78rem', color: '#f43f5e', fontWeight: 600 }}>
              ⚠️ Немає пакувальників у системі
            </p>
          )}
        </div>

        {/* Confirm button */}
        <button
          disabled={!selectedPackerId}
          onClick={() => {
            const packer = packersList.find(u => String(u.id) === String(selectedPackerId))
            if (packer) onConfirmComplete(packer)
          }}
          style={{
            padding: '15px',
            background: selectedPackerId
              ? 'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)'
              : 'rgba(255,255,255,0.05)',
            border: 'none',
            borderRadius: '14px',
            color: selectedPackerId ? '#fff' : '#444',
            fontSize: '0.9rem',
            fontWeight: 900,
            cursor: selectedPackerId ? 'pointer' : 'not-allowed',
            textTransform: 'uppercase',
            letterSpacing: '1px',
            transition: 'all 0.3s',
            boxShadow: selectedPackerId ? '0 8px 24px rgba(168,85,247,0.4)' : 'none'
          }}
          onMouseEnter={e => { if (selectedPackerId) e.currentTarget.style.transform = 'translateY(-2px)' }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'none' }}
        >
          ✓ Підтвердити та завершити пакування
        </button>
      </div>
    </div>
  )
}
