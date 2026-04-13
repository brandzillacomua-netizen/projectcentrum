import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Factory, Hammer, Clock, Play, Plus, X, ListTodo } from 'lucide-react'
import { useMES } from '../MESContext'
import { apiService } from '../services/apiService'

const MasterWorkplace = () => {
  const { tasks, orders, workCards, createWorkCard, completeTaskByMaster } = useMES()
  const [activeTaskId, setActiveTaskId] = useState(null)
  const [showAddCard, setShowAddCard] = useState(false)
  const [newCard, setNewCard] = useState({ operation: 'Лазерний розкрій', machine: 'LXS-1', estimatedTime: '' })

  const operations = ['Розкрій', 'Галтовка', 'Пресування', 'Фарбування', 'Паквання']
  const machines = ['LXS-1', 'B-200', 'W-Point 1', 'МК-1', 'Збірна лінія', 'Склад СГП']

  // Master only sees tasks that are fully ready for production but not entirely completed
  const readyTasks = tasks.filter(t => t.warehouse_conf && t.engineer_conf && t.status !== 'completed')

  const handleCreateCard = async (e) => {
    e.preventDefault()
    if (!activeTaskId || !newCard.operation || !newCard.estimatedTime) return
    const task = readyTasks.find(t => t.id === activeTaskId)
    
    try {
      await apiService.submitCreateWorkCard(task.id, task.order_id, newCard.operation, newCard.machine, newCard.estimatedTime, createWorkCard)
      setShowAddCard(false)
      setNewCard({ operation: 'Лазерний розкрій', machine: 'LXS-1', estimatedTime: '' })
    } catch(err) {
      alert('Помилка: ' + err.message)
    }
  }

  const handleCloseNaryad = async (taskId) => {
    try {
      if (window.confirm("Дійсно закрити наряд? Всі операції повинні бути завершені.")) {
        await apiService.submitCompleteTaskByMaster(taskId, completeTaskByMaster)
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
          <h1 style={{ fontSize: '1.2rem', fontWeight: 900, letterSpacing: '0.05em', margin: 0 }}>РОБОЧЕ МІСЦЕ МАЙСТРА</h1>
        </div>
      </nav>

      <div style={{ padding: '40px', display: 'grid', gridTemplateColumns: '400px 1fr', gap: '30px', height: 'calc(100vh - 70px)', overflow: 'hidden' }}>
        
        {/* LEFT BAR: Ready Naryads */}
        <div style={{ background: '#121212', borderRadius: '24px', border: '1px solid #222', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '25px', borderBottom: '1px solid #222', color: '#888', fontWeight: 800, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Наряди, готові до розподілу
          </div>
          <div style={{ overflowY: 'auto', flex: 1, padding: '20px' }}>
            {readyTasks.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '50px 20px', color: '#555' }}>
                <CheckCircle2 size={48} style={{ marginBottom: '15px', opacity: 0.2 }} />
                <p>Всі доступні наряди розподілено або черга порожня.</p>
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
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* RIGHT AREA: Work Cards Management */}
        <div style={{ background: '#121212', borderRadius: '24px', border: '1px solid #222', overflowY: 'auto', padding: '40px' }}>
          {activeTaskId ? (
            (() => {
              const task = readyTasks.find(t => t.id === activeTaskId)
              const order = orders.find(o => o.id === task.order_id)
              const cards = workCards.filter(c => c.task_id === task.id)
              // We don't automatically close, we let master manually close if everything is done or if they just want to.
              
              return (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '40px' }}>
                    <div>
                      <span style={{ color: '#ef4444', fontWeight: 800, fontSize: '0.8rem', letterSpacing: '0.15em', textTransform: 'uppercase', display: 'block', marginBottom: '10px' }}>УПРАВЛІННЯ НАРЯДОМ</span>
                      <h2 style={{ margin: 0, fontSize: '2.5rem', fontWeight: 900 }}>№ {order?.order_num}</h2>
                      <p style={{ color: '#888', marginTop: '10px', fontSize: '1.1rem' }}>{order?.customer}</p>
                    </div>
                    <div>
                      <button onClick={() => handleCloseNaryad(task.id)} style={{ background: '#10b981', color: '#fff', border: 'none', padding: '15px 25px', borderRadius: '14px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.95rem' }}>
                        <CheckCircle2 size={18} /> ЗАКРИТИ НАРЯД (ВЕСЬ ЦИКЛ ВИКОНАНО)
                      </button>
                    </div>
                  </div>

                  <div style={{ marginBottom: '40px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #333', paddingBottom: '15px', marginBottom: '20px' }}>
                      <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.2rem' }}><ListTodo size={20} color="#ef4444"/> РОБОЧІ КАРТКИ (ОПЕРАЦІЇ)</h3>
                      <button onClick={() => setShowAddCard(!showAddCard)} style={{ background: showAddCard ? '#333' : '#ef4444', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '10px', cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {showAddCard ? <><X size={16}/> Скасувати</> : <><Plus size={16}/> Додати операцію</>}
                      </button>
                    </div>

                    {showAddCard && (
                      <form onSubmit={handleCreateCard} style={{ background: '#1a1a1a', padding: '30px', borderRadius: '16px', border: '1px solid #333', marginBottom: '30px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '15px', alignItems: 'end' }}>
                        <div>
                          <label style={{ display: 'block', color: '#888', marginBottom: '8px', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase' }}>Операція</label>
                          <select style={{ width: '100%', padding: '15px', background: '#000', border: '1px solid #444', color: '#fff', borderRadius: '10px' }} value={newCard.operation} onChange={e => setNewCard({...newCard, operation: e.target.value})}>
                            {operations.map(o => <option key={o} value={o}>{o}</option>)}
                          </select>
                        </div>
                        <div>
                          <label style={{ display: 'block', color: '#888', marginBottom: '8px', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase' }}>Обладнання (РЦ)</label>
                          <select style={{ width: '100%', padding: '15px', background: '#000', border: '1px solid #444', color: '#fff', borderRadius: '10px' }} value={newCard.machine} onChange={e => setNewCard({...newCard, machine: e.target.value})}>
                            {machines.map(m => <option key={m} value={m}>{m}</option>)}
                          </select>
                        </div>
                        <div>
                          <label style={{ display: 'block', color: '#888', marginBottom: '8px', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase' }}>Норма (хв)</label>
                          <input type="number" required min="1" style={{ width: '100%', padding: '15px', background: '#000', border: '1px solid #444', color: '#fff', borderRadius: '10px' }} placeholder="60" value={newCard.estimatedTime} onChange={e => setNewCard({...newCard, estimatedTime: e.target.value})} />
                        </div>
                        <button type="submit" style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '15px 30px', borderRadius: '10px', height: '52px', fontWeight: 800, cursor: 'pointer' }}>СТВОРИТИ КАРТКУ</button>
                      </form>
                    )}

                    {cards.length === 0 ? (
                      <div style={{ padding: '40px', background: '#0f0f0f', border: '1px dashed #333', borderRadius: '16px', textAlign: 'center', color: '#666' }}>
                        Цей наряд ще не розбито на операції. Додайте першу робочу картку.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        {cards.map(card => (
                          <div key={card.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '25px', background: '#1a1a1a', borderRadius: '16px', border: '1px solid', borderColor: card.status === 'completed' ? '#10b981' : card.status === 'in-progress' ? '#f59e0b' : '#333' }}>
                            <div style={{ display: 'flex', gap: '30px', alignItems: 'center' }}>
                              <div style={{ background: '#000', padding: '15px', borderRadius: '12px', color: '#ef4444' }}>
                                <Hammer size={24} />
                              </div>
                              <div>
                                <h4 style={{ margin: '0 0 5px 0', fontSize: '1.2rem' }}>{card.operation}</h4>
                                <span style={{ color: '#888', fontSize: '0.9rem' }}>РЦ: {card.machine} | Час за нормою: {card.estimated_time || 0} хв</span>
                              </div>
                            </div>
                            <div>
                              <span style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', background: card.status === 'completed' ? 'rgba(16,185,129,0.1)' : card.status === 'in-progress' ? 'rgba(245,158,11,0.1)' : 'rgba(255,255,255,0.05)', color: card.status === 'completed' ? '#10b981' : card.status === 'in-progress' ? '#f59e0b' : '#aaa' }}>
                                {card.status === 'pending' ? 'Очікує оператора' : card.status === 'in-progress' ? 'В роботі' : 'Виконано'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
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
    </div>
  )
}

export default MasterWorkplace
