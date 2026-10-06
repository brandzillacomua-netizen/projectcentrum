import React from 'react'
import { ArrowLeft, Factory, Menu, RefreshCw, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function Foreman2Layout({ loading, error, onRefresh, onOpenQueue, children }) {
  return (
    <div className="foreman-module" style={{ background: 'var(--surface-inset)', minHeight: '100vh', color: 'var(--text-strong)', display: 'flex', flexDirection: 'column' }}>
      <header className="module-nav no-print" style={{ flexShrink: 0, padding: '0 20px', height: '70px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface-1)', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
          <Link
            to="/"
            title="На головну"
            style={{ background: 'var(--surface-2, var(--surface-1))', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)', borderRadius: '8px', width: '38px', height: '38px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', flexShrink: 0 }}
          >
            <ArrowLeft size={18} />
          </Link>
          <button
            onClick={onOpenQueue}
            className="foreman2-mobile-menu"
            title="Черга нарядів"
            style={{ background: 'var(--surface-2, var(--surface-1))', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)', borderRadius: '8px', width: '38px', height: '38px', alignItems: 'center', justifyContent: 'center', display: 'none' }}
          >
            <Menu size={18} />
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, textAlign: 'center' }}>
          <Factory size={26} color="#ef4444" />
          <div style={{ minWidth: 0 }}>
            <div style={{ color: '#ff9000', fontSize: '0.62rem', fontWeight: 950, letterSpacing: '0.18em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              <ShieldCheck size={12} /> Foreman 2.0
            </div>
            <h1 style={{ margin: 0, color: 'var(--text-strong)', fontSize: '1.25rem', lineHeight: 1.1, fontWeight: 950, whiteSpace: 'nowrap' }}>
              ВИРОБНИЦТВО
            </h1>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', justifyContent: 'flex-end', minWidth: 0 }}>
          <span className="foreman2-mode-label" style={{ fontSize: '0.72rem', color: 'var(--text-dim)', fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
            РЕЖИМ МАЙСТРА
          </span>
          <button
            onClick={onRefresh}
            disabled={loading}
            title="Оновити дані"
            style={{ width: '38px', height: '38px', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'var(--surface-2, var(--surface-1))', color: loading ? 'var(--text-dim)' : 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: loading ? 'wait' : 'pointer', flexShrink: 0 }}
          >
            <RefreshCw size={17} className={loading ? 'foreman2-spin' : ''} />
          </button>
        </div>
      </header>

      {error && (
        <div className="no-print" style={{ margin: '12px 15px 0', border: '1px solid rgba(239,68,68,.4)', background: 'rgba(239,68,68,.08)', color: '#ef4444', padding: '10px 12px', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 850 }}>
          {error}
        </div>
      )}

      {children}

      <style>{`
        .foreman2-spin { animation: foreman2-spin .8s linear infinite; }
        @keyframes foreman2-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .foreman2-tabs button,
        .foreman2-tabs a {
          height: 42px;
          border-radius: 0;
          border: none;
          border-right: 1px solid var(--border-subtle, #222);
          background: transparent;
          color: var(--text-muted, #777);
          padding: 0 18px;
          font-size: 0.72rem;
          font-weight: 950;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          text-decoration: none;
          cursor: pointer;
        }
        .foreman2-tabs .active {
          color: var(--text-strong, #fff);
          background: var(--surface-1, #111);
          box-shadow: inset 0 -2px 0 #ef4444;
        }
        .foreman2-part-row:hover {
          border-color: var(--border-subtle, #333) !important;
          background: var(--surface-2, #141414) !important;
        }
        .foreman2-card-tile {
          background: var(--card-bg, var(--surface-1));
          border: 1px solid var(--border-subtle, #242424);
          border-radius: 10px;
          padding: 12px;
          min-width: 0;
        }
        @media (max-width: 900px) {
          .foreman2-mobile-menu { display: inline-flex !important; }
          .foreman2-mode-label { display: none; }
          .foreman-module .master-grid { display: block !important; }
          .foreman-module .side-panel {
            position: fixed !important;
            top: 70px;
            left: 0;
            bottom: 0;
            width: min(86vw, 320px) !important;
            height: auto !important;
            z-index: 50;
            transform: translateX(-105%);
            transition: transform .25s ease;
            box-shadow: 12px 0 30px rgba(0,0,0,.45);
          }
          .foreman-module .side-panel.drawer-open { transform: translateX(0); }
          .foreman-module .content-panel { min-height: calc(100vh - 70px); }
          .foreman2-tabs { overflow-x: auto; }
          .foreman2-summary-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
          .foreman2-scrap-grid { grid-template-columns: 1fr !important; }
          .foreman2-part-metrics { width: 100%; justify-content: flex-start !important; }
        }
      `}</style>
    </div>
  )
}
