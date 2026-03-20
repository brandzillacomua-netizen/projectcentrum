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

const ManagerModule = () => {
  const { nomenclatures, addOrder, orders } = useMES()
  const [orderHeader, setOrderHeader] = useState({ customer: '', orderNum: '', deadline: '', accessories: '' })
  const [selectedItems, setSelectedItems] = useState([])
  const [currentItem, setCurrentItem] = useState({ nomenclature_id: '', quantity: 1 })
  const [selectedOrder, setSelectedOrder] = useState(null)

  const addItem = () => {
    if (!currentItem.nomenclature_id || !currentItem.quantity) return
    const nom = nomenclatures.find(n => n.id === currentItem.nomenclature_id)
    setSelectedItems([...selectedItems, { ...currentItem, name: nom.name }])
    setCurrentItem({ nomenclature_id: '', quantity: '' })
  }

  const removeItem = (index) => {
    setSelectedItems(selectedItems.filter((_, i) => i !== index))
  }

  const handleOrderSubmit = (e) => {
    e.preventDefault()
    if (!orderHeader.customer || !orderHeader.orderNum) {
      alert('Будь ласка, заповніть Назву замовника та Номер замовлення')
      return
    }
    if (selectedItems.length === 0) {
      alert('Додайте хоча б одну деталь у замовлення')
      return
    }
    addOrder(orderHeader, selectedItems)
    setOrderHeader({ customer: '', orderNum: '', deadline: '', accessories: '' })
    setSelectedItems([])
  }

  const formatDuration = (totalMinutes) => {
    if (!totalMinutes) return '0 хв'
    const hours = Math.floor(totalMinutes / 60)
    const minutes = Math.round(totalMinutes % 60)
    if (hours === 0) return `${minutes} хв`
    return `${hours} год ${minutes > 0 ? minutes + ' хв' : ''}`
  }

  // Live calculations
  const totalSheets = selectedItems.reduce((acc, item) => {
    const nom = nomenclatures.find(n => n.id === item.nomenclature_id)
    return acc + (nom ? Math.ceil(item.quantity / nom.units_per_sheet) : 0)
  }, 0)

  const totalMinutes = selectedItems.reduce((acc, item) => {
    const nom = nomenclatures.find(n => n.id === item.nomenclature_id)
    return acc + (nom ? item.quantity * nom.time_per_unit : 0)
  }, 0)

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
        <div className="dashboard-grid">
          {/* Order Entry */}
          <div className="content-card">
            <div className="card-header">
              <h3><Plus size={18} /> Створення замовлення</h3>
            </div>
            <form onSubmit={handleOrderSubmit} className="order-form">
              <div className="form-grid">
                <div className="form-group">
                  <label>Замовник</label>
                  <input value={orderHeader.customer} onChange={e => setOrderHeader({...orderHeader, customer: e.target.value})} placeholder="напр. ТОВ Метал" />
                </div>
                <div className="form-group">
                  <label>Номер замовлення</label>
                  <input value={orderHeader.orderNum} onChange={e => setOrderHeader({...orderHeader, orderNum: e.target.value})} placeholder="№ 000" />
                </div>
              </div>

              {/* Multi-item entry */}
              <div className="item-entry-section">
                <h4>Склад замовлення</h4>
                <div className="item-input-row" style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                  <select 
                    style={{ flex: 2 }} 
                    value={currentItem.nomenclature_id} 
                    onChange={e => setCurrentItem({...currentItem, nomenclature_id: e.target.value})}
                  >
                    <option value="">Оберіть деталь...</option>
                    {nomenclatures.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
                  </select>
                  <input 
                    style={{ flex: 1 }} 
                    type="number" 
                    placeholder="К-сть" 
                    value={currentItem.quantity} 
                    onChange={e => setCurrentItem({...currentItem, quantity: e.target.value})} 
                  />
                  <button type="button" className="btn-icon" onClick={addItem}><Plus size={18} /></button>
                </div>
                
                <ul className="selected-items-list">
                  {selectedItems.map((item, idx) => (
                    <li key={idx}>
                      <span>{item.name} — {item.quantity} шт</span>
                      <button type="button" onClick={() => removeItem(idx)}><Trash2 size={14} /></button>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="form-grid" style={{ marginTop: '20px' }}>
                <div className="form-group">
                  <label>Термін поставки</label>
                  <input type="date" value={orderHeader.deadline} onChange={e => setOrderHeader({...orderHeader, deadline: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>Комплектація</label>
                  <input value={orderHeader.accessories} onChange={e => setOrderHeader({...orderHeader, accessories: e.target.value})} placeholder="Болти, упаковка..." />
                </div>
              </div>

              <div className="calc-summary mini">
                <div className="sum-item"><span>Сировина:</span> <strong>{totalSheets} листів</strong></div>
                <div className="sum-item"><span>Час (орієнтовно):</span> <strong>{formatDuration(totalMinutes)}</strong></div>
              </div>

              <button type="submit" className="btn-primary full-width">Оформити замовлення</button>
            </form>
          </div>

          {/* Existing Orders */}
          <div className="content-card" style={{ flex: 1.5 }}>
            <div className="card-header">
              <h3><Layers size={18} /> Реєстр замовлень</h3>
            </div>
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>№ Замовлення</th>
                    <th>Замовник</th>
                    <th>Позицій</th>
                    <th>Термін</th>
                    <th>Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map(order => (
                    <tr key={order.id} onClick={() => setSelectedOrder(order)} style={{ cursor: 'pointer' }}>
                      <td style={{ fontWeight: 700 }}>{order.order_num}</td>
                      <td>{order.customer}</td>
                      <td><span className="qty-tag">{order.order_items?.length || 0}</span></td>
                      <td style={{ fontSize: '0.85rem', color: '#636e72' }}>
                        {order.deadline ? new Date(order.deadline).toLocaleDateString() : '—'}
                      </td>
                      <td>
                        <div className={`status-badge ${order.status}`}>
                          {order.status === 'pending' ? 'Очікує' : 
                           order.status === 'in-progress' ? 'В роботі' : 
                           order.status === 'completed' ? 'Виконано' : order.status}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {orders.length === 0 && (
                    <tr><td colSpan="5" style={{ textAlign: 'center', padding: '100px', color: '#b2bec3' }}>Реєстр порожній</td></tr>
                  )}
                </tbody>
              </table>
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
                  <div className="stat-card accent">
                    <label>Розрахунок виробництва</label>
                    {(() => {
                      let totalSheets = 0
                      let totalMin = 0
                      selectedOrder.order_items?.forEach(item => {
                        const nom = nomenclatures.find(n => n.id === item.nomenclature_id)
                        if (nom) {
                          totalSheets += Math.ceil(item.quantity / (nom.units_per_sheet || 1))
                          totalMin += item.quantity * nom.time_per_unit
                        }
                      })
                      return (
                        <div className="calc-vals">
                          <div>Листів: <strong>{totalSheets}</strong></div>
                          <div>Час: <strong>{formatDuration(totalMin)}</strong></div>
                        </div>
                      )
                    })()}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 1000; backdrop-filter: blur(4px); }
        .modal-content { background: white; width: 90%; max-width: 800px; border-radius: 24px; box-shadow: 0 30px 60px rgba(0,0,0,0.15); overflow: hidden; }
        .modal-header { padding: 30px; border-bottom: 1px solid #f1f2f6; display: flex; justify-content: space-between; align-items: center; }
        .modal-header h2 { margin: 0; font-size: 1.5rem; fontWeight: 800; }
        .close-btn { background: none; border: none; cursor: pointer; color: #b2bec3; transition: 0.2s; }
        .close-btn:hover { color: #2d3436; transform: rotate(90deg); }
        
        .modal-body { padding: 30px; max-height: 80vh; overflow-y: auto; }
        .detail-grid { display: grid; grid-template-columns: 1.5fr 1fr; gap: 30px; }
        
        .info-group { margin-bottom: 25px; }
        .info-group label { display: block; font-size: 0.75rem; text-transform: uppercase; color: #b2bec3; font-weight: 800; margin-bottom: 8px; }
        .info-group .val { font-size: 1.1rem; font-weight: 600; }
        
        .detail-items-table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        .detail-items-table th { text-align: left; padding: 12px; background: #f8f9fa; color: #b2bec3; font-size: 0.7rem; text-transform: uppercase; }
        .detail-items-table td { padding: 15px 12px; border-bottom: 1px solid #f1f2f6; }
        
        .stat-card { background: #f8f9fa; padding: 20px; border-radius: 16px; margin-bottom: 15px; }
        .stat-card label { display: block; font-size: 0.7rem; color: #b2bec3; font-weight: 800; margin-bottom: 10px; text-transform: uppercase; }
        .stat-card.accent { background: #e3f2fd; border: 1px solid #bbdefb; }
        .stat-card.accent label { color: #1976d2; }
        
        .calc-vals { display: flex; flex-direction: column; gap: 10px; font-size: 1.1rem; }
        
        .data-table tr:hover td { background: #f8f9fa; }
        .item-entry-section { background: #fbfbfb; padding: 20px; border-radius: 16px; border: 1px solid #f1f2f6; margin: 20px 0; }
        .item-entry-section h4 { font-size: 0.8rem; text-transform: uppercase; color: #b2bec3; letter-spacing: 0.05em; margin-bottom: 15px; }
        .selected-items-list { list-style: none; padding: 0; }
        .selected-items-list li { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #f1f2f6; font-size: 0.95rem; font-weight: 500; }
        .selected-items-list li button { background: none; border: none; color: var(--danger); cursor: pointer; opacity: 0.6; transition: 0.2s; }
        .selected-items-list li button:hover { opacity: 1; }
        
        .calc-summary.mini { background: #f0f7ff; border: 1px solid #e0efff; padding: 20px; border-radius: 12px; margin: 20px 0; }
        .sum-item { display: flex; justify-content: space-between; margin-bottom: 5px; }
        
        .data-table { width: 100%; border-collapse: separate; border-spacing: 0 10px; }
        .data-table th { text-align: left; padding: 15px; color: #b2bec3; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.1em; font-weight: 800; }
        .data-table td { padding: 15px; background: white; border-top: 1px solid #f1f2f6; border-bottom: 1px solid #f1f2f6; }
        .data-table td:first-child { border-left: 1px solid #f1f2f6; border-top-left-radius: 12px; border-bottom-left-radius: 12px; }
        .data-table td:last-child { border-right: 1px solid #f1f2f6; border-top-right-radius: 12px; border-bottom-right-radius: 12px; }
        
        .qty-tag { background: #f1f2f6; padding: 4px 10px; border-radius: 6px; font-weight: 700; font-size: 0.85rem; }
        .status-badge { display: inline-block; padding: 6px 12px; border-radius: 8px; font-size: 0.8rem; font-weight: 700; text-transform: uppercase; }
        .status-badge.pending { background: #fff8e1; color: #ffa000; }
        .status-badge.in-progress { background: #e3f2fd; color: #1976d2; }
        .status-badge.completed { background: #e8f5e9; color: #388e3c; }
      `}} />
    </div>
  )
}

export default ManagerModule
