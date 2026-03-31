import React, { useState } from 'react'
import {
  LayoutDashboard,
  ArrowLeft,
  Plus,
  Trash2,
  ShoppingCart,
  Calendar,
  Layers,
  Info,
  Settings,
  X
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useMES } from '../MESContext'
import { apiService } from '../services/apiDispatcher'

const ManagerModule = () => {
  const { nomenclatures, addOrder, orders, fetchOrders, hasMoreOrders, customers, searchCustomers } = useMES()
  const [orderHeader, setOrderHeader] = useState({ 
    orderDate: new Date().toISOString().split('T')[0],
    orderNum: '',
    customer: '',
    official_customer: '',
    nomenclature_id: '',
    unit: 'шт',
    quantity: 1,
    entered_by: '',
    responsible_person: '',
    deadline: '',
    actual_date: '',
    source: 'Виробництво',
    report: '',
    accessories: '' 
  })
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [showCustomerHints, setShowCustomerHints] = useState(false)
  const [currentPage, setCurrentPage] = useState(0)

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
    if (!orderHeader.customer || !orderHeader.orderNum || !orderHeader.nomenclature_id) {
      alert('Будь ласка, заповніть Замовника, Номер замовлення та оберіть Продукт')
      return
    }
    
    // In this new spreadsheet layout, each row is an order with one nomenclature item
    const items = [{ nomenclature_id: orderHeader.nomenclature_id, quantity: orderHeader.quantity }]
    
    apiService.submitOrder(orderHeader, items, addOrder)
    
    // Reset but keep some defaults
    setOrderHeader({ 
      ...orderHeader,
      orderNum: '',
      customer: '',
      official_customer: '',
      nomenclature_id: '',
      quantity: 1,
      actual_date: '',
      report: '',
      accessories: ''
    })
  }


  const formatDuration = (totalMinutes) => {
    if (!totalMinutes) return '0 хв'
    const hours = Math.floor(totalMinutes / 60)
    const minutes = Math.round(totalMinutes % 60)
    if (hours === 0) return `${minutes} хв`
    return `${hours} год ${minutes > 0 ? minutes + ' хв' : ''}`
  }

  // (Calculations moved above handleOrderSubmit)


  return (
    <div className="module-page">
      <nav className="module-nav">
        <Link to="/" className="back-link"><ArrowLeft size={20} /> Назад до Порталу</Link>
        <div className="module-title-group">
          <LayoutDashboard className="text-primary" />
          <h1>Модуль Менеджера</h1>
        </div>
      </nav>

      <div className="module-content">
        {/* Professional Order Card */}
        <div className="order-entry-card glass-panel">
          <div className="card-header">
            <h3><Plus size={20} /> Нове замовлення</h3>
            <p className="card-subtitle">Заповніть дані для реєстрації нової позиції</p>
          </div>
          
          <form onSubmit={handleOrderSubmit} className="order-card-form">
            <div className="form-sections-grid">
              {/* Section 1: Client Info */}
              <div className="form-section">
                <h4 className="section-title">💼 Дані клієнта</h4>
                <div className="form-group">
                  <label>Дата замовлення</label>
                  <input type="date" value={orderHeader.orderDate} onChange={e => setOrderHeader({...orderHeader, orderDate: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>№ замовлення</label>
                  <input value={orderHeader.orderNum} onChange={e => setOrderHeader({...orderHeader, orderNum: e.target.value})} placeholder="напр. 260327-5" />
                </div>
                <div className="form-group autocomplete-wrapper">
                  <label>Замовник</label>
                  <input 
                    value={orderHeader.customer} 
                    onChange={e => handleCustomerChange(e.target.value)} 
                    onBlur={() => setTimeout(() => setShowCustomerHints(false), 200)}
                    placeholder="Введіть назву..." 
                  />
                  {showCustomerHints && customers.length > 0 && (
                    <div className="autocomplete-dropdown">
                      {customers.map(c => (
                        <div key={c.id} className="hint-item" onClick={() => selectCustomer(c)}>
                          {c.name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="form-group">
                  <label>Замовник офіц.</label>
                  <input value={orderHeader.official_customer} onChange={e => setOrderHeader({...orderHeader, official_customer: e.target.value})} placeholder="Офіційна назва..." />
                </div>
              </div>

              {/* Section 2: Product info */}
              <div className="form-section">
                <h4 className="section-title">📦 Виріб та кількість</h4>
                <div className="form-group">
                  <label>Продукт / Номенклатура</label>
                  <select value={orderHeader.nomenclature_id} onChange={e => setOrderHeader({...orderHeader, nomenclature_id: e.target.value})}>
                    <option value="">Оберіть виріб...</option>
                    {nomenclatures.filter(n => n.type === 'product').map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
                  </select>
                </div>
                <div className="form-group-row">
                  <div className="form-group">
                    <label>Один. вим.</label>
                    <input value={orderHeader.unit} onChange={e => setOrderHeader({...orderHeader, unit: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Кількість</label>
                    <input type="number" value={orderHeader.quantity} onChange={e => setOrderHeader({...orderHeader, quantity: e.target.value})} />
                  </div>
                </div>
              </div>

              {/* Section 3: Logistics */}
              <div className="form-section">
                <h4 className="section-title">🚀 Логістика та терміни</h4>
                <div className="form-group">
                  <label>Відповідальна особа</label>
                  <input value={orderHeader.responsible_person} onChange={e => setOrderHeader({...orderHeader, responsible_person: e.target.value})} placeholder="ПІБ..." />
                </div>
                <div className="form-group">
                  <label>Планова дата виконання</label>
                  <input type="date" value={orderHeader.deadline} onChange={e => setOrderHeader({...orderHeader, deadline: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>Джерело</label>
                  <select value={orderHeader.source} onChange={e => setOrderHeader({...orderHeader, source: e.target.value})}>
                    <option value="Виробництво">Виробництво</option>
                    <option value="Склад 1">Склад 1</option>
                  </select>
                </div>
                <button type="submit" className="btn-primary btn-submit-order">
                  <Plus size={20} /> Зареєструвати замовлення
                </button>
              </div>
            </div>
          </form>
        </div>

        <div className="registry-section full-width">
          <div className="content-card full-width">
            <div className="card-header reverse">
              <div className="header-info">
                <h3><Layers size={18} /> Реєстр замовлень</h3>
                <p>Останні зареєстровані позиції</p>
              </div>
            </div>
            
            <div className="table-responsive">
              <table className="data-table-modern">
                <thead>
                  <tr>
                    <th>Дата</th>
                    <th>№ Замовлення</th>
                    <th>Клієнт</th>
                    <th>Продукт</th>
                    <th>Кількість</th>
                    <th>Відповідальний</th>
                    <th>Термін</th>
                    <th>Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map(order => (
                    <tr key={order.id} onClick={() => setSelectedOrder(order)} className="clickable-row">
                      <td className="date-col">{order.order_date ? new Date(order.order_date).toLocaleDateString() : '—'}</td>
                      <td className="num-col">#{order.order_num}</td>
                      <td className="client-col">{order.customer}</td>
                      <td className="prod-col">{order.order_items?.[0] ? nomenclatures.find(n => n.id === order.order_items[0].nomenclature_id)?.name : '—'}</td>
                      <td className="qty-col"><strong>{order.order_items?.[0]?.quantity}</strong> {order.unit}</td>
                      <td>{order.responsible_person || '—'}</td>
                      <td>{order.deadline ? new Date(order.deadline).toLocaleDateString() : '—'}</td>
                      <td>
                        <div className={`status-badge ${order.status}`}>
                          {order.status === 'pending' ? 'Очікує' : 
                          order.status === 'in-progress' ? 'В роботі' : 
                          order.status === 'completed' ? 'Виконано' : order.status}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {hasMoreOrders && (
                <div className="pagination-footer">
                  <button 
                    className="btn-outline btn-load-more" 
                    onClick={() => {
                      const next = currentPage + 1
                      setCurrentPage(next)
                      fetchOrders(next, true)
                    }}
                  >
                    Завантажити ще...
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>



      {/* Detail Modal */}
      {selectedOrder && (
        <div className="modal-overlay" onClick={() => setSelectedOrder(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Замовлення {selectedOrder.order_num}</h2>
              <button className="close-btn" onClick={() => setSelectedOrder(null)}><X size={24} /></button>
            </div>
            
            <div className="modal-body">
              <div className="detail-grid">
                <div className="detail-main">
                  <div className="info-group">
                    <label>Замовник</label>
                    <div className="val">{selectedOrder.customer}</div>
                  </div>
                  <div className="info-group">
                    <label>Комплектація / Примітки</label>
                    <div className="val">{selectedOrder.accessories || 'Відсутні'}</div>
                  </div>
                  
                  <h4>Склад замовлення</h4>
                  <table className="detail-items-table">
                    <thead><tr><th>Деталь</th><th>Кількість</th></tr></thead>
                    <tbody>
                      {selectedOrder.order_items?.map((item, idx) => {
                        const nom = nomenclatures.find(n => n.id === item.nomenclature_id)
                        return (
                          <tr key={idx}>
                            <td>{nom?.name || 'Завантаження...'}</td>
                            <td><strong>{item.quantity} шт</strong></td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                
                <div className="detail-side">
                  <div className="stat-card">
                    <label>Статус</label>
                    <div className={`status-badge ${selectedOrder.status}`}>
                      {selectedOrder.status === 'pending' ? 'Очікує' : 
                       selectedOrder.status === 'in-progress' ? 'В роботі' : 
                       selectedOrder.status === 'completed' ? 'Виконано' : selectedOrder.status}
                    </div>
                  </div>
                  <div className="stat-card">
                    <label>Термін</label>
                    <div className="val">{selectedOrder.deadline ? new Date(selectedOrder.deadline).toLocaleDateString() : 'Не вказано'}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .order-entry-card { background: rgba(25, 25, 25, 0.7); backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; padding: 30px; margin-bottom: 40px; box-shadow: 0 20px 50px rgba(0,0,0,0.4); }
        .card-header { margin-bottom: 25px; }
        .card-header h3 { font-size: 1.4rem; color: var(--primary); display: flex; align-items: center; gap: 10px; margin-bottom: 4px; }
        .card-subtitle { color: #666; font-size: 0.9rem; }
        
        .form-sections-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 30px; }
        .section-title { font-size: 0.85rem; text-transform: uppercase; color: #555; letter-spacing: 0.1em; margin-bottom: 20px; padding-bottom: 8px; border-bottom: 1px solid #333; }
        
        .form-group { margin-bottom: 18px; position: relative; }
        .form-group label { display: block; font-size: 0.75rem; color: #888; font-weight: 700; margin-bottom: 6px; }
        .form-group input, .form-group select { width: 100%; border: 1px solid #333; background: #121212; color: #eee; padding: 12px; border-radius: 8px; font-size: 0.95rem; transition: border-color 0.3s; }
        .form-group input:focus { border-color: var(--primary); outline: none; background: #181818; }
        
        .form-group-row { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
        
        .autocomplete-dropdown { position: absolute; top: 100%; left: 0; right: 0; background: #1b1b1b; border: 1px solid #333; border-bottom-left-radius: 12px; border-bottom-right-radius: 12px; z-index: 100; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
        .hint-item { padding: 12px; cursor: pointer; border-bottom: 1px solid #222; font-size: 0.9rem; }
        .hint-item:hover { background: var(--primary); color: #000; }
        
        .calc-preview-card { background: rgba(255,144,0,0.05); border: 1px solid rgba(255,144,0,0.1); padding: 15px; border-radius: 12px; margin-top: 25px; display: flex; justify-content: space-around; }
        .calc-stat { display: flex; flex-direction: column; align-items: center; }
        .calc-stat span { font-size: 0.7rem; color: #888; }
        .calc-stat strong { font-size: 1.1rem; color: var(--primary); }
        
        .btn-submit-order { width: 100%; padding: 16px; font-size: 1rem; border-radius: 12px; margin-top: 15px; display: flex; align-items: center; justify-content: center; gap: 10px; }
        
        .data-table-modern { width: 100%; border-collapse: separate; border-spacing: 0 8px; }
        .data-table-modern th { text-align: left; padding: 15px; color: #555; font-size: 0.75rem; text-transform: uppercase; font-weight: 800; }
        .data-table-modern td { padding: 15px; background: #1b1b1b; border-top: 1px solid #333; border-bottom: 1px solid #333; transition: 0.3s; }
        .data-table-modern td:first-child { border-left: 1px solid #333; border-top-left-radius: 12px; border-bottom-left-radius: 12px; }
        .data-table-modern td:last-child { border-right: 1px solid #333; border-top-right-radius: 12px; border-bottom-right-radius: 12px; }
        .data-table-modern tr:hover td { background: #222; border-color: var(--primary); }
        
        .num-col { font-family: monospace; color: var(--primary); font-weight: 700; font-size: 1rem; }
        .client-col { font-weight: 600; color: #fff; }
        
        .pagination-footer { padding: 30px; display: flex; justify-content: center; }
        .btn-load-more { padding: 12px 30px; border: 1px solid #333; border-radius: 30px; background: transparent; color: #888; cursor: pointer; transition: 0.3s; font-weight: 600; }
        .btn-load-more:hover { color: var(--primary); border-color: var(--primary); background: rgba(255,144,0,0.05); }
        
        /* Modal tweaks */
        .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 1000; backdrop-filter: blur(8px); }
        .modal-content { background: #1b1b1b; width: 95%; max-width: 1000px; border-radius: 24px; box-shadow: 0 30px 60px rgba(0,0,0,0.5); overflow: hidden; border: 1px solid #333; color: white; }
        .modal-header { padding: 30px; border-bottom: 1px solid #333; display: flex; justify-content: space-between; align-items: center; background: #111; }
        .modal-header h2 { margin: 0; font-size: 1.5rem; fontWeight: 800; color: var(--primary); }
        .close-btn { background: none; border: none; cursor: pointer; color: #666; transition: 0.2s; }
        .close-btn:hover { color: #fff; transform: rotate(90deg); }
        .modal-body { padding: 30px; max-height: 85vh; overflow-y: auto; }
      `}} />


    </div>
  )
}

export default ManagerModule
