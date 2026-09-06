import React from 'react'

export function MasterQuickPlanModal({
  quickPlanOrder,
  setQuickPlanOrder,
  tempSets,
  setTempSets,
  tempDeadline,
  setTempDeadline,
  handleOpenNaryadModal
}) {
  if (!quickPlanOrder) return null

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', backdropFilter: 'blur(4px)' }}>
      <div className="glass-panel" style={{ background: '#0d0d0d', border: '1px solid #222', borderRadius: '24px', padding: '30px', width: '100%', maxWidth: '420px', boxShadow: '0 20px 50px rgba(0,0,0,0.6)' }}>
        <h3 style={{ margin: '0 0 10px', color: '#fff', fontSize: '1.2rem', fontWeight: 900 }}>ПАРАМЕТРИ ПАРТІЇ</h3>
        <div style={{ color: '#888', fontSize: '0.8rem', marginBottom: '20px' }}>Замовлення №{quickPlanOrder.order_num} ({quickPlanOrder.customer})</div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', color: '#666', fontSize: '0.7rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '8px' }}>Кількість комплектів / виробів</label>
          <input
            type="number"
            value={tempSets}
            onChange={e => setTempSets(e.target.value)}
            style={{ width: '100%', background: '#000', border: '1px solid #333', color: '#ff9000', padding: '12px', borderRadius: '12px', fontSize: '1.2rem', fontWeight: 900, outline: 'none' }}
          />
        </div>

        <div style={{ marginBottom: '25px' }}>
          <label style={{ display: 'block', color: '#666', fontSize: '0.7rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '8px' }}>Дедлайн партії</label>
          <input
            type="date"
            value={tempDeadline ? tempDeadline.split('T')[0] : ''}
            onChange={e => setTempDeadline(e.target.value)}
            style={{ width: '100%', background: '#000', border: '1px solid #333', color: '#fff', padding: '12px', borderRadius: '12px', fontSize: '0.9rem', fontWeight: 700, outline: 'none' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => setQuickPlanOrder(null)}
            style={{ flex: 1, padding: '12px', background: '#1a1a1a', border: '1px solid #333', color: '#888', borderRadius: '12px', fontWeight: 900, cursor: 'pointer' }}
          >
            СКАСУВАТИ
          </button>
          <button
            onClick={() => {
              handleOpenNaryadModal(quickPlanOrder, tempSets, tempDeadline);
              setQuickPlanOrder(null);
            }}
            style={{ flex: 2, padding: '12px', background: '#ff9000', border: 'none', color: '#000', borderRadius: '12px', fontWeight: 950, cursor: 'pointer', fontSize: '0.9rem' }}
          >
            ПЕРЕДАТИ В НАРАД
          </button>
        </div>
      </div>
    </div>
  )
}
