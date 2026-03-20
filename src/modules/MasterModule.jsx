import React from 'react'
import { 
  ArrowLeft, 
  ClipboardCheck, 
  Clock, 
  Layers, 
  ListChecks, 
  Play, 
  User,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  BarChart3,
  History
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useMES } from '../MESContext'

const MasterModule = () => {
  const { orders, tasks, createNaryad, nomenclatures } = useMES()

  const getOrderStats = (order) => {
    if (!order || !order.order_items) return { totalSheets: 0, totalMin: 0 }
    let totalSheets = 0
    let totalMin = 0
    order.order_items?.forEach(item => {
      const nom = nomenclatures.find(n => n.id === item.nomenclature_id)
      if (nom) {
        totalSheets += Math.ceil(Number(item.quantity) / (nom.units_per_sheet || 1))
        totalMin += Number(item.quantity) * (Number(nom.time_per_unit) || 0)
      }
    })
    return { totalSheets, totalMin }
  }

  const formatDuration = (totalMinutes) => {
    if (!totalMinutes || isNaN(totalMinutes)) return '0 хв'
    const hours = Math.floor(totalMinutes / 60)
    const minutes = Math.round(totalMinutes % 60)
    if (hours === 0) return `${minutes} хв`
    return `${hours} год ${minutes > 0 ? minutes + ' хв' : ''}`
  }

  // Analytics Calculations
  const completedTasks = tasks.filter(t => t.status === 'completed')
  const totalProduced = completedTasks.length
  
  let totalScrapCount = 0
  completedTasks.forEach(t => {
    if (t.scrap_data) {
      Object.values(t.scrap_data).forEach(v => totalScrapCount += Number(v))
    }
  })

  return (
    <div className="module-page master-page">
      <nav className="module-nav">
        <Link to="/" className="back-link"><ArrowLeft size={20} /> Назад</Link>
        <div className="module-title-group">
          <ClipboardCheck className="text-accent" size={28} />
          <h1>Керування виробництвом</h1>
        </div>
      </nav>

      <div className="module-content">
        {/* Analytics Header */}
        <div className="analytics-bar">
          <div className="ana-card">
            <div className="ana-icon"><TrendingUp size={20} /></div>
            <div className="ana-data">
              <label>Виконано замовлень</label>
              <strong>{totalProduced}</strong>
            </div>
          </div>
          <div className="ana-card">
            <div className="ana-icon text-danger"><AlertTriangle size={20} /></div>
            <div className="ana-data">
              <label>Виявлено браку</label>
              <strong>{totalScrapCount} шт</strong>
            </div>
          </div>
          <div className="ana-card">
            <div className="ana-icon text-success"><CheckCircle2 size={20} /></div>
            <div className="ana-data">
              <label>Ефективність</label>
              <strong>{totalProduced > 0 ? '94%' : '0%'}</strong>
            </div>
          </div>
          <div className="ana-card">
            <div className="ana-icon text-primary"><BarChart3 size={20} /></div>
            <div className="ana-data">
              <label>Навантаження</label>
              <strong>{tasks.filter(t => t.status === 'in-progress').length} в роботі</strong>
            </div>
          </div>
        </div>

        <div className="master-grid-layout">
          {/* Section 1: New Orders Queue */}
          <section className="master-section">
            <div className="sec-header">
              <h3><ListChecks size={18} /> Черга замовлень</h3>
              <span className="badge">{orders.filter(o => o.status === 'pending').length}</span>
            </div>
            <div className="scroll-area">
              {orders.filter(o => o.status === 'pending').map(order => {
                const stats = getOrderStats(order)
                return (
                  <div key={order.id} className="queue-item">
                    <div className="q-head">
                      <strong>№{order.order_num}</strong>
                      <span>{order.customer}</span>
                    </div>
                    <div className="q-details">
                      {order.order_items?.map((item, idx) => (
                        <div key={idx} className="q-row">
                          <small>{nomenclatures.find(n => n.id === item.nomenclature_id)?.name}</small>
                          <small>{item.quantity} шт</small>
                        </div>
                      ))}
                    </div>
                    <div className="q-footer">
                      <div className="q-stat"><Layers size={14}/> {stats.totalSheets} лист.</div>
                      <div className="q-stat"><Clock size={14}/> {formatDuration(stats.totalMin)}</div>
                      <button className="btn-take" onClick={() => createNaryad(order.id)}>ПРИЙНЯТИ</button>
                    </div>
                  </div>
                )
              })}
              {orders.filter(o => o.status === 'pending').length === 0 && <div className="empty-msg">Черга порожня</div>}
            </div>
          </section>

          {/* Section 2: Active Tasks */}
          <section className="master-section active-sec">
            <div className="sec-header">
              <h3><Play size={18} fill="currentColor" /> Активні в цеху</h3>
              <span className="badge amber">{tasks.filter(t => t.status !== 'completed').length}</span>
            </div>
            <div className="scroll-area">
              {tasks.filter(t => t.status !== 'completed').map(task => {
                const order = orders.find(o => o.id === task.order_id)
                return (
                  <div key={task.id} className={`active-card ${task.status}`}>
                    <div className="ac-top">
                      <div className="ac-main">
                        <strong>№{order?.order_num} — {order?.customer}</strong>
                        <div className="step-tag">{task.step}</div>
                      </div>
                      <div className={`status-dot ${task.status}`}></div>
                    </div>
                    {task.operator_name && (
                      <div className="ac-op">
                        <User size={12} /> Оператор: {task.operator_name}
                      </div>
                    )}
                    <div className="status-desc">
                      {task.status === 'in-progress' ? 'Процес нарізки триває...' : 'Очікує підготовки матеріалів на складі'}
                    </div>
                  </div>
                )
              })}
              {tasks.filter(t => t.status !== 'completed').length === 0 && <div className="empty-msg">Немає активних завдань</div>}
            </div>
          </section>

          {/* Section 3: Completed History */}
          <section className="master-section">
            <div className="sec-header">
              <h3><History size={18} /> Історія (Брак)</h3>
            </div>
            <div className="scroll-area">
              {completedTasks.slice(0, 5).map(task => {
                const order = orders.find(o => o.id === task.order_id)
                return (
                  <div key={task.id} className="history-card">
                    <div className="h-head">
                      <strong>№{order?.order_num}</strong>
                      <span className="h-date">{new Date(task.completed_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                    </div>
                    <div className="h-scrap-list">
                      {order?.order_items?.map(item => {
                        const scrap = task.scrap_data?.[item.nomenclature_id] || 0
                        const nom = nomenclatures.find(n => n.id === item.nomenclature_id)
                        return (
                          <div key={item.id} className="h-scrap-row">
                            <span className="h-nom-name">{nom?.name}</span>
                            <div className="h-counts">
                              <span className="h-good">{item.quantity - scrap}</span>
                              {scrap > 0 && <span className="h-bad">+{scrap} брак</span>}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
              {completedTasks.length === 0 && <div className="empty-msg">Історія порожня</div>}
            </div>
          </section>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .master-page { background: #121212; height: 100vh; display: flex; flex-direction: column; color: #fff; }
        .analytics-bar { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 25px; }
        .ana-card { background: #1b1b1b; padding: 20px; border-radius: 20px; display: flex; align-items: center; gap: 15px; box-shadow: 0 10px 20px rgba(0,0,0,0.2); border: 1px solid #333; }
        .ana-icon { width: 48px; height: 48px; border-radius: 12px; background: #000; display: flex; align-items: center; justify-content: center; color: #ff9000; }
        .ana-icon.text-danger { background: #2a1111; color: #ef4444; }
        .ana-icon.text-success { background: #112a11; color: #22c55e; }
        .ana-icon.text-primary { background: #111a2a; color: #3b82f6; }
        .ana-data label { display: block; font-size: 0.75rem; color: #999; font-weight: 600; margin-bottom: 2px; }
        .ana-data strong { font-size: 1.4rem; font-weight: 900; color: #fff; }

        .master-grid-layout { flex: 1; display: grid; grid-template-columns: 1fr 1.2fr 1fr; gap: 25px; overflow: hidden; padding-bottom: 20px; }
        .master-section { background: #1b1b1b; border-radius: 24px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.3); border: 1px solid #333; }
        .sec-header { padding: 25px; border-bottom: 1px solid #333; display: flex; justify-content: space-between; align-items: center; background: #111; }
        .sec-header h3 { font-size: 1rem; display: flex; align-items: center; gap: 10px; margin: 0; color: #ff9000; text-transform: uppercase; font-weight: 800; letter-spacing: 0.1em; }
        .badge { background: #ff9000; padding: 4px 10px; border-radius: 8px; font-weight: 900; font-size: 0.75rem; color: #000; }
        .badge.amber { background: #ea580c; color: #fff; }

        .scroll-area { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 15px; }

        /* Queue Item */
        .queue-item { background: #121212; border: 1px solid #333; border-radius: 16px; padding: 18px; box-shadow: 0 4px 12px rgba(0,0,0,0.2); }
        .q-head { margin-bottom: 12px; border-bottom: 1px solid #333; padding-bottom: 10px; }
        .q-head strong { display: block; font-size: 1.1rem; color: #fff; }
        .q-head span { font-size: 0.8rem; color: #999; font-weight: 600; }
        .q-details { background: #1b1b1b; border-radius: 10px; padding: 10px; margin-bottom: 15px; border: 1px solid #333; }
        .q-row { display: flex; justify-content: space-between; padding: 2px 0; }
        .q-row small { color: #ccc; font-weight: 500; }
        .q-footer { display: flex; align-items: center; gap: 12px; border-top: 1px solid #333; padding-top: 12px; }
        .q-stat { display: flex; align-items: center; gap: 4px; font-size: 0.75rem; font-weight: 700; color: #ff9000; }
        .btn-take { margin-left: auto; background: #ff9000; color: #000; border: none; padding: 8px 16px; border-radius: 10px; font-size: 0.8rem; font-weight: 900; cursor: pointer; transition: 0.2s; }
        .btn-take:hover { background: #ffa500; transform: scale(1.05); }

        /* Active Card */
        .active-card { background: #121212; border: 1px solid #333; border-radius: 20px; padding: 20px; position: relative; border-left: 6px solid #282828; }
        .active-card.in-progress { border-left-color: #ff9000; background: #1b1b1b; border-color: #ff9000; }
        .ac-top { display: flex; justify-content: space-between; margin-bottom: 12px; }
        .ac-main strong { display: block; font-size: 1rem; color: #fff; }
        .step-tag { display: inline-block; font-size: 0.7rem; font-weight: 900; text-transform: uppercase; color: #ff9000; margin-top: 4px; background: rgba(255,144,0,0.1); padding: 2px 8px; border-radius: 4px; }
        .status-dot { width: 10px; height: 10px; border-radius: 50%; background: #333; }
        .status-dot.in-progress { background: #ff9000; box-shadow: 0 0 15px rgba(255, 144, 0, 0.8); }
        .ac-op { font-size: 0.8rem; color: #999; margin-top: 10px; padding-top: 10px; border-top: 1px solid #333; display: flex; align-items: center; gap: 6px; }
        .status-desc { font-size: 0.75rem; color: #777; font-style: italic; margin-top: 8px; }

        /* History Card */
        .history-card { background: #121212; border: 1px solid #333; border-radius: 16px; padding: 18px; }
        .h-head { display: flex; justify-content: space-between; margin-bottom: 12px; }
        .h-date { font-size: 0.75rem; color: #777; font-weight: 600; }
        .h-scrap-list { display: flex; flex-direction: column; gap: 8px; }
        .h-scrap-row { display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem; }
        .h-nom-name { color: #ccc; font-weight: 500; }
        .h-counts { display: flex; gap: 8px; }
        .h-good { font-weight: 900; color: #22c55e; }
        .h-bad { font-weight: 900; color: #ef4444; background: rgba(239, 68, 68, 0.1); padding: 2px 8px; border-radius: 4px; font-size: 0.7rem; }

        .empty-msg { padding: 40px 20px; text-align: center; color: #94a3b8; font-size: 0.85rem; font-style: italic; }
      `}} />
    </div>
  )
}

export default MasterModule
