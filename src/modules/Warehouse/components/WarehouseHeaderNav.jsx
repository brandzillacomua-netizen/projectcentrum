import React from 'react'
import { ArrowLeft, Truck, ArrowLeftRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { IconSO } from '../../../components/WarehouseIcons.jsx'
import { ManualIssueJournalButton } from '../ManualIssue/ManualInventoryIssueUI.jsx'

export const WarehouseHeaderNav = ({
  currentUser,
  activeTab,
  showReception,
  setShowReception,
  pendingDocsCount,
  manualIssue,
  setShowPrepModal,
  setShowTransferModal
}) => {
  return (
    <>
      <style>{`
        .warehouse-header-nav {
          min-height: 62px !important;
          height: auto !important;
          box-sizing: border-box;
        }
        .wh-label-full {
          display: inline;
        }
        .wh-label-short {
          display: none;
        }
        @media (max-width: 1450px) {
          .wh-label-full {
            display: none !important;
          }
          .wh-label-short {
            display: inline !important;
          }
          .wh-hide-medium {
            display: none !important;
          }
          .warehouse-header-nav .wh-subtitle {
            display: none !important;
          }
        }
        @media (max-width: 900px) {
          .wh-hide-small {
            display: none !important;
          }
          .warehouse-header-nav .warehouse-nav-btn {
            padding: 0 10px !important;
            font-size: 0.75rem !important;
          }
        }
      `}</style>
      <nav
        className="module-nav warehouse-header-nav"
        style={{
          flexShrink: 0,
          padding: '10px 20px',
          background: 'var(--surface-1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--border-subtle)',
          width: '100%',
          boxSizing: 'border-box',
          gap: '12px',
          flexWrap: 'nowrap'
        }}
      >
        {/* Left side: Back + Title + Subtitle/Badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0, flexShrink: 1 }}>
          <Link
            to="/"
            className="back-link"
            style={{ color: 'var(--text-dim)', transition: '0.3s', display: 'flex', alignItems: 'center', flexShrink: 0 }}
          >
            <ArrowLeft size={18} />
            <span className="wh-hide-small" style={{ marginLeft: '5px' }}>Назад</span>
          </Link>

          <div className="module-title-group" style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
            <IconSO className="text-secondary" size={20} color="#10b981" style={{ flexShrink: 0 }} />
            <div style={{ minWidth: 0 }}>
              <h1 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 950, letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>
                СКЛАД ОПЕРАТИВНИЙ
              </h1>
              <p className="wh-subtitle" style={{ margin: '2px 0 0', fontSize: '0.65rem', opacity: 0.65, whiteSpace: 'nowrap' }}>
                Робоче місце комірника: видача матеріалів на наряди
              </p>
            </div>

            <span
              className="pillar-badge-erp wh-hide-medium"
              style={{ padding: '3px 8px', borderRadius: '12px', fontSize: '0.65rem', fontWeight: 900, textTransform: 'uppercase', flexShrink: 0 }}
            >
              ERP WMS Pillar
            </span>

            <button
              type="button"
              onClick={() => {
                const url = new URL(window.location.href)
                url.searchParams.delete('tab')
                url.searchParams.set('tab', activeTab)
                navigator.clipboard.writeText(url.toString())
                alert('Посилання скопійовано!')
              }}
              title="Скопіювати посилання на вкладку"
              style={{
                background: 'rgba(255, 144, 0, 0.1)',
                border: '1px solid rgba(255, 144, 0, 0.3)',
                color: '#ff9000',
                padding: '4px 8px',
                borderRadius: '6px',
                fontSize: '0.65rem',
                fontWeight: 900,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                flexShrink: 0
              }}
            >
              <span>🔗</span>
              <span className="wh-hide-medium">Копіювати посилання</span>
            </button>
          </div>
        </div>

        {/* Right side: Action Buttons + User name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          {/* ПРИЙОМКА */}
          <button
            type="button"
            onClick={() => setShowReception(!showReception)}
            className="warehouse-nav-btn reception-btn"
            style={{
              height: '38px',
              padding: '0 14px',
              borderRadius: '10px',
              border: showReception ? 'none' : '1px solid rgba(14, 165, 233, 0.4)',
              background: showReception 
                ? 'linear-gradient(135deg, #0ea5e9, #0284c7)' 
                : (pendingDocsCount > 0 ? 'rgba(14, 165, 233, 0.2)' : 'rgba(14, 165, 233, 0.08)'),
              color: showReception ? '#000' : '#0ea5e9',
              fontSize: '0.78rem',
              fontWeight: 900,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              position: 'relative',
              whiteSpace: 'nowrap',
              boxShadow: pendingDocsCount > 0 ? '0 0 15px rgba(14, 165, 233, 0.4)' : 'none',
              animation: pendingDocsCount > 0 ? 'pulse-blue 2s infinite' : 'none',
              transition: 'all 0.2s'
            }}
          >
            <Truck size={16} /> 
            <span>ПРИЙОМКА</span>
            {pendingDocsCount > 0 && (
              <span className="badge-count anim-pulse" style={{ position: 'absolute', top: '-5px', right: '-5px', background: '#ef4444', color: '#fff', borderRadius: '50%', fontSize: '10px', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                {pendingDocsCount}
              </span>
            )}
          </button>

          {/* НАРЯД НА ПІДГОТОВКУ */}
          <button
            type="button"
            onClick={() => setShowPrepModal(true)}
            className="warehouse-nav-btn"
            style={{
              height: '38px',
              padding: '0 14px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #10b981, #059669)',
              border: 'none',
              color: '#fff',
              fontSize: '0.78rem',
              fontWeight: 900,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              boxShadow: '0 4px 10px rgba(16, 185, 129, 0.2)'
            }}
          >
            <span className="wh-label-full">НАРЯД НА ПІДГОТОВКУ</span>
            <span className="wh-label-short">НАРЯД</span>
          </button>

          {/* ЗАПИТ НА ПЕРЕМІЩЕННЯ */}
          <button
            type="button"
            onClick={() => setShowTransferModal && setShowTransferModal(true)}
            className="warehouse-nav-btn"
            style={{
              height: '38px',
              padding: '0 14px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
              border: 'none',
              color: '#fff',
              fontSize: '0.78rem',
              fontWeight: 900,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              boxShadow: '0 4px 10px rgba(59, 130, 246, 0.25)'
            }}
          >
            <ArrowLeftRight size={15} />
            <span className="wh-label-full">ЗАПИТ НА ПЕРЕМІЩЕННЯ</span>
            <span className="wh-label-short">ПЕРЕМІЩЕННЯ</span>
          </button>

          {/* РУЧНА ВИДАЧА */}
          <ManualIssueJournalButton onClick={manualIssue.openJournal} />

          {/* User badge */}
          {currentUser && (
            <div className="wh-hide-small" style={{ color: 'var(--text-dim)', fontSize: '0.75rem', fontWeight: 600, whiteSpace: 'nowrap', marginLeft: '6px' }}>
              {currentUser.first_name} {currentUser.last_name}
            </div>
          )}
        </div>
      </nav>
    </>
  )
}
