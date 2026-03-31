import React, { useState, useMemo } from 'react'
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
  Menu,
  Printer,
  Info,
  CheckCircle2
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useMES } from '../MESContext'
import { apiService } from '../services/apiDispatcher'

const MasterModule = () => {
  const { orders, tasks, createNaryad, nomenclatures, bomItems, machines } = useMES()
  const [activeNaryadOrder, setActiveNaryadOrder] = useState(null)
  const [selectedMachine, setSelectedMachine] = useState(null)
  const [activeMobileSection, setActiveMobileSection] = useState('active') // active, history
  const [searchQuery, setSearchQuery] = useState('')
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [isReprintMode, setIsReprintMode] = useState(false)

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

  const handleReprint = (task) => {
    const order = orders.find(o => o.id === task.order_id)
    const machine = machines.find(m => m.name === task.machine_name)
    if (order) {
      setIsReprintMode(true)
      setSelectedMachine(machine || null)
      setActiveNaryadOrder(order)
    }
  }

  const materialSummary = useMemo(() => {
    if (!activeNaryadOrder) return []
    const summary = {}

    activeNaryadOrder.order_items?.forEach(item => {
      const parts = getBOMParts(item.nomenclature_id)
      const displayParts = parts.length > 0 ? parts : [{ nom: nomenclatures.find(n => n.id === item.nomenclature_id), quantity_per_parent: 1 }]
      
      displayParts.forEach(part => {
        if (!part.nom) return
        const totalToProduce = item.quantity * (part.quantity_per_parent || 1)
        const sheets = Math.ceil(totalToProduce / (part.nom.units_per_sheet || 1))
        const matKey = part.nom.material_type || 'Інші ТМЦ'
        
        if (!summary[matKey]) summary[matKey] = { name: matKey, sheets: 0 }
        summary[matKey].sheets += sheets
      })
    })
    return Object.values(summary)
  }, [activeNaryadOrder, nomenclatures, bomItems])

  const productNames = useMemo(() => {
    if (!activeNaryadOrder) return ''
    return activeNaryadOrder.order_items
      ?.map(it => nomenclatures.find(n => n.id === it.nomenclature_id)?.name)
      .filter(Boolean)
      .join(', ')
  }, [activeNaryadOrder, nomenclatures])

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
               <button onClick={() => { setIsReprintMode(false); setSelectedMachine(null); setActiveNaryadOrder(order); setIsDrawerOpen(false); }} style={{ width: '100%', padding: '10px', background: '#ff9000', color: '#000', border: 'none', borderRadius: '8px', fontWeight: 900, cursor: 'pointer', fontSize: '0.75rem' }}>СФОРМУВАТИ НАРЯД</button>
            </div>
          ))}
       </div>
    </section>
  )

  return (
    <div className="master-module-v2" style={{ background: '#0a0a0a', minHeight: '100vh', color: '#fff', display: 'flex', flexDirection: 'column' }}>
      <nav className="module-nav no-print" style={{ flexShrink: 0, padding: '0 20px', height: '70px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#000', borderBottom: '1px solid #222' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
           <Link to="/" className="back-link" style={{ color: '#555', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}><ArrowLeft size={18} /> <span className="hide-mobile">Назад</span></Link>
           <button onClick={() => setIsDrawerOpen(true)} className="burger-btn mobile-only"><Menu size={24} /></button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <ClipboardCheck className="text-accent" size={24} color="#ff9000" />
          <h1 style={{ fontSize: '1rem', fontWeight: 900, textTransform: 'uppercase', margin: 0 }} className="hide-mobile">Керування виробництвом</h1>
        </div>
        <div className="hide-mobile" style={{ fontSize: '0.8rem', color: '#444', fontWeight: 700 }}>СИСТЕМА MES v2.1</div>
      </nav>

      <div className="module-content no-print" style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
        <div className="hide-mobile">
           {renderAnalytics()}
        </div>

        <div className="master-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 320px) 1fr minmax(280px, 300px)', gap: '25px' }}>
          <div className="hide-mobile">{renderOrderQueue()}</div>

          <section className="grid-col">
             <h3 style={{ fontSize: '0.85rem', color: '#555', marginBottom: '15px' }}><Play size={16} fill="currentColor" /> АКТИВНІ В ЦЕХУ</h3>
             <div className="v-stack" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {tasks.filter(t => t.status !== 'completed' && t.status !== 'pending').map(task => {
                  const order = orders.find(o => o.id === task.order_id)
                  
                  // Product name for the card based on real BOM/items
                  const taskProductNames = order?.order_items
                    ?.map(it => nomenclatures.find(n => n.id === it.nomenclature_id)?.name)
                    .filter(Boolean)
                    .join(', ') || 'Виріб...'

                  // Real confirmation binding from task object
                  const isSkladConfirmed = task.warehouse_conf === true
                  const isTechConfirmed = task.engineer_conf === true
                  
                  return (
                    <div key={task.id} style={{ position: 'relative', background: '#111', padding: '20px', borderRadius: '20px', border: '1px solid #222', borderLeft: '4px solid #ff9000' }}>
                       <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <strong style={{ fontSize: '1rem', fontWeight: 900 }}>{order?.order_num} — {order?.customer}</strong>
                          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                             <button onClick={() => handleReprint(task)} style={{ background: 'transparent', border: 'none', color: '#555', cursor: 'pointer' }} title="Друк наряду"><Printer size={20} /></button>
                             {isSkladConfirmed && isTechConfirmed && <div style={{ width: '10px', height: '10px', background: '#22c55e', borderRadius: '2px' }}></div>}
                          </div>
                       </div>
                       
                       <div className="card-product-label" style={{ fontSize: '0.85rem', color: '#fff', fontWeight: 1000, marginBottom: '12px', textTransform: 'uppercase' }}>
                          {taskProductNames}
                       </div>

                       <div style={{ fontSize: '0.75rem', color: '#444', fontWeight: 600, marginBottom: '15px', display: 'flex', gap: '10px' }}>
                          <span>{task.step} |</span>
                          <span style={{ color: '#ff9000', fontWeight: 800 }}>{task.machine_name}</span>
                       </div>

                       <div style={{ display: 'flex', gap: '8px' }}>
                          <div style={{ 
                             fontSize: '0.65rem', 
                             padding: '5px 12px', 
                             borderRadius: '8px', 
                             background: isSkladConfirmed ? '#064e3b' : '#1a1a1a', 
                             color: isSkladConfirmed ? '#10b981' : '#333', 
                             fontWeight: 1000,
                             border: isSkladConfirmed ? '1px solid #10b981' : '1px solid #222'
                          }}>СКЛАД</div>
                          <div style={{ 
                             fontSize: '0.65rem', 
                             padding: '5px 12px', 
                             borderRadius: '8px', 
                             background: isTechConfirmed ? '#064e3b' : '#1a1a1a', 
                             color: isTechConfirmed ? '#10b981' : '#333', 
                             fontWeight: 1000,
                             border: isTechConfirmed ? '1px solid #10b981' : '1px solid #222'
                          }}>ТЕХНОЛОГ</div>
                       </div>
                    </div>
                  )
                })}
             </div>
          </section>

          <section className="grid-col">
             <h3 style={{ fontSize: '0.85rem', color: '#555', marginBottom: '15px' }}><History size={16} /> АРХІВ СЬОГОДНІ</h3>
          </section>
        </div>
      </div>

      {activeNaryadOrder && (
        <div className="worksheet-modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '15px' }}>
          <div className="worksheet-panel glass-panel" style={{ background: '#0a0a0a', width: '100%', maxWidth: '1000             <div className="worksheet-header-area" style={{ padding: '35px 45px', background: '#0a0a0a', borderBottom: '1px solid #1a1a1a', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                   <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                      <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                         <h2 className="doc-ti" style={{ margin: 0, fontSize: '1.8rem', color: '#ff9000', fontWeight: 950, letterSpacing: '-0.02em' }}>НАРЯД № {activeNaryadOrder.order_num}</h2>
                         {selectedMachine && (
                           <div className="print-machine-tag" style={{ border: '2.5px solid #ff9000', padding: '6px 16px', borderRadius: '12px', color: '#ff9000', fontSize: '0.95rem', fontWeight: 1000, textTransform: 'uppercase' }}>{selectedMachine.name}</div>
                         )}
                      </div>
                      <button onClick={() => setActiveNaryadOrder(null)} className="no-print" style={{ background: '#111', border: '1px solid #222', color: '#555', cursor: 'pointer', width: '45px', height: '45px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: '0.2s' }}><X size={24} /></button>
                   </div>
                   
                   <div style={{ background: '#111', padding: '20px 25px', borderRadius: '20px', border: '1px solid #1a1a1a' }}>
                      <div className="print-prod-info" style={{ fontSize: '1.25rem', color: '#fff', fontWeight: 1000, marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '4px', height: '24px', background: '#ff9000', borderRadius: '2px' }}></div>
                        ВИРІБ: <span style={{ color: '#ff9000' }}>{productNames}</span>
                      </div>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '25px' }}>
                         <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                            <span style={{ fontSize: '0.65rem', color: '#555', fontWeight: 900, textTransform: 'uppercase' }}>ЗАМОВНИК</span>
                            <span style={{ fontSize: '1rem', fontWeight: 800, color: '#eee' }}>{activeNaryadOrder.customer}</span>
                         </div>
                         <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                            <span style={{ fontSize: '0.65rem', color: '#555', fontWeight: 900, textTransform: 'uppercase' }}>ДАТА ФОРМУВАННЯ</span>
                            <span style={{ fontSize: '1rem', fontWeight: 800, color: '#eee' }}>{new Date().toLocaleDateString('uk-UA')}</span>
                         </div>
                         <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                            <span style={{ fontSize: '0.65rem', color: '#555', fontWeight: 900, textTransform: 'uppercase' }}>СТАТУС</span>
                            <span style={{ fontSize: '1rem', fontWeight: 800, color: '#22c55e' }}>ПІДГОТОВКА</span>
                         </div>
                      </div>
                   </div>
                </div>
             </div>
iveNaryadOrder(null)} className="no-print" style={{ background: 'transparent', border: 'none', color: '#444', cursor: 'pointer' }}><X size={30} /></button>
             </div>

             <div className="worksheet-scrollable" style={{ flex: 1, overflowY: 'auto', padding: '30px 40px' }}>
                {!isReprintMode && (
                  <div className="no-print" style={{ marginBottom: '25px' }}>
                    <div style={{ fontSize: '0.7rem', color: '#555', fontWeight: 900, textTransform: 'uppercase', marginBottom: '10px' }}>Оберіть обладнання:</div>
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        {machines.map(m => (
                          <button key={m.id} onClick={() => setSelectedMachine(m)} style={{ background: selectedMachine?.id === m.id ? '#ff9000' : '#1a1a1a', color: selectedMachine?.id === m.id ? '#000' : '#888', border: 'none', padding: '10px 20px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 900, cursor: 'pointer' }}>{m.name}</button>
                        ))}
                    </div>
                  </div>
                )}

                <div className="table-responsive-container" style={{ marginBottom: '35px' }}>
                   <table className="print-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                      <thead>
                        <tr style={{ background: '#111', textAlign: 'left', color: '#555' }}>
                           <th style={{ padding: '12px 15px', width: '30%', borderBottom: '1.5px solid #222' }}>ДЕТАЛЬ В ПОРІЗКУ</th>
                           <th style={{ padding: '12px 15px', textAlign: 'center', width: '8%', borderBottom: '1.5px solid #222' }}>ПЛАН</th>
                           <th style={{ padding: '12px 15px', textAlign: 'center', width: '22%', borderBottom: '1.5px solid #222' }}>МАТЕРІАЛ</th>
                           <th style={{ padding: '12px 15px', textAlign: 'center', width: '10%', borderBottom: '1.5px solid #222' }}>ШТ/Л</th>
                           <th style={{ padding: '12px 15px', textAlign: 'center', color: '#22c55e', width: '10%', borderBottom: '1.5px solid #222' }}>ЛИСТІВ</th>
                           <th style={{ padding: '12px 15px', textAlign: 'center', color: '#3b82f6', width: '10%', borderBottom: '1.5px solid #222' }}>ЗА�                       <tbody>
                        {activeNaryadOrder.order_items?.map(item => {
                           const parts = getBOMParts(item.nomenclature_id)
                           const displayParts = parts.length > 0 ? parts : [{ nom: nomenclatures.find(n => n.id === item.nomenclature_id), quantity_per_parent: 1 }]
                           return displayParts.map((part, pIdx) => {
                              const totalToProduce = item.quantity * (part.quantity_per_parent || 1)
                              const sheets = Math.ceil(totalToProduce / (part.nom?.units_per_sheet || 1))
                              const loads = selectedMachine ? Math.ceil(sheets / selectedMachine.sheet_capacity) : 1
                              const surplus = (sheets * (part.nom?.units_per_sheet || 1)) - totalToProduce
                              return (
                                <tr key={`${item.id}-${pIdx}`} style={{ borderBottom: '1px solid #1a1a1a', background: pIdx % 2 === 0 ? 'transparent' : 'rgba(255,144,0,0.02)' }}>
                                   <td style={{ padding: '18px 15px' }}>
                                      <div style={{ fontWeight: 1000, color: '#fff', fontSize: '0.95rem', marginBottom: '4px' }}>{part.nom?.name}</div>
                                      <div style={{ fontSize: '0.7rem', color: '#444', fontWeight: 800 }}>{part.nom?.nomenclature_code || 'БЕЗ КОДУ'}</div>
                                   </td>
                                   <td style={{ padding: '18px 15px', textAlign: 'center', fontWeight: 800, fontSize: '1rem' }}>{totalToProduce}</td>
                                   <td style={{ padding: '18px 15px', textAlign: 'center' }}>
                                      <div style={{ fontSize: '0.85rem', color: '#aaa', fontWeight: 700 }}>{part.nom?.material_type}</div>
                                   </td>
                                   <td style={{ padding: '18px 15px', textAlign: 'center', color: '#555' }}>{part.nom?.units_per_sheet || 1}</td>
                                   <td style={{ padding: '18px 15px', textAlign: 'center', fontWeight: 1000, color: '#22c55e', fontSize: '1.2rem' }}>{sheets}</td>
                                   <td style={{ padding: '18px 15px', textAlign: 'center', fontWeight: 1000, color: '#3b82f6' }}>{loads}</td>
                                   <td style={{ padding: '18px 15px', textAlign: 'center', fontWeight: 900, color: '#ff9000' }}>{surplus > 0 ? `+${surplus}` : '0'}</td>
                                </tr>
                              )
                           })
                        })}
                       </tbody>
                       <tfoot style={{ background: 'rgba(255,144,0,0.05)', borderTop: '2px solid #ff9000' }}>
                          <tr>
                             <td style={{ padding: '20px 15px', fontWeight: 1000, fontSize: '1rem', textTransform: 'uppercase' }}>ЗАГАЛЬНИЙ ПІДСУМОК:</td>
                             <td style={{ padding: '20px 15px', textAlign: 'center', fontWeight: 1000, fontSize: '1.1rem' }}>
                                {activeNaryadOrder.order_items?.reduce((acc, it) => {
                                  const parts = getBOMParts(it.nomenclature_id)
                                  const qty = parts.length > 0 ? parts.reduce((pa, p) => pa + (it.quantity * (p.quantity_per_parent || 1)), 0) : it.quantity
                                  return acc + qty
                                }, 0)}
                             </td>
                             <td></td>
                             <td></td>
                             <td style={{ padding: '20px 15px', textAlign: 'center', fontWeight: 1000, fontSize: '1.4rem', color: '#22c55e' }}>
                                {activeNaryadOrder.order_items?.reduce((acc, it) => {
                                  const parts = getBOMParts(it.nomenclature_id)
                                  const displayParts = parts.length > 0 ? parts : [{ nom: nomenclatures.find(n => n.id === it.nomenclature_id), quantity_per_parent: 1 }]
                                  const sh = displayParts.reduce((pa, p) => pa + Math.ceil((it.quantity * (p.quantity_per_parent || 1)) / (p.nom?.units_per_sheet || 1)), 0)
                                  return acc + sh
                                }, 0)}
                             </td>
                             <td style={{ padding: '20px 15px', textAlign: 'center', fontWeight: 1000, fontSize: '1.1rem', color: '#3b82f6' }}>
                                {activeNaryadOrder.order_items?.reduce((acc, it) => {
                                  const parts = getBOMParts(it.nomenclature_id)
                                  const displayParts = parts.length > 0 ? parts : [{ nom: nomenclatures.find(n => n.id === it.nomenclature_id), quantity_per_parent: 1 }]
                                  const lds = displayParts.reduce((pa, p) => {
                                    const sh = Math.ceil((it.quantity * (p.quantity_per_parent || 1)) / (p.nom?.units_per_sheet || 1))
                                    return pa + (selectedMachine ? Math.ceil(sh / selectedMachine.sheet_capacity) : 1)
                                  }, 0)
                                  return acc + lds
                                }, 0)}
                             </td>
                             <td></td>
                          </tr>
                       </tfoot>
ontWeight: 900, color: '#ff9000' }}>{surplus > 0 ? `+${surplus}` : '0'}</td>
                                </tr>
                              )
                           })
                        })}
                      </tbody>
                   </table>
                </div>

                {materialSummary.length > 0 && (
                  <div className="mat-summary-section" style={{ marginTop: '25px', padding: '20px 30px', borderRadius: '18px', border: '1px solid #222', background: '#070707' }}>
                     <h4 style={{ margin: '0 0 15px', fontSize: '0.75rem', fontWeight: 950, color: '#444', textTransform: 'uppercase' }}>ВІДОМІСТЬ МАТЕРІАЛІВ:</h4>
                     <div className="mat-flex-row" style={{ display: 'flex', flexWrap: 'nowrap', gap: '25px', overflowX: 'hidden' }}>
                        {materialSummary.map((m, idx) => (
                           <div key={idx} className="mat-card-p" style={{ flex: 1, padding: '0 0 5px 15px', borderLeft: '4px solid #ff9000', minWidth: 'min-content' }}>
                              <div style={{ fontSize: '0.85rem', color: '#fff', fontWeight: 800, marginBottom: '5px', whiteSpace: 'nowrap' }}>{m.name}</div>
                              <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
                                 <span style={{ fontSize: '2.2rem', fontWeight: 1000, color: '#22c55e', lineHeight: 1 }}>{m.sheets}</span>
                                 <span style={{ fontSize: '0.75rem', color: '#555', fontWeight: 900 }}>ЛИСТІВ</span>
                              </div>
                           </div>
                        ))}
                     </div>
                  </div>
                )}
             </div>

             <div className="worksheet-footer no-print" style={{ padding: '25px 40px', background: '#111', borderTop: '1px solid #222', display: 'flex', gap: '15px' }}>
                <button onClick={() => setActiveNaryadOrder(null)} style={{ flex: 1, padding: '16px', borderRadius: '14px', background: '#1a1a1a', color: '#555', border: 'none', fontWeight: 900, cursor: 'pointer' }}>СКАСУВАТИ</button>
                <button 
                  disabled={!selectedMachine}
                  onClick={() => { window.print(); if(!isReprintMode) apiService.submitCreateTask(activeNaryadOrder.id, selectedMachine?.name, createNaryad); setActiveNaryadOrder(null); }} 
                  style={{ 
                    flex: 2, 
                    padding: '16px', 
                    borderRadius: '14px', 
                    background: selectedMachine ? '#22c55e' : '#1a1a1a', 
                    color: selectedMachine ? '#000' : '#444', 
                    border: 'none', 
                    fontWeight: 950, 
                    cursor: selectedMachine ? 'pointer' : 'not-allowed',
                    opacity: selectedMachine ? 1 : 0.6,
                    transition: 'all 0.2s'
                  }}
                >
                  ДРУКУВАТИ
                </button>
             </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page { margin: 20mm; size: A4; }
          * { background: #fff !important; color: #000 !important; box-sizing: border-box !important; -webkit-print-color-adjust: exact !important; }
          body, html { margin: 0 !important; padding: 0 !important; height: auto !important; overflow: visible !important; }
          nav, .module-content, .drawer-backdrop, .side-drawer, .no-print, .worksheet-modal-overlay::before { display: none !important; }
          
          .master-module-v2 { background: #fff !important; min-height: auto !important; position: static !important; }
          .worksheet-modal-overlay { position: static !important; background: transparent !important; padding: 0 !important; display: block !important; overflow: visible !important; }
          
          .worksheet-panel { 
            position: static !important; 
            width: 85% !important; /* Більше відступу від країв */
            margin: 10mm auto 0 auto !important; /* Менший відступ згори */
            padding: 0 !important; 
            background: #fff !important; 
            border: none !important; 
            border-radius: 0 !important; 
            overflow: visible !important; 
            box-shadow: none !important;
            zoom: 0.8; /* Масштабування 80% */
          }
          
          .worksheet-header-area { border-bottom: 4px solid #000 !important; padding: 0 0 20px 0 !important; margin-bottom: 25px !important; background: transparent !important; }
          .doc-ti { font-size: 2.2rem !important; font-weight: 1000 !important; margin-bottom: 10px !important; color: #000 !important; }
          .print-prod-info { border-left: 12px solid #000 !important; font-size: 1.5rem !important; padding-left: 22px !important; margin-bottom: 15px !important; color: #000 !important; }
          .print-customer-info { font-size: 1rem !important; color: #000 !important; }
          .print-customer-info strong { color: #000 !important; }

          .worksheet-scrollable { padding: 0 !important; overflow: visible !important; }
          .table-responsive-container { overflow: visible !important; margin-bottom: 30px !important; }
          
          .print-table { border: 2.5px solid #000 !important; width: 100% !important; table-layout: fixed !important; border-collapse: collapse !important; }
          .print-table th { border-bottom: 2.5px solid #000 !important; border-right: 1.5px solid #000 !important; background: #eee !important; font-size: 0.85rem !important; padding: 10px 5px !important; }
          .print-table td { border-bottom: 1.5px solid #000 !important; border-right: 1.5px solid #000 !important; font-size: 0.95rem !important; padding: 10px 8px !important; font-weight: 700 !important; }
          .print-table tr:last-child td { border-bottom: none !important; }
          .print-table td:last-child, .print-table th:last-child { border-right: none !important; }

          .mat-summary-section { border: 4px solid #000 !important; margin-top: 40px !important; padding: 25px !important; background: #fff !important; border-radius: 0 !important; }
          .mat-flex-row { display: flex !important; flex-wrap: wrap !important; gap: 40px !important; }
          .mat-card-p { border-left: 6px solid #000 !important; padding: 5px 0 5px 20px !important; }
        }
      `}} />
    </div>
  )
}

export default MasterModule
