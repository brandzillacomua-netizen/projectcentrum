import React from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Menu, History, ClipboardCheck } from 'lucide-react'

export function MasterHeader({
  setDrawerType,
  setIsDrawerOpen,
  pendingOrdersCount = 0,
  theme = 'dark'
}) {
  const isLight = theme === 'light'

  return (
    <nav className="module-nav no-print" style={{ 
      flexShrink: 0, 
      padding: '0 20px', 
      height: '70px', 
      display: 'flex', 
      justify: 'space-between', 
      alignItems: 'center', 
      background: isLight ? '#ffffff' : '#000000', 
      borderBottom: isLight ? '1px solid #e2e8f0' : '1px solid #222222' 
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
        <Link to="/" className="back-link" style={{ color: isLight ? '#64748b' : '#555555', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
          <ArrowLeft size={18} /> <span className="hide-mobile">Назад</span>
        </Link>
        <span className="mobile-nav-buttons" style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => {
              setDrawerType('queue');
              setIsDrawerOpen(true);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: isLight ? '#ffedd5' : 'rgba(255, 144, 0, 0.1)',
              border: isLight ? '1px solid #fed7aa' : '1px solid rgba(255, 144, 0, 0.2)',
              color: isLight ? '#ea580c' : '#ff9000',
              padding: '8px 12px',
              borderRadius: '10px',
              fontSize: '0.8rem',
              fontWeight: 900,
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <Menu size={16} />
            <span>Черга</span>
            {pendingOrdersCount > 0 && (
              <span
                style={{
                  background: '#ef4444',
                  color: '#fff',
                  borderRadius: '50%',
                  minWidth: '18px',
                  height: '18px',
                  fontSize: '0.65rem',
                  fontWeight: 950,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 4px',
                  marginLeft: '2px'
                }}
              >
                {pendingOrdersCount}
              </span>
            )}
          </button>
          <button
            onClick={() => {
              setDrawerType('archive');
              setIsDrawerOpen(true);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: isLight ? '#dcfce7' : 'rgba(16, 185, 129, 0.1)',
              border: isLight ? '1px solid #bbf7d0' : '1px solid rgba(16, 185, 129, 0.2)',
              color: isLight ? '#15803d' : '#10b981',
              padding: '8px 12px',
              borderRadius: '10px',
              fontSize: '0.8rem',
              fontWeight: 900,
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <History size={16} />
            <span>Архів</span>
          </button>
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <ClipboardCheck className="text-accent" size={24} color={isLight ? '#ea580c' : '#ff9000'} />
        <h1 style={{ fontSize: '1rem', fontWeight: 900, textTransform: 'uppercase', margin: 0, color: isLight ? '#0f172a' : '#ffffff' }} className="hide-mobile">Керування виробництвом</h1>
      </div>
      <div className="hide-mobile" style={{ fontSize: '0.8rem', color: isLight ? '#64748b' : '#444444', fontWeight: 700 }}>СИСТЕМА MES v2.1</div>
    </nav>
  )
}
