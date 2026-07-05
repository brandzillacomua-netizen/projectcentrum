import React from 'react'
import { X, AlertTriangle } from 'lucide-react'

export function Shop1MachineCallModal({
  machineCallModal,
  setMachineCallModal,
  machineCallSuccess,
  handleCreateCall,
  selectedCallMasterId,
  setSelectedCallMasterId,
  selectedCallEngineerId,
  setSelectedCallEngineerId,
  selectedCallQCId,
  setSelectedCallQCId,
  callMasters,
  callEngineers,
  callQCs
}) {
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.85)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '20px'
    }}>
      <div style={{
        background: '#141414',
        border: '1px solid #333',
        borderRadius: '24px',
        width: '100%',
        maxWidth: '450px',
        padding: '30px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
        position: 'relative'
      }}>
        <button 
          onClick={() => setMachineCallModal(null)}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: 'none',
            border: 'none',
            color: '#888',
            cursor: 'pointer',
            padding: '5px'
          }}
        >
          <X size={24} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '25px' }}>
          <div style={{ background: '#ef444415', padding: '12px', borderRadius: '16px', color: '#ef4444' }}>
            <AlertTriangle size={32} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: '#fff' }}>
              {machineCallModal.type}
            </h3>
            <p style={{ margin: '4px 0 0 0', color: '#f59e0b', fontWeight: 800, fontSize: '0.95rem' }}>
              Пор. №{machineCallModal.sequence_number || '—'} 
              {machineCallModal.inventory_no ? ` | Інв. ${machineCallModal.inventory_no}` : ''}
              {machineCallModal.floor ? ` | Поверх ${machineCallModal.floor}` : ''}
            </p>
          </div>
        </div>

        {machineCallSuccess ? (
          <div style={{
            background: '#10b98115',
            border: '1px solid #10b98130',
            color: '#10b981',
            padding: '20px',
            borderRadius: '16px',
            textAlign: 'center',
            fontWeight: 800,
            fontSize: '1.1rem',
            margin: '20px 0'
          }}>
            {machineCallSuccess}
          </div>
        ) : (
          <>
            <p style={{ color: '#aaa', fontSize: '0.9rem', marginBottom: '20px', lineHeight: '1.5' }}>
              Оберіть кого саме викликати до верстату. Виклик з'явиться на дашборді майстра та інженерів в реальному часі.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Master Call */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <button
                  onClick={() => handleCreateCall('master', selectedCallMasterId)}
                  style={{
                    background: '#f59e0b',
                    color: '#000',
                    border: 'none',
                    padding: '16px',
                    borderRadius: '16px',
                    fontSize: '1.1rem',
                    fontWeight: 900,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    boxShadow: '0 4px 12px rgba(245,158,11,0.2)',
                    width: '100%'
                  }}
                >
                  <span>ВИКЛИКАТИ МАЙСТРА</span>
                </button>
                <select
                  value={selectedCallMasterId}
                  onChange={e => setSelectedCallMasterId(e.target.value)}
                  style={{
                    background: '#18181b',
                    border: '1px solid #27272a',
                    borderRadius: '10px',
                    color: '#fff',
                    padding: '10px',
                    fontSize: '0.9rem',
                    outline: 'none'
                  }}
                >
                  <option value="">-- Всі майстри (Загальний виклик) --</option>
                  {callMasters.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.first_name || ''} {u.last_name || ''} {u.position ? ` (${u.position})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Engineer Call */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <button
                  onClick={() => handleCreateCall('engineer', selectedCallEngineerId)}
                  style={{
                    background: '#3b82f6',
                    color: '#fff',
                    border: 'none',
                    padding: '16px',
                    borderRadius: '16px',
                    fontSize: '1.1rem',
                    fontWeight: 900,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    boxShadow: '0 4px 12px rgba(59,130,246,0.2)',
                    width: '100%'
                  }}
                >
                  <span>ВИКЛИКАТИ ІНЖЕНЕРА</span>
                </button>
                <select
                  value={selectedCallEngineerId}
                  onChange={e => setSelectedCallEngineerId(e.target.value)}
                  style={{
                    background: '#18181b',
                    border: '1px solid #27272a',
                    borderRadius: '10px',
                    color: '#fff',
                    padding: '10px',
                    fontSize: '0.9rem',
                    outline: 'none'
                  }}
                >
                  <option value="">-- Всі інженери (Загальний виклик) --</option>
                  {callEngineers.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.first_name || ''} {u.last_name || ''} {u.position ? ` (${u.position})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* QC Call */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <button
                  onClick={() => handleCreateCall('qc', selectedCallQCId)}
                  style={{
                    background: '#ef4444',
                    color: '#fff',
                    border: 'none',
                    padding: '16px',
                    borderRadius: '16px',
                    fontSize: '1.1rem',
                    fontWeight: 900,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    boxShadow: '0 4px 12px rgba(239,68,68,0.2)',
                    width: '100%'
                  }}
                >
                  <span>ВИКЛИКАТИ ВКЯ</span>
                </button>
                <select
                  value={selectedCallQCId}
                  onChange={e => setSelectedCallQCId(e.target.value)}
                  style={{
                    background: '#18181b',
                    border: '1px solid #27272a',
                    borderRadius: '10px',
                    color: '#fff',
                    padding: '10px',
                    fontSize: '0.9rem',
                    outline: 'none'
                  }}
                >
                  <option value="">-- Всі фахівці ВКЯ (Загальний виклик) --</option>
                  {callQCs.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.first_name || ''} {u.last_name || ''} {u.position ? ` (${u.position})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
