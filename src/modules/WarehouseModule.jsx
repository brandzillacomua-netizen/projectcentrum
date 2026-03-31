import React, { useState } from 'react'
import { 
  Warehouse as WarehouseIcon, 
  ArrowLeft, 
  Package, 
  ClipboardList,
  CheckCircle2,
  Bell,
  Plus,
  Truck,
  Layers,
  Archive,
  AlertTriangle
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useMES } from '../MESContext'
import { apiService } from '../services/apiDispatcher'

const WarehouseModule = () => {
  const { 
    inventory, addInventory, requests, issueMaterials, 
    nomenclatures, receptionDocs, confirmReceptionDoc,
    orders, tasks, approveWarehouse, createPurchaseRequest
  } = useMES()
  const [activeTab, setActiveTab] = useState('raw')
  const [showAdd, setShowAdd] = useState(false)
  const [showReception, setShowReception] = useState(false)
  const [shortages, setShortages] = useState(null) // { orderId, orderNum, items }
  const [newItem, setNewItem] = useState({ name: '', unit: 'шт', total_qty: '', type: 'raw' })

  const tabs = [
    { id: 'raw', label: 'Сировина', icon: <Package size={18} /> },
    { id: 'semi', label: 'Напівфабрикати', icon: <Layers size={18} /> },
    { id: 'finished', label: 'Готова продукція', icon: <Archive size={18} /> },
    { id: 'scrap', label: 'Брак', icon: <AlertTriangle size={18} /> }
  ]

  const filteredInventory = inventory.filter(i => i.type === activeTab)
  const pendingDocs = receptionDocs ? receptionDocs.filter(d => d.status === 'pending') : []

  const pendingRequests = requests.filter(r => r.status === 'pending')
  const groupedRequests = pendingRequests.reduce((acc, req) => {
    if (!acc[req.order_id]) acc[req.order_id] = []
    acc[req.order_id].push(req)
    return acc
  }, {})

  const handleReserveOrder = (orderId, orderNum, reqList) => {
    const missingItems = []
    
    reqList.forEach(req => {
      let parsedName = ''
      try {
        parsedName = req.details?.split(': ')[1]?.split(' — ')[0]?.trim()
      } catch(e) {}

      // Prioritize direct inventory_id or name-based lookup
      const invItem = inventory.find(i => 
        i.id === req.inventory_id || 
        (parsedName && i.name === parsedName && i.type === 'raw')
      )
      const available = invItem ? (Number(invItem.total_qty) || 0)  - (Number(invItem.reserved_qty) || 0) : 0
      const needed = Number(req.quantity)
      
      if (available < needed) {
        const missingAmount = needed - available
        const reqDescription = req.details?.split(': ')[1] || req.details || 'Невідома деталь'
        
        let nomenclature_id = invItem?.nomenclature_id || null
        if (!nomenclature_id && parsedName) {
          const nom = nomenclatures.find(n => n.name === parsedName)
          if (nom) nomenclature_id = nom.id
        }

        missingItems.push({ 
          reqDetails: reqDescription, 
          missingAmount, 
          inventory_id: invItem?.id || req.inventory_id, 
          nomenclature_id,
          needed 
        })
      }
    })

    if (missingItems.length > 0) {
      setShortages({ orderId, orderNum, items: missingItems })
    } else {
      const relatedTask = tasks.find(t => t.order_id === orderId)
      apiService.submitReserveBatch(orderId, reqList, relatedTask?.id, issueMaterials, approveWarehouse)
    }
  }

  const sendPurchaseRequest = async () => {
    if (!shortages) return
    try {
      await apiService.submitPurchaseRequest(shortages.orderId, shortages.orderNum, shortages.items, createPurchaseRequest)
      alert('Запит Менеджеру зі закупівель відправлено успішно!')
      setShortages(null)
    } catch(err) {
      alert('Помилка відправки: ' + err.message)
    }
  }

  return (
    <div className="module-page">
      <nav className="module-nav">
        <Link to="/" className="back-link"><ArrowLeft size={20} /> Назад до Порталу</Link>
        <div className="module-title-group">
          <WarehouseIcon className="text-secondary" />
          <h1>Модуль Складу</h1>
        </div>
      </nav>

      <div className="module-content">
        {/* Incoming Requests Section (Only seen in Raw materials) */}
        {activeTab === 'raw' && pendingRequests.length > 0 && (
          <div className="content-card alert-card">
            <div className="card-header">
              <h3><Bell size={18} className="text-accent" /> Заявки на комплектацію нарядів</h3>
            </div>
            <div className="request-list horiz" style={{ display: 'flex', gap: '20px', overflowX: 'auto', padding: '15px 5px' }}>
              {Object.entries(groupedRequests).map(([orderId, reqList]) => {
                const orderNum = orders.find(o => o.id === orderId)?.order_num || orderId.substring(0,6)
                return (
                  <div key={orderId} className="req-card-mini" style={{ minWidth: '400px', padding: '25px', background: 'white', borderRadius: '20px', border: '1px solid #ffe8cc', boxShadow: '0 8px 16px rgba(255, 152, 0, 0.08)' }}>
                    <div className="req-info">
                      <strong style={{ display: 'block', fontSize: '0.8rem', color: 'var(--accent)', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.05em' }}>
                        НАРЯД #{orderNum}
                      </strong>
                      <h4 style={{ margin: '0 0 15px 0', fontSize: '1.2rem', color: '#fff' }}>Потреба сировини</h4>
                      <ul style={{ margin: '0 0 25px 0', paddingLeft: '18px', fontSize: '0.9rem', color: '#ccc', lineHeight: '1.6' }}>
                        {reqList.map(req => {
                          // Extract the specific material description from details (strips 'Сировина для 0228: ')
                          const reqDescription = req.details?.split(': ')[1] || req.details || 'Невідома деталь'
                          return (
                            <li key={req.id}>
                              <span style={{ color: '#fff' }}>{reqDescription}</span>
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                    <button className="btn-primary" style={{ width: '100%', padding: '15px', borderRadius: '12px', fontWeight: 900, textTransform: 'uppercase' }} onClick={() => handleReserveOrder(orderId, orderNum, reqList)}>
                      Забронювати весь наряд
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Shortages Modal */}
        {shortages && (
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, backdropFilter: 'blur(5px)' }}>
            <div style={{ background: '#121212', border: '1px solid #333', borderRadius: '24px', padding: '40px', width: '500px', boxShadow: '0 25px 50px rgba(0,0,0,0.5)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px', color: '#ef4444', marginBottom: '20px' }}>
                <AlertTriangle size={32} />
                <h3 style={{ margin: 0, fontSize: '1.5rem', color: '#fff' }}>Недостатньо сировини!</h3>
              </div>
              <p style={{ color: '#aaa', marginBottom: '25px', lineHeight: '1.6' }}>Нарядом <strong>#{shortages.orderNum}</strong> замовлено позиції, яких зараз не вистачає на складі:</p>
              
              <div style={{ background: '#1a1a1a', borderRadius: '16px', padding: '20px', marginBottom: '30px' }}>
                {shortages.items.map((it, idx) => (
                  <div key={idx} style={{ padding: '10px 0', borderBottom: idx < shortages.items.length - 1 ? '1px dashed #333' : 'none', display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#ddd' }}>{it.reqDetails}</span>
                    <strong style={{ color: '#ef4444' }}>Бракує: {it.missingAmount} од.</strong>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '15px' }}>
                <button style={{ flex: 1, padding: '16px', borderRadius: '14px', background: '#222', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 'bold' }} onClick={() => setShortages(null)}>
                  СКАСУВАТИ
                </button>
                <button style={{ flex: 2, padding: '16px', borderRadius: '14px', background: '#ef4444', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 900, textTransform: 'uppercase' }} onClick={sendPurchaseRequest}>
                  Подати запит на поставку
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="warehouse-tabs" style={{ display: 'flex', gap: '15px', marginBottom: '30px', overflowX: 'auto', padding: '5px' }}>
          {tabs.map(tab => (
            <button key={tab.id} className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`} onClick={() => { setActiveTab(tab.id); setNewItem({...newItem, type: tab.id}); }}>
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        <div className="content-card" style={{ padding: '40px', borderRadius: '24px', border: '1px solid rgba(0,0,0,0.05)' }}>
          <div className="card-header" style={{ marginBottom: '30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '1.8rem', fontWeight: 800 }}>{tabs.find(t => t.id === activeTab).label}</h2>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn-icon" onClick={() => setShowReception(!showReception)} style={{ position: 'relative', background: '#e0f2fe', color: '#0369a1', padding: '12px 18px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, border: 'none', cursor: 'pointer', transition: '0.2s' }}>
                <Truck size={20} /> <span style={{ fontSize: '0.9rem' }}>Прийомка</span>
                {pendingDocs.length > 0 && (
                  <span style={{ position: 'absolute', top: '-8px', right: '-8px', background: '#ef4444', color: 'white', fontSize: '0.7rem', fontWeight: 900, borderRadius: '50%', minWidth: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '3px solid #1a1a1a', boxShadow: '0 4px 8px rgba(239, 68, 68, 0.4)' }}>
                    {pendingDocs.length}
                  </span>
                )}
              </button>
              <button className="btn-icon" onClick={() => setShowAdd(!showAdd)} style={{ background: '#f1f2f6', padding: '12px', borderRadius: '12px' }}><Plus size={24} /></button>
            </div>
          </div>
          
          {showReception && (
             <div className="mini-form reception" style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '30px', background: '#121212', borderRadius: '24px', marginBottom: '35px', border: '1px solid #333' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px', color: '#38bdf8' }}>
                  <Truck size={28} />
                  <h3 style={{ margin: '0', fontSize: '1.4rem', fontWeight: 800 }}>Очікуючі поставки від Постачання</h3>
                </div>
                
                {pendingDocs.length === 0 ? (
                  <p style={{ color: '#555', margin: 0, fontStyle: 'italic' }}>Немає активних документів для прийомки.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    {pendingDocs.map(doc => (
                      <div key={doc.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#0a0a0a', padding: '25px', borderRadius: '16px', border: '1px solid #222' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: '15px', marginBottom: '15px' }}>
                            <strong style={{ fontSize: '1.2rem', color: '#fff', letterSpacing: '0.05em' }}>ДОКУМЕНТ #{doc.id.substring(0,8)}</strong>
                            <span style={{ fontSize: '0.85rem', color: '#666' }}>{new Date(doc.created_at).toLocaleString('uk-UA')}</span>
                          </div>
                          
                          <div style={{ padding: '15px', background: '#111', borderRadius: '12px', border: '1px solid #1a1a1a', display: 'inline-block', minWidth: '350px' }}>
                            <h4 style={{ margin: '0 0 10px 0', fontSize: '0.8rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Специфікація:</h4>
                            <ul style={{ margin: 0, paddingLeft: '0', listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              {doc.items.map((it, idx) => {
                                const nom = nomenclatures.find(n => n.id === it.nomenclature_id)
                                const fullName = nom ? `${nom.name}${nom.material_type ? ` (${nom.material_type})` : ''}` : 'Невідома позиція'
                                return (
                                  <li key={idx} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: idx < doc.items.length - 1 ? '1px dashed #222' : 'none', paddingBottom: idx < doc.items.length - 1 ? '8px' : '0' }}>
                                    <span style={{ color: '#ccc', fontSize: '1.05rem' }}>{fullName}</span>
                                    <strong style={{ color: 'var(--primary)', fontSize: '1.1rem' }}>{it.qty} од.</strong>
                                  </li>
                                )
                              })}
                            </ul>
                          </div>
                        </div>
                        <div style={{ paddingLeft: '30px' }}>
                          <button className="btn-primary" style={{ background: '#10b981', padding: '20px 30px', borderRadius: '16px', border: 'none', color: '#fff', cursor: 'pointer', fontWeight: 900, fontSize: '1rem', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '10px', boxShadow: '0 10px 20px rgba(16, 185, 129, 0.2)', transition: '0.2s' }} onClick={() => apiService.submitConfirmReception(doc.id, confirmReceptionDoc)} onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.02)'} onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}>
                            <CheckCircle2 size={24} /> Підтвердити прийомку
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
             </div>
          )}

          {showAdd && (
            <form onSubmit={(e) => { e.preventDefault(); apiService.submitInventory(newItem, addInventory); setShowAdd(false); }} className="mini-form" style={{ display: 'flex', gap: '15px', padding: '25px', background: '#f8f9fa', borderRadius: '20px', marginBottom: '35px', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)' }}>
              <input style={{ flex: 3, padding: '15px' }} placeholder="Найменування позиції..." onChange={e => setNewItem({...newItem, name: e.target.value})} />
              <input style={{ flex: 1, padding: '15px' }} type="number" placeholder="Початкова к-сть" onChange={e => setNewItem({...newItem, total_qty: e.target.value})} />
              <select style={{ flex: 1, padding: '15px' }} onChange={e => setNewItem({...newItem, unit: e.target.value})}>
                <option value="шт">шт</option>
                <option value="кг">кг</option>
                <option value="лист">лист</option>
              </select>
              <button type="submit" className="btn-primary" style={{ padding: '0 40px', borderRadius: '12px' }}>Додати</button>
            </form>
          )}

          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '40%' }}>Найменування</th>
                  <th style={{ width: '20%' }}>Загалом</th>
                  <th style={{ width: '20%' }}>У резерві</th>
                  <th style={{ width: '20%' }}>Оновлено</th>
                </tr>
              </thead>
              <tbody>
                {filteredInventory.map(item => (
                  <tr key={item.id}>
                    <td style={{ fontWeight: 600, fontSize: '1.1rem' }}>{item.name}</td>
                    <td><span className="qty-badge"><strong>{item.total_qty}</strong> {item.unit}</span></td>
                    <td><span className={`reserve-badge ${Number(item.reserved_qty) > 0 ? 'active' : ''}`}>{item.reserved_qty || 0} {item.unit}</span></td>
                    <td style={{ color: '#95a5a6', fontSize: '0.85rem' }}>{new Date(item.updated_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredInventory.length === 0 && (
              <div className="empty-state-container" style={{ padding: '100px 20px', textAlign: 'center', color: '#b2bec3' }}>
                <Package size={64} style={{ marginBottom: '20px', opacity: 0.2 }} />
                <p style={{ fontSize: '1.1rem' }}>У цьому розділі поки порожньо.<br/>Ви можете додати нову позицію за допомогою кнопки <strong>"+"</strong></p>
              </div>
            )}
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .tab-btn { 
          display: flex; align-items: center; gap: 12px; padding: 16px 28px; 
          background: #1b1b1b; border: 1px solid #333; border-radius: 18px; 
          cursor: pointer; white-space: nowrap; font-weight: 700; color: #999; 
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .tab-btn:hover { background: #222; transform: translateY(-3px); color: #fff; }
        .tab-btn.active { 
          background: var(--primary); color: black; border-color: var(--primary); 
          box-shadow: 0 10px 25px rgba(255, 144, 0, 0.3); 
        }
        
        .alert-card { border: 2px solid var(--primary); background: rgba(255,144,0,0.05); margin-bottom: 30px; border-radius: 24px; box-shadow: 0 0 30px rgba(255,144,0,0.1); }
        .req-card-mini { min-width: 350px; padding: 25px; background: #121212 !important; border-radius: 20px; border: 1px solid #444 !important; box-shadow: 0 8px 16px rgba(0,0,0,0.3) !important; }
        .req-info h4 { color: #fff; }
        .req-info p { color: #999 !important; }

        .data-table { width: 100%; border-collapse: separate; border-spacing: 0 12px; }
        .data-table th { 
          text-align: left; padding: 15px 25px; color: #666; font-size: 0.8rem; 
          text-transform: uppercase; letter-spacing: 0.15em; font-weight: 800;
        }
        .data-table td { 
          padding: 25px; background: #121212; border-top: 1px solid #333; border-bottom: 1px solid #333;
          color: #eee;
        }
        .data-table td:first-child { border-left: 1px solid #333; border-top-left-radius: 20px; border-bottom-left-radius: 20px; }
        .data-table td:last-child { border-right: 1px solid #333; border-top-right-radius: 20px; border-bottom-right-radius: 20px; }
        
        .qty-badge { background: #1b1b1b; padding: 8px 16px; border-radius: 10px; font-size: 1.1rem; color: #fff; border: 1px solid #333; }
        .qty-badge strong { color: var(--primary); }
        .reserve-badge { color: #666; font-weight: 600; font-size: 1.1rem; padding: 8px 16px; border-radius: 10px; background: #1b1b1b; border: 1px solid #333; }
        .reserve-badge.active { color: var(--primary); background: rgba(255, 144, 0, 0.1); border-color: rgba(255,144,0,0.3); }
        
        .mini-form { background: #111 !important; border: 1px solid #333 !important; }
        .mini-form input, .mini-form select { background: #000 !important; border: 1px solid #444 !important; color: white !important; }
        .mini-form input:focus { border-color: var(--primary) !important; }
      `}} />
    </div>
  )
}

export default WarehouseModule
