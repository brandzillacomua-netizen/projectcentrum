import React from 'react'

export default function TumblingTerminalFilters({
  filterMode,
  setFilterMode,
  subStageFilter,
  setSubStageFilter,
  waitingCards,
  inWorkCards,
  getNextTumblingOperation
}) {
  return (
    <div style={{ padding: '18px 24px', background: 'rgba(255,255,255,0.01)', borderBottom: '1px solid var(--glass-border, rgba(255,255,255,0.03))', display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', maxWidth: '100%', paddingBottom: '6px', scrollbarWidth: 'none' }} className="hide-scrollbar">
          {[
            { mode: 'all', label: 'Усі картки', count: waitingCards.length + inWorkCards.length, color: '#06b6d4' },
            { mode: 'waiting', label: 'В очікуванні', count: waitingCards.length, color: '#f59e0b' },
            { mode: 'in_work', label: 'У роботі', count: inWorkCards.length, color: '#10b981' }
          ].map(tab => (
            <button
              key={tab.mode}
              type="button"
              onClick={() => setFilterMode(tab.mode)}
              style={{
                background: filterMode === tab.mode ? `rgba(${tab.mode === 'in_work' ? '16,185,129' : tab.mode === 'waiting' ? '245,158,11' : '6,182,214'}, 0.12)` : 'var(--card-bg, #121216)',
                color: filterMode === tab.mode ? tab.color : 'var(--text-muted, #888)',
                border: `1px solid ${filterMode === tab.mode ? tab.color + '40' : 'var(--glass-border, rgba(255,255,255,0.04))'}`,
                padding: '8px 16px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s', flexShrink: 0
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

        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #555)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Картки на терміналі
        </div>
      </div>

      {/* Sub-stages filters */}
      <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px', scrollbarWidth: 'none' }} className="hide-scrollbar">
        {[
          { id: 'all', label: 'Усі під-етапи', count: waitingCards.length + inWorkCards.length },
          { id: 'вибростил', label: '1 - Вібростіл', count: waitingCards.filter(c => (c.status === 'new' ? c.operation : getNextTumblingOperation(c.operation)) === 'Галтовка (Вібростіл)').length + inWorkCards.filter(c => c.operation === 'Галтовка (Вібростіл)').length },
          { id: 'мийка', label: '2 - Мийка', count: waitingCards.filter(c => (c.status === 'new' ? c.operation : getNextTumblingOperation(c.operation)) === 'Галтовка (Мийка)').length + inWorkCards.filter(c => c.operation === 'Галтовка (Мийка)').length },
          { id: 'галтовка', label: '3 - Галтовка', count: waitingCards.filter(c => (c.status === 'new' ? c.operation : getNextTumblingOperation(c.operation)) === 'Галтовка (Галтовка)').length + inWorkCards.filter(c => c.operation === 'Галтовка (Галтовка)').length },
          { id: 'сушка', label: '4 - Сушка', count: waitingCards.filter(c => (c.status === 'new' ? c.operation : getNextTumblingOperation(c.operation)) === 'Галтовка (Сушка)').length + inWorkCards.filter(c => c.operation === 'Галтовка (Сушка)').length }
        ].map(sub => (
          <button
            key={sub.id}
            type="button"
            onClick={() => setSubStageFilter(sub.id)}
            style={{
              background: subStageFilter === sub.id ? 'rgba(6,182,212,0.12)' : 'var(--card-bg, #121216)',
              color: subStageFilter === sub.id ? '#06b6d4' : 'var(--text-muted, #888)',
              border: `1px solid ${subStageFilter === sub.id ? 'rgba(6,182,212,0.4)' : 'var(--glass-border, rgba(255,255,255,0.04))'}`,
              padding: '6px 14px', borderRadius: '10px', fontSize: '0.72rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.15s', flexShrink: 0
            }}
          >
            {sub.label}
            <span style={{
              background: subStageFilter === sub.id ? '#06b6d4' : 'var(--bg, #222)',
              color: subStageFilter === sub.id ? '#000' : 'var(--text-muted, #888)',
              borderRadius: '5px', padding: '1px 5px', fontSize: '0.62rem', fontWeight: 900
            }}>
              {sub.count}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
