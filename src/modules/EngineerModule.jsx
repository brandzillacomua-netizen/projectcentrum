import React, { useState } from 'react'
import { 
  Settings, 
  ArrowLeft, 
  CheckCircle2, 
  Clock, 
  Cpu, 
  FileCode, 
  ShieldCheck,
  AlertCircle
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useMES } from '../MESContext'
import { apiService } from '../services/apiDispatcher'

const EngineerModule = () => {
  const { tasks, orders, nomenclatures, approveEngineer, loading } = useMES()
  
  // Pending approvals for Engineer
  const pendingTasks = tasks.filter(t => t.status === 'waiting' && !t.engineer_conf)
  const approvedTasks = tasks.filter(t => t.status === 'waiting' && t.engineer_conf)

  return (
    <div className="module-page engineer-page">
      <nav className="module-nav">
        <Link to="/" className="back-link"><ArrowLeft size={20} /> Назад</Link>
        <div className="module-title-group">
          <Settings className="text-blue" size={28} />
          <h1>Робоче місце Інженера</h1>
        </div>
      </nav>

      <div className="module-content">
        <div className="engineer-grid">
          {/* Main Work Area: Pending Approvals */}
          <section className="eng-section main-area">
            <div className="sec-header">
              <h3><Clock size={18} /> Наряди на підтвердження програм ЧПК</h3>
              <span className="badge blue">{pendingTasks.length}</span>
            </div>

            <div className="pending-list">
              {pendingTasks.map(task => {
                const order = orders.find(o => o.id === task.order_id)
                return (
                  <div key={task.id} className="eng-card">
                    <div className="eng-card-header">
                      <div className="order-info">
                        <strong>№{order?.order_num}</strong>
                        <span>{order?.customer}</span>
                      </div>
                      <div className="task-date">{new Date(task.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                    </div>

                    <div className="prog-list">
                      <label>Склад наряду (Деталі):</label>
                      {order?.order_items?.map((item, idx) => {
                        const nom = nomenclatures.find(n => n.id === item.nomenclature_id)
                        return (
                          <div key={idx} className="prog-item">
                            <FileCode size={14} className="text-blue" />
                            <div className="prog-details">
                              <div className="p-name">{nom?.name}</div>
                              <div className="p-code">{nom?.cnc_program || 'Program default'}</div>
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    <button 
                      className="btn-approve-eng"
                      onClick={() => apiService.submitApproveEngineer(task.id, approveEngineer)}
                    >
                      <ShieldCheck size={18} /> ПІДТВЕРДИТИ ПРОГРАМУ
                    </button>
                  </div>
                )
              })}
              {pendingTasks.length === 0 && (
                <div className="empty-state">
                  <CheckCircle2 size={48} className="text-success" />
                  <p>Всі наряди підтверджені. Нових запитів немає.</p>
                </div>
              )}
            </div>
          </section>

          {/* Sidebar: Stats or History */}
          <aside className="eng-sidebar">
            <div className="stat-panel">
              <h4>Статистика зміні</h4>
              <div className="stat-inner">
                <div className="s-row"><span>Всього підтверджено:</span> <strong>{approvedTasks.length}</strong></div>
                <div className="s-row"><span>В черзі:</span> <strong className="text-blue">{pendingTasks.length}</strong></div>
              </div>
            </div>

            <div className="info-panel alert">
              <div className="panel-head"><AlertCircle size={16} /> Важливо</div>
              <p>Ваше підтвердження гарантує, що оператор лазера отримає коректний файл розкрою. Перевірте BOM перед натисканням.</p>
            </div>
          </aside>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .engineer-page { background: #080808; height: 100vh; overflow: hidden; display: flex; flex-direction: column; }
        .text-blue { color: #3b82f6; }
        .engineer-grid { display: grid; grid-template-columns: 1fr 300px; gap: 30px; flex: 1; overflow: hidden; padding: 20px; }
        
        .eng-section { background: #121212; border-radius: 24px; border: 1px solid #222; display: flex; flex-direction: column; overflow: hidden; }
        .sec-header { padding: 25px; border-bottom: 1px solid #222; display: flex; justify-content: space-between; align-items: center; }
        .sec-header h3 { margin: 0; font-size: 1.1rem; display: flex; align-items: center; gap: 10px; color: #eee; }
        
        .pending-list { flex: 1; overflow-y: auto; padding: 20px; display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: 20px; align-content: start; }
        
        .eng-card { background: #0a0a0a; border: 1px solid #222; border-radius: 20px; padding: 25px; transition: 0.3s; display: flex; flex-direction: column; gap: 20px; }
        .eng-card:hover { border-color: #3b82f6; transform: translateY(-5px); box-shadow: 0 10px 30px rgba(59, 130, 246, 0.1); }
        
        .eng-card-header { display: flex; justify-content: space-between; align-items: flex-start; }
        .order-info strong { display: block; font-size: 1.2rem; color: #fff; margin-bottom: 4px; }
        .order-info span { font-size: 0.85rem; color: #666; font-weight: 600; }
        .task-date { font-family: monospace; font-size: 0.8rem; color: #444; }
        
        .prog-list { background: #111; padding: 15px; border-radius: 12px; border: 1px solid #222; }
        .prog-list label { font-size: 0.65rem; text-transform: uppercase; color: #555; display: block; margin-bottom: 12px; font-weight: 800; letter-spacing: 0.05em; }
        .prog-item { display: flex; gap: 12px; align-items: center; margin-bottom: 10px; }
        .p-name { font-size: 0.85rem; color: #eee; font-weight: 600; }
        .p-code { font-size: 0.7rem; color: #3b82f6; font-family: monospace; }
        
        .btn-approve-eng { width: 100%; padding: 16px; background: #3b82f6; color: #fff; border: none; border-radius: 12px; font-weight: 800; display: flex; align-items: center; justify-content: center; gap: 10px; cursor: pointer; transition: 0.3s; }
        .btn-approve-eng:hover { background: #2563eb; transform: scale(1.02); }
        
        .eng-sidebar { display: flex; flex-direction: column; gap: 20px; }
        .stat-panel { background: #121212; border: 1px solid #222; border-radius: 20px; padding: 20px; }
        .stat-panel h4 { margin: 0 0 15px; font-size: 0.8rem; text-transform: uppercase; color: #555; }
        .s-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 0.9rem; }
        
        .info-panel { background: rgba(59, 130, 246, 0.05); border: 1px solid rgba(59, 130, 246, 0.2); border-radius: 20px; padding: 20px; }
        .panel-head { display: flex; align-items: center; gap: 8px; font-size: 0.8rem; font-weight: 800; text-transform: uppercase; color: #3b82f6; margin-bottom: 10px; }
        .info-panel p { margin: 0; font-size: 0.8rem; color: #888; line-height: 1.5; }
        
        .empty-state { grid-column: 1 / -1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 100px; color: #444; text-align: center; }
        .empty-state p { margin-top: 20px; font-size: 1.1rem; }
      `}} />
    </div>
  )
}

export default EngineerModule
