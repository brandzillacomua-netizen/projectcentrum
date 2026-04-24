import React, { useState, useMemo, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { 
  ArrowLeft, Cpu, Plus, Trash2, Info, X, Zap, 
  MapPin, Hash, Activity, Clock, User, ClipboardList,
  Edit3, BarChart3, CheckCircle2, History
} from 'lucide-react'
import { useMES } from '../MESContext'
import { apiService } from '../services/apiDispatcher'

const MachinesModule = () => {
  const { machines, addMachine, updateMachine, deleteMachine, workCards, workCardHistory, nomenclatures, orders, tasks, loading } = useMES()
  const [showAdd, setShowAdd] = useState(false)
  const [selectedMachineId, setSelectedMachineId] = useState(null)
  const [form, setForm] = useState({ id: null, name: '', capacity: '1', inventory_no: '', floor: '', description: '' })
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const stats = useMemo(() => {
    const total = machines.length
    const busy = machines.filter(m => workCards.some(c => c.machine_id === m.id && c.status === 'in-progress')).length
    return { total, busy, idle: total - busy }
  }, [machines, workCards])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name) return
    try {
      const payload = {
        name: form.name,
        sheet_capacity: parseInt(form.capacity) || 0,
        inventory_no: form.inventory_no || null,
        floor: form.floor || null,
        description: form.description || null
      }

      if (form.id) {
        await apiService.submitUpdateMachine(form.id, payload, updateMachine)
      } else {
        // У нарахунок того, що ID може генеруватися на клієнті або сервері
        await apiService.submitMachine(payload, addMachine)
      }
      
      setForm({ id: null, name: '', capacity: '1', inventory_no: '', floor: '', description: '' })
      setShowAdd(false)
    } catch (err) {
      alert('Помилка: ' + err.message)
    }
  }

  const handleEdit = (m) => {
    setForm({ 
      id: m.id, 
      name: m.name, 
      capacity: m.sheet_capacity || '1', 
      inventory_no: m.inventory_no || '', 
      floor: m.floor || '', 
      description: m.description || '' 
    })
    setShowAdd(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleDelete = async (id, name) => {
    if (window.confirm(`Видалити верстат "${name}"?`)) {
      try {
        await apiService.submitDelete(id, 'machine', deleteMachine)
      } catch (err) {
        alert('Помилка: ' + err.message)
      }
    }
  }

  const selectedMachine = machines.find(m => m.id === selectedMachineId)
  const activeWorkForMachine = (m) => {
    return workCards.find(c => {
      if (c.status !== 'in-progress') return false;
      
      // 1. Пріоритет: Сувора прив'язка через ID
      if (c.machine_id === m.id) return true;
      
      // 2. Фолбек: Більш точний пошук за назвою або інвентарним номером
      const cardMachineTxt = (c.machine || '').toLowerCase().trim();
      const machName = (m.name || '').toLowerCase().trim();
      const machInv = (m.inventory_no || '').toLowerCase().trim();
      
      // Шукаємо точний збіг назви або згадку інвентарного номера як окремого слова
      const isExactName = machName && cardMachineTxt === machName;
      const isExactInv = machInv && (cardMachineTxt === machInv || cardMachineTxt.includes(`№${machInv}`) || cardMachineTxt.includes(` ${machInv}`));
      
      return isExactName || isExactInv;
    });
  }

  const getHistoryForMachine = (m) => {
    if (!m) return [];

    const norm = (val) => String(val || '').toLowerCase().trim();
    const mid = String(m.id || '');

    // 1. Повна історія з БД
    const fromHistory = workCardHistory.filter(h => {
      // 1. Пряма фільтрація по ID верстата (якщо колонка є)
      const hMid = String(h.machine_id || '');
      if (hMid && hMid === mid) return true;
      
      // 2. Фільтрація по метаданим у card_info (найбільш надійний спосіб без зміни схеми БД)
      const info = String(h.card_info || '');
      if (info.includes(`[MACHINE_ID:${mid}]`)) return true;
      if (m.name && info.includes(`[MACHINE_NAME:${m.name}]`)) return true;

      // 3. Фільтрація по текстовій назві (фолбек)
      const hMachine = norm(h.machine);
      const mName = norm(m.name);
      const mInv = norm(m.inventory_no);
      
      return (mName && hMachine === mName) || 
             (mInv && (hMachine === mInv || hMachine.includes('№' + mInv)));
    });

    // 2. Оперативний архів (ті, що щойно завершені оператором і чекають підтвердження)
    const fromWaiting = workCards.filter(c => {
      if (c.status !== 'waiting-buffer') return false;
      const cMid = String(c.machine_id || '');
      if (cMid && cMid === mid) return true;

      const cMachine = norm(c.machine);
      const mName = norm(m.name);
      const mInv = norm(m.inventory_no);

      return (mName && cMachine === mName) || 
             (mInv && (cMachine === mInv || cMachine.includes('№' + mInv)));
    }).map(c => ({
      ...c,
      card_id: c.id,
      qty_completed: c.quantity,
      scrap_qty: 0,
      is_pending: true
    }));

    // 3. Також додаємо активну роботу, щоб її було видно в історії зі статусом "В РОБОТІ"
    const fromActive = workCards.filter(c => {
      if (c.status !== 'in-progress' && c.status !== 'new') return false;
      const cMid = String(c.machine_id || '');
      if (cMid && cMid === mid) return true;

      const cMachine = norm(c.machine);
      const mName = norm(m.name);
      const mInv = norm(m.inventory_no);

      return (mName && cMachine === mName) || 
             (mInv && (cMachine === mInv || cMachine.includes('№' + mInv)));
    }).map(c => ({
      ...c,
      card_id: c.id,
      qty_completed: c.quantity,
      scrap_qty: 0,
      is_active: true
    }));

    return [...fromHistory, ...fromWaiting, ...fromActive].sort((a, b) => 
      new Date(b.completed_at || b.created_at) - new Date(a.completed_at || a.created_at)
    );
  }

  const calculateTotalTime = (m) => {
    const history = getHistoryForMachine(m);
    let totalMs = 0;
    history.forEach(h => {
      if (h.started_at && h.completed_at) {
        totalMs += (new Date(h.completed_at) - new Date(h.started_at));
      }
    });
    
    const hours = Math.floor(totalMs / 3600000);
    const minutes = Math.floor((totalMs % 3600000) / 60000);
    
    if (hours === 0 && minutes === 0) return '0г 0хв';
    return `${hours}г ${minutes}хв`;
  }

  const formatElapsed = (startIso) => {
    if (!startIso) return '00:00:00'
    const start = new Date(startIso)
    const diff = Math.floor((currentTime - start) / 1000)
    if (isNaN(diff) || diff < 0) return '00:00:00'
    const h = Math.floor(diff / 3600).toString().padStart(2, '0')
    const m = Math.floor((diff % 3600) / 60).toString().padStart(2, '0')
    const s = (diff % 60).toString().padStart(2, '0')
    return `${h}:${m}:${s}`
  }

  const formatPlanned = (minutes) => {
    if (!minutes) return '—'
    const h = Math.floor(minutes / 60)
    const m = Math.round(minutes % 60)
    if (h > 0) return `${h}год ${m}хв`
    return `${m}хв`
  }

  return (
    <div className="machines-module-v3" style={{ background: '#050505', minHeight: '100vh', color: '#fff', display: 'flex', flexDirection: 'column' }}>
      <nav className="module-nav" style={{ 
        flexShrink: 0, padding: '0 30px', height: '70px', background: '#000', 
        borderBottom: '1px solid #1a1a1a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' 
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <Link to="/" style={{ color: '#555', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', fontWeight: 700 }}>
            <ArrowLeft size={18} /> На головну
          </Link>
          <div style={{ width: '1px', height: '20px', background: '#222' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Activity className="text-orange" size={24} color="#ff9000" />
            <h1 style={{ fontSize: '1rem', fontWeight: 950, textTransform: 'uppercase', letterSpacing: '1px', margin: 0 }}>Парк обладнання</h1>
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '20px' }}>
          <div className="stat-pill">Всього: <strong>{stats.total}</strong></div>
          <div className="stat-pill">Зайняті: <strong style={{color: '#ef4444'}}>{stats.busy}</strong></div>
          <div className="stat-pill">Вільні: <strong style={{color: '#10b981'}}>{stats.idle}</strong></div>
        </div>
      </nav>

      <div className="module-content" style={{ padding: '30px', overflowY: 'auto', flex: 1 }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '40px' }}>
            <div>
              <h2 style={{ fontSize: '2rem', fontWeight: 1000, margin: 0, letterSpacing: '-1px' }}>МОНІТОР ВЕРСТАТІВ</h2>
              <p style={{ color: '#444', fontWeight: 700, margin: '5px 0 0' }}>Контроль завантаженості та технічні дані</p>
            </div>
            <button 
              onClick={() => { setShowAdd(!showAdd); if(!showAdd) setForm({id:null, name:'', capacity:'1', inventory_no:'', floor:'', description:''}) }}
              style={{ 
                background: showAdd ? '#1a1a1a' : '#ff9000', 
                color: showAdd ? '#fff' : '#000', 
                border: 'none', padding: '14px 30px', borderRadius: '14px', 
                fontWeight: 950, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px',
                boxShadow: showAdd ? 'none' : '0 10px 30px rgba(255,144,0,0.2)',
                transition: '0.2s'
              }}
            >
              {showAdd ? <X size={20} /> : <Plus size={20} />}
              {showAdd ? 'СКАСУВАТИ' : 'НОВИЙ ВЕРСТАТ'}
            </button>
          </div>

          {showAdd && (
            <div className="glass-panel anim-slide-down" style={{ background: '#0a0a0a', border: '1px solid #222', borderRadius: '28px', padding: '40px', marginBottom: '40px', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
              <h3 style={{ fontSize: '0.75rem', fontWeight: 1000, color: '#ff9000', textTransform: 'uppercase', marginBottom: '25px', letterSpacing: '2px' }}>
                {form.id ? 'Редагування верстата' : 'Параметри нового обладнання'}
              </h3>
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>
                   <div className="input-group">
                      <label><Hash size={12}/> Назва</label>
                      <input placeholder="напр. Laser Alpha-1" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required />
                   </div>
                   <div className="input-group">
                      <label><Zap size={12}/> Місткість (л.)</label>
                      <input type="number" value={form.capacity} onChange={e => setForm({...form, capacity: e.target.value})} required />
                   </div>
                   <div className="input-group">
                      <label><CheckCircle2 size={12}/> Інвентарний №</label>
                      <input placeholder="INV-2024-001" value={form.inventory_no} onChange={e => setForm({...form, inventory_no: e.target.value})} />
                   </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px' }}>
                   <div className="input-group">
                      <label><MapPin size={12}/> Локація / Поверх</label>
                      <input placeholder="напр. 2 поверх" value={form.floor} onChange={e => setForm({...form, floor: e.target.value})} />
                   </div>
                   <div className="input-group">
                      <label><ClipboardList size={12}/> Додатковий опис</label>
                      <input placeholder="Технічні особливості..." value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
                   </div>
                </div>
                <button type="submit" style={{ background: '#fff', color: '#000', border: 'none', padding: '20px', borderRadius: '16px', fontWeight: 1000, cursor: 'pointer', fontSize: '1rem', marginTop: '10px' }}>
                   {form.id ? 'ЗБЕРЕГТИ ЗМІНИ' : 'ЗАРЕЄСТРУВАТИ ВЕРСТАТ'}
                </button>
              </form>
            </div>
          )}

          {loading ? (
            <div style={{ textAlign: 'center', padding: '100px', color: '#444' }}><Zap className="animate-pulse" size={48} /></div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '25px' }}>
              {machines.map(m => {
                const activeTask = activeWorkForMachine(m)
                // Пошук батьківського наряду для отримання планового часу
                const parentTask = activeTask ? tasks.find(t => String(t.id).trim() === String(activeTask.task_id).trim()) : null
                const nomName = nomenclatures.find(n => String(n.id) === String(activeTask?.nomenclature_id))?.name
                
                // Пріоритет розрахунку часу:
                // 1. Беремо з самої картки (там тепер у секундах після останнього фіксу)
                // 2. Якщо в картці порожньо, беремо з наряду (там у хвилинах)
                // 3. Якщо і там немає — пробуємо розрахувати на льоту (кількість * час_на_од)
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
                  <div key={m.id} className={`machine-card-v3 ${activeTask ? 'is-busy' : 'is-idle'}`} onClick={() => setSelectedMachineId(m.id)}>
                    <div className="card-top">
                      <div className="machine-icon-box">
                        <Cpu size={24} />
                      </div>
                      <div className="status-badge">
                        <div className="status-dot" />
                        {activeTask ? 'ЗАЙНЯТИЙ' : 'ВІЛЬНИЙ'}
                      </div>
                      <div className="card-actions">
                        <button onClick={(e) => { e.stopPropagation(); handleEdit(m) }}><Edit3 size={16} /></button>
                        <button onClick={(e) => { e.stopPropagation(); handleDelete(m.id, m.name) }} className="btn-del"><Trash2 size={16} /></button>
                      </div>
                    </div>

                    <div className="card-main">
                      <div className="inv-no">{m.inventory_no || 'БЕЗ НОМЕРА'}</div>
                      <h3 className="machine-name">{m.name}</h3>
                      <div className="location-info"><MapPin size={14} /> {m.floor || 'Локація не вказана'}</div>
                    </div>

                    <div className="card-footer">
                      {activeTask ? (
                        <div className="active-work-info">
                          <div className="work-header" style={{ marginBottom: '15px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span className="task-type">У РОБОТІ</span>
                              <span className="timer" style={{ fontSize: '1.4rem', marginTop: '5px' }}><Clock size={16} /> {formatElapsed(activeTask.started_at)}</span>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: '0.65rem', color: '#555', fontWeight: 1000, textTransform: 'uppercase' }}>Плановий час</div>
                              <div style={{ fontSize: '1rem', color: '#ff9000', fontWeight: 900 }}>{formatPlanned(estimatedMin)}</div>
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
          )}
        </div>
      </div>

      {/* MACHINE DETAIL MODAL */}
      {selectedMachineId && selectedMachine && (
        <div className="modal-overlay" onClick={() => setSelectedMachineId(null)}>
          <div className="modal-content machine-detail-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                 <div className="modal-icon"><Cpu size={32} /></div>
                 <div>
                    <h2 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 1000 }}>{selectedMachine.name}</h2>
                    <div style={{ color: '#ff9000', fontSize: '0.75rem', fontWeight: 800 }}>{selectedMachine.inventory_no} | {selectedMachine.floor} Поверх</div>
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
              </aside>

              <main className="detail-main">
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
              </main>
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .stat-pill { background: #111; padding: 6px 15px; border-radius: 10px; font-size: 0.75rem; border: 1px solid #1a1a1a; color: #555; font-weight: 800; }
        .input-group label { display: flex; align-items: center; gap: 8px; font-size: 0.65rem; color: #444; text-transform: uppercase; font-weight: 900; margin-bottom: 8px; }
        .input-group input { width: 100%; background: #000; border: 1px solid #222; color: #fff; padding: 15px; border-radius: 12px; font-size: 0.9rem; outline: none; transition: 0.2s; }
        .input-group input:focus { border-color: #ff9000; background: #050505; }

        .machine-card-v3 {
          background: #0d0d0d; border: 1px solid #1c1c1c; border-radius: 28px; padding: 30px; 
          cursor: pointer; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          display: flex; flex-direction: column; gap: 20px;
        }
        .machine-card-v3:hover { transform: translateY(-8px); border-color: #333; box-shadow: 0 30px 60px rgba(0,0,0,0.6); }
        
        .card-top { display: flex; justify-content: space-between; align-items: center; }
        .machine-icon-box { background: #111; width: 48px; height: 48px; border-radius: 14px; display: flex; align-items: center; justify-content: center; color: #ff9000; border: 1px solid #1a1a1a; }
        
        .status-badge { display: flex; align-items: center; gap: 8px; font-size: 0.65rem; font-weight: 950; letter-spacing: 1px; color: #444; }
        .is-busy .status-badge { color: #ef4444; }
        .is-idle .status-badge { color: #10b981; }
        
        .status-dot { width: 8px; height: 8px; border-radius: 50%; background: currentColor; }
        .is-busy .status-dot { box-shadow: 0 0 10px #ef4444; animation: pulseRed 2s infinite; }
        .is-idle .status-dot { box-shadow: 0 0 10px #10b981; }

        .card-actions { display: flex; gap: 10px; opacity: 0; transition: 0.2s; }
        .machine-card-v3:hover .card-actions { opacity: 1; }
        .card-actions button { background: transparent; border: none; color: #444; cursor: pointer; transition: 0.2s; }
        .card-actions button:hover { color: #fff; }
        .card-actions .btn-del:hover { color: #ef4444; }

        .inv-no { font-size: 0.6rem; font-weight: 1000; color: #333; letter-spacing: 1.5px; }
        .machine-name { margin: 0; font-size: 1.8rem; font-weight: 1000; letter-spacing: -0.5px; }
        .location-info { display: flex; align-items: center; gap: 6px; font-size: 0.8rem; color: #555; font-weight: 700; }
        
        .card-footer { border-top: 1px solid #1a1a1a; padding-top: 20px; }
        .idle-info { display: flex; justify-content: space-between; align-items: center; color: #444; font-size: 0.75rem; font-weight: 800; }
        .history-link { color: #222; font-size: 0.65rem; text-transform: uppercase; font-weight: 950; }
        
        .active-work-info { display: flex; flex-direction: column; gap: 8px; }
        .work-header { display: flex; justify-content: space-between; align-items: center; }
        .task-type { font-size: 0.65rem; font-weight: 1000; color: #ef4444; letter-spacing: 1px; }
        .timer { font-size: 0.85rem; font-weight: 900; color: #fff; display: flex; align-items: center; gap: 6px; }
        .work-detail { font-size: 1rem; font-weight: 900; color: #fff; line-height: 1.2; }
        .work-operator { font-size: 0.75rem; color: #888; font-weight: 700; display: flex; align-items: center; gap: 6px; }
        .work-progress { height: 4px; background: #1a1a1a; border-radius: 2px; overflow: hidden; margin-top: 5px; }
        .progress-bar-inner { height: 100%; background: #ef4444; box-shadow: 0 0 10px #ef4444; }

        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.9); z-index: 2000; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(10px); }
        .modal-content { background: #0a0a0a; border: 1px solid #222; border-radius: 32px; box-shadow: 0 50px 100px rgba(0,0,0,0.8); overflow: hidden; animation: zoomIn 0.3s; }
        .machine-detail-modal { width: 1000px; max-width: 95vw; }
        
        .modal-header { padding: 40px; display: flex; justify-content: space-between; align-items: center; background: #000; border-bottom: 1px solid #1a1a1a; }
        .modal-icon { width: 70px; height: 70px; background: #111; border-radius: 20px; display: flex; align-items: center; justify-content: center; color: #ff9000; border: 1px solid #222; }
        .btn-close { background: #111; border: none; color: #fff; width: 48px; height: 48px; border-radius: 14px; cursor: pointer; }
        
        .modal-body-split { display: grid; grid-template-columns: 300px 1fr; }
        .detail-sidebar { padding: 40px; background: #080808; border-right: 1px solid #1a1a1a; display: flex; flex-direction: column; gap: 30px; }
        .side-metric label { display: block; font-size: 0.65rem; font-weight: 1000; color: #333; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px; }
        .side-metric span { font-size: 1.2rem; font-weight: 1000; color: #fff; }
        
        .detail-main { padding: 40px; }
        .history-table-wrapper { background: #050505; border-radius: 20px; border: 1px solid #1a1a1a; overflow: hidden; }
        .history-table-wrapper table { width: 100%; border-collapse: collapse; text-align: left; }
        .history-table-wrapper th { padding: 15px 20px; font-size: 0.7rem; color: #333; text-transform: uppercase; font-weight: 1000; background: #000; }
        .history-table-wrapper td { padding: 15px 20px; border-bottom: 1px solid #111; font-size: 0.85rem; }
        
        @keyframes pulseRed { 0% { opacity: 1; } 50% { opacity: 0.4; } 100% { opacity: 1; } }
        @keyframes zoomIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        @keyframes slideDown { from { transform: translateY(-20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .anim-slide-down { animation: slideDown 0.3s ease-out; }
      `}} />
    </div>
  )
}

export default MachinesModule
