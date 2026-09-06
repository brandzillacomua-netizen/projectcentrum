import React from 'react'

export const BrakMachineCallsWidget = React.memo(({
  activeCalls = [],
  machines = [],
  currentUser,
  handleResolveCall
}) => {
  if (activeCalls.length === 0) return null

  return (
    <div style={{ background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.15)', borderRadius: '16px', padding: '15px 20px', marginBottom: '25px' }}>
      <h3 style={{ margin: '0 0 12px 0', fontSize: '0.85rem', fontWeight: 900, color: '#ef4444', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span className="pulse-indicator" style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444', boxShadow: '0 0 8px #ef4444' }} />
        АКТИВНІ ВИКЛИКИ ДО ВЕРСТАТІВ ({activeCalls.length})
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {activeCalls.map(c => {
          const mach = machines?.find(m => m.id === c.machine_id)
          return (
            <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--card-bg, #111)', border: '1px solid var(--border-color, #222)', borderRadius: '12px', padding: '12px 15px', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-color, #fff)' }}>
                  {mach ? mach.name : 'Верстат'} (пор. №{mach?.sequence_number || '—'})
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #888)', marginTop: '2px' }}>
                  Локація: {mach?.floor || '—'} поверх | Викликав: {c.operator_name || 'Оператор'}
                  {c.called_employee_name && <span style={{ color: '#8b5cf6', fontWeight: 800 }}> | Цільовий для: {c.called_employee_name}</span>}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #666)', fontWeight: 700 }}>
                  {new Date(c.created_at).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}
                </span>
                <button 
                  onClick={() => handleResolveCall(c.id)}
                  style={{ background: '#10b981', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 16px', fontWeight: 800, fontSize: '0.8rem', cursor: 'pointer' }}
                >
                  Я йду
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
})
