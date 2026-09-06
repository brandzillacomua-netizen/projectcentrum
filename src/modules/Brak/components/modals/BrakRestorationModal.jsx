import React from 'react'
import { X } from 'lucide-react'

export const BrakRestorationModal = React.memo(({
  restorationDraft,
  setRestorationDraft,
  restorationQuantity,
  setRestorationQuantity,
  restorationStageId,
  setRestorationStageId,
  restorationStages = [],
  isProcessing,
  handleSendToRestoration
}) => {
  if (!restorationDraft) return null

  const isFormValid = !isProcessing && restorationStageId && Number.isInteger(Number(restorationQuantity)) && Number(restorationQuantity) > 0 && Number(restorationQuantity) <= Number(restorationDraft.total_qty)

  return (
    <div onClick={() => !isProcessing && setRestorationDraft(null)} style={{ position: 'fixed', inset: 0, zIndex: 10060, background: 'rgba(0,0,0,0.88)', display: 'grid', placeItems: 'center', padding: '20px' }}>
      <div onClick={event => event.stopPropagation()} style={{ width: '100%', maxWidth: '520px', background: 'var(--modal-bg, #0d0d0d)', border: '1px solid #06b6d455', borderRadius: '24px', padding: '28px', boxShadow: '0 30px 90px rgba(0,0,0,.7)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '15px' }}>
          <div>
            <div style={{ color: '#06b6d4', fontSize: '.7rem', fontWeight: 1000 }}>НОВА КАРТА ВІДНОВЛЕННЯ</div>
            <h2 style={{ margin: '8px 0 5px', overflowWrap: 'anywhere', color: 'var(--text-color, #fff)' }}>{restorationDraft.name}</h2>
            <div style={{ color: 'var(--text-muted, #777)', fontSize: '.8rem' }}>Доступно: {restorationDraft.total_qty} {restorationDraft.unit || 'шт'}</div>
          </div>
          <button onClick={() => setRestorationDraft(null)} disabled={isProcessing} style={{ alignSelf: 'flex-start', background: 'transparent', border: 0, color: 'var(--text-muted, #777)', cursor: 'pointer' }}>
            <X size={22}/>
          </button>
        </div>
        <label style={{ display: 'block', margin: '24px 0 8px', color: 'var(--text-muted, #888)', fontSize: '.7rem', fontWeight: 950 }}>КІЛЬКІСТЬ НА ВІДНОВЛЕННЯ</label>
        <input 
          autoFocus 
          type="number" 
          min="1" 
          max={restorationDraft.total_qty} 
          value={restorationQuantity} 
          onChange={event => setRestorationQuantity(event.target.value)} 
          placeholder={`Від 1 до ${restorationDraft.total_qty}`} 
          style={{ boxSizing: 'border-box', width: '100%', background: 'var(--card-inner-bg, #050505)', border: '1px solid var(--border-color, #333)', borderRadius: '12px', color: 'var(--text-color, #fff)', padding: '14px', fontSize: '1.1rem', fontWeight: 900, outline: 'none' }} 
        />
        <label style={{ display: 'block', margin: '18px 0 8px', color: 'var(--text-muted, #888)', fontSize: '.7rem', fontWeight: 950 }}>ЕТАП ВІДНОВЛЕННЯ</label>
        <select 
          value={restorationStageId} 
          onChange={event => setRestorationStageId(event.target.value)} 
          style={{ boxSizing: 'border-box', width: '100%', background: 'var(--card-inner-bg, #050505)', border: '1px solid var(--border-color, #333)', borderRadius: '12px', color: 'var(--text-color, #fff)', padding: '14px', fontWeight: 850, outline: 'none' }}
        >
          <option value="">Оберіть етап відновлення</option>
          {restorationStages.map(stage => <option key={stage.id} value={stage.id}>{stage.name}</option>)}
        </select>
        <div style={{ color: 'var(--text-muted, #555)', fontSize: '.68rem', marginTop: '8px' }}>Список етапів редагується у підмодулі «Налаштування ВКЯ». У категорії залишиться невибрана кількість.</div>
        <button 
          onClick={handleSendToRestoration} 
          disabled={!isFormValid} 
          style={{ width: '100%', marginTop: '24px', background: '#06b6d4', border: 0, color: '#001014', borderRadius: '13px', padding: '15px', fontWeight: 1000, cursor: isFormValid ? 'pointer' : 'not-allowed', opacity: isFormValid ? 1 : 0.5 }}
        >
          {isProcessing ? 'СТВОРЕННЯ...' : 'СТВОРИТИ КАРТУ ВІДНОВЛЕННЯ'}
        </button>
      </div>
    </div>
  )
})
