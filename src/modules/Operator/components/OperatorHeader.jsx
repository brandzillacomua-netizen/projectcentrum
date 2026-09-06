import React from 'react'
import { ArrowLeft, Tablet, Menu } from 'lucide-react'
import { Link } from 'react-router-dom'

export const OperatorHeader = ({ currentTime, setIsDrawerOpen }) => {
  return (
    <header className="terminal-nav" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 20px', height: '70px', background: '#000', borderBottom: '2px solid #eab308', flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
        <Link to="/" style={{ color: '#94a3b8', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '0.85rem' }}>
          <ArrowLeft size={18} /> <span className="hide-mobile">Вихід</span>
        </Link>
        <button onClick={() => setIsDrawerOpen(true)} className="burger-btn-labeled mobile-only">
          <Menu size={20} />
          <span>Черга</span>
        </button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <Tablet size={20} color="#eab308" />
        <h1 style={{ fontSize: '1rem', fontWeight: 800, margin: 0 }} className="hide-mobile">ТЕРМІНАЛ ЦЕХУ (МАЙСТЕР)</h1>
      </div>
      <div style={{ fontWeight: 900, fontFamily: 'monospace', fontSize: '1.2rem', color: '#eab308' }}>
        {currentTime.toLocaleTimeString()}
      </div>
    </header>
  )
}
