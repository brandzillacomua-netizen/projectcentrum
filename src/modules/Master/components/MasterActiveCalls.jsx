import React from 'react'
import { Info, Play } from 'lucide-react'

export function MasterActiveCalls({
  activeCalls,
  handleResolveCall,
  machines
}) {
  if (activeCalls.length === 0) return null

  return (
    <div className="no-print" style={{ marginBottom: '25px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {activeCalls.map(c => {
        const m = machines?.find(mach => mach.id === c.machine_id)
        return (
          <div key={c.id} style={{
            background: 'linear-gradient(135deg, #ef444415, #ef444425)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            borderRadius: '16px',
            padding: '16px 20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '15px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Info size={20} color="#ef4444" />
              <div>
                <strong style={{ fontSize: '0.85rem', color: '#fff' }}>УВАГА: Терміновий виклик майстра!</strong>
                <div style={{ fontSize: '0.72rem', color: '#aaa', marginTop: '2px' }}>
                  Верстат: <strong>{m?.name || 'Невідомий'}</strong> {m?.sequence_number ? `№${m.sequence_number}` : ''} | Оператор: {c.operator_name || 'Не вказано'}
                </div>
              </div>
            </div>
            <button
              onClick={() => handleResolveCall(c.id)}
              style={{
                background: '#ef4444',
                color: '#fff',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '10px',
                fontSize: '0.72rem',
                fontWeight: 900,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Play size={12} /> ВИРІШИТИ
            </button>
          </div>
        )
      })}
    </div>
  )
}
