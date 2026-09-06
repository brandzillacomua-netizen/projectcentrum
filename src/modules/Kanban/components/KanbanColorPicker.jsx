import React from 'react'
import { CARD_COLORS } from '../utils/kanbanHelpers'

export const ColorPicker = ({ value, onChange }) => (
  <div className="form-group">
    <label>Колір плашки (ліва смужка картки)</label>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px', alignItems: 'center' }}>
      {CARD_COLORS.map(c => (
        <button
          key={c.id}
          type="button"
          title={c.label}
          onClick={() => onChange(c.id)}
          style={{
            width: c.id ? '28px' : 'auto',
            height: '28px',
            padding: c.id ? 0 : '0 12px',
            borderRadius: c.id ? '50%' : '8px',
            background: c.id || '#1a1a1a',
            border: value === c.id ? '2.5px solid #fff' : '2px solid transparent',
            outline: value === c.id ? '2px solid rgba(255,255,255,0.2)' : 'none',
            outlineOffset: '2px',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.65rem', color: '#888', fontWeight: 800,
            boxShadow: value === c.id && c.id ? `0 0 10px ${c.id}66` : 'none',
            transition: 'all 0.15s',
          }}
        >
          {value === c.id && c.id && <span style={{ color: '#000', fontSize: '11px', fontWeight: 900 }}>✓</span>}
          {!c.id && (value === c.id ? '✓ Авто' : 'Авто')}
        </button>
      ))}
    </div>
  </div>
)
