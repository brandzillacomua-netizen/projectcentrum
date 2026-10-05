import React from 'react'

const ACCENT = '#34d399'
const ACCENT_RGB = '52,211,153'

export default function SortingTerminalFilters({
  filterMode,
  setFilterMode,
  waitingCount,
  inWorkCount
}) {
  const tabs = [
    { mode: 'all', label: 'Усі картки', count: waitingCount + inWorkCount, color: ACCENT },
    { mode: 'waiting', label: 'Очікують на сортування', count: waitingCount, color: '#f59e0b' },
    { mode: 'in_work', label: 'На Сортуванні', count: inWorkCount, color: '#10b981' }
  ]

  return (
    <div className="terminal-filters" style={{ padding: '18px 24px', background: 'var(--fill-subtle)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', maxWidth: '100%', paddingBottom: '6px', scrollbarWidth: 'none' }} className="hide-scrollbar">
        {tabs.map(tab => (
          <button
            key={tab.mode}
            type="button"
            onClick={() => setFilterMode(tab.mode)}
            style={{
              background: filterMode === tab.mode ? `rgba(${tab.mode === 'in_work' ? '16,185,129' : tab.mode === 'waiting' ? '245,158,11' : ACCENT_RGB}, 0.12)` : 'var(--surface-2)',
              color: filterMode === tab.mode ? tab.color : 'var(--text-muted)',
              border: `1px solid ${filterMode === tab.mode ? tab.color + '40' : 'var(--border-subtle)'}`,
              padding: '8px 16px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 800, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s', flexShrink: 0
            }}
          >
            {tab.label}
            <span style={{
              background: filterMode === tab.mode ? tab.color : 'var(--surface-3)',
              color: filterMode === tab.mode ? '#000' : 'var(--text-muted)',
              borderRadius: '6px', padding: '1px 6px', fontSize: '0.68rem', fontWeight: 900
            }}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>
      <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>Буфер Сортування → Цех №2</div>
    </div>
  )
}
