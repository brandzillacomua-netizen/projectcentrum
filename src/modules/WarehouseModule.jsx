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

const WarehouseModule = () => {
  const { inventory, addInventory, requests, issueMaterials } = useMES()
  const [activeTab, setActiveTab] = useState('raw')
  const [showAdd, setShowAdd] = useState(false)
  const [newItem, setNewItem] = useState({ name: '', unit: 'шт', total_qty: '', type: 'raw' })

  const tabs = [
    { id: 'raw', label: 'Сировина', icon: <Package size={18} /> },
    { id: 'semi', label: 'Напівфабрикати', icon: <Layers size={18} /> },
    { id: 'finished', label: 'Готова продукція', icon: <Archive size={18} /> },
    { id: 'scrap', label: 'Брак', icon: <AlertTriangle size={18} /> }
  ]

  const filteredInventory = inventory.filter(i => i.type === activeTab)

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
        {activeTab === 'raw' && requests.filter(r => r.status === 'pending').length > 0 && (
          <div className="content-card alert-card">
            <div className="card-header">
              <h3><Bell size={18} className="text-accent" /> Нові запити від майстра</h3>
            </div>
            <div className="request-list horiz" style={{ display: 'flex', gap: '20px', overflowX: 'auto', padding: '15px 5px' }}>
              {requests.filter(r => r.status === 'pending').map(req => {
                const materialName = inventory.find(i => i.id === req.inventory_id)?.name || 'Невідома сировина'
                return (
                  <div key={req.id} className="req-card-mini" style={{ minWidth: '350px', padding: '25px', background: 'white', borderRadius: '20px', border: '1px solid #ffe8cc', boxShadow: '0 8px 16px rgba(255, 152, 0, 0.08)' }}>
                    <div className="req-info">
                      <strong style={{ display: 'block', fontSize: '0.75rem', color: 'var(--accent)', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.05em' }}>ЗАПИТ #{req.id.substring(0,4)}</strong>
                      <h4 style={{ margin: '0 0 10px 0', fontSize: '1.1rem' }}>{materialName}</h4>
                      <p style={{ fontSize: '0.9rem', color: '#666', margin: '0 0 20px 0', lineHeight: 1.5 }}>{req.details}</p>
                    </div>
                    <button className="btn-primary" style={{ width: '100%', padding: '14px', borderRadius: '12px' }} onClick={() => issueMaterials(req.id)}>Підтвердити Резерв</button>
                  </div>
                )
              })}
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
            <button className="btn-icon" onClick={() => setShowAdd(!showAdd)} style={{ background: '#f1f2f6', padding: '12px', borderRadius: '12px' }}><Plus size={24} /></button>
          </div>
          
          {showAdd && (
            <form onSubmit={(e) => { e.preventDefault(); addInventory(newItem); setShowAdd(false); }} className="mini-form" style={{ display: 'flex', gap: '15px', padding: '25px', background: '#f8f9fa', borderRadius: '20px', marginBottom: '35px', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)' }}>
              <input style={{ flex: 3, padding: '15px' }} placeholder="Найменування позиції..." onChange={e => setNewItem({...newItem, name: e.target.value})} />
              <input style={{ flex: 1, padding: '15px' }} type="number" placeholder="Кількість" onChange={e => setNewItem({...newItem, total_qty: e.target.value})} />
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
