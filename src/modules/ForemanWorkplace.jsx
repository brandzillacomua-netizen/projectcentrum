import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Factory, ListTodo, Loader2 } from 'lucide-react'
import { useMES } from '../MESContext'
import { QRCodeSVG } from 'qrcode.react'
import { apiService } from '../services/apiDispatcher'

const ForemanWorkplace = () => {
  const { tasks, orders, workCards, createWorkCard, completeTaskByMaster, nomenclatures, bomItems, machines } = useMES()
  const [activeTaskId, setActiveTaskId] = useState(null)
  const [printQueue, setPrintQueue] = useState(null)
  const [isGenerating, setIsGenerating] = useState(false)

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

    setIsGenerating(true)
    try {
      const cardsBatch = []
      for (let i = 1; i <= totalLoadings; i++) {
        cardsBatch.push({
          operation: 'Лазерна різка',
          machine: task.machine_name || 'Не вказано',
          estimatedTime: (Number(part.nom?.time_per_unit) || 0) * qtyPerLoading,
          cardInfo: `${i}/${totalLoadings}`,
          quantity: qtyPerLoading
        })
      }
      
      // Wait for real IDs from database
      const createdCards = await apiService.submitCreateWorkCardsBatch(task.id, task.order_id, part.nom.id, cardsBatch, createWorkCard)
      
      if (createdCards && createdCards.length > 0) {
        setPrintQueue({ 
          task, 
          part, 
          metadata: createdCards.map(c => ({ 
            id: c.id, 
            loading: c.card_info, 
            qty: qtyPerLoading 
          })) 
        })
      } else {
        alert('Помилка: Не вдалося отримати ID створених карток.')
      }
    } catch(err) {
      alert('Помилка: ' + err.message)
    } finally {
      setIsGenerating(false)
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
      <header className="module-nav">
        <Link to="/" className="back-link">
          <ArrowLeft size={18} /> <span className="hide-mobile">На головну</span>
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <Factory size={22} color="#ef4444" />
          <h1 style={{ margin: 0, textTransform: 'uppercase', fontSize: '1rem', fontWeight: 900 }}>ВИРОБНИЦТВО</h1>
        </div>
        <div style={{ fontWeight: 900, color: '#ef4444', fontSize: '0.75rem' }} className="hide-mobile">MASTER MODE</div>
      </header>

      <div className="master-grid">
        <div className="side-panel">
          <div style={{ padding: '20px', color: '#444', fontWeight: 800, fontSize: '0.65rem' }}>ЧЕРГА НАРЯДІВ</div>
          {readyTasks.map(task => {
            const order = orders.find(o => o.id === task.order_id)
            const isActive = activeTaskId === task.id
            return (
              <div key={task.id} onClick={() => setActiveTaskId(task.id)} style={{ padding: '15px', borderLeft: isActive ? '4px solid #ef4444' : '4px solid transparent', background: isActive ? '#1a1a1a' : 'transparent', cursor: 'pointer' }}>
                <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>№ {order?.order_num}</div>
                <div style={{ fontSize: '0.7rem', color: '#555' }}>{order?.customer}</div>
              </div>
            )
          })}
        </div>

        <div className="content-panel">
          {activeTaskId ? (
            (() => {
              const task = readyTasks.find(t => t.id === activeTaskId)
              const order = orders.find(o => o.id === task.order_id)
              const taskCards = workCards.filter(c => c.task_id === task.id)
              
              return (
                <div style={{ maxWidth: '1200px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', flexWrap: 'wrap', gap: '15px' }}>
                     <div>
                        <h2 style={{ fontSize: '2.4rem', fontWeight: 900, margin: 0 }}>Наряд №{order?.order_num}</h2>
                        <div style={{ color: '#555', marginTop: '5px' }}>{order?.customer} | Станція: <strong>{task.machine_name}</strong></div>
                     </div>
                     <button onClick={() => handleCloseNaryad(task.id)} className="btn-primary">ЗАКРИТИ НАРЯД</button>
                  </div>

                  <div style={{ marginBottom: '40px', background: '#111', borderRadius: '20px', overflow: 'hidden', border: '1px solid #222' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: '#1a1a1a', textAlign: 'left' }}>
                          <th style={{ padding: '18px' }}>НОМЕНКЛАТУРА</th>
                          <th style={{ padding: '18px', textAlign: 'center' }}>ПЛАН</th>
                          <th style={{ padding: '18px', textAlign: 'center' }}>ЛИСТІВ</th>
                          <th style={{ padding: '18px', textAlign: 'center' }}>КАРТОК</th>
                          <th style={{ padding: '18px', textAlign: 'center' }}>ДІЇ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {order?.order_items?.flatMap(item => {
                          const parts = getBOMParts(item.nomenclature_id)
                          const rows = parts.length > 0 ? parts : [{ nom: nomenclatures.find(n => n.id === item.nomenclature_id), quantity_per_parent: 1 }]
                          return rows.map((part, idx) => {
                            const total = item.quantity * part.quantity_per_parent
                            const sheets = Math.ceil(total / (part.nom?.units_per_sheet || 1))
                            const loadings = Math.ceil(sheets / (machines.find(m => m.name === task.machine_name)?.sheet_capacity || 1))
                            const existing = taskCards.filter(c => c.nomenclature_id === part.nom?.id || c.card_info?.includes(`NOM_ID:${part.nom?.id}`))
                            const hasCards = existing.length > 0
                            return (
                              <tr key={`${item.id}-${idx}`} style={{ borderBottom: '1px solid #1a1a1a' }}>
                                <td style={{ padding: '18px' }}>
                                  <div style={{ fontWeight: 800 }}>{part.nom?.name}</div>
                                  <div style={{ fontSize: '0.7rem', color: '#555' }}>{part.nom?.material_type}</div>
                                </td>
                                <td style={{ padding: '18px', textAlign: 'center', fontWeight: 700 }}>{total} шт</td>
                                <td style={{ padding: '18px', textAlign: 'center', color: '#10b981', fontWeight: 900 }}>{sheets}</td>
                                <td style={{ padding: '18px', textAlign: 'center', color: '#ef4444', fontWeight: 900 }}>{loadings}</td>
                                <td style={{ padding: '18px', textAlign: 'center' }}>
                                  <button onClick={() => hasCards ? setPrintQueue({ task, part, metadata: existing.map(c => ({ id: c.id, loading: c.card_info, qty: Math.floor(total/loadings) })) }) : handleGenerateFromWorksheet(task, part, sheets)} style={{ background: hasCards ? '#10b981' : '#333', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '10px', cursor: 'pointer', fontWeight: 900, fontSize: '0.7rem', textTransform: 'uppercase' }}>{hasCards ? 'ДРУК' : 'ГЕНЕРУВАТИ'}</button>
                                </td>
                              </tr>
                            )
                          })
                        })}
                      </tbody>
                    </table>
                  </div>

                  <h3 style={{ fontSize: '0.75rem', color: '#444', textTransform: 'uppercase', marginBottom: '20px' }}>Архів карток</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
                    {taskCards.map(card => {
                       const nom = nomenclatures.find(n => n.id === card.nomenclature_id || card.card_info?.includes(`NOM_ID:${n.id}`))
                       const loadingText = card.card_info?.split('|')?.pop()?.trim() || card.card_info
                       return (
                        <div key={card.id} style={{ background: '#111', padding: '15px', borderRadius: '18px', display: 'flex', gap: '15px', alignItems: 'center', border: '1px solid #222' }}>
                           <div style={{ background: '#fff', padding: '6px', borderRadius: '8px' }}><QRCodeSVG value={`CENTRUM_CARD_${card.id}`} size={50} /></div>
                           <div style={{ flex: 1 }}>
                              <div style={{ fontSize: '0.9rem', fontWeight: 800 }}>{nom?.name || 'Деталь'}</div>
                              <div style={{ fontSize: '0.65rem', color: '#555', marginTop: '4px' }}>{loadingText}</div>
                           </div>
                           <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: card.status === 'completed' ? '#10b981' : '#ef4444' }}></div>
                        </div>
                       )
                    })}
                  </div>
                </div>
              )
            })()
          ) : (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', opacity: 0.1 }}><ListTodo size={120} /><h3>Оберіть наряд</h3></div>
          )}
        </div>
      </div>

      {isGenerating && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', zIndex: 20000, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '20px' }}>
           <Loader2 size={60} color="#ef4444" className="animate-spin" />
           <h2 style={{ fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.2em' }}>Створення карток...</h2>
        </div>
      )}

      {printQueue && (
        <div className="print-overlay" style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 10000, display: 'flex', flexDirection: 'column' }}>
           <div className="no-print" style={{ padding: '15px 30px', background: '#111', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #222' }}>
             <h3>Друк: {printQueue.part.nom?.name}</h3>
             <div style={{ display: 'flex', gap: '15px' }}>
                <button onClick={() => setPrintQueue(null)} style={{ background: '#222', color: '#888', border: 'none', padding: '12px 25px', borderRadius: '10px', cursor: 'pointer', fontWeight: 700 }}>СКАСУВАТИ</button>
                <button onClick={() => window.print()} style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '12px 30px', borderRadius: '10px', cursor: 'pointer', fontWeight: 900 }}>ДРУК А4</button>
             </div>
           </div>
           <div className="print-scroll" style={{ flex: 1, overflowY: 'auto', background: '#1a1a1a', padding: '40px 20px' }}>
              <div className="printable-content" style={{ width: '210mm', margin: '0 auto' }}>
                 {printQueue.metadata.map((m, i) => (
                    <div key={i} className="a4-page" style={{ width: '210mm', height: '296mm', padding: '10mm', breakAfter: 'page', pageBreakAfter: 'always', backgroundColor: '#fff', color: '#000', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
                       <div style={{ border: '2px solid #000', padding: '15mm', height: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
                          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                             <h1 style={{ margin: '0 0 15px', fontSize: '42pt', fontWeight: 900, textTransform: 'uppercase' }}>РОБОЧА КАРТА</h1>
                             <div style={{ fontSize: '18pt', fontWeight: 700, color: '#333' }}>
                                {printQueue.task.machine_name} | Завантаження: {m.loading?.split('|')?.pop() || m.loading}
                             </div>
                          </div>
                          <div style={{ borderTop: '2px solid #000', margin: '20px 0' }}></div>
                          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                             <div style={{ fontSize: '14pt', opacity: 0.4, textTransform: 'uppercase', marginBottom: '10px' }}>деталь:</div>
                             <div style={{ fontSize: '32pt', fontWeight: 900, marginBottom: '40px', textAlign: 'center', width: '100%' }}>{printQueue.part.nom?.name}</div>
                             <div style={{ background: '#f5f5f5', width: '100%', padding: '40px 20px', borderRadius: '15px', textAlign: 'center', margin: '20px 0' }}>
                                <div style={{ fontSize: '90pt', fontWeight: 900, lineHeight: 1 }}>{m.qty} <small style={{ fontSize: '30pt' }}>шт</small></div>
                             </div>
                          </div>
                          <div style={{ borderTop: '2px solid #000', margin: '20px 0' }}></div>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingBottom: '20px' }}>
                             <QRCodeSVG value={`CENTRUM_CARD_${m.id}`} size={300} />
                             <div style={{ fontSize: '10pt', color: '#999', marginTop: '10px' }}>ID: {m.id}</div>
                          </div>
                       </div>
                    </div>
                 ))}
              </div>
           </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page { size: A4; margin: 0; }
          body { background: #fff !important; }
          #root > *:not(.print-overlay) { display: none !important; }
          .print-overlay { position: static !important; display: block !important; width: 100% !important; background: #fff !important; }
          .no-print { display: none !important; }
          .print-scroll { overflow: visible !important; height: auto !important; padding: 0 !important; }
          .a4-page { margin: 0 !important; box-shadow: none !important; break-after: page; page-break-after: always; }
        }
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}} />
    </div>
  )
}

export default ForemanWorkplace
