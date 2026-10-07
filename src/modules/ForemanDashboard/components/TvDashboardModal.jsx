import React, { useState, useEffect, useRef } from 'react'
import { Tv, X, Play, Pause, RefreshCw, Radio } from 'lucide-react'
import WipTable from './WipTable'

export function TvDashboardModal({
  isOpen,
  onClose,
  overviewGroups = [],
  activeTasks = [],
  taskStatusMap = {},
  handleCellClick,
  handleRefresh,
  isRefreshing
}) {
  const [autoScroll, setAutoScroll] = useState(true)
  const [currentTime, setCurrentTime] = useState(new Date())
  const containerRef = useRef(null)

  // Realtime Clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Auto-scroll loop for big TV screens
  useEffect(() => {
    if (!isOpen || !autoScroll) return

    let direction = 1 // 1 = down, -1 = up
    const scrollStep = 1
    const delay = 40

    const interval = setInterval(() => {
      const el = containerRef.current
      if (!el) return

      if (el.scrollHeight <= el.clientHeight) return

      if (direction === 1) {
        if (el.scrollTop + el.clientHeight >= el.scrollHeight - 5) {
          direction = -1
          setTimeout(() => {}, 2000) // Pause at bottom
        } else {
          el.scrollTop += scrollStep
        }
      } else {
        if (el.scrollTop <= 5) {
          direction = 1
          setTimeout(() => {}, 2000) // Pause at top
        } else {
          el.scrollTop -= scrollStep * 2
        }
      }
    }, delay)

    return () => clearInterval(interval)
  }, [isOpen, autoScroll])

  // Keydown ESC
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown)
    }
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const readyCount = activeTasks.filter(t => taskStatusMap[t.id] === 'ready').length
  const inProgressCount = activeTasks.filter(t => taskStatusMap[t.id] === 'in_progress').length
  const shortageCount = activeTasks.filter(t => taskStatusMap[t.id] === 'shortage').length

  const totalWipUnits = overviewGroups.reduce((acc, g) => {
    return acc + g.rows.reduce((rAcc, r) => rAcc + (r.sum || 0), 0)
  }, 0)

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: '#040508',
      zIndex: 99999,
      display: 'flex',
      flexDirection: 'column',
      color: '#f8fafc',
      fontFamily: 'Inter, system-ui, sans-serif',
      boxSizing: 'border-box'
    }}>
      {/* ── High-Contrast Header ────────────────────────────────────────────── */}
      <div style={{
        background: '#0d111a',
        borderBottom: '2px solid #1e293b',
        padding: '14px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '46px',
            height: '46px',
            borderRadius: '14px',
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1.5px solid rgba(239, 68, 68, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ef4444'
          }}>
            <Tv size={26} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <h1 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 1000, letterSpacing: '0.04em', color: '#ffffff' }}>
                ДАШБОРД 2.0 — LIVE МОНІТОР СТАНОВИЩА
              </h1>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px',
                borderRadius: '20px',
                background: 'rgba(239, 68, 68, 0.2)',
                border: '1px solid #ef4444',
                color: '#f87171',
                fontSize: '0.72rem',
                fontWeight: 950,
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                <Radio size={12} className="animate-pulse" /> LIVE REALTIME
              </span>
            </div>
            <div style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 700, marginTop: '2px' }}>
              Моніторинг робочих карток у реальному часі · Цех №1 та Цех №2
            </div>
          </div>
        </div>

        {/* Right Header Stats & Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          {/* Clock */}
          <div style={{
            fontSize: '1.4rem',
            fontWeight: 1000,
            fontFamily: 'monospace',
            color: '#38bdf8',
            background: '#0f172a',
            padding: '6px 14px',
            borderRadius: '10px',
            border: '1px solid #1e293b'
          }}>
            {currentTime.toLocaleTimeString('uk-UA')}
          </div>

          <button
            onClick={() => setAutoScroll(!autoScroll)}
            style={{
              background: autoScroll ? 'rgba(56, 189, 248, 0.15)' : '#1e293b',
              border: `1.5px solid ${autoScroll ? '#38bdf8' : '#334155'}`,
              color: autoScroll ? '#38bdf8' : '#94a3b8',
              padding: '8px 14px',
              borderRadius: '10px',
              fontWeight: 900,
              fontSize: '0.8rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            {autoScroll ? <Pause size={14} /> : <Play size={14} />}
            <span>{autoScroll ? 'Автопрокрутка [УВІМК]' : 'Автопрокрутка [ВИМК]'}</span>
          </button>

          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            style={{
              background: '#1e293b',
              border: '1.5px solid #334155',
              color: '#f8fafc',
              padding: '8px 14px',
              borderRadius: '10px',
              fontWeight: 900,
              fontSize: '0.8rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
            <span>Оновити</span>
          </button>

          <button
            onClick={onClose}
            style={{
              background: '#ef4444',
              color: '#ffffff',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '10px',
              fontWeight: 950,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <X size={18} /> ВИЙТИ С ТВ
          </button>
        </div>
      </div>

      {/* ── Key Metrics Bar ────────────────────────────────────────────── */}
      <div style={{
        padding: '12px 24px',
        background: '#090d16',
        borderBottom: '1.5px solid #1e293b',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '12px'
      }}>
        <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>Активні наряди:</span>
          <span style={{ fontSize: '1.3rem', fontWeight: 1000, color: '#ff9000' }}>{activeTasks.length}</span>
        </div>

        <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>Готові до закриття:</span>
          <span style={{ fontSize: '1.3rem', fontWeight: 1000, color: '#10b981' }}>{readyCount}</span>
        </div>

        <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>В роботі (процес):</span>
          <span style={{ fontSize: '1.3rem', fontWeight: 1000, color: '#eab308' }}>{inProgressCount}</span>
        </div>

        <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>Потреба у довипуску:</span>
          <span style={{ fontSize: '1.3rem', fontWeight: 1000, color: '#ef4444' }}>{shortageCount}</span>
        </div>

        <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>Загальний WIP (шт):</span>
          <span style={{ fontSize: '1.3rem', fontWeight: 1000, color: '#38bdf8' }}>{totalWipUnits.toLocaleString('uk-UA')}</span>
        </div>
      </div>

      {/* ── Table Container ────────────────────────────────────────────── */}
      <div
        ref={containerRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px 24px',
          boxSizing: 'border-box'
        }}
      >
        <WipTable
          groupedData={overviewGroups}
          maxHeight="none"
          emptyText="Немає активних деталей у системі"
          onCellClick={handleCellClick}
        />
      </div>

      {/* Custom CSS overrides for TV view */}
      <style>{`
        .wip-table-container {
          font-size: 0.92rem !important;
        }
        .wip-table-container th {
          font-size: 0.82rem !important;
          padding: 12px 14px !important;
        }
        .wip-table-container td {
          font-size: 0.9rem !important;
          padding: 10px 12px !important;
        }
        .wip-col-nomenclature {
          font-size: 0.9rem !important;
          font-weight: 900 !important;
        }
      `}</style>
    </div>
  )
}
