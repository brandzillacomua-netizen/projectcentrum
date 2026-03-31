import React, { useState } from 'react'
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
  History,
  Package,
  Settings,
  Cpu
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useMES } from '../MESContext'
import { apiService } from '../services/apiDispatcher'

const MasterModule = () => {
  const { orders, tasks, createNaryad, nomenclatures, bomItems, machines, loading } = useMES()
  const [activeNaryadOrder, setActiveNaryadOrder] = useState(null)
  const [naryadPreparer, setNaryadPreparer] = useState('Пілецький Р.В.')
  const [selectedMachine, setSelectedMachine] = useState(null)

  const getBOMParts = (nomenclatureId) => {
    return bomItems
      .filter(b => b.parent_id === nomenclatureId)
      .map(b => ({
        ...b,
        nom: nomenclatures.find(n => n.id === b.child_id)
      }))
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
              <h3><ListChecks size={18} /> Черга замовлень (Менеджер)</h3>
              <span className="badge">{orders.filter(o => o.status === 'pending').length}</span>
            </div>
            <div className="scroll-area">
              {orders.filter(o => o.status === 'pending').map(order => (
                <div key={order.id} className="queue-item">
                  <div className="q-head">
                    <div className="q-title"><strong>№{order.order_num}</strong> — {order.customer}</div>
                    <div className="q-date">{order.order_date ? new Date(order.order_date).toLocaleDateString() : ''}</div>
                  </div>
                  <div className="q-items-summary">
                    {order.order_items?.map((item, idx) => {
                      const nom = nomenclatures.find(n => n.id === item.nomenclature_id)
                      return <div key={idx} className="q-sum-row">{nom?.name} — <strong>{item.quantity} {order.unit}</strong></div>
                    })}
                  </div>
                  <div className="q-footer">
                    <button className="btn-create-naryad full-width" onClick={() => setActiveNaryadOrder(order)}>
                      Сформувати робочий наряд
                    </button>
                  </div>
                </div>
              ))}
              {orders.filter(o => o.status === 'pending').length === 0 && <div className="empty-msg">Всі замовлення в роботі</div>}
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
                      <div className="approval-badges">
                        <span className={`approve-badge ${task.warehouse_conf ? 'success' : 'pending'}`}>
                          <Package size={12} /> Склад {task.warehouse_conf ? 'готов' : '...'}
                        </span>
                        <span className={`approve-badge ${task.engineer_conf ? 'success' : 'pending'}`}>
                          <Settings size={12} /> Технолог {task.engineer_conf ? 'готово' : '...'}
                        </span>
                      </div>
                      <div style={{ marginTop: '8px', fontSize: '0.75rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <Cpu size={12} color="var(--primary)" />
                        Станок: <strong>{task.machine_name || 'Не призначено'}</strong>
                      </div>
                      {task.status === 'in-progress' ? 'Процес нарізки триває...' : 
                       (!task.warehouse_conf || !task.engineer_conf) ? 'Чекаємо на підтвердження...' : 'Готово до роботи'}
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

      {/* Naryad Creation Modal */}
      {activeNaryadOrder && (
        <div className="modal-overlay naryad-modal">
          <div className="naryad-worksheet glass-panel" data-order-num={activeNaryadOrder.order_num}>
            <div className="worksheet-header">
              <h1 className="print-only-title">РОБОЧИЙ НАРЯД НА РОЗКРІЙ № {activeNaryadOrder.order_num}</h1>
              
              <div className="header-meta">
                <div className="meta-item"><span>Дата наряду:</span> <strong>{new Date().toLocaleString()}</strong></div>
                <div className="meta-item"><span>Наряд оформив:</span> <span className="p-preparer" style={{ color: '#888' }}>{naryadPreparer}</span></div>
              </div>

              <div className="no-print" style={{ marginBottom: '12px', background: '#000', padding: '10px 15px', borderRadius: '10px', border: '1px solid #333' }}>
                 <div style={{ fontSize: '0.6rem', textTransform: 'uppercase', color: '#666', marginBottom: '8px', fontWeight: 800, letterSpacing: '0.05em' }}>Оберіть станок для роботи:</div>
                 <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                   {machines.map(m => (
                     <button
                       key={m.id}
                       onClick={() => setSelectedMachine(m)}
                       style={{ 
                         background: selectedMachine?.id === m.id ? 'var(--primary)' : '#121212',
                         color: selectedMachine?.id === m.id ? '#000' : '#888',
                         border: `1px solid ${selectedMachine?.id === m.id ? 'var(--primary)' : '#222'}`,
                         padding: '4px 12px',
                         borderRadius: '6px',
                         cursor: 'pointer',
                         fontSize: '0.75rem',
                         fontWeight: 700,
                         transition: '0.2s',
                         display: 'flex',
                         alignItems: 'center',
                         gap: '8px'
                       }}
                     >
                       <span>{m.name}</span>
                       <span style={{ fontSize: '0.6rem', opacity: 0.6 }}>({m.sheet_capacity} л.)</span>
                     </button>
                   ))}
                 </div>
               </div>

               <div className="print-machine-info" style={{ display: 'none', marginBottom: '12px', padding: '10px 0', borderBottom: '1px solid #000' }}>
                 <span style={{ fontSize: '10pt', fontWeight: 800 }}>СТАНОК: {selectedMachine?.name || '—'}</span>
               </div>

              <div className="header-order-info" style={{ padding: '10px 15px', borderRadius: '8px' }}>
                <div className="info-box"><span>Замовник:</span> <strong>{activeNaryadOrder.customer}</strong></div>
                <div className="info-box"><span>Планова дата відвантаження:</span> <strong>{activeNaryadOrder.deadline ? new Date(activeNaryadOrder.deadline).toLocaleDateString() : '—'}</strong></div>
              </div>

              <div className="finished-product-pills" style={{ marginTop: '12px', display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                {activeNaryadOrder.order_items?.map(item => {
                  const nom = nomenclatures.find(n => n.id === item.nomenclature_id)
                  return (
                    <div key={item.id} style={{ 
                      background: 'rgba(239, 68, 68, 0.1)', 
                      borderLeft: '4px solid #ef4444', 
                      padding: '12px 20px', 
                      borderRadius: '0 10px 10px 0',
                      flex: 1,
                      minWidth: '300px'
                    }}>
                      <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: '#888', fontWeight: 800, marginBottom: '4px' }}>ГОТОВИЙ ВИРІБ:</div>
                      <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#fff' }}>
                        {nom?.name} <span style={{ color: '#ef4444' }}>— {item.quantity} шт.</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="worksheet-scroll">
              <div className="worksheet-body" style={{ padding: '15px 0' }}>
                <table className="naryad-table">
                  <thead>
                    <tr className="main-th">
                      <th rowSpan="2" className="col-nom">Номенклатура виробництва</th>
                      <th rowSpan="2" className="col-num">Наявн., шт</th>
                      <th rowSpan="2" className="col-num">Виробити, шт</th>
                      <th rowSpan="2" className="col-mat">Лист, мм</th>
                      <th rowSpan="2" className="col-num">шт / Лист</th>
                      <th colSpan="3" className="res-th">Результат розрахунку</th>
                    </tr>
                    <tr className="sub-th">
                      <th className="res-th">Задати листів</th>
                      <th className="res-th">Завантажень</th>
                      <th className="res-th">Залишок БЗ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeNaryadOrder.order_items?.map((item) => {
                      const parts = getBOMParts(item.nomenclature_id)
                      const displayParts = parts.length > 0 ? parts : [{ 
                        nom: nomenclatures.find(n => n.id === item.nomenclature_id), 
                        quantity_per_parent: 1 
                      }]

                      return displayParts.map((part, pIdx) => {
                        const totalToProduce = item.quantity * part.quantity_per_parent
                        const sheets = Math.ceil(totalToProduce / (part.nom?.units_per_sheet || 1))
                        const remainder = (sheets * (part.nom?.units_per_sheet || 0)) - totalToProduce

                        return (
                          <tr key={`${item.id}-${pIdx}`}>
                            <td className="nom-cell">
                              <div className="nom-primary">{part.nom?.name}</div>
                            </td>
                            <td className="center-cell">—</td>
                            <td className="center-cell"><strong>{totalToProduce}</strong></td>
                            <td className="center-cell">{part.nom?.material_type || '—'}</td>
                            <td className="center-cell">{part.nom?.units_per_sheet || 1}</td>
                            <td className="result-cell sheets"><strong>{sheets}</strong></td>
                            <td className="result-cell" style={{ color: 'var(--primary)', fontWeight: 800 }}>
                              {selectedMachine ? Math.ceil(sheets / selectedMachine.sheet_capacity) : '—'}
                            </td>
                            <td className="result-cell rem">{remainder}</td>
                          </tr>
                        )
                      })
                    })}
                  </tbody>
                </table>

                {/* Material Summary Section */}
                {(() => {
                  const summary = {}
                  activeNaryadOrder.order_items?.forEach(item => {
                    const parts = getBOMParts(item.nomenclature_id)
                    const displayParts = parts.length > 0 ? parts : [{ 
                      nom: nomenclatures.find(n => n.id === item.nomenclature_id), 
                      quantity_per_parent: 1 
                    }]
                    displayParts.forEach(part => {
                      const totalToProduce = item.quantity * part.quantity_per_parent
                      const sheets = Math.ceil(totalToProduce / (part.nom?.units_per_sheet || 1))
                      const mat = part.nom?.material_type || 'Інше'
                      summary[mat] = (summary[mat] || 0) + sheets
                    })
                  })
                  return (
                    <div className="naryad-summary-box" style={{ marginTop: '15px', padding: '12px 15px' }}>
                      <h4 className="summary-title" style={{ marginBottom: '10px' }}><Layers size={14} /> Сумарна витрата сировини:</h4>
                      <div className="summary-pills" style={{ gap: '10px' }}>
                        {Object.entries(summary).map(([mat, total]) => (
                          <div key={mat} className="summary-pill" style={{ padding: '6px 12px' }}>
                            <span className="mat-name">{mat}:</span>
                            <strong className="mat-val">{total} лист.</strong>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })()}

                {/* Printable Signatures */}
                <div className="print-signatures">
                  <div className="sig-box"><div className="sig-label">Наряд оформив:</div><div className="sig-line"></div></div>
                  <div className="sig-box"><div className="sig-label">Матеріал видав:</div><div className="sig-line"></div></div>
                  <div className="sig-box"><div className="sig-label">Оператор прийняв:</div><div className="sig-line"></div></div>
                </div>
              </div>
            </div>

            <div className="worksheet-footer">
              <button className="btn-cancel" onClick={() => setActiveNaryadOrder(null)}>Відмінити</button>
              <button className="btn-confirm-naryad" disabled={!selectedMachine} style={{ opacity: selectedMachine ? 1 : 0.5, cursor: selectedMachine ? 'pointer' : 'not-allowed' }} onClick={() => {
                window.print()
                apiService.submitCreateTask(activeNaryadOrder.id, selectedMachine?.name, createNaryad)
                setActiveNaryadOrder(null)
                setSelectedMachine(null)
              }}>
                {selectedMachine ? `Задати на ${selectedMachine.name} та Роздрукувати` : 'Оберіть станок для підтвердження'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .print-only-title { display: none; }
        
        @media print {
          body * { visibility: hidden; }
          .naryad-modal, .naryad-modal * { visibility: visible; }
          .naryad-modal { 
            position: absolute; left: 0; top: 10mm; width: 100%; padding: 0; 
            background: #fff !important; display: block !important; 
          }
          .naryad-worksheet { 
            border: none; box-shadow: none; width: 100%; color: #000 !important; 
            background: #fff !important; 
          }
          .worksheet-header { border-bottom: 2px solid #000 !important; padding: 0 0 10px 0 !important; background: #fff !important; margin: 0 !important; }
          .print-only-title { display: block !important; text-align: center; font-size: 18pt; margin-bottom: 20px; font-weight: 800; color: #000 !important; border-bottom: 2px solid #000; padding-bottom: 10px; }
          
          .header-meta, .header-order-info { background: #fff !important; border: none !important; margin: 5px 0 !important; }
          .p-preparer { border-bottom: 1px dotted #000; padding: 0 10px; }
          
          .print-machine-info { display: block !important; }
          .no-print { display: none !important; }

          .naryad-table { border: 1.5px solid #000 !important; width: 100% !important; table-layout: fixed !important; }
          .naryad-table th, .naryad-table td { border: 1px solid #000 !important; color: #000 !important; padding: 6px !important; overflow: hidden; }
          
          .col-nom { width: 35%; }
          .col-num { width: 10%; text-align: center; }
          .col-mat { width: 15%; text-align: center; }
          
          .nom-primary { color: #000 !important; font-weight: 800 !important; font-size: 11pt !important; }
          .main-th, .sub-th { background: #eee !important; font-weight: 800 !important; font-size: 9pt !important; }
          .res-th { background: #ddd !important; font-weight: 800 !important; }
          .result-cell.sheets { background: #f0f0f0 !important; font-size: 12pt !important; border-width: 2px !important; }
          
          .naryad-summary-box { border: 1.5px solid #000 !important; background: #fff !important; margin-top: 20px; }
          .summary-title { color: #000 !important; font-weight: 800; border-bottom: 1px solid #000; }
          .summary-pill { border-bottom: 1px solid #eee !important; border-radius: 0 !important; background: #fff !important; color: #000 !important; padding: 4px 0 !important; }
          .mat-name { color: #000 !important; font-weight: bold; }
          .mat-val { color: #000 !important; font-size: 12pt !important; }

          .worksheet-footer, .btn-cancel, .btn-confirm-naryad, .back-link, .module-nav, .analytics-bar, .master-grid-layout, .empty-msg, .naryad-worksheet::before { display: none !important; }
          @page { size: A4 portrait; margin: 10mm; }
          
          .print-signatures {
            display: grid !important; grid-template-columns: 1fr 1fr 1fr; gap: 40px;
            margin-top: 40px; border-top: 1px solid #000; padding-top: 20px;
          }
          .sig-box { font-size: 10pt; font-weight: bold; }
          .sig-line { border-bottom: 1px solid #000; height: 25px; margin-top: 5px; }
        }

        .print-signatures { display: none; }

        .master-page { background: #0a0a0a; height: 100vh; overflow: hidden; display: flex; flex-direction: column; }
        .module-content { padding: 25px; flex: 1; overflow: hidden; display: flex; flex-direction: column; }
        
        .naryad-summary-box { margin-top: 30px; padding: 20px; background: rgba(34, 197, 94, 0.05); border: 1px solid rgba(34, 197, 94, 0.2); border-radius: 12px; }
        .summary-title { margin: 0 0 15px; font-size: 0.8rem; text-transform: uppercase; color: #22c55e; display: flex; align-items: center; gap: 8px; }
        .summary-pills { display: flex; flex-wrap: wrap; gap: 15px; }
        .summary-pill { display: flex; align-items: baseline; gap: 8px; background: #000; border: 1px solid #222; padding: 10px 18px; border-radius: 10px; }
        .mat-name { font-size: 0.85rem; color: #888; }
        .mat-val { font-size: 1.1rem; color: var(--primary); font-weight: 800; }

        .analytics-bar { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 25px; }
        .ana-card { background: #151515; border: 1px solid #222; border-radius: 16px; padding: 15px; display: flex; align-items: center; gap: 12px; }
        
        .master-grid-layout { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 25px; flex: 1; overflow: hidden; }
        .master-section { background: #151515; border-radius: 20px; border: 1px solid #222; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.4); }
        .scroll-area { flex: 1; overflow-y: auto; padding: 15px; display: flex; flex-direction: column; gap: 12px; }
        .worksheet-scroll { flex: 1; overflow-y: auto; padding: 0 20px; }
        
        .queue-item { background: #0d0d0d; border: 1px solid #222; border-radius: 16px; padding: 18px; transition: 0.3s; }
        .q-head { display: flex; justify-content: space-between; margin-bottom: 15px; }
        .q-title { font-size: 0.95rem; color: #eee; }
        .q-date { font-size: 0.75rem; color: #555; font-weight: 700; }
        .q-sum-row { font-size: 0.8rem; color: #888; border-bottom: 1px solid #1a1a1a; padding: 4px 0; }
        .q-sum-row strong { color: var(--primary); }
        
        .btn-create-naryad { background: var(--primary); color: #000; border: none; padding: 10px; border-radius: 8px; font-weight: 800; font-size: 0.75rem; cursor: pointer; text-transform: uppercase; margin-top: 15px; }
        .btn-create-naryad:hover { transform: translateY(-2px); box-shadow: 0 5px 15px rgba(255, 144, 0, 0.3); }

        /* Naryad Modal & Worksheet */
        .naryad-modal { 
          position: fixed; top: 0; left: 0; right: 0; bottom: 0; 
          background: rgba(0,0,0,0.85); display: flex; align-items: center; 
          justify-content: center; z-index: 1000; padding: 40px; 
        }
        .naryad-worksheet { background: #111; width: 100%; max-width: 1100px; padding: 0; border: 2px solid #333; overflow: hidden; color: #fff; border-radius: 12px; max-height: 95vh; display: flex; flex-direction: column; }
        .worksheet-header { padding: 15px 20px; border-bottom: 1px solid #333; background: #0a0a0a; }
        .header-meta { display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 0.85rem; }
        .meta-item input { background: transparent; border: none; border-bottom: 1px dotted #555; color: var(--primary); font-weight: 700; padding: 0 5px; }
        
        .header-order-info { display: flex; justify-content: space-between; background: #151515; padding: 15px; border: 1px solid #222; }
        .info-box span { display: block; font-size: 0.65rem; text-transform: uppercase; color: #666; margin-bottom: 4px; }
        
        .worksheet-body { padding: 20px; }
        .naryad-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
        .naryad-table th, .naryad-table td { border: 1px solid #333; padding: 10px; }
        .main-th { background: #222; color: #888; font-size: 0.7rem; text-transform: uppercase; }
        .sub-th { background: #1a1a1a; }
        .accent-th { background: #223a2d; color: #22c55e; }
        .res-th { background: #223a2d; color: #fff; }
        
        .nom-cell { min-width: 300px; }
        .nom-primary { font-weight: 700; color: #fff; }
        .cnc-hint { font-size: 0.7rem; color: #555; font-family: monospace; }
        .center-cell { text-align: center; }
        .result-cell { text-align: center; font-weight: 700; }
        .result-cell.sheets { background: #2d5a4544; color: #22c55e; }
        .result-cell.rem { color: #888; }
        
        .worksheet-footer { padding: 15px 20px; display: flex; justify-content: flex-end; gap: 20px; background: #0a0a0a; border-top: 1px solid #333; }
        .btn-cancel { background: transparent; border: 1px solid #333; color: #666; padding: 10px 20px; border-radius: 8px; cursor: pointer; }
        .btn-confirm-naryad { background: #22c55e; color: #000; border: none; padding: 12px 30px; border-radius: 8px; font-weight: 800; cursor: pointer; }
        .btn-confirm-naryad:hover { background: #34d399; }
        
        /* Active Tasks & History */
        .active-card { background: #0d0d0d; padding: 15px; border-radius: 12px; border-left: 4px solid var(--primary); margin-bottom: 10px; }
        .status-dot { width: 8px; height: 8px; border-radius: 50%; background: #333; }
        .status-dot.in-progress { background: #22c55e; box-shadow: 0 0 10px #22c55e; }

        .approval-badges { display: flex; gap: 8px; margin-bottom: 12px; }
        .approve-badge { 
          display: flex; align-items: center; gap: 5px; font-size: 0.65rem; 
          padding: 4px 8px; border-radius: 6px; font-weight: 700; border: 1px solid #222;
          background: #111; color: #444; text-transform: uppercase;
        }
        .approve-badge.success { background: rgba(34,197,94,0.1); border-color: rgba(34,197,94,0.3); color: #22c55e; }
        .approve-badge.pending { background: rgba(239,68,68,0.05); border-color: rgba(239,68,68,0.1); color: #555; }
      `}} />
    </div>
  )
}

export default MasterModule
