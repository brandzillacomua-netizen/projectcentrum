import React, { useState, useEffect } from 'react'
import { Calendar, X } from 'lucide-react'

export const DeadlinePicker = ({ value, onChange, label = 'Дедлайн' }) => {
  const [open, setOpen] = useState(false)
  const [localDate, setLocalDate] = useState(value ? value.slice(0, 10) : '')
  const [localTime, setLocalTime] = useState(value && value.length > 10 ? value.slice(11, 16) : '09:00')

  useEffect(() => {
    setLocalDate(value ? value.slice(0, 10) : '')
    setLocalTime(value && value.length > 10 ? value.slice(11, 16) : '09:00')
  }, [value])

  const apply = (date, time) => {
    if (date) onChange(`${date}T${time || '09:00'}`)
    else onChange('')
  }

  const quickSet = (daysFromNow) => {
    const d = new Date()
    d.setDate(d.getDate() + daysFromNow)
    const date = d.toISOString().slice(0, 10)
    setLocalDate(date)
    apply(date, localTime || '09:00')
    setOpen(false)
  }

  const display = value
    ? new Date(value).toLocaleString('uk-UA', {
        day: 'numeric', month: 'short',
        ...(value.length > 10 ? { hour: '2-digit', minute: '2-digit' } : {})
      })
    : 'Не вказано'

  return (
    <div className="form-group" style={{ position: 'relative' }}>
      <label>{label}</label>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: '8px',
          background: value ? 'rgba(255,144,0,0.07)' : '#0d0d0d',
          border: value ? '1px solid rgba(255,144,0,0.25)' : '1px solid #1a1a1a',
          color: value ? '#ff9000' : '#444',
          padding: '9px 14px', borderRadius: '10px', cursor: 'pointer',
          fontSize: '0.82rem', fontWeight: 700, fontFamily: 'inherit', textAlign: 'left'
        }}
      >
        <Calendar size={14} />
        {display}
        {value && (
          <span
            onClick={e => { e.stopPropagation(); onChange(''); setLocalDate('') }}
            style={{ marginLeft: 'auto', color: '#555', cursor: 'pointer', lineHeight: 1, display: 'flex' }}
          >
            <X size={13} />
          </span>
        )}
      </button>
      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={() => setOpen(false)} />
          <div style={{
            position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 9999,
            background: '#0f0f0f', border: '1px solid #222', borderRadius: '14px',
            padding: '14px', boxShadow: '0 16px 50px rgba(0,0,0,0.7)'
          }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
              {[['Сьогодні', 0], ['Завтра', 1], ['+3 дні', 3], ['+7 днів', 7], ['+30 днів', 30]].map(([lbl, days]) => (
                <button
                  key={days}
                  type="button"
                  onClick={() => quickSet(days)}
                  style={{ background: 'rgba(255,144,0,0.08)', border: '1px solid rgba(255,144,0,0.2)', color: '#ff9000', padding: '5px 12px', borderRadius: '8px', fontSize: '0.72rem', fontWeight: 800, cursor: 'pointer' }}
                >
                  {lbl}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
              <input
                type="date"
                value={localDate}
                onChange={e => setLocalDate(e.target.value)}
                style={{ flex: 1, background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#fff', padding: '8px 10px', borderRadius: '8px', fontSize: '0.8rem', outline: 'none', fontFamily: 'inherit' }}
              />
              <input
                type="time"
                value={localTime}
                onChange={e => setLocalTime(e.target.value)}
                style={{ width: '100px', background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#fff', padding: '8px 10px', borderRadius: '8px', fontSize: '0.8rem', outline: 'none', fontFamily: 'inherit' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={() => { apply(localDate, localTime); setOpen(false) }}
                style={{ flex: 1, background: '#ff9000', border: 'none', color: '#000', padding: '8px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 900, cursor: 'pointer' }}
              >
                Зберегти
              </button>
              <button
                type="button"
                onClick={() => { onChange(''); setLocalDate(''); setOpen(false) }}
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid #2a2a2a', color: '#888', padding: '8px 14px', borderRadius: '8px', fontSize: '0.8rem', cursor: 'pointer' }}
              >
                Очистити
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
