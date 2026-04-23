import React, { useState } from 'react'
import { 
  Truck, 
  ArrowLeft, 
  CheckCircle2, 
  ClipboardList,
  AlertCircle,
  PackageCheck,
  Zap,
  X,
  Package,
  FileText,
  MoreVertical,
  Printer,
  Download,
  Eye,
  Calendar,
  User,
  Hash,
  ArrowRight,
  Boxes
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useMES } from '../MESContext'
import { apiService } from '../services/apiDispatcher'

const ShippingModule = () => {
  const { orders, tasks, nomenclatures, updateOrderStatus, supabase, fetchData, currentUser } = useMES()
  const [activeMobileSection, setActiveMobileSection] = useState('ready')
  const [selectedBatch, setSelectedBatch] = useState(null)
  const [isProcessing, setIsProcessing] = useState(false)

  // Знаходимо партії, які вже запаковані
  const readyBatches = (tasks || []).filter(t => 
    t.status === 'completed' && 
    t.plan_snapshot?._metadata?.is_packaged === true &&
    t.plan_snapshot?._metadata?.is_shipped !== true
  ).map(t => {
    const order = (orders || []).find(o => String(o.id) === String(t.order_id))
    return {
      ...t,
      orderNum: order?.order_num || '???',
      customer: order?.customer || 'Unknown',
      orderId: t.order_id,
      deadline: order?.deadline
    }
  })

  // Замовлення, які ще в процесі консолідації
  const inConsolidation = orders.filter(o => o.status !== 'shipped' && o.status !== 'cancelled')

  const getStatusStyle = (s) => {
    const map = {
      'pending': { bg: 'rgba(255, 144, 0, 0.1)', color: '#ff9000', label: 'Очікує' },
      'in-progress': { bg: 'rgba(14, 165, 233, 0.1)', color: '#0ea5e9', label: 'В роботі' },
      'completed': { bg: 'rgba(168, 85, 247, 0.1)', color: '#a855f7', label: 'Пакування' },
      'packaged': { bg: 'rgba(16, 185, 129, 0.1)', color: '#10b981', label: 'Готово' },
      'shipped': { bg: 'rgba(100, 116, 139, 0.1)', color: '#64748b', label: 'Відправлено' }
    }
    return map[s] || { bg: '#222', color: '#888', label: s?.toUpperCase() }
  }

  const handleShipBatch = async (task) => {
    if (!window.confirm(`Підтвердити відвантаження партії №${task.orderNum}/${task.batch_index}?`)) return
    
    try {
      setIsProcessing(true)
      const newSnapshot = {
        ...(task.plan_snapshot || {}),
        _metadata: {
          ...(task.plan_snapshot?._metadata || {}),
          is_shipped: true,
          shipped_at: new Date().toISOString()
        }
      }
      await supabase.from('tasks').update({ plan_snapshot: newSnapshot }).eq('id', task.id)
      
      const { data: siblingTasks } = await supabase.from('tasks').select('plan_snapshot').eq('order_id', task.orderId)
      const allShipped = (siblingTasks || []).every(st => st.plan_snapshot?._metadata?.is_shipped === true)
      
      if (allShipped) {
        await supabase.from('orders').update({ status: 'shipped' }).eq('id', task.orderId)
      }

      await fetchData()
      setSelectedBatch(null)
    } catch (e) {
       console.error(e)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="shipping-dashboard" style={{ background: '#050505', minHeight: '100vh', color: '#e2e8f0', display: 'flex', flexDirection: 'column', fontFamily: 'Inter, system-ui, sans-serif' }}>
      
      {/* PROFESSIONAL HEADER */}
      <header style={{ 
        padding: '20px 40px', 
        background: 'rgba(10, 10, 10, 0.8)', 
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid #1a1a1a',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        position: 'sticky',
        top: 0,
        zIndex: 100
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '30px' }}>
          <Link to="/" className="nav-back-btn">
            <ArrowLeft size={20} />
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div style={{ background: 'linear-gradient(135deg, #ff9000 0%, #ff5e00 100%)', padding: '12px', borderRadius: '16px', boxShadow: '0 8px 20px rgba(255, 144, 0, 0.2)' }}>
              <Truck size={24} color="#000" />
            </div>
            <div>
              <h1 style={{ fontSize: '1.25rem', fontWeight: 900, margin: 0, letterSpacing: '-0.02em' }}>ЛОГІСТИЧНИЙ ЦЕНТР</h1>
              <div style={{ fontSize: '0.7rem', color: '#555', fontWeight: 600, textTransform: 'uppercase', marginTop: '2px' }}>Управління відвантаженням та ТТН</div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }} className="hide-mobile">
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>{currentUser?.first_name} {currentUser?.last_name}</div>
            <div style={{ fontSize: '0.65rem', color: '#ff9000', fontWeight: 800 }}>ОПЕРАТОР ЛОГІСТИКИ</div>
          </div>
          <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#111', border: '1px solid #222', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <User size={20} color="#555" />
          </div>
        </div>
      </header>

      <main style={{ padding: '40px', flex: 1, maxWidth: '1800px', margin: '0 auto', width: '100%' }}>
        
        {/* MOBILE TABS */}
        <div className="mobile-only" style={{ display: 'flex', gap: '10px', marginBottom: '30px', background: '#111', padding: '6px', borderRadius: '18px' }}>
          <button onClick={() => setActiveMobileSection('ready')} style={{ flex: 1, padding: '14px', borderRadius: '14px', border: 'none', background: activeMobileSection === 'ready' ? '#ff9000' : 'transparent', color: activeMobileSection === 'ready' ? '#000' : '#555', fontWeight: 900, fontSize: '0.75rem' }}>ГОТОВО ({readyBatches.length})</button>
          <button onClick={() => setActiveMobileSection('plan')} style={{ flex: 1, padding: '14px', borderRadius: '14px', border: 'none', background: activeMobileSection === 'plan' ? '#ff9000' : 'transparent', color: activeMobileSection === 'plan' ? '#000' : '#555', fontWeight: 900, fontSize: '0.75rem' }}>ПЛАН ({inConsolidation.length})</button>
        </div>

        <div className="dashboard-grid">
          
          {/* LEFT: READY TO SHIP (THE "HOT" COLUMN) */}
          {(activeMobileSection === 'ready' || !window.matchMedia("(max-width: 1024px)").matches) && (
            <section className="dashboard-col">
              <div className="col-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div className="pulse-icon"><div className="pulse-dot" /></div>
                  <h3 style={{ fontSize: '0.9rem', fontWeight: 800, color: '#fff', margin: 0 }}>ГОТОВО ДО ВІДВАНТАЖЕННЯ</h3>
                </div>
                <span className="count-badge">{readyBatches.length} ПАРТІЙ</span>
              </div>

              <div className="batch-grid">
                {readyBatches.map(batch => (
                  <div key={batch.id} className="batch-card glass-panel">
                    <div className="batch-card-header">
                      <div className="batch-id-group">
                        <div className="order-num">#{batch.orderNum}</div>
                        <div className="batch-idx">ПАРТІЯ {batch.batch_index}</div>
                      </div>
                      <div className="action-menu">
                         <button className="icon-btn" onClick={() => setSelectedBatch(batch)}><FileText size={18} /></button>
                      </div>
                    </div>

                    <div className="customer-info">
                      <User size={14} style={{ color: '#ff9000' }} />
                      <span>{batch.customer}</span>
                    </div>

                    <div className="items-preview">
                      {batch.plan_snapshot?.nomenclatures?.slice(0, 4).map((item, i) => (
                        <div key={i} className="item-row">
                          <span className="item-name">{nomenclatures.find(n => n.id === item.id)?.name || item.name}</span>
                          <span className="item-qty">{item.qty} {item.unit || 'шт'}</span>
                        </div>
                      ))}
                      {batch.plan_snapshot?.nomenclatures?.length > 4 && (
                        <div className="more-items">+{batch.plan_snapshot.nomenclatures.length - 4} інших позицій</div>
                      )}
                    </div>

                    <div className="batch-card-footer">
                      <div className="deadline-tag">
                        <Calendar size={12} />
                        <span>{batch.deadline ? new Date(batch.deadline).toLocaleDateString() : 'No date'}</span>
                      </div>
                      <button className="ship-btn" onClick={() => handleShipBatch(batch)} disabled={isProcessing}>
                        <Truck size={16} />
                        <span>ПІДТВЕРДИТИ</span>
                      </button>
                    </div>
                  </div>
                ))}

                {readyBatches.length === 0 && (
                  <div className="empty-state">
                    <PackageCheck size={48} color="#1a1a1a" />
                    <p>Черга відвантаження порожня</p>
                    <span>Очікуємо завершення пакування в цеху</span>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* RIGHT: PRODUCTION PIPELINE */}
          {(activeMobileSection === 'plan' || !window.matchMedia("(max-width: 1024px)").matches) && (
            <section className="dashboard-col">
              <div className="col-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <ClipboardList size={18} color="#555" />
                  <h3 style={{ fontSize: '0.9rem', fontWeight: 800, color: '#555', margin: 0 }}>В ПЛАНІ ВИРОБНИЦТВА</h3>
                </div>
              </div>

              <div className="pipeline-list">
                {inConsolidation.map(order => {
                  const orderTasks = (tasks || []).filter(t => String(t.order_id) === String(order.id))
                  const packagedCount = orderTasks.filter(t => t.plan_snapshot?._metadata?.is_packaged).length
                  const progress = orderTasks.length > 0 ? (packagedCount / orderTasks.length) * 100 : 0
                  const style = getStatusStyle(order.status)

                  return (
                    <div key={order.id} className="pipeline-card">
                      <div className="pipeline-main">
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '0.9rem', fontWeight: 800 }}>#{order.order_num}</span>
                            <span className="status-pill" style={{ background: style.bg, color: style.color }}>{style.label}</span>
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#555', marginTop: '4px', fontWeight: 600 }}>{order.customer}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '0.9rem', fontWeight: 900, color: '#ff9000' }}>{Math.round(progress)}%</div>
                          <div style={{ fontSize: '0.6rem', color: '#333' }}>ЗАПАКОВАНО</div>
                        </div>
                      </div>

                      <div className="progress-track">
                        <div className="progress-fill" style={{ width: `${progress}%` }} />
                      </div>

                      <div className="pipeline-stats">
                         <div className="stat-item">
                            <Boxes size={12} />
                            <span>{packagedCount} / {orderTasks.length} партій</span>
                         </div>
                         {progress === 100 && order.status !== 'shipped' && (
                           <div style={{ fontSize: '0.65rem', color: '#10b981', fontWeight: 800 }}>ГОТОВО ДО ВИХОДУ</div>
                         )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          )}

        </div>
      </main>

      {/* DOCUMENT PREVIEW MODAL */}
      {selectedBatch && (
        <div className="modal-overlay">
          <div className="document-modal glass-panel">
             <div className="modal-header">
                <div>
                   <h2 style={{ fontSize: '1.4rem', fontWeight: 900, margin: 0, color: '#fff' }}>ТОВАРО-ТРАНСПОРТНА НАКЛАДНА</h2>
                   <div style={{ fontSize: '0.8rem', color: '#555', marginTop: '5px' }}>Супровідний документ № {selectedBatch.orderNum}/{selectedBatch.batch_index}</div>
                </div>
                <button className="close-modal" onClick={() => setSelectedBatch(null)}><X size={24} /></button>
             </div>

             <div className="modal-body">
                <div className="doc-meta-grid">
                   <div className="meta-box">
                      <label>ВІДПРАВНИК</label>
                      <div className="val">REBRAND STUDIO / CENTRUM</div>
                   </div>
                   <div className="meta-box">
                      <label>ОТРИМУВАЧ</label>
                      <div className="val">{selectedBatch.customer}</div>
                   </div>
                   <div className="meta-box">
                      <label>НОМЕР ЗАМОВЛЕННЯ</label>
                      <div className="val">#{selectedBatch.orderNum}</div>
                   </div>
                   <div className="meta-box">
                      <label>ПАРТІЯ</label>
                      <div className="val">{selectedBatch.batch_index}</div>
                   </div>
                </div>

                <div className="items-table-container">
                   <table className="doc-table">
                      <thead>
                         <tr>
                            <th>#</th>
                            <th>Найменування товару</th>
                            <th style={{ textAlign: 'center' }}>Один.</th>
                            <th style={{ textAlign: 'right' }}>Кількість</th>
                         </tr>
                      </thead>
                      <tbody>
                         {selectedBatch.plan_snapshot?.nomenclatures?.map((item, idx) => (
                           <tr key={idx}>
                              <td>{idx + 1}</td>
                              <td className="item-name-cell">{nomenclatures.find(n => n.id === item.id)?.name || item.name}</td>
                              <td style={{ textAlign: 'center' }}>{item.unit || 'шт'}</td>
                              <td style={{ textAlign: 'right', fontWeight: 900 }}>{item.qty}</td>
                           </tr>
                         ))}
                      </tbody>
                   </table>
                </div>
             </div>

             <div className="modal-footer">
                <button className="secondary-btn"><Printer size={18} /> ДРУКУВАТИ</button>
                <button className="primary-btn" onClick={() => handleShipBatch(selectedBatch)} disabled={isProcessing}>
                   <Truck size={20} /> ПІДТВЕРДИТИ ВІДВАНТАЖЕННЯ
                </button>
             </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800;900&display=swap');

        .dashboard-grid {
          display: grid;
          grid-template-columns: 1.5fr 1fr;
          gap: 40px;
        }

        @media (max-width: 1024px) {
          .dashboard-grid { grid-template-columns: 1fr; }
        }

        .dashboard-col {
          display: flex;
          flex-direction: column;
          gap: 25px;
        }

        .col-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0 10px;
        }

        .count-badge {
          background: #111;
          color: #ff9000;
          font-size: 0.65rem;
          font-weight: 900;
          padding: 6px 12px;
          border-radius: 10px;
          border: 1px solid #222;
        }

        .batch-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
          gap: 20px;
        }

        .batch-card {
          background: rgba(15, 15, 15, 0.4);
          border: 1px solid #1a1a1a;
          border-radius: 28px;
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 15px;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
          overflow: hidden;
        }

        .batch-card:hover {
          background: rgba(20, 20, 20, 0.6);
          border-color: #ff900044;
          transform: translateY(-5px);
          box-shadow: 0 20px 40px rgba(0,0,0,0.4);
        }

        .batch-card::before {
          content: '';
          position: absolute;
          top: 0; left: 0; width: 4px; height: 100%;
          background: #10b981;
          opacity: 0.5;
        }

        .batch-card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }

        .order-num { font-size: 1.2rem; font-weight: 900; color: #fff; line-height: 1; }
        .batch-idx { font-size: 0.65rem; font-weight: 900; color: #555; margin-top: 4px; }

        .customer-info {
          display: flex;
          align-items: center;
          gap: 8px;
          background: #080808;
          padding: 10px 14px;
          border-radius: 12px;
          font-size: 0.8rem;
          font-weight: 700;
          color: #ccc;
        }

        .items-preview {
          background: #0a0a0a;
          border-radius: 18px;
          padding: 15px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          border: 1px solid #151515;
        }

        .item-row {
          display: flex;
          justify-content: space-between;
          font-size: 0.75rem;
        }

        .item-name { color: #555; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 70%; }
        .item-qty { color: #888; font-weight: 800; }
        .more-items { font-size: 0.65rem; color: #333; text-align: center; margin-top: 5px; font-weight: 800; }

        .batch-card-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 5px;
        }

        .deadline-tag {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.7rem;
          color: #444;
          font-weight: 700;
        }

        .ship-btn {
          background: #10b981;
          color: #fff;
          border: none;
          padding: 12px 20px;
          border-radius: 14px;
          font-weight: 900;
          font-size: 0.75rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: 0.2s;
        }

        .ship-btn:hover { background: #059669; transform: scale(1.05); }

        .pipeline-card {
          background: #0d0d0d;
          border: 1px solid #1a1a1a;
          border-radius: 24px;
          padding: 20px;
          transition: 0.3s;
        }

        .pipeline-card:hover { border-color: #333; }

        .pipeline-main { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px; }

        .status-pill {
          font-size: 0.6rem;
          padding: 4px 10px;
          border-radius: 8px;
          font-weight: 900;
          text-transform: uppercase;
        }

        .progress-track {
          width: 100%;
          height: 6px;
          background: #151515;
          border-radius: 10px;
          overflow: hidden;
          margin-bottom: 12px;
        }

        .progress-fill { height: 100%; background: linear-gradient(90deg, #ff9000 0%, #ff5e00 100%); transition: 1s ease-in-out; }

        .pipeline-stats {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .stat-item { display: flex; align-items: center; gap: 6px; font-size: 0.65rem; color: #444; font-weight: 800; }

        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.85); backdrop-filter: blur(10px); z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 20px; }
        
        .document-modal { width: 100%; max-width: 900px; background: #0f0f0f; border-radius: 40px; border: 1px solid #222; overflow: hidden; display: flex; flex-direction: column; }

        .modal-header { padding: 40px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #1a1a1a; }
        .close-modal { background: #1a1a1a; border: none; color: #888; width: 44px; height: 44px; border-radius: 14px; cursor: pointer; display: flex; align-items: center; justify-content: center; }

        .modal-body { padding: 40px; flex: 1; overflow-y: auto; }

        .doc-meta-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 40px; }
        .meta-box { background: #080808; padding: 20px; border-radius: 20px; border: 1px solid #151515; }
        .meta-box label { font-size: 0.6rem; color: #444; font-weight: 900; display: block; margin-bottom: 6px; }
        .meta-box .val { font-size: 0.85rem; font-weight: 800; color: #fff; }

        .items-table-container { background: #080808; border-radius: 24px; border: 1px solid #151515; overflow: hidden; }
        .doc-table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
        .doc-table th { padding: 20px; text-align: left; background: #111; color: #444; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.05em; }
        .doc-table td { padding: 20px; border-top: 1px solid #151515; color: #ccc; }
        .item-name-cell { font-weight: 700; color: #fff !important; }

        .modal-footer { padding: 40px; background: #080808; border-top: 1px solid #1a1a1a; display: flex; gap: 20px; }
        .primary-btn { flex: 1.5; padding: 20px; background: #10b981; color: #fff; border: none; border-radius: 18px; font-weight: 900; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 12px; font-size: 0.95rem; }
        .secondary-btn { flex: 1; padding: 20px; background: #222; color: #fff; border: none; border-radius: 18px; font-weight: 900; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 12px; font-size: 0.95rem; }

        .nav-back-btn { background: #111; color: #555; width: 44px; height: 44px; border-radius: 14px; border: 1px solid #222; display: flex; align-items: center; justify-content: center; transition: 0.2s; }
        .nav-back-btn:hover { background: #222; color: #fff; }

        .pulse-icon { width: 12px; height: 12px; position: relative; }
        .pulse-dot { position: absolute; width: 100%; height: 100%; background: #10b981; border-radius: 50%; animation: pulse 2s infinite; }
        @keyframes pulse { 0% { transform: scale(0.8); opacity: 1; } 100% { transform: scale(2.5); opacity: 0; } }

        .empty-state { text-align: center; padding: 80px 40px; color: #222; }
        .empty-state p { font-weight: 900; color: #333; margin: 15px 0 5px 0; }
        .empty-state span { font-size: 0.8rem; }

        .icon-btn { background: #1a1a1a; border: none; color: #888; width: 38px; height: 38px; border-radius: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: 0.2s; }
        .icon-btn:hover { background: #ff9000; color: #000; }

        ::-webkit-scrollbar { width: 8px; }
        ::-webkit-scrollbar-track { background: #050505; }
        ::-webkit-scrollbar-thumb { background: #1a1a1a; border-radius: 10px; }
      `}} />
    </div>
  )
}

export default ShippingModule
