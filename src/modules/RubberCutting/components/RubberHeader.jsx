import React from 'react';
import { ArrowLeft, Scissors, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ACCENT_RUBBER, ACCENT_RUBBER_RGB, DEFAULT_SHIFTS } from '../utils/rubberConstants';

export function RubberHeader({
  selectedShift,
  setSelectedShift,
  onShiftOperators = [],
  currentTime
}) {
  const onShiftCount = (onShiftOperators && onShiftOperators.length) || 0;

  return (
    <header 
      className="terminal-header" 
      style={{
        flexShrink: 0,
        background: 'rgba(12,12,16,0.92)',
        backdropFilter: 'blur(14px)',
        borderBottom: '1px solid var(--border-subtle, rgba(255,255,255,0.08))',
        padding: '0 24px',
        minHeight: '75px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        zIndex: 20
      }}
    >
      {/* Left: Back & Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        <Link 
          to="/" 
          style={{ 
            color: 'var(--text-muted, #94a3b8)', 
            textDecoration: 'none', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px', 
            fontSize: '0.85rem', 
            fontWeight: 700 
          }}
        >
          <ArrowLeft size={16} /> На головну
        </Link>

        <div style={{ width: '1px', height: '24px', background: 'var(--fill-subtle, rgba(255,255,255,0.1))' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ 
            background: `rgba(${ACCENT_RUBBER_RGB}, 0.15)`, 
            padding: '10px', 
            borderRadius: '12px',
            border: `1px solid rgba(${ACCENT_RUBBER_RGB}, 0.3)`
          }}>
            <Scissors size={22} color={ACCENT_RUBBER} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 style={{ fontSize: '1.1rem', fontWeight: 950, letterSpacing: '0.5px', textTransform: 'uppercase', margin: 0, color: '#fff' }}>
                ПОРІЗКА ГУМИ
              </h1>
              <span style={{ 
                background: `rgba(${ACCENT_RUBBER_RGB}, 0.2)`, 
                color: ACCENT_RUBBER, 
                border: `1px solid rgba(${ACCENT_RUBBER_RGB}, 0.4)`,
                padding: '1px 7px',
                borderRadius: '6px',
                fontSize: '0.65rem',
                fontWeight: 900
              }}>
                ЦЕХ №2
              </span>
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-dim, #64748b)', marginTop: '2px', fontWeight: 700 }}>
              РОБОЧИЙ ЦЕНТР РОЗКРОЮ ЛИСТОВОЇ ГУМИ 500*500
            </div>
          </div>
        </div>
      </div>

      {/* Right: Shift, On-shift Count, Clock */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {/* On shift operators counter badge */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: `rgba(${ACCENT_RUBBER_RGB}, 0.1)`,
          border: `1px solid rgba(${ACCENT_RUBBER_RGB}, 0.25)`,
          padding: '8px 14px',
          borderRadius: '10px',
          color: ACCENT_RUBBER,
          fontSize: '0.8rem',
          fontWeight: 800
        }}>
          <Users size={16} />
          <span>Лицювальників: {onShiftCount}</span>
        </div>

        {/* Shift selector */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          <span style={{ fontSize: '0.55rem', color: 'var(--text-dim, #64748b)', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Зміна
          </span>
          <select
            value={selectedShift}
            onChange={e => setSelectedShift(e.target.value)}
            style={{ 
              background: 'var(--surface-2, #181820)', 
              border: '1px solid var(--border-subtle, rgba(255,255,255,0.12))', 
              color: 'var(--text-strong, #fff)', 
              padding: '7px 12px', 
              borderRadius: '10px', 
              fontSize: '0.78rem', 
              fontWeight: 800, 
              cursor: 'pointer', 
              outline: 'none', 
              width: '125px' 
            }}
          >
            {DEFAULT_SHIFTS.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        <div style={{ width: '1px', height: '32px', background: 'var(--fill-subtle, rgba(255,255,255,0.1))' }} />

        {/* Time */}
        <div style={{ textAlign: 'right', minWidth: '85px' }}>
          <div style={{ color: 'var(--text-strong, #fff)', fontSize: '1.05rem', fontWeight: 900, fontFamily: 'monospace' }}>
            {currentTime.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
          <div style={{ color: 'var(--text-dim, #64748b)', fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase' }}>
            {currentTime.toLocaleDateString('uk-UA', { day: '2-digit', month: 'short' })}
          </div>
        </div>
      </div>
    </header>
  );
}

