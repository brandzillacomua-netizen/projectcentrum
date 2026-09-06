import React from 'react'
import { Layers, Search, Pencil, Calendar } from 'lucide-react'

export const OrdersTable = ({
  clientOrders,
  nomenclatures,
  getOrderProductionProgress,
  getStatusLabel,
  setSelectedOrder,
  handleEditInit,
  dateFilter,
  setDateFilter,
  searchQuery,
  setSearchQuery,
  loading,
  hasMoreOrders,
  loadMore
}) => {
  return (
    <section className="registry-section-modern">
      <div className="registry-header-modern">
        <div className="registry-title-group">
          <Layers className="text-orange" size={28} />
          <h3>РЕЄСТР ЗАМОВЛЕННЯ</h3>
        </div>

        <div className="filters-container-modern">
          <div className="period-filters">
            {['today', 'week', 'month', 'quarter', 'all'].map(p => (
              <button
                key={p}
                onClick={() => setDateFilter(p)}
                className={`filter-chip ${dateFilter === p ? 'active' : ''}`}
              >
                {p === 'today' ? 'СЬОГОДНІ' : p === 'week' ? 'ТИЖДЕНЬ' : p === 'month' ? 'МІСЯЦЬ' : p === 'quarter' ? 'КВАРТАЛ' : 'УСІ'}
              </button>
            ))}
          </div>

          <div className="search-box-modern">
            <Search size={18} />
            <input
              placeholder="Пошук номеру, рахунку або клієнта..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="glass-card table-glass" style={{ padding: '0', borderRadius: '24px', background: 'rgba(15,15,15,0.4)', border: '1px solid rgba(255,144,0,0.05)', overflow: 'hidden' }}>
        <div className="table-responsive-container hide-mobile">
          <table className="modern-table">
            <thead>
              <tr>
                <th>№ ЗАМОВЛЕННЯ</th>
                <th>№ РАХУНКУ</th>
                <th>ЗАМОВНИК</th>
                <th>ВИРІБ</th>
                <th>КІЛЬКІСТЬ</th>
                <th>ТЕРМІН</th>
                <th>СТАТУС</th>
                <th style={{ textAlign: 'right', width: '60px' }}>ДІЇ</th>
              </tr>
            </thead>
            <tbody>
              {clientOrders.map(order => {
                const nom = nomenclatures.find(n => String(n.id) === String(order.nomenclature_id));
                const prodName = nom ? nom.name : (order.accessories || '—');
                const ordQty = order.quantity || 0;
                const prog = getOrderProductionProgress(order.id);
                const inWorkQty = Math.max(0, prog.planned - prog.packaged);
                return (
                  <tr key={order.id} onClick={() => setSelectedOrder(order)}>
                    <td className="order-num-cell">#{order.order_num}</td>
                    <td className="invoice-num-cell" style={{ color: order.invoice_num ? '#3b82f6' : '#555', fontWeight: 600, fontSize: '0.88rem' }}>
                      {order.invoice_num ? `№ ${order.invoice_num}` : '—'}
                    </td>
                    <td className="customer-cell">{order.customer}</td>
                    <td className="product-cell">{prodName}</td>
                    <td className="qty-cell">
                      <strong>{prog.packaged}</strong>
                      {inWorkQty > 0 && (
                        <span style={{ color: '#ff9000', fontSize: '0.85rem', fontWeight: '500', marginLeft: '5px', marginRight: '5px' }} title="В роботі">
                          (в роботі: {inWorkQty})
                        </span>
                      )}
                      <strong> / {ordQty}</strong> шт
                    </td>
                    <td className="date-cell">{order.deadline ? new Date(order.deadline).toLocaleDateString() : '—'}</td>
                    <td><span className={`status-pill ${prog.status}`}>{getStatusLabel(prog.status)}</span></td>
                    <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                      <button 
                        onClick={() => handleEditInit(order)}
                        style={{
                          background: 'rgba(255,144,0,0.1)',
                          border: '1px solid rgba(255,144,0,0.25)',
                          borderRadius: '10px',
                          width: '36px',
                          height: '36px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#ff9000',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                        title="Швидке редагування"
                        className="quick-edit-btn"
                      >
                        <Pencil size={15} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile Registry View (Cards) */}
        <div className="mobile-registry-cards mobile-only">
          {clientOrders.map(order => {
            const nom = nomenclatures.find(n => String(n.id) === String(order.nomenclature_id));
            const prodName = nom ? nom.name : (order.accessories || '—');
            const ordQty = order.quantity || 0;
            const prog = getOrderProductionProgress(order.id);
            const inWorkQty = Math.max(0, prog.planned - prog.packaged);
            return (
              <div key={order.id} onClick={() => setSelectedOrder(order)} className="mobile-order-card">
                <div className="card-top">
                  <span className="card-order-num">#{order.order_num}</span>
                  <span className={`status-pill ${prog.status}`}>{getStatusLabel(prog.status)}</span>
                </div>
                <div className="card-customer">{order.customer}</div>
                <div className="card-product">{prodName}</div>
                <div className="card-footer">
                  <span>
                    <strong>{prog.packaged}</strong>
                    {inWorkQty > 0 && (
                      <span style={{ color: '#ff9000', fontSize: '0.8rem', fontWeight: '500', marginLeft: '4px', marginRight: '4px' }}>
                        (в роботі: {inWorkQty})
                      </span>
                    )}
                    <strong> / {ordQty}</strong> шт
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span className="card-deadline"><Calendar size={12} /> {order.deadline ? new Date(order.deadline).toLocaleDateString() : '—'}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditInit(order);
                      }}
                      style={{
                        background: 'rgba(255,144,0,0.1)',
                        border: '1px solid rgba(255,144,0,0.25)',
                        borderRadius: '8px',
                        width: '30px',
                        height: '30px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#ff9000',
                        cursor: 'pointer'
                      }}
                      title="Швидке редагування"
                    >
                      <Pencil size={13} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {clientOrders.length === 0 && !loading && (
          <div style={{ textAlign: 'center', padding: '60px', color: '#444', fontSize: '1rem' }}>Замовлень не знайдено</div>
        )}
      </div>

      {hasMoreOrders && (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <button onClick={loadMore} className="btn-load-more">ПОКАЗАТИ БІЛЬШЕ</button>
        </div>
      )}
    </section>
  )
}
