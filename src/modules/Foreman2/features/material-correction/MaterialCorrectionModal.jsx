import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, X } from 'lucide-react'

export default function MaterialCorrectionModal({ part, options, isSaving, error, onClose, onSave }) {
  const [selectedId, setSelectedId] = useState('')
  useEffect(() => setSelectedId(''), [part?.nomId])
  if (!part) return null
  const selected = options.find(option => String(option.id) === selectedId)

  return createPortal(
    <div
      onMouseDown={event => event.target === event.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, zIndex: 60000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '18px', background: 'rgba(0,0,0,.88)', backdropFilter: 'blur(8px)' }}
    >
      <div role="dialog" aria-modal="true" aria-label="Виправити матеріал" style={{ width: 'min(560px, 94vw)', maxHeight: '90vh', overflowY: 'auto', background: '#111', border: '1px solid #333', borderRadius: '18px', padding: '22px', color: '#fff', boxShadow: '0 24px 70px rgba(0,0,0,.7)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '15px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.25rem' }}>Виправити матеріал</h3>
            <div style={{ color: '#777', marginTop: '5px', fontSize: '.8rem' }}>{part.name}</div>
          </div>
          <button type="button" onClick={onClose} disabled={isSaving} style={{ background: 'none', border: 0, color: '#777', cursor: 'pointer' }}><X /></button>
        </div>

        <div style={{ marginTop: '18px', padding: '12px', background: '#0a0a0a', borderRadius: '10px', fontSize: '.82rem' }}>
          Зараз: <strong style={{ color: '#ef4444' }}>{part.material || 'не вказано'}</strong>
          <span style={{ color: '#555' }}> · {part.plannedSheets} листів</span>
        </div>

        <label style={{ display: 'block', marginTop: '16px', color: '#888', fontSize: '.72rem', fontWeight: 900, textTransform: 'uppercase' }}>Правильний матеріал</label>
        <select value={selectedId} onChange={event => setSelectedId(event.target.value)} disabled={isSaving} style={{ width: '100%', marginTop: '7px', background: '#050505', color: '#fff', border: '1px solid #444', borderRadius: '9px', padding: '11px' }}>
          <option value="">Оберіть матеріал…</option>
          {options.map(option => <option key={option.id} value={String(option.id)}>{option.name} · на складі {option.available}</option>)}
        </select>

        <div style={{ display: 'flex', gap: '9px', marginTop: '14px', color: '#f59e0b', fontSize: '.72rem', lineHeight: 1.4 }}>
          <AlertTriangle size={17} style={{ flexShrink: 0 }} />
          Буде змінено план наряду і складську заявку. Інші деталі та робочі картки не видаляються.
        </div>
        {error && <div style={{ marginTop: '12px', color: '#ef4444', fontSize: '.78rem' }}>{error}</div>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
          <button type="button" onClick={onClose} disabled={isSaving} style={{ padding: '9px 15px', background: '#222', color: '#aaa', border: 0, borderRadius: '9px' }}>Скасувати</button>
          <button type="button" onClick={() => onSave(selected)} disabled={!selected || isSaving} style={{ padding: '9px 17px', background: selected && !isSaving ? '#3b82f6' : '#222', color: selected && !isSaving ? '#fff' : '#555', border: 0, borderRadius: '9px', fontWeight: 900 }}>
            {isSaving ? 'Зберігаю…' : 'Підтвердити виправлення'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
