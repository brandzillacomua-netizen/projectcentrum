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
  AlertTriangle,
  ChevronDown,
  ChevronUp
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useMES } from '../MESContext'
import { apiService } from '../services/apiDispatcher'

const SupplyModule = () => {
  const { 
    nomenclatures, receptionDocs, createReceptionDoc, sendDocToWarehouse,
    purchaseRequests, updatePurchaseRequestStatus, convertRequestToOrder
  } = useMES()
  const [activeMobileSection, setActiveMobileSection] = useState('requests') // requests, registry, create
  const [showCreate, setShowCreate] = useState(false)
  const [draftItems, setDraftItems] = useState([])
  const [selectedQty, setSelectedQty] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedDoc, setExpandedDoc] = useState(null)
  
  const pendingRequests = (purchaseRequests || []).filter(pr => pr.status === 'pending')
  const availableNoms = nomenclatures.filter(n => n.type !== 'part' && n.type !== 'product' && n.type !== 'finished')
  const getNomLabel = (n) => `${n.name} ${n.material_type ? `(${n.material_type})` : ''}`

  const addToDraft = () => {
    if (!searchQuery || !selectedQty) return
    const nom = availableNoms.find(n => getNomLabel(n) === searchQuery)
    if (!nom) {
      alert('Оберіть товар зі списку!')
      return
    }
    setDraftItems([...draftItems, { nomenclature_id: nom.id, name: getNomLabel(nom), qty: selectedQty }])
    setSearchQuery('')
    setSelectedQty('')
  }

  const handleSendToWarehouse = async () => {
    if (draftItems.length === 0) return
    const items = draftItems.map(d => ({ nomenclature_id: d.nomenclature_id, qty: d.qty }))
    await apiService.submitCreateReceptionDoc(items, createReceptionDoc)
    setDraftItems([])
    setShowCreate(false)
    setActiveMobileSection('registry')
    alert('Готово! Документ передано на склад.')
  }

  return (
    <div className="supply-module-v2" style={{ background: '#0a0a0a', minHeight: '100vh', color: '#fff', display: 'flex', flexDirection: 'column' }}>
      <nav className="module-nav" style={{ flexShrink: 0 }}>
        <Link to="/" className="back-link"><ArrowLeft size={18} /> <span className="hide-mobile">Назад</span></Link>
        <div className="module-title-group">
          <Truck className="text-secondary" size={24} />
          <h1 className="hide-mobile">Менеджер із постачання</h1>
          <h1 className="mobile-only" style={{ fontSize: '1rem' }}>ПОСТАЧАННЯ</h1>
        </div>
      </nav>

      <div className="module-content" style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
        
        {/* Section Tabs (Mobile Only) */}
        <div className="mobile-only supply-tabs" style={{ display: 'flex', background: '#111', padding: '5px', borderRadius: '14px', marginBottom: '25px' }}>
           <button onClick={() => {setActiveMobileSection('requests'); setShowCreate(false)}} className={`tab-btn-m ${activeMobileSection === 'requests' && !showCreate ? 'active' : ''}`}>ДЕФІЦИТ ({pendingRequests.length})</button>
           <button onClick={() => {setActiveMobileSection('registry'); setShowCreate(false)}} className={`tab-btn-m ${activeMobileSection === 'registry' && !showCreate ? 'active' : ''}`}>РЕЄСТР</button>
           <button onClick={() => {setShowCreate(true); setActiveMobileSection('create')}} className={`tab-btn-m ${showCreate ? 'active' : ''}`}>+ НОВИЙ</button>
        </div>

        <div className="supply-main-layout" style={{ display: 'grid', gridTemplateColumns: showCreate ? '1fr' : 'repeat(auto-fit, minmax(400px, 1fr))', gap: '30px' }}>
           
           {/* CREATE PANEL - Tablet/PC fixed or Mobile full-screen */}
           {(showCreate || (!window.matchMedia("(max-width: 768px)").matches && showCreate)) && (
             <section className="create-panel glass-panel" style={{ background: '#111', borderRadius: '24px', border: '1px solid #222', padding: '30px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '25px' }}>
                   <h2 style={{ fontSize: '1.2rem', fontWeight: 900, color: '#ff9000', margin: 0 }}>НОВА ПРИЙОМКА ТОВАРУ</h2>
                   <button onClick={() => {setShowCreate(false); setActiveMobileSection('registry')}} style={{ background: 'transparent', border: 'none', color: '#444', cursor: 'pointer' }}><X size={24} /></button>
                </div>

                <div className="creation-flow" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                   <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '10px' }} className="mobile-stack">
                      <div style={{ position: 'relative', flex: 1 }}>
                         <input list="noms-list" style={{ width: '100%', background: '#000', border: '1px solid #333', color: '#fff', padding: '15px', borderRadius: '12px' }} placeholder="Оберіть товар..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                         <datalist id="noms-list">
                            {availableNoms.map(n => <option key={n.id} value={getNomLabel(n)} />)}
                         </datalist>
                      </div>
                      <input type="number" style={{ width: '80px', background: '#000', border: '1px solid #333', color: '#fff', padding: '15px', borderRadius: '12px', textAlign: 'center' }} placeholder="К-сть" value={selectedQty} onChange={e => setSelectedQty(e.target.value)} />
                      <button onClick={addToDraft} style={{ background: '#222', color: '#fff', border: 'none', padding: '15px 25px', borderRadius: '12px', fontWeight: 900, cursor: 'pointer' }}><Plus size={20} /></button>
                   </div>

                   <div className="draft-preview" style={{ background: '#0a0a0a', padding: '15px', borderRadius: '18px', minHeight: '100px', border: '1px solid #1a1a1a' }}>
                      {draftItems.length === 0 ? <p style={{ color: '#444', textAlign: 'center', marginTop: '25px', fontSize: '0.8rem' }}>Додайте позиції вище</p> : 
                        draftItems.map((it, idx) => (
                           <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #111' }}>
                              <span style={{ fontSize: '0.85rem' }}>{it.name}</span>
                              <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                                 <strong style={{ color: '#ff9000' }}>{it.qty}</strong>
                                 <button onClick={() => setDraftItems(draftItems.filter((_, i) => i !== idx))} style={{ color: '#444', border: 'none', background: 'transparent', cursor: 'pointer' }}><X size={14} /></button>
                              </div>
                           </div>
                        ))
                      }
                   </div>
                   
                   {draftItems.length > 0 && (
                      <button onClick={handleSendToWarehouse} style={{ width: '100%', padding: '18px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '14px', fontWeight: 900, cursor: 'pointer', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                         <Send size={18} /> ПЕРЕДАТИ НА СКЛАД
                      </button>
                   )}
                </div>
             </section>
           )}

           {/* REQUESTS COLUMN */}
           {!showCreate && (activeMobileSection === 'requests' || !window.matchMedia("(max-width: 768px)").matches) && (
             <section className="requests-col">
                <h3 style={{ fontSize: '0.85rem', color: '#555', marginBottom: '20px' }}><AlertTriangle size={18} className="text-secondary" /> ДЕФІЦИТ ТА ЗАПИТИ</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                   {pendingRequests.map(pr => (
                     <div key={pr.id} className="request-card" style={{ background: '#111', padding: '25px', borderRadius: '24px', border: '1px solid #222', borderLeft: '4px solid #ef4444' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
                           <strong style={{ color: '#ef4444', fontSize: '1rem' }}>НАРЯД #{pr.order_num}</strong>
                           <button onClick={() => apiService.submitConvertRequestToOrder(pr.id, convertRequestToOrder)} style={{ background: '#3b82f622', color: '#3b82f6', border: '1px solid #3b82f644', padding: '8px 15px', borderRadius: '10px', fontSize: '0.7rem', fontWeight: 900 }}>СФОРМУВАТИ ПОСТАВКУ</button>
                        </div>
                        <div style={{ fontSize: '0.9rem', color: '#888' }}>
                           {(pr.items || []).map((it, idx) => (
                             <div key={idx} style={{ padding: '8px 0', borderBottom: '1px solid #1a1a1a', display: 'flex', justifyContent: 'space-between' }}>
                                <span>{it.reqDetails}</span>
                                <strong style={{ color: '#ef4444' }}>{it.missingAmount}</strong>
                             </div>
                           ))}
                        </div>
                     </div>
                   ))}
                   {pendingRequests.length === 0 && <div style={{ textAlign: 'center', padding: '60px', color: '#333', fontSize: '0.85rem' }}>Активних дефіцитів не зафіксовано</div>}
                </div>
             </section>
           )}

           {/* REGISTRY COLUMN */}
           {!showCreate && (activeMobileSection === 'registry' || !window.matchMedia("(max-width: 768px)").matches) && (
             <section className="registry-col">
                <h3 style={{ fontSize: '0.85rem', color: '#555', marginBottom: '20px' }}><History size={18} className="text-secondary" /> ОСТАННІ ПОСТАВКИ</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                   {(receptionDocs || []).map(doc => (
                     <div key={doc.id} className="doc-card" style={{ background: '#111', borderRadius: '20px', border: '1px solid #222', overflow: 'hidden' }}>
                        <div onClick={() => setExpandedDoc(expandedDoc === doc.id ? null : doc.id)} style={{ padding: '20px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                           <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                              <div style={{ background: '#0a0a0a', padding: '12px', borderRadius: '12px', color: doc.status === 'pending' ? '#ff9000' : '#10b981' }}><Package size={20} /></div>
                              <div>
                                 <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>#{doc.id.substring(0,6)}</div>
                                 <div style={{ fontSize: '0.65rem', color: '#444' }}>{new Date(doc.created_at).toLocaleDateString()}</div>
                              </div>
                           </div>
                           <div className={`status-pill ${doc.status}`} style={{ fontSize: '0.6rem', fontWeight: 900, textTransform: 'uppercase', padding: '5px 10px', borderRadius: '20px' }}>{doc.status}</div>
                        </div>
                        {expandedDoc === doc.id && (
                           <div style={{ padding: '20px', background: '#0a0a0a', borderTop: '1px solid #222' }}>
                              {doc.items.map((it, idx) => {
                                 const nom = nomenclatures.find(n => n.id === it.nomenclature_id)
                                 return (
                                   <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #111' }}>
                                      <span style={{ fontSize: '0.8rem', color: '#888' }}>{nom?.name}</span>
                                      <strong style={{ fontSize: '0.8rem' }}>{it.qty}</strong>
                                   </div>
                                 )
                              })}
                           </div>
                        )}
                     </div>
                   ))}
                </div>
             </section>
           )}
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .tab-btn-m { flex: 1; padding: 12px; border: none; background: transparent; color: #444; font-weight: 900; font-size: 0.7rem; border-radius: 10px; cursor: pointer; transition: 0.3s; }
        .tab-btn-m.active { background: #222; color: #ff9000; }
        
        .status-pill.pending { background: rgba(255,144,0,0.1); color: #ff9000; }
        .status-pill.completed { background: rgba(16,185,129,0.1); color: #10b981; }
        .status-pill.ordered { background: rgba(59,130,246,0.1); color: #3b82f6; }

        @media (max-width: 768px) {
          .hide-mobile { display: none !important; }
          .mobile-stack { grid-template-columns: 1fr !important; }
        }
        @media (min-width: 769px) { .mobile-only { display: none !important; } }
      `}} />
    </div>
  )
}

export default SupplyModule
