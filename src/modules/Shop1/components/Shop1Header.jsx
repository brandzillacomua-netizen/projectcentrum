import React from 'react'
import { ArrowLeft, Menu } from 'lucide-react'
import { Link } from 'react-router-dom'

export function Shop1Header({ currentTime, queueCardsCount = 0, onOpenDrawer }) {
  return (
    <header className="terminal-nav" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 20px', height: '70px', background: '#000', borderBottom: '2px solid #eab308', flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
        <Link to="/" style={{ color: '#94a3b8', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '0.85rem' }}>
          <ArrowLeft size={18} /> <span className="hide-mobile">Вихід</span>
        </Link>
        <button onClick={onOpenDrawer} className="burger-btn-labeled mobile-only">
          <Menu size={20} />
          <span>ЧЕРГА</span>
          {queueCardsCount > 0 && (
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
              {queueCardsCount}
            </span>
          )}
        </button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#eab308', boxShadow: '0 0 8px #eab308' }} />
        <span style={{ fontSize: '1rem', fontWeight: 800, margin: 0 }} className="hide-mobile">ЦЕХ №1: ТЕРМІНАЛ</span>
      </div>
      <div style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: '1.2rem', color: '#eab308', textAlign: 'right' }}>
        {currentTime ? `${currentTime.toLocaleDateString('uk-UA')} ${currentTime.toLocaleTimeString()}` : ''}
      </div>
    </header>
  )
}
