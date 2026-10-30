import React, { useState } from 'react'
import { AlertCircle, Clock, FileCode, ShieldCheck, CheckCircle2, CheckSquare, Square } from 'lucide-react'
import { apiService } from '../../../services/apiDispatcher'
import { getTaskParts } from '../utils/engineerHelpers.jsx'

export function EngineerQueueTab({
  pendingTasks = [],
  approvedCount = 0,
  orders = [],
  nomenclatures = [],
  approveEngineer
}) {
  const [selectedByTask, setSelectedByTask] = useState({})
  const [submittingTaskId, setSubmittingTaskId] = useState(null)

  const togglePart = (taskId, partId, parts) => {
    const current = selectedByTask[taskId] !== undefined
      ? selectedByTask[taskId]
      : parts.map(p => p.nomId)

    if (current.includes(partId)) {
      setSelectedByTask(prev => ({
        ...prev,
        [taskId]: current.filter(id => id !== partId)
      }))
    } else {
      setSelectedByTask(prev => ({
        ...prev,
        [taskId]: [...current, partId]
      }))
    }
  }

  const selectAll = (taskId, parts) => {
    setSelectedByTask(prev => ({
      ...prev,
      [taskId]: parts.map(p => p.nomId)
    }))
  }

  const deselectAll = (taskId) => {
    setSelectedByTask(prev => ({
      ...prev,
      [taskId]: []
    }))
  }

  const handleApprove = async (taskId, selectedIds, allPartIds) => {
    try {
      setSubmittingTaskId(taskId)
      const idsToSubmit = selectedIds.length === allPartIds.length ? allPartIds : selectedIds
      await apiService.submitApproveEngineer(taskId, idsToSubmit, approveEngineer)
    } catch (err) {
      console.error('Engineer approval error:', err)
      alert('Помилка погодження: ' + (err?.message || err))
    } finally {
      setSubmittingTaskId(null)
    }
  }

  return (
    <>
      <div className="eng-stats-bar" style={{ display: 'flex', gap: '15px', marginBottom: '25px', overflowX: 'auto', paddingBottom: '10px' }}>
        <div style={{ flex: 1, minWidth: '150px', background: 'var(--surface-1)', padding: '15px', borderRadius: '16px', border: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', fontWeight: 800, textTransform: 'uppercase' }}>В ЧЕРЗІ ЧПК</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#3b82f6' }}>{pendingTasks.length}</div>
        </div>
        <div style={{ flex: 1, minWidth: '150px', background: 'var(--surface-1)', padding: '15px', borderRadius: '16px', border: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', fontWeight: 800, textTransform: 'uppercase' }}>ПІДТВЕРДЖЕНО</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#10b981' }}>{approvedCount}</div>
        </div>
        <div className="hide-mobile" style={{ flex: 2, background: 'rgba(59, 130, 246, 0.05)', padding: '15px', borderRadius: '16px', border: '1px solid rgba(59, 130, 246, 0.2)', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <AlertCircle size={20} color="#3b82f6" />
          <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted, #64748b)', lineHeight: 1.4 }}>
            Оберіть всі або окремі деталі наряду для погодження УП. Генерація робочих карт майстром буде доступна тільки для погоджених позицій.
          </p>
        </div>
      </div>

      <div className="eng-grid-layout" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
        {pendingTasks.map(task => {
          const order = (orders || []).find(o => String(o.id) === String(task.order_id))
          const parts = getTaskParts(task, order, nomenclatures)
          const allPartIds = parts.map(p => p.nomId)

          const approvedNoms = Array.isArray(task?.plan_snapshot?._engineer_approved_noms)
            ? task.plan_snapshot._engineer_approved_noms.map(String)
            : (task?.engineer_conf ? allPartIds : [])

          const selectedIds = selectedByTask[task.id] !== undefined
            ? selectedByTask[task.id]
            : (approvedNoms.length > 0 ? Array.from(new Set([...approvedNoms, ...allPartIds])) : allPartIds)

          const isPartiallyApproved = approvedNoms.length > 0 && approvedNoms.length < parts.length
          const isFullyApproved = approvedNoms.length > 0 && parts.length > 0 && parts.every(p => approvedNoms.includes(p.nomId))
          const isSubmitting = submittingTaskId === task.id

          return (
            <div
              key={task.id}
              className="eng-task-card glass-panel"
              style={{
                background: 'var(--surface-1)',
                padding: '22px',
                borderRadius: '24px',
                border: isPartiallyApproved ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid var(--border-subtle)',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px'
              }}
            >
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div className="order-branding">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <strong style={{ fontSize: '1.25rem', color: 'var(--text, #fff)' }}>№{order?.order_num || task.order_num || task.id?.slice(0, 8)}</strong>
                    {isPartiallyApproved && (
                      <span style={{ fontSize: '0.65rem', fontWeight: 900, background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.35)', padding: '2px 8px', borderRadius: '6px' }}>
                        ЧАСТКОВО ({approvedNoms.length}/{parts.length})
                      </span>
                    )}
                    {isFullyApproved && (
                      <span style={{ fontSize: '0.65rem', fontWeight: 900, background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.35)', padding: '2px 8px', borderRadius: '6px' }}>
                        ПОГОДЖЕНО
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-dim)', fontWeight: 600 }}>{order?.customer || '—'}</span>
                </div>
                <div style={{ color: 'var(--text-dim, #888)', fontSize: '0.75rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Clock size={13} /> {new Date(task.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>

              {/* Parts Selection List */}
              <div className="spec-review" style={{ background: 'var(--surface-inset)', padding: '14px', borderRadius: '14px', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
                  <label style={{ fontSize: '0.68rem', color: 'var(--text-muted, #888)', textTransform: 'uppercase', margin: 0, fontWeight: 900 }}>
                    Деталі наряду ({selectedIds.length}/{parts.length} обрано):
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => selectAll(task.id, parts)}
                      style={{ background: 'none', border: 'none', color: '#3b82f6', fontSize: '0.68rem', fontWeight: 800, cursor: 'pointer', padding: '2px 4px' }}
                    >
                      Всі
                    </button>
                    <span style={{ color: 'var(--text-dim)' }}>·</span>
                    <button
                      type="button"
                      onClick={() => deselectAll(task.id)}
                      style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: '0.68rem', fontWeight: 800, cursor: 'pointer', padding: '2px 4px' }}
                    >
                      Зняти
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '280px', overflowY: 'auto' }}>
                  {parts.map(part => {
                    const isSelected = selectedIds.includes(part.nomId)
                    const isAlreadyApproved = approvedNoms.includes(part.nomId)

                    return (
                      <div
                        key={part.nomId}
                        onClick={() => togglePart(task.id, part.nomId, parts)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '8px 10px',
                          borderRadius: '10px',
                          background: isSelected ? 'rgba(59, 130, 246, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                          border: isSelected ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid rgba(255, 255, 255, 0.05)',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <div style={{ color: isSelected ? '#3b82f6' : 'var(--text-dim)', display: 'flex', alignItems: 'center' }}>
                          {isSelected ? <CheckSquare size={18} /> : <Square size={18} />}
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                            <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text, #fff)', wordBreak: 'break-word' }}>
                              {part.name}
                            </div>
                            {isAlreadyApproved ? (
                              <span style={{ fontSize: '0.62rem', fontWeight: 900, color: '#10b981', background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '1px 6px', borderRadius: '4px', whiteSpace: 'nowrap' }}>
                                ✓ ПОГОДЖЕНО
                              </span>
                            ) : (
                              <span style={{ fontSize: '0.62rem', fontWeight: 800, color: '#f59e0b', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.25)', padding: '1px 6px', borderRadius: '4px', whiteSpace: 'nowrap' }}>
                                ОЧІКУЄ
                              </span>
                            )}
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '3px', flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.68rem', color: part.cnc_program ? '#3b82f6' : '#f59e0b', fontFamily: 'monospace', fontWeight: 700 }}>
                              <FileCode size={12} />
                              {part.cnc_program ? part.cnc_program : 'БЕЗ УП (CNC_DEFAULT)'}
                            </div>
                            {part.need > 0 && (
                              <span style={{ fontSize: '0.68rem', color: 'var(--text-dim)', fontWeight: 600 }}>
                                · {part.need} шт {part.material ? `(${part.material})` : ''}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}

                  {parts.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '15px', color: 'var(--text-dim)', fontSize: '0.75rem' }}>
                      Немає списку деталей у наряді
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: 'auto' }}>
                <button
                  type="button"
                  disabled={selectedIds.length === 0 || isSubmitting}
                  onClick={() => handleApprove(task.id, selectedIds, allPartIds)}
                  style={{
                    width: '100%',
                    padding: '14px',
                    background: selectedIds.length === 0
                      ? 'var(--surface-inset)'
                      : (selectedIds.length === parts.length ? '#10b981' : '#3b82f6'),
                    color: selectedIds.length === 0 ? 'var(--text-dim)' : '#fff',
                    border: 'none',
                    borderRadius: '12px',
                    fontWeight: 900,
                    cursor: selectedIds.length === 0 || isSubmitting ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    fontSize: '0.88rem',
                    transition: 'all 0.15s ease',
                    boxShadow: selectedIds.length > 0 ? '0 4px 12px rgba(0,0,0,0.15)' : 'none'
                  }}
                >
                  <ShieldCheck size={18} />
                  {isSubmitting ? (
                    'ЗБЕРЕЖЕННЯ...'
                  ) : selectedIds.length === 0 ? (
                    'ОБЕРІТЬ ДЕТАЛІ'
                  ) : selectedIds.length === parts.length ? (
                    `ПОГОДИТИ ВСІ ДЕТАЛІ (${parts.length}/${parts.length})`
                  ) : (
                    `ПОГОДИТИ ОБРАНІ (${selectedIds.length}/${parts.length})`
                  )}
                </button>
              </div>
            </div>
          )
        })}

        {pendingTasks.length === 0 && (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '80px 20px', color: '#888' }}>
            <CheckCircle2 size={64} style={{ marginBottom: '20px', opacity: 0.2, color: '#10b981' }} />
            <p style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text, #fff)' }}>ЧЕРГА ПІДТВЕРДЖЕНЬ ПОРОЖНЯ</p>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-dim)' }}>Всі активні наряди успішно опрацьовані інженером ЧПК</p>
          </div>
        )}
      </div>
    </>
  )
}
