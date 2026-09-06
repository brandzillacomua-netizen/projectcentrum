import React from 'react'
import { Tablet, Menu, Package } from 'lucide-react'

export function Shop2Header({
  currentTime,
  queuedCardsCount,
  onOpenDrawer,
  onOpenStorageExplorer,
  onOpenAdminCardModal,
  isAdmin
}) {
  return (
    <header className="terminal-nav" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 20px', height: '70px', background: '#000', borderBottom: '2px solid #8b5cf6', flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
        <button onClick={onOpenDrawer} className="burger-btn-labeled mobile-only">
          <Menu size={20} />
          <span>Черга</span>
          {queuedCardsCount > 0 && (
            <span className="queue-badge" style={{
              background: '#ef4444',
              color: '#fff',
              borderRadius: '50%',
              fontSize: '10px',
              fontWeight: 900,
              width: '18px',
              height: '18px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: 1
            }}>
              {queuedCardsCount}
            </span>
          )}
        </button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <Tablet size={20} color="#8b5cf6" />
        <h1 style={{ fontSize: '1rem', fontWeight: 800, margin: 0 }} className="hide-mobile">ТЕРМІНАЛ ЦЕХУ №2 (ОПЕРАТОР)</h1>

        <button
          onClick={onOpenStorageExplorer}
          style={{
            background: '#8b5cf620', color: '#8b5cf6', border: '1px solid #8b5cf644',
            padding: '6px 12px', borderRadius: '10px', fontSize: '0.65rem',
            fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
            marginLeft: '15px'
          }}
        >
          <Package size={14} /> БУФЕР
        </button>
        {isAdmin && (
          <button
            onClick={onOpenAdminCardModal}
            style={{
              background: 'rgba(139, 92, 246, 0.1)', color: '#a78bfa', border: '1px solid rgba(139, 92, 246, 0.4)',
              padding: '6px 12px', borderRadius: '10px', fontSize: '0.65rem',
              fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
              marginLeft: '10px'
            }}
          >
            + РУЧНА КАРТКА
          </button>
        )}
      </div>
      <div style={{ fontWeight: 900, fontFamily: 'monospace', fontSize: '1.2rem', color: '#8b5cf6' }}>
        {currentTime.toLocaleTimeString()}
      </div>
    </header>
  )
}
