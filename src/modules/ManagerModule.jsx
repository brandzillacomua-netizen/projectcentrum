import React, { useState } from 'react'
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
  const { nomenclatures, addOrder, orders, fetchOrders, hasMoreOrders, customers, searchCustomers } = useMES()
  const [activeTab, setActiveTab] = useState('new') // 'new' or 'list'
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
  const [currentPage, setCurrentPage] = useState(0)
  const [localSearch, setLocalSearch] = useState('')

  const getStatusLabel = (s) => {
    const map = {
      'pending': 'ОЧІКУЄ',
      'in-progress': 'В РОБОТІ',
      'completed': 'ВИКОНАНО',
      'shipped': 'ВІДВАНТАЖЕНО'
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

  const handleOrderSubmit = (e) => {
    e.preventDefault()
    if (!orderHeader.customer || !orderHeader.orderNum || !orderHeader.nomenclature_id || !orderHeader.deadline) {
      alert('Будь ласка, заповніть Замовника, Номер замовлення, оберіть Продукт та вкажіть Термін (Дедлайн)')
      return
    }
    const items = [{ nomenclature_id: orderHeader.nomenclature_id, quantity: orderHeader.quantity }]
    apiService.submitOrder(orderHeader, items, addOrder)
    alert('Замовлення успішно додано!')
    setOrderHeader({ 
      ...orderHeader,
      orderNum: '',
      customer: '',
      official_customer: '',
      nomenclature_id: '',
      quantity: 1,
      deadline: ''
    })
  }

  const filteredOrders = orders.filter(o => 
    o.order_num.toLowerCase().includes(localSearch.toLowerCase()) || 
    o.customer.toLowerCase().includes(localSearch.toLowerCase())
  )

  return (
    <div className="manager-module-v2" style={{ background: '#0a0a0a', minHeight: '100vh', color: '#fff', display: 'flex', flexDirection: 'column' }}>
      <nav className="module-nav" style={{ flexShrink: 0 }}>
        <Link to="/" className="back-link"><ArrowLeft size={18} /> <span className="hide-mobile">На головну</span></Link>
        <div className="module-title-group">
          <LayoutDashboard className="text-secondary" size={24} />
          <h1 className="hide-mobile">Модуль Менеджера</h1>
          <h1 className="mobile-only" style={{ fontSize: '1rem' }}>МЕНЕДЖЕР</h1>
        </div>
      </nav>

      <div className="module-content" style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
        <div className="manager-sections-switcher" style={{ display: 'flex', background: '#111', padding: '5px', borderRadius: '14px', marginBottom: '25px', maxWidth: '400px' }}>
          <button onClick={() => setActiveTab('new')} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: 'none', background: activeTab === 'new' ? '#222' : 'transparent', color: activeTab === 'new' ? '#ff9000' : '#555', fontWeight: 900, cursor: 'pointer', fontSize: '0.8rem' }}>НОВЕ ЗАМОВЛЕННЯ</button>
          <button onClick={() => setActiveTab('list')} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: 'none', background: activeTab === 'list' ? '#222' : 'transparent', color: activeTab === 'list' ? '#ff9000' : '#555', fontWeight: 900, cursor: 'pointer', fontSize: '0.8rem' }}>РЕЄСТР ({orders.length})</button>
        </div>

        {activeTab === 'new' ? (
          <div className="content-card glass-panel" style={{ padding: '30px', borderRadius: '24px', background: 'rgba(20,20,20,0.6)', border: '1px solid #222' }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 900, marginBottom: '25px', color: '#ff9000' }}>РЕЄСТРАЦІЯ ЗАМОВЛЕННЯ</h2>
            <form onSubmit={handleOrderSubmit} className="order-form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '30px' }}>
              
              <div className="form-section">
                <h4 style={{ fontSize: '0.7rem', color: '#444', textTransform: 'uppercase', marginBottom: '15px' }}>Дані клієнта</h4>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', fontSize: '0.7rem', marginBottom: '5px', color: '#666' }}>№ Замовлення</label>
                  <input style={{ width: '100%', background: '#000', border: '1px solid #222', color: '#fff', padding: '12px', borderRadius: '10px' }} value={orderHeader.orderNum} onChange={e => setOrderHeader({...orderHeader, orderNum: e.target.value})} placeholder="напр. 22-03-01" />
                </div>
                <div style={{ marginBottom: '15px', position: 'relative' }}>
                  <label style={{ display: 'block', fontSize: '0.7rem', marginBottom: '5px', color: '#666' }}>Замовник (Пошук)</label>
                  <input style={{ width: '100%', background: '#000', border: '1px solid #222', color: '#fff', padding: '12px', borderRadius: '10px' }} value={orderHeader.customer} onChange={e => handleCustomerChange(e.target.value)} onBlur={() => setTimeout(() => setShowCustomerHints(false), 200)} placeholder="Почніть вводити..." />
                  {showCustomerHints && customers.length > 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#111', border: '1px solid #222', zIndex: 10, borderRadius: '0 0 10px 10px', overflow: 'hidden' }}>
                      {customers.map(c => <div key={c.id} onClick={() => selectCustomer(c)} style={{ padding: '10px', fontSize: '0.85rem', cursor: 'pointer', borderBottom: '1px solid #1a1a1a' }}>{c.name}</div>)}
                    </div>
                  )}
                </div>
              </div>

              <div className="form-section">
                <h4 style={{ fontSize: '0.7rem', color: '#444', textTransform: 'uppercase', marginBottom: '15px' }}>Виріб та терміни</h4>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', fontSize: '0.7rem', marginBottom: '5px', color: '#666' }}>Виріб</label>
                  <select style={{ width: '100%', background: '#000', border: '1px solid #222', color: '#fff', padding: '12px', borderRadius: '10px' }} value={orderHeader.nomenclature_id} onChange={e => setOrderHeader({...orderHeader, nomenclature_id: e.target.value})}>
                     <option value="">Оберіть виріб...</option>
                     {nomenclatures.filter(n => n.type === 'product').map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', gap: '15px', marginBottom: '15px' }}>
                   <div style={{ flex: 1 }}>
                     <label style={{ display: 'block', fontSize: '0.7rem', marginBottom: '5px', color: '#666' }}>Кількість</label>
                     <input type="number" style={{ width: '100%', background: '#000', border: '1px solid #222', color: '#fff', padding: '12px', borderRadius: '10px' }} value={orderHeader.quantity} onChange={e => setOrderHeader({...orderHeader, quantity: e.target.value})} />
                   </div>
                   <div style={{ flex: 1 }}>
                     <label style={{ display: 'block', fontSize: '0.7rem', marginBottom: '5px', color: '#666' }}>Дедлайн</label>
                     <input type="date" onClick={(e) => e.target.showPicker()} style={{ width: '100%', background: '#000', border: '1px solid #222', color: '#fff', padding: '11px', borderRadius: '10px', cursor: 'pointer' }} value={orderHeader.deadline} onChange={e => setOrderHeader({...orderHeader, deadline: e.target.value})} />
                   </div>
                </div>
              </div>

              <div className="form-section" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                 <button type="submit" style={{ width: '100%', padding: '18px', background: '#ff9000', color: '#000', border: 'none', borderRadius: '14px', fontWeight: 900, cursor: 'pointer', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                    <Plus size={20} /> ЗАРЕЄСТРУВАТИ ЗАМОВЛЕННЯ
                 </button>
              </div>
            </form>
          </div>
        ) : (
          <div className="registry-area">
             <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '0.85rem', color: '#555' }}><Layers size={18} /> РЕЄСТР ЗАМОВЛЕНЬ</h3>
                <div style={{ position: 'relative' }}>
                   <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#333' }} />
                   <input style={{ background: '#000', border: '1px solid #222', padding: '8px 10px 8px 35px', borderRadius: '10px', color: '#fff', width: '200px', fontSize: '0.85rem' }} placeholder="Пошук..." value={localSearch} onChange={e => setLocalSearch(e.target.value)} />
                </div>
             </div>

             <div className="table-responsive-container hide-mobile">
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                   <thead>
                     <tr style={{ textAlign: 'left', borderBottom: '1px solid #222', color: '#444' }}>
                        <th className="sticky-col" style={{ padding: '15px' }}>№ ЗАМОВЛЕННЯ</th>
                        <th style={{ padding: '15px' }}>ЗАМОВНИК</th>
                        <th style={{ padding: '15px' }}>ВИРІБ</th>
                        <th style={{ padding: '15px' }}>КІЛЬКІСТЬ</th>
                        <th style={{ padding: '15px' }}>ТЕРМІН</th>
                        <th style={{ padding: '15px', textAlign: 'right' }}>СТАТУС</th>
                     </tr>
                   </thead>
                   <tbody>
                      {filteredOrders.map(order => (
                        <tr key={order.id} onClick={() => setSelectedOrder(order)} style={{ borderBottom: '1px solid #111', cursor: 'pointer' }}>
                           <td className="sticky-col" style={{ padding: '15px', color: '#ff9000', fontWeight: 800 }}>#{order.order_num}</td>
                           <td style={{ padding: '15px', fontWeight: 600 }}>{order.customer}</td>
                           <td style={{ padding: '15px', color: '#888' }}>{nomenclatures.find(n => n.id === order.order_items?.[0]?.nomenclature_id)?.name || '—'}</td>
                           <td style={{ padding: '15px' }}><strong>{order.order_items?.[0]?.quantity}</strong> {order.unit}</td>
                           <td style={{ padding: '15px', color: '#444' }}>{order.deadline ? new Date(order.deadline).toLocaleDateString() : '—'}</td>
                           <td style={{ padding: '15px', textAlign: 'right' }}>
                              <span className={`status-badge-v2 ${order.status}`} style={{ fontSize: '0.65rem', padding: '5px 10px', borderRadius: '20px', fontWeight: 900, textTransform: 'uppercase' }}>{getStatusLabel(order.status)}</span>
                           </td>
                        </tr>
                      ))}
                   </tbody>
                </table>
             </div>

             <div className="mobile-only cards-grid" style={{ display: 'grid', gap: '15px' }}>
                {filteredOrders.map(order => (
                  <div key={order.id} onClick={() => setSelectedOrder(order)} style={{ background: '#111', padding: '20px', borderRadius: '20px', border: '1px solid #222' }}>
                     <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
                        <strong style={{ color: '#ff9000', fontSize: '1.2rem' }}>#{order.order_num}</strong>
                        <span className={`status-badge-v2 ${order.status}`} style={{ fontSize: '0.6rem', padding: '4px 8px', borderRadius: '6px', fontWeight: 900 }}>{getStatusLabel(order.status)}</span>
                     </div>
                     <div style={{ fontSize: '0.9rem', marginBottom: '5px' }}>{order.customer}</div>
                     <div style={{ fontSize: '0.75rem', color: '#555', marginBottom: '15px' }}>{nomenclatures.find(n => n.id === order.order_items?.[0]?.nomenclature_id)?.name}</div>
                     <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                        <span>Кількість: <strong>{order.order_items?.[0]?.quantity} {order.unit}</strong></span>
                        <span style={{ color: '#ff9000' }}><Calendar size={12} /> {order.deadline ? new Date(order.deadline).toLocaleDateString() : '—'}</span>
                     </div>
                  </div>
                ))}
             </div>

             {hasMoreOrders && (
                <div style={{ textAlign: 'center', padding: '30px' }}>
                   <button onClick={() => { const n = currentPage + 1; setCurrentPage(n); fetchOrders(n, true); }} style={{ background: 'transparent', border: '1px solid #222', color: '#555', padding: '12px 30px', borderRadius: '30px', cursor: 'pointer', fontWeight: 800 }}>ЗАВАНТАЖИТИ ЩЕ</button>
                </div>
             )}
          </div>
        )}
      </div>

      {selectedOrder && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px' }}>
           <div className="glass-panel" style={{ background: '#111', width: '100%', maxWidth: '600px', borderRadius: '24px', border: '1px solid #333', overflow: 'hidden' }}>
              <div style={{ padding: '25px', background: '#0a0a0a', borderBottom: '1px solid #222', display: 'flex', justifyContent: 'space-between' }}>
                 <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 900 }}>ЗАМОВЛЕННЯ #{selectedOrder.order_num}</h2>
                 <button onClick={() => setSelectedOrder(null)} style={{ background: 'transparent', border: 'none', color: '#444', cursor: 'pointer' }}><X size={24} /></button>
              </div>
              <div style={{ padding: '25px' }}>
                 <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '30px' }}>
                    <div className="detail-box">
                       <label style={{ fontSize: '0.6rem', color: '#555', display: 'block' }}>ЗАМОВНИК</label>
                       <div style={{ fontWeight: 700 }}>{selectedOrder.customer}</div>
                    </div>
                    <div className="detail-box">
                       <label style={{ fontSize: '0.6rem', color: '#555', display: 'block' }}>ДЕВЛАЙН (ТЕРМІН)</label>
                       <div style={{ fontWeight: 700, color: '#ff9000' }}>{selectedOrder.deadline || '—'}</div>
                    </div>
                    <div className="detail-box">
                       <label style={{ fontSize: '0.6rem', color: '#555', display: 'block' }}>ПОТОЧНИЙ СТАТУС</label>
                       <div style={{ fontWeight: 900, textTransform: 'uppercase', color: '#3b82f6' }}>{getStatusLabel(selectedOrder.status)}</div>
                    </div>
                    <div className="detail-box">
                       <label style={{ fontSize: '0.6rem', color: '#555', display: 'block' }}>ОФІЦІЙНА НАЗВА</label>
                       <div style={{ fontWeight: 500, fontSize: '0.8rem' }}>{selectedOrder.official_customer || '—'}</div>
                    </div>
                 </div>
                 <h4 style={{ fontSize: '0.8rem', color: '#444' }}>СКЛАД ЗАМОВЛЕННЯ:</h4>
                 {selectedOrder.order_items?.map((item, idx) => (
                    <div key={idx} style={{ background: '#000', padding: '15px', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                       <span>{nomenclatures.find(n => n.id === item.nomenclature_id)?.name}</span>
                       <strong>{item.quantity} шт</strong>
                    </div>
                 ))}
              </div>
           </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .status-badge-v2.pending { background: #333; color: #888; }
        .status-badge-v2.in-progress { background: #22c55e22; color: #22c55e; }
        .status-badge-v2.completed { background: #3b82f622; color: #3b82f6; }
        .status-badge-v2.shipped { background: #ff900022; color: #ff9000; }
        
        input[type="date"]::-webkit-calendar-picker-indicator {
          filter: invert(1);
          cursor: pointer;
        }

        @media (max-width: 768px) { .hide-mobile { display: none !important; } }
        @media (min-width: 769px) { .mobile-only { display: none !important; } }
      `}} />
    </div>
  )
}

export default ManagerModule
