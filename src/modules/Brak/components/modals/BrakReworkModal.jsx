import React from 'react'
import { X } from 'lucide-react'

export const BrakReworkModal = React.memo(({
  reworkDraft,
  setReworkDraft,
  reworkQuantity,
  setReworkQuantity,
  isProcessing,
  handleSendToRework
}) => {
  if (!reworkDraft) return null

  const isFormValid = !isProcessing && Number.isInteger(Number(reworkQuantity)) && Number(reworkQuantity) > 0 && Number(reworkQuantity) <= Number(reworkDraft.total_qty)

  return (
    <div onClick={() => !isProcessing && setReworkDraft(null)} style={{ position: 'fixed', inset: 0, zIndex: 10060, background: 'rgba(0,0,0,0.88)', display: 'grid', placeItems: 'center', padding: '20px' }}>
      <div onClick={event => event.stopPropagation()} style={{ width: '100%', maxWidth: '520px', background: 'var(--modal-bg, #0d0d0d)', border: '1px solid #10b98155', borderRadius: '24px', padding: '28px', boxShadow: '0 30px 90px rgba(0,0,0,.7)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '15px' }}>
          <div>
            <div style={{ color: '#10b981', fontSize: '.7rem', fontWeight: 1000 }}>НОВИЙ НАРЯД НА ДООПРАЦЮВАННЯ</div>
            <h2 style={{ margin: '8px 0 5px', overflowWrap: 'anywhere', color: 'var(--text-color, #fff)' }}>{reworkDraft.name}</h2>
            <div style={{ color: 'var(--text-muted, #777)', fontSize: '.8rem' }}>Доступно: {reworkDraft.total_qty} {reworkDraft.unit || 'шт'}</div>
          </div>
          <button onClick={() => setReworkDraft(null)} disabled={isProcessing} style={{ alignSelf: 'flex-start', background: 'transparent', border: 0, color: 'var(--text-muted, #777)', cursor: 'pointer' }}>
            <X size={22}/>
          </button>
        </div>
        <label style={{ display: 'block', margin: '24px 0 8px', color: 'var(--text-muted, #888)', fontSize: '.7rem', fontWeight: 950 }}>КІЛЬКІСТЬ НА ДООПРАЦЮВАННЯ</label>
        <input
          autoFocus
          type="number"
          min="1"
          max={reworkDraft.total_qty}
          value={reworkQuantity}
          onChange={event => setReworkQuantity(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Enter' && isFormValid) handleSendToRework()
          }}
          placeholder={`Від 1 до ${reworkDraft.total_qty}`}
          style={{ boxSizing: 'border-box', width: '100%', background: 'var(--card-inner-bg, #050505)', border: '1px solid var(--border-color, #333)', borderRadius: '12px', color: 'var(--text-color, #fff)', padding: '14px', fontSize: '1.1rem', fontWeight: 900, outline: 'none' }}
        />
        <div style={{ color: 'var(--text-muted, #555)', fontSize: '.68rem', marginTop: '8px' }}>У категорії залишиться невибрана кількість. Наряд буде створено лише на вказану кількість деталей.</div>
        <button
          onClick={handleSendToRework}
          disabled={!isFormValid}
          style={{ width: '100%', marginTop: '24px', background: '#10b981', border: 0, color: '#00150e', borderRadius: '13px', padding: '15px', fontWeight: 1000, cursor: isFormValid ? 'pointer' : 'not-allowed', opacity: isFormValid ? 1 : 0.5 }}
        >
          {isProcessing ? 'СТВОРЕННЯ...' : 'СТВОРИТИ НАРЯД НА ДООПРАЦЮВАННЯ'}
        </button>
      </div>
    </div>
  )
})
