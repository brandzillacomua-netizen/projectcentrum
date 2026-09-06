import React from 'react'
import { ACCENT, ACCENT_RGB } from '../hooks/usePressingTerminalData'

export default function PressingTerminalFilters({
  filterMode,
  setFilterMode,
  waitingCards,
  inWorkCards
}) {
  return (
    <div style={{ padding: '14px 20px', background: 'rgba(255,255,255,0.01)', borderBottom: '1px solid var(--glass-border, rgba(255,255,255,0.03))', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
      <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', maxWidth: '100%', paddingBottom: '4px', scrollbarWidth: 'none' }} className="hide-scrollbar">
        {[
          { mode: 'all', label: 'Усі', count: waitingCards.length + inWorkCards.length, color: ACCENT },
          { mode: 'waiting', label: 'Очікують', count: waitingCards.length, color: '#f59e0b' },
          { mode: 'in_work', label: 'У роботі', count: inWorkCards.length, color: '#10b981' }
        ].map(tab => (
          <button
            key={tab.mode}
            type="button"
            onClick={() => setFilterMode(tab.mode)}
            style={{
              background: filterMode === tab.mode ? `rgba(${tab.mode === 'in_work' ? '16,185,129' : tab.mode === 'waiting' ? '245,158,11' : ACCENT_RGB}, 0.12)` : 'var(--card-bg, #121216)',
              color: filterMode === tab.mode ? tab.color : 'var(--text-muted, #888)',
              border: `1px solid ${filterMode === tab.mode ? tab.color + '40' : 'var(--glass-border, rgba(255,255,255,0.04))'}`,
              padding: '6px 12px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s', flexShrink: 0
            }}
          >
            {tab.label}
            <span style={{
              background: filterMode === tab.mode ? tab.color : 'var(--bg, #222)',
              color: filterMode === tab.mode ? '#000' : 'var(--text-muted, #888)',
              borderRadius: '5px', padding: '1px 5px', fontSize: '0.65rem', fontWeight: 900
            }}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>
      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted, #555)', fontWeight: 700, textTransform: 'uppercase' }} className="stage-label-title">Черга Пресування</div>
    </div>
  )
}
