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
    if (!orderHeader.customer || !orderHeader.orderNum || !orderHeader.nomenclature_id) {
      alert('Будь ласка, заповніть Замовника, Номер замовлення та оберіть Продукт')
      return
    }
    
    // In this new spreadsheet layout, each row is an order with one nomenclature item
    const items = [{ nomenclature_id: orderHeader.nomenclature_id, quantity: orderHeader.quantity }]
    
    addOrder(orderHeader, items)
    
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
        {/* Spreadsheet-style Order Entry */}
        <div className="spreadsheet-container">
          <form onSubmit={handleOrderSubmit} className="spreadsheet-form">
            <div className="spreadsheet-header">
              <div className="col date">Дата замовлення <span>⇵</span></div>
              <div className="col num">№ замовлення <span>⇵</span></div>
              <div className="col cust">Замовник <span>⇵</span></div>
              <div className="col cust-off">Замовник офіц. <span>⇵</span></div>
              <div className="col link">🔗</div>
              <div className="col prod">Продукт або Номенклатура скорочена <span>⇵</span></div>
              <div className="col unit">Один. вим. <span>⇵</span></div>
              <div className="col qty">Кількість <span>⇵</span></div>
              <div className="col p-enter">ПІБ особи, що вносить та опрацьовує замовлення <span>⇵</span></div>
              <div className="col p-resp">ПІБ відповідальної особи <span>⇵</span></div>
              <div className="col p-date">Планова дата виконання <span>⇵</span></div>
              <div className="col a-date">Фактична дата виконання <span>⇵</span></div>
              <div className="col source">Джерело: Виробництво / Склад 1 <span>⇵</span></div>
              <div className="col report">Звіт <span>⇵</span></div>
              <div className="col actions"></div>
            </div>

            <div className="spreadsheet-input-row">
              <div className="col date"><input type="date" value={orderHeader.orderDate} onChange={e => setOrderHeader({...orderHeader, orderDate: e.target.value})} /></div>
              <div className="col num"><input value={orderHeader.orderNum} onChange={e => setOrderHeader({...orderHeader, orderNum: e.target.value})} placeholder="260327-5" /></div>
              <div className="col cust"><input value={orderHeader.customer} onChange={e => setOrderHeader({...orderHeader, customer: e.target.value})} placeholder="напр. ТОВ Елкерт" /></div>
              <div className="col cust-off"><input value={orderHeader.official_customer} onChange={e => setOrderHeader({...orderHeader, official_customer: e.target.value})} /></div>
              <div className="col link"><div className="placeholder-link"></div></div>
              <div className="col prod">
                <select value={orderHeader.nomenclature_id} onChange={e => setOrderHeader({...orderHeader, nomenclature_id: e.target.value})}>
                  <option value="">Оберіть виріб...</option>
                  {nomenclatures.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
                </select>
              </div>
              <div className="col unit"><input value={orderHeader.unit} onChange={e => setOrderHeader({...orderHeader, unit: e.target.value})} placeholder="компл." /></div>
              <div className="col qty"><input type="number" value={orderHeader.quantity} onChange={e => setOrderHeader({...orderHeader, quantity: e.target.value})} /> Comp.</div>
              <div className="col p-enter"><input value={orderHeader.entered_by} onChange={e => setOrderHeader({...orderHeader, entered_by: e.target.value})} placeholder="Прізвище І." /></div>
              <div className="col p-resp"><input value={orderHeader.responsible_person} onChange={e => setOrderHeader({...orderHeader, responsible_person: e.target.value})} /></div>
              <div className="col p-date"><input type="date" value={orderHeader.deadline} onChange={e => setOrderHeader({...orderHeader, deadline: e.target.value})} /></div>
              <div className="col a-date"><input type="date" value={orderHeader.actual_date} onChange={e => setOrderHeader({...orderHeader, actual_date: e.target.value})} /></div>
              <div className="col source">
                <select value={orderHeader.source} onChange={e => setOrderHeader({...orderHeader, source: e.target.value})}>
                  <option value="Виробництво">Виробництво</option>
                  <option value="Склад 1">Склад 1</option>
                </select>
              </div>
              <div className="col report"><input value={orderHeader.report} onChange={e => setOrderHeader({...orderHeader, report: e.target.value})} /></div>
              <div className="col actions">
                <button type="submit" className="btn-add-spread"><Plus size={16} /> Додати</button>
              </div>
            </div>
          </form>
        </div>

        <div className="dashboard-grid full-width">
          {/* Order Registry */}
          <div className="content-card full-width">
            <div className="card-header">
              <h3><Layers size={18} /> Реєстр замовлень (Spreadsheet View)</h3>
            </div>
            <div className="table-responsive spreadsheet-view">
              <table className="data-table-spreadsheet">
                <thead>
                  <tr>
                    <th>Дата замовлення</th>
                    <th>№</th>
                    <th>Замовник</th>
                    <th>Продукт</th>
                    <th>К-сть</th>
                    <th>Відповідальний</th>
                    <th>Планова дата</th>
                    <th>Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map(order => (
                    <tr key={order.id} onClick={() => setSelectedOrder(order)} style={{ cursor: 'pointer' }}>
                      <td>{order.order_date ? new Date(order.order_date).toLocaleDateString() : '—'}</td>
                      <td style={{ fontWeight: 700 }}>{order.order_num}</td>
                      <td>{order.customer}</td>
                      <td>{order.order_items?.[0] ? nomenclatures.find(n => n.id === order.order_items[0].nomenclature_id)?.name : '—'}</td>
                      <td>{order.order_items?.[0]?.quantity} {order.unit}</td>
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
                  {orders.length === 0 && (
                    <tr><td colSpan="8" style={{ textAlign: 'center', padding: '100px', color: '#b2bec3' }}>Реєстр порожній</td></tr>
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
        .spreadsheet-container { background: #1b1b1b; border: 1px solid #333; border-radius: 12px; overflow-x: auto; margin-bottom: 30px; box-shadow: 0 10px 30px rgba(0,0,0,0.3); }
        .spreadsheet-form { min-width: 1400px; }
        .spreadsheet-header { background: #2d5a45; color: white; display: flex; align-items: center; padding: 10px 0; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 2px solid #1a3528; }
        .spreadsheet-input-row { display: flex; align-items: center; background: #222; padding: 10px 0; border-bottom: 1px solid #333; }
        
        .col { padding: 0 8px; border-right: 1px solid rgba(255,255,255,0.1); flex-shrink: 0; }
        .col:last-child { border-right: none; }
        .col span { font-size: 0.6rem; opacity: 0.5; margin-left: 2px; }
        
        .col.date { width: 120px; }
        .col.num { width: 100px; }
        .col.cust { width: 150px; }
        .col.cust-off { width: 150px; }
        .col.link { width: 40px; display: flex; justify-content: center; }
        .col.prod { width: 250px; }
        .col.unit { width: 80px; }
        .col.qty { width: 80px; display: flex; align-items: center; gap: 4px; font-size: 0.75rem; color: #888; }
        .col.p-enter { width: 180px; }
        .col.p-resp { width: 150px; }
        .col.p-date { width: 120px; }
        .col.a-date { width: 120px; }
        .col.source { width: 130px; }
        .col.report { width: 100px; }
        .col.actions { width: 120px; flex-grow: 1; border-right: none; }
        
        .spreadsheet-input-row input, .spreadsheet-input-row select { width: 100%; background: transparent; border: none; color: white; font-size: 0.85rem; padding: 4px; }
        .spreadsheet-input-row input:focus, .spreadsheet-input-row select:focus { outline: 1px solid var(--primary); background: rgba(255,144,0,0.05); }
        .placeholder-link { width: 20px; height: 2px; background: #444; }
        
        .btn-add-spread { background: var(--primary); color: black; border: none; padding: 6px 12px; border-radius: 4px; font-weight: 700; font-size: 0.75rem; cursor: pointer; transition: 0.2s; display: flex; align-items: center; gap: 4px; width: 100%; justify-content: center; }
        .btn-add-spread:hover { background: #ffa500; transform: translateY(-1px); }
        
        .dashboard-grid.full-width { grid-template-columns: 1fr; }
        .content-card.full-width { max-width: 100%; }
        
        .data-table-spreadsheet { width: 100%; border-collapse: collapse; margin-top: 10px; }
        .data-table-spreadsheet th { text-align: left; padding: 12px 15px; color: #666; font-size: 0.7rem; text-transform: uppercase; border-bottom: 2px solid #333; background: #111; }
        .data-table-spreadsheet td { padding: 12px 15px; border-bottom: 1px solid #222; font-size: 0.9rem; transition: 0.2s; }
        .data-table-spreadsheet tr:hover td { background: rgba(255,144,0,0.03); color: white; }
        
        /* Modal extensions */
        .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 1000; backdrop-filter: blur(8px); }
        .modal-content { background: #1b1b1b; width: 95%; max-width: 1000px; border-radius: 24px; box-shadow: 0 30px 60px rgba(0,0,0,0.5); overflow: hidden; border: 1px solid #333; color: white; }
        .modal-header { padding: 30px; border-bottom: 1px solid #333; display: flex; justify-content: space-between; align-items: center; background: #111; }
        .modal-header h2 { margin: 0; font-size: 1.5rem; fontWeight: 800; color: var(--primary); }
        .close-btn { background: none; border: none; cursor: pointer; color: #666; transition: 0.2s; }
        .close-btn:hover { color: #fff; transform: rotate(90deg); }
        
        .modal-body { padding: 30px; max-height: 85vh; overflow-y: auto; }
        /* Reuse other modal styles from previous version */
      `}} />

    </div>
  )
}

export default ManagerModule
