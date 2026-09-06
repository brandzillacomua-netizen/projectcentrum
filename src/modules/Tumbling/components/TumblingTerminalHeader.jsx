import React from 'react'
import { ArrowLeft, Tablet } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function TumblingTerminalHeader({
  currentTime,
  selectedShift,
  setSelectedShift
}) {
  return (
    <header style={{ flexShrink: 0, background: 'var(--card-bg, rgba(12,12,15,0.85))', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--glass-border, rgba(255,255,255,0.04))', zIndex: 10 }}>

      {/* Row 1: Back + Title */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px 0 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <Link to="/" style={{ color: 'var(--text-muted, #888)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: 700, flexShrink: 0 }}>
            <ArrowLeft size={15} /> На головну
          </Link>
          <div style={{ width: '1px', height: '20px', background: 'var(--glass-border, rgba(255,255,255,0.08))', flexShrink: 0 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
            <div style={{ background: 'rgba(6,182,212,0.1)', padding: '6px', borderRadius: '10px', flexShrink: 0 }}>
              <Tablet size={18} color="#06b6d4" />
            </div>
            <div style={{ minWidth: 0 }}>
              <h1 style={{ fontSize: '0.95rem', fontWeight: 950, letterSpacing: '0.3px', textTransform: 'uppercase', margin: 0, whiteSpace: 'nowrap', color: 'var(--text, #fff)' }}>ЕКРАН ГАЛТОВКИ</h1>
              <div style={{ fontSize: '0.6rem', color: 'var(--text-muted, #555)', marginTop: '1px', fontWeight: 700 }}>ТЕРМІНАЛ ОБРОБКИ ДЕТАЛЕЙ</div>
            </div>
          </div>
        </div>

        {/* Live Clock — always top-right */}
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ color: 'var(--text, #fff)', fontSize: '1rem', fontWeight: 900, fontFamily: 'monospace' }}>
            {currentTime.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
          <div style={{ color: 'var(--text-muted, #444)', fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase' }}>
            {currentTime.toLocaleDateString('uk-UA', { day: '2-digit', month: 'short' })}
          </div>
        </div>
      </div>

      {/* Row 2: Shift selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 20px 12px 20px' }}>
        <span style={{ fontSize: '0.6rem', color: 'var(--text-muted, #555)', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0 }}>ЗМІНА</span>
        <select
          value={selectedShift}
          onChange={e => setSelectedShift(e.target.value)}
          style={{ background: 'var(--input-bg, #121216)', border: '1px solid var(--glass-border, rgba(255,255,255,0.07))', color: 'var(--text, #fff)', padding: '7px 12px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer', outline: 'none', flex: '0 0 auto' }}
        >
          <option value="">— Оберіть —</option>
          <option value="Зміна 1">Зміна 1</option>
          <option value="Зміна 2">Зміна 2</option>
          <option value="Зміна 3">Зміна 3</option>
          <option value="Зміна 4">Зміна 4</option>
          <option value="Без зміни">Без зміни</option>
        </select>
      </div>
    </header>
  )
}
