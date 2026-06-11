import { readFileSync, writeFileSync } from 'fs'

const filePath = 'a:/centrum/src/modules/ManagerModule.jsx'
let src = readFileSync(filePath, 'utf8')
const hasCRLF = src.includes('\r\n')
if (hasCRLF) src = src.replace(/\r\n/g, '\n')

// ── PATCH 1: Destructure deleteOrder and updateOrder from useMES ────────────
const useMESOld = `  const { nomenclatures, addOrder, orders, fetchOrders, hasMoreOrders, searchCustomers, currentUser, loading, getOrderProductionProgress, refreshTable } = useMES()`
const useMESNew = `  const { nomenclatures, addOrder, updateOrder, deleteOrder, orders, fetchOrders, hasMoreOrders, searchCustomers, currentUser, loading, getOrderProductionProgress, refreshTable } = useMES()`

if (!src.includes(useMESOld)) { console.error('useMESOld anchor not found'); process.exit(1) }
src = src.replace(useMESOld, useMESNew)
console.log('✓ useMES updated')

// ── PATCH 2: Add Edit/Delete states and actions in ManagerModule ────────────
const statesAnchor = `  const [activeTab, setActiveTab] = useState('supabase') // 'supabase' or 'rust'
  const [isRustLoading, setIsRustLoading] = useState(false)`

const statesNew = `  const [activeTab, setActiveTab] = useState('supabase') // 'supabase' or 'rust'
  const [isRustLoading, setIsRustLoading] = useState(false)

  // Edit / Edit Mode state
  const [isEditMode, setIsEditMode] = useState(false)
  const [editingOrderHeader, setEditingOrderHeader] = useState({
    customer: '',
    official_customer: '',
    nomenclature_id: '',
    quantity: 1,
    deadline: ''
  })
  
  const handleEditInit = (order) => {
    setIsEditMode(true)
    const nom = nomenclatures.find(n => n.id === order.nomenclature_id || n.accessories === order.accessories)
    setEditingOrderHeader({
      customer: order.customer || '',
      official_customer: order.official_customer || '',
      nomenclature_id: order.nomenclature_id || '',
      quantity: order.quantity || 1,
      deadline: order.deadline ? order.deadline.split('T')[0] : ''
    })
  }

  const handleUpdateSubmit = async (e) => {
    e.preventDefault()
    if (!editingOrderHeader.customer || !editingOrderHeader.nomenclature_id || !editingOrderHeader.deadline) {
      alert('Будь ласка, заповніть Замовника, оберіть Продукт та вкажіть Термін (Дедлайн)')
      return
    }

    setIsSubmitting(true)
    try {
      const selectedProduct = nomenclatures.find(p => String(p.id) === String(editingOrderHeader.nomenclature_id))
      const headerWithInfo = {
        customer: editingOrderHeader.customer,
        official_customer: editingOrderHeader.official_customer,
        deadline: editingOrderHeader.deadline,
        quantity: editingOrderHeader.quantity,
        productName: selectedProduct?.name || ''
      }
      const items = [{ nomenclature_id: editingOrderHeader.nomenclature_id, quantity: editingOrderHeader.quantity }]
      
      await updateOrder(selectedOrder.id, headerWithInfo, items)
      alert('Замовлення успішно оновлено!')
      setIsEditMode(false)
      setSelectedOrder(null)
      fetchOrders(0, false, { searchQuery, dateRange: dateFilter })
    } catch (err) {
      alert('Помилка при оновленні замовлення: ' + err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteClick = async (orderId) => {
    if (!window.confirm('Ви впевнені, що хочете видалити це замовлення? Усі пов’язані наряди, матеріальні запити та робочі картки також будуть видалені!')) {
      return
    }
    setIsSubmitting(true)
    try {
      await deleteOrder(orderId)
      alert('Замовлення успішно видалено!')
      setSelectedOrder(null)
      fetchOrders(0, false, { searchQuery, dateRange: dateFilter })
    } catch (err) {
      alert('Помилка при видаленні замовлення: ' + err.message)
    } finally {
      setIsSubmitting(false)
    }
  }`

if (!src.includes(statesAnchor)) { console.error('statesAnchor not found'); process.exit(1) }
src = src.replace(statesAnchor, statesNew)
console.log('✓ CRUD states and functions added')

