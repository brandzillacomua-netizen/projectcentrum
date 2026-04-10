import React, { useState, useEffect } from 'react'
import {
  LayoutDashboard,
  ArrowLeft,
  Plus,
  Trash2,
  Calendar,
  Layers,
  Info,
  Settings,
  X,
  Search,
  User,
  Package,
  Clock
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useMES } from '../MESContext'
import { apiService } from '../services/apiDispatcher'

const ManagerModule = () => {
  const { nomenclatures, addOrder, orders, fetchOrders, hasMoreOrders, customers, searchCustomers, currentUser, loading } = useMES()
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // Filtering & Pagination State
  const [dateFilter, setDateFilter] = useState('month')
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(0)

  const [orderHeader, setOrderHeader] = useState({ 
    orderDate: new Date().toISOString().split('T')[0],
    orderNum: '',
    customer: '',
    official_customer: '',
    nomenclature_id: '',
    unit: 'шт',
    quantity: 1,
    deadline: '',
    source: 'Виробництво'
  })
  
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [showCustomerHints, setShowCustomerHints] = useState(false)

  // Fetch orders when filters change
  useEffect(() => {
    setCurrentPage(0)
    fetchOrders(0, false, { searchQuery, dateRange: dateFilter })
  }, [dateFilter, searchQuery])

  const getStatusLabel = (s) => {
    const map = {
      'pending': 'ОЧІКУЄ',
      'in-progress': 'В РОБОТІ',
      'completed': 'ВИКОНАНО',
      'shipped': 'ВІДВАНТАЖЕНО',
      'packaged': 'УПАКОВАНО'
    }
    return map[s] || s?.toUpperCase()
  }

  const handleCustomerChange = (val) => {
    setOrderHeader({ ...orderHeader, customer: val })
    if (val.length > 1) {
      searchCustomers(val)
      setShowCustomerHints(true)
    } else {
      setShowCustomerHints(false)
    }
  }

  const selectCustomer = (c) => {
    setOrderHeader({ ...orderHeader, customer: c.name, official_customer: c.official_name || '' })
    setShowCustomerHints(false)
  }

  const handleOrderSubmit = async (e) => {
    e.preventDefault()
    if (!orderHeader.customer || !orderHeader.orderNum || !orderHeader.nomenclature_id || !orderHeader.deadline) {
      alert('Будь ласка, заповніть Замовника, Номер замовлення, оберіть Продукт та вкажіть Термін (Дедлайн)')
      return
    }
    
    setIsSubmitting(true)
    try {
      const items = [{ nomenclature_id: orderHeader.nomenclature_id, quantity: orderHeader.quantity }]
      await apiService.submitOrder(orderHeader, items, addOrder, currentUser?.token)
      
      setOrderHeader({ 
        ...orderHeader,
        orderNum: '',
        customer: '',
        official_customer: '',
        nomenclature_id: '',
        quantity: 1,
        deadline: ''
      })
      alert('Замовлення успішно додано!')
      // Refresh list to show the new order
      fetchOrders(0, false, { searchQuery, dateRange: dateFilter })
    } catch (err) {
      alert('Помилка при додаванні замовлення: ' + err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const loadMore = () => {
    const nextPage = currentPage + 1
    setCurrentPage(nextPage)
    fetchOrders(nextPage, true, { searchQuery, dateRange: dateFilter })
  }

  return (
    <div className="manager-module-modern" style={{ background: '#050505', minHeight: '100vh', color: '#fff', display: 'flex', flexDirection: 'column', fontFamily: '"Outfit", sans-serif' }}>
      
      {/* Header Overlay */}
      <nav className="glass-nav" style={{ 
        position: 'sticky', top: 0, zIndex: 100,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '12px 25px', background: 'rgba(10,10,10,0.8)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255,255,255,0.05)'
      }}>
        <Link to="/" className="back-btn-modern">
          <ArrowLeft size={18} /> <span>НАЗАД</span>
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <LayoutDashboard className="text-orange" size={24} />
          <h1 style={{ fontSize: '1.2rem', fontWeight: 800, letterSpacing: '1px', margin: 0 }}>MANAGER <span className="text-dim">CONSOLE</span></h1>
        </div>
      </nav>

      <div className="content-scrollbox" style={{ padding: '30px',maxWidth: '1400px', margin: '0 auto', width: '100%' }}>
        
        {/* NEW ORDER SECTION */}
        <section className="registration-section" style={{ marginBottom: '60px' }}>
          <div className="glass-card main-registration-card">
            <div className="registration-header-group">
               <div className="icon-badge">
                  <Plus className="text-orange" size={24} />
               </div>
               <h2 className="registration-title">РЕЄСТРАЦІЯ ЗАМОВЛЕННЯ</h2>
            </div>

            <form onSubmit={handleOrderSubmit} className="order-form-grid-modern">
              <div className="form-group-modern">
                <label>№ ЗАМОВЛЕННЯ</label>
                <div className="input-wrapper">
                  <Package size={16} />
                  <input value={orderHeader.orderNum} onChange={e => setOrderHeader({...orderHeader, orderNum: e.target.value})} placeholder="напр. 24-001" />
                </div>
              </div>

              <div className="form-group-modern">
                <label>ЗАМОВНИК (ПОШУК)</label>
                <div className="input-wrapper">
                  <User size={16} />
                  <input value={orderHeader.customer} onChange={e => handleCustomerChange(e.target.value)} onBlur={() => setTimeout(() => setShowCustomerHints(false), 200)} placeholder="Почніть вводити назву..." />
                  {showCustomerHints && customers.length > 0 && (
                    <div className="hints-dropdown">
                      {customers.map(c => <div key={c.id} onClick={() => selectCustomer(c)} className="hint-item">{c.name}</div>)}
                    </div>
                  )}
                </div>
              </div>

              <div className="form-group-modern">
                <label>ВИРІБ</label>
                <div className="input-wrapper">
                  <Layers size={16} />
                  <select value={orderHeader.nomenclature_id} onChange={e => setOrderHeader({...orderHeader, nomenclature_id: e.target.value})}>
                     <option value="">Оберіть виріб...</option>
                     {nomenclatures.filter(n => n.type === 'product').map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="form-group-modern quantity-deadline-group">
                <div className="qty-subgroup">
                  <label>КІЛЬКІСТЬ</label>
                  <div className="input-wrapper">
                    <input type="number" value={orderHeader.quantity} onChange={e => setOrderHeader({...orderHeader, quantity: e.target.value})} />
                  </div>
                </div>
                <div className="deadline-subgroup">
                  <label>ДЕДЛАЙН</label>
                  <div className="input-wrapper">
                    <Calendar size={16} />
                    <input type="date" onClick={(e) => e.target.showPicker()} value={orderHeader.deadline} onChange={e => setOrderHeader({...orderHeader, deadline: e.target.value})} />
                  </div>
                </div>
              </div>

              <div style={{ alignSelf: 'flex-end' }}>
                <button type="submit" disabled={isSubmitting} className="btn-primary-modern">
                  {isSubmitting ? 'ОБРОБКА...' : 'ЗАРЕЄСТРУВАТИ ЗАМОВЛЕННЯ'}
                </button>
              </div>
            </form>
          </div>
        </section>

        {/* REGISTRY SECTION */}
        <section className="registry-section-modern">
          <div className="registry-header-modern">
             <div className="registry-title-group">
                <Layers className="text-orange" size={28} />
                <h3>РЕЄСТР ЗАМОВЛЕНЬ <span className="count-badge">{orders.length}</span></h3>
             </div>

             <div className="filters-container-modern">
                <div className="period-filters">
                   {['today', 'week', 'month', 'quarter', 'all'].map(p => (
                     <button key={p} onClick={() => setDateFilter(p)} className={`filter-chip ${dateFilter === p ? 'active' : ''}`}>
                       {p === 'today' ? 'СЬОГОДНІ' : p === 'week' ? 'ТИЖДЕНЬ' : p === 'month' ? 'МІСЯЦЬ' : p === 'quarter' ? 'КВАРТАЛ' : 'УСІ'}
                     </button>
                   ))}
                </div>
                
                <div className="search-box-modern">
                   <Search size={18} />
                   <input placeholder="Пошук номеру або клієнта..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                </div>
             </div>
          </div>

          <div className="glass-card table-glass" style={{ padding: '0', borderRadius: '24px', background: 'rgba(15,15,15,0.4)', border: '1px solid rgba(255,144,0,0.05)', overflow: 'hidden' }}>
             <div className="table-responsive-container hide-mobile">
                <table className="modern-table">
                   <thead>
                     <tr>
                        <th>№ ЗАМОВЛЕННЯ</th>
                        <th>ЗАМОВНИК</th>
                        <th>ВИРІБ</th>
                        <th>КІЛЬКІСТЬ</th>
                        <th>ТЕРМІН</th>
                        <th style={{ textAlign: 'right' }}>СТАТУС</th>
                     </tr>
                   </thead>
                   <tbody>
                      {orders.map(order => (
                        <tr key={order.id} onClick={() => setSelectedOrder(order)}>
                           <td className="order-num-cell">#{order.order_num}</td>
                           <td className="customer-cell">{order.customer}</td>
                           <td className="product-cell">{nomenclatures.find(n => n.id === order.order_items?.[0]?.nomenclature_id)?.name || '—'}</td>
                           <td className="qty-cell"><strong>{order.order_items?.[0]?.quantity}</strong> {order.unit || 'шт'}</td>
                           <td className="date-cell">{order.deadline ? new Date(order.deadline).toLocaleDateString() : '—'}</td>
                           <td style={{ textAlign: 'right' }}>
                              <span className={`status-pill ${order.status}`}>{getStatusLabel(order.status)}</span>
                           </td>
                        </tr>
                      ))}
                   </tbody>
                </table>
             </div>

             {/* Mobile Registry View (Cards) */}
             <div className="mobile-registry-cards mobile-only">
                {orders.map(order => (
                  <div key={order.id} onClick={() => setSelectedOrder(order)} className="mobile-order-card">
                     <div className="card-top">
                        <span className="card-order-num">#{order.order_num}</span>
                        <span className={`status-pill ${order.status}`}>{getStatusLabel(order.status)}</span>
                     </div>
                     <div className="card-customer">{order.customer}</div>
                     <div className="card-product">{nomenclatures.find(n => n.id === order.order_items?.[0]?.nomenclature_id)?.name || '—'}</div>
                     <div className="card-footer">
                        <span>{order.order_items?.[0]?.quantity} {order.unit || 'шт'}</span>
                        <span className="card-deadline"><Calendar size={12} /> {order.deadline ? new Date(order.deadline).toLocaleDateString() : '—'}</span>
                     </div>
                  </div>
                ))}
             </div>

             {orders.length === 0 && !loading && (
                <div style={{ textAlign: 'center', padding: '60px', color: '#444', fontSize: '1rem' }}>Замовлень не знайдено</div>
             )}
          </div>

          {hasMoreOrders && (
             <div style={{ textAlign: 'center', padding: '40px' }}>
                <button onClick={loadMore} className="btn-load-more">ПОКАЗАТИ БІЛЬШЕ</button>
             </div>
          )}
        </section>
      </div>

      {/* DETAIL MODAL */}
      {selectedOrder && (
        <div className="modal-backdrop-modern">
           <div className="glass-card modal-content-modern anim-slide-up">
              <div className="modal-header-modern">
                 <h2>ДЕТАЛІ <span className="text-orange">#{selectedOrder.order_num}</span></h2>
                 <button onClick={() => setSelectedOrder(null)} className="btn-close-modal"><X size={24} /></button>
              </div>
              <div className="modal-body-modern">
                 <div className="details-grid-modern">
                    <div className="detail-item">
                       <label>ЗАМОВНИК</label>
                       <div>{selectedOrder.customer}</div>
                    </div>
                    <div className="detail-item">
                       <label>ТЕРМІН</label>
                       <div className="text-orange">{selectedOrder.deadline || '—'}</div>
                    </div>
                    <div className="detail-item">
                       <label>СТАТУС</label>
                       <div className={`status-text ${selectedOrder.status}`}>{getStatusLabel(selectedOrder.status)}</div>
                    </div>
                    <div className="detail-item">
                       <label>ОФІЦІЙНА НАЗВА</label>
                       <div style={{ fontSize: '0.9rem', color: '#888' }}>{selectedOrder.official_customer || '—'}</div>
                    </div>
                 </div>
                 
                 <h4 className="section-subtitle-modern">СКЛАД ЗАМОВЛЕННЯ</h4>
                 <div className="order-items-list">
                    {selectedOrder.order_items?.map((item, idx) => (
                       <div key={idx} className="item-row-modern">
                          <Package size={16} className="text-dim" />
                          <span className="item-name">{nomenclatures.find(n => n.id === item.nomenclature_id)?.name}</span>
                          <span className="spacer"></span>
                          <strong className="item-qty">{item.quantity} шт</strong>
                       </div>
                    ))}
                 </div>
              </div>
           </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800;900&display=swap');

        .text-orange { color: #ff9000; }
        .text-dim { color: #555; }
        
        .back-btn-modern {
          display: flex; gap: 8px; align-items: center; color: #888;
          text-decoration: none; font-weight: 800; font-size: 0.8rem;
          padding: 8px 16px; border-radius: 12px; transition: all 0.3s;
          border: 1px solid transparent;
        }
        .back-btn-modern:hover { color: #fff; background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.1); }

        .order-form-grid-modern {
          display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 30px;
        }

        .form-group-modern label {
          display: block; font-size: 0.65rem; color: #555; font-weight: 900;
          letter-spacing: 1px; margin-bottom: 10px;
        }

        .input-wrapper {
          position: relative; display: flex; align-items: center;
          background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1);
          border-radius: 14px; padding: 4px 15px; transition: border-color 0.3s;
        }
        .input-wrapper:focus-within { border-color: #ff9000; }
        .input-wrapper input, .input-wrapper select {
          background: transparent; border: none; color: #fff; padding: 10px;
          flex: 1; outline: none; font-size: 0.9rem;
        }
        .input-wrapper svg { color: #444; }

        .btn-primary-modern {
          background: #ff9000; color: #000; border: none; padding: 16px 32px;
          border-radius: 16px; font-weight: 900; cursor: pointer;
          transition: transform 0.2s, box-shadow 0.2s;
          box-shadow: 0 10px 20px -5px rgba(255,144,0,0.4);
        }
        .btn-primary-modern:hover { transform: translateY(-2px); box-shadow: 0 15px 30px -5px rgba(255,144,0,0.6); }
        .btn-primary-modern:active { transform: translateY(0); }

        .hints-dropdown {
          position: absolute; top: 100%; left: 0; right: 0; background: #111;
          border: 1px solid #222; border-radius: 0 0 14px 14px; z-index: 50; overflow: hidden;
        }
        .hint-item { padding: 12px; font-size: 0.85rem; cursor: pointer; }
        .hint-item:hover { background: #1a1a1a; color: #ff9000; }

        .registry-header-modern {
          display: flex; justify-content: space-between; align-items: center;
          margin-bottom: 25px; flex-wrap: wrap; gap: 20px;
        }
        .registry-title-group { display: flex; align-items: center; gap: 15px; }
        .registry-title-group h3 { font-size: 1.4rem; font-weight: 900; margin: 0; }
        .count-badge { font-size: 0.8rem; color: #555; background: rgba(255,255,255,0.05); padding: 4px 10px; border-radius: 8px; vertical-align: middle; }

        .filters-container-modern { display: flex; gap: 20px; align-items: center; flex-wrap: wrap; width: 100%; }
        .period-filters { display: flex; background: rgba(255,255,255,0.03); padding: 5px; border-radius: 16px; gap: 5px; overflow-x: auto; max-width: 100%; }
        .filter-chip {
          background: transparent; border: none; color: #555; padding: 8px 16px;
          border-radius: 12px; font-size: 0.7rem; font-weight: 800; cursor: pointer; transition: all 0.3s;
          white-space: nowrap;
        }
        .filter-chip.active { background: #ff9000; color: #000; }

        .search-box-modern {
          display: flex; align-items: center; gap: 10px; background: rgba(255,255,255,0.05);
          padding: 8px 20px; border-radius: 18px; border: 1px solid rgba(255,255,255,0.05);
          flex: 1; min-width: 250px;
        }
        .search-box-modern input { background: transparent; border: none; color: #fff; outline: none; width: 100%; font-size: 0.85rem; }

        .modern-table { width: 100%; border-collapse: separate; border-spacing: 0 8px; }
        .modern-table th { padding: 15px 20px; color: #444; font-size: 0.7rem; font-weight: 900; text-align: left; text-transform: uppercase; }
        .modern-table tbody tr { background: rgba(255,255,255,0.02); cursor: pointer; transition: transform 0.2s, background 0.2s; }
        .modern-table tbody tr:hover { background: rgba(255,255,255,0.04); transform: scale(1.005); }
        .modern-table td { padding: 18px 20px; }
        .order-num-cell { font-weight: 900; color: #ff9000; border-radius: 16px 0 0 16px; font-size: 1.1rem; }
        .customer-cell { font-weight: 600; }
        .product-cell { color: #888; font-size: 0.85rem; }
        .qty-cell strong { font-size: 1rem; }
        .date-cell { color: #444; font-size: 0.85rem; }
        .status-pill {
          display: inline-block; padding: 6px 12px; border-radius: 20px; font-size: 0.65rem;
          font-weight: 900; color: #fff; text-transform: uppercase;
        }
        .status-pill.pending { background: rgba(100,100,100,0.1); color: #888; border: 1px solid rgba(100,100,100,0.2); }
        .status-pill.in-progress { background: rgba(34,197,94,0.1); color: #22c55e; border: 1px solid rgba(34,197,94,0.2); }
        .status-pill.completed { background: rgba(59,130,246,0.1); color: #3b82f6; border: 1px solid rgba(59,130,246,0.2); }
        .status-pill.packaged { background: rgba(168,85,247,0.1); color: #a855f7; border: 1px solid rgba(168,85,247,0.2); }
        .status-pill.shipped { background: rgba(255,144,0,0.1); color: #ff9000; border: 1px solid rgba(255,144,0,0.2); }

        .main-registration-card {
           padding: 40px; border-radius: 32px; 
           background: linear-gradient(135deg, rgba(20,20,20,0.4) 0%, rgba(10,10,10,0.6) 100%); 
           border: 1px solid rgba(255,255,255,0.05); 
           box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);
        }
        .registration-header-group { display: flex; alignItems: center; gap: 15px; margin-bottom: 35px; }
        .icon-badge { width: 48px; height: 48px; min-width: 48px; border-radius: 16px; background: rgba(255,144,0,0.1); display: flex; alignItems: center; justifyContent: center; }
        .registration-title { fontSize: 1.8rem; fontWeight: 900; margin: 0; }

        .form-group-modern { width: 100%; }
        .quantity-deadline-group { display: flex; gap: 20px; }
        .qty-subgroup, .deadline-subgroup { flex: 1; min-width: 0; }

        .mobile-order-card {
           background: rgba(255,255,255,0.03); padding: 18px; border-radius: 20px;
           border: 1px solid rgba(255,255,255,0.05); margin-bottom: 15px;
        }
        .card-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
        .card-order-num { color: #ff9000; font-weight: 900; font-size: 1.1rem; }
        .card-customer { font-weight: 600; margin-bottom: 4px; }
        .card-product { font-size: 0.8rem; color: #666; margin-bottom: 12px; }
        .card-footer { display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem; color: #888; border-top: 1px solid rgba(255,255,255,0.03); padding-top: 12px; }
        .card-deadline { display: flex; align-items: center; gap: 5px; color: #ff9000; font-weight: 600; }

        .btn-load-more {
          background: transparent; border: 1px solid rgba(255,255,255,0.1); color: #444;
          padding: 12px 36px; border-radius: 30px; font-weight: 800; cursor: pointer; transition: all 0.3s;
        }
        .btn-load-more:hover { border-color: #ff9000; color: #ff9000; background: rgba(255,144,0,0.05); }

        .modal-backdrop-modern {
          position: fixed; inset: 0; background: rgba(0,0,0,0.9); z-index: 1000;
          display: flex; align-items: center; justifyContent: center; padding: 20px;
          backdrop-filter: blur(8px);
        }
        .modal-content-modern { width: 100%; maxWidth: 650px; }
        .modal-header-modern { display: flex; justify-content: space-between; align-items: center; padding: 30px; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .modal-header-modern h2 { margin: 0; font-size: 1.5rem; font-weight: 900; }
        .btn-close-modal { background: transparent; border: none; color: #555; cursor: pointer; transition: color 0.3s; }
        .btn-close-modal:hover { color: #fff; }
        
        .modal-body-modern { padding: 30px; }
        .details-grid-modern { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 40px; }
        .detail-item label { display: block; font-size: 0.6rem; color: #444; font-weight: 900; letter-spacing: 1px; margin-bottom: 8px; }
        .detail-item div { font-size: 1.1rem; font-weight: 600; }
        
        .section-subtitle-modern { font-size: 0.75rem; color: #333; font-weight: 900; margin-bottom: 15px; border-bottom: 1px solid rgba(255,255,255,0.03); padding-bottom: 10px; }
        .item-row-modern { display: flex; align-items: center; gap: 15px; padding: 15px; background: rgba(0,0,0,0.2); border-radius: 14px; margin-bottom: 10px; }
        .item-name { flex: 1; font-weight: 500; }
        .item-qty { color: #ff9000; font-size: 1.1rem; }

        .anim-slide-up { animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
        @keyframes slideUp { from { transform: translateY(30px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

        @media (max-width: 768px) {
          .hide-mobile { display: none !important; }
          .main-registration-card { padding: 20px; border-radius: 20px; }
          .registration-header-group { gap: 12px; margin-bottom: 25px; }
          .registration-title { font-size: 1.3rem; }
          .icon-badge { width: 36px; height: 36px; min-width: 36px; border-radius: 10px; }
          .icon-badge svg { width: 18px; height: 18px; }

          .order-form-grid-modern { grid-template-columns: 1fr; gap: 12px; }
          .quantity-deadline-group { flex-direction: column; gap: 12px; }
          
          .registry-header-modern { flex-direction: column; align-items: flex-start; }
          .filters-container-modern { flex-direction: column; align-items: stretch; }
          .search-box-modern { min-width: 100%; order: -1; }
          .period-filters { width: 100%; }
        }
        @media (min-width: 769px) { .mobile-only { display: none !important; } }
      `}} />
    </div>
  )
}

export default ManagerModule

