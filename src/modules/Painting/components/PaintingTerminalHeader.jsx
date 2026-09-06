import React from 'react'
import { ArrowLeft, Tablet } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ACCENT, ACCENT_RGB } from '../hooks/usePaintingTerminalData'

export default function PaintingTerminalHeader({
  currentTime,
  selectedShift,
  setSelectedShift
}) {
  return (
    <header className="terminal-header" style={{ flexShrink: 0, background: 'var(--card-bg, rgba(12,12,15,0.85))', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--glass-border, rgba(255,255,255,0.04))', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
        <Link to="/" style={{ color: 'var(--text-muted, #888)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: 700, flexShrink: 0 }}>
          <ArrowLeft size={15} /> <span className="back-text">На головну</span>
        </Link>
        <div style={{ width: '1px', height: '20px', background: 'var(--glass-border, rgba(255,255,255,0.08))', flexShrink: 0 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          <div style={{ background: `rgba(${ACCENT_RGB},0.1)`, padding: '6px', borderRadius: '10px', flexShrink: 0 }}>
            <Tablet size={18} color={ACCENT} />
          </div>
          <div style={{ minWidth: 0 }}>
            <h1 style={{ fontSize: '0.95rem', fontWeight: 950, letterSpacing: '0.3px', textTransform: 'uppercase', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text, #fff)' }}>ЕКРАН ФАРБУВАННЯ</h1>
            <div style={{ fontSize: '0.6rem', color: 'var(--text-muted, #555)', marginTop: '1px', fontWeight: 700, whiteSpace: 'nowrap' }}>ЦЕХ №2</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={{ fontSize: '0.55rem', color: 'var(--text-muted, #555)', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Зміна</span>
          <select
            value={selectedShift}
            onChange={e => setSelectedShift(e.target.value)}
            style={{ background: 'var(--input-bg, #121216)', border: '1px solid var(--glass-border, rgba(255,255,255,0.05))', color: 'var(--text, #fff)', padding: '6px 10px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer', outline: 'none' }}
          >
            <option value="">— Оберіть —</option>
            <option value="Зміна 1">Зміна 1</option>
            <option value="Зміна 2">Зміна 2</option>
            <option value="Зміна 3">Зміна 3</option>
            <option value="Зміна 4">Зміна 4</option>
            <option value="Без зміни">Без зміни</option>
          </select>
        </div>
        <div style={{ width: '1px', height: '24px', background: 'var(--glass-border, rgba(255,255,255,0.08))', display: 'block' }} className="header-divider" />
        <div style={{ textAlign: 'right', flexShrink: 0 }} className="live-clock-container">
          <div style={{ color: 'var(--text, #fff)', fontSize: '0.95rem', fontWeight: 900, fontFamily: 'monospace' }}>
            {currentTime.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
          <div style={{ color: 'var(--text-muted, #444)', fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase' }}>
            {currentTime.toLocaleDateString('uk-UA', { day: '2-digit', month: 'short' })}
          </div>
        </div>
      </div>
    </header>
  )
}
