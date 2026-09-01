import React, { useState } from 'react'
import { ShoppingBag, Calendar, Package, ChevronDown, ChevronUp, Tag } from 'lucide-react'
import { useMES } from '../../../MESContext'

export const ClientOrderHistory = ({ orders = [] }) => {
  const { nomenclatures = [] } = useMES()
  const [expandedOrderId, setExpandedOrderId] = useState(null)

  if (!orders || orders.length === 0) {
    return (
      <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
        <ShoppingBag size={32} style={{ opacity: 0.4, marginBottom: '10px' }} />
        <div style={{ fontSize: '0.9rem', fontWeight: 800 }}>Історія замовлень відсутня</div>
        <div style={{ fontSize: '0.78rem', marginTop: '4px' }}>У даного клієнта поки немає оформлених виробничих замовлень</div>
      </div>
    )
  }

  const toggleExpand = (id) => {
    setExpandedOrderId(prev => prev === id ? null : id)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {orders.map((ord, idx) => {
        const orderId = ord.id || idx
        const isExpanded = expandedOrderId === orderId
        const orderNum = ord.order_num || ord.orderNum || `INV-2026-${ord.id}`
        const dateStr = ord.created_at || ord.order_date ? new Date(ord.created_at || ord.order_date).toLocaleDateString('uk-UA') : '—'
        const rawItems = ord.order_items || ord.items || []

        // Resolve product items
        const resolvedItems = rawItems.map(it => {
          let name = it.name || it.product_name || it.title || ''
          if (!name && it.nomenclature_id) {
            const nom = nomenclatures.find(n => String(n.id) === String(it.nomenclature_id))
            if (nom) name = nom.name || nom.code
          }
          if (!name && it.nomenclature && typeof it.nomenclature === 'object') {
            name = it.nomenclature.name || it.nomenclature.code
          }
          if (!name) name = 'Виріб / Фреза (без назви)'

          const quantity = Number(it.quantity || it.qty || it.planned_sets || it.sets || 1)
          const price = Number(it.price || it.unit_price || it.amount || 0)
          const total = price * quantity

          return { name, quantity, price, total }
        })

        const totalQty = resolvedItems.reduce((acc, it) => acc + it.quantity, 0) || Number(ord.quantity || 1)
        const itemsSum = resolvedItems.reduce((acc, it) => acc + it.total, 0)
        const totalAmount = Number(ord.total_amount || ord.amount || itemsSum || 0)
        const status = ord.status || 'in-progress'

        let statusText = 'В роботі'
        let statusColor = '#ff9000'
        if (status === 'completed' || status === 'shipped') {
          statusText = 'Виконано / Відвантажено'
          statusColor = '#10b981'
        } else if (status === 'new' || status === 'pending') {
          statusText = 'Нове'
          statusColor = '#6366f1'
        }

        return (
          <div
            key={orderId}
            style={{
              background: 'var(--card-bg, rgba(22, 24, 34, 0.6))',
              border: '1px solid var(--glass-border)',
              borderRadius: '16px',
              padding: '16px 18px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              transition: 'all 0.2s'
            }}
          >
            {/* Header row */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '14px',
              cursor: 'pointer'
            }}
            onClick={() => toggleExpand(orderId)}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '1rem', fontWeight: 950, color: 'var(--text)' }}>
                    {orderNum}
                  </span>
                  <span style={{
                    padding: '3px 9px',
                    borderRadius: '12px',
                    fontSize: '0.7rem',
                    fontWeight: 900,
                    background: `${statusColor}22`,
                    color: statusColor,
                    border: `1px solid ${statusColor}44`
                  }}>
                    {statusText}
                  </span>
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Calendar size={13} /> {dateStr}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text)' }}>
                    <Package size={13} color="#6366f1" /> <strong>{totalQty} шт</strong> ({resolvedItems.length || 1} наменувань)
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.1rem', fontWeight: 950, color: totalAmount > 0 ? '#10b981' : 'var(--text-muted)' }}>
                    {totalAmount > 0 ? `₴${totalAmount.toLocaleString()}` : 'Без ціни'}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#6366f1', marginTop: '2px', fontWeight: 800 }}>
                    {isExpanded ? 'Згорнути детальки ▲' : 'Показати товари ▼'}
                  </div>
                </div>
              </div>
            </div>

            {/* List of items inside order (visible by default or expanded) */}
            <div style={{
              marginTop: '4px',
              paddingTop: '12px',
              borderTop: '1px dashed var(--glass-border)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Package size={12} color="#ff9000" /> Перелік позицій та кількість:
              </div>

              {resolvedItems.length > 0 ? (
                resolvedItems.map((item, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: 'rgba(255,255,255,0.03)',
                      padding: '8px 12px',
                      borderRadius: '10px',
                      fontSize: '0.84rem',
                      border: '1px solid rgba(255,255,255,0.05)'
                    }}
                  >
                    <div style={{ fontWeight: 850, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ color: '#6366f1' }}>•</span> {item.name}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <span style={{ padding: '2px 8px', borderRadius: '8px', background: 'rgba(99, 102, 241, 0.15)', color: '#6366f1', fontWeight: 900, fontSize: '0.8rem' }}>
                        {item.quantity} шт
                      </span>
                      <span style={{ fontWeight: 900, color: item.price > 0 ? '#10b981' : 'var(--text-muted)', minWidth: '70px', textAlign: 'right' }}>
                        {item.price > 0 ? `₴${item.price.toLocaleString()}` : '—'}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '4px 0' }}>
                  Специфікація товарів не розшифрована в системі ({totalQty} шт)
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

