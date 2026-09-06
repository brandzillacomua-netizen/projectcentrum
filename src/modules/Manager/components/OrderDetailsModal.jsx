import React from 'react'
import { X, User, FileText, Calendar, Package, Trash2 } from 'lucide-react'
import { ProductSearchSelect } from './ProductSearchSelect'

export const OrderDetailsModal = ({
  selectedOrder,
  onClose,
  isEditMode,
  setIsEditMode,
  editingOrderHeader,
  setEditingOrderHeader,
  handleUpdateSubmit,
  handleDeleteClick,
  handleSuperDeleteClick,
  handleBatchScheduleInit,
  handleEditInit,
  nomenclatures,
  currentUser,
  isSubmitting,
  getStatusLabel,
  onCreateNewProduct
}) => {
  if (!selectedOrder) return null

  return (
    <div className="modal-backdrop-modern">
      <div className="glass-card modal-content-modern anim-slide-up">
        <div className="modal-header-modern">
          <h2>ЗАМОВЛЕННЯ <span className="text-orange">#{selectedOrder.order_num}</span></h2>
          <button onClick={onClose} className="btn-close-modal"><X size={24} /></button>
        </div>

        {isEditMode ? (
          <form onSubmit={handleUpdateSubmit} className="modal-body-modern" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h4 className="section-subtitle-modern" style={{ margin: 0, color: '#3b82f6' }}>🔧 РЕДАГУВАННЯ ЗАМОВЛЕННЯ</h4>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div className="form-group-modern">
                <label>ЗАМОВНИК</label>
                <div className="input-wrapper">
                  <User size={16} />
                  <input
                    value={editingOrderHeader.customer}
                    onChange={e => setEditingOrderHeader({ ...editingOrderHeader, customer: e.target.value })}
                    placeholder="Введіть замовника..."
                  />
                </div>
              </div>

              <div className="form-group-modern">
                <label>ОФІЦІЙНА НАЗВА (ОПЦІОНАЛЬНО)</label>
                <div className="input-wrapper">
                  <User size={16} />
                  <input
                    value={editingOrderHeader.official_customer}
                    onChange={e => setEditingOrderHeader({ ...editingOrderHeader, official_customer: e.target.value })}
                    placeholder="Юридична назва компанії..."
                  />
                </div>
              </div>

              <div className="form-group-modern">
                <label>№ РАХУНКУ (ОПЦІОНАЛЬНО)</label>
                <div className="input-wrapper">
                  <FileText size={16} />
                  <input
                    value={editingOrderHeader.invoice_num}
                    onChange={e => setEditingOrderHeader({ ...editingOrderHeader, invoice_num: e.target.value })}
                    placeholder="№ рахунку..."
                  />
                </div>
              </div>

              <div className="form-group-modern">
                <label>ГОТОВИЙ ВИРІБ</label>
                <ProductSearchSelect
                  products={nomenclatures}
                  value={editingOrderHeader.nomenclature_id}
                  onChange={id => setEditingOrderHeader({ ...editingOrderHeader, nomenclature_id: id })}
                  onCreateNewProduct={onCreateNewProduct}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div className="form-group-modern">
                  <label>КІЛЬКІСТЬ</label>
                  <div className="input-wrapper">
                    <input
                      type="number"
                      value={editingOrderHeader.quantity}
                      onChange={e => setEditingOrderHeader({ ...editingOrderHeader, quantity: e.target.value })}
                    />
                  </div>
                </div>
                <div className="form-group-modern">
                  <label>ДЕДЛАЙН</label>
                  <div className="input-wrapper">
                    <Calendar size={16} />
                    <input
                      type="date"
                      onClick={(e) => e.target.showPicker()}
                      value={editingOrderHeader.deadline}
                      onChange={e => setEditingOrderHeader({ ...editingOrderHeader, deadline: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '10px' }}>
              <button
                type="button"
                onClick={() => setIsEditMode(false)}
                className="btn-load-more"
                style={{ padding: '12px 24px' }}
              >
                СКАСУВАТИ
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-primary-modern"
                style={{ padding: '12px 24px', background: '#3b82f6', color: '#fff', boxShadow: 'none', marginTop: 0 }}
              >
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
                <label>№ РАХУНКУ</label>
                <div style={{ color: selectedOrder.invoice_num ? '#3b82f6' : '#555', fontWeight: 700 }}>
                  {selectedOrder.invoice_num ? `№ ${selectedOrder.invoice_num}` : '—'}
                </div>
              </div>
              <div className="detail-item">
                <label>ТЕРМІН</label>
                <div className="text-orange">{selectedOrder.deadline ? new Date(selectedOrder.deadline).toLocaleDateString() : '—'}</div>
              </div>
              <div className="detail-item">
                <label>СТАТУС</label>
                <div className={`status-text ${selectedOrder.status}`}>{getStatusLabel(selectedOrder.status)}</div>
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

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '20px', flexWrap: 'wrap' }}>
              {currentUser?.login === 'admin@workshop.local' && (
                <button onClick={() => handleSuperDeleteClick(selectedOrder.id)} disabled={isSubmitting} className="btn-primary-modern" style={{ background: 'linear-gradient(135deg, #ef4444, #b91c1c)', color: '#fff', border: 'none', padding: '12px 20px', marginTop: 0, display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 14px rgba(239,68,68,0.4)' }}>
                  <Trash2 size={16} /> СУПЕР-ВИДАЛЕННЯ
                </button>
              )}
              <button onClick={() => handleDeleteClick(selectedOrder.id)} disabled={isSubmitting} className="btn-load-more" style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.2)', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Trash2 size={16} /> ВИДАЛИТИ
              </button>
              <button onClick={() => handleBatchScheduleInit(selectedOrder)} className="btn-primary-modern" style={{ background: 'linear-gradient(135deg, #ff9000, #e67e00)', color: '#000', boxShadow: '0 4px 14px rgba(255,144,0,0.3)', padding: '12px 20px', marginTop: 0, display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '900' }}>
                <Calendar size={16} /> КАЛЕНДАР ПАРТІЙ
              </button>
              <button onClick={() => handleEditInit(selectedOrder)} className="btn-primary-modern" style={{ background: '#3b82f6', color: '#fff', boxShadow: 'none', padding: '12px 20px', marginTop: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                🔧 РЕДАГУВАТИ
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
