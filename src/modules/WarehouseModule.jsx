import React, { useState } from 'react'
import { 
  Warehouse as WarehouseIcon, 
  ArrowLeft, 
  Package, 
  CheckCircle2,
  Bell,
  Plus,
  Truck,
  Layers,
  Archive,
  AlertTriangle,
  Search
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useMES } from '../MESContext'
import { apiService } from '../services/apiDispatcher'

const WarehouseModule = () => {
  const { 
    inventory, addInventory, requests, issueMaterials, 
    nomenclatures, receptionDocs, confirmReceptionDoc,
    orders, tasks, approveWarehouse, createPurchaseRequest, purchaseRequests
  } = useMES()

  const normalize = (s) => (s || '').toLowerCase().trim()
    .replace(/[тt]/g, 't')
    .replace(/[аa]/g, 'a')
    .replace(/[еe]/g, 'e')
    .replace(/[оo]/g, 'o')
    .replace(/[рp]/g, 'p')
    .replace(/[сc]/g, 'c')
    .replace(/[хx]/g, 'x')
    .replace(/\s/g, '')
  
  const [activeTab, setActiveTab] = useState('raw')
  const [showAdd, setShowAdd] = useState(false)
  const [showReception, setShowReception] = useState(false)
  const [shortages, setShortages] = useState(null)
  const [newItem, setNewItem] = useState({ name: '', unit: 'шт', total_qty: '', type: 'raw' })
  const [searchQuery, setSearchQuery] = useState('')

  const tabs = [
    { id: 'raw', label: 'Сировина', icon: <Package size={18} /> },
    { id: 'semi', label: 'Напівфабрикати', icon: <Layers size={18} /> },
    { id: 'finished', label: 'Готова продукція', icon: <Archive size={18} /> },
    { id: 'scrap', label: 'Брак', icon: <AlertTriangle size={18} /> }
  ]

  const filteredInventory = inventory.filter(i => 
    i.type === activeTab && 
    i.name.toLowerCase().includes(searchQuery.toLowerCase())
  )
  const pendingDocs = receptionDocs ? receptionDocs.filter(d => d.status === 'pending') : []
  const pendingRequests = requests.filter(r => r.status === 'pending')
  
  const groupedRequests = pendingRequests.reduce((acc, req) => {
    if (!acc[req.order_id]) acc[req.order_id] = []
    acc[req.order_id].push(req)
    return acc
  }, {})

  const handleReserveOrder = (orderId, orderNum, reqList) => {
    // Check if we already have a purchase request for this order
    const hasActivePR = purchaseRequests.some(pr => pr.order_id === orderId && pr.status === 'pending')
    if (hasActivePR) return // Prevent modal if already awaiting supply

    const missingItems = []
    reqList.forEach(req => {
      let parsedName = ''
      try { parsedName = req.details?.split(': ')[1]?.split(' — ')[0]?.trim() } catch(e) {}
      const invItem = inventory.find(i => 
        i.id === req.inventory_id || 
        (parsedName && normalize(i.name) === normalize(parsedName) && i.type === 'raw')
      )
      const available = invItem ? (Number(invItem.total_qty) || 0)  - (Number(invItem.reserved_qty) || 0) : 0
      const needed = Number(req.quantity)
      if (available < needed) {
        const missingAmount = needed - available
        const reqDescription = req.details?.split(': ')[1] || req.details || 'Невідома деталь'
        let nomenclature_id = invItem?.nomenclature_id || (nomenclatures.find(n => n.name === parsedName)?.id) || null
        missingItems.push({ reqDetails: reqDescription, missingAmount, inventory_id: invItem?.id || req.inventory_id, nomenclature_id, needed })
      }
    })
    if (missingItems.length > 0) setShortages({ orderId, orderNum, items: missingItems })
    else apiService.submitReserveBatch(orderId, reqList, tasks.find(t => t.order_id === orderId)?.id, issueMaterials, approveWarehouse)
  }

  const sendPurchaseRequest = async () => {
    if (!shortages) return
    try {
      await apiService.submitPurchaseRequest(shortages.orderId, shortages.orderNum, shortages.items, createPurchaseRequest)
      alert('Запит відправлено до відділу постачання!')
      setShortages(null)
    } catch(err) { alert('Помилка: ' + err.message) }
  }

  return (
    <div className="warehouse-module-v2" style={{ background: '#080808', minHeight: '100vh', color: '#fff', display: 'flex', flexDirection: 'column' }}>
      <nav className="module-nav" style={{ flexShrink: 0 }}>
        <Link to="/" className="back-link"><ArrowLeft size={18} /> <span className="hide-mobile">Назад</span></Link>
        <div className="module-title-group">
          <WarehouseIcon className="text-secondary" size={24} />
          <h1 className="hide-mobile">Модуль Складу</h1>
          <h1 className="mobile-only" style={{ fontSize: '1rem' }}>СКЛАД</h1>
        </div>
      </nav>

      <div className="module-content" style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
        {activeTab === 'raw' && pendingRequests.length > 0 && (
          <div className="content-card glass-panel" style={{ borderLeft: '4px solid #ff9000', marginBottom: '30px', padding: '20px' }}>
            <h3 style={{ fontSize: '0.8rem', color: '#ff9000', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}><Bell size={16} /> ЗАЯВКИ НА КОМПЛЕКТАЦІЮ</h3>
            <div style={{ display: 'flex', gap: '15px', overflowX: 'auto', paddingBottom: '10px' }}>
              {Object.entries(groupedRequests).map(([orderId, reqList]) => {
                const orderNum = orders.find(o => o.id === orderId)?.order_num || '???'
                
                // 1. Check for Active Purchase Request (Pending)
                const hasActivePR = purchaseRequests.some(pr => pr.order_id === orderId && pr.status === 'pending')
                
                // 2. Check for Active Reception Doc (Ordered or Pending)
                const hasActiveReception = receptionDocs.some(rd => rd.order_id === orderId && rd.status !== 'completed')

                // 3. Check for shortages to decide between "Issue" and "Reserve"
                const missingItems = []
                reqList.forEach(req => {
                  let parsedName = ''
                  try { parsedName = req.details?.split(': ')[1]?.split(' — ')[0]?.trim() } catch(e) {}
                  const invItem = inventory.find(i => 
                    i.id === req.inventory_id || 
                    (parsedName && normalize(i.name) === normalize(parsedName) && i.type === 'raw')
                  )
                  const available = invItem ? (Number(invItem.total_qty) || 0)  - (Number(invItem.reserved_qty) || 0) : 0
                  const needed = Number(req.quantity)
                  if (available < needed) missingItems.push(req)
                })

                const acceptedPR = purchaseRequests.find(pr => pr.order_id === orderId && pr.status === 'accepted')
                const isAwaiting = hasActivePR || acceptedPR || hasActiveReception
                
                const btnLabel = hasActivePR ? 'ОЧІКУЄ ПОСТАВКИ' : 
                                acceptedPR ? 'ЗАПИТ ПРИЙНЯТО' : 
                                hasActiveReception ? 'ПРИЙОМКА' : 
                                (missingItems.length === 0 ? 'ВИДАТИ' : 'ЗІБРАТИ ТА ЗАБРОНЮВАТИ')
                
                const btnColor = isAwaiting ? '#1a1a1a' : '#ff9000'
                const textColor = isAwaiting ? '#444' : '#000'

                return (
                  <div key={orderId} style={{ minWidth: '300px', background: '#111', padding: '15px', borderRadius: '15px', border: '1px solid #222' }}>
                    <strong style={{ display: 'block', fontSize: '0.75rem', marginBottom: '10px' }}>НАРЯД #{orderNum}</strong>
                    <ul style={{ fontSize: '0.8rem', color: '#888', paddingLeft: '15px', marginBottom: '15px' }}>
                      {reqList.map(r => {
                          const displayDetails = r.details?.split(': ')[1]?.split(' (Для:')[0] || r.details
                          return <li key={r.id}>{displayDetails}</li>
                      })}
                    </ul>
                    <button 
                      onClick={() => handleReserveOrder(orderId, orderNum, reqList)} 
                      disabled={isAwaiting}
                      style={{ 
                        width: '100%', 
                        padding: '12px', 
                        background: btnColor, 
                        color: textColor, 
                        border: isAwaiting ? '1px solid #222' : 'none', 
                        borderRadius: '10px', 
                        fontWeight: 900, 
                        cursor: isAwaiting ? 'not-allowed' : 'pointer',
                        fontSize: '0.8rem',
                        textTransform: 'uppercase'
                      }}
                    >
                      {btnLabel}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: '10px', marginBottom: '25px', overflowX: 'auto' }}>
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => { setActiveTab(tab.id); setNewItem({...newItem, type: tab.id}); }} style={{ background: activeTab === tab.id ? '#ff9000' : '#111', color: activeTab === tab.id ? '#000' : '#555', border: '1px solid #222', padding: '12px 20px', borderRadius: '14px', fontSize: '0.85rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', whiteSpace: 'nowrap' }}>
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        <div className="content-card glass-panel" style={{ padding: '25px', borderRadius: '24px', background: 'rgba(20,20,20,0.6)', border: '1px solid #222' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px', marginBottom: '25px' }}>
             <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 900 }}>{tabs.find(t => t.id === activeTab).label.toUpperCase()}</h2>
             <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{ position: 'relative' }}>
                   <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#444' }} />
                   <input style={{ background: '#000', border: '1px solid #222', padding: '8px 12px 8px 35px', borderRadius: '10px', color: '#fff', width: '180px' }} placeholder="Пошук..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                </div>
                <button onClick={() => setShowReception(!showReception)} style={{ background: '#0ea5e9', color: '#fff', border: 'none', padding: '8px 15px', borderRadius: '10px', fontWeight: 800, cursor: 'pointer', position: 'relative', display: 'flex', alignItems: 'center', gap: '8px' }}>
                   <Truck size={18} /> <span className="hide-mobile">ПРИЙОМКА</span> {pendingDocs.length > 0 && <span style={{ background: '#ef4444', height: '18px', width: '18px', borderRadius: '50%', fontSize: '0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{pendingDocs.length}</span>}
                </button>
                <button onClick={() => setShowAdd(!showAdd)} style={{ background: '#222', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: '10px', cursor: 'pointer' }}><Plus size={20} /></button>
             </div>
          </div>

          {showReception && (
            <div style={{ background: '#111', padding: '20px', borderRadius: '15px', marginBottom: '20px', border: '1px solid #333' }}>
               <h4 style={{ color: '#0ea5e9', fontSize: '0.8rem', marginBottom: '15px' }}>ОЧІКУЮТЬ ПРИЙОМКИ</h4>
               {pendingDocs.map(doc => (
                 <div key={doc.id} style={{ padding: '15px 20px', background: '#000', borderRadius: '18px', marginBottom: '12px', border: '1px solid #1a1a1a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ flex: 1 }}>
                       <div style={{ fontSize: '0.65rem', color: '#0ea5e9', fontWeight: 900, textTransform: 'uppercase', marginBottom: '10px', letterSpacing: '0.05em' }}>ДОКУМЕНТ #{doc.id.substring(0,8)}</div>
                       <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                          {doc.items?.map((it, idx) => {
                            const nom = nomenclatures.find(n => n.id === it.nomenclature_id)
                            return (
                              <div key={idx} style={{ background: '#0a0a0a', padding: '5px 10px', borderRadius: '8px', border: '1px solid #222', display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.72rem', color: '#888', fontWeight: 700 }}>{nom ? (nom.name + (nom.material_type ? ` (${nom.material_type})` : '')) : 'Товар'}</span>
                                <strong style={{ fontSize: '0.85rem', color: '#fff' }}>{it.qty}</strong>
                              </div>
                            )
                          })}
                       </div>
                    </div>
                    <button onClick={() => apiService.submitConfirmReception(doc.id, confirmReceptionDoc)} style={{ marginLeft: '15px', background: '#10b981', color: '#000', border: 'none', padding: '10px 20px', borderRadius: '10px', fontWeight: 1000, cursor: 'pointer', fontSize: '0.8rem' }}>ПРИЙНЯТИ</button>
                 </div>
               ))}
               {pendingDocs.length === 0 && <p style={{ color: '#333', fontSize: '0.8rem', textAlign: 'center' }}>Немає активних документів на прийомку</p>}
            </div>
          )}

          {showAdd && (
            <form onSubmit={(e) => { e.preventDefault(); apiService.submitInventory(newItem, addInventory); setShowAdd(false); }} className="stack-mobile" style={{ display: 'flex', gap: '10px', padding: '15px', background: '#111', borderRadius: '15px', marginBottom: '20px' }}>
              <input style={{ flex: 2, background: '#000', border: '1px solid #333', color: '#fff', padding: '10px', borderRadius: '8px' }} placeholder="Назва товару..." value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} required />
              <input style={{ flex: 1, background: '#000', border: '1px solid #333', color: '#fff', padding: '10px', borderRadius: '8px' }} type="number" placeholder="Кількість" value={newItem.total_qty} onChange={e => setNewItem({...newItem, total_qty: e.target.value})} required />
              <button type="submit" style={{ background: '#ff9000', color: '#000', border: 'none', padding: '10px 30px', borderRadius: '8px', fontWeight: 900, cursor: 'pointer' }}>ДОДАТИ</button>
            </form>
          )}

          <div className="table-responsive-container hide-mobile">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #222', textAlign: 'left' }}>
                  <th className="sticky-col" style={{ padding: '15px', fontSize: '0.7rem', color: '#555' }}>НАЙМЕНУВАННЯ</th>
                  <th style={{ padding: '15px', fontSize: '0.7rem', color: '#555', textAlign: 'center' }}>НАЯВНІСТЬ</th>
                  <th style={{ padding: '15px', fontSize: '0.7rem', color: '#555', textAlign: 'center' }}>РЕЗЕРВ</th>
                  <th style={{ padding: '15px', fontSize: '0.7rem', color: '#555', textAlign: 'right' }}>ОСТАННЄ ОНОВЛЕННЯ</th>
                </tr>
              </thead>
              <tbody>
                {filteredInventory.map(item => (
                  <tr key={item.id} style={{ borderBottom: '1px solid #151515' }}>
                    <td className="sticky-col" style={{ padding: '15px', fontWeight: 800 }}>{item.name}</td>
                    <td style={{ padding: '15px', textAlign: 'center', color: '#ff9000', fontWeight: 900 }}>{item.total_qty} <small style={{ color: '#444', fontWeight: 400 }}>{item.unit}</small></td>
                    <td style={{ padding: '15px', textAlign: 'center', color: Number(item.reserved_qty) > 0 ? '#3b82f6' : '#222', fontWeight: 800 }}>{item.reserved_qty || 0}</td>
                    <td style={{ padding: '15px', textAlign: 'right', color: '#333', fontSize: '0.7rem' }}>{new Date(item.updated_at).toLocaleDateString()} {new Date(item.updated_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mobile-only">
             {filteredInventory.map(item => (
               <div key={item.id} style={{ background: '#111', padding: '15px', borderRadius: '16px', border: '1px solid #222', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                     <strong>{item.name}</strong>
                     <span style={{ fontSize: '0.7rem', color: '#444' }}>{item.unit}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '20px' }}>
                     <div><div style={{ fontSize: '0.6rem', color: '#555' }}>НАЯВНІСТЬ</div><div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#ff9000' }}>{item.total_qty}</div></div>
                     <div><div style={{ fontSize: '0.6rem', color: '#555' }}>РЕЗЕРВ</div><div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#3b82f6' }}>{item.reserved_qty || 0}</div></div>
                  </div>
               </div>
             ))}
          </div>
        </div>
      </div>

      {shortages && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: '#111', border: '1px solid #333', borderRadius: '24px', padding: '30px', width: '100%', maxWidth: '400px' }}>
             <h3 style={{ color: '#ef4444', margin: '0 0 15px', display: 'flex', alignItems: 'center', gap: '10px' }}><AlertTriangle size={24} /> ДЕФІЦИТ МАТЕРІАЛІВ</h3>
             <p style={{ fontSize: '0.85rem', color: '#888', marginBottom: '20px' }}>Для замовлення #{shortages.orderNum} не вистачає наступних позицій:</p>
             <div style={{ background: '#000', padding: '15px', borderRadius: '12px', marginBottom: '25px', maxHeight: '200px', overflowY: 'auto' }}>
                {shortages.items.map((i, idx) => <div key={idx} style={{ fontSize: '0.85rem', marginBottom: '8px', borderBottom: '1px solid #111', paddingBottom: '5px' }}>{i.reqDetails}: <strong style={{ color: '#ef4444' }}>{i.missingAmount}шт</strong></div>)}
             </div>
             <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => setShortages(null)} style={{ flex: 1, padding: '12px', borderRadius: '10px', background: '#222', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 800 }}>НАЗАД</button>
                <button onClick={sendPurchaseRequest} style={{ flex: 2, padding: '12px', borderRadius: '10px', background: '#ef4444', color: '#000', border: 'none', fontWeight: 900, cursor: 'pointer' }}>ЗАМОВИТИ У ПОСТАЧАЛЬНИКА</button>
             </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default WarehouseModule
