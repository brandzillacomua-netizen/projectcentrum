import React, { useState, useEffect, useRef } from 'react'
import { ChevronDown, CheckCircle2 } from 'lucide-react'

export const CustomSelect = React.memo(({ value, onChange, options, placeholder = '— Обрати —', accent = '#ff9000' }) => {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const selected = options.find(o => o.value === value)

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} style={{ position: 'relative', userSelect: 'none' }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          padding: '12px 40px 12px 14px',
          background: value ? `rgba(${accent === '#ff9000' ? '255,144,0' : '168,85,247'},0.08)` : 'var(--card-inner-bg, rgba(255,255,255,0.04))',
          border: `1.5px solid ${value ? accent + '55' : 'var(--border-color, rgba(255,255,255,0.08))'}`,
          borderRadius: '12px',
          color: value ? 'var(--text, #fff)' : 'var(--text-secondary, #555)',
          fontSize: '0.85rem',
          fontWeight: 700,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          transition: 'all 0.2s',
        }}
      >
        {selected?.icon && <span>{selected.icon}</span>}
        <span style={{ flex: 1 }}>{selected ? selected.label : placeholder}</span>
        <ChevronDown size={14} color={accent} style={{ position: 'absolute', right: '12px', top: '50%', transform: `translateY(-50%) rotate(${open ? 180 : 0}deg)`, transition: '0.2s', flexShrink: 0 }} />
      </div>

      {open && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 6px)',
          left: 0, right: 0,
          background: 'var(--card-bg, #111827)',
          border: `1px solid ${accent}33`,
          borderRadius: '14px',
          zIndex: 999,
          overflow: 'hidden',
          boxShadow: `0 12px 40px rgba(0,0,0,0.7), 0 0 0 1px ${accent}22`,
        }}>
          {options.map(opt => (
            <div
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false) }}
              style={{
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                cursor: 'pointer',
                background: value === opt.value ? `${accent}18` : 'transparent',
                color: value === opt.value ? 'var(--text, #fff)' : 'var(--text-secondary, #aaa)',
                fontSize: '0.85rem',
                fontWeight: value === opt.value ? 800 : 600,
                borderLeft: value === opt.value ? `3px solid ${accent}` : '3px solid transparent',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { if (value !== opt.value) { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'var(--text, #fff)' } }}
              onMouseLeave={e => { if (value !== opt.value) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary, #aaa)' } }}
            >
              {opt.icon && <span style={{ fontSize: '1rem' }}>{opt.icon}</span>}
              <span>{opt.label}</span>
              {value === opt.value && <CheckCircle2 size={14} color={accent} style={{ marginLeft: 'auto' }} />}
            </div>
          ))}
        </div>
      )}
    </div>
  )
})

export default CustomSelect
