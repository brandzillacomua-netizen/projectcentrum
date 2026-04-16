import React, { useState } from 'react'
import {
  Truck,
  ArrowLeft,
  Package,
  Plus,
  X,
  History,
  AlertTriangle,
  Send,
  Warehouse,
  CheckCircle
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useMES } from '../MESContext'
import { apiService } from '../services/apiDispatcher'
import { supabase } from '../supabase'

const SupplyModule = ({ isProcurementOnly = false }) => {
  const {
    inventory, nomenclatures, receptionDocs, createReceptionDoc, sendDocToWarehouse,
    purchaseRequests, updatePurchaseRequestStatus, convertRequestToOrder, currentUser,
    confirmReception, fetchData
  } = useMES()

  const [activeTab, setActiveTab] = useState('requests') // 'requests', 'registry', 'stock'
  const [activeMobileSection, setActiveMobileSection] = useState('requests')
  const [showCreate, setShowCreate] = useState(false)
  const [draftItems, setDraftItems] = useState([])
  const [selectedQty, setSelectedQty] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedDoc, setExpandedDoc] = useState(null)
  const [showReception, setShowReception] = useState(false)

  const normalize = (s) => (s || '').toLowerCase().trim()
    .replace(/[тt]/g, 't').replace(/[аa]/g, 'a').replace(/[еe]/g, 'e')
    .replace(/[оo]/g, 'o').replace(/[рp]/g, 'p').replace(/[сc]/g, 'c')
    .replace(/[хx]/g, 'x').replace(/\s/g, '')

  const parseMaterialName = (details) => {
    if (!details) return ''
    if (details.includes('ВИТРАТНІ МАТЕРІАЛИ')) {
      const match = details.match(/:\s*(.+)\s*—/)
      return match ? match[1].trim() : details
    }
    return details.split(': ')[1]?.split(' — ')[0]?.trim() || details
  }

  const pendingRequests = (purchaseRequests || []).filter(pr => {
    if (isProcurementOnly) return (pr.status === 'pending' || pr.status === 'accepted' || pr.status === 'ordered') && pr.destination_warehouse === 'procurement'
    return (pr.status === 'pending' || pr.status === 'accepted' || pr.status === 'ordered') && (pr.destination_warehouse === 'production' || !pr.destination_warehouse)
  })

  // Badge for new reception docs
  const incomingReceptionCount = (receptionDocs || []).filter(d => 
    (d.status === 'shipped' || d.status === 'ordered') && 
    (isProcurementOnly ? false : (!d.target_warehouse || d.target_warehouse === 'production'))
  ).length
  
  const availableNoms = (nomenclatures || []).filter(n => n.type !== 'part' && n.type !== 'product' && n.type !== 'finished')
  const getNomLabel = (n) => `${n.name}${n.material_type ? ` (${n.material_type})` : ''}`

  const getStatusLabel = (status) => {
    const map = {
      'pending': 'ОЧІКУЄ',
      'accepted': 'ПРИЙНЯТО',
      'ordered': 'ЗАМОВЛЕНО',
      'completed': 'ВИКОНАНО',
      'shipped': 'ВІДПРАВЛЕНО',
      'in-progress': 'В РОБОТІ'
    }
    return map[status] || (status || '').toUpperCase()
  }

  const addToDraft = () => {
    if (!searchQuery || !selectedQty) return
    const nom = availableNoms.find(n => getNomLabel(n) === searchQuery)
    if (!nom) { alert('Оберіть товар зі списку!'); return }
    setDraftItems([...draftItems, { nomenclature_id: nom.id, name: getNomLabel(nom), qty: selectedQty }])
    setSearchQuery('')
    setSelectedQty('')
  }

  const handleSendToWarehouse = async () => {
    if (draftItems.length === 0) return
    const items = draftItems.map(d => ({ nomenclature_id: d.nomenclature_id, name: d.name, qty: d.qty }))
    await apiService.submitCreateReceptionDoc(items, (its) => createReceptionDoc(its, 'ordered', null), null)
    setDraftItems([])
    setShowCreate(false)
    setActiveMobileSection('registry')
    alert('Готово! Документ створено. Не забудьте "Відправити на склад" з Реєстру.')
  }

  const handleForwardToProcurement = async (pr) => {
    try {
      const cloneData = {
        order_id: pr.order_id,
        task_id: pr.task_id,
        order_num: pr.order_num,
        items: pr.items,
        status: 'pending',
        destination_warehouse: 'procurement'
      }
      const { error } = await supabase.from('purchase_requests').insert([cloneData])
      if (error) throw error
      alert('Запит перенаправлено до відділу Постачання!')
      if (fetchData) fetchData()
    } catch (err) {
       alert('Помилка відправки в постачання: ' + err.message)
    }
  }

  // Resolve item name from any possible field structure
  const resolveItemName = (it, idx) => {
    // Case 1: directly has name
    if (it.name) return it.name
    // Case 2: has nomenclature_id - look it up
    if (it.nomenclature_id) {
      const nom = (nomenclatures || []).find(n => n.id === it.nomenclature_id)
      if (nom) return getNomLabel(nom)
    }
    // Case 3: text field from warehouse shortage flow
    return it.reqDetails || it.details || `Позиція ${idx + 1}`
  }

  // Resolve quantity from any possible field
  const resolveItemQty = (it) => {
    const val = it.qty ?? it.missingAmount ?? it.needed ?? it.quantity
    return val !== undefined && val !== null ? val : '—'
  }

  return (
    <div className="supply-module-v2" style={{ background: '#0a0a0a', minHeight: '100vh', color: '#fff', display: 'flex', flexDirection: 'column' }}>
      <nav className="module-nav" style={{ flexShrink: 0, padding: '15px 25px', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #222' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <Link to="/" className="back-link" style={{ color: '#555', transition: '0.3s' }}><ArrowLeft size={18} /></Link>
          <div className="module-title-group" style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <Truck className="text-secondary" size={24} style={{ color: '#ff9000' }} />
            <h1 className="hide-mobile" style={{ margin: 0, fontSize: '1.2rem', fontWeight: 950, letterSpacing: '-0.02em' }}>{isProcurementOnly ? 'Постачання' : 'Склад Виробництва'}</h1>
            <h1 className="mobile-only" style={{ margin: 0, fontSize: '1rem', fontWeight: 950 }}>{isProcurementOnly ? 'ПОСТАЧАННЯ' : 'СКЛАД ВИРОБНИЦТВА'}</h1>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div className="hide-mobile" style={{ color: '#555', fontSize: '0.75rem', fontWeight: 600 }}>
             {currentUser?.first_name} {currentUser?.last_name}
          </div>
          {!isProcurementOnly && (
            <button
              onClick={() => setShowReception(!showReception)}
              style={{
                background: showReception ? '#3b82f6' : '#1a1a1a',
                color: '#fff',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '12px',
                fontSize: '0.8rem',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                position: 'relative'
              }}
            >
              <Truck size={16} /> ПРИЙОМКА
              {incomingReceptionCount > 0 && (
                <span style={{ 
                  position: 'absolute', top: '-10px', right: '-10px',
                  background: '#ef4444', color: '#fff', fontSize: '0.6rem',
                  width: '20px', height: '20px', borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 900, border: '2px solid #111'
                }}>
                  {incomingReceptionCount}
                </span>
              )}
            </button>
          )}
          {!showCreate && (
            <button
              onClick={() => setShowCreate(true)}
              className="hide-mobile"
              style={{ background: '#ff9000', color: '#000', border: 'none', padding: '10px 22px', borderRadius: '12px', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem' }}
            >
              <Plus size={20} /> НОВА ПРИЙОМКА
            </button>
          )}
        </div>
      </nav>

      <div className="module-content" style={{ padding: '25px', overflowY: 'auto', flex: 1 }}>
        
        {/* RECEPTION DRAWER */}
        {!isProcurementOnly && showReception && (
          <div className="content-card glass-panel" style={{ background: '#111', border: '1px solid #333', borderRadius: '24px', padding: '25px', marginBottom: '30px' }}>
            <h3 style={{ fontSize: '0.85rem', color: '#3b82f6', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Truck size={18} /> ОЧІКУЮТЬ ПРИЙОМКИ НА СВ
            </h3>
            <div style={{ display: 'flex', gap: '20px', overflowX: 'auto', paddingBottom: '10px' }}>
              {(receptionDocs || [])
                .filter(d => (d.status === 'shipped' || d.status === 'ordered') && (!d.target_warehouse || d.target_warehouse === 'production'))
                .map(doc => (
                  <div key={doc.id} style={{ minWidth: '350px', background: '#0a0a0a', border: '1px solid #222', padding: '20px', borderRadius: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
                      <span style={{ fontSize: '0.8rem', color: '#555' }}>Документ #{doc.id.slice(0, 8)}</span>
                      <button 
                        onClick={() => confirmReception(doc.id)}
                        style={{ background: '#10b981', color: '#fff', border: 'none', padding: '8px 15px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 900 }}
                      >
                        ПРИЙНЯТИ НА СКЛАД
                      </button>
                    </div>
                    <div style={{ fontSize: '0.85rem' }}>
                      {(doc.items || []).map((it, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0' }}>
                          <span style={{ color: '#aaa' }}>{resolveItemName(it, i)}</span>
                          <strong style={{ color: '#10b981' }}>{resolveItemQty(it)}</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              {(receptionDocs || []).filter(d => (d.status === 'shipped' || d.status === 'ordered') && (!d.target_warehouse || d.target_warehouse === 'production')).length === 0 && (
                <p style={{ color: '#444', fontSize: '0.8rem', padding: '20px' }}>Немає активних документів на прийомку для цього складу</p>
              )}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="supply-tabs" style={{ display: 'flex', background: '#111', padding: '5px', borderRadius: '14px', marginBottom: '25px', maxWidth: '600px' }}>
          <button onClick={() => { setActiveTab('requests'); setActiveMobileSection('requests'); setShowCreate(false) }} className={`tab-btn-m ${activeTab === 'requests' && !showCreate ? 'active' : ''}`}>ЗАПИТИ ({pendingRequests.length})</button>
          <button onClick={() => { setActiveTab('registry'); setActiveMobileSection('registry'); setShowCreate(false) }} className={`tab-btn-m ${activeTab === 'registry' && !showCreate ? 'active' : ''}`}>РЕЄСТР</button>
          {!isProcurementOnly && <button onClick={() => { setActiveTab('stock'); setActiveMobileSection('stock'); setShowCreate(false) }} className={`tab-btn-m ${activeTab === 'stock' && !showCreate ? 'active' : ''}`}>ЗАЛИШКИ</button>}
          <button onClick={() => { setShowCreate(true); setActiveMobileSection('create'); setActiveTab('create') }} className={`tab-btn-m ${showCreate ? 'active' : ''}`}>+ НОВИЙ</button>
        </div>

        <div className="supply-main-layout" style={{ display: 'grid', gridTemplateColumns: (showCreate || activeTab === 'stock') ? '1fr' : 'repeat(auto-fit, minmax(400px, 1fr))', gap: '30px' }}>

          {/* CREATE PANEL */}
          {(showCreate || activeMobileSection === 'create') && (
            <section className="create-panel glass-panel" style={{ background: '#111', borderRadius: '24px', border: '1px solid #222', padding: '35px', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '35px', alignItems: 'center' }}>
                <div>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: 950, color: '#ff9000', margin: 0, letterSpacing: '-0.02em' }}>СФОРМУВАТИ ПРИЙОМКУ</h2>
                  <p style={{ color: '#555', fontSize: '0.9rem', margin: '8px 0 0' }}>Оберіть товар та вкажіть кількість для передачі на склад</p>
                </div>
                <button onClick={() => { setShowCreate(false); setActiveMobileSection('registry') }} style={{ background: '#222', border: 'none', color: '#888', cursor: 'pointer', width: '45px', height: '45px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={24} /></button>
              </div>

              <div className="creation-flow" style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 65px', gap: '15px' }} className="mobile-stack">
                  <div style={{ position: 'relative' }}>
                    <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 900, color: '#444', marginBottom: '10px', textTransform: 'uppercase' }}>Номенклатура</label>
                    <input
                      list="noms-list"
                      style={{ width: '100%', background: '#000', border: '1px solid #333', color: '#fff', padding: '18px', borderRadius: '15px', fontSize: '1.1rem' }}
                      placeholder="Пошук товару..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                    />
                    <datalist id="noms-list">
                      {availableNoms.map(n => <option key={n.id} value={getNomLabel(n)} />)}
                    </datalist>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 900, color: '#444', marginBottom: '10px', textTransform: 'uppercase' }}>Кількість</label>
                    <input
                      type="number"
                      style={{ width: '100%', background: '#000', border: '1px solid #333', color: '#fff', padding: '18px', borderRadius: '15px', textAlign: 'center', fontSize: '1.1rem', fontWeight: 700 }}
                      placeholder="0"
                      value={selectedQty}
                      onChange={e => setSelectedQty(e.target.value)}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                    <button onClick={addToDraft} style={{ height: '62px', width: '100%', background: '#ff9000', color: '#000', border: 'none', borderRadius: '15px', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Plus size={28} /></button>
                  </div>
                </div>

                <div className="draft-preview" style={{ background: 'rgba(0,0,0,0.3)', padding: '25px', borderRadius: '24px', minHeight: '150px', border: '1px solid #1a1a1a' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 900, color: '#444', marginBottom: '20px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>СПИСОК ДО ПРИЙОМКИ ({draftItems.length})</div>
                  {draftItems.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 0', color: '#333' }}>
                      <Package size={40} style={{ marginBottom: '15px', opacity: 0.1 }} />
                      <p style={{ fontSize: '0.9rem' }}>Додайте товари вище</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {draftItems.map((it, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '15px 20px', background: '#0a0a0a', borderRadius: '15px', border: '1px solid #222' }}>
                          <span style={{ fontSize: '1rem', fontWeight: 700 }}>{it.name}</span>
                          <div style={{ display: 'flex', gap: '25px', alignItems: 'center' }}>
                            <strong style={{ color: '#ff9000', fontSize: '1.25rem', fontWeight: 950 }}>{it.qty}</strong>
                            <button onClick={() => setDraftItems(draftItems.filter((_, i) => i !== idx))} style={{ color: '#444', border: 'none', background: 'transparent', cursor: 'pointer', padding: '5px' }}><X size={20} /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {draftItems.length > 0 && (
                  <button onClick={handleSendToWarehouse} style={{ width: '100%', padding: '22px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '20px', fontWeight: 950, cursor: 'pointer', fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px', marginTop: '15px', boxShadow: '0 15px 30px rgba(16, 185, 129, 0.2)' }}>
                    <Send size={22} /> СФОРМУВАТИ ДОКУМЕНТ ТА ПЕРЕДАТИ
                  </button>
                )}
              </div>
            </section>
          )}

          {/* REQUESTS COLUMN */}
          {!showCreate && (activeTab === 'requests') && (
            <section className="requests-col">
              <h3 style={{ fontSize: '0.85rem', color: '#555', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <AlertTriangle size={18} className="text-secondary" /> ДЕФІЦИТ ТА ЗАПИТИ
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                {pendingRequests.map(pr => (
                  <div key={pr.id} className="request-card" style={{ background: '#111', padding: '25px', borderRadius: '24px', border: '1px solid #222', borderLeft: pr.status === 'accepted' ? '4px solid #3b82f6' : '4px solid #ef4444' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
                      <strong style={pr.status === 'accepted' ? { color: '#3b82f6', fontSize: '1rem' } : { color: '#ef4444', fontSize: '1rem' }}>
                        НАРЯД #{pr.order_num}
                      </strong>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {pr.items && (
                          (() => {
                            const hasDeficit = pr.items.some(it => {
                              const name = resolveItemName(it, 0)
                              const parsedName = parseMaterialName(name)
                              const invItem = (inventory || []).find(i =>
                                i.warehouse === 'production' &&
                                (i.id === it.inventory_id || normalize(i.name) === normalize(parsedName))
                              )
                              const available = invItem ? (Number(invItem.total_qty) || 0) - (Number(invItem.reserved_qty) || 0) : 0
                              return available < Number(resolveItemQty(it))
                            })

                            const currentTaskId = pr.task_id || `order-${pr.order_id}`
                            const hasActivePRForProcurement = (purchaseRequests || []).some(
                              r => (r.task_id ? String(r.task_id) === String(currentTaskId) : String(r.order_id) === String(pr.order_id)) && 
                              r.destination_warehouse === 'procurement' && 
                              (r.status === 'pending' || r.status === 'accepted' || r.status === 'ordered')
                            )

                            return (
                              <div style={{ display: 'flex', gap: '8px' }}>
                                {pr.status === 'pending' && isProcurementOnly && (
                                  <button onClick={() => updatePurchaseRequestStatus(pr.id, 'accepted', 'procurement')} style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '8px 15px', borderRadius: '10px', fontSize: '0.7rem', fontWeight: 900 }}>
                                    ПРИЙНЯТИ
                                  </button>
                                )}
                                {(pr.status === 'accepted' || (pr.status === 'pending' && !isProcurementOnly)) && (
                                  <button
                                    onClick={() => apiService.submitConvertRequestToOrder(pr.id, convertRequestToOrder)}
                                    disabled={(!isProcurementOnly && hasDeficit) || pr.status === 'ordered'}
                                    style={{ 
                                      background: ((!isProcurementOnly && hasDeficit) || pr.status === 'ordered') ? '#1a1a1a' : '#3b82f622', 
                                      color: ((!isProcurementOnly && hasDeficit) || pr.status === 'ordered') ? '#444' : '#3b82f6', 
                                      border: '1px solid #3b82f644', 
                                      padding: '8px 15px', 
                                      borderRadius: '10px', 
                                      fontSize: '0.7rem', 
                                      fontWeight: 900,
                                      cursor: ((!isProcurementOnly && hasDeficit) || pr.status === 'ordered') ? 'not-allowed' : 'pointer',
                                      opacity: ((!isProcurementOnly && hasDeficit) || pr.status === 'ordered') ? 0.5 : 1
                                    }}
                                  >
                                    {pr.status === 'ordered' ? 'ЗАМОВЛЕНО' : (isProcurementOnly ? 'СФОРМУВАТИ ПОСТАВКУ НА СВ' : 'СФОРМУВАТИ ПОСТАВКУ')}
                                  </button>
                                )}
                                {!isProcurementOnly && (pr.status === 'pending' || pr.status === 'accepted') && (
                                   <button 
                                     disabled={hasActivePRForProcurement}
                                     onClick={() => handleForwardToProcurement(pr)} 
                                     style={{ 
                                       background: (hasDeficit && !hasActivePRForProcurement) ? '#ef4444' : '#1a1a1a', 
                                       color: (hasDeficit && !hasActivePRForProcurement) ? '#fff' : '#444', 
                                       border: '1px solid #ef444444', 
                                       padding: '8px 15px', 
                                       borderRadius: '10px', 
                                       fontSize: '0.7rem', 
                                       fontWeight: 950,
                                       cursor: hasActivePRForProcurement ? 'not-allowed' : 'pointer'
                                     }}
                                   >
                                      {hasActivePRForProcurement ? 'ОЧІКУЄ ЗАКУПІВЛІ' : 'ЗАКУПИТИ'}
                                   </button>
                                )}
                              </div>
                            )
                          })()
                        )}
                      </div>
                    </div>
                    <div style={{ fontSize: '0.9rem', color: '#888' }}>
                      {(pr.items || []).map((it, idx) => {
                        const name = resolveItemName(it, idx)
                        const parsedName = parseMaterialName(name)
                        const invItem = (inventory || []).find(i =>
                          i.warehouse === 'production' &&
                          (i.id === it.inventory_id || normalize(i.name) === normalize(parsedName))
                        )
                        const available = invItem ? (Number(invItem.total_qty) || 0) - (Number(invItem.reserved_qty) || 0) : 0
                        const needed = Number(resolveItemQty(it))
                        const isDeficit = !isProcurementOnly && (available < needed)

                        return (
                          <div key={idx} style={{ padding: '8px 0', borderBottom: '1px solid #1a1a1a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: isDeficit ? '#ef4444' : '#888' }}>{name}</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              {!isProcurementOnly && (
                                <span style={{ fontSize: '0.65rem', color: isDeficit ? '#ef4444' : '#10b981', fontWeight: 800 }}>
                                  ({available} в наявності)
                                </span>
                              )}
                              <strong style={{ color: isDeficit ? '#ef4444' : '#fff' }}>{needed}</strong>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
                {pendingRequests.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '60px', color: '#333', fontSize: '0.85rem' }}>Активних дефіцитів не зафіксовано</div>
                )}
              </div>
            </section>
          )}

          {/* REGISTRY COLUMN */}
          {!showCreate && (activeTab === 'registry') && (
            <section className="registry-col">
              <h3 style={{ fontSize: '0.85rem', color: '#555', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <History size={18} className="text-secondary" /> РЕЄСТР ПОСТАВОК
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {(receptionDocs || []).map(doc => (
                  <div key={doc.id} className="doc-card" style={{ background: '#111', borderRadius: '20px', border: '1px solid #222', overflow: 'hidden' }}>
                    <div
                      onClick={() => setExpandedDoc(expandedDoc === doc.id ? null : doc.id)}
                      style={{ padding: '20px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                    >
                      <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                        <div style={{ background: '#0a0a0a', padding: '12px', borderRadius: '12px', color: doc.status === 'completed' ? '#10b981' : '#ff9000' }}>
                          <Package size={20} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>#{String(doc.id).substring(0, 6)}</div>
                          <div style={{ fontSize: '0.65rem', color: '#444' }}>{new Date(doc.created_at).toLocaleDateString()}</div>
                        </div>
                      </div>
                      <div className={`status-pill ${doc.status}`} style={{ fontSize: '0.6rem', fontWeight: 900, textTransform: 'uppercase', padding: '5px 10px', borderRadius: '20px' }}>
                        {getStatusLabel(doc.status)}
                      </div>
                    </div>

                    {expandedDoc === doc.id && (
                      <div style={{ padding: '20px', background: '#0a0a0a', borderTop: '1px solid #222' }}>
                        <div style={{ marginBottom: '15px' }}>
                          {(doc.items || []).map((it, idx) => {
                            const itemName = resolveItemName(it, idx)
                            const itemQty = resolveItemQty(it)
                            return (
                              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #111' }}>
                                <span style={{ fontSize: '0.8rem', color: '#888' }}>{itemName}</span>
                                <strong style={{ fontSize: '0.8rem', color: '#fff' }}>{itemQty}</strong>
                              </div>
                            )
                          })}
                        </div>

                        {doc.status === 'shipped' && !isProcurementOnly && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              apiService.submitConfirmReception(doc.id, () => confirmReception(doc.id, 'production'))
                            }}
                            style={{ width: '100%', padding: '12px', background: '#10b981', color: '#000', border: 'none', borderRadius: '10px', fontWeight: 900, fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
                          >
                            <CheckCircle size={16} /> ПРИЙНЯТИ НА СКЛАД
                          </button>
                        )}

                        {doc.status === 'ordered' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              apiService.submitSendDocToWarehouse(doc.id, sendDocToWarehouse)
                            }}
                            style={{ width: '100%', padding: '12px', background: '#0ea5e9', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 900, fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
                          >
                            <Warehouse size={16} /> {isProcurementOnly ? 'ВІДПРАВИТИ У ВИРОБНИЦТВО' : 'ПЕРЕДАТИ В ЦЕХ'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                {(receptionDocs || []).length === 0 && (
                  <div style={{ textAlign: 'center', padding: '60px', color: '#333', fontSize: '0.85rem' }}>Історія поставок порожня</div>
                )}
              </div>
            </section>
          )}

          {/* STOCK COLUMN */}
          {!showCreate && activeTab === 'stock' && (
            <section className="stock-col glass-panel" style={{ background: '#111', padding: '25px', borderRadius: '24px', border: '1px solid #222' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 900, margin: 0 }}>СКЛАДСЬКІ ЗАЛИШКИ</h3>
                <div style={{ position: 'relative' }}>
                  <input
                    style={{ background: '#000', border: '1px solid #222', padding: '8px 15px', borderRadius: '10px', color: '#fff', width: '200px' }}
                    placeholder="Пошук..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
              <div className="table-responsive-container">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #222', textAlign: 'left' }}>
                      <th style={{ padding: '15px', fontSize: '0.7rem', color: '#555' }}>НАЙМЕНУВАННЯ</th>
                      <th style={{ padding: '15px', fontSize: '0.7rem', color: '#555', textAlign: 'center' }}>НАЯВНІСТЬ</th>
                      <th style={{ padding: '15px', fontSize: '0.7rem', color: '#555', textAlign: 'center' }}>РЕЗЕРВ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(inventory || [])
                      .filter(i => (i.name || '').toLowerCase().includes(searchQuery.toLowerCase()) && 
                                   i.type !== 'finished' && i.type !== 'product' && 
                                   i.warehouse === (isProcurementOnly ? 'procurement' : 'production'))
                      .map(item => (
                        <tr key={item.id} style={{ borderBottom: '1px solid #151515' }}>
                          <td style={{ padding: '15px', fontWeight: 700 }}>{item.name}</td>
                          <td style={{ padding: '15px', textAlign: 'center', color: '#ff9000', fontWeight: 900 }}>
                            {item.total_qty || 0} <small style={{ color: '#444' }}>{item.unit}</small>
                          </td>
                          <td style={{ padding: '15px', textAlign: 'center', color: Number(item.reserved_qty) > 0 ? '#3b82f6' : '#222', fontWeight: 800 }}>
                            {item.reserved_qty || 0}
                          </td>
                        </tr>
                      ))
                    }
                  </tbody>
                </table>
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
        .status-pill.shipped { background: rgba(139,92,246,0.1); color: #8b5cf6; }
        @media (max-width: 768px) { .hide-mobile { display: none !important; } .mobile-stack { grid-template-columns: 1fr !important; } }
        @media (min-width: 769px) { .mobile-only { display: none !important; } }
      `}} />
    </div>
  )
}

export default SupplyModule
