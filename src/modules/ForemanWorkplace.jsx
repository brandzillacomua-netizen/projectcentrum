import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Factory, ListTodo, Printer, Cpu, Plus, X } from 'lucide-react'
import { useMES } from '../MESContext'
import { QRCodeSVG } from 'qrcode.react'

const ForemanWorkplace = () => {
  const { tasks, orders, workCards, createWorkCard, completeTaskByMaster, nomenclatures, bomItems, machines } = useMES()
  const [activeTaskId, setActiveTaskId] = useState(null)
  const [showAddCard, setShowAddCard] = useState(false)
  const [newCard, setNewCard] = useState({ operation: 'Лазерна різка', machine: '', estimatedTime: '' })
  const [printQueue, setPrintQueue] = useState(null)

  const getBOMParts = (nomenclatureId) => {
    return bomItems
      .filter(b => b.parent_id === nomenclatureId)
      .map(b => ({
        ...b,
        nom: nomenclatures.find(n => n.id === b.child_id)
      }))
  }

  const operations = ['Лазерна різка', 'Гнуття', 'Зварювання', 'Фарбування', 'Збірка', 'Пакування']
  const readyTasks = tasks.filter(t => t.warehouse_conf && t.engineer_conf && t.status !== 'completed')

  const handleGenerateFromWorksheet = async (task, part, sheets) => {
    const machineObj = machines.find(m => m.name === task.machine_name)
    const capacity = machineObj?.sheet_capacity || 1
    const totalLoadings = Math.ceil(sheets / capacity)
    const qtyPerLoading = Math.floor((part.nom?.units_per_sheet || 1) * (sheets / totalLoadings))

    try {
      const newCardMetadata = []
      for (let i = 1; i <= totalLoadings; i++) {
        const loadingInfo = `${i}/${totalLoadings}`
        await createWorkCard(
          task.id, 
          task.order_id, 
          'Лазерна різка', 
          task.machine_name || 'Не вказано', 
          (Number(part.nom?.time_per_unit) || 0) * qtyPerLoading, 
          loadingInfo
        )
        newCardMetadata.push({ loading: loadingInfo, qty: qtyPerLoading })
      }
      setPrintQueue({ task, part, metadata: newCardMetadata })
    } catch(err) {
      alert('Помилка генерації: ' + err.message)
    }
  }

  const handleCreateCard = async (e) => {
    e.preventDefault()
    if (!activeTaskId || !newCard.operation || !newCard.estimatedTime) return
    const task = readyTasks.find(t => t.id === activeTaskId)
    
    try {
      await createWorkCard(task.id, task.order_id, newCard.operation, newCard.machine || task.machine_name, newCard.estimatedTime, null)
      setShowAddCard(false)
      setNewCard({ operation: 'Лазерна різка', machine: '', estimatedTime: '' })
    } catch(err) {
      alert('Помилка: ' + err.message)
    }
  }

  const handleCloseNaryad = async (taskId) => {
    try {
      if (window.confirm("Дійсно закрити наряд? Всі операції повинні бути завершені.")) {
        await completeTaskByMaster(taskId)
        setActiveTaskId(null)
      }
    } catch(err) {
      alert('Помилка при закритті наряду')
    }
  }

  return (
    <div className="module-page" style={{ background: '#0a0a0a', minHeight: '100vh', color: '#fff', fontFamily: 'Inter, sans-serif' }}>
      <nav className="module-nav" style={{ padding: '0 30px', height: '70px', background: '#000', borderBottom: '2px solid #ef4444', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link to="/" style={{ color: '#94a3b8', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '0.9rem' }}>
          <ArrowLeft size={20} /> Вихід у Портал
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Factory size={24} color="#ef4444" />
          <h1 style={{ fontSize: '1.2rem', fontWeight: 900, letterSpacing: '0.05em', margin: 0 }}>РОБОЧЕ МІСЦЕ МАЙСТРА ДІЛЬНИЦІ</h1>
        </div>
      </nav>

      <div style={{ padding: '40px', display: 'grid', gridTemplateColumns: '400px 1fr', gap: '30px', height: 'calc(100vh - 70px)', overflow: 'hidden' }}>
        <div style={{ background: '#121212', borderRadius: '12px', border: '1px solid #222', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '25px', borderBottom: '1px solid #222', color: '#888', fontWeight: 800, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Наряди, готові до виконання
          </div>
          <div style={{ overflowY: 'auto', flex: 1, padding: '20px' }}>
            {readyTasks.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '50px 20px', color: '#555' }}>
                <CheckCircle2 size={48} style={{ marginBottom: '15px', opacity: 0.2 }} />
                <p>Немає нарядів, готових до виконання.</p>
              </div>
            ) : (
              readyTasks.map(task => {
                const order = orders.find(o => o.id === task.order_id)
                const isActive = activeTaskId === task.id
                return (
                  <div key={task.id} onClick={() => setActiveTaskId(task.id)} style={{ padding: '20px', borderRadius: '16px', background: isActive ? '#ef4444' : '#1a1a1a', border: '1px solid', borderColor: isActive ? '#ef4444' : '#333', marginBottom: '15px', cursor: 'pointer', transition: '0.2s', color: isActive ? '#fff' : '#ccc' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <strong style={{ fontSize: '1.2rem', fontWeight: 900 }}>№ {order?.order_num}</strong>
                    </div>
                    <div style={{ fontSize: '0.9rem', opacity: isActive ? 1 : 0.7 }}>{order?.customer}</div>
                    <div style={{ marginTop: '10px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '5px', opacity: 0.8 }}>
                      <Cpu size={14} /> {task.machine_name}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        <div style={{ background: '#121212', borderRadius: '12px', border: '1px solid #222', overflowY: 'auto', padding: '40px' }}>
          {activeTaskId ? (
            (() => {
              const task = readyTasks.find(t => t.id === activeTaskId)
              const order = orders.find(o => o.id === task.order_id)
              const cards = workCards.filter(c => c.task_id === task.id)
              const machineObj = machines.find(m => m.name === task.machine_name)
              
              return (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '40px' }}>
                    <div>
                      <span style={{ color: '#ef4444', fontWeight: 800, fontSize: '0.8rem', letterSpacing: '0.15em', textTransform: 'uppercase', display: 'block', marginBottom: '10px' }}>УПРАВЛІННЯ НАРЯДОМ</span>
                      <h2 style={{ margin: 0, fontSize: '2.5rem', fontWeight: 900 }}>№ {order?.order_num}</h2>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginTop: '10px' }}>
                        <p style={{ color: '#888', fontSize: '1.1rem', margin: 0 }}>{order?.customer}</p>
                        <div style={{ background: '#1a1a1a', border: '1px solid #333', padding: '8px 15px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <Cpu size={18} color="#ef4444" />
                          <span style={{ fontWeight: 800, color: '#fff' }}>СТАНОК: {task.machine_name}</span>
                          <span style={{ color: '#555', fontSize: '0.8rem' }}>({machineObj?.sheet_capacity || 1} л.)</span>
                        </div>
                      </div>

                      <div style={{ marginTop: '20px', display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                        {order?.order_items?.map(item => {
                          const nom = nomenclatures.find(n => n.id === item.nomenclature_id)
                          return (
                            <div key={item.id} style={{ 
                              background: 'rgba(239, 68, 68, 0.05)', 
                              borderLeft: '5px solid #ef4444', 
                              padding: '15px 25px', 
                              borderRadius: '0 16px 16px 0',
                              flex: 1,
                              minWidth: '350px'
                            }}>
                              <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: '#666', fontWeight: 800, marginBottom: '5px' }}>ГОТОВИЙ ВИРІБ:</div>
                              <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#fff', letterSpacing: '0.02em' }}>
                                {nom?.name} <span style={{ color: '#ef4444' }}>— {item.quantity} шт.</span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '15px' }}>
                      <button onClick={() => window.print()} style={{ background: 'transparent', border: '1px solid #333', color: '#888', padding: '12px 20px', borderRadius: '12px', cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Printer size={18} /> ДРУКУВАТИ НАРЯД
                      </button>
                      <button onClick={() => handleCloseNaryad(task.id)} style={{ background: '#10b981', color: '#fff', border: 'none', padding: '12px 25px', borderRadius: '12px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <CheckCircle2 size={18} /> ЗАКРИТИ НАРЯД
                      </button>
                    </div>
                  </div>

                  <div style={{ marginBottom: '40px' }}>
                    <h3 style={{ fontSize: '1rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '20px' }}>Склад наряду (Робочий аркуш)</h3>
                    <div style={{ background: '#0a0a0a', borderRadius: '12px', border: '1px solid #222', overflow: 'hidden' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                        <thead>
                          <tr style={{ background: '#111', borderBottom: '1px solid #222' }}>
                            <th style={{ padding: '15px', textAlign: 'left', color: '#555', fontWeight: 800, width: '25%' }}>НОМЕНКЛАТУРА ВИРОБНИЦТВА</th>
                            <th style={{ padding: '15px', textAlign: 'center', color: '#555', fontWeight: 800 }}>НАЯВНІСТЬ, ШТ</th>
                            <th style={{ padding: '15px', textAlign: 'center', color: '#555', fontWeight: 800 }}>ВИРОБИТИ, ШТ</th>
                            <th style={{ padding: '15px', textAlign: 'center', color: '#555', fontWeight: 800 }}>ЛИСТ, ММ</th>
                            <th style={{ padding: '15px', textAlign: 'center', color: '#555', fontWeight: 800 }}>К-СТЬ НА 1 ЛИСТ</th>
                            <th style={{ padding: '15px', textAlign: 'center', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', fontWeight: 800 }}>ЗАДАТИ ЛИСТІВ</th>
                            <th style={{ padding: '15px', textAlign: 'center', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', fontWeight: 800 }}>ЗАЛИШОК БЗ, ШТ</th>
                            <th style={{ padding: '15px', textAlign: 'center', color: '#ef4444', fontWeight: 800 }}>ЗАВАНТАЖЕНЬ</th>
                            <th style={{ padding: '15px', textAlign: 'center', color: '#fff', fontWeight: 800 }}>ДІЇ</th>
                          </tr>
                        </thead>
                        <tbody>
                          {order?.order_items?.flatMap(item => {
                            const parts = getBOMParts(item.nomenclature_id)
                            const displayParts = parts.length > 0 ? parts : [{ 
                              nom: nomenclatures.find(n => n.id === item.nomenclature_id), 
                              quantity_per_parent: 1 
                            }]

                            return displayParts.map((part, pIdx) => {
                              const totalToProduce = item.quantity * part.quantity_per_parent
                              const unitsPerSheet = part.nom?.units_per_sheet || 1
                              const sheets = Math.ceil(totalToProduce / unitsPerSheet)
                              const remainder = (sheets * unitsPerSheet) - totalToProduce
                              const loadings = Math.ceil(sheets / (machineObj?.sheet_capacity || 1))
                              
                              return (
                                <tr key={`${item.id}-${pIdx}`} style={{ borderBottom: '1px solid #1a1a1a' }}>
                                  <td style={{ padding: '15px' }}>
                                    <div style={{ color: '#fff', fontWeight: 700 }}>{part.nom?.name}</div>
                                    <div style={{ fontSize: '0.7rem', color: '#444' }}>Program default</div>
                                  </td>
                                  <td style={{ padding: '15px', textAlign: 'center', color: '#555' }}>—</td>
                                  <td style={{ padding: '15px', textAlign: 'center', color: '#fff', fontWeight: 800 }}>{totalToProduce}</td>
                                  <td style={{ padding: '15px', textAlign: 'center', color: '#888' }}>{part.nom?.material_type}</td>
                                  <td style={{ padding: '15px', textAlign: 'center', color: '#888' }}>{unitsPerSheet}</td>
                                  <td style={{ padding: '15px', textAlign: 'center', background: 'rgba(16, 185, 129, 0.05)', color: '#10b981', fontWeight: 900, fontSize: '1.1rem' }}>{sheets}</td>
                                  <td style={{ padding: '15px', textAlign: 'center', background: 'rgba(16, 185, 129, 0.05)', color: '#10b981', fontWeight: 800 }}>{remainder}</td>
                                  <td style={{ padding: '15px', textAlign: 'center', fontWeight: 800, color: '#ef4444' }}>{loadings}</td>
                                  <td style={{ padding: '15px', textAlign: 'center' }}>
                                    <button 
                                      onClick={() => handleGenerateFromWorksheet(task, part, sheets)}
                                      style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '10px 15px', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 900, cursor: 'pointer', transition: '0.2s' }}
                                    >
                                      ЗГЕНЕРУВАТИ
                                    </button>
                                  </td>
                                </tr>
                              )
                            })
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div style={{ marginBottom: '40px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                      <h3 style={{ fontSize: '1rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>Згенеровані робочі картки</h3>
                      <button onClick={() => setShowAddCard(!showAddCard)} style={{ background: '#1a1a1a', border: '1px solid #333', color: '#fff', padding: '10px 20px', borderRadius: '10px', cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem' }}>
                        {showAddCard ? 'Скасувати' : '+ Ручне додавання'}
                      </button>
                    </div>

                    {showAddCard && (
                      <form onSubmit={handleCreateCard} style={{ background: '#000', padding: '25px', borderRadius: '16px', border: '1px solid #ef4444', marginBottom: '30px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '15px', alignItems: 'end' }}>
                        <div>
                          <label style={{ display: 'block', color: '#555', marginBottom: '8px', fontSize: '0.7rem', fontWeight: 800 }}>ОПЕРАЦІЯ</label>
                          <select style={{ width: '100%', padding: '12px', background: '#111', border: '1px solid #222', color: '#fff', borderRadius: '8px' }} value={newCard.operation} onChange={e => setNewCard({...newCard, operation: e.target.value})}>
                            {operations.map(o => <option key={o} value={o}>{o}</option>)}
                          </select>
                        </div>
                        <div>
                          <label style={{ display: 'block', color: '#555', marginBottom: '8px', fontSize: '0.7rem', fontWeight: 800 }}>ЦІЛЬОВИЙ СТАНОК</label>
                          <input style={{ width: '100%', padding: '12px', background: '#111', border: '2px solid #222', color: '#fff', borderRadius: '8px' }} value={newCard.machine || task.machine_name} onChange={e => setNewCard({...newCard, machine: e.target.value})} />
                        </div>
                        <div>
                          <label style={{ display: 'block', color: '#555', marginBottom: '8px', fontSize: '0.7rem', fontWeight: 800 }}>ПЛАНОВИЙ ЧАС (ХВ)</label>
                          <input type="number" required style={{ width: '100%', padding: '12px', background: '#111', border: '1px solid #222', color: '#fff', borderRadius: '8px' }} value={newCard.estimatedTime} onChange={e => setNewCard({...newCard, estimatedTime: e.target.value})} />
                        </div>
                        <button type="submit" style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '12px 25px', borderRadius: '10px', fontWeight: 800, cursor: 'pointer' }}>СТВОРИТИ</button>
                      </form>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                      {cards.map(card => (
                        <div key={card.id} style={{ display: 'flex', gap: '20px', padding: '20px', background: '#1a1a1a', borderRadius: '16px', border: '1px solid #222', alignItems: 'center' }}>
                          <div style={{ background: '#fff', padding: '10px', borderRadius: '12px' }}>
                            <QRCodeSVG value={`CENTRUM_CARD_${card.id}`} size={80} />
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <h4 style={{ margin: 0, fontSize: '1.1rem' }}>{card.operation}</h4>
                              {card.card_info && <span style={{ background: '#ef4444', color: '#fff', padding: '3px 8px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 900 }}>{card.card_info}</span>}
                            </div>
                            <div style={{ color: '#666', fontSize: '0.85rem', marginTop: '5px' }}>{card.machine} | {card.estimated_time || 0} хв</div>
                            <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: card.status === 'completed' ? '#10b981' : card.status === 'in-progress' ? '#f59e0b' : '#333' }}></div>
                              <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: card.status === 'completed' ? '#10b981' : card.status === 'in-progress' ? '#f59e0b' : '#555' }}>
                                {card.status === 'pending' ? 'Очікує' : card.status === 'in-progress' ? 'В роботі' : 'Готово'}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    {cards.length === 0 && <div style={{ padding: '40px', background: '#0a0a0a', border: '1px dashed #222', borderRadius: '16px', textAlign: 'center', color: '#444' }}>Немає згенерованих карток</div>}
                  </div>
                </div>
              )
            })()
          ) : (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', color: '#444' }}>
              <ListTodo size={80} style={{ marginBottom: '20px', opacity: 0.5 }} />
              <h2 style={{ fontSize: '1.8rem' }}>Виберіть наряд для розподілу</h2>
              <p>Оберіть наряд зі списку зліва, щоб створити робочі картки для операторів</p>
            </div>
          )}
        </div>
      </div>

      {printQueue && (
        <div className="print-overlay" style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: '#000', zIndex: 9999, display: 'flex', flexDirection: 'column' }}>
          <div className="no-print" style={{ padding: '20px 40px', background: '#111', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0 }}>Попередній перегляд Робочих Карт</h2>
            <div style={{ display: 'flex', gap: '15px' }}>
              <button onClick={() => setPrintQueue(null)} style={{ background: 'transparent', border: '1px solid #444', color: '#888', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer' }}>Скасувати</button>
              <button onClick={() => window.print()} style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '10px 30px', borderRadius: '8px', fontWeight: 800, cursor: 'pointer' }}>ДРУКУВАТИ КАРТИ (A4)</button>
            </div>
          </div>
          
          <div className="print-scroll" style={{ flex: 1, overflowY: 'auto', padding: '40px', background: '#222' }}>
            <div className="printable-content" style={{ width: '210mm', margin: '0 auto', background: '#fff', color: '#000' }}>
              {printQueue.metadata.map((meta, idx) => {
                const qrData = JSON.stringify({
                  card_num: `№${printQueue.task.order_id}-${idx + 1}`,
                  nomenclature: printQueue.part.nom?.name,
                  quantity: meta.qty,
                  loading: meta.loading,
                  order_id: printQueue.task.order_id
                })
                
                return (
                  <div key={idx} className="a4-page" style={{ 
                    width: '210mm', height: '297mm', padding: '10mm', 
                    display: 'flex', flexDirection: 'column', boxSizing: 'border-box',
                    pageBreakAfter: 'always', background: '#fff'
                  }}>
                    <div style={{ border: '6px solid #000', padding: '30px', flex: 1, display: 'flex', flexDirection: 'column', textAlign: 'center', justifyContent: 'space-between' }}>
                      <div style={{ borderBottom: '3px solid #000', paddingBottom: '20px', marginBottom: '30px' }}>
                        <h1 style={{ margin: 0, fontSize: '36pt', fontWeight: 900 }}>РОБОЧА КАРТА</h1>
                        <div style={{ fontSize: '18pt', fontWeight: 800, marginTop: '5px' }}>Завантаження: <span style={{ color: '#ef4444' }}>{meta.loading}</span></div>
                      </div>

                      <div style={{ marginBottom: '30px' }}>
                        <div style={{ fontSize: '14pt', textTransform: 'uppercase', color: '#666', fontWeight: 800, marginBottom: '10px' }}>Номенклатура виробництва:</div>
                        <div style={{ fontSize: '32pt', fontWeight: 900, lineHeight: 1.1 }}>{printQueue.part.nom?.name}</div>
                        <div style={{ fontSize: '18pt', color: '#444', marginTop: '10px', fontWeight: 700 }}>{printQueue.part.nom?.material_type}</div>
                      </div>

                      <div style={{ background: '#f0f0f0', padding: '30px', borderRadius: '15px' }}>
                        <span style={{ display: 'block', fontSize: '14pt', textTransform: 'uppercase', color: '#666', fontWeight: 800 }}>Кількість деталей у партії:</span>
                        <span style={{ fontSize: '70pt', fontWeight: 900 }}>{meta.qty} <span style={{ fontSize: '24pt' }}>шт.</span></span>
                      </div>

                      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
                        <QRCodeSVG value={qrData} size={250} />
                        <div style={{ fontSize: '12pt', fontWeight: 800, letterSpacing: '0.1em' }}>SCAN FOR WAREHOUSE RECEPTION</div>
                        <div style={{ fontSize: '10pt', color: '#888', marginTop: '5px' }}>Наряд №{printQueue.task.order_id} | {new Date().toLocaleDateString()}</div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * { visibility: hidden; }
          .print-overlay, .print-overlay * { visibility: visible; }
          .print-overlay { position: fixed !important; left: 0 !important; top: 0 !important; width: 100% !important; height: 100% !important; background: #fff !important; }
          .no-print { display: none !important; }
          .print-scroll { padding: 0 !important; background: #fff !important; overflow: visible !important; }
          .printable-content { width: 100% !important; margin: 0 !important; }
          .a4-page { 
            width: 210mm !important; height: 297mm !important; 
            padding: 10mm !important; 
            page-break-after: always !important; 
            display: flex !important;
            flex-direction: column !important;
            border: none !important;
          }
          @page { size: A4 portrait; margin: 0; }
        }
      `}} />
    </div>
  )
}

export default ForemanWorkplace
