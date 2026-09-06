import React from 'react'
import { AlertCircle, Clock, FileCode, ShieldCheck, CheckCircle2 } from 'lucide-react'
import { apiService } from '../../../services/apiDispatcher'

export function EngineerQueueTab({
  pendingTasks,
  approvedCount,
  orders,
  nomenclatures,
  approveEngineer
}) {
  return (
    <>
      <div className="eng-stats-bar" style={{ display: 'flex', gap: '15px', marginBottom: '25px', overflowX: 'auto', paddingBottom: '10px' }}>
        <div style={{ flex: 1, minWidth: '150px', background: '#111', padding: '15px', borderRadius: '16px', border: '1px solid #222' }}>
          <div style={{ fontSize: '0.65rem', color: '#555', fontWeight: 800, textTransform: 'uppercase' }}>В ЧЕРЗІ ЧПК</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#3b82f6' }}>{pendingTasks.length}</div>
        </div>
        <div style={{ flex: 1, minWidth: '150px', background: '#111', padding: '15px', borderRadius: '16px', border: '1px solid #222' }}>
          <div style={{ fontSize: '0.65rem', color: '#555', fontWeight: 800, textTransform: 'uppercase' }}>ПІДТВЕРДЖЕНО</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#10b981' }}>{approvedCount}</div>
        </div>
        <div className="hide-mobile" style={{ flex: 2, background: 'rgba(59, 130, 246, 0.05)', padding: '15px', borderRadius: '16px', border: '1px solid rgba(59, 130, 246, 0.2)', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <AlertCircle size={20} color="#3b82f6" />
          <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted, #64748b)', lineHeight: 1.4 }}>Ваше підтвердження активує кнопки запуску на терміналах операторів верстатів.</p>
        </div>
      </div>

      <div className="eng-grid-layout" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        {pendingTasks.map(task => {
          const order = (orders || []).find(o => o.id === task.order_id)
          return (
            <div key={task.id} className="eng-task-card glass-panel" style={{ background: '#111', padding: '25px', borderRadius: '24px', border: '1px solid #222', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div className="order-branding">
                  <strong style={{ fontSize: '1.2rem', display: 'block' }}>№{order?.order_num}</strong>
                  <span style={{ fontSize: '0.8rem', color: '#555', fontWeight: 600 }}>{order?.customer}</span>
                </div>
                <div style={{ color: '#444', fontSize: '0.75rem', fontWeight: 800 }}>
                  <Clock size={12} /> {new Date(task.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>

              <div className="spec-review" style={{ background: '#0a0a0a', padding: '15px', borderRadius: '14px', border: '1px solid #1a1a1a' }}>
                <label style={{ fontSize: '0.6rem', color: '#444', textTransform: 'uppercase', marginBottom: '10px', display: 'block', fontWeight: 900 }}>Програми обробки (ЧПК):</label>
                {order?.order_items?.map((item, idx) => {
                  const nom = (nomenclatures || []).find(n => n.id === item.nomenclature_id)
                  return (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                      <FileCode size={16} color="#3b82f6" />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: 700 }}>{nom?.name}</div>
                        <div style={{ fontSize: '0.65rem', color: '#3b82f6', fontFamily: 'monospace' }}>{nom?.cnc_program || 'БЕЗ ПРОГРАМИ (CNC_DEFAULT)'}</div>
                      </div>
                    </div>
                  )
                })}
              </div>

              <button 
                onClick={() => apiService.submitApproveEngineer(task.id, approveEngineer)}
                style={{ width: '100%', padding: '16px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', fontSize: '0.9rem' }}
              >
                <ShieldCheck size={20} /> ПІДТВЕРДИТИ ЧПК
              </button>
            </div>
          )
        })}

        {pendingTasks.length === 0 && (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '80px 20px', color: '#333' }}>
            <CheckCircle2 size={64} style={{ marginBottom: '20px', opacity: 0.1 }} />
            <p style={{ fontSize: '1.2rem', fontWeight: 800 }}>ЧЕРГА ПІДТВЕРДЖЕНЬ ПОРОЖНЯ</p>
            <p style={{ fontSize: '0.9rem' }}>Всі активні наряди успішно опрацьовані інженером</p>
          </div>
        )}
      </div>
    </>
  )
}
