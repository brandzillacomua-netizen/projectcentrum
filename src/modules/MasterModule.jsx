import React, { useState } from 'react'
import { 
  ClipboardCheck, 
  ArrowLeft, 
  Play, 
  History, 
  ListChecks, 
  X,
  Package,
  Settings,
  Search,
  Menu
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useMES } from '../MESContext'
import { apiService } from '../services/apiDispatcher'

const MasterModule = () => {
  const { orders, tasks, createNaryad, nomenclatures, bomItems, machines } = useMES()
  const [activeNaryadOrder, setActiveNaryadOrder] = useState(null)
  const [selectedMachine, setSelectedMachine] = useState(null)
  const [activeMobileSection, setActiveMobileSection] = useState('active') // active, history (queue is in burger)
  const [searchQuery, setSearchQuery] = useState('')
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

  const getBOMParts = (nomenclatureId) => {
    return bomItems
      .filter(b => b.parent_id === nomenclatureId)
      .map(b => ({
        ...b,
        nom: nomenclatures.find(n => n.id === b.child_id)
      }))
  }

  const completedTasks = tasks.filter(t => t.status === 'completed')
  const totalProduced = completedTasks.length
  
  let totalScrapCount = 0
  completedTasks.forEach(t => {
    if (t.scrap_data) {
      Object.values(t.scrap_data).forEach(v => totalScrapCount += Number(v))
    }
  })

  const filteredPending = orders.filter(o => 
    o.status === 'pending' && 
    (o.order_num.includes(searchQuery) || o.customer.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  const renderAnalytics = () => (
    <div className="analytics-scroll" style={{ overflowX: 'auto', marginBottom: '25px', display: 'flex', gap: '15px', paddingBottom: '10px' }}>
      <div className="ana-card-v2" style={{ minWidth: '140px', flex: 1, background: '#111', padding: '15px', borderRadius: '16px', border: '1px solid #222' }}>
        <div style={{ color: '#555', fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase' }}>Виконано</div>
        <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#ff9000' }}>{totalProduced}</div>
      </div>
      <div className="ana-card-v2" style={{ minWidth: '140px', flex: 1, background: '#111', padding: '15px', borderRadius: '16px', border: '1px solid #222' }}>
        <div style={{ color: '#555', fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase' }}>Брак</div>
        <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#ef4444' }}>{totalScrapCount} <small style={{ fontSize: '0.7rem' }}>шт</small></div>
      </div>
      <div className="ana-card-v2" style={{ minWidth: '140px', flex: 1, background: '#111', padding: '15px', borderRadius: '16px', border: '1px solid #222' }}>
        <div style={{ color: '#555', fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase' }}>В роботі</div>
        <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#3b82f6' }}>{tasks.filter(t => t.status === 'in-progress').length}</div>
      </div>
    </div>
  )

  const renderOrderQueue = () => (
    <section className="grid-col">
       <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h3 style={{ fontSize: '0.85rem', color: '#555', margin: 0 }}><ListChecks size={16} /> ЧЕРГА ЗАМОВЛЕНЬ</h3>
          <div style={{ position: 'relative' }}>
             <Search size={12} style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: '#444' }} />
             <input style={{ background: '#000', border: '1px solid #222', borderRadius: '8px', padding: '4px 8px 4px 25px', color: '#fff', fontSize: '0.75rem', width: '110px' }} placeholder="Пошук..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          </div>
       </div>
       <div className="v-stack" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filteredPending.map(order => (
            <div key={order.id} className="order-p-card glass-panel" style={{ background: '#0f0f0f', padding: '15px', borderRadius: '16px', border: '1px solid #1a1a1a' }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <strong style={{ fontSize: '1rem' }}>№{order.order_num}</strong>
                  <span style={{ fontSize: '0.65rem', color: '#444' }}>{order.order_date ? new Date(order.order_date).toLocaleDateString() : ''}</span>
               </div>
               <div style={{ fontSize: '0.8rem', color: '#666', marginBottom: '12px' }}>{order.customer}</div>
               <button onClick={() => { setActiveNaryadOrder(order); setIsDrawerOpen(false); }} style={{ width: '100%', padding: '10px', background: '#ff9000', color: '#000', border: 'none', borderRadius: '8px', fontWeight: 900, cursor: 'pointer', fontSize: '0.75rem' }}>СФОРМУВАТИ НАРЯД</button>
            </div>
          ))}
          {filteredPending.length === 0 && <div style={{ textAlign: 'center', padding: '20px', color: '#333', fontSize: '0.75rem' }}>Порожньо</div>}
       </div>
    </section>
  )

  return (
    <div className="master-module-v2" style={{ background: '#0a0a0a', minHeight: '100vh', color: '#fff', display: 'flex', flexDirection: 'column' }}>
      <nav className="module-nav" style={{ flexShrink: 0, padding: '0 20px', height: '70px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#000', borderBottom: '1px solid #222' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
           <Link to="/" className="back-link" style={{ color: '#555', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}><ArrowLeft size={18} /> <span className="hide-mobile">Назад</span></Link>
           <button onClick={() => setIsDrawerOpen(true)} className="burger-btn mobile-only"><Menu size={24} /></button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <ClipboardCheck className="text-accent" size={24} color="#ff9000" />
          <h1 style={{ fontSize: '1rem', fontWeight: 900, textTransform: 'uppercase', margin: 0 }} className="hide-mobile">Керування виробництвом</h1>
          <h1 className="mobile-only" style={{ fontSize: '1rem', fontWeight: 900, margin: 0 }}>МАЙСТЕР</h1>
        </div>
        <div className="hide-mobile" style={{ fontSize: '0.8rem', color: '#444', fontWeight: 700 }}>MES CONTROL V2.1</div>
      </nav>

      <div className="module-content" style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
        {/* Analytics (Show only on Desktop here) */}
        <div className="hide-mobile">
           {renderAnalytics()}
        </div>

        {/* Mobile Filter Tabs */}
        <div className="mobile-only section-tabs" style={{ display: 'flex', background: '#111', padding: '5px', borderRadius: '14px', marginBottom: '20px' }}>
          <button onClick={() => setActiveMobileSection('active')} className={`tab-btn-m ${activeMobileSection === 'active' ? 'active' : ''}`}>В ЦЕХУ</button>
          <button onClick={() => setActiveMobileSection('history')} className={`tab-btn-m ${activeMobileSection === 'history' ? 'active' : ''}`}>АРХІВ</button>
        </div>

        {/* Mobile Drawer */}
        {isDrawerOpen && <div className="drawer-backdrop" onClick={() => setIsDrawerOpen(false)} />}
        <div className={`side-drawer ${isDrawerOpen ? 'open' : ''}`}>
           <div className="drawer-header">
              <span style={{ fontSize: '0.8rem', fontWeight: 900 }}>МЕНЮ ТА ЧЕРГА</span>
              <button onClick={() => setIsDrawerOpen(false)} className="burger-btn"><X size={20} /></button>
           </div>
           <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
              <div style={{ marginBottom: '20px' }}>{renderAnalytics()}</div>
              {renderOrderQueue()}
           </div>
        </div>

        <div className="master-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 320px) 1fr minmax(280px, 300px)', gap: '25px' }}>
          
          {/* Column 1: Order Queue (Desktop only) */}
          <div className="hide-mobile">
             {renderOrderQueue()}
          </div>

          {/* Column 2: Workshop Active Tasks */}
          <section className={`grid-col ${activeMobileSection !== 'active' ? 'hide-mobile' : ''}`}>
             <h3 style={{ fontSize: '0.85rem', color: '#555', marginBottom: '15px' }}><Play size={16} fill="currentColor" /> АКТИВНІ В ЦЕХУ</h3>
             <div className="v-stack" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {tasks.filter(t => t.status !== 'completed' && t.status !== 'pending').map(task => {
                  const order = orders.find(o => o.id === task.order_id)
                  return (
                    <div key={task.id} style={{ background: '#111', padding: '18px', borderRadius: '18px', border: '1px solid #222', borderLeft: '4px solid #ff9000' }}>
                       <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <strong style={{ fontSize: '0.9rem' }}>{order?.order_num} — {order?.customer}</strong>
                          <span className={`pulse-dot ${task.status}`}></span>
                       </div>
                       <div style={{ fontSize: '0.75rem', color: '#555', marginBottom: '12px' }}>{task.step} | <span style={{ color: '#ff9000' }}>{task.machine_name}</span></div>
                       <div style={{ display: 'flex', gap: '8px' }}>
                          <div style={{ fontSize: '0.6rem', padding: '4px 8px', borderRadius: '4px', background: task.warehouse_conf ? '#10b98122' : '#333', color: task.warehouse_conf ? '#10b981' : '#555' }}>СКЛАД</div>
                          <div style={{ fontSize: '0.6rem', padding: '4px 8px', borderRadius: '4px', background: task.engineer_conf ? '#10b98122' : '#333', color: task.engineer_conf ? '#10b981' : '#555' }}>ТЕХНОЛОГ</div>
                       </div>
                    </div>
                  )
                })}
                {tasks.filter(t => t.status !== 'completed' && t.status !== 'pending').length === 0 && (
                   <div style={{ textAlign: 'center', padding: '40px', color: '#333', fontSize: '0.8rem' }}>Немає активних завдань</div>
                )}
             </div>
          </section>

          {/* Column 3: History */}
          <section className={`grid-col ${activeMobileSection !== 'history' ? 'hide-mobile' : ''}`}>
             <h3 style={{ fontSize: '0.85rem', color: '#555', marginBottom: '15px' }}><History size={16} /> АРХІВ СЬОГОДНІ</h3>
             <div className="v-stack" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {completedTasks.slice(0, 15).map(task => {
                  const order = orders.find(o => o.id === task.order_id)
                  return (
                    <div key={task.id} style={{ background: '#0a0a0a', padding: '12px 18px', borderRadius: '12px', border: '1px solid #151515', opacity: 0.6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                       <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>#{order?.order_num}</span>
                       <span style={{ fontSize: '0.7rem', color: '#333' }}>{new Date(task.completed_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                    </div>
                  )
                })}
             </div>
          </section>
        </div>
      </div>

      {/* NARYAD WORKSHEET MODAL */}
      {activeNaryadOrder && (
        <div className="worksheet-modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.96)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px' }}>
          <div className="worksheet-panel glass-panel" style={{ background: '#111', width: '100%', maxWidth: '1100px', maxHeight: '95vh', borderRadius: '24px', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid #333' }}>
             
             <div style={{ padding: '20px 25px', background: '#0a0a0a', borderBottom: '1px solid #222', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                   <h2 style={{ margin: 0, fontSize: '1.4rem', color: '#ff9000', fontWeight: 900 }}>НАРЯД № {activeNaryadOrder.order_num}</h2>
                   <div style={{ fontSize: '0.8rem', color: '#555', marginTop: '4px' }}>{activeNaryadOrder.customer} | Планова дата: {activeNaryadOrder.deadline ? new Date(activeNaryadOrder.deadline).toLocaleDateString() : '—'}</div>
                </div>
                <button onClick={() => setActiveNaryadOrder(null)} style={{ background: 'transparent', border: 'none', color: '#555', cursor: 'pointer' }}><X size={24} /></button>
             </div>

             <div className="worksheet-scrollable" style={{ flex: 1, overflowY: 'auto', padding: '25px' }}>
                <div style={{ marginBottom: '25px' }}>
                   <div style={{ fontSize: '0.65rem', color: '#666', fontWeight: 800, textTransform: 'uppercase', marginBottom: '10px', letterSpacing: '0.05em' }}>Оберіть обладнання для нарізки:</div>
                   <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                      {machines.map(m => (
                        <button key={m.id} onClick={() => setSelectedMachine(m)} style={{ background: selectedMachine?.id === m.id ? '#ff9000' : '#1a1a1a', color: selectedMachine?.id === m.id ? '#000' : '#888', border: 'none', padding: '10px 20px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 900, cursor: 'pointer', transition: '0.2s' }}>{m.name} <small style={{ opacity: 0.5 }}>({m.sheet_capacity}л)</small></button>
                      ))}
                   </div>
                </div>

                <div className="table-responsive-container hide-mobile" style={{ marginBottom: '30px' }}>
                   <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                      <thead>
                        <tr style={{ background: '#1a1a1a', color: '#555', textAlign: 'left' }}>
                           <th className="sticky-col" style={{ padding: '15px' }}>ДЕТАЛЬ В ПОРІЗКУ</th>
                           <th style={{ padding: '15px', textAlign: 'center' }}>ПЛАН</th>
                           <th style={{ padding: '15px', textAlign: 'center' }}>МАТЕРІАЛ</th>
                           <th style={{ padding: '15px', textAlign: 'center' }}>ШТ/ЛИСТ</th>
                           <th style={{ padding: '15px', textAlign: 'center', background: '#22c55e11', color: '#22c55e' }}>ЛИСТІВ</th>
                           <th style={{ padding: '15px', textAlign: 'center', background: '#3b82f611', color: '#3b82f6' }}>ЗАВАНТАЖЕНЬ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeNaryadOrder.order_items?.map(item => {
                           const parts = getBOMParts(item.nomenclature_id)
                           const displayParts = parts.length > 0 ? parts : [{ nom: nomenclatures.find(n => n.id === item.nomenclature_id), quantity_per_parent: 1 }]
                           return displayParts.map((part, pIdx) => {
                              const totalToProduce = item.quantity * (part.quantity_per_parent || 1)
                              const sheets = Math.ceil(totalToProduce / (part.nom?.units_per_sheet || 1))
                              return (
                                <tr key={`${item.id}-${pIdx}`} style={{ borderBottom: '1px solid #222' }}>
                                   <td className="sticky-col" style={{ padding: '18px 15px', fontWeight: 800 }}>{part.nom?.name}</td>
                                   <td style={{ padding: '18px 15px', textAlign: 'center', fontWeight: 700 }}>{totalToProduce} <small style={{ color: '#444' }}>{part.nom?.unit}</small></td>
                                   <td style={{ padding: '18px 15px', textAlign: 'center', color: '#888' }}>{part.nom?.material_type}</td>
                                   <td style={{ padding: '18px 15px', textAlign: 'center' }}>{part.nom?.units_per_sheet || 1}</td>
                                   <td style={{ padding: '18px 15px', textAlign: 'center', fontWeight: 900, color: '#22c55e', fontSize: '1rem' }}>{sheets}</td>
                                   <td style={{ padding: '18px 15px', textAlign: 'center', fontWeight: 900, color: '#3b82f6', fontSize: '1rem' }}>{selectedMachine ? Math.ceil(sheets / selectedMachine.sheet_capacity) : '—'}</td>
                                </tr>
                              )
                           })
                        })}
                      </tbody>
                   </table>
                </div>

                <div className="mobile-only" style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                   {activeNaryadOrder.order_items?.map(item => {
                      const parts = getBOMParts(item.nomenclature_id)
                      const displayParts = parts.length > 0 ? parts : [{ nom: nomenclatures.find(n => n.id === item.nomenclature_id), quantity_per_parent: 1 }]
                      return displayParts.map((part, pIdx) => {
                         const totalToProduce = item.quantity * (part.quantity_per_parent || 1)
                         const sheets = Math.ceil(totalToProduce / (part.nom?.units_per_sheet || 1))
                         return (
                           <div key={`${item.id}-${pIdx}`} style={{ background: '#0a0a0a', padding: '20px', borderRadius: '20px', border: '1px solid #222' }}>
                              <div style={{ fontWeight: 900, fontSize: '0.95rem', marginBottom: '15px', borderLeft: '3px solid #ff9000', paddingLeft: '12px' }}>{part.nom?.name}</div>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                 <div><div style={{ fontSize: '0.6rem', color: '#555' }}>ВИРОБИТИ</div><div style={{ fontWeight: 800 }}>{totalToProduce} {part.nom?.unit}</div></div>
                                 <div><div style={{ fontSize: '0.6rem', color: '#555' }}>МАТЕРІАЛ</div><div style={{ fontSize: '0.8rem' }}>{part.nom?.material_type}</div></div>
                                 <div style={{ background: '#22c55e11', padding: '10px', borderRadius: '12px' }}><div style={{ fontSize: '0.6rem', color: '#22c55e' }}>ЛИСТІВ</div><div style={{ fontWeight: 900, color: '#22c55e', fontSize: '1.2rem' }}>{sheets}</div></div>
                                 <div style={{ background: '#3b82f611', padding: '10px', borderRadius: '12px' }}><div style={{ fontSize: '0.6rem', color: '#3b82f6' }}>ЗАВАНТАЖЕНЬ</div><div style={{ fontWeight: 900, color: '#3b82f6', fontSize: '1.2rem' }}>{selectedMachine ? Math.ceil(sheets / selectedMachine.sheet_capacity) : '—'}</div></div>
                              </div>
                           </div>
                         )
                      })
                   })}
                </div>
             </div>

             <div style={{ padding: '25px', background: '#0a0a0a', borderTop: '1px solid #222', display: 'flex', gap: '15px' }}>
                <button onClick={() => setActiveNaryadOrder(null)} style={{ flex: 1, padding: '16px', borderRadius: '14px', background: '#222', color: '#888', border: 'none', fontWeight: 800, cursor: 'pointer' }}>СКАСУВАТИ</button>
                <button disabled={!selectedMachine} onClick={() => { window.print(); apiService.submitCreateTask(activeNaryadOrder.id, selectedMachine?.name, createNaryad); setActiveNaryadOrder(null); setSelectedMachine(null); }} style={{ flex: 2, padding: '16px', borderRadius: '14px', background: selectedMachine ? '#22c55e' : '#222', color: selectedMachine ? '#000' : '#444', border: 'none', fontWeight: 900, cursor: selectedMachine ? 'pointer' : 'not-allowed' }}>{selectedMachine ? 'ЗАПУСТИТИ ДРУК ТА ЦЕХ' : 'ОБЕРІТЬ СТАНОК'}</button>
             </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .master-module-v2 { font-family: 'Inter', sans-serif; }
        .section-tabs .tab-btn-m { flex: 1; padding: 12px; border: none; background: transparent; color: #555; fontSize: 0.75rem; fontWeight: 900; borderRadius: 10px; cursor: pointer; transition: 0.3s; }
        .section-tabs .tab-btn-m.active { background: #222; color: #ff9000; box-shadow: 0 4px 10px rgba(0,0,0,0.5); }
        .pulse-dot { width: 10px; height: 10px; borderRadius: 50%; background: #333; }
        .pulse-dot.in-progress { background: #22c55e; animation: pulse 2s infinite; }
        @keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.4); } 70% { box-shadow: 0 0 0 10px rgba(34, 197, 94, 0); } 100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); } }
        
        @media (max-width: 1024px) {
           .master-grid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 768px) { .hide-mobile { display: none !important; } .analytics-scroll::-webkit-scrollbar { display: none; } }
        @media (min-width: 769px) { .mobile-only { display: none !important; } }
        
        @media print {
          .master-module-v2 * { visibility: hidden; }
          .worksheet-modal-overlay, .worksheet-modal-overlay * { visibility: visible; }
          .worksheet-modal-overlay { position: absolute; left: 0; top: 0; padding: 0; background: #fff !important; }
          .worksheet-panel { border: none !important; box-shadow: none !important; width: 100% !important; max-height: none !important; overflow: visible !important; color: #000 !important; background: #fff !important; }
          .no-print, .section-tabs, .analytics-scroll { display: none !important; }
          table { border: 1px solid #000 !important; color: #000 !important; }
          th, td { border: 1px solid #000 !important; color: #000 !important; padding: 5px !important; }
          h2 { color: #000 !important; }
        }
      `}} />
    </div>
  )
}

export default MasterModule
