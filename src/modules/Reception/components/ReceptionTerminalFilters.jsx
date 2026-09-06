import React from 'react'
import { ACCENT, ACCENT_RGB } from '../hooks/useReceptionTerminalData'

export default function ReceptionTerminalFilters({
  filterMode,
  setFilterMode,
  waitingCards,
  inWorkCards
}) {
  return (
    <div style={{ padding: '18px 24px', background: 'rgba(255,255,255,0.01)', borderBottom: '1px solid var(--glass-border, rgba(255,255,255,0.03))', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', maxWidth: '100%', paddingBottom: '6px', scrollbarWidth: 'none' }} className="hide-scrollbar">
        {[
          { mode: 'all', label: 'Усі картки', count: waitingCards.length + inWorkCards.length, color: ACCENT },
          { mode: 'waiting', label: 'Буфер Галтовки', count: waitingCards.length, color: '#f59e0b' },
          { mode: 'in_work', label: 'На Прийомці', count: inWorkCards.length, color: '#10b981' }
        ].map(tab => (
          <button
            key={tab.mode}
            type="button"
            onClick={() => setFilterMode(tab.mode)}
            style={{
              background: filterMode === tab.mode ? `rgba(${tab.mode === 'in_work' ? '16,185,129' : tab.mode === 'waiting' ? '245,158,11' : ACCENT_RGB}, 0.12)` : 'var(--card-bg, #121216)',
              color: filterMode === tab.mode ? tab.color : 'var(--text-muted, #888)',
              border: `1px solid ${filterMode === tab.mode ? tab.color + '40' : 'var(--glass-border, rgba(255,255,255,0.04))'}`,
              padding: '8px 16px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 800, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s', flexShrink: 0
            }}
          >
            {tab.label}
            <span style={{
              background: filterMode === tab.mode ? tab.color : 'var(--bg, #222)',
              color: filterMode === tab.mode ? '#000' : 'var(--text-muted, #888)',
              borderRadius: '6px', padding: '1px 6px', fontSize: '0.68rem', fontWeight: 900
            }}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>
      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #555)', fontWeight: 700, textTransform: 'uppercase' }}>Буфер Галтовки → Прийомка → Сортування</div>
    </div>
  )
}
