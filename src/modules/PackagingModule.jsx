import React, { useState, useMemo } from 'react'
import { Package, ArrowLeft, ClipboardList, CheckCircle2, Box, Send, AlertCircle, Wrench, FileArchive, Zap } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useMES } from '../MESContext'

const PackagingModule = () => {
  const { orders, nomenclatures, bomItems, submitPickingRequest, completePackaging, requests } = useMES()
  const [selectedOrder, setSelectedOrder] = useState(null)

  // Requests related to the selected order
  const { orderRequests, completedRequestsCount, isReadyToFinalize, hasAnyRequests } = useMemo(() => {
    if (!selectedOrder) return { orderRequests: [], completedRequestsCount: 0, isReadyToFinalize: false, hasAnyRequests: false }
    const relevant = (requests || []).filter(r => r.order_id === selectedOrder.id)
    
    // ПРОВІРКА: чи кожна позиція з BOM покрита підтвердженим запитом?
    const confirmedNoms = new Set(
      relevant
        .filter(r => r.status === 'completed' || r.status === 'issued')
        .map(r => String(r.nomenclature_id))
    )

    // Складаємо список всіх BOM номенклатур
    const bomNoms = []
    selectedOrder.order_items?.forEach(item => {
      const parentBOM = bomItems.filter(b => String(b.parent_id) === String(item.nomenclature_id))
      parentBOM.forEach(b => bomNoms.push(String(b.child_id)))
    })

    const is100PercentCovered = bomNoms.length > 0 && bomNoms.every(id => confirmedNoms.has(id))
    const completedCount = relevant.filter(r => r.status === 'completed' || r.status === 'issued').length

    return {
      orderRequests: relevant,
      completedRequestsCount: completedCount,
      isReadyToFinalize: is100PercentCovered,
      hasAnyRequests: relevant.length > 0
    }
  }, [selectedOrder, requests, bomItems])

  // Oreders that are ready for packaging
  const packableOrders = orders.filter(o => o.status === 'in-progress' || o.status === 'completed')

  // Derive the complete required materials (BOM) for the selected order
  const { requiredBOM, hasBOM } = useMemo(() => {
    if (!selectedOrder || !selectedOrder.order_items) return { requiredBOM: [], hasBOM: false }

    const map = {}
    let foundAnyBom = false

    selectedOrder.order_items.forEach(item => {
      const parentBOM = bomItems.filter(b => String(b.parent_id) === String(item.nomenclature_id))
      // parentBOM is what this item is made of
      if (parentBOM.length > 0) foundAnyBom = true

      parentBOM.forEach(b => {
        const nom = nomenclatures.find(n => String(n.id) === String(b.child_id))
        if (nom) {
          const totalQty = Number(b.quantity_per_parent) * Number(item.quantity)
          if (!map[nom.id]) {
            map[nom.id] = { nom, qty: 0 }
          }
          map[nom.id].qty += totalQty
        }
      })
    })

    return { requiredBOM: Object.values(map), hasBOM: foundAnyBom }
  }, [selectedOrder, bomItems, nomenclatures])

  const handleCreateRequest = async () => {
    if (!hasBOM || requiredBOM.length === 0) {
      alert("Не знайдено BOM (комплектуючих) для цього замовлення. Воно пусте!")
      return
    }

    if (hasAnyRequests) {
      if (!window.confirm("Для цього замовлення вже існують запити. Створити нові?")) return
    }

    const itemsToRequest = requiredBOM.map(r => ({ nomId: r.nom.id, name: r.nom.name, qty: r.qty }))

    try {
      await submitPickingRequest(selectedOrder.id, itemsToRequest)
      alert("Запит успішно відправлено на склад СГП!")
    } catch (e) {
      console.error(e)
      alert("Помилка створення запиту")
    }
  }

  const handleComplete = async () => {
    if (!isReadyToFinalize) {
      alert("Склад ще не підтвердив видачу всіх матеріалів!")
      return
    }
    if (!window.confirm("Підтвердити: все ЗІБРАНО, ЗАПАКОВАНО і готово до відвантаження?")) return
    try {
      await completePackaging(selectedOrder.id)
      setSelectedOrder(null)
    } catch (e) {
      console.error(e)
      alert("Помилка при закритті пакування")
    }
  }

  // Type grouping helpers
  const getIconForType = (type) => {
    if (!type) return <Box size={16} />
    if (type.toLowerCase().includes('картон') || type.toLowerCase().includes('паков')) return <FileArchive size={16} color="#eab308" />
    if (type.toLowerCase().includes('метиз') || type.toLowerCase().includes('фурнітура')) return <Wrench size={16} color="#06b6d4" />
    return <Zap size={16} color="#8b5cf6" />
  }

  return (
    <div className="packaging-module" style={{ background: '#050505', minHeight: '100vh', color: '#fff', display: 'flex', flexDirection: 'column' }}>
      
      <nav className="module-nav" style={{ flexShrink: 0, padding: '0 20px', height: '70px', background: '#0a0a0a', borderBottom: '1px solid #1a1a1a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <Link to="/" style={{ color: '#555', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
            <ArrowLeft size={18} /> <span className="hide-mobile">На головну</span>
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Package size={24} color="#f43f5e" />
            <h1 style={{ fontSize: '1rem', fontWeight: 900, textTransform: 'uppercase', margin: 0, letterSpacing: '1px' }}>МОДУЛь ПАКУВАННЯ</h1>
          </div>
        </div>
      </nav>

      <div className="module-content" style={{ padding: '30px', flex: 1, overflowY: 'auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 400px) 1fr', gap: '30px', maxWidth: '1400px', margin: '0 auto' }}>
          
          <div className="orders-sidebar glass-panel" style={{ background: '#0a0a0a', padding: '25px', borderRadius: '24px', border: '1px solid #1a1a1a' }}>
            <h3 style={{ margin: '0 0 25px 0', fontSize: '1.2rem', color: '#f43f5e', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 900 }}>
              <ClipboardList size={22} /> Черга (До пакування)
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: 'calc(100vh - 200px)', overflowY: 'auto', paddingRight: '5px' }}>
              {packableOrders.map(order => (
                <div 
                  key={order.id} 
                  onClick={() => setSelectedOrder(order)}
                  className="pack-order-card"
                  style={{ 
                    padding: '20px', 
                    background: selectedOrder?.id === order.id ? '#f43f5e15' : '#111', 
                    border: `1px solid ${selectedOrder?.id === order.id ? '#f43f5e' : '#222'}`, 
                    borderRadius: '16px', 
                    cursor: 'pointer',
                    transition: '0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div style={{ fontSize: '1.2rem', fontWeight: 950, letterSpacing: '-0.5px' }}>№ {order.order_num}</div>
                    <span style={{ fontSize: '0.65rem', background: '#222', padding: '4px 8px', borderRadius: '6px', color: '#aaa', fontWeight: 800 }}>{order.status.toUpperCase()}</span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#777', fontWeight: 500 }}>{order.customer}</div>
                  
                  {selectedOrder?.id === order.id && <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px', background: '#f43f5e' }}></div>}
                </div>
              ))}
              {packableOrders.length === 0 && (
                <div style={{ padding: '50px 20px', textAlign: 'center', color: '#444', border: '2px dashed #1a1a1a', borderRadius: '16px', fontSize: '0.9rem' }}>
                  <Package size={40} style={{ opacity: 0.2, margin: '0 auto 15px' }} />
                  Усі замовлення запаковано.
                </div>
              )}
            </div>
          </div>

          <div className="order-details-area">
            {selectedOrder ? (
              <div className="glass-panel" style={{ background: '#0a0a0a', padding: '40px', borderRadius: '32px', border: '1px solid #1a1a1a', display: 'flex', flexDirection: 'column', height: '100%' }}>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '30px' }}>
                   <div>
                     <h2 style={{ margin: '0 0 10px 0', fontSize: '2.5rem', fontWeight: 950, color: '#f43f5e', letterSpacing: '-1px' }}>Замовлення № {selectedOrder.order_num}</h2>
                     <p style={{ margin: 0, color: '#777', fontSize: '1rem' }}>Клієнт: <strong style={{ color: '#fff' }}>{selectedOrder.customer}</strong></p>
                   </div>
                   <div style={{ textAlign: 'right' }}>
                     <div style={{ fontSize: '0.75rem', color: '#555', textTransform: 'uppercase', fontWeight: 800, marginBottom: '5px' }}>Виробів у замовленні</div>
                     <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#10b981' }}>{selectedOrder.order_items?.reduce((acc, it) => acc + Number(it.quantity), 0)} шт</div>
                   </div>
                </div>

                <div style={{ background: '#111', borderRadius: '24px', padding: '30px', flex: 1, border: '1px solid #1a1a1a', marginBottom: '30px' }}>
                  <h4 style={{ margin: '0 0 20px 0', fontSize: '1rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Box size={20} color="#f43f5e" /> ПОВНА СПЕЦИФІКАЦІЯ (BOM) ДО ПАКУВАННЯ:
                  </h4>
                  
                  {!hasBOM ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: '#f59e0b', background: '#f59e0b10', borderRadius: '16px', border: '1px dashed #f59e0b30' }}>
                      <AlertCircle size={32} style={{ margin: '0 auto 10px' }} />
                      У цього замовлення немає заповненого BOM.<br/>Додайте BOM у розділі "Специфікації", щоб програма могла розрахувати потребу.
                    </div>
                  ) : (
                    <div className="bom-required-list" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {requiredBOM.map((req, idx) => {
                        const reqRequest = orderRequests.find(r => String(r.nomenclature_id) === String(req.nom.id))
                        const isPicked = reqRequest?.status === 'completed' || reqRequest?.status === 'issued'
                        const isPending = reqRequest?.status === 'pending'

                        return (
                          <div key={idx} style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center', 
                            background: isPicked ? '#10b98108' : (isPending ? '#eab30808' : '#0a0a0a'), 
                            padding: '15px 20px', 
                            borderRadius: '16px', 
                            border: `1px solid ${isPicked ? '#10b98130' : (isPending ? '#eab30830' : '#222')}`,
                            transition: '0.3s'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                              <div style={{ background: '#1a1a1a', padding: '10px', borderRadius: '12px' }}>
                                {getIconForType(req.nom.type || req.nom.material_type)}
                              </div>
                              <div>
                                <div style={{ fontSize: '1rem', fontWeight: 800, color: isPicked ? '#10b981' : (isPending ? '#eab308' : '#fff') }}>
                                  {req.nom.name}
                                  {isPicked && <CheckCircle2 size={14} style={{ marginLeft: '8px', verticalAlign: 'middle' }} />}
                                  {isPending && <Zap size={14} style={{ marginLeft: '8px', verticalAlign: 'middle' }} />}
                                </div>
                                <div style={{ fontSize: '0.7rem', color: isPicked ? '#10b98177' : (isPending ? '#eab30877' : '#666'), marginTop: '4px', textTransform: 'uppercase' }}>
                                  {req.nom.type || 'Комплектуючі'} — {isPicked ? 'ПІДТВЕРДЖЕНО' : (isPending ? 'ЗАПИТ В ПРОЦЕСІ' : 'ОЧІКУЄ ЗАПИТ')}
                                </div>
                              </div>
                            </div>
                            <div style={{ fontSize: '1.4rem', fontWeight: 950, color: isPicked ? '#10b981' : (isPending ? '#eab308' : '#f43f5e') }}>
                              {req.qty} <small style={{ fontSize: '0.8rem', color: '#888' }}>{req.nom.unit || 'шт'}</small>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* PROGRESS INDICATOR */}
                {hasAnyRequests && !isReadyToFinalize && (
                  <div style={{ 
                    padding: '15px 25px', 
                    background: '#eab30810', 
                    border: '1px solid #eab30833', 
                    borderRadius: '16px', 
                    marginBottom: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    color: '#eab308'
                  }}>
                    <AlertCircle size={20} />
                    <div style={{ fontSize: '0.9rem', fontWeight: 800 }}>
                      Очікуємо підтвердження складу: підготовлено {completedRequestsCount} з {orderRequests.length} позицій.
                    </div>
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                  <button 
                    onClick={handleCreateRequest}
                    disabled={!hasBOM}
                    style={{ padding: '20px', background: hasBOM ? '#222' : '#111', color: hasBOM ? '#fff' : '#444', border: '1px solid #333', borderRadius: '16px', fontWeight: 900, cursor: hasBOM ? 'pointer' : 'not-allowed', transition: '0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', fontSize: '0.9rem' }}
                  >
                    <Send size={20} color={hasBOM ? "#3b82f6" : "#444"} /> {hasAnyRequests ? 'ОНОВИТИ ЗАПИТ НА СКЛАД' : '1. ПОДАТИ ЗАПИТ НА СКЛАД'}
                  </button>

                  <button 
                    onClick={handleComplete}
                    disabled={!isReadyToFinalize}
                    style={{ 
                      padding: '20px', 
                      background: isReadyToFinalize ? '#10b981' : '#111', 
                      color: isReadyToFinalize ? '#fff' : '#444', 
                      border: 'none', 
                      borderRadius: '16px', 
                      fontWeight: 900, 
                      cursor: isReadyToFinalize ? 'pointer' : 'not-allowed', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      gap: '10px', 
                      fontSize: '0.9rem', 
                      boxShadow: isReadyToFinalize ? '0 10px 30px rgba(16,185,129,0.2)' : 'none',
                      opacity: isReadyToFinalize ? 1 : 0.5
                    }}
                  >
                    <CheckCircle2 size={24} /> 2. ПАКУВАННЯ ЗАВЕРШЕНО
                  </button>
                </div>

              </div>
            ) : (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px dashed #1a1a1a', borderRadius: '32px' }}>
                <div style={{ textAlign: 'center', color: '#444' }}>
                  <Package size={64} style={{ opacity: 0.1, margin: '0 auto 20px' }} />
                  <h3 style={{ margin: 0, fontWeight: 800 }}>Оберіть замовлення з черги</h3>
                  <p style={{ margin: '10px 0 0 0', fontSize: '0.85rem' }}>Щоб переглянути специфікацію та запакувати</p>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
      
      <style dangerouslySetInnerHTML={{ __html: `
        .pack-order-card:hover { transform: translateY(-3px); border-color: #f43f5e; box-shadow: 0 10px 20px rgba(0,0,0,0.5); }
        ::-webkit-scrollbar { width: 8px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #222; border-radius: 4px; }
        @media (max-width: 900px) {
          .packaging-module .module-content > div { grid-template-columns: 1fr !important; }
          .order-details-area { min-height: 600px; }
        }
      `}} />
    </div>
  )
}

export default PackagingModule