// ── PATCH 3: Modify the Detail Modal UI to include Edit/Delete options or show the Edit Form ──
const detailModalOld = `      {/* DETAIL MODAL */}
      {selectedOrder && (
        <div className="modal-backdrop-modern">
           <div className="glass-card modal-content-modern anim-slide-up">
              <div className="modal-header-modern">
                 <h2>ДЕТАЛІ <span className="text-orange">#{selectedOrder.order_num}</span></h2>
                 <button onClick={() => setSelectedOrder(null)} className="btn-close-modal"><X size={24} /></button>
              </div>
              <div className="modal-body-modern">
                 <div className="details-grid-modern">
                    <div className="detail-item">
                       <label>ЗАМОВНИК</label>
                       <div>{selectedOrder.customer}</div>
                    </div>
                    <div className="detail-item">
                       <label>ТЕРМІН</label>
                       <div className="text-orange">{selectedOrder.deadline || '—'}</div>
                    </div>
                    <div className="detail-item">
                       <label>СТАТУС</label>
                       <div className={\`status-text \${selectedOrder.status}\`}>{getStatusLabel(selectedOrder.status)}</div>
                    </div>
                    <div className="detail-item">
                       <label>ОФІЦІЙНА НАЗВА</label>
                       <div style={{ fontSize: '0.9rem', color: '#888' }}>{selectedOrder.official_customer || '—'}</div>
                    </div>
                 </div>
                 
                 <h4 className="section-subtitle-modern">СКЛАД ЗАМОВЛЕННЯ</h4>
                 <div className="order-items-list">
                    {selectedOrder.order_items?.map((item, idx) => (
                       <div key={idx} className="item-row-modern">
                          <Package size={16} className="text-dim" />
                          <span className="item-name">{nomenclatures.find(n => n.id === item.nomenclature_id)?.name}</span>
                          <span className="spacer"></span>
                          <strong className="item-qty">{item.quantity} шт</strong>
                       </div>
                    ))}
                 </div>
              </div>
           </div>
        </div>
      )}`

