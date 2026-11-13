import React from 'react';
import { Search, Clock, Box, Check, Sparkles } from 'lucide-react';
import { ACCENT_RUBBER, ACCENT_RUBBER_RGB, formatDurationSec } from '../../utils/rubberConstants';

export function PartSelector({
  parts = [],
  selectedPart,
  setSelectedPart,
  partSearch,
  setPartSearch,
  selectedThickness
}) {
  return (
    <div style={{
      background: '#0d0d12',
      borderRadius: '18px',
      border: '1px solid var(--border-subtle, rgba(255,255,255,0.08))',
      padding: '18px 20px',
      display: 'flex',
      flexDirection: 'column',
      gap: '14px'
    }}>
      {/* Header & Search */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sparkles size={18} color={ACCENT_RUBBER} />
          <span style={{ fontSize: '0.8rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#fff' }}>
            2. Вибір деталі для розкрою ({parts.length} позицій {selectedThickness}мм)
          </span>
        </div>

        {/* Search */}
        <div style={{ position: 'relative', width: '240px' }}>
          <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
          <input
            type="text"
            placeholder="Пошук деталі чи розміру..."
            value={partSearch}
            onChange={e => setPartSearch(e.target.value)}
            style={{
              width: '100%',
              background: '#13131a',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '10px',
              padding: '7px 12px 7px 34px',
              color: '#fff',
              fontSize: '0.78rem',
              outline: 'none'
            }}
          />
        </div>
      </div>

      {/* Parts Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
        gap: '12px',
        maxHeight: '380px',
        overflowY: 'auto',
        paddingRight: '4px'
      }}>
        {parts.map(part => {
          const isSelected = selectedPart?.code === part.code || selectedPart?.name === part.name;
          const timeSec = part.sheet_cutting_time_sec || 0;
          const yieldPcs = part.sheet_yield || 1;

          return (
            <div
              key={part.code || part.name}
              onClick={() => setSelectedPart(part)}
              style={{
                cursor: 'pointer',
                borderRadius: '12px',
                padding: '14px',
                border: isSelected ? `2px solid ${ACCENT_RUBBER}` : '1px solid rgba(255,255,255,0.06)',
                background: isSelected ? `rgba(${ACCENT_RUBBER_RGB}, 0.12)` : '#13131a',
                transition: 'all 0.15s ease',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                position: 'relative'
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: '#d97706', fontWeight: 800 }}>
                    {part.code}
                  </span>
                  {isSelected && (
                    <span style={{
                      background: ACCENT_RUBBER,
                      color: '#000',
                      borderRadius: '50%',
                      width: 18,
                      height: 18,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <Check size={12} strokeWidth={3} />
                    </span>
                  )}
                </div>

                <div style={{ fontSize: '0.85rem', fontWeight: 900, color: '#fff', lineHeight: 1.3 }}>
                  {part.name}
                </div>
              </div>

              {/* Specs Badge Bar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
                <span style={{
                  background: 'rgba(16,185,129,0.12)',
                  border: '1px solid rgba(16,185,129,0.25)',
                  color: '#10b981',
                  padding: '2px 7px',
                  borderRadius: '6px',
                  fontSize: '0.72rem',
                  fontWeight: 900,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <Box size={11} /> {yieldPcs} шт/лист
                </span>

                {timeSec > 0 ? (
                  <span style={{
                    background: 'rgba(56,189,248,0.12)',
                    border: '1px solid rgba(56,189,248,0.25)',
                    color: '#38bdf8',
                    padding: '2px 7px',
                    borderRadius: '6px',
                    fontSize: '0.72rem',
                    fontWeight: 900,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    <Clock size={11} /> {formatDurationSec(timeSec)} ({part.item_cutting_time_sec}с/шт)
                  </span>
                ) : (
                  <span style={{
                    background: 'rgba(148,163,184,0.1)',
                    color: '#64748b',
                    padding: '2px 7px',
                    borderRadius: '6px',
                    fontSize: '0.7rem',
                    fontWeight: 700
                  }}>
                    час уточнюється
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

