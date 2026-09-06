import React from 'react'
import { Package, ArrowLeft, X, Clock, Calendar, Warehouse, ChevronRight, Layers } from 'lucide-react'

export const OrderDossierModal = ({
  selectedCell,
  selectedOrderId,
  setSelectedCell,
  setSelectedOrderId,
  orders,
  allOrdersMap,
  tasks,
  requests,
  workCards,
  nomenclatures,
  expandedReqs,
  toggleReq,
  expandedNaryads,
  toggleNaryad,
  parseRequestDetails,
  getStatusLabel
}) => {
  if (!selectedCell) return null

  return (
    <div className="modal-overlay" onClick={() => { setSelectedCell(null); setSelectedOrderId(null); }}>
      <div className="modal-content glass-panel-premium anim-scale-up" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="header-title">
            {selectedOrderId ? (
              <button className="btn-back-modal" onClick={() => setSelectedOrderId(null)}>
                <ArrowLeft size={16} /> <span>НАЗАД</span>
              </button>
            ) : (
              <>
                <Package className="text-orange" size={20} />
                <h4>{selectedCell.product?.name || 'Деталі осередку'}</h4>
              </>
            )}
          </div>
          <button className="btn-close" onClick={() => { setSelectedCell(null); setSelectedOrderId(null); }}><X size={20} /></button>
        </div>

        <div className="modal-body">
          {!selectedOrderId ? (
            <>
              <div className="modal-meta-row">
                <span className="date-badge">{selectedCell.day?.day} {selectedCell.day?.fullDate}</span>
                <span className="total-highlight">Всього: {selectedCell.orders?.reduce((s, o) => s + o.qty, 0)} шт</span>
              </div>
              <div className="orders-list">
                {selectedCell.orders?.map((o, idx) => (
                  <div key={idx} className="order-item-card" onClick={() => setSelectedOrderId(o.id)}>
                    <div className="order-main-info">
                      <span className="mini-num">#{o.orderNum}</span>
                      <span className="mini-cust">{o.customer}</span>
                    </div>
                    <div className="order-right-info">
                      <strong className="mini-qty">{o.qty} шт</strong>
                      <ChevronRight size={14} className="icon-arrow" />
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (() => {
            const orderData = orders.find(o => String(o.id) === String(selectedOrderId)) || allOrdersMap[selectedOrderId]
            const orderTasks = tasks.filter(t => String(t.order_id) === String(selectedOrderId))
            const orderReqs = requests.filter(r => String(r.order_id) === String(selectedOrderId))
            const orderCards = workCards.filter(c => String(c.order_id) === String(selectedOrderId))

            return (
              <div className="order-dossier-dashboard">
                <div className="dossier-main-grid">
                  {/* LEFT COLUMN: PRIMARY INFO */}
                  <div className="dossier-left">
                    <div className="dossier-card header-card">
                      <div className="dossier-header-top">
                        <div className="title-group">
                          <span className="overline">ДОСЬЄ ЗАМОВЛЕННЯ #{orderData?.order_num}</span>
                          <h2 className="customer-name">{orderData?.customer}</h2>
                        </div>
                        <div className={`status-pill status-${orderData?.status}`}>
                          {getStatusLabel(orderData?.status)}
                        </div>
                      </div>
                      <div className="header-meta">
                        <div className="meta-item">
                          <Clock size={16} />
                          <div className="meta-info">
                            <span className="m-label">СТВОРЕНО</span>
                            <span className="m-val">{orderData?.created_at ? new Date(orderData.created_at).toLocaleDateString() : '—'}</span>
                          </div>
                        </div>
                        <div className="meta-item highlight">
                          <Calendar size={16} />
                          <div className="meta-info">
                            <span className="m-label">ДЕДЛАЙН</span>
                            <span className="m-val">{orderData?.deadline ? new Date(orderData.deadline).toLocaleDateString() : '—'}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="dossier-card">
                      <h4 className="section-title"><Package size={16} /> 1. СКЛАД ЗАМОВЛЕННЯ</h4>
                      <div className="items-grid">
                        {orderData?.order_items?.map((item, id) => {
                          const nom = nomenclatures.find(n => String(n.id) === String(item.nomenclature_id))
                          return (
                            <div key={id} className="item-pill">
                              <span className="i-name">{nom?.name || 'Продукція'}</span>
                              <span className="i-qty">{item.quantity} шт</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    <div className="dossier-card">
                      <h4 className="section-title"><Warehouse size={16} /> 3. ЗАПИТИ ДЛЯ СКЛАДУ</h4>
                      <div className="requests-stack">
                        {orderReqs.length === 0 ? <div className="empty-hint">Запитів немає...</div> : (() => {
                          const groups = {}
                          orderReqs.forEach(r => {
                            const key = r.task_id || 'manual'
                            if (!groups[key]) groups[key] = []
                            groups[key].push(r)
                          })

                          return Object.entries(groups).map(([taskId, reqs]) => {
                            const firstReq = reqs[0]
                            const isPending = reqs.some(r => r.status === 'pending')
                            const task = tasks.find(t => String(t.id) === String(taskId))
                            const taskLabel = task 
                              ? `#${orderData?.order_num}${task.batch_index ? `/${task.batch_index}` : ''}`
                              : taskId
                            
                            return (
                              <div key={taskId} className={`request-bar ${isPending ? 'status-pending' : 'status-completed'}`}>
                                <div 
                                  className="r-doc-header" 
                                  style={{ cursor: 'pointer' }}
                                  onClick={() => toggleReq(taskId)}
                                >
                                  <div className="r-doc-id">ЗАЯВКА НА СКЛАД {taskId !== 'manual' ? `[НАРЯД ${taskLabel}]` : '[ВИТРАТНІ]'}</div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                    <span className={`r-pill ${isPending ? 'pending' : 'issued'}`}>{isPending ? 'В РОБОТІ' : 'ГОТОВО'}</span>
                                    {expandedReqs[taskId] ? <ChevronRight size={16} style={{ transform: 'rotate(90deg)', transition: '0.3s' }} /> : <ChevronRight size={16} style={{ transition: '0.3s' }} />}
                                  </div>
                                </div>
                                
                                {expandedReqs[taskId] && (
                                  <div className="r-doc-body anim-expand">
                                    {reqs.map((r, ri) => {
                                      const p = parseRequestDetails(r.details)
                                      return (
                                        <div key={ri} className="r-item-block" style={{ marginBottom: ri < reqs.length - 1 ? '20px' : 0 }}>
                                          <div className="r-main-row">
                                            <span className="r-mat-large">{p.material}</span>
                                            <span className="r-qty-large">{p.qty}</span>
                                          </div>
                                          
                                          {p.breakdown.length > 0 && (
                                            <div className="r-breakdown-box">
                                              {p.breakdown.map((b, bi) => (
                                                <div key={bi} className="b-row">
                                                  <span className="b-label">{b.label}</span>
                                                  <span className="b-val">{b.qty}</span>
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      )
                                    })}
                                  </div>
                                )}
                                
                                <div className="r-doc-footer">
                                  <span>ДАТА: {new Date(firstReq.created_at).toLocaleDateString()}</span>
                                  <span>КІЛЬКІСТЬ ПОЗИЦІЙ: {reqs.length}</span>
                                </div>
                              </div>
                            )
                          })
                        })()}
                      </div>
                    </div>
                  </div>

                  {/* RIGHT COLUMN: PRODUCTION STATUS */}
                  <div className="dossier-right">
                    <div className="dossier-card">
                      <h4 className="section-title"><Layers size={16} /> 2. ВИРОБНИЧІ НАРЯДИ</h4>
                      <div className="naryad-stack">
                        {orderTasks.length === 0 ? <div className="empty-hint">Наряди ще не сформовано...</div> : orderTasks.map(t => {
                          const isExpanded = expandedNaryads[t.id]
                          const snapshot = t.plan_snapshot || {}
                          const materialSummary = snapshot.materialSummary || {}
                          let materials = Object.values(materialSummary)

                          if (materials.length === 0) {
                            const snapIds = Object.keys(snapshot).filter(k => !k.startsWith('_') && k !== 'arrivals' && k !== 'materialSummary')
                            materials = snapIds.map(id => {
                              const s = snapshot[id]
                              if (!s) return null
                              return {
                                matName: s.name || 'Деталь',
                                totalUnits: s.plan || s.need || 0,
                                components: [s.code || 'Без коду']
                              }
                            }).filter(Boolean)
                          }

                          return (
                            <div key={t.id} className="naryad-row-container">
                              <div 
                                className="naryad-row" 
                                style={{ cursor: 'pointer' }}
                                onClick={() => toggleNaryad(t.id)}
                              >
                                <div className="n-left">
                                  <span className="n-date">{new Date(t.created_at).toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                                  <span className="n-info">Наряд <strong>#{orderData?.order_num}{t.batch_index ? `/${t.batch_index}` : ''}</strong> на <strong>{t.planned_sets || '—'} од.</strong></span>
                                  <span className="n-step">{t.step} | Верстат: {t.machine || '—'}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                  <div className={`n-status status-${t.status}`}>{t.status?.toUpperCase()}</div>
                                  {isExpanded ? <ChevronRight size={16} style={{ transform: 'rotate(90deg)', transition: '0.3s' }} /> : <ChevronRight size={16} style={{ transition: '0.3s' }} />}
                                </div>
                              </div>
                              
                              {isExpanded && (
                                <div className="naryad-details anim-expand">
                                  <div className="details-grid">
                                    <div className="details-col">
                                      <div className="d-label">ПЛАН МАТЕРІАЛІВ (BOM):</div>
                                      <div className="bom-list">
                                        {materials.length === 0 ? (
                                          <div className="empty-hint">Дані про матеріали відсутні</div>
                                        ) : (
                                          <>
                                            {materials.filter(m => (m.sheets || 0) > 0).length > 0 && (
                                              <div className="bom-category">
                                                <div className="cat-header">ОСНОВНІ МАТЕРІАЛИ</div>
                                                {materials.filter(m => (m.sheets || 0) > 0).map((m, mi) => (
                                                  <div key={mi} className="bom-item">
                                                    <div className="m-info">
                                                      <span className="m-name">{m.matName}</span>
                                                      <span className="m-tech highlight">
                                                        {m.sheets} л. <span className="dim">|</span> {m.totalUnits} шт
                                                      </span>
                                                    </div>
                                                    <div className="m-comps">{m.components?.join(', ')}</div>
                                                  </div>
                                                ))}
                                              </div>
                                            )}

                                            {materials.filter(m => !(m.sheets || 0)).length > 0 && (
                                              <div className="bom-category">
                                                <div className="cat-header">КОМПЛЕКТУЮЧІ ТА МЕТИЗИ</div>
                                                <div className="hardware-grid">
                                                  {materials.filter(m => !(m.sheets || 0)).map((m, mi) => (
                                                    <div key={mi} className="hw-item">
                                                      <span className="hw-name">{m.matName}</span>
                                                      <span className="hw-qty">{m.totalUnits} шт</span>
                                                    </div>
                                                  ))}
                                                </div>
                                              </div>
                                            )}
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    <div className="dossier-card flex-1">
                      <h4 className="section-title"><Clock size={16} /> 4. ПОТОЧНИЙ СТАН: АКТИВНІ КАРТКИ</h4>
                      <div className="cards-stack">
                        {orderCards.length === 0 ? <div className="empty-hint">Немає активних карток у виробництві...</div> : orderCards.map(c => {
                          const statusColors = { new: '#333', 'in-progress': '#ff9000', 'at-buffer': '#3b82f6', completed: '#10b981' }
                          return (
                            <div key={c.id} className="card-mini" style={{ borderLeft: `4px solid ${statusColors[c.status] || '#fff'}` }}>
                              <div className="c-info">
                                <div className="c-op">{c.operation}</div>
                                <div className="c-meta">{c.operator || 'Без оператора'} | {c.machine || '—'}</div>
                              </div>
                              <div className="c-qty-group">
                                <span className="c-qty">{c.quantity}</span>
                                <span className="c-status">{c.status}</span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })()}
        </div>
      </div>
    </div>
  )
}
