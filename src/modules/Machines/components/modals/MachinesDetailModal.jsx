import React from 'react'
import { Cpu, X, AlertTriangle, History } from 'lucide-react'

export function MachinesDetailModal({
  selectedMachineId,
  setSelectedMachineId,
  selectedMachine,
  activeCallsForMachine,
  currentUser,
  supabase,
  fetchData,
  maintenanceLogs,
  orders,
  workCards,
  nomenclatures,
  calculateTotalTime,
  handlePrintQR,
  getHistoryForMachine
}) {
  if (!selectedMachineId || !selectedMachine) return null

  return (
    <div className="modal-overlay" onClick={() => setSelectedMachineId(null)}>
      <div className="modal-content machine-detail-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
             <div className="modal-icon"><Cpu size={32} /></div>
             <div>
                <h2 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 1000 }}>{selectedMachine.name}</h2>
                <div style={{ color: '#ff9000', fontSize: '0.75rem', fontWeight: 800 }}>Пор. №{selectedMachine.sequence_number || '—'} | Інв. {selectedMachine.inventory_no} | {selectedMachine.floor} Поверх</div>
             </div>
          </div>
          <button className="btn-close" onClick={() => setSelectedMachineId(null)}><X size={24} /></button>
        </div>
        
        <div className="modal-body-split">
          <aside className="detail-sidebar">
            <div className="side-metric">
              <label>ТИП ОБЛАДНАННЯ</label>
              <span>{selectedMachine.type || 'Laser'}</span>
            </div>
            <div className="side-metric">
              <label>ПОТУЖНІСТЬ (ЛИСТІВ)</label>
              <span style={{ color: '#ff9000' }}>{selectedMachine.sheet_capacity} л/наряд</span>
            </div>
            <div className="side-metric">
              <label>ОПИС / ПРИМІТКИ</label>
              <p style={{ fontSize: '0.8rem', color: '#555', margin: 0, lineHeight: 1.5 }}>
                {selectedMachine.description || 'Додаткова інформація не вказана.'}
              </p>
            </div>
            <div className="side-metric" style={{ marginTop: '20px' }}>
              <label>ЗАГАЛЬНИЙ ЧАС РОБОТИ</label>
              <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#10b981' }}>{calculateTotalTime(selectedMachine)}</div>
            </div>
            <div className="side-metric" style={{ marginTop: '20px', textAlign: 'center' }}>
              <label>QR-КОД ДЛЯ ВИКЛИКУ</label>
              <div style={{ background: '#ffffff', border: '1px solid #222', borderRadius: '16px', padding: '15px', display: 'inline-block', margin: '10px 0' }}>
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&color=000000&bgcolor=ffffff&data=${encodeURIComponent(`${window.location.origin}/machines/${selectedMachine.id}/call`)}`} 
                  alt="QR Code" 
                  style={{ width: '150px', height: '150px', display: 'block' }} 
                />
              </div>
              <button 
                onClick={() => handlePrintQR(selectedMachine)}
                style={{ 
                  background: '#ff9000', color: '#000', border: 'none', 
                  width: '100%', padding: '12px', borderRadius: '12px', 
                  fontWeight: 950, cursor: 'pointer', fontSize: '0.8rem',
                  marginTop: '5px', transition: '0.2s', boxShadow: '0 4px 12px rgba(255,144,0,0.2)'
                }}
              >
                ДРУКУВАТИ QR-КОД
              </button>
            </div>
          </aside>

          <main className="detail-main">
            {activeCallsForMachine.length > 0 && (
              <div style={{ marginBottom: '35px', background: 'rgba(239,68,68,0.02)', border: '1px solid #222', borderRadius: '20px', padding: '25px' }}>
                <h4 style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1rem', color: '#ef4444', margin: '0 0 20px 0' }}>
                  <AlertTriangle size={18} /> АКТИВНІ ВИКЛИКИ ОПЕРАТОРА
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {activeCallsForMachine.map(c => {
                    const label = c.called_role === 'master' ? 'МАЙСТЕР' : c.called_role === 'engineer' ? 'ІНЖЕНЕР' : 'ВКЯ'
                    const roleColor = c.called_role === 'master' ? '#ff9000' : c.called_role === 'engineer' ? '#8b5cf6' : '#ef4444'
                    return (
                      <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#050505', border: '1px solid #1a1a1a', padding: '15px 20px', borderRadius: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                          <span style={{ background: roleColor, color: '#000', padding: '4px 10px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 1000 }}>{label}</span>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>Викликав: {c.operator_name || 'Оператор'}</span>
                            <span style={{ fontSize: '0.7rem', color: '#555', marginTop: '2px' }}>
                              Час виклику: {new Date(c.created_at).toLocaleString('uk-UA', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </span>
                          </div>
                        </div>
                        <button 
                          onClick={async () => {
                            try {
                              const resolverName = currentUser?.name || currentUser?.login || 'Адміністратор'
                              const { error } = await supabase
                                .from('machine_calls')
                                .update({
                                  status: 'resolved',
                                  resolved_at: new Date().toISOString(),
                                  resolved_by: resolverName
                                })
                                .eq('id', c.id)
                              if (error) throw error
                            } catch (err) {
                              alert('Помилка закриття виклику: ' + err.message)
                            }
                          }}
                          style={{ background: '#10b981', color: '#000', border: 'none', padding: '8px 16px', borderRadius: '8px', fontWeight: 900, cursor: 'pointer', fontSize: '0.78rem' }}
                        >
                          ОБРОБЛЕНО
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {(selectedMachine.status === 'maintenance_required' || selectedMachine.status === 'under_maintenance') && (
              <div style={{ background: 'rgba(245, 158, 11, 0.05)', border: '1px solid rgba(245, 158, 11, 0.2)', borderRadius: '24px', padding: '25px', marginBottom: '30px' }}>
                <h4 style={{ margin: '0 0 10px 0', color: '#f59e0b', fontSize: '1.1rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertTriangle size={20} /> ТЕХНОЛОГІЧНЕ ОБСЛУГОВУВАННЯ (ЧИСТКА СТОЛА)
                </h4>
                <p style={{ margin: '0 0 20px 0', fontSize: '0.85rem', color: '#aaa', lineHeight: 1.5 }}>
                  Верстат виконав 5 карток розкрою поспіль і потребує очищення робочої поверхні (стола). Будь ласка, оберіть дію нижче:
                </p>
                
                <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
                  {selectedMachine.status === 'maintenance_required' && (
                    <>
                      <button
                        onClick={async () => {
                          const nowISO = new Date().toISOString();
                          await supabase.from('machines').update({
                            status: 'under_maintenance',
                            maintenance_started_at: nowISO
                          }).eq('id', selectedMachine.id);
                          
                          const { data: pendingLogs } = await supabase.from('machine_maintenance_logs')
                            .select('*')
                            .eq('machine_id', selectedMachine.id)
                            .eq('status', 'pending')
                            .order('triggered_at', { ascending: false })
                            .limit(1);
                          
                          if (pendingLogs && pendingLogs[0]) {
                            const log = pendingLogs[0];
                            const triggered = new Date(log.triggered_at);
                            const started = new Date(nowISO);
                            const respDiff = Math.floor((started - triggered) / 1000);
                            
                            await supabase.from('machine_maintenance_logs')
                              .update({
                                status: 'in_progress',
                                started_at: nowISO,
                                response_duration_seconds: respDiff
                              })
                              .eq('id', log.id);
                          }
                          
                          fetchData('machines');
                        }}
                        style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '12px 25px', borderRadius: '12px', fontWeight: 900, cursor: 'pointer', fontSize: '0.85rem' }}
                      >
                        🛠️ ПОЧАТИ ОБСЛУГОВУВАННЯ
                      </button>
                      
                      <button
                        onClick={async () => {
                          const nowISO = new Date().toISOString();
                          const userName = currentUser ? `${currentUser.first_name || ''} ${currentUser.last_name || ''}`.trim() : 'Співробітник';
                          
                          await supabase.from('machines').update({
                            status: 'working',
                            completed_cards_count_since_maintenance: 0,
                            maintenance_pending_since: null,
                            maintenance_started_at: null
                          }).eq('id', selectedMachine.id);
                          
                          const { data: pendingLogs } = await supabase.from('machine_maintenance_logs')
                            .select('*')
                            .eq('machine_id', selectedMachine.id)
                            .eq('status', 'pending')
                            .order('triggered_at', { ascending: false })
                            .limit(1);
                            
                          if (pendingLogs && pendingLogs[0]) {
                            const log = pendingLogs[0];
                            const triggered = new Date(log.triggered_at);
                            const completed = new Date(nowISO);
                            const respDiff = Math.floor((completed - triggered) / 1000);
                            
                            await supabase.from('machine_maintenance_logs')
                              .update({
                                status: 'skipped',
                                completed_at: nowISO,
                                performed_by: userName,
                                response_duration_seconds: respDiff
                              })
                              .eq('id', log.id);
                          }
                          
                          fetchData('machines');
                        }}
                        style={{ background: '#222', color: '#888', border: '1px solid #333', padding: '12px 25px', borderRadius: '12px', fontWeight: 900, cursor: 'pointer', fontSize: '0.85rem' }}
                      >
                        🚀 ЗАПУСТИТИ БЕЗ РЕМОНТУ
                      </button>
                    </>
                  )}
                  
                  {selectedMachine.status === 'under_maintenance' && (
                    <button
                      onClick={async () => {
                        const nowISO = new Date().toISOString();
                        const userName = currentUser ? `${currentUser.first_name || ''} ${currentUser.last_name || ''}`.trim() : 'Співробітник';
                        
                        await supabase.from('machines').update({
                          status: 'working',
                          completed_cards_count_since_maintenance: 0,
                          maintenance_pending_since: null,
                          maintenance_started_at: null
                        }).eq('id', selectedMachine.id);
                        
                        const { data: activeLogs } = await supabase.from('machine_maintenance_logs')
                          .select('*')
                          .eq('machine_id', selectedMachine.id)
                          .eq('status', 'in_progress')
                          .order('triggered_at', { ascending: false })
                          .limit(1);
                          
                        if (activeLogs && activeLogs[0]) {
                          const log = activeLogs[0];
                          const started = new Date(log.started_at);
                          const completed = new Date(nowISO);
                          const maintDiff = Math.floor((completed - started) / 1000);
                          
                          await supabase.from('machine_maintenance_logs')
                            .update({
                              status: 'completed',
                              completed_at: nowISO,
                              performed_by: userName,
                              maintenance_duration_seconds: maintDiff
                            })
                            .eq('id', log.id);
                        }
                        
                        fetchData('machines');
                      }}
                      style={{ background: '#10b981', color: '#000', border: 'none', padding: '12px 25px', borderRadius: '12px', fontWeight: 900, cursor: 'pointer', fontSize: '0.85rem' }}
                    >
                      ✅ ЗАВЕРШИТИ ОБСЛУГОВУВАННЯ
                    </button>
                  )}
                </div>
              </div>
            )}

            <h4 style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1rem', marginBottom: '20px' }}>
              <History size={18} color="#ff9000" /> ІСТОРІЯ ВИКОНАНИХ КАРТОК
            </h4>
            <div className="history-table-wrapper">
               <table>
                  <thead>
                    <tr>
                      <th>ДАТА / ЧАС</th>
                      <th style={{ textAlign: 'center' }}>НАРЯД</th>
                      <th style={{ textAlign: 'center' }}>№ КАРТКИ</th>
                      <th>ДЕТАЛЬ</th>
                      <th>ОПЕРАТОР</th>
                      <th style={{ textAlign: 'right' }}>К-СТЬ</th>
                      <th style={{ textAlign: 'right', color: '#ef4444' }}>БРАК</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getHistoryForMachine(selectedMachine).map(h => {
                      const rootCard = workCards.find(c => String(c.id) === String(h.card_id));
                      const orderId = h.order_id || rootCard?.order_id;
                      const order = orders.find(o => String(o.id) === String(orderId));
                      const orderNumStr = order ? `№${order.order_num}` : '—';
                      const cardNumStr = h.card_id ? `#${String(h.card_id).slice(0, 8)}` : '—';
                      const nom = nomenclatures.find(n => n.id === h.nomenclature_id);

                      return (
                        <tr key={h.id} style={{ opacity: h.is_pending ? 0.7 : 1 }}>
                          <td style={{ fontSize: '0.7rem', color: '#555' }}>
                            {new Date(h.completed_at || h.created_at || new Date()).toLocaleString('uk-UA', { 
                              day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' 
                            })}
                            {h.is_active && <span style={{ marginLeft: '8px', color: '#ff3232', fontSize: '0.6rem', fontWeight: 1000, background: 'rgba(255,50,50,0.1)', padding: '2px 6px', borderRadius: '4px' }}>В РОБОТІ</span>}
                            {h.is_pending && <span style={{ marginLeft: '8px', color: '#eab308', fontSize: '0.6rem', fontWeight: 1000, background: 'rgba(234,179,8,0.1)', padding: '2px 6px', borderRadius: '4px' }}>В ОЧІКУВАННІ</span>}
                            {!h.is_active && !h.is_pending && <span style={{ marginLeft: '8px', color: '#00ff64', fontSize: '0.6rem', fontWeight: 1000, background: 'rgba(0,255,100,0.1)', padding: '2px 6px', borderRadius: '4px' }}>ВИКОНАНО</span>}
                          </td>
                          <td style={{ textAlign: 'center', fontSize: '0.8rem', fontWeight: 700, color: '#ff9000' }}>{orderNumStr}</td>
                          <td style={{ textAlign: 'center', fontSize: '0.7rem', color: '#888' }}>{cardNumStr}</td>
                          <td style={{ fontWeight: 800 }}>{nom?.name || '—'}</td>
                          <td style={{ fontSize: '0.8rem' }}>{h.operator_name || '—'}</td>
                          <td style={{ textAlign: 'right', fontWeight: 900, color: '#fff' }}>{h.qty_completed || h.quantity} шт</td>
                          <td style={{ textAlign: 'right', fontWeight: 900, color: '#ef4444' }}>{h.scrap_qty || 0} шт</td>
                        </tr>
                      );
                    })}
                    {getHistoryForMachine(selectedMachine).length === 0 && (
                      <tr><td colSpan="7" style={{ textAlign: 'center', padding: '40px', color: '#333', fontSize: '0.8rem' }}>Історія порожня</td></tr>
                    )}
                  </tbody>
               </table>
             </div>
             <h4 style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1rem', marginTop: '40px', marginBottom: '20px' }}>
              <History size={18} color="#f59e0b" /> ІСТОРІЯ ТЕХНОЛОГІЧНОГО ОБСЛУГОВУВАННЯ
            </h4>
            <div className="history-table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>ЧАС БЛОКУВАННЯ</th>
                    <th>ПОЧАТОК</th>
                    <th>ЗАВЕРШЕННЯ / СТАТУС</th>
                    <th>ВИКОНАВ</th>
                    <th style={{ textAlign: 'right' }}>РЕАГУВАННЯ</th>
                    <th style={{ textAlign: 'right' }}>ТРИВАЛІСТЬ ЧИСТКИ</th>
                  </tr>
                </thead>
                <tbody>
                  {maintenanceLogs.map(log => {
                    const fmtTime = (sec) => {
                      if (sec === null || sec === undefined) return '—';
                      const m = Math.floor(sec / 60);
                      const s = sec % 60;
                      return m > 0 ? `${m}хв ${s}с` : `${s}с`;
                    };
                    
                    return (
                      <tr key={log.id}>
                        <td style={{ fontSize: '0.8rem', color: '#aaa' }}>
                          {new Date(log.triggered_at).toLocaleString('uk-UA')}
                        </td>
                        <td style={{ fontSize: '0.8rem', color: '#aaa' }}>
                          {log.started_at ? new Date(log.started_at).toLocaleTimeString('uk-UA') : '—'}
                        </td>
                        <td>
                          {log.status === 'pending' && <span style={{ color: '#ef4444', fontWeight: 900 }}>ОЧІКУЄ</span>}
                          {log.status === 'in_progress' && <span style={{ color: '#3b82f6', fontWeight: 900 }}>ОБСЛУГОВУЄТЬСЯ</span>}
                          {log.status === 'completed' && <span style={{ color: '#10b981', fontWeight: 900 }}>ВИКОНАНО</span>}
                          {log.status === 'skipped' && <span style={{ color: '#888', fontWeight: 900 }}>ПРОПУЩЕНО</span>}
                        </td>
                        <td>{log.performed_by || '—'}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>
                          {fmtTime(log.response_duration_seconds)}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: '#10b981' }}>
                          {fmtTime(log.maintenance_duration_seconds)}
                        </td>
                      </tr>
                    );
                  })}
                  {maintenanceLogs.length === 0 && (
                    <tr><td colSpan="6" style={{ textAlign: 'center', padding: '40px', color: '#333', fontSize: '0.8rem' }}>Історія обслуговування порожня</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}
