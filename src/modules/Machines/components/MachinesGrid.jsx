import React from 'react'
import { ArrowLeft, Cpu, Edit3, Trash2, MapPin, AlertTriangle, Activity, BarChart3, Clock, User, Zap } from 'lucide-react'
import { MACHINE_TYPES } from '../hooks/useMachinesData.js'

export function MachinesGrid({
  machines,
  selectedType,
  setSelectedType,
  setSelectedMachineId,
  activeWorkForMachine,
  tasks,
  nomenclatures,
  currentTime,
  handleEdit,
  handleDelete,
  formatElapsed,
  formatPlanned
}) {
  return (
    <>
      <button 
        type="button"
        onClick={() => setSelectedType(null)} 
        className="machines-back-btn"
      >
        <ArrowLeft size={16} />
        <span>Назад до типів обладнання</span>
      </button>

      <div className="machines-cards-grid">
        {machines.filter(m => selectedType === 'Інші' ? !MACHINE_TYPES.includes(m.type) : m.type === selectedType).map(m => {
          const activeTask = activeWorkForMachine(m)
          const parentTask = activeTask ? tasks.find(t => String(t.id).trim() === String(activeTask.task_id).trim()) : null
          const nomName = nomenclatures.find(n => String(n.id) === String(activeTask?.nomenclature_id))?.name
          
          let estimatedMin = 0
          if (activeTask?.estimated_time) {
            estimatedMin = Math.round(Number(activeTask.estimated_time) / 60)
          } else if (parentTask?.estimated_time) {
            estimatedMin = Number(parentTask.estimated_time)
          } else if (activeTask?.quantity) {
            const nom = nomenclatures.find(n => String(n.id) === String(activeTask.nomenclature_id))
            if (nom?.time_per_unit) {
              estimatedMin = Math.round(Number(activeTask.quantity) * Number(nom.time_per_unit))
            }
          }

          const elapsedMs = activeTask ? (currentTime - new Date(activeTask.started_at)) : 0
          const elapsedMin = Math.floor(elapsedMs / 60000)
          const progressPercent = estimatedMin > 0 ? Math.min(100, (elapsedMin / estimatedMin) * 100) : 0
          
          return (
            <div
              key={m.id}
              className={`machine-card-v3 ${m.status === 'repair' ? 'is-repair' : m.status === 'maintenance_required' ? 'is-maintenance-req' : m.status === 'under_maintenance' ? 'is-under-maintenance' : activeTask ? 'is-busy' : 'is-idle'}`}
              onClick={() => setSelectedMachineId(m.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedMachineId(m.id) }}
            >
              <div className="card-top">
                <div className="machine-icon-box">
                  <Cpu size={22} />
                </div>
                <div className="status-badge">
                  <div className="status-dot" />
                  {m.status === 'repair' ? 'В РЕМОНТІ' : m.status === 'maintenance_required' ? 'ПОТРЕБУЄ ЧИСТКИ' : m.status === 'under_maintenance' ? 'ОБСЛУГОВУЄТЬСЯ' : activeTask ? 'ЗАЙНЯТИЙ' : 'ВІЛЬНИЙ'}
                </div>
                <div className="card-actions">
                  <button 
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleEdit(m) }}
                    title="Редагувати параметри"
                  >
                    <Edit3 size={16} />
                  </button>
                  <button 
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleDelete(m.id, m.name) }}
                    className="btn-del"
                    title="Видалити верстат"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <div className="card-main">
                <div className="inv-no">
                  <span className="inv-no-text">
                    {m.sequence_number ? `ПОРЯДКОВИЙ №${m.sequence_number}` : 'ПОРЯДКОВИЙ ВІДСУТНІЙ'} 
                    {' | '}
                    {m.inventory_no || 'БЕЗ ІНВЕНТАРНОГО'}
                  </span>
                  <span style={{ color: (m.completed_cards_count_since_maintenance || 0) >= 5 ? '#ef4444' : 'var(--text-dim)', fontWeight: 900 }}>
                    Картки: {m.completed_cards_count_since_maintenance || 0}/5
                  </span>
                </div>
                <h3 className="machine-name">{m.name}</h3>
                <div className="machine-type-label">{m.type || 'Не вказано'}</div>
                <div className="location-info"><MapPin size={14} /> {m.floor || 'Локація не вказана'}</div>
              </div>

              <div className="card-footer">
                {m.status === 'repair' ? (
                  <div className="idle-info" style={{ color: '#eab308' }}>
                    <span className="capacity-info"><AlertTriangle size={14} /> НА ОБСЛУГОВУВАННІ</span>
                    <span className="history-link" style={{ color: '#eab308' }}>АНАЛІТИКА <BarChart3 size={14} /></span>
                  </div>
                ) : m.status === 'maintenance_required' ? (
                  <div className="idle-info" style={{ color: '#ef4444' }}>
                    <span className="capacity-info"><AlertTriangle size={14} /> ПОТРЕБУЄ ЧИСТКИ СТОЛА</span>
                    <span className="history-link" style={{ color: '#ef4444' }}>АНАЛІТИКА <BarChart3 size={14} /></span>
                  </div>
                ) : m.status === 'under_maintenance' ? (
                  <div className="idle-info" style={{ color: '#3b82f6' }}>
                    <span className="capacity-info"><Activity size={14} /> ПРОВОДИТЬСЯ ЧИСТКА</span>
                    <span className="history-link" style={{ color: '#3b82f6' }}>АНАЛІТИКА <BarChart3 size={14} /></span>
                  </div>
                ) : activeTask ? (
                  <div className="active-work-info">
                    <div className="work-header">
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span className="task-type">У РОБОТІ</span>
                        <span className="timer"><Clock size={15} /> {formatElapsed(activeTask.started_at)}</span>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', fontWeight: 1000, textTransform: 'uppercase' }}>Плановий час</div>
                        <div style={{ fontSize: '0.95rem', color: '#ff9000', fontWeight: 900 }}>{formatPlanned(estimatedMin)}</div>
                      </div>
                    </div>
                    <div className="work-detail">{nomName || 'Деталізація...'}</div>
                    <div className="work-operator"><User size={12} /> {activeTask.operator_name || 'Оператор'}</div>
                    <div className="work-progress">
                      <div 
                        className={`progress-bar-inner ${progressPercent < 100 ? 'animate-pulse' : ''}`} 
                        style={{ 
                          width: `${estimatedMin > 0 ? progressPercent : 100}%`,
                          background: progressPercent >= 100 ? '#10b981' : '#ef4444',
                          boxShadow: progressPercent >= 100 ? '0 0 10px #10b981' : '0 0 10px #ef4444'
                        }} 
                      />
                    </div>
                  </div>
                ) : (
                  <div className="idle-info">
                    <span className="capacity-info"><Zap size={14} /> {m.sheet_capacity || 0} л. / наряд</span>
                    <span className="history-link">АНАЛІТИКА <BarChart3 size={14} /></span>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}
