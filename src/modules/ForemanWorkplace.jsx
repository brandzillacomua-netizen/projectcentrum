import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Factory, ListTodo, Printer, Cpu, Plus, X } from 'lucide-react'
import { useMES } from '../MESContext'
import { QRCodeSVG } from 'qrcode.react'
import { apiService } from '../services/apiDispatcher'

const ForemanWorkplace = () => {
  const { tasks, orders, workCards, createWorkCard, completeTaskByMaster, nomenclatures, bomItems, machines } = useMES()
  const [activeTaskId, setActiveTaskId] = useState(null)
  const [showAddCard, setShowAddCard] = useState(false)
  const [newCard, setNewCard] = useState({ operation: 'Лазерна різка', machine: '', estimatedTime: '', nomenclatureId: '' })
  const [printQueue, setPrintQueue] = useState(null)

  const getBOMParts = (nomenclatureId) => {
    return bomItems
      .filter(b => b.parent_id === nomenclatureId)
      .map(b => ({
        ...b,
        nom: nomenclatures.find(n => n.id === b.child_id)
      }))
  }

  const readyTasks = tasks.filter(t => t.warehouse_conf && t.engineer_conf && t.status !== 'completed')

  const handleGenerateFromWorksheet = async (task, part, sheets) => {
    const machineObj = machines.find(m => m.name === task.machine_name)
    const capacity = machineObj?.sheet_capacity || 1
    const totalLoadings = Math.ceil(sheets / capacity)
    const qtyPerLoading = Math.floor((part.nom?.units_per_sheet || 1) * (sheets / totalLoadings))

    try {
      const cardsBatch = []
      for (let i = 1; i <= totalLoadings; i++) {
        cardsBatch.push({
          operation: 'Лазерна різка',
          machine: task.machine_name || 'Не вказано',
          estimatedTime: (Number(part.nom?.time_per_unit) || 0) * qtyPerLoading,
          cardInfo: `${i}/${totalLoadings}`
        })
      }
      await apiService.submitCreateWorkCardsBatch(task.id, task.order_id, part.nom.id, cardsBatch, createWorkCard)
      setPrintQueue({ task, part, metadata: cardsBatch.map(c => ({ loading: c.cardInfo, qty: qtyPerLoading })) })
    } catch(err) {
      alert('Помилка: ' + err.message)
    }
  }

  const handleCloseNaryad = async (taskId) => {
    if (window.confirm("Дійсно закрити наряд?")) {
      await apiService.submitCompleteTaskByMaster(taskId, completeTaskByMaster)
      setActiveTaskId(null)
    }
  }

  return (
    <div className="foreman-module" style={{ background: '#0a0a0a', minHeight: '100vh', color: '#fff', display: 'flex', flexDirection: 'column' }}>
      <nav className="module-nav" style={{ flexShrink: 0 }}>
        <Link to="/" className="back-link">
          <ArrowLeft size={18} /> <span className="hide-mobile">На головну</span>
        </Link>
        <div className="module-title-group">
          <Factory size={22} color="#ef4444" />
          <h1 style={{ margin: 0, textTransform: 'uppercase', letterSpacing: '0.1em' }} className="hide-mobile">ВИРОБНИЦТВО</h1>
          <h1 style={{ margin: 0, fontSize: '1rem' }} className="mobile-only">ВИРОБНИЦТВО</h1>
        </div>
        <div style={{ fontWeight: 900, color: '#ef4444' }} className="hide-mobile">MASTER MODE</div>
      </nav>

      <div className="main-layout-responsive">
        {/* Left Side: Tasks Sidebar */}
        <div className="side-panel mini-sidebar-target" style={{ background: '#111', borderRight: '1px solid #222', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
          <div style={{ padding: '20px', borderBottom: '1px solid #222', color: '#555', fontWeight: 800, fontSize: '0.7rem', textTransform: 'uppercase' }} className="hide-mobile">
            Черга нарядів
          </div>
          <div style={{ padding: '10px' }}>
            {readyTasks.map(task => {
              const order = orders.find(o => o.id === task.order_id)
              const isActive = activeTaskId === task.id
              return (
                <div key={task.id} onClick={() => setActiveTaskId(task.id)} style={{ padding: '15px', borderRadius: '12px', background: isActive ? '#ef4444' : '#1a1a1a', border: '1px solid', borderColor: isActive ? '#ef4444' : '#333', marginBottom: '8px', cursor: 'pointer', transition: '0.2s' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ fontSize: '0.9rem' }}>№ {order?.order_num}</strong>
                    <Cpu size={12} opacity={0.5} />
                  </div>
                  <div style={{ fontSize: '0.75rem', opacity: 0.6, marginTop: '4px' }} className="hide-mobile">{order?.customer}</div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Right Side: Workspace */}
        <div className="content-panel" style={{ padding: '20px', overflowY: 'auto' }}>
          {activeTaskId ? (
            (() => {
              const task = readyTasks.find(t => t.id === activeTaskId)
              const order = orders.find(o => o.id === task.order_id)
              const taskCards = workCards.filter(c => c.task_id === task.id)
              
              return (
                <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', flexWrap: 'wrap', gap: '15px' }}>
                     <div>
                        <h2 style={{ fontSize: '2.2rem', fontWeight: 900, margin: 0 }}>Наряд №{order?.order_num}</h2>
                        <p style={{ color: '#666', margin: '5px 0' }}>{order?.customer} | Станція: <strong>{task.machine_name}</strong></p>
                     </div>
                     <div style={{ display: 'flex', gap: '10px' }}>
                        <button onClick={() => window.print()} className="btn-primary" style={{ padding: '10px 20px', background: '#333', color: '#fff' }}><Printer size={18} /></button>
                        <button onClick={() => handleCloseNaryad(task.id)} className="btn-primary" style={{ padding: '10px 25px' }}>ЗАКРИТИ НАРЯД</button>
                     </div>
                  </div>

                  {/* Production Worksheet Table */}
                  <div className="table-responsive-container" style={{ marginBottom: '40px' }}>
                    <table>
                      <thead>
                        <tr style={{ background: '#111' }}>
                          <th className="sticky-col" style={{ padding: '15px', textAlign: 'left' }}>НОМЕНКЛАТУРА</th>
                          <th style={{ padding: '15px', textAlign: 'center' }}>ПЛАН</th>
                          <th style={{ padding: '15px', textAlign: 'center' }}>ЛИСТІВ</th>
                          <th style={{ padding: '15px', textAlign: 'center' }}>ЗАЛИШОК</th>
                          <th style={{ padding: '15px', textAlign: 'center' }}>КАРТОК</th>
                          <th style={{ padding: '15px', textAlign: 'center' }}>ДІЇ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {order?.order_items?.flatMap(item => {
                          const parts = getBOMParts(item.nomenclature_id)
                          const rows = parts.length > 0 ? parts : [{ nom: nomenclatures.find(n => n.id === item.nomenclature_id), quantity_per_parent: 1 }]
                          
                          return rows.map((part, idx) => {
                            const total = item.quantity * part.quantity_per_parent
                            const perSheet = part.nom?.units_per_sheet || 1
                            const sheets = Math.ceil(total / perSheet)
                            const loadings = Math.ceil(sheets / (machines.find(m => m.name === task.machine_name)?.sheet_capacity || 1))
                            const existing = taskCards.filter(c => c.nomenclature_id === part.nom?.id || c.card_info?.includes(`NOM_ID:${part.nom?.id}`))
                            const hasCards = existing.length > 0

                            return (
                              <tr key={`${item.id}-${idx}`} style={{ borderBottom: '1px solid #1a1a1a' }}>
                                <td className="sticky-col" style={{ padding: '15px', fontWeight: 700 }}>
                                  {part.nom?.name}
                                  <div style={{ fontSize: '0.6rem', color: '#555' }}>{part.nom?.cnc_program || 'CNC-DEFAULT'}</div>
                                </td>
                                <td style={{ padding: '15px', textAlign: 'center' }}>{total} шт</td>
                                <td style={{ padding: '15px', textAlign: 'center', color: '#10b981', fontWeight: 800 }}>{sheets}</td>
                                <td style={{ padding: '15px', textAlign: 'center', color: '#888' }}>{(sheets * perSheet) - total}</td>
                                <td style={{ padding: '15px', textAlign: 'center', color: '#ef4444', fontWeight: 800 }}>{loadings}</td>
                                <td style={{ padding: '15px', textAlign: 'center' }}>
                                  <button 
                                    onClick={() => hasCards ? setPrintQueue({ task, part, metadata: existing.map(c => ({ loading: c.card_info, qty: Math.floor(perSheet * (sheets/existing.length)) })) }) : handleGenerateFromWorksheet(task, part, sheets)}
                                    style={{ background: hasCards ? '#10b981' : '#ef4444', color: '#fff', border: 'none', padding: '8px 15px', borderRadius: '8px', cursor: 'pointer', fontWeight: 900, fontSize: '0.7rem' }}
                                  >
                                    {hasCards ? 'ДРУК' : 'ГЕНЕРУВАТИ'}
                                  </button>
                                </td>
                              </tr>
                            )
                          })
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Cards Archive Section */}
                  <h3 style={{ fontSize: '0.9rem', color: '#fff', textTransform: 'uppercase', marginBottom: '20px', opacity: 0.5 }}>АРХІВ КАРТОК</h3>
                  <div className="mobile-card-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '15px' }}>
                    {taskCards.map(card => {
                      const nom = nomenclatures.find(n => n.id === card.nomenclature_id) || nomenclatures.find(n => card.card_info?.includes(`NOM_ID:${n.id}`))
                      return (
                        <div key={card.id} className="mobile-card" style={{ background: '#151515', border: '1px solid #222', borderRadius: '16px', padding: '12px', display: 'flex', gap: '15px', alignItems: 'center' }}>
                          <div style={{ background: '#fff', padding: '5px', borderRadius: '8px' }}>
                            <QRCodeSVG value={`CENTRUM_CARD_${card.id}`} size={60} />
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '0.6rem', color: '#ef4444', fontWeight: 900 }}>{card.operation}</div>
                            <h4 style={{ margin: '2px 0', fontSize: '1rem', fontWeight: 800 }}>{nom?.name || 'Деталь'}</h4>
                            <div style={{ fontSize: '0.7rem', color: '#555' }}>{card.card_info} | {card.status === 'completed' ? 'ГОТОВО' : 'В РОБОТІ'}</div>
                          </div>
                          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: card.status === 'completed' ? '#10b981' : '#ef4444' }}></div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })()
          ) : (
             <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', color: '#333' }}>
                <ListTodo size={60} style={{ marginBottom: '15px' }} />
                <h3>Оберіть наряд для перегляду</h3>
             </div>
          )}
        </div>
      </div>

      {printQueue && (
        <div className="print-overlay" style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 9999, display: 'flex', flexDirection: 'column' }}>
           <div className="no-print" style={{ padding: '15px 30px', background: '#111', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
             <h3>Попередній перегляд: {printQueue.part.nom?.name}</h3>
             <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => setPrintQueue(null)} className="btn-primary" style={{ background: '#333', color: '#888' }}>BACK</button>
                <button onClick={() => window.print()} className="btn-primary">DRUK A4</button>
             </div>
           </div>
           <div className="print-scroll" style={{ flex: 1, overflowY: 'auto', background: '#222', padding: '20px' }}>
              <div className="printable-content" style={{ width: '210mm', margin: '0 auto', background: '#fff' }}>
                 {printQueue.metadata.map((m, i) => (
                    <div key={i} className="a4-page" style={{ width: '210mm', height: '297mm', padding: '10mm', pageBreakAfter: 'always', color: '#000' }}>
                       <div style={{ border: '5px solid #000', padding: '30px', height: '100%', display: 'flex', flexDirection: 'column', textAlign: 'center', justifyContent: 'space-between' }}>
                          <h1 style={{ margin: 0, fontSize: '36pt', fontWeight: 900 }}>РОБОЧА КАРТА</h1>
                          <div style={{ fontSize: '18pt', fontWeight: 800 }}>Завантаження: {m.loading}</div>
                          <div style={{ margin: '40px 0' }}>
                             <div style={{ fontSize: '14pt', opacity: 0.6 }}>ДЕТАЛЬ:</div>
                             <div style={{ fontSize: '28pt', fontWeight: 900 }}>{printQueue.part.nom?.name}</div>
                          </div>
                          <div style={{ background: '#f0f0f0', padding: '40px', fontSize: '70pt', fontWeight: 900 }}>{m.qty} <small style={{ fontSize: '20pt' }}>шт</small></div>
                          <div style={{ display: 'flex', justifyContent: 'center' }}><QRCodeSVG value={`CENTRUM_CARD_${i}`} size={250} /></div>
                       </div>
                    </div>
                 ))}
              </div>
           </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * { visibility: hidden; }
          .print-overlay, .print-overlay * { visibility: visible; }
          .print-overlay { position: absolute !important; inset: 0 !important; width: 100% !important; background: #fff !important; }
          .no-print { display: none !important; }
        }
      `}} />
    </div>
  )
}

export default ForemanWorkplace
