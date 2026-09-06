import React from 'react'
import { ArrowLeft, Tablet } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ACCENT, ACCENT_RGB } from '../hooks/useReceptionTerminalData'

export default function ReceptionTerminalHeader({
  currentTime,
  selectedShift,
  setSelectedShift
}) {
  return (
    <header style={{ flexShrink: 0, background: 'var(--card-bg, rgba(12,12,15,0.85))', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--glass-border, rgba(255,255,255,0.04))', padding: '0 24px', height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        <Link to="/" style={{ color: 'var(--text-muted, #888)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', fontWeight: 700 }}>
          <ArrowLeft size={16} /> На головну
        </Link>
        <div style={{ width: '1px', height: '24px', background: 'var(--glass-border, rgba(255,255,255,0.08))' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ background: `rgba(${ACCENT_RGB},0.1)`, padding: '8px', borderRadius: '12px' }}>
            <Tablet size={20} color={ACCENT} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.05rem', fontWeight: 950, letterSpacing: '0.5px', textTransform: 'uppercase', margin: 0, color: 'var(--text, #fff)' }}>ЕКРАН ПРИЙОМКИ</h1>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted, #555)', marginTop: '2px', fontWeight: 700 }}>ТЕРМІНАЛ КОНТРОЛЮ ДЕТАЛЕЙ</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '0.55rem', color: 'var(--text-muted, #555)', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Зміна</span>
          <select
            value={selectedShift}
            onChange={e => setSelectedShift(e.target.value)}
            style={{ background: 'var(--input-bg, #121216)', border: '1px solid var(--glass-border, rgba(255,255,255,0.05))', color: 'var(--text, #fff)', padding: '8px 12px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer', outline: 'none', width: '120px' }}
          >
            <option value="">— Оберіть —</option>
            <option value="Зміна 1">Зміна 1</option>
            <option value="Зміна 2">Зміна 2</option>
            <option value="Зміна 3">Зміна 3</option>
            <option value="Зміна 4">Зміна 4</option>
            <option value="Без зміни">Без зміни</option>
          </select>
        </div>
        <div style={{ width: '1px', height: '32px', background: 'var(--glass-border, rgba(255,255,255,0.08))' }} />
        <div style={{ textAlign: 'right', minWidth: '80px' }}>
          <div style={{ color: 'var(--text, #fff)', fontSize: '1rem', fontWeight: 900, fontFamily: 'monospace' }}>
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
