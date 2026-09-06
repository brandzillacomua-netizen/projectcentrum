import React from 'react'
import { Plus, Package, FileText, User, Calendar } from 'lucide-react'
import { ProductSearchSelect } from './ProductSearchSelect'

export const OrderForm = ({
  orderHeader,
  setOrderHeader,
  handleOrderSubmit,
  handleCustomerChange,
  showCustomerHints,
  setShowCustomerHints,
  localCustomers,
  selectCustomer,
  nomenclatures,
  setCreateProductQuery,
  setTargetProductField,
  setIsCreateProductOpen,
  isSubmitting
}) => {
  return (
    <section className="registration-section" style={{ marginBottom: '60px' }}>
      <div className="glass-card main-registration-card">
        <div className="registration-header-group">
          <div className="icon-badge">
            <Plus className="text-orange" size={24} />
          </div>
          <h2 className="registration-title">РЕЄСТРАЦІЯ ЗАМОВЛЕННЯ</h2>
        </div>

        <form onSubmit={handleOrderSubmit} className="order-form-grid-modern">
          <div className="form-group-modern">
            <label>№ ЗАМОВЛЕННЯ</label>
            <div className="input-wrapper" style={{ background: 'rgba(255,255,255,0.02)' }}>
              <Package size={16} />
              <input value={orderHeader.orderNum} readOnly style={{ opacity: 0.7, cursor: 'not-allowed' }} placeholder="Генерується автоматично..." />
            </div>
          </div>

          <div className="form-group-modern">
            <label>№ РАХУНКУ (ОПЦІОНАЛЬНО)</label>
            <div className="input-wrapper">
              <FileText size={16} />
              <input value={orderHeader.invoiceNum} onChange={e => setOrderHeader({...orderHeader, invoiceNum: e.target.value})} placeholder="Введіть № рахунку..." />
            </div>
          </div>

          <div className="form-group-modern">
            <label>ЗАМОВНИК (ПОШУК)</label>
            <div className="input-wrapper">
              <User size={16} />
              <input value={orderHeader.customer} onChange={e => handleCustomerChange(e.target.value)} onBlur={() => setTimeout(() => setShowCustomerHints(false), 200)} placeholder="Почніть вводити назву..." />
              {showCustomerHints && localCustomers.length > 0 && (
                <div className="hints-dropdown">
                  {localCustomers.map(c => <div key={c.id} onClick={() => selectCustomer(c)} className="hint-item">{c.name}</div>)}
                </div>
              )}
            </div>
          </div>

          <div className="form-group-modern">
            <label>ГОТОВИЙ ВИРІБ (ПОШУК)</label>
            <ProductSearchSelect
              products={nomenclatures}
              value={orderHeader.nomenclature_id}
              onChange={id => setOrderHeader({ ...orderHeader, nomenclature_id: id })}
              onCreateNewProduct={(q) => {
                setCreateProductQuery(q)
                setTargetProductField('registration')
                setIsCreateProductOpen(true)
              }}
            />
          </div>

          <div className="form-group-modern quantity-deadline-group">
            <div className="qty-subgroup">
              <label>КІЛЬКІСТЬ</label>
              <div className="input-wrapper">
                <input type="number" value={orderHeader.quantity} onChange={e => setOrderHeader({...orderHeader, quantity: e.target.value})} />
              </div>
            </div>
            <div className="deadline-subgroup">
              <label>ДЕДЛАЙН</label>
              <div className="input-wrapper">
                <Calendar size={16} />
                <input 
                  type="date" 
                  onClick={(e) => e.target.showPicker()} 
                  min={new Date().toISOString().split('T')[0]}
                  value={orderHeader.deadline} 
                  onChange={e => setOrderHeader({...orderHeader, deadline: e.target.value})} 
                />
              </div>
            </div>
          </div>

          <div style={{ alignSelf: 'flex-end' }}>
            <button type="submit" disabled={isSubmitting} className="btn-primary-modern">
              {isSubmitting ? 'ОБРОБКА...' : 'ЗАРЕЄСТРУВАТИ ЗАМОВЛЕННЯ'}
            </button>
          </div>
        </form>
      </div>
    </section>
  )
}
