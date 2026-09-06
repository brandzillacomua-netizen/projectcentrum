import React from 'react'
import { Clock, AlertTriangle } from 'lucide-react'

export const MachineMonitorView = ({ machineMonitorList }) => {
  return (
    <div className="machine-monitor-view" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <h2 className="shop1-section-title" style={{ fontSize: '1.05rem', fontWeight: 900, color: '#888', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
        🔌 СТАТУС ВЕРСТАТІВ ТА ОБЛАДНАННЯ
      </h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '20px' }}>
        {machineMonitorList.map(({ machine, activeCard, nomenclature }) => {
          const isPaused = activeCard?.status === 'paused'
          const isWorking = activeCard?.status === 'in-progress'
          const pauseReason = isPaused
            ? activeCard.card_info?.match(/\[PAUSED:([^\]]+)\]/)?.[1] || 'Причина не вказана'
            : null
          const start = activeCard?.started_at ? new Date(activeCard.started_at) : null
          const runningMins = start ? Math.max(0, Math.floor((Date.now() - start.getTime()) / 60000)) : 0

          return (
            <div key={machine.id} className={`machine-card ${isWorking ? 'working' : isPaused ? 'paused' : 'idle'}`} style={{
              borderRadius: '24px',
              padding: '22px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '15px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 className="machine-name" style={{ margin: 0, fontSize: '0.95rem', fontWeight: 900 }}>{machine.name}</h3>
                  <span className="machine-meta" style={{ fontSize: '0.65rem', fontWeight: 800 }}>№ {machine.sequence_number || '—'} | Інв. {machine.inventory_no || '—'}</span>
                </div>
                <span className={`machine-status-badge ${isWorking ? 'working' : isPaused ? 'paused' : 'idle'}`} style={{
                  fontSize: '0.65rem',
                  fontWeight: 900,
                  padding: '4px 10px',
                  borderRadius: '8px',
                  textTransform: 'uppercase'
                }}>
                  {isWorking ? '● В роботі' : isPaused ? '🛑 На паузі' : '⚪ Вільний'}
                </span>
              </div>

              {(isWorking || isPaused) && activeCard ? (
                <div className="active-card-box" style={{ padding: '12px 14px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div>
                    <div className="card-task-label" style={{ fontSize: '0.55rem', fontWeight: 900, textTransform: 'uppercase' }}>Поточне завдання</div>
                    <div className="card-detail-name" style={{ fontSize: '0.82rem', fontWeight: 800, marginTop: '2px' }}>{nomenclature?.name || 'Деталь'}</div>
                    <div className="card-number-tag" style={{ fontSize: '0.65rem', marginTop: '2px' }}>Картка #{activeCard.id?.slice(-8).toUpperCase()}</div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '8px' }}>
                    <div>
                      <span className="card-field-label" style={{ fontSize: '0.55rem', display: 'block', fontWeight: 800 }}>ОПЕРАТОР</span>
                      <span className="card-field-val" style={{ fontSize: '0.72rem', fontWeight: 700 }}>{activeCard.operator_name || 'Невідомо'}</span>
                    </div>
                    <div>
                      <span className="card-field-label" style={{ fontSize: '0.55rem', display: 'block', fontWeight: 800 }}>КІЛЬКІСТЬ</span>
                      <span className="card-field-val" style={{ fontSize: '0.72rem', fontWeight: 700 }}>{activeCard.quantity} шт</span>
                    </div>
                  </div>

                  {isPaused && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(239,68,68,0.04)', border: '1px dashed rgba(239,68,68,0.2)', padding: '8px 10px', borderRadius: '8px', marginTop: '4px' }}>
                      <AlertTriangle size={14} color="#ef4444" style={{ flexShrink: 0 }} />
                      <div style={{ fontSize: '0.68rem', color: '#f87171', fontWeight: 700 }}>
                        Простій: {pauseReason}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="machine-idle-text" style={{ fontSize: '0.78rem', fontStyle: 'italic', padding: '10px 0' }}>Верстат зараз не активний</div>
              )}

              <div className="machine-card-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '12px', fontSize: '0.7rem' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Clock size={12} /> {activeCard ? `В роботі: ${runningMins} хв` : 'Очікує запуску'}
                </span>
                <span>{activeCard?.shift_name || 'Без зміни'}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
