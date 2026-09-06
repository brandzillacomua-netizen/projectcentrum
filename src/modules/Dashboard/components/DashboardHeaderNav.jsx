import React from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, LayoutDashboard } from 'lucide-react'

export const DashboardHeaderNav = ({
  currentUser,
  selectedOrderId,
  selectedOrderNum
}) => {
  return (
    <nav className="module-nav" style={{
      flexShrink: 0,
      padding: '0 24px',
      height: '70px',
      background: 'var(--bg, #09090b)',
      borderBottom: '1px solid var(--glass-border, #27272a)',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        <Link to="/" style={{ color: 'var(--text-muted, #a1a1aa)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', transition: 'color 0.2s' }}>
          <ArrowLeft size={18} /> <span className="hide-mobile">На головну</span>
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <LayoutDashboard className="text-secondary" size={24} color="#ff9000" />
          <h1 style={{ fontSize: '1rem', fontWeight: 900, textTransform: 'uppercase', margin: 0, letterSpacing: '0.5px' }}>
            Дашборд Виробництва (WIP){selectedOrderId ? ` — НАРЯД №${selectedOrderNum}` : ''}
          </h1>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
        <div style={{ textAlign: 'right', lineHeight: 1.2 }} className="hide-mobile">
          <div style={{ fontSize: '0.85rem', fontWeight: 900, color: 'var(--text, #f4f4f5)' }}>{currentUser?.first_name} {currentUser?.last_name}</div>
          <div style={{ fontSize: '0.65rem', color: '#ff9000', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{currentUser?.position}</div>
        </div>
      </div>
    </nav>
  )
}
