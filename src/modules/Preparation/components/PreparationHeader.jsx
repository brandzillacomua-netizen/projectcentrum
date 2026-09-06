import React from 'react'
import { ArrowLeft, Menu, Tablet } from 'lucide-react'
import { Link } from 'react-router-dom'

export const PreparationHeader = ({
  currentTime,
  taskCount,
  onOpenDrawer
}) => {
  return (
    <header className="prep-header">
      <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
        <Link to="/" style={{ color: '#94a3b8', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '0.85rem' }}>
          <ArrowLeft size={18} /> <span className="hide-mobile">Вихід</span>
        </Link>
        <button
          onClick={onOpenDrawer}
          className="burger-btn-labeled mobile-only"
        >
          <Menu size={20} />
          <span>Черга ({taskCount})</span>
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <Tablet size={20} color="#10b981" />
        <h1 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, letterSpacing: '1px' }} className="hide-mobile">
          ТЕРМІНАЛ ПІДГОТОВКИ (ВП)
        </h1>
      </div>

      <div style={{ fontWeight: 900, fontFamily: 'monospace', fontSize: '1.2rem', color: '#10b981' }}>
        {currentTime.toLocaleTimeString()}
      </div>
    </header>
  )
}

export default PreparationHeader
