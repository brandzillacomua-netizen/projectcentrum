import React, { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Monitor, ListTodo, X, Clock, CheckCircle2, ChevronRight, Menu } from 'lucide-react'
import { useMES } from '../MESContext'

const Shop2Module = () => {
  const { tasks, orders, nomenclatures, bomItems, workCards, fetchData } = useMES()
  const [activeTaskId, setActiveTaskId] = useState(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
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
        <div style={{ fontWeight: 900, color: '#8b5cf6', fontSize: '0.75rem' }} className="hide-mobile">УПРАВЛІННЯ ДІЛЬНИЦЕЮ</div>
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
                    <div style={{ fontWeight: 800, fontSize: '1rem', color: isCompleted ? '#444' : '#fff' }}>№ {order?.order_num}</div>
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
            const productNames = order?.order_items?.map(it => nomenclatures.find(n => n.id === it.nomenclature_id)?.name).filter(Boolean).join(', ')
            
            return (
              <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '40px' }}>
                  <div>
                    <h2 style={{ fontSize: '2.5rem', fontWeight: 950, margin: 0 }}>Наряд №{order?.order_num}</h2>
                    <div style={{ color: '#555', marginTop: '8px', fontSize: '1.1rem', fontWeight: 800 }}>
                      ВИРІБ: <strong style={{ color: '#8b5cf6' }}>{productNames || '—'}</strong> | {order?.customer}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '15px' }}>
                     {task.status !== 'completed' && (
                       <button style={{ 
                         background: '#8b5cf6', 
                         color: '#fff', 
                         border: 'none', 
                         padding: '12px 25px', 
                         borderRadius: '14px', 
                         fontWeight: 900, 
                         cursor: 'pointer',
                         boxShadow: '0 10px 20px -5px rgba(139, 92, 246, 0.4)'
                       }}>
                         ЗАКРИТИ НАРЯД ЦЕХУ
                       </button>
                     )}
                  </div>
                </div>

                {/* ТАБЛИЦЯ НОМЕНКЛАТУРИ */}
                <div style={{ background: '#111', borderRadius: '28px', border: '1px solid #1a1a1a', overflow: 'hidden' }}>
                   <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: '#1a1a1a', textAlign: 'left', color: '#555', fontSize: '0.7rem', fontWeight: 900, textTransform: 'uppercase' }}>
                           <th style={{ padding: '20px' }}>Номенклатура</th>
                           <th style={{ padding: '20px', textAlign: 'center' }}>Матеріал</th>
                           <th style={{ padding: '20px', textAlign: 'center', color: '#8b5cf6' }}>Кількість</th>
                           <th style={{ padding: '20px', textAlign: 'center' }}>Стан</th>
                        </tr>
                      </thead>
                      <tbody>
                        {order?.order_items?.flatMap((item, itemIdx) => {
                          const parts = getBOMParts(item.nomenclature_id)
                          const rows = parts.length > 0 ? parts : [{ nom: nomenclatures.find(n => n.id === item.nomenclature_id), quantity_per_parent: 1 }]
                          
                          return rows.map((part, partIdx) => {
                            const totalQty = (Number(item.quantity) || 0) * (Number(part.quantity_per_parent) || 1)
                            return (
                              <tr key={`${itemIdx}-${partIdx}`} style={{ borderBottom: '1px solid #1a1a1a' }}>
                                 <td style={{ padding: '20px' }}>
                                    <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#fff' }}>{part.nom?.name || '—'}</div>
                                    <div style={{ fontSize: '0.7rem', color: '#444', marginTop: '2px' }}>{part.nom?.nomenclature_code || 'БЕЗ КОДУ'}</div>
                                 </td>
                                 <td style={{ padding: '20px', textAlign: 'center', color: '#666', fontSize: '0.85rem' }}>
                                    {part.nom?.material_type || '—'}
                                 </td>
                                 <td style={{ padding: '20px', textAlign: 'center', color: '#8b5cf6', fontWeight: 950, fontSize: '1.4rem' }}>
                                    {totalQty}
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
                                      {task.status === 'completed' ? 'ГОТОВО' : 'В РОБОТІ'}
                                    </div>
                                 </td>
                              </tr>
                            )
                          })
                        })}
                      </tbody>
                   </table>
                </div>

                {task.status === 'completed' && (
                  <div style={{ marginTop: '40px', padding: '30px', borderRadius: '24px', background: '#10b98111', border: '1px solid #10b98122', textAlign: 'center' }}>
                     <div style={{ color: '#10b981', fontSize: '1.5rem', fontWeight: 950 }}>НАРЯД ПОВНІСТЮ ВИКОНАНО</div>
                     <div style={{ color: '#10b981', opacity: 0.7, fontSize: '0.9rem', marginTop: '5px' }}>Всі деталі успішно пройшли обробку в Цеху №2</div>
                  </div>
                )}
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

      <style dangerouslySetInnerHTML={{ __html: `
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
