import { useState } from 'react'
import { CheckCircle2, X } from 'lucide-react'

export default function ReturnToRouteModal({ item, saving = false, onClose, onConfirm }) {
  const [quantity, setQuantity] = useState('')
  const maxQuantity = Math.max(0, Number(item?.total_qty) || 0)

  if (!item) return null

  const numericQuantity = Number(quantity)
  const isValid = Number.isInteger(numericQuantity) && numericQuantity > 0 && numericQuantity <= maxQuantity

  return (
    <div onClick={() => !saving && onClose()} style={{ position: 'fixed', inset: 0, zIndex: 10070, background: 'rgba(0,0,0,.9)', display: 'grid', placeItems: 'center', padding: 20 }}>
      <div onClick={event => event.stopPropagation()} style={{ width: '100%', maxWidth: 520, background: '#0d0d0d', border: '1px solid #10b98155', borderRadius: 24, padding: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <div style={{ color: '#10b981', fontSize: '.7rem', fontWeight: 1000 }}>ПОВЕРНЕННЯ ПРИДАТНИХ ДЕТАЛЕЙ З ВКЯ</div>
            <h2 style={{ margin: '8px 0 5px' }}>{item.name}</h2>
            <div style={{ color: '#777', fontSize: '.8rem' }}>Наряд №{item.naryad_number || '—'} · доступно {maxQuantity} {item.unit || 'шт'}</div>
          </div>
          <button onClick={onClose} disabled={saving} style={{ alignSelf: 'flex-start', background: 'transparent', border: 0, color: '#777', cursor: 'pointer' }}><X size={22} /></button>
        </div>

        <label style={{ display: 'block', margin: '24px 0 8px', color: '#10b981', fontSize: '.7rem', fontWeight: 1000 }}>СКІЛЬКИ ПРИДАТНИХ ДЕТАЛЕЙ ПОВЕРНУТИ В НАРЯД?</label>
        <input autoFocus type="number" min="1" max={maxQuantity} value={quantity} onChange={event => setQuantity(event.target.value)} placeholder={`Від 1 до ${maxQuantity}`} style={{ boxSizing: 'border-box', width: '100%', background: '#050505', border: '1px solid #333', borderRadius: 12, color: '#fff', padding: 14, fontSize: '1.1rem', fontWeight: 900 }} />
        <div style={{ color: '#64748b', fontSize: '.7rem', lineHeight: 1.5, marginTop: 10 }}>
          Система поверне кількість у початковий наряд на правильний етап. Вона знову стане доступною виробничому маршруту й не потрапить у БЗ, якщо збережено походження картки.
        </div>
        <button onClick={() => onConfirm(numericQuantity)} disabled={saving || !isValid} style={{ width: '100%', marginTop: 24, background: '#10b981', border: 0, color: '#00150e', borderRadius: 13, padding: 15, fontWeight: 1000, cursor: 'pointer', opacity: saving || !isValid ? .5 : 1 }}>
          <CheckCircle2 size={17} style={{ verticalAlign: 'middle', marginRight: 7 }} />
          {saving ? 'ПОВЕРНЕННЯ...' : 'ПОВЕРНУТИ В НАРЯД'}
        </button>
      </div>
    </div>
  )
}
