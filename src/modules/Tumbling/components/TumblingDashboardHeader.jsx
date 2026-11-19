import React from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Clock } from 'lucide-react'

export function TumblingDashboardHeader({
  currentTime,
  isFullScreen,
  setIsFullScreen,
  autoScrollActive,
  setAutoScrollActive,
  shiftDeficits,
  scaleMode = 'auto',
  effectiveScale = 1,
  onCycleScale
}) {
  const scaleLabel = scaleMode === 'auto'
    ? `Авто (${Math.round(effectiveScale * 100)}%)`
    : `${Math.round(parseFloat(scaleMode) * 100)}%`

  return (
    <header style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: '16px',
      background: 'var(--col-head-bg, rgba(15, 15, 22, 0.9))',
      backdropFilter: 'blur(10px)',
      border: '1px solid var(--col-border, var(--border-subtle))',
      borderRadius: '16px',
      padding: '10px 20px',
      marginBottom: '14px',
      flexShrink: 0,
      minWidth: 0
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
        <Link to="/" onClick={() => localStorage.removeItem('centrum_tv_route')} style={{ color: 'var(--text-muted)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}>
          <ArrowLeft size={16} /> На головну
        </Link>
        <div style={{ width: '1px', height: '20px', background: 'var(--col-border, var(--border-subtle))', flexShrink: 0 }} />
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'nowrap' }}>
            <h1 style={{ fontSize: '1.15rem', fontWeight: 900, margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#ff9000', whiteSpace: 'nowrap' }}>
              МОНІТОР ГАЛТОВКИ · ЦЕХ №1
            </h1>
            <span style={{ background: 'rgba(255, 144, 0, 0.12)', color: '#ff9000', fontSize: '0.65rem', padding: '2px 8px', borderRadius: '20px', border: '1px solid rgba(255,144,0,0.25)', fontWeight: 800, whiteSpace: 'nowrap', flexShrink: 0 }}>
              ТВ Режим
            </span>
          </div>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted, var(--text-dim))', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
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
          background: 'rgba(239, 68, 68, 0.08)',
          border: '1px solid rgba(239, 68, 68, 0.25)',
          borderRadius: '12px',
          padding: '6px 12px',
          minWidth: 0,
          maxWidth: '480px',
          overflow: 'hidden'
        }}>
          <div style={{
            background: '#ef4444',
            color: '#ffffff',
            fontSize: '0.6rem',
            fontWeight: 950,
            padding: '4px 8px',
            borderRadius: '6px',
            textTransform: 'uppercase',
            animation: 'pulse 1.5s infinite',
            lineHeight: 1.1,
            whiteSpace: 'nowrap',
            flexShrink: 0
          }}>
            Дефіцит зміни
          </div>
          <div style={{ display: 'flex', gap: '12px', minWidth: 0, overflow: 'hidden' }}>
            {shiftDeficits.slice(0, 3).map(def => (
              <div key={`${def.orderNum}-${def.nomenclatureId}`} style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-primary, var(--text-strong))', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', maxWidth: '105px' }} title={def.name}>
                  {def.name}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ width: '40px', height: '4px', background: 'var(--col-border, var(--border-subtle))', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{ width: `${def.percent}%`, height: '100%', background: '#ef4444' }} />
                  </div>
                  <span style={{ fontSize: '0.62rem', color: '#ef4444', fontWeight: 800, whiteSpace: 'nowrap' }}>{def.percent}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Right side widgets */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexShrink: 0 }}>
        {/* Controls */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {onCycleScale && (
            <button
              onClick={onCycleScale}
              title="Змінити масштаб інтерфейсу для ТВ"
              style={{
                background: 'var(--kit-card-bg, var(--surface-2))',
                color: 'var(--text-primary, var(--text-strong))',
                border: '1px solid var(--col-border, var(--border-subtle))',
                padding: '6px 10px',
                borderRadius: '8px',
                fontSize: '0.72rem',
                fontWeight: 800,
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              Масштаб: {scaleLabel}
            </button>
          )}
          <button 
            onClick={() => setAutoScrollActive(!autoScrollActive)}
            style={{
              background: autoScrollActive ? 'rgba(6,182,212,0.14)' : 'var(--kit-card-bg, var(--surface-2))',
              color: autoScrollActive ? '#06b6d4' : 'var(--text-muted)',
              border: `1px solid ${autoScrollActive ? 'rgba(6,182,212,0.4)' : 'var(--col-border, var(--border-subtle))'}`,
              padding: '6px 11px',
              borderRadius: '8px',
              fontSize: '0.72rem',
              fontWeight: 800,
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            Авто-скрол: {autoScrollActive ? 'Увімкнено' : 'Вимкнено'}
          </button>
          <button 
            onClick={() => setIsFullScreen(!isFullScreen)}
            style={{
              background: 'var(--kit-card-bg, var(--surface-2))',
              color: 'var(--text-primary, var(--text-strong))',
              border: '1px solid var(--col-border, var(--border-subtle))',
              padding: '6px 11px',
              borderRadius: '8px',
              fontSize: '0.72rem',
              fontWeight: 800,
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            {isFullScreen ? 'Стиснути' : 'На весь екран'}
          </button>
        </div>

        <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
          <div style={{ fontSize: '1.2rem', fontWeight: 900, fontFamily: 'monospace', color: 'var(--text-primary, var(--text-strong))', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
            <Clock size={16} color="#06b6d4" />
            {currentTime.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted, var(--text-dim))', fontWeight: 800, textTransform: 'uppercase' }}>
            {currentTime.toLocaleDateString('uk-UA', { day: '2-digit', month: 'long', year: 'numeric' })}
          </div>
        </div>
      </div>
    </header>
  )
}
