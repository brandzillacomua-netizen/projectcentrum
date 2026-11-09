import React from 'react'
import { Plus, Package, FileText, User, Calendar, Palette, Droplet, X } from 'lucide-react'
import { ProductSearchSelect } from './ProductSearchSelect'
import { DEFAULT_PAINTING_COLORS } from '../constants/paintingConstants'

export const OrderForm = ({
  isOpen,
  onClose,
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
  if (!isOpen) return null

  const isPaintingMissing = !orderHeader.painting_type
  const isColorMissing = (orderHeader.painting_type === 'full' || orderHeader.painting_type === 'edges') && !orderHeader.painting_color?.trim()

  return (
    <div className="modal-backdrop-modern" onClick={(e) => { if (e.target === e.currentTarget && onClose) onClose() }}>
      <div
        className="glass-card modal-content-modern anim-slide-up"
        style={{
          maxWidth: '860px',
          width: '95%',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Modal Header */}
        <div className="modal-header-modern">
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div className="icon-badge">
              <Plus className="text-orange" size={24} />
            </div>
            <div>
              <h2 className="registration-title" style={{ margin: 0, fontSize: '1.25rem', fontWeight: 900 }}>
                РЕЄСТРАЦІЯ НОВОГО ЗАМОВЛЕННЯ
              </h2>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Заповніть інформацію про клієнта, виріб та вимоги до постобробки
              </span>
            </div>
          </div>
          {onClose && (
            <button type="button" onClick={onClose} className="btn-close-modal" title="Закрити вікно">
              <X size={20} />
            </button>
          )}
        </div>

        {/* Modal Body Form */}
        <div style={{ padding: '24px 32px', overflowY: 'auto' }}>
          <form onSubmit={handleOrderSubmit} className="order-form-grid-modern">
            <div className="form-group-modern">
              <label>№ ЗАМОВЛЕННЯ</label>
              <div className="input-wrapper" style={{ background: 'var(--fill-subtle)' }}>
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
                  <input type="number" min="1" value={orderHeader.quantity} onChange={e => setOrderHeader({...orderHeader, quantity: e.target.value})} />
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

            {/* ПОСТОБРОБКА / ФАРБУВАННЯ (ЦЕХ №2) — ОБОВ'ЯЗКОВИЙ БЛОК */}
            <div
              className="form-group-modern"
              style={{
                gridColumn: '1 / -1',
                background: isPaintingMissing ? 'rgba(239, 68, 68, 0.04)' : 'rgba(255, 144, 0, 0.04)',
                border: isPaintingMissing ? '1px solid rgba(239, 68, 68, 0.35)' : '1px solid rgba(255, 144, 0, 0.25)',
                borderRadius: '18px',
                padding: '18px 22px',
                marginTop: '5px',
                transition: 'all 0.3s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Palette size={18} className="text-orange" />
                  <span style={{ fontSize: '0.8rem', fontWeight: 900, color: '#ff9000', letterSpacing: '0.8px', textTransform: 'uppercase' }}>
                    ПОСТОБРОБКА / ФАРБУВАННЯ (ЦЕХ №2)
                  </span>
                </div>
                {isPaintingMissing && (
                  <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#ef4444', background: 'rgba(239, 68, 68, 0.12)', padding: '3px 10px', borderRadius: '12px', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                    * ОБОВ'ЯЗКОВО ОБЕРІТЬ ВАРІАНТ
                  </span>
                )}
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
                <div className="form-group-modern" style={{ margin: 0 }}>
                  <label style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>ТИП ФАРБУВАННЯ</span>
                    {isPaintingMissing && <span style={{ color: '#ef4444' }}>* обов'язково</span>}
                  </label>
                  <div
                    className="input-wrapper"
                    style={{
                      borderColor: isPaintingMissing ? 'rgba(239, 68, 68, 0.6)' : undefined,
                      boxShadow: isPaintingMissing ? '0 0 10px rgba(239, 68, 68, 0.15)' : undefined
                    }}
                  >
                    <Palette size={16} />
                    <select
                      value={orderHeader.painting_type || ''}
                      onChange={e => setOrderHeader({
                        ...orderHeader,
                        painting_type: e.target.value,
                        painting_color: (e.target.value === 'none' || !e.target.value) ? '' : (orderHeader.painting_color || '')
                      })}
                      style={{ fontWeight: orderHeader.painting_type ? 700 : 400 }}
                    >
                      <option value="">-- Оберіть варіант --</option>
                      <option value="none">Без фарбування</option>
                      <option value="full">Повне фарбування</option>
                      <option value="edges">Фарбування торців</option>
                    </select>
                  </div>
                </div>

                {(orderHeader.painting_type === 'full' || orderHeader.painting_type === 'edges') && (
                  <>
                    <div className="form-group-modern" style={{ margin: 0 }}>
                      <label style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>КОЛІР ФАРБУВАННЯ</span>
                        {isColorMissing && <span style={{ color: '#ef4444' }}>* обов'язково</span>}
                      </label>
                      <div
                        className="input-wrapper"
                        style={{
                          borderColor: isColorMissing ? 'rgba(239, 68, 68, 0.6)' : undefined,
                          boxShadow: isColorMissing ? '0 0 10px rgba(239, 68, 68, 0.15)' : undefined
                        }}
                      >
                        <Droplet size={16} />
                        <select
                          value={orderHeader.painting_color || ''}
                          onChange={e => setOrderHeader({ ...orderHeader, painting_color: e.target.value })}
                          style={{ fontWeight: orderHeader.painting_color ? 700 : 400 }}
                        >
                          <option value="">-- Оберіть колір --</option>
                          {DEFAULT_PAINTING_COLORS.map(c => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                          {orderHeader.painting_color && !DEFAULT_PAINTING_COLORS.includes(orderHeader.painting_color) && (
                            <option value={orderHeader.painting_color}>{orderHeader.painting_color}</option>
                          )}
                        </select>
                      </div>
                    </div>

                    <div className="form-group-modern" style={{ margin: 0 }}>
                      <label>ПРИМІТКА ДО МАЛЯРКИ (ОПЦІОНАЛЬНО)</label>
                      <div className="input-wrapper">
                        <FileText size={16} />
                        <input
                          value={orderHeader.painting_notes || ''}
                          onChange={e => setOrderHeader({ ...orderHeader, painting_notes: e.target.value })}
                          placeholder="Особливі вказівки маляру..."
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Modal Actions Footer */}
            <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: '14px', marginTop: '16px', borderTop: '1px solid var(--glass-border, rgba(255,255,255,0.06))', paddingTop: '20px', flexWrap: 'wrap' }}>
              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="btn-load-more"
                  style={{ padding: '14px 28px', borderRadius: '16px' }}
                >
                  СКАСУВАТИ
                </button>
              )}
              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-primary-modern"
                style={{
                  background: (isPaintingMissing || isColorMissing)
                    ? 'linear-gradient(135deg, #f59e0b, #d97706)'
                    : '#ff9000',
                  color: '#000',
                  fontWeight: 900
                }}
              >
                {isSubmitting
                  ? 'ОБРОБКА...'
                  : isPaintingMissing
                  ? '⚠️ ОБЕРІТЬ ВАРІАНТ ФАРБУВАННЯ'
                  : isColorMissing
                  ? '⚠️ ОБЕРІТЬ КОЛІР ФАРБУВАННЯ'
                  : 'ЗАРЕЄСТРУВАТИ ЗАМОВЛЕННЯ'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
