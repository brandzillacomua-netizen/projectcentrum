import React from 'react'
import { ArrowLeft, AlertTriangle } from 'lucide-react'
import { Link } from 'react-router-dom'

export const BrakHeader = React.memo(({
  showReportPage,
  setShowReportPage,
  currentUser
}) => {
  return (
    <nav style={{ 
      display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
      padding: '0 25px', height: '75px', background: 'var(--header-bg, #000)', borderBottom: '1px solid var(--border-color, #1a1a1a)', flexShrink: 0 
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        {showReportPage ? (
          <button 
            onClick={() => setShowReportPage(false)} 
            style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '0.85rem', padding: 0 }}
          >
            <ArrowLeft size={18} /> <span>Черга ВКЯ</span>
          </button>
        ) : (
          <Link to="/" style={{ color: '#94a3b8', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '0.85rem' }}>
            <ArrowLeft size={18} /> <span>Назад</span>
          </Link>
        )}
        <div style={{ width: '2px', height: '24px', background: 'var(--border-color, #1a1a1a)' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <AlertTriangle color="#ef4444" size={22} />
          <h1 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 900, letterSpacing: '-0.5px', color: 'var(--text-color, #fff)' }}>
            {showReportPage ? 'ВКЯ · Звіти 1С Брак' : 'ВКЯ · Управління Якістю'}
          </h1>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
        <div style={{ textAlign: 'right', lineHeight: 1.2 }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-color, #fff)' }}>{currentUser?.first_name} {currentUser?.last_name}</div>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted, #555)', textTransform: 'uppercase', fontWeight: 900 }}>Інспектор ВКЯ</div>
        </div>
      </div>
    </nav>
  )
})
