import React from 'react'
import { X } from 'lucide-react'

export const PreparationCompleteModal = ({
  showCompleteModal,
  onClose,
  currentSubTask,
  completeQty,
  setCompleteQty,
  scrapQty,
  setScrapQty,
  scrapReason,
  setScrapReason,
  isProcessing,
  onSubmitCompletion
}) => {
  if (!showCompleteModal || !currentSubTask) return null

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: '#0a0a0a', width: '100%', maxWidth: '500px', borderRadius: '24px', border: '1px solid #333', padding: '30px', position: 'relative' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: '20px', right: '20px', background: 'transparent', border: 'none', color: '#555', cursor: 'pointer' }}>
          <X size={24} />
        </button>
        <h2 style={{ margin: '0 0 10px', fontSize: '1.8rem', color: '#10b981', fontWeight: 950 }}>ЗАКРИТТЯ ЗАДАЧІ</h2>
        <div style={{ fontSize: '1.1rem', color: '#ff9000', fontWeight: 800, marginBottom: '25px' }}>{currentSubTask.name}</div>

        <div style={{ marginBottom: '25px' }}>
          <label style={{ display: 'block', fontSize: '0.8rem', color: '#888', fontWeight: 900, marginBottom: '10px' }}>ГОТОВИХ ЛИСТІВ (ШТ)</label>
          <div style={{ width: '100%', background: '#111', border: '1px solid #333', color: '#fff', padding: '20px', borderRadius: '16px', fontSize: '2rem', fontWeight: 950, textAlign: 'center', boxSizing: 'border-box' }}>
            {completeQty}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '8px', textAlign: 'center' }}>
            Вираховується як: План ({currentSubTask.plan} шт) - Брак ({scrapQty} шт)
          </div>
        </div>

        <div style={{ marginBottom: '25px' }}>
          <label style={{ display: 'block', fontSize: '0.8rem', color: '#ef4444', fontWeight: 900, marginBottom: '10px' }}>БРАК (ШТ)</label>
          <input
            type="number"
            min="0"
            max={currentSubTask.plan}
            value={scrapQty === 0 ? '' : scrapQty}
            placeholder="0"
            onChange={e => {
              const val = e.target.value
              const parsed = val === '' ? 0 : Number(val)
              const num = Math.max(0, Math.min(currentSubTask.plan, isNaN(parsed) ? 0 : parsed))
              setScrapQty(num)
              setCompleteQty(currentSubTask.plan - num)
            }}
            style={{ width: '100%', background: '#111', border: '1px solid #ef4444', color: '#ef4444', padding: '20px', borderRadius: '16px', fontSize: '2rem', fontWeight: 950, textAlign: 'center', boxSizing: 'border-box' }}
          />
        </div>

        {scrapQty > 0 && (
          <div style={{ marginBottom: '30px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', color: '#ff9000', fontWeight: 900, marginBottom: '10px' }}>ПРИЧИНА БРАКУ (ОБОВ'ЯЗКОВО)</label>
            <input
              type="text"
              value={scrapReason}
              onChange={e => setScrapReason(e.target.value)}
              placeholder="Вкажіть причину браку..."
              style={{ width: '100%', background: '#111', border: '1px solid #ff9000', color: '#fff', padding: '15px', borderRadius: '16px', fontSize: '1rem', boxSizing: 'border-box' }}
              required
            />
          </div>
        )}

        <button
          disabled={isProcessing || (scrapQty > 0 && !scrapReason.trim())}
          onClick={onSubmitCompletion}
          style={{
            width: '100%', padding: '20px',
            background: scrapQty > 0 ? '#ff9000' : '#10b981',
            color: '#000', border: 'none', borderRadius: '16px',
            fontSize: '1.1rem', fontWeight: 950,
            cursor: (isProcessing || (scrapQty > 0 && !scrapReason.trim())) ? 'not-allowed' : 'pointer',
            opacity: (isProcessing || (scrapQty > 0 && !scrapReason.trim())) ? 0.7 : 1
          }}
        >
          {isProcessing ? 'ОБРОБКА...' : (scrapQty > 0 ? 'ПІДТВЕРДИТИ І ЗАПРОСИТИ НА СВ' : 'ПІДТВЕРДИТИ ТА ОПРИБУТКУВАТИ')}
        </button>
      </div>
    </div>
  )
}

export default PreparationCompleteModal
