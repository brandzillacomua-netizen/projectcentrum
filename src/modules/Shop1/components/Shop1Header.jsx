import React from 'react'
import { ArrowLeft, Menu, PauseCircle } from 'lucide-react'
import { Link } from 'react-router-dom'

export function Shop1Header({
  currentTime,
  queueCardsCount = 0,
  onOpenDrawer,
  onOpenBulkPause,
  pausedMachinesCount = 0,
  theme
}) {
  const isLight = theme === 'light' || (typeof document !== 'undefined' && document.body.classList.contains('light-theme'))

  return (
    <>
      <style>{`
        .shop1-header-btn-pause {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 7px 14px;
          border-radius: 12px;
          font-size: 0.82rem;
          font-weight: 900;
          cursor: pointer;
          transition: all 0.2s ease;
          flex-shrink: 0;
        }
        .shop1-header-btn-pause:hover {
          background: #dc2626 !important;
          border-color: #b91c1c !important;
        }
        .shop1-header-btn-pause:active {
          transform: scale(0.97);
        }
        @media (max-width: 680px) {
          .shop1-header-btn-pause {
            padding: 6px 10px !important;
            font-size: 0.75rem !important;
          }
          .shop1-header-btn-pause-text-full {
            display: none !important;
          }
          .shop1-header-btn-pause-text-short {
            display: inline !important;
          }
          .shop1-header-date {
            display: none !important;
          }
          .shop1-header-clock {
            font-size: 0.95rem !important;
          }
        }
        @media (min-width: 681px) {
          .shop1-header-btn-pause-text-full {
            display: inline !important;
          }
          .shop1-header-btn-pause-text-short {
            display: none !important;
          }
        }
        @media (max-width: 420px) {
          .terminal-nav {
            padding: 0 10px !important;
          }
          .shop1-header-btn-pause {
            padding: 5px 8px !important;
          }
        }
      `}</style>

      <header className="terminal-nav" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0 20px',
        height: '70px',
        background: isLight ? '#ffffff' : 'var(--surface-black)',
        borderBottom: isLight ? '2px solid #eab308' : '2px solid #eab308',
        boxShadow: isLight ? '0 2px 8px rgba(0,0,0,0.04)' : 'none',
        flexShrink: 0
      }}>
        {/* Left Section: Back & Queue Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Link to="/" style={{ color: isLight ? '#475569' : '#94a3b8', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '0.85rem' }}>
            <ArrowLeft size={18} /> <span className="hide-mobile">Вихід</span>
          </Link>

          <button onClick={onOpenDrawer} className="burger-btn-labeled mobile-only">
            <Menu size={18} />
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

        {/* Center Section: Shop Title & Bulk Pause Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }} className="hide-mobile">
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#eab308', boxShadow: '0 0 8px #eab308' }} />
            <span style={{ fontSize: '1rem', fontWeight: 900, color: isLight ? '#0f172a' : '#ffffff', margin: 0 }}>ЦЕХ №1: ТЕРМІНАЛ</span>
          </div>

          {onOpenBulkPause && (
            <button
              type="button"
              onClick={onOpenBulkPause}
              title="Керування паузою верстатів цеху"
              className="shop1-header-btn-pause"
              style={{
                background: '#ef4444',
                border: '1.5px solid #dc2626',
                color: '#ffffff',
                boxShadow: pausedMachinesCount > 0
                  ? '0 0 16px rgba(239, 68, 68, 0.65)'
                  : '0 2px 8px rgba(239, 68, 68, 0.35)'
              }}
            >
              <PauseCircle size={17} color="#ffffff" style={{ flexShrink: 0 }} />
              <span className="shop1-header-btn-pause-text-full">ПАУЗА ВЕРСТАТІВ</span>
              <span className="shop1-header-btn-pause-text-short">ПАУЗА</span>
              {pausedMachinesCount > 0 && (
                <span style={{
                  background: '#ffffff',
                  color: '#dc2626',
                  padding: '1px 6px',
                  borderRadius: '10px',
                  fontSize: '0.72rem',
                  fontWeight: 950,
                  lineHeight: 1.2
                }}>
                  {pausedMachinesCount}
                </span>
              )}
            </button>
          )}
        </div>

        {/* Right Section: Realtime Clock */}
        <div className="shop1-header-clock" style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: '1.15rem', color: isLight ? '#b45309' : '#eab308', textAlign: 'right', whiteSpace: 'nowrap' }}>
          {currentTime ? (
            <>
              <span className="shop1-header-date">{currentTime.toLocaleDateString('uk-UA')} </span>
              <span>{currentTime.toLocaleTimeString()}</span>
            </>
          ) : ''}
        </div>
      </header>
    </>
  )
}
