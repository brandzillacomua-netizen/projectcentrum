import React from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Clock } from 'lucide-react'

export function TumblingDashboardHeader({
  currentTime,
  isFullScreen,
  setIsFullScreen,
  autoScrollActive,
  setAutoScrollActive,
  shiftDeficits
}) {
  return (
    <header style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      background: 'rgba(15, 15, 22, 0.85)',
      backdropFilter: 'blur(10px)',
      border: '1px solid rgba(255, 255, 255, 0.05)',
      borderRadius: '16px',
      padding: '12px 24px',
      marginBottom: '16px',
      flexShrink: 0
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <Link to="/" style={{ color: '#888', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: 700 }}>
          <ArrowLeft size={16} /> На головну
        </Link>
        <div style={{ width: '1px', height: '20px', background: 'rgba(255, 255, 255, 0.1)' }} />
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h1 style={{ fontSize: '1.2rem', fontWeight: 900, margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#ff9000' }}>
              МОНІТОР ГАЛТОВКИ · ЦЕХ №1
            </h1>
            <span style={{ background: 'rgba(255, 144, 0, 0.1)', color: '#ff9000', fontSize: '0.65rem', padding: '2px 8px', borderRadius: '20px', border: '1px solid rgba(255,144,0,0.2)', fontWeight: 800 }}>
              ТВ Режим
            </span>
          </div>
          <div style={{ fontSize: '0.65rem', color: '#666', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Черга та пріоритети на основі комплектності готової продукції
          </div>
        </div>
      </div>

      {/* Shift Deficits Widget */}
      {shiftDeficits.length > 0 && (
        <div className="hide-mobile" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          background: 'rgba(239, 68, 68, 0.05)',
          border: '1px solid rgba(239, 68, 68, 0.15)',
          borderRadius: '12px',
          padding: '6px 14px',
          maxWidth: '520px'
        }}>
          <div style={{
            background: '#ef4444',
            color: '#000',
            fontSize: '0.6rem',
            fontWeight: 950,
            padding: '3px 8px',
            borderRadius: '6px',
            textTransform: 'uppercase',
            animation: 'pulse 1.5s infinite',
            lineHeight: 1
          }}>
            Дефіцит зміни
          </div>
          <div style={{ display: 'flex', gap: '16px' }}>
            {shiftDeficits.map(def => (
              <div key={`${def.orderNum}-${def.nomenclatureId}`} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#fff', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', maxWidth: '100px' }} title={def.name}>
                  {def.name}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ width: '40px', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{ width: `${def.percent}%`, height: '100%', background: '#ef4444' }} />
                  </div>
                  <span style={{ fontSize: '0.62rem', color: '#ef4444', fontWeight: 800 }}>{def.percent}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Right side widgets */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        {/* Controls */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            onClick={() => setAutoScrollActive(!autoScrollActive)}
            style={{
              background: autoScrollActive ? 'rgba(6,182,212,0.1)' : '#1a1a24',
              color: autoScrollActive ? '#06b6d4' : '#888',
              border: `1px solid ${autoScrollActive ? 'rgba(6,182,212,0.3)' : 'rgba(255,255,255,0.05)'}`,
              padding: '6px 12px',
              borderRadius: '8px',
              fontSize: '0.7rem',
              fontWeight: 800,
              cursor: 'pointer'
            }}
          >
            Авто-скрол: {autoScrollActive ? 'Увімкнено' : 'Вимкнено'}
          </button>
          <button 
            onClick={() => setIsFullScreen(!isFullScreen)}
            style={{
              background: '#1a1a24',
              color: '#fff',
              border: '1px solid rgba(255,255,255,0.05)',
              padding: '6px 12px',
              borderRadius: '8px',
              fontSize: '0.7rem',
              fontWeight: 800,
              cursor: 'pointer'
            }}
          >
            {isFullScreen ? 'Стиснути' : 'На весь екран'}
          </button>
        </div>

        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '1.25rem', fontWeight: 900, fontFamily: 'monospace', color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Clock size={16} color="#06b6d4" />
            {currentTime.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
          <div style={{ fontSize: '0.65rem', color: '#555', fontWeight: 800, textTransform: 'uppercase' }}>
            {currentTime.toLocaleDateString('uk-UA', { day: '2-digit', month: 'long', year: 'numeric' })}
          </div>
        </div>
      </div>
    </header>
  )
}
