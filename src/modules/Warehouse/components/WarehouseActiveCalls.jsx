import React from 'react'
import { useMES } from '../../../MESContext'

export function WarehouseActiveCalls({ activeCalls, handleResolveCall }) {
  const { machines } = useMES()

  if (!activeCalls || activeCalls.length === 0) return null

  return (
    <div style={{ background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.15)', borderRadius: '16px', padding: '15px 20px', marginBottom: '20px' }}>
      <h3 style={{ margin: '0 0 12px 0', fontSize: '0.85rem', fontWeight: 900, color: '#ef4444' }}>
        🔴 АКТИВНІ ВИКЛИКИ ДО ВЕРСТАТІВ ({activeCalls.length})
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {activeCalls.map(c => {
          const mach = machines?.find(m => m.id === c.machine_id)
          return (
            <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#111', border: '1px solid #222', borderRadius: '12px', padding: '12px 15px' }}>
              <div>
                <div style={{ fontSize: '0.9rem', fontWeight: 800 }}>{mach ? mach.name : 'Верстат'} (№{mach?.sequence_number || '—'})</div>
                <div style={{ fontSize: '0.75rem', color: '#888' }}>Викликав: {c.operator_name || 'Оператор'}</div>
              </div>
              <button onClick={() => handleResolveCall(c.id)} style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 800 }}>ВИРІШИТИ</button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
