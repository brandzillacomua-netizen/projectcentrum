import React from 'react'
import { ArrowLeft, Truck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { IconSO } from '../../../components/WarehouseIcons.jsx'
import { ManualIssueJournalButton } from '../ManualIssue/ManualInventoryIssueUI.jsx'

export const WarehouseHeaderNav = ({
  currentUser,
  activeTab,
  showReception,
  setShowReception,
  pendingDocsCount,
  manualIssue
}) => {
  return (
    <nav className="module-nav" style={{ 
      flexShrink: 0, 
      padding: window.innerWidth < 768 ? '10px 15px' : '15px 25px', 
      background: '#111', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'space-between', 
      borderBottom: '1px solid #222',
      width: '100%',
      boxSizing: 'border-box'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: window.innerWidth < 768 ? '8px' : '20px', width: '100%', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: window.innerWidth < 768 ? '8px' : '20px' }}>
          <Link to="/" className="back-link" style={{ color: '#555', transition: '0.3s', display: 'flex', alignItems: 'center' }}>
            <ArrowLeft size={18} /> <span className="hide-mobile" style={{ marginLeft: '5px' }}>Назад</span>
          </Link>
          <div className="module-title-group" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <IconSO className="text-secondary" size={20} color="#10b981" />
            <h1 className="hide-mobile" style={{ margin: 0, fontSize: '1.1rem', fontWeight: 950, letterSpacing: '-0.02em' }}>СКЛАД ОПЕРАТИВНИЙ</h1>
            <span className="pillar-badge-erp hide-mobile" style={{ padding: '3px 8px', borderRadius: '12px', fontSize: '0.65rem', fontWeight: 900, textTransform: 'uppercase' }}>
              ERP WMS Pillar
            </span>
            <h1 className="mobile-only" style={{ margin: 0, fontSize: '0.85rem', fontWeight: 950 }}>СКЛАД</h1>
            <button
              type="button"
              onClick={() => {
                const url = new URL(window.location.href)
                url.searchParams.delete('tab')
                url.searchParams.set('tab', activeTab)
                navigator.clipboard.writeText(url.toString())
                alert('Посилання скопійовано!')
              }}
              style={{
                background: 'rgba(255, 144, 0, 0.1)',
                border: '1px solid rgba(255, 144, 0, 0.3)',
                color: '#ff9000',
                padding: '5px 8px',
                borderRadius: '6px',
                fontSize: '0.65rem',
                fontWeight: 900,
                cursor: 'pointer',
                marginLeft: '5px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <span>🔗</span>
              <span className="hide-mobile">Копіювати посилання</span>
              <span className="mobile-only">ЛІНК</span>
            </button>
          </div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={() => setShowReception(!showReception)}
            className="warehouse-nav-btn reception-btn"
            style={{
              height: '42px',
              padding: window.innerWidth < 768 ? '0 12px' : '0 16px',
              borderRadius: '12px',
              border: showReception ? 'none' : '1px solid rgba(14, 165, 233, 0.4)',
              background: showReception 
                ? 'linear-gradient(135deg, #0ea5e9, #0284c7)' 
                : (pendingDocsCount > 0 ? 'rgba(14, 165, 233, 0.2)' : 'rgba(14, 165, 233, 0.08)'),
              color: showReception ? '#000' : '#0ea5e9',
              fontSize: '0.8rem',
              fontWeight: 900,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              position: 'relative',
              whiteSpace: 'nowrap',
              boxShadow: pendingDocsCount > 0 ? '0 0 15px rgba(14, 165, 233, 0.4)' : 'none',
              animation: pendingDocsCount > 0 ? 'pulse-blue 2s infinite' : 'none',
              transition: 'all 0.2s'
            }}
          >
            <Truck size={17} /> 
            <span className="hide-mobile">ПРИЙОМКА</span>
            <span className="mobile-only">ПРИЙОМКА</span>
            {pendingDocsCount > 0 && (
              <span className="badge-count anim-pulse" style={{ position: 'absolute', top: '-5px', right: '-5px', background: '#ef4444', color: '#fff', borderRadius: '50%', fontSize: '10px', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                {pendingDocsCount}
              </span>
            )}
          </button>

          <ManualIssueJournalButton onClick={manualIssue.openJournal} compact={window.innerWidth < 900} />
        </div>
      </div>
      <div className="hide-mobile" style={{ color: '#555', fontSize: '0.75rem', fontWeight: 600 }}>
        {currentUser?.first_name} {currentUser?.last_name}
      </div>
    </nav>
  )
}
