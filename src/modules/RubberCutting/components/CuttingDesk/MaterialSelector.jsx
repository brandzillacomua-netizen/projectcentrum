import React from 'react';
import { Layers, CheckCircle2, AlertCircle } from 'lucide-react';
import { ACCENT_RUBBER, ACCENT_RUBBER_RGB, RAW_SHEETS } from '../../utils/rubberConstants';

export function MaterialSelector({ selectedThickness, setSelectedThickness, rawStock = {} }) {
  return (
    <div style={{
      background: '#0d0d12',
      borderRadius: '18px',
      border: '1px solid var(--border-subtle, rgba(255,255,255,0.08))',
      padding: '18px 20px',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Layers size={18} color={ACCENT_RUBBER} />
          <span style={{ fontSize: '0.8rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#fff' }}>
            1. Вибір вхідного листа гуми (Склад СВ)
          </span>
        </div>
        <span style={{ fontSize: '0.7rem', color: 'var(--text-dim, #64748b)', fontWeight: 700 }}>
          Формат листів: 500×500 мм
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
        {RAW_SHEETS.map(sheet => {
          const isSelected = selectedThickness === sheet.thickness;
          const availableQty = rawStock[sheet.code] || 0;
          const isLowStock = availableQty < 5;

          return (
            <div
              key={sheet.code}
              onClick={() => setSelectedThickness(sheet.thickness)}
              style={{
                cursor: 'pointer',
                borderRadius: '14px',
                padding: '16px',
                border: isSelected ? `2px solid ${ACCENT_RUBBER}` : '1px solid rgba(255,255,255,0.08)',
                background: isSelected ? `rgba(${ACCENT_RUBBER_RGB}, 0.08)` : '#13131a',
                transition: 'all 0.15s ease',
                position: 'relative'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      background: isSelected ? ACCENT_RUBBER : 'rgba(255,255,255,0.1)',
                      color: isSelected ? '#000' : '#fff',
                      fontWeight: 950,
                      fontSize: '0.82rem',
                      padding: '2px 8px',
                      borderRadius: '6px'
                    }}>
                      {sheet.thickness} мм
                    </span>
                    <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#d97706', fontWeight: 800 }}>
                      {sheet.code}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 800, marginTop: '8px', color: '#fff' }}>
                    {sheet.name}
                  </div>
                </div>

                {isSelected ? (
                  <CheckCircle2 size={20} color={ACCENT_RUBBER} />
                ) : (
                  <div style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.2)' }} />
                )}
              </div>

              {/* Stock info */}
              <div style={{
                marginTop: '12px',
                paddingTop: '10px',
                borderTop: '1px solid rgba(255,255,255,0.06)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '0.75rem'
              }}>
                <span style={{ color: 'var(--text-dim, #64748b)', fontWeight: 600 }}>
                  Доступно на СВ:
                </span>
                <span style={{
                  color: isLowStock ? '#ef4444' : '#10b981',
                  fontWeight: 900,
                  fontSize: '0.85rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  {isLowStock && <AlertCircle size={14} />}
                  {availableQty} шт
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

