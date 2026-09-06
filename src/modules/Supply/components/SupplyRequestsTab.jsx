import React from 'react'
import { CheckCircle, AlertTriangle, Trash2 } from 'lucide-react'
import { apiService } from '../../../services/apiDispatcher'
import { resolveItemName, parseMaterialName, resolveItemQty } from '../utils/supplyHelpers'

export const SupplyRequestsTab = ({
  isProcurementOnly,
  requestSubTab,
  setRequestSubTab,
  groupedPrepRequests = [],
  pendingRequests = [],
  isSuperAdmin,
  handleDeletePrepRequestGroup,
  handleDeletePurchaseRequest,
  nomenclatures = [],
  inventory = [],
  purchaseRequests = [],
  receptionDocs = [],
  processingDocs,
  setProcessingDocs,
  issueMaterialsBatch,
  handleRequestPrepMaterialsFromProcurement,
  updatePurchaseRequestStatus,
  convertRequestToOrder,
  handleForwardToProcurement,
  expandedPRs,
  setExpandedPRs,
  normalize
}) => {
  return (
    <section className="requests-col" style={{ gridColumn: '1 / -1', width: '100%' }}>
      {/* SUB TABS FOR MOBILE / TABLET OR QUICK FILTERING */}
      {!isProcurementOnly && (
        <div style={{
          display: 'flex',
          background: 'var(--card-bg, #161616)',
          padding: '4px',
          borderRadius: '12px',
          marginBottom: '25px',
          maxWidth: '500px',
          gap: '4px',
          border: '1px solid var(--border-color, #222)'
        }}>
          {[
            { id: 'all', label: 'Всі запити', count: groupedPrepRequests.length + pendingRequests.length },
            { id: 'prep', label: 'Підготовка', count: groupedPrepRequests.length, color: '#10b981' },
            { id: 'deficit', label: 'Наряди', count: pendingRequests.length, color: '#ef4444' }
          ].map(t => {
            const active = requestSubTab === t.id
            return (
              <button
                key={t.id}
                onClick={() => setRequestSubTab(t.id)}
                style={{
                  flex: 1,
                  background: active ? 'var(--btn-active-bg, #222)' : 'transparent',
                  border: 'none',
                  color: active ? (t.color || 'var(--text-color, #fff)') : 'var(--text-muted, #888)',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  fontSize: '0.8rem',
                  fontWeight: active ? 900 : 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'all 0.2s'
                }}
              >
                <span>{t.label}</span>
                <span style={{
                  background: active ? (t.color ? `${t.color}20` : '#333') : 'var(--badge-bg, #1e1e1e)',
                  color: active ? (t.color || 'var(--text-color, #fff)') : 'var(--text-muted, #555)',
                  padding: '2px 6px',
                  borderRadius: '6px',
                  fontSize: '0.7rem',
                  fontWeight: 900
                }}>
                  {t.count}
                </span>
              </button>
            )
          })}
        </div>
      )}

      <div style={{
        display: 'grid',
        gridTemplateColumns: (isProcurementOnly || requestSubTab !== 'all') ? '1fr' : 'repeat(auto-fit, minmax(420px, 1fr))',
        gap: '30px',
        width: '100%'
      }}>
        {/* COLUMN 1: RAW MATERIALS PREPARATION REQUESTS */}
        {!isProcurementOnly && (requestSubTab === 'all' || requestSubTab === 'prep') && (
          <div style={{
            background: 'rgba(16, 185, 129, 0.01)',
            border: '1px solid rgba(16, 185, 129, 0.1)',
            borderRadius: '24px',
            padding: '20px',
            minHeight: '400px'
          }}>
            <h3 style={{ fontSize: '0.95rem', color: '#10b981', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              <CheckCircle size={18} /> ЗАПИТИ НА ПІДГОТОВКУ СИРОВИНИ ({groupedPrepRequests.length})
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {groupedPrepRequests.map(group => {
                const task = group.task
                const prepNum = task?.plan_snapshot?._prep_num || `НП-${String(group.taskId).slice(0, 8)}`
                
                const isEnough = group.requests.every(req => {
                  const reqNom = nomenclatures?.find(n => n.id === req.nomenclature_id)
                  const reqName = reqNom?.name || req.details
                  const qty = Number(req.quantity) || 0
                  const matchingItems = (inventory || []).filter(i =>
                    i.warehouse === 'production' &&
                    (String(i.nomenclature_id) === String(req.nomenclature_id) || normalize(i.name) === normalize(reqName))
                  )
                  const totalStock = matchingItems.reduce((acc, i) => acc + (Number(i.total_qty) || 0), 0)
                  const dbReserved = matchingItems.reduce((acc, i) => acc + (Number(i.reserved_qty) || 0), 0)
                  const available = Math.max(0, totalStock - dbReserved)
                  return available >= qty
                })

                const hasActivePRForProcurement = (purchaseRequests || []).some(
                  r => String(r.task_id) === String(group.taskId) && 
                  r.destination_warehouse === 'procurement' && 
                  (r.status === 'pending' || r.status === 'accepted' || r.status === 'ordered')
                )

                return (
                  <div key={group.taskId} style={{ background: 'var(--card-bg, #0a0a0a)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '20px', borderRadius: '18px', display: 'flex', flexDirection: 'column', gap: '15px', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color, #1c1c1c)', paddingBottom: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <strong style={{ fontSize: '1rem', color: '#10b981' }}>НАРЯД № {prepNum}</strong>
                        {isSuperAdmin && (
                          <button
                            onClick={() => handleDeletePrepRequestGroup(group)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: '#ef4444',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              padding: '2px',
                              borderRadius: '4px'
                            }}
                            title="Видалити запит"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                      <span style={{ fontSize: '0.7rem', color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '4px 8px', borderRadius: '6px', fontWeight: 800 }}>
                        ПІДГОТОВКА СИРОВИНИ
                      </span>
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {group.requests.map(req => {
                        const reqNom = nomenclatures?.find(n => n.id === req.nomenclature_id)
                        const reqName = reqNom?.name || req.details
                        const qty = Number(req.quantity) || 0
                        
                        const matchingItems = (inventory || []).filter(i =>
                          i.warehouse === 'production' &&
                          (String(i.nomenclature_id) === String(req.nomenclature_id) || normalize(i.name) === normalize(reqName))
                        )
                        const totalStock = matchingItems.reduce((acc, i) => acc + (Number(i.total_qty) || 0), 0)
                        const dbReserved = matchingItems.reduce((acc, i) => acc + (Number(i.reserved_qty) || 0), 0)
                        const available = Math.max(0, totalStock - dbReserved)
                        
                        const itemEnough = available >= qty

                        return (
                          <div key={req.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--card-inner-bg, #111)', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border-color, #222)' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', textAlign: 'left' }}>
                              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-color, #eee)' }}>{reqName}</span>
                              <div style={{ textTransform: 'uppercase', fontSize: '0.7rem', color: itemEnough ? '#10b981' : '#ef4444', fontWeight: 800 }}>
                                Потрібно: {qty} шт | Наявні: {available} шт
                              </div>
                            </div>
                            {itemEnough && (
                              <button 
                                disabled={processingDocs.has(req.id)}
                                onClick={async () => {
                                  setProcessingDocs(prev => new Set(prev).add(req.id))
                                  try {
                                    await issueMaterialsBatch([req.id], group.taskId)
                                    alert(`Матеріал "${reqName}" успішно видано!`)
                                  } catch (e) {
                                    alert('Помилка: ' + e.message)
                                  } finally {
                                    setProcessingDocs(prev => { const next = new Set(prev); next.delete(req.id); return next; })
                                  }
                                }}
                                style={{
                                  background: '#10b981',
                                  color: '#000',
                                  border: 'none',
                                  padding: '6px 12px',
                                  borderRadius: '8px',
                                  fontSize: '0.7rem',
                                  fontWeight: 900,
                                  cursor: processingDocs.has(req.id) ? 'not-allowed' : 'pointer',
                                  textTransform: 'uppercase',
                                  marginLeft: '15px'
                                }}
                              >
                                {processingDocs.has(req.id) ? '...' : 'Видати'}
                              </button>
                            )}
                          </div>
                        )
                      })}
                    </div>

                    {isEnough ? (
                      <button 
                        disabled={processingDocs.has(group.taskId)}
                        onClick={async () => {
                          setProcessingDocs(prev => new Set(prev).add(group.taskId))
                          try {
                            const reqIds = group.requests.map(r => r.id)
                            await issueMaterialsBatch(reqIds, group.taskId)
                            alert('Матеріали успішно видано на Підготовку!')
                          } catch(e) {
                            alert('Помилка: ' + e.message)
                          } finally {
                            setProcessingDocs(prev => { const next = new Set(prev); next.delete(group.taskId); return next; })
                          }
                        }}
                        style={{
                          background: '#10b981',
                          color: '#000',
                          border: 'none',
                          padding: '10px 18px',
                          borderRadius: '10px',
                          fontWeight: 900,
                          cursor: processingDocs.has(group.taskId) ? 'not-allowed' : 'pointer',
                          fontSize: '0.8rem',
                          textTransform: 'uppercase',
                          alignSelf: 'flex-end',
                          marginTop: '5px'
                        }}
                      >
                        {processingDocs.has(group.taskId) ? 'ОБРОБКА...' : 'ВИДАТИ НА ПІДГОТОВКУ'}
                      </button>
                    ) : (
                      <button 
                        disabled={hasActivePRForProcurement || processingDocs.has(group.taskId)}
                        onClick={() => handleRequestPrepMaterialsFromProcurement(group)}
                        style={{
                          background: hasActivePRForProcurement ? 'var(--btn-disabled-bg, #1a1a1a)' : '#ef4444',
                          color: hasActivePRForProcurement ? 'var(--text-muted, #444)' : '#fff',
                          border: hasActivePRForProcurement ? '1px solid var(--border-color, #222)' : 'none',
                          padding: '10px 18px',
                          borderRadius: '10px',
                          fontWeight: 950,
                          cursor: (hasActivePRForProcurement || processingDocs.has(group.taskId)) ? 'not-allowed' : 'pointer',
                          fontSize: '0.8rem',
                          textTransform: 'uppercase',
                          alignSelf: 'flex-end',
                          marginTop: '5px',
                          opacity: (hasActivePRForProcurement || processingDocs.has(group.taskId)) ? 0.5 : 1
                        }}
                      >
                        {processingDocs.has(group.taskId) ? 'ОБРОБКА...' : (hasActivePRForProcurement ? 'ОЧІКУЄ ЗАКУПІВЛІ' : 'ЗАПРОСИТИ У ПОСТАЧАННЯ')}
                      </button>
                    )}
                  </div>
                )
              })}
              {groupedPrepRequests.length === 0 && (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted, #444)', fontSize: '0.85rem', background: 'var(--card-bg, #0a0a0a)', border: '1px dashed var(--border-color, #222)', borderRadius: '18px' }}>
                  Немає активних запитів від відділу підготовки
                </div>
              )}
            </div>
          </div>
        )}

        {/* COLUMN 2: DEFICIT AND WORK ORDER REQUESTS */}
        {(requestSubTab === 'all' || requestSubTab === 'deficit') && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.01)',
            border: '1px solid rgba(239, 68, 68, 0.1)',
            borderRadius: '24px',
            padding: '20px',
            minHeight: '400px'
          }}>
            <h3 style={{ fontSize: '0.95rem', color: 'var(--text-muted, #888)', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              <AlertTriangle size={18} className="text-secondary" /> ДЕФІЦИТ ТА ЗАПИТИ НА НАРИДИ ({pendingRequests.length})
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {pendingRequests.map(pr => {
                const hasDeficit = (pr.items || []).some(it => {
                  const name = resolveItemName(it, 0)
                  const parsedName = parseMaterialName(name)
                  const matchingItems = (inventory || []).filter(i =>
                    i.warehouse === 'production' &&
                    (
                      (it.nomenclature_id && String(i.nomenclature_id) === String(it.nomenclature_id)) ||
                      (it.inventory_id && String(i.id) === String(it.inventory_id)) ||
                      (normalize(i.name) === normalize(parsedName))
                    )
                  )
                  const globalAvailable = matchingItems.reduce((acc, i) => acc + (Number(i.total_qty) || 0) - (Number(i.reserved_qty) || 0), 0)
                  const alreadyReserved = Number(it.reserved_from_stock) || 0
                  const effectiveAvailable = globalAvailable + alreadyReserved
                  return effectiveAvailable < Number(resolveItemQty(it))
                })

                const currentTaskId = pr.task_id || `order-${pr.order_id}`
                const hasActivePRForProcurement = (purchaseRequests || []).some(
                  r => (r.task_id ? String(r.task_id) === String(currentTaskId) : String(r.order_id) === String(pr.order_id)) && 
                  r.destination_warehouse === 'procurement' && 
                  (r.status === 'pending' || r.status === 'accepted' || r.status === 'ordered')
                )

                const relatedReception = (receptionDocs || []).find(rd => 
                  (rd.task_id ? String(rd.task_id) === String(currentTaskId) : String(rd.order_id) === String(pr.order_id)) && 
                  (rd.status === 'ordered' || rd.status === 'shipped')
                )

                const isExpanded = expandedPRs.has(pr.id) || (!expandedPRs.has(`collapsed-${pr.id}`) && pr.status !== 'ordered' && !relatedReception)

                return (
                  <div key={pr.id} className="request-card" style={{ background: 'var(--card-bg, #0a0a0a)', padding: '20px', borderRadius: '18px', border: '1px solid var(--border-color, #222)', borderLeft: pr.status === 'accepted' ? '4px solid #3b82f6' : '4px solid #ef4444', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        <strong style={pr.status === 'accepted' ? { color: '#3b82f6', fontSize: '0.95rem' } : { color: '#ef4444', fontSize: '0.95rem' }}>
                          НАРЯД #{pr.order_num}
                        </strong>
                        {isSuperAdmin && (
                          <button
                            onClick={() => handleDeletePurchaseRequest(pr)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: '#ef4444',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              padding: '2px',
                              borderRadius: '4px'
                            }}
                            title="Видалити запит"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                        {relatedReception && (
                          <span style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '3px 8px', borderRadius: '6px', fontSize: '0.65rem', fontWeight: 900, textTransform: 'uppercase' }}>
                            Відправлено на {relatedReception.target_warehouse === 'operational' ? 'СО' : 'СВ'}
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {pr.status === 'pending' && isProcurementOnly && (
                          <button 
                            disabled={processingDocs.has(pr.id)}
                            onClick={async () => {
                              setProcessingDocs(prev => new Set(prev).add(pr.id))
                              try {
                                await updatePurchaseRequestStatus(pr.id, 'accepted', 'procurement')
                              } finally {
                                setProcessingDocs(prev => { const next = new Set(prev); next.delete(pr.id); return next; })
                              }
                            }} 
                            style={{ 
                              background: processingDocs.has(pr.id) ? '#1a1a1a' : '#3b82f6', 
                              color: processingDocs.has(pr.id) ? '#444' : '#fff', 
                              border: 'none', 
                              padding: '6px 12px', 
                              borderRadius: '8px', 
                              fontSize: '0.7rem', 
                              fontWeight: 900,
                              cursor: processingDocs.has(pr.id) ? 'not-allowed' : 'pointer'
                            }}
                          >
                            {processingDocs.has(pr.id) ? 'ОБРОБКА...' : 'ПРИЙНЯТИ'}
                          </button>
                        )}
                        {(pr.status === 'accepted' || (pr.status === 'pending' && !isProcurementOnly)) && (
                          <button
                            onClick={async () => {
                              setProcessingDocs(prev => new Set(prev).add(pr.id))
                              try {
                                await apiService.submitConvertRequestToOrder(pr.id, convertRequestToOrder)
                              } catch (err) {
                                console.error('Transfer creation error:', err)
                                alert('Не вдалося сформувати поставку на склад: ' + (err?.message || 'невідома помилка'))
                              } finally {
                                setProcessingDocs(prev => {
                                  const next = new Set(prev)
                                  next.delete(pr.id)
                                  return next
                                })
                              }
                            }}
                            disabled={(!isProcurementOnly && hasDeficit) || pr.status === 'ordered' || processingDocs.has(pr.id)}
                            style={{ 
                              background: ((!isProcurementOnly && hasDeficit) || pr.status === 'ordered' || processingDocs.has(pr.id)) ? 'var(--btn-disabled-bg, #1a1a1a)' : '#3b82f622', 
                              color: ((!isProcurementOnly && hasDeficit) || pr.status === 'ordered' || processingDocs.has(pr.id)) ? 'var(--text-muted, #444)' : '#3b82f6', 
                              border: '1px solid #3b82f644', 
                              padding: '6px 12px', 
                              borderRadius: '8px', 
                              fontSize: '0.7rem', 
                              fontWeight: 900,
                              cursor: ((!isProcurementOnly && hasDeficit) || pr.status === 'ordered' || processingDocs.has(pr.id)) ? 'not-allowed' : 'pointer',
                              opacity: ((!isProcurementOnly && hasDeficit) || pr.status === 'ordered' || processingDocs.has(pr.id)) ? 0.5 : 1
                            }}
                          >
                            {processingDocs.has(pr.id) ? 'ОБРОБКА...' : (pr.status === 'ordered' ? 'ЗАМОВЛЕНО' : (isProcurementOnly ? 'СФОРМУВАТИ ПОСТАВКУ НА СВ' : 'СФОРМУВАТИ ПОСТАВКУ'))}
                          </button>
                        )}
                        {!isProcurementOnly && (pr.status === 'pending' || pr.status === 'accepted') && (
                           <button 
                             disabled={hasActivePRForProcurement || processingDocs.has(pr.id)}
                             onClick={async (e) => {
                               e.stopPropagation()
                               if (hasDeficit && !hasActivePRForProcurement) {
                                 handleForwardToProcurement(pr)
                               } else {
                                 setProcessingDocs(prev => new Set(prev).add(pr.id))
                                 try {
                                   await apiService.submitUpdatePurchaseRequestStatus(pr.id, 'accepted', updatePurchaseRequestStatus)
                                 } finally {
                                   setProcessingDocs(prev => { const next = new Set(prev); next.delete(pr.id); return next; })
                                 }
                               }
                             }}
                             style={{ 
                               background: (hasDeficit && !hasActivePRForProcurement) ? '#ef4444' : 'var(--btn-disabled-bg, #1a1a1a)', 
                               color: (hasDeficit && !hasActivePRForProcurement) ? '#fff' : 'var(--text-muted, #444)', 
                               border: '1px solid #ef444444', 
                               padding: '6px 12px', 
                               borderRadius: '8px', 
                               fontSize: '0.7rem',
                               fontWeight: 950,
                               cursor: (hasActivePRForProcurement || processingDocs.has(pr.id)) ? 'not-allowed' : 'pointer',
                               opacity: (hasActivePRForProcurement || processingDocs.has(pr.id)) ? 0.5 : 1
                             }}
                           >
                              {processingDocs.has(pr.id) ? 'ОБРОБКА...' : (hasActivePRForProcurement ? 'ОЧІКУЄ ЗАКУПІВЛІ' : 'ЗАКУПИТИ')}
                           </button>
                        )}
                      </div>
                    </div>
                    <div 
                      onClick={() => {
                        const next = new Set(expandedPRs)
                        if (isExpanded) {
                          next.delete(pr.id)
                          next.add(`collapsed-${pr.id}`)
                        } else {
                          next.add(pr.id)
                          next.delete(`collapsed-${pr.id}`)
                        }
                        setExpandedPRs(next)
                      }}
                      style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', margin: '15px 0 10px', fontSize: '0.75rem', color: 'var(--text-muted, #555)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}
                    >
                      <span>Специфікація ({(pr.items || []).length} позицій)</span>
                      <span style={{ fontSize: '0.65rem', color: '#ff9000' }}>{isExpanded ? '▲ Приховати' : '▼ Показати список'}</span>
                    </div>

                    {isExpanded && (
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted, #888)' }}>
                        {(() => {
                          const items = pr.items || []
                          const aggregated = []
                          
                          // Розраховуємо "віртуальну броню" для відображення
                          const otherManualDocs = (receptionDocs || []).filter(d => d.status === 'ordered' && d.source_warehouse === 'production')
                          const virtualReservedMap = {}
                          otherManualDocs.forEach(d => {
                            (d.items || []).forEach(item => {
                              const k = item.nomenclature_id ? String(item.nomenclature_id) : normalize(item.name || item.reqDetails || item.details)
                              virtualReservedMap[k] = (virtualReservedMap[k] || 0) + (Number(item.qty || item.needed || item.quantity) || 0)
                            })
                          })

                          items.forEach((it, idx) => {
                            const name = resolveItemName(it, idx)
                            const parsedName = parseMaterialName(name)
                            const nomId = it.nomenclature_id
                            
                            const existing = aggregated.find(a => (a.nomenclature_id && a.nomenclature_id === nomId) || normalize(a.parsedName) === normalize(parsedName))
                            if (existing) {
                              existing.needed += Number(resolveItemQty(it)) || 0
                            } else {
                              const matchingItems = (inventory || []).filter(i =>
                                (i.warehouse === 'production' || !i.warehouse) &&
                                (
                                  (nomId && String(i.nomenclature_id) === String(nomId)) ||
                                  (normalize(i.name) === normalize(parsedName)) ||
                                  (i.name && parsedName && normalize(i.name).includes(normalize(parsedName))) ||
                                  (i.name && parsedName && normalize(parsedName).includes(normalize(i.name))) ||
                                  (it.inventory_id && String(i.id) === String(it.inventory_id))
                                )
                              )
                              const totalStock = matchingItems.reduce((acc, i) => acc + (Number(i.total_qty) || 0), 0)
                              const dbReserved = matchingItems.reduce((acc, i) => acc + (Number(i.reserved_qty) || 0), 0)
                              const vKey = it.nomenclature_id ? String(it.nomenclature_id) : normalize(parsedName)
                              const vReserved = virtualReservedMap[vKey] || 0
                              
                              const freeStock = Math.max(0, totalStock - dbReserved - vReserved)
                              const alreadyReserved = Number(it.reserved_from_stock) || 0
                              const available = freeStock + alreadyReserved
                              aggregated.push({
                                ...it,
                                name,
                                parsedName,
                                available,
                                needed: isProcurementOnly ? (Number(it.missingAmount || it.qty || it.needed) || 0) : (Number(resolveItemQty(it)) || 0)
                              })
                            }
                          })

                          return aggregated.map((it, idx) => {
                            const isDeficit = !isProcurementOnly && (it.available < it.needed)
                            return (
                              <div key={idx} style={{ padding: '8px 0', borderBottom: '1px solid var(--border-color, #1a1a1a)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ color: isDeficit ? '#ef4444' : 'var(--text-color, #aaa)' }}>{it.name}</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  {!isProcurementOnly && (
                                    <span style={{ fontSize: '0.65rem', color: isDeficit ? '#ef4444' : '#10b981', fontWeight: 800 }}>
                                      ({it.available} в наявності)
                                    </span>
                                  )}
                                  <strong style={{ color: isDeficit ? '#ef4444' : 'var(--text-color, #fff)' }}>{it.needed}</strong>
                                </div>
                              </div>
                            )
                          })
                        })()}
                      </div>
                    )}
                  </div>
                )
              })}
              {pendingRequests.length === 0 && (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted, #444)', fontSize: '0.85rem', background: 'var(--card-bg, #0a0a0a)', border: '1px dashed var(--border-color, #222)', borderRadius: '18px' }}>
                  Активних дефіцитів не зафіксовано
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
