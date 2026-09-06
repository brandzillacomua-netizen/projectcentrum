import React from 'react'
import { ShieldCheck, X, Clock, Warehouse, FileCode, CheckCircle2 } from 'lucide-react'
import { apiService } from '../../../services/apiDispatcher'

export const ApprovalsDrawer = ({
  isOpen,
  onClose,
  pendingTasks,
  orders,
  allOrdersMap,
  nomenclatures,
  approveDirector
}) => {
  if (!isOpen) return null

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer-content glass-panel anim-slide-right" onClick={e => e.stopPropagation()}>
        <div className="drawer-header">
          <div className="header-title">
            <ShieldCheck className="text-orange" size={24} />
            <h3>ПІДТВЕРДЖЕННЯ НАРЯДІВ <span className="count-tag">{pendingTasks.length}</span></h3>
          </div>
          <button className="btn-close" onClick={onClose}><X size={24} /></button>
        </div>

        <div className="drawer-body">
          {pendingTasks.map(task => {
            const order = orders.find(o => String(o.id) === String(task.order_id)) || allOrdersMap[task.order_id]
            const isSkladOk = task.warehouse_conf === 'true' || task.warehouse_conf === 'partial'
            const isEngOk = task.engineer_conf === true

            const orderItems = order?.order_items || []
            let prodName = ''
            let prodQty = ''

            if (orderItems.length > 0) {
              prodName = orderItems.map(it => {
                const nom = nomenclatures.find(n => String(n.id) === String(it.nomenclature_id))
                return nom ? nom.name : null
              }).filter(Boolean).join(', ')

              const totalItemQty = orderItems.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0)
              prodQty = task.planned_sets ? `${task.planned_sets} компл.` : (totalItemQty > 0 ? `${totalItemQty} шт` : '')
            }

            if (!prodName && order?.nomenclature_id) {
              const nom = nomenclatures.find(n => String(n.id) === String(order.nomenclature_id))
              if (nom) prodName = nom.name
            }

            if (!prodQty && task.planned_sets) {
              prodQty = `${task.planned_sets} компл.`
            }

            if (!prodName) prodName = '—'

            return (
              <div key={task.id} className="approval-card glass-panel">
                <div className="card-top">
                  <div className="order-info">
                    <span className="order-label">ЗАМОВЛЕННЯ</span>
                    <h4 className="order-num">#{order?.order_num}</h4>
                    <p className="order-cust">{order?.customer}</p>
                  </div>
                  <div className="order-time">
                    <Clock size={14} /> {new Date(task.created_at).toLocaleDateString()}
                  </div>
                </div>

                <div className="order-product-badge-block" style={{ marginBottom: '16px', padding: '12px 14px', background: 'rgba(255, 144, 0, 0.06)', border: '1px solid rgba(255, 144, 0, 0.2)', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.62rem', fontWeight: 900, color: '#ff9000', textTransform: 'uppercase', letterSpacing: '0.5px' }}>ВИРІБ / ПРОДУКЦІЯ</span>
                    {prodQty && (
                      <span style={{ fontSize: '0.82rem', fontWeight: 950, color: '#10b981', background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '2px 8px', borderRadius: '6px' }}>
                        {prodQty}
                      </span>
                    )}
                  </div>
                  <div className="opbb-name" style={{ fontSize: '0.95rem', fontWeight: 950, color: 'var(--text, #ffffff)', lineHeight: 1.3 }}>
                    {prodName}
                  </div>
                </div>

                <div className="checks-grid">
                  <div className={`check-item ${task.warehouse_conf === 'true' ? 'ok' : (task.warehouse_conf === 'partial' ? 'partial' : 'pending')}`} style={task.warehouse_conf === 'partial' ? { background: 'rgba(234,179,8,0.1)', color: '#eab308', border: '1px solid rgba(234,179,8,0.2)' } : {}}>
                    <Warehouse size={18} />
                    <span>{task.warehouse_conf === 'partial' ? 'ЧАСТК. СКЛАД' : 'СКЛАД'}</span>
                    {(task.warehouse_conf === 'true' || task.warehouse_conf === 'partial') && <CheckCircle2 size={12} />}
                  </div>
                  <div className={`check-item ${isEngOk ? 'ok' : 'pending'}`}>
                    <FileCode size={18} />
                    <span>ІНЖЕНЕР</span>
                    {isEngOk && <CheckCircle2 size={12} />}
                  </div>
                </div>

                <button
                  onClick={() => apiService.submitApproveDirector(task.id, approveDirector)}
                  disabled={!(isSkladOk && isEngOk)}
                  className={`btn-approve ${(isSkladOk && isEngOk) ? 'ready' : 'locked'}`}
                >
                  ФІНАЛЬНИЙ ПІДПИС
                </button>
              </div>
            )
          })}

          {pendingTasks.length === 0 && (
            <div className="empty-state">
              <CheckCircle2 size={60} className="text-dim" />
              <p>УСІ НАРЯДИ ПІДПИСАНО</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
