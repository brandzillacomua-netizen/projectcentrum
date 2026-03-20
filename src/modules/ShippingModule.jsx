import React from 'react'
import { 
  Truck, 
  ArrowLeft, 
  Bell, 
  PackageCheck, 
  ClipboardList,
  CheckCircle2,
  AlertCircle
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useMES } from '../MESContext'

const ShippingModule = () => {
  const { orders, updateOrderStatus } = useMES()

  const readyForShipping = orders.filter(o => o.status === 'completed')
  const inConsolidation = orders.filter(o => o.status === 'pending' || o.status === 'in-progress')

  return (
    <div className="module-page">
      <nav className="module-nav">
        <Link to="/" className="back-link"><ArrowLeft size={20} /> Назад до Порталу</Link>
        <div className="module-title-group">
          <Truck className="text-danger" />
          <h1>Модуль Відвантаження</h1>
        </div>
        <div className="user-profile">
          <div className="avatar">ВД</div>
        </div>
      </nav>

      <div className="module-content">
        <div className="dashboard-grid">
          <div className="content-card">
            <div className="card-header">
              <h3><ClipboardList size={18} /> Зведення партій</h3>
            </div>
            <div className="consolidation-list">
              {inConsolidation.length === 0 ? (
                <p className="empty-msg">Немає партій у виробництві</p>
              ) : (
                inConsolidation.map(order => (
                  <div key={order.id} className="cons-item">
                    <div className="cons-info">
                      <strong>{order.orderNum} - {order.customer}</strong>
                      <div className="cons-progress">
                        <div className="progress-bar">
                          <div className="progress-fill" style={{ width: order.status === 'in-progress' ? '50%' : '0%' }}></div>
                        </div>
                        <span>Статус: 
                          {order.status === 'pending' ? ' Очікує' : 
                           order.status === 'in-progress' ? ' В роботі' : 
                           order.status === 'completed' ? ' Виконано' : 
                           order.status === 'shipped' ? ' Відвантажено' : 
                           ` ${order.status}`}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="content-card">
            <div className="card-header">
              <h3><PackageCheck size={18} /> Готово до відвантаження</h3>
            </div>
            <div className="shipping-list">
              {readyForShipping.length === 0 ? (
                <div className="empty-state">Немає замовлень, готових до відправки</div>
              ) : (
                readyForShipping.map(order => (
                  <div key={order.id} className="ship-item">
                    <div className="ship-info">
                      <strong>{order.customer} ({order.orderNum})</strong>
                      <span>{order.item} ({order.qty} шт)</span>
                    </div>
                    <button className="btn-success" onClick={() => updateOrderStatus(order.id, 'shipped')}>
                      <CheckCircle2 size={16} /> Відвантажити
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .empty-msg { font-size: 0.85rem; color: #666; font-style: italic; }
        .cons-item { padding: 15px; border: 1px solid #333; border-radius: 12px; margin-bottom: 12px; background: #121212; }
        .cons-info strong { color: #fff; }
        .cons-progress { display: flex; align-items: center; gap: 15px; margin-top: 10px; font-size: 0.85rem; color: #999; }
        .cons-progress .progress-bar { flex: 1; height: 6px; }
        
        .ship-item { 
          display: flex; justify-content: space-between; align-items: center; 
          padding: 20px; background: #121212; border-radius: 16px; margin-bottom: 12px;
          border: 1px solid #333;
        }
        .ship-info { display: flex; flex-direction: column; }
        .ship-info strong { color: #fff; font-size: 1rem; }
        .ship-info span { font-size: 0.85rem; color: var(--primary); font-weight: 600; margin-top: 4px; }
        .btn-success { 
          display: flex; align-items: center; gap: 8px; padding: 10px 20px; 
          background: #22c55e; color: white; border: none; border-radius: 10px; 
          font-weight: 800; cursor: pointer; text-transform: uppercase; font-size: 0.75rem;
          transition: 0.3s;
        }
        .btn-success:hover { background: #16a34a; transform: translateY(-2px); box-shadow: 0 5px 15px rgba(34, 197, 94, 0.3); }
      `}} />
    </div>
  )
}

export default ShippingModule
