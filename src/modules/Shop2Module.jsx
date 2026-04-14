import React, { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Monitor, ListTodo, X, Clock, CheckCircle2, ChevronRight, Menu, Printer, Tablet } from 'lucide-react'
import { useMES } from '../MESContext'
import { supabase } from '../supabase'
import { QRCodeCanvas } from 'qrcode.react'

const Shop2Module = () => {
  const { tasks, orders, nomenclatures, bomItems, inventory, workCards, fetchData, completeTaskShop2 } = useMES()
  const [activeTaskId, setActiveTaskId] = useState(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [printModalData, setPrintModalData] = useState(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [selectedStages, setSelectedStages] = useState({})
  const itemsPerPage = 8

  // Фільтруємо наряди для Цеху №2 (Пресування)
  const relevantTasks = useMemo(() => {
    return tasks
      .filter(t => t.step === 'Пресування')
      .sort((a, b) => {
        if (a.status === 'completed' && b.status !== 'completed') return 1
        if (a.status !== 'completed' && b.status === 'completed') return -1
        return new Date(b.created_at) - new Date(a.created_at)
      })
  }, [tasks])

  const getBOMParts = (nomenclatureId) => {
    return bomItems
      .filter(b => b.parent_id === nomenclatureId)
      .map(b => ({
        ...b,
        nom: nomenclatures.find(n => n.id === b.child_id)
      }))
  }

  const handleUpdateStage = async (task, nomId, stageName) => {
    if (!task || !nomId) return
    const sId = String(nomId)
    
    // Оптимістичне оновлення локального стейту для миттєвої реакції UI
    setSelectedStages(prev => ({ ...prev, [sId]: stageName }))

    const currentSnapshot = task.plan_snapshot || {}
    const updatedSnapshot = {
      ...currentSnapshot,
      [sId]: {
        ...(currentSnapshot[sId] || {}),
        shop2_stage: stageName
      }
    }
    try {
      const { error } = await supabase.from('tasks').update({ plan_snapshot: updatedSnapshot }).eq('id', task.id)
      if (error) throw error
      // Викликаємо fetchData у фоні без очікування, щоб не блокувати UI
      fetchData()
    } catch (err) {
      console.error("Error updating stage:", err)
      alert("Помилка збереження етапу")
      // У разі помилки можна повернути старе значення (опціонально)
    }
  }

  const handleGenerateCard = async (task, item, totalQty) => {
    const nomId = item.nom?.id
    const stage = selectedStages[String(nomId)] || task.plan_snapshot?.[String(nomId)]?.shop2_stage
    
    if (!nomId) {
      alert("Не знайдено ID номенклатури!")
      return
    }
    
    if (!stage) {
      alert("Спершу оберіть етап!")
      return
    }

    setIsGenerating(true)
    try {
      const order = orders.find(o => o.id === task.order_id)
      
      const payload = {
        task_id: task.id,
        order_id: task.order_id,
        nomenclature_id: nomId,
        quantity: Number(totalQty) || 0,
        operation: stage,
        status: 'new',
        machine: '—', // Додаємо для відповідності схемі
        is_rework: false, // Додаємо для відповідності схемі
        estimated_time: 0, // Додаємо для відповідності схемі
        card_info: `[ЦЕХ №2] [NEED:${item.need || 0}] [BZ:${item.bz || 0}] Наряд №${order?.order_num || ''}${task.batch_index ? `/${task.batch_index}` : ''}`
      }

      console.log("Generating card with payload:", payload)

      const { data, error } = await supabase.from('work_cards').insert([payload]).select().single()

      if (error) {
        console.error("Supabase insert error:", error)
        throw error
      }

      setPrintModalData({
        cardId: data.id,
        nomName: item.nom?.name,
        qty: totalQty,
        stage: stage,
        orderNum: order?.order_num || '—',
        customer: order?.customer || '—'
      })
    } catch (err) {
      console.error("Error generating card details:", err)
      alert(`Помилка генерації картки: ${err.message || 'невідома помилка'}`)
    } finally {
      setIsGenerating(false)
      fetchData()
    }
  }

  return (
    <div className="shop2-module" style={{ background: '#0a0a0a', minHeight: '100vh', color: '#fff', display: 'flex', flexDirection: 'column' }}>
      {/* ───── ШАПКА ───── */}
      <header className="module-nav" style={{ 
        padding: '15px 25px', 
        background: '#111', 
        borderBottom: '1px solid #1a1a1a', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        position: 'sticky',
        top: 0,
        zIndex: 100
      }}>
        <Link to="/" className="back-link" style={{ 
          color: '#fff', 
          textDecoration: 'none', 
          display: 'flex', 
          alignItems: 'center', 
          gap: '10px', 
          fontWeight: 700,
          fontSize: '0.85rem'
        }}>
          <ArrowLeft size={18} /> <span className="hide-mobile">На головну</span>
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={() => setIsDrawerOpen(true)} className="mobile-only burger-btn" style={{ background: 'transparent', border: 'none', color: '#fff' }}>
            <Menu size={24} />
          </button>
          <Monitor size={22} color="#8b5cf6" />
          <h1 style={{ margin: 0, textTransform: 'uppercase', fontSize: '1rem', fontWeight: 900 }}>ЦЕХ №2</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }} className="hide-mobile">
          <div style={{ fontWeight: 900, color: '#8b5cf6', fontSize: '0.75rem' }}>УПРАВЛІННЯ ДІЛЬНИЦЕЮ</div>
          <Link to="/shop2-terminal" style={{ 
            background: '#8b5cf622', 
            color: '#8b5cf6', 
            textDecoration: 'none', 
            padding: '8px 16px', 
            borderRadius: '12px', 
            fontSize: '0.7rem', 
            fontWeight: 900,
            border: '1px solid #8b5cf644',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <Tablet size={14} /> ТЕРМІНАЛ ОПЕРАТОРА
          </Link>
        </div>
      </header>

      {isDrawerOpen && (
        <div
          className="drawer-backdrop"
          onClick={() => setIsDrawerOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, backdropFilter: 'blur(4px)' }}
        />
      )}

      {/* ───── ОСНОВНА СІТКА ───── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        
        {/* ───── ЛІВА ПАНЕЛЬ (СПИСОК) ───── */}
        <div
          className={`side-panel ${isDrawerOpen ? 'drawer-open' : ''}`}
          style={{ 
            width: '300px', 
            background: '#121212', 
            borderRight: '1px solid #222', 
            display: 'flex', 
            flexDirection: 'column',
            transition: '0.3s transform'
          }}
        >
          <div style={{ padding: '20px', color: '#444', fontWeight: 800, fontSize: '0.65rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            ЧЕРГА НАРЯДІВ ({relevantTasks.length})
            {isDrawerOpen && <X size={18} onClick={() => setIsDrawerOpen(false)} style={{ cursor: 'pointer' }} />}
          </div>
          
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {relevantTasks.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map(task => {
              const order = orders.find(o => o.id === task.order_id)
              const isActive = activeTaskId === task.id
              const isCompleted = task.status === 'completed'
              
              return (
                <div
                  key={task.id}
                  onClick={() => { setActiveTaskId(task.id); setIsDrawerOpen(false); }}
                  style={{ 
                    padding: '20px', 
                    borderLeft: isActive ? '4px solid #8b5cf6' : '4px solid transparent', 
                    background: isActive ? '#1a1a1a' : 'transparent', 
                    cursor: 'pointer',
                    transition: '0.2s',
                    borderBottom: '1px solid #1a1a1a'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontWeight: 800, fontSize: '1rem', color: isCompleted ? '#444' : '#fff' }}>№ {order?.order_num}{task.batch_index ? `/${task.batch_index}` : ''}</div>
                    {isCompleted && <CheckCircle2 size={14} color="#10b981" />}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: isCompleted ? '#222' : '#555', marginTop: '4px' }}>{order?.customer}</div>
                  {isCompleted && <div style={{ fontSize: '0.6rem', color: '#10b981', fontWeight: 900, marginTop: '8px' }}>ВИКОНАНО</div>}
                </div>
              )
            })}
            
            {relevantTasks.length === 0 && (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: '#333', fontSize: '0.85rem' }}>
                Поки що немає нарядів для виконання
              </div>
            )}
          </div>

          {/* ПАГІНАЦІЯ */}
          {relevantTasks.length > itemsPerPage && (
            <div style={{ padding: '15px', borderTop: '1px solid #222', display: 'flex', justifyContent: 'center', gap: '10px' }}>
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => p - 1)}
                style={{ background: '#222', border: 'none', color: '#fff', padding: '5px 12px', borderRadius: '4px', cursor: 'pointer', opacity: currentPage === 1 ? 0.3 : 1 }}
              >Назад</button>
              <div style={{ fontSize: '0.75rem', color: '#555', fontWeight: 800, alignSelf: 'center' }}>
                {currentPage} / {Math.ceil(relevantTasks.length / itemsPerPage)}
              </div>
              <button
                disabled={currentPage === Math.ceil(relevantTasks.length / itemsPerPage)}
                onClick={() => setCurrentPage(p => p + 1)}
                style={{ background: '#222', border: 'none', color: '#fff', padding: '5px 12px', borderRadius: '4px', cursor: 'pointer', opacity: currentPage === Math.ceil(relevantTasks.length / itemsPerPage) ? 0.3 : 1 }}
              >Вперед</button>
            </div>
          )}
        </div>

        {/* ───── ЦЕНТРАЛЬНА ЧАСТИНА (ДЕТАЛІЗУЦІЯ) ───── */}
        <div style={{ flex: 1, padding: '40px', overflowY: 'auto' }}>
          {activeTaskId ? (() => {
            const task = relevantTasks.find(t => t.id === activeTaskId)
            const order = orders.find(o => o.id === task.order_id)
            const isReworkOrder = order?.order_num?.startsWith('ВБ')
            
            // Fallback for Product Names: if order has no items (internal rework), use snapshot names
            let productNames = order?.order_items?.map(it => nomenclatures.find(n => n.id === it.nomenclature_id)?.name).filter(Boolean).join(', ')
            if (!productNames && task.plan_snapshot) {
              productNames = Object.values(task.plan_snapshot)
                .map(s => nomenclatures.find(n => String(n.id) === String(s.id))?.name || s.name)
                .filter(Boolean)
                .join(', ')
            }
            
            return (
              <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '40px' }}>
                  <div>
                    <h2 style={{ fontSize: '2.5rem', fontWeight: 950, margin: 0 }}>Наряд №{order?.order_num}{task.batch_index ? `/${task.batch_index}` : ''}</h2>
                    <div style={{ color: '#555', marginTop: '8px', fontSize: '1.1rem', fontWeight: 800 }}>
                      ВИРІБ: <strong style={{ color: '#8b5cf6' }}>{productNames || '—'}</strong> | {order?.customer}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '15px' }}>
                              {(() => {
                        const taskCards = (workCards || []).filter(c => String(c.task_id) === String(task.id))
                        const allCardsDone = taskCards.length > 0 && taskCards.every(c => c.status === 'completed')
                        
                        if (task.status !== 'completed' && allCardsDone) {
                          return (
                            <button 
                              onClick={async () => {
                                if (window.confirm('Ви впевнені, що хочете закрити наряд?')) {
                                  try {
                                    await completeTaskShop2(task.id);
                                    alert('Наряд успішно закритий!');
                                  } catch (e) {
                                    alert('Помилка: ' + e.message);
                                  }
                                }
                              }}
                              style={{ 
                                background: '#8b5cf6', 
                                color: '#fff', 
                                border: 'none', 
                                padding: '12px 25px', 
                                borderRadius: '14px', 
                                fontWeight: 900, 
                                cursor: 'pointer',
                                boxShadow: '0 10px 20px -5px rgba(139, 92, 246, 0.4)'
                              }}
                            >
                              ЗАКРИТИ НАРЯД ЦЕХУ
                            </button>
                          )
                        }
                        return null
                      })()}
                  </div>
                </div>

                {/* ТАБЛИЦЯ НОМЕНКЛАТУРИ */}
                <div style={{ background: '#111', borderRadius: '28px', border: '1px solid #1a1a1a', overflow: 'hidden' }}>
                   <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: '#0a0a0a', textAlign: 'left', color: '#555', textTransform: 'uppercase', fontSize: '0.65rem', fontWeight: 900 }}>
                          <th style={{ padding: '15px 25px' }}>НОМЕНКЛАТУРА</th>
                          <th style={{ padding: '15px 20px', textAlign: 'center' }}>МАТЕРІАЛ</th>
                          <th style={{ padding: '15px 20px', textAlign: 'center' }}>ПОТРЕБА</th>
                          {!isReworkOrder && (
                            <>
                              <th style={{ padding: '15px 20px', textAlign: 'center', color: '#eab308' }}>БЗ (ЗАПАС)</th>
                              <th style={{ padding: '15px 20px', textAlign: 'center' }}>ЗАГАЛЬНА КІЛЬКІСТЬ</th>
                            </>
                          )}
                          <th style={{ padding: '15px 20px' }}>ЕТАП</th>
                          <th style={{ padding: '15px 20px', textAlign: 'center' }}>СТАН</th>
                          <th style={{ padding: '15px 20px', textAlign: 'center' }}>ДІЯ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                           const snapshot = task.plan_snapshot || {}
                           const snapshotItems = Object.values(snapshot).filter(Boolean)
                           
                           let displayItems = snapshotItems.length > 0 ? snapshotItems.map(s => ({
                             nom: (nomenclatures || []).find(n => String(n?.id) === String(s?.id)),
                             need: s?.need,
                             bz: s?.bz,
                             stock: s?.stock,
                             plan: s?.plan,
                             code: s?.code
                           })) : (order?.order_items || []).flatMap(item => {
                             const bzItem = (inventory || []).find(i => String(i.nomenclature_id) === String(item?.nomenclature_id) && (i.type === 'bz_shop2' || i.type === 'bz'))
                             const bzQty = Number(bzItem?.total_qty) || 0
                             const parts = getBOMParts(item?.nomenclature_id)
                             return parts.length > 0 ? parts.map(p => ({
                               nom: p.nom,
                               need: (Number(item?.quantity) || 0) * (Number(p.quantity_per_parent) || 1),
                               bz: 0,
                               code: p.nom?.nomenclature_code
                             })) : [{ 
                                nom: (nomenclatures || []).find(n => String(n?.id) === String(item?.nomenclature_id)), 
                                need: (Number(item?.quantity) || 0),
                                bz: bzQty,
                                code: (nomenclatures || []).find(n => String(n?.id) === String(item?.nomenclature_id))?.nomenclature_code
                              }]
                           })

                           displayItems = (displayItems || []).filter(item => item.nom?.type === 'part')

                           return (displayItems || []).map((item, idx) => (
                              <tr key={idx} style={{ borderBottom: '1px solid #1a1a1a' }}>
                                 <td style={{ padding: '20px' }}>
                                    <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#fff' }}>{item.nom?.name || '—'}</div>
                                    <div style={{ fontSize: '0.7rem', color: '#444', marginTop: '2px' }}>{item.code || 'БЕЗ КОДУ'}</div>
                                 </td>
                                 <td style={{ padding: '20px', textAlign: 'center' }}>
                                    <div style={{ color: '#666', fontSize: '0.85rem', fontWeight: 700 }}>{item.nom?.material_type || '—'}</div>
                                 </td>
                                 <td style={{ padding: '20px', textAlign: 'center', color: '#fff', fontSize: '1.2rem', fontWeight: 600 }}>
                                    {item.need || '0'}
                                 </td>
                                 {!isReworkOrder && (
                                    <>
                                       <td style={{ padding: '20px', textAlign: 'center', color: '#eab308', fontWeight: 1000, fontSize: '1.4rem' }}>
                                          {(() => {
                                             const bzItem = (inventory || []).find(i => String(i.nomenclature_id) === String(item.nom?.id) && (i.type === 'bz_shop2' || i.type === 'bz'))
                                             return Number(bzItem?.total_qty) || 0
                                          })()}
                                       </td>
                                       <td style={{ padding: '20px', textAlign: 'center', color: '#3b82f6', fontWeight: 1000, fontSize: '1.4rem' }}>
                                          {(() => {
                                             const bzItem = (inventory || []).find(i => String(i.nomenclature_id) === String(item.nom?.id) && (i.type === 'bz_shop2' || i.type === 'bz'))
                                             const bzQty = Number(bzItem?.total_qty) || 0
                                             return (Number(item.need) || 0) + bzQty
                                          })()}
                                       </td>
                                    </>
                                 )}
                                 <td style={{ padding: '20px' }}>
                                    <select
                                       value={selectedStages[String(item.nom?.id)] || (task.plan_snapshot?.[String(item.nom?.id)]?.shop2_stage) || ''}
                                       disabled={task.status === 'completed'}
                                       onChange={(e) => handleUpdateStage(task, item.nom?.id, e.target.value)}
                                       style={{ width: '100%', background: '#000', border: '1px solid #333', color: '#fff', padding: '10px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 700 }}
                                    >
                                       <option value="" disabled hidden>Оберіть етап</option>
                                       <option value="Пресування">Пресування</option>
                                       <option value="Фарбування">Фарбування</option>
                                       <option value="Доопрацювання">Доопрацювання</option>
                                    </select>
                                 </td>
                                 <td style={{ padding: '20px', textAlign: 'center' }}>
                                    <div style={{ 
                                      display: 'inline-flex', 
                                      alignItems: 'center', 
                                      gap: '6px', 
                                      background: task.status === 'completed' ? '#10b98122' : '#8b5cf611',
                                      color: task.status === 'completed' ? '#10b981' : '#8b5cf6',
                                      padding: '6px 14px',
                                      borderRadius: '12px',
                                      fontSize: '0.75rem',
                                      fontWeight: 800
                                    }}>
                                      {task.status === 'completed' ? <CheckCircle2 size={14} /> : <Clock size={14} />}
                                      {task.status === 'completed' ? 'ГОТОВО' : 'НА ПРИЙОМЦІ'}
                                    </div>
                                 </td>
                                 <td style={{ padding: '20px', textAlign: 'center' }}>
                                    {(() => {
                                      const stage = selectedStages[String(item.nom?.id)] || task.plan_snapshot?.[String(item.nom?.id)]?.shop2_stage
                                      
                                      // Робимо порівняння максимально стійким
                                      const existingCard = (workCards || []).find(wc => {
                                        const idMatch = String(wc.task_id) === String(task.id) && String(wc.nomenclature_id) === String(item.nom?.id)
                                        const opMatch = String(wc.operation || '').toLowerCase().trim() === String(stage || '').toLowerCase().trim()
                                        return idMatch && opMatch
                                      })

                                      // DEBUG лог лише для активних нарядів (можна видалити після перевірки)
                                      if (!existingCard && item.nom?.id === 'some_id') {
                                         console.log("Checking match for:", item.nom?.name, "Stage:", stage, "WorkCards total:", workCards?.length)
                                      }

                                      if (existingCard) {
                                        return (
                                          <button
                                            onClick={() => {
                                              const order = orders.find(o => o.id === task.order_id)
                                              setPrintModalData({
                                                cardId: existingCard.id,
                                                nomName: item.nom?.name,
                                                qty: existingCard.quantity,
                                                stage: existingCard.operation,
                                                orderNum: order?.order_num || '—',
                                                customer: order?.customer || '—'
                                              })
                                            }}
                                            style={{ 
                                              background: '#10b981', 
                                              color: '#fff', 
                                              border: 'none', 
                                              padding: '10px', 
                                              borderRadius: '12px', 
                                              cursor: 'pointer',
                                              display: 'inline-flex',
                                              alignItems: 'center',
                                              justifyContent: 'center',
                                              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
                                            }}
                                            title="Друкувати повторно"
                                          >
                                            <Printer size={16} />
                                          </button>
                                        )
                                      }

                                      return (
                                        <button
                                          onClick={() => {
                                            const bzItem = (inventory || []).find(i => String(i.nomenclature_id) === String(item.nom?.id) && (i.type === 'bz_shop2' || i.type === 'bz'))
                                            const bzQty = Number(bzItem?.total_qty) || 0
                                            const total = (Number(item.need) || 0) + bzQty
                                            handleGenerateCard(task, item, total)
                                          }}
                                          disabled={task.status === 'completed' || isGenerating || !stage}
                                          style={{ 
                                            background: '#8b5cf6', 
                                            color: '#fff', 
                                            border: 'none', 
                                            padding: '8px 15px', 
                                            borderRadius: '10px', 
                                            fontSize: '0.65rem', 
                                            fontWeight: 900, 
                                            cursor: 'pointer',
                                            opacity: (task.status === 'completed' || isGenerating || !stage) ? 0.3 : 1
                                          }}
                                        >
                                          {isGenerating ? '...' : 'ГЕНЕРУВАТИ'}
                                        </button>
                                      )
                                    })()}
                                 </td>
                              </tr>
                           ))
                        })()}
                      </tbody>
                   </table>
                </div>

                {task.status === 'completed' && (
                  <div style={{ marginTop: '40px', padding: '30px', borderRadius: '24px', background: '#10b98111', border: '1px solid #10b98122', textAlign: 'center' }}>
                     <div style={{ color: '#10b981', fontSize: '1.5rem', fontWeight: 950 }}>НАРЯД ПОВНІСТЮ ВИКОНАНО</div>
                     <div style={{ color: '#10b981', opacity: 0.7, fontSize: '0.9rem', marginTop: '5px' }}>Всі деталі успішно пройшли обробку v Цеху №2</div>
                  </div>
                )}

                 {!isReworkOrder && (
                    <div style={{ marginTop: '40px' }}>
                       <h3 style={{ fontSize: '1.2rem', fontWeight: 950, color: '#444', textTransform: 'uppercase', marginBottom: '25px', borderLeft: '4px solid #10b981', paddingLeft: '15px' }}>
                         Буфер надходжень (з Цеху №1)
                       </h3>
                       <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '15px' }}>
                          {(() => {
                             const snap = task.plan_snapshot || {}
                             const snapIds = Object.keys(snap).filter(id => id !== 'arrivals')
                             
                             let arrivals = []
    
                             if (snap.arrivals && Array.isArray(snap.arrivals)) {
                                snap.arrivals.forEach(arr => {
                                   arrivals.push({ 
                                      id: arr.id, 
                                      name: arr.name, 
                                      need: Number(arr.semi) || 0,
                                      bz: Number(arr.bz) || 0,
                                      total: (Number(arr.semi) || 0) + (Number(arr.bz) || 0)
                                   })
                                })
                             } else {
                                snapIds.forEach(nomId => {
                                  const nom = (nomenclatures || []).find(n => String(n?.id) === String(nomId))
                                  if (!nom) return
    
                                  const taskCards = (workCards || []).filter(c => String(c.task_id) === String(task.id) && String(c.nomenclature_id) === String(nomId))
                                  let cardsNeedSum = 0
                                  let cardsBzSum = 0
    
                                  taskCards.forEach(c => {
                                     const bzTag = Number(c.buffer_qty) || Number(c.card_info?.match(/\[BZ:(\d+)\]/)?.[1]) || 0
                                     const needTag = Number(c.card_info?.match(/\[NEED:(\d+)\]/)?.[1]) || (Number(c.quantity) - bzTag)
                                     cardsNeedSum += Math.max(0, needTag)
                                     cardsBzSum += Math.max(0, bzTag)
                                  })
    
                                  const invItems = (inventory || []).filter(i => String(i.nomenclature_id) === String(nomId))
                                  const invSemi = invItems.filter(i => i.type === 'semi_shop2').reduce((a, i) => a + (Number(i.total_qty) || 0), 0)
                                  const invBz = invItems.filter(i => i.type === 'bz_shop2' || i.type === 'bz').reduce((a, i) => a + (Number(i.total_qty) || 0), 0)
    
                                  const totSemi = invSemi + cardsNeedSum
                                  const totBz = invBz + cardsBzSum
    
                                  if (totSemi > 0 || totBz > 0) {
                                    arrivals.push({ id: nomId, name: nom.name, need: totSemi, bz: totBz, total: totSemi + totBz })
                                  }
                                })
                             }
    
                             if (arrivals.length === 0) {
                                return <div style={{ color: '#222', fontSize: '0.85rem', fontWeight: 700, padding: '20px' }}>Буфер порожній. Передайте наряд з Цеху №1...</div>
                             }
    
                             return arrivals.map(item => (
                                   <div key={item.id} style={{ background: '#111', borderRadius: '24px', padding: '20px', border: '1px solid #1a1a1a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                      <div>
                                         <div style={{ fontWeight: 900, fontSize: '0.9rem', color: '#fff' }}>{item.name}</div>
                                         <div style={{ fontSize: '0.65rem', color: '#8b5cf6', fontWeight: 900, textTransform: 'uppercase', marginTop: '4px' }}>
                                            НАДХОДЖЕННЯ З ЦЕХУ №1
                                         </div>
                                      </div>
                                      <div style={{ textAlign: 'right' }}>
                                         <div style={{ fontSize: '1.8rem', fontWeight: 1000, color: '#fff', lineHeight: 1 }}>{item.total || 0}</div>
                                         <div style={{ fontSize: '0.9rem', fontWeight: 1000, color: '#fff' }}>
                                            {item.need || 0} 
                                            <span style={{ color: '#444', fontSize: '0.9rem', margin: '0 5px' }}>+</span> 
                                            <span style={{ color: '#eab308' }}>{item.bz || 0}</span>
                                            <span style={{ color: '#eab308', fontSize: '0.7rem', marginLeft: '4px' }}>БЗ</span>
                                         </div>
                                         <div style={{ fontSize: '0.55rem', color: '#444', fontWeight: 900 }}>ЗАГАЛЬНА КІЛЬКІСТЬ</div>
                                      </div>
                                   </div>
                                ))
                          })()}
                       </div>
                    </div>
                 )}

                {/* ───── АРХІВ РОБОЧИХ КАРТОК (ЦЕХ №2) ───── */}
                <div style={{ marginTop: '60px' }}>
                   <h3 style={{ fontSize: '1.2rem', fontWeight: 950, color: '#444', textTransform: 'uppercase', marginBottom: '25px', borderLeft: '4px solid #8b5cf6', paddingLeft: '15px' }}>
                     Архів робочих карток (Цех №2)
                   </h3>

                   {(() => {
                      const taskCards = (workCards || []).filter(c => {
                         const oMatch = String(c.order_id) === String(task.order_id)
                         const tMatch = String(c.task_id) === String(task.id)
                         // Херистіка для фантомних карток (пошук за текстом "Наряд №" у card_info)
                         const infoMatch = c.card_info?.includes(`Наряд №${task.order_id}`) || c.card_info?.includes(`Наряд №${task.id}`)
                         return (oMatch || tMatch || infoMatch) && c.card_info?.includes('[ЦЕХ №2]')
                      })
                      
                      // DEBUG для Архіву
                      if (taskCards.length > 0) {
                         console.log(`Found ${taskCards.length} cards for archive of task ${task.id}`);
                      }

                      const grouped = taskCards.reduce((acc, c) => {
                         const nomId = String(c.nomenclature_id)
                         if (!acc[nomId]) acc[nomId] = []
                         acc[nomId].push(c)
                         return acc
                      }, {})

                      if (taskCards.length === 0) {
                         return <div style={{ color: '#222', fontSize: '0.85rem', fontWeight: 700 }}>Ще не згенеровано жодної картки</div>
                      }

                      return Object.keys(grouped).map(nomId => {
                         let nom = nomenclatures.find(n => String(n.id) === String(nomId))
                          
                         // Херистіка для фантомних карток (якщо ID зламаний, групуємо за кількістю та замовленням)
                         if (!nom || nomId === 'null' || nomId === 'NaN') {
                           const sampleCard = grouped[nomId][0]
                           const info = sampleCard?.card_info || ''
                           const orderNumMatch = info.match(/Наряд №(\d+)/)
                           const orderNum = orderNumMatch ? orderNumMatch[1] : null
                           if (orderNum) {
                             const order = orders.find(o => String(o.order_num) === String(orderNum) || String(o.id) === String(orderNum))
                             const match = order?.order_items?.find(it => Number(it.quantity) === Number(sampleCard.quantity))
                             if (match) nom = nomenclatures.find(n => String(n.id) === String(match.nomenclature_id))
                           }
                         }
                         const cards = grouped[nomId]
                         
                         return (
                            <div key={nomId} style={{ marginBottom: '30px', background: '#111', borderRadius: '24px', border: '1px solid #1a1a1a', overflow: 'hidden' }}>
                               <div style={{ padding: '15px 20px', background: '#1a1a1a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <div style={{ fontWeight: 900, fontSize: '0.9rem', color: '#fff' }}>{nom?.name || 'Невідома деталь'}</div>
                                  <div style={{ fontSize: '0.65rem', color: '#555', fontWeight: 800 }}>КАРТОК: {cards.length}</div>
                               </div>
                               <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                  <thead>
                                     <tr style={{ textAlign: 'left', color: '#444', fontSize: '0.65rem', fontWeight: 900, textTransform: 'uppercase', borderBottom: '1px solid #1a1a1a' }}>
                                        <th style={{ padding: '12px 20px' }}>ID КАРТКИ</th>
                                        <th style={{ padding: '12px 20px' }}>ЕТАП</th>
                                        <th style={{ padding: '12px 20px', textAlign: 'center' }}>КІЛЬКІСТЬ</th>
                                        <th style={{ padding: '12px 20px', textAlign: 'center' }}>СТАТУС</th>
                                        <th style={{ padding: '12px 20px', textAlign: 'center' }}>ДІЯ</th>
                                     </tr>
                                  </thead>
                                  <tbody>
                                     {cards.map(c => (
                                        <tr key={c.id} style={{ borderBottom: '1px solid #161616' }}>
                                           <td style={{ padding: '12px 20px', fontSize: '0.75rem', color: '#888', fontWeight: 700 }}>{String(c.id).slice(0, 8)}...</td>
                                           <td style={{ padding: '12px 20px', fontSize: '0.85rem', fontWeight: 900, color: '#fff' }}>{c.operation}</td>
                                           <td style={{ padding: '12px 20px', textAlign: 'center', fontSize: '0.9rem', fontWeight: 1000, color: '#8b5cf6' }}>{c.quantity} шт</td>
                                           <td style={{ padding: '12px 20px', textAlign: 'center' }}>
                                              <div style={{ 
                                                 display: 'inline-block',
                                                 padding: '4px 10px',
                                                 borderRadius: '10px',
                                                 fontSize: '0.65rem',
                                                 fontWeight: 900,
                                                 background: c.status === 'completed' ? '#10b98122' : (c.status === 'in-progress' ? '#3b82f622' : '#222'),
                                                 color: c.status === 'completed' ? '#10b981' : (c.status === 'in-progress' ? '#3b82f6' : '#555')
                                              }}>
                                                 {c.status === 'completed' ? 'ГОТОВО' : (c.status === 'in-progress' ? 'В РОБОТІ' : 'НОВА')}
                                              </div>
                                           </td>
                                           <td style={{ padding: '12px 20px', textAlign: 'center' }}>
                                              <button 
                                                onClick={() => setPrintModalData({
                                                   cardId: c.id,
                                                   nomName: nom?.name,
                                                   qty: c.quantity,
                                                   stage: c.operation,
                                                   orderNum: order?.order_num || '—',
                                                   customer: order?.customer || '—'
                                                })}
                                                style={{ background: 'transparent', border: 'none', color: '#10b981', cursor: 'pointer' }}
                                              >
                                                 <Printer size={16} />
                                              </button>
                                           </td>
                                        </tr>
                                     ))}
                                  </tbody>
                               </table>
                            </div>
                         )
                      })
                   })()}
                </div>
              </div>
            )
          })() : (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#222' }}>
               <Monitor size={100} style={{ marginBottom: '20px', opacity: 0.1 }} />
               <h3 style={{ fontSize: '1.5rem', fontWeight: 900 }}>Оберіть наряд зі списку зліва</h3>
               <p style={{ fontWeight: 600 }}>Щоб переглянути деталі та керувати процесом</p>
            </div>
          )}
        </div>
      </div>

       {/* ───── МОДАЛ ДРУКУ КАРТКИ ───── */}
       {printModalData && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <div className="print-card" style={{ background: '#fff', color: '#000', padding: '40px', borderRadius: '32px', maxWidth: '500px', width: '100%', textAlign: 'center', boxShadow: '0 30px 60px rgba(0,0,0,0.5)' }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 900, color: '#888', textTransform: 'uppercase' }}>Робоча картка Цех №2</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 1000 }}>Наряд №{printModalData.orderNum}</div>
                  </div>
                  <button onClick={() => setPrintModalData(null)} style={{ background: '#f5f5f5', border: 'none', width: '40px', height: '40px', borderRadius: '50%', cursor: 'pointer' }}><X size={20} /></button>
               </div>

               <div style={{ background: '#f9f9f9', padding: '20px', borderRadius: '24px', marginBottom: '30px' }}>
                  <QRCodeCanvas 
                    value={JSON.stringify({ id: printModalData.cardId, type: 'work_card_shop2' })} 
                    size={220} 
                    level="H"
                    includeMargin={true}
                  />
                  <div style={{ marginTop: '15px', fontSize: '0.8rem', fontWeight: 900, color: '#aaa', letterSpacing: '0.1em' }}>ID: {printModalData.cardId.slice(0,8)}</div>
               </div>

               <div style={{ textAlign: 'left', marginBottom: '40px' }}>
                  <div style={{ marginBottom: '15px' }}>
                    <div style={{ fontSize: '0.65rem', fontWeight: 900, color: '#888', textTransform: 'uppercase' }}>Номенклатура</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 900 }}>{printModalData.nomName}</div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                     <div>
                        <div style={{ fontSize: '0.65rem', fontWeight: 900, color: '#888', textTransform: 'uppercase' }}>Кількість</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 1000, color: '#8b5cf6' }}>{printModalData.qty} шт</div>
                     </div>
                     <div>
                        <div style={{ fontSize: '0.65rem', fontWeight: 900, color: '#888', textTransform: 'uppercase' }}>Етап</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 1000, color: '#10b981' }}>{printModalData.stage}</div>
                     </div>
                  </div>
               </div>

               <button 
                 onClick={() => window.print()}
                 style={{ width: '100%', background: '#000', color: '#fff', border: 'none', padding: '20px', borderRadius: '20px', fontWeight: 1000, fontSize: '1.1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
               >
                 ДРУКУВАТИ КАРТКУ
               </button>
            </div>
          </div>
        )}

      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * { visibility: hidden; }
          .print-card, .print-card * { visibility: visible; }
          .print-card { position: absolute; left: 0; top: 0; width: 100% !important; border: none !important; box-shadow: none !important; padding: 20px !important; }
          button { display: none !important; }
        }
        @media (max-width: 768px) {
          .hide-mobile { display: none; }
          .side-panel { position: fixed; left: 0; top: 0; bottom: 0; z-index: 1001; transform: translateX(-100%); width: 280px !important; }
          .drawer-open { transform: translateX(0); }
        }
        .anim-fade-in { animation: fadeIn 0.4s ease-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}} />
    </div>
  )
}

export default Shop2Module