const detailModalNew = `      {/* DETAIL & EDIT MODAL */}
      {selectedOrder && (
        <div className="modal-backdrop-modern">
           <div className="glass-card modal-content-modern anim-slide-up">
              <div className="modal-header-modern">
                 <h2>{isEditMode ? 'РЕДАГУВАННЯ ЗАМОВЛЕННЯ' : 'ДЕТАЛІ'} <span className="text-orange">#{selectedOrder.order_num}</span></h2>
                 <button onClick={() => { setSelectedOrder(null); setIsEditMode(false); }} className="btn-close-modal"><X size={24} /></button>
              </div>
              
              {isEditMode ? (
                <form onSubmit={handleUpdateSubmit} className="modal-body-modern" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div className="form-group-modern">
                    <label>ЗАМОВНИК</label>
                    <div className="input-wrapper">
                      <User size={16} />
                      <input value={editingOrderHeader.customer} onChange={e => setEditingOrderHeader({ ...editingOrderHeader, customer: e.target.value })} required />
                    </div>
                  </div>
                  
                  <div className="form-group-modern">
                    <label>ОФІЦІЙНА НАЗВА ЗАМОВНИКА</label>
                    <div className="input-wrapper">
                      <User size={16} />
                      <input value={editingOrderHeader.official_customer} onChange={e => setEditingOrderHeader({ ...editingOrderHeader, official_customer: e.target.value })} />
                    </div>
                  </div>

                  <div className="form-group-modern">
                    <label>ГОТОВИЙ ВИРІБ</label>
                    <div className="input-wrapper">
                      <Layers size={16} />
                      <select value={editingOrderHeader.nomenclature_id} onChange={e => setEditingOrderHeader({ ...editingOrderHeader, nomenclature_id: e.target.value })} required>
                        <option value="">Оберіть готовий виріб...</option>
                        {nomenclatures
                          .filter(n => n.type === 'product')
                          .map(n => <option key={n.id} value={n.id}>{n.name} {n.code ? \`(\${n.code})\` : ''}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="form-group-modern quantity-deadline-group" style={{ display: 'flex', gap: '20px' }}>
                    <div className="qty-subgroup" style={{ flex: 1 }}>
                      <label>КІЛЬКІСТЬ</label>
                      <div className="input-wrapper">
                        <input type="number" value={editingOrderHeader.quantity} onChange={e => setEditingOrderHeader({ ...editingOrderHeader, quantity: Number(e.target.value) })} required />
                      </div>
                    </div>
                    <div className="deadline-subgroup" style={{ flex: 1 }}>
                      <label>ДЕДЛАЙН</label>
                      <div className="input-wrapper">
                        <Calendar size={16} />
                        <input type="date" value={editingOrderHeader.deadline} onChange={e => setEditingOrderHeader({ ...editingOrderHeader, deadline: e.target.value })} required />
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '15px', justifyContent: 'flex-end', marginTop: '20px' }}>
                    <button type="button" onClick={() => setIsEditMode(false)} className="btn-load-more" style={{ padding: '12px 24px' }}>СКАСУВАТИ</button>
                    <button type="submit" disabled={isSubmitting} className="btn-primary-modern" style={{ padding: '12px 24px', boxShadow: 'none', marginTop: 0 }}>
                      {isSubmitting ? 'ЗБЕРЕЖЕННЯ...' : 'ЗБЕРЕГТИ ЗМІНИ'}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="modal-body-modern">
                   <div className="details-grid-modern">
                      <div className="detail-item">
                         <label>ЗАМОВНИК</label>
                         <div>{selectedOrder.customer}</div>
                      </div>
                      <div className="detail-item">
                         <label>ТЕРМІН</label>
                         <div className="text-orange">{selectedOrder.deadline ? new Date(selectedOrder.deadline).toLocaleDateString() : '—'}</div>
                      </div>
                      <div className="detail-item">
                         <label>СТАТУС</label>
                         <div className={\`status-text \${selectedOrder.status}\`}>{getStatusLabel(selectedOrder.status)}</div>
                      </div>
                      <div className="detail-item">
                         <label>ОФІЦІЙНА НАЗВА</label>
                         <div style={{ fontSize: '0.9rem', color: '#888' }}>{selectedOrder.official_customer || '—'}</div>
                      </div>
                   </div>
                   
                   <h4 className="section-subtitle-modern">СКЛАД ЗАМОВЛЕННЯ</h4>
                   <div className="order-items-list" style={{ marginBottom: '30px' }}>
                      {selectedOrder.order_items?.map((item, idx) => (
                         <div key={idx} className="item-row-modern">
                            <Package size={16} className="text-dim" />
                            <span className="item-name">{nomenclatures.find(n => n.id === item.nomenclature_id)?.name}</span>
                            <span className="spacer"></span>
                            <strong className="item-qty">{item.quantity} шт</strong>
                         </div>
                      ))}
                      {(!selectedOrder.order_items || selectedOrder.order_items.length === 0) && (
                         <div className="item-row-modern">
                            <Package size={16} className="text-dim" />
                            <span className="item-name">{selectedOrder.accessories || 'Не вказано'}</span>
                            <span className="spacer"></span>
                            <strong className="item-qty">{selectedOrder.quantity} шт</strong>
                         </div>
                      )}
                   </div>

                   {/* Action Buttons: Edit and Delete */}
                   <div style={{ display: 'flex', gap: '15px', justifyContent: 'flex-end', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '20px' }}>
                      <button onClick={() => handleDeleteClick(selectedOrder.id)} disabled={isSubmitting} className="btn-load-more" style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.2)', padding: '12px 24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Trash2 size={16} /> ВИДАТИ
                      </button>
                      <button onClick={() => handleEditInit(selectedOrder)} className="btn-primary-modern" style={{ background: '#3b82f6', color: '#fff', boxShadow: 'none', padding: '12px 24px', marginTop: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        🔧 РЕДАГУВАТИ
                      </button>
                   </div>
                </div>
              )}
           </div>
        </div>
      )}`

const cleanOld = detailModalOld.replace(/\r\n/g, '\n')
const cleanNew = detailModalNew.replace(/\r\n/g, '\n')

if (!src.includes(cleanOld)) { console.error('detailModalOld anchor not found'); process.exit(1) }
src = src.replace(cleanOld, cleanNew)
console.log('✓ Detail modal updated with Edit/Delete features')

if (hasCRLF) src = src.replace(/\n/g, '\r\n')
writeFileSync(filePath, src, 'utf8')
console.log('✓ ManagerModule.jsx written successfully')
