import React, { useState } from 'react'
import { 
  Truck, 
  ArrowLeft, 
  Package, 
  Plus, 
  Bell, 
  Search,
  CheckCircle2,
  ListPlus,
  Send,
  X,
  History,
  AlertTriangle
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useMES } from '../MESContext'

const SupplyModule = () => {
  const { 
    nomenclatures, receptionDocs, createReceptionDoc, sendDocToWarehouse,
    purchaseRequests, updatePurchaseRequestStatus, convertRequestToOrder
  } = useMES()
  const [showCreate, setShowCreate] = useState(false)
  const [draftItems, setDraftItems] = useState([])
  const [selectedQty, setSelectedQty] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedDoc, setExpandedDoc] = useState(null)
  
  const pendingPurchase = (purchaseRequests || []).filter(pr => pr.status === 'pending')
  const availableNoms = nomenclatures.filter(n => n.type !== 'part' && n.type !== 'product' && n.type !== 'finished')
  const getNomLabel = (n) => `${n.name} ${n.material_type ? `(${n.material_type})` : ''} - ${n.type === 'raw' ? 'Сировина' : 'Комплектація'}`

  const addToDraft = () => {
    if (!searchQuery || !selectedQty) return
    const nom = availableNoms.find(n => getNomLabel(n) === searchQuery)
    if (!nom) {
      alert('Будь ласка, оберіть точний товар з випадаючого списку!')
      return
    }
    
    setDraftItems([...draftItems, { nomenclature_id: nom.id, name: getNomLabel(nom), qty: selectedQty }])
    setSearchQuery('')
    setSelectedQty('')
  }

  const handleSendToWarehouse = async () => {
    if (draftItems.length === 0) return
    const items = draftItems.map(d => ({ nomenclature_id: d.nomenclature_id, qty: d.qty }))
    await createReceptionDoc(items)
    setDraftItems([])
    setShowCreate(false)
    alert('Документ відправлено на склад!')
  }

  return (
    <div className="module-page supply-page">
      <nav className="module-nav">
        <Link to="/" className="back-link"><ArrowLeft size={20} /> Повернутись</Link>
        <div className="module-title-group">
          <Truck className="text-primary" size={28} />
          <h1>Менеджер із постачання</h1>
        </div>
      </nav>

      <div className="module-content">
        <div className="supply-header-actions">
           <button className="btn-main-action" onClick={() => setShowCreate(true)}>
             <ListPlus size={20} /> СТВОРИТИ ДОКУМЕНТ ПРИЙОМКИ
           </button>
        </div>

        <div className="supply-layout-single">
          <div className="work-area">
             {showCreate ? (
               <div className="create-doc-panel">
                  <div className="panel-header">
                    <h2>Нова накладна для складу</h2>
                    <button className="btn-close" onClick={() => setShowCreate(false)}><X size={20} /></button>
                  </div>
                  
                  <div className="item-selector-row">
                    <div className="search-select-group">
                      <input 
                        type="text" 
                        list="nom-options"
                        placeholder="Оберіть або почніть вводити назву / товщину..." 
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="search-input"
                      />
                      <datalist id="nom-options">
                        {availableNoms.map(n => (
                          <option key={n.id} value={getNomLabel(n)} />
                        ))}
                      </datalist>
                    </div>
                    <input 
                      type="number" 
                      placeholder="К-сть" 
                      value={selectedQty}
                      onChange={e => setSelectedQty(e.target.value)} 
                      className="qty-input"
                    />
                    <button className="btn-add-item" onClick={addToDraft}><Plus size={20} /> Додати</button>
                  </div>

                  <div className="draft-list">
                    {draftItems.length === 0 ? (
                      <p className="empty-msg">Список порожній. Додайте товари вище.</p>
                    ) : (
                      <table className="draft-table">
                        <thead>
                          <tr>
                            <th>Товар</th>
                            <th>Кількість</th>
                            <th>Дія</th>
                          </tr>
                        </thead>
                        <tbody>
                          {draftItems.map((item, idx) => (
                            <tr key={idx}>
                              <td>{item.name}</td>
                              <td>{item.qty}</td>
                              <td><button className="btn-text-danger" onClick={() => setDraftItems(draftItems.filter((_, i) => i !== idx))}>Видалити</button></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>

                  {draftItems.length > 0 && (
                     <div style={{ display: 'flex', gap: '20px' }}>
                        <button className="btn-send-full" onClick={handleSendToWarehouse} style={{ flex: 1 }}>
                          <Send size={18} /> ВІДПРАВИТИ НА СКЛАД
                        </button>
                    </div>
                  )}
               </div>
             ) : (
               <div className="supply-dashboard" style={{ display: 'flex', flexDirection: 'column', gap: '40px', height: '100%', overflowY: 'auto', paddingRight: '15px' }}>
                  
                  {pendingPurchase.length > 0 && (
                    <div className="purchase-requests-section" style={{ background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '24px', padding: '40px' }}>
                      <h3 style={{ color: '#ef4444', margin: '0 0 25px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <AlertTriangle size={28} /> Запити від складу (Дефіцит)
                      </h3>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '20px' }}>
                        {pendingPurchase.map(pr => (
                          <div key={pr.id} style={{ background: '#121212', padding: '25px', borderRadius: '16px', border: '1px solid #333', display: 'flex', flexDirection: 'column' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                              <div>
                                <strong style={{ color: 'var(--primary)', fontSize: '1.1rem', letterSpacing: '0.05em' }}>НАРЯД #{pr.order_num}</strong>
                                <span style={{ display: 'block', fontSize: '0.85rem', color: '#666', marginTop: '6px' }}>Від: {new Date(pr.created_at).toLocaleDateString()}</span>
                              </div>
                              <button style={{ background: 'rgba(56,189,248,0.1)', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.3)', padding: '10px 15px', borderRadius: '10px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: '0.2s' }} onClick={() => convertRequestToOrder(pr.id)}>
                                <CheckCircle2 size={18} /> Сформувати поставку
                              </button>
                            </div>
                            <ul style={{ margin: 0, paddingLeft: '20px', color: '#ccc', fontSize: '0.95rem', lineHeight: '1.8', flex: 1 }}>
                              {(pr.items || []).map((it, idx) => (
                                <li key={idx}><span style={{ color: '#fff' }}>{it.reqDetails}</span> — <strong style={{ color: '#ef4444' }}>{it.missingAmount} од.</strong></li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="registry-section" style={{ background: '#121212', borderRadius: '30px', padding: '40px', border: '1px solid #1a1a1a' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '35px' }}>
                      <History size={32} className="text-primary" />
                      <h2 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 800 }}>Реєстр документів на поставку</h2>
                    </div>

                    <div className="doc-registry-list" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                      {(receptionDocs || []).map(doc => (
                        <div key={doc.id} className={`registry-card ${doc.status}`} style={{ background: '#0a0a0a', border: '1px solid #222', borderRadius: '20px', overflow: 'hidden', transition: '0.3s' }}>
                          <div style={{ padding: '25px 35px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => setExpandedDoc(expandedDoc === doc.id ? null : doc.id)}>
                            <div style={{ display: 'flex', gap: '25px', alignItems: 'center' }}>
                              <div style={{ background: doc.status === 'pending' ? 'rgba(245,158,11,0.1)' : doc.status === 'completed' ? 'rgba(16,185,129,0.1)' : 'rgba(56,189,248,0.1)', padding: '18px', borderRadius: '16px', color: doc.status === 'pending' ? '#f59e0b' : doc.status === 'completed' ? '#10b981' : '#38bdf8' }}>
                                <Package size={28} />
                              </div>
                              <div>
                                <h3 style={{ margin: '0 0 5px 0', fontSize: '1.3rem', color: '#fff' }}>Документ #{doc.id.substring(0,8)}</h3>
                                <span style={{ color: '#666', fontSize: '0.95rem' }}>Створено: {new Date(doc.created_at).toLocaleString('uk-UA')}</span>
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                              <span style={{ fontSize: '0.85rem', fontWeight: 900, textTransform: 'uppercase', padding: '10px 20px', borderRadius: '12px', background: doc.status === 'pending' ? 'rgba(245,158,11,0.1)' : doc.status === 'completed' ? 'rgba(16,185,129,0.1)' : 'rgba(56,189,248,0.1)', color: doc.status === 'pending' ? '#f59e0b' : doc.status === 'completed' ? '#10b981' : '#38bdf8' }}>
                                {doc.status === 'pending' ? 'Очікує на складі' : doc.status === 'completed' ? 'Оприбутковано складом' : 'В дорозі (Замовлено)'}
                              </span>
                            </div>
                          </div>

                          {expandedDoc === doc.id && (
                            <div style={{ background: '#111', padding: '30px 40px', borderTop: '1px solid #222', animation: 'fadeIn 0.3s ease-out' }}>
                              <h4 style={{ margin: '0 0 20px 0', color: '#ccc', fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Специфікація документу</h4>
                              <table style={{ width: '100%', borderCollapse: 'collapse', color: '#eee' }}>
                                <thead>
                                  <tr>
                                    <th style={{ textAlign: 'left', padding: '15px 10px', color: '#666', fontSize: '0.85rem', textTransform: 'uppercase', borderBottom: '1px solid #222' }}>Найменування</th>
                                    <th style={{ textAlign: 'right', padding: '15px 10px', color: '#666', fontSize: '0.85rem', textTransform: 'uppercase', borderBottom: '1px solid #222' }}>Кількість</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {doc.items.map((it, idx) => {
                                    const nom = nomenclatures.find(n => n.id === it.nomenclature_id)
                                    const fullName = nom ? `${nom.name}${nom.material_type ? ` (${nom.material_type})` : ''}` : 'Невідомо'
                                    return (
                                      <tr key={idx}>
                                        <td style={{ padding: '20px 10px', borderBottom: '1px solid #1a1a1a', fontSize: '1.05rem', color: '#fff' }}>{fullName}</td>
                                        <td style={{ padding: '20px 10px', borderBottom: '1px solid #1a1a1a', textAlign: 'right', fontWeight: 800, fontSize: '1.1rem', color: 'var(--primary)' }}>{it.qty} од.</td>
                                      </tr>
                                    )
                                  })}
                                </tbody>
                              </table>

                              {doc.status === 'ordered' && (
                                <div style={{ marginTop: '25px', display: 'flex', justifyContent: 'flex-end' }}>
                                  <button className="btn-send-full" onClick={(e) => { e.stopPropagation(); sendDocToWarehouse(doc.id); }} style={{ width: 'auto', padding: '15px 30px', fontSize: '1rem' }}>
                                    <Send size={18} /> Передати на прийомку складу
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                      {(!receptionDocs || receptionDocs.length === 0) && <p className="empty-msg">Реєстр документів порожній.</p>}
                    </div>
                  </div>
               </div>
             )}
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .supply-page { background: #0a0a0a; color: #fff; height: 100vh; display: flex; flex-direction: column; }
        .text-primary { color: var(--primary); }
        .text-secondary { color: #555; }
        
        .supply-header-actions { padding: 30px 40px 10px; }
        .btn-main-action { background: var(--primary); color: #000; border: none; padding: 18px 30px; border-radius: 16px; font-weight: 900; display: flex; align-items: center; gap: 12px; cursor: pointer; transition: 0.3s; }
        .btn-main-action:hover { transform: scale(1.02); box-shadow: 0 10px 20px rgba(255,144,0,0.2); }

        .supply-layout-single { flex: 1; padding: 0 40px 40px; display: flex; flex-direction: column; overflow: hidden; }
        
        .work-area { border-radius: 30px; display: flex; flex-direction: column; overflow: hidden; height: 100%; }
        .create-doc-panel { background: #121212; border-radius: 30px; border: 1px solid #1a1a1a; padding: 40px; display: flex; flex-direction: column; height: 100%; }
        
        .create-doc-panel { display: flex; flex-direction: column; height: 100%; }
        .panel-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; }
        .btn-close { background: none; border: none; color: #444; cursor: pointer; }
        
        .item-selector-row { display: flex; gap: 15px; margin-bottom: 30px; align-items: stretch; }
        .search-select-group { flex: 3; display: flex; flex-direction: column; justify-content: flex-end; }
        .search-input { width: 100%; background: #000; border: 1px solid #222; color: #fff; padding: 15px 20px; border-radius: 12px; font-size: 1.1rem; }
        .search-input:focus { border-color: var(--primary); outline: none; }
        
        .qty-input { flex: 1; background: #000; border: 1px solid #222; color: #fff; padding: 15px; border-radius: 12px; font-size: 1.1rem; text-align: center; }
        .btn-add-item { background: #222; color: #fff; border: none; padding: 0 25px; border-radius: 12px; font-weight: 700; display: flex; align-items: center; gap: 8px; cursor: pointer; transition: 0.2s; }
        .btn-add-item:hover { background: var(--primary); color: #000; }

        .draft-list { flex: 1; overflow-y: auto; background: #0a0a0a; border-radius: 20px; padding: 20px; border: 1px solid #1a1a1a; margin-bottom: 30px; }
        .draft-table { width: 100%; border-collapse: collapse; }
        .draft-table th { text-align: left; color: #444; font-size: 0.7rem; text-transform: uppercase; padding: 10px; }
        .draft-table td { padding: 15px 10px; border-bottom: 1px solid #151515; }
        .btn-text-danger { background: none; border: none; color: #ef4444; cursor: pointer; font-size: 0.8rem; font-weight: 700; }

        .btn-send-full { background: #10b981; color: #fff; border: none; padding: 20px; border-radius: 16px; font-weight: 900; display: flex; align-items: center; justify-content: center; gap: 12px; cursor: pointer; transition: 0.2s; }
        .btn-send-full:hover { background: #059669; }

        .registry-card:hover { border-color: #333 !important; }

        .empty-msg { color: #444; text-align: center; margin-top: 40px; font-style: italic; }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-5px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}} />
    </div>
  )
}

export default SupplyModule
