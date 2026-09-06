import React from 'react'

export const DashboardOrderTabs = ({
  selectedOrderId,
  setSelectedOrderId,
  activeOrders
}) => {
  return (
    <div style={{ display: 'flex', overflowX: 'auto', gap: '10px', padding: '0 24px', marginBottom: '10px', marginTop: '15px' }}>
      <button
        onClick={() => setSelectedOrderId(null)}
        style={{
          background: selectedOrderId === null ? '#ff9000' : '#18181b',
          color: selectedOrderId === null ? '#000' : '#a1a1aa',
          border: `1px solid ${selectedOrderId === null ? '#ff9000' : '#27272a'}`,
          padding: '8px 16px',
          borderRadius: '10px',
          fontWeight: 800,
          fontSize: '0.8rem',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          transition: 'all 0.2s'
        }}
      >
        ЗАГАЛЬНИЙ ДАШБОРД
      </button>
      {activeOrders.map(order => {
        const displayNum = order.order_num || order.id.split('-')[0]
        return (
          <button
            key={order.id}
            onClick={() => setSelectedOrderId(order.id)}
            style={{
              background: selectedOrderId === order.id ? '#3b82f6' : '#18181b',
              color: selectedOrderId === order.id ? '#fff' : '#a1a1aa',
              border: `1px solid ${selectedOrderId === order.id ? '#3b82f6' : '#27272a'}`,
              padding: '8px 16px',
              borderRadius: '10px',
              fontWeight: 800,
              fontSize: '0.8rem',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.2s'
            }}
          >
            НАРЯД №{displayNum}
          </button>
        )
      })}
    </div>
  )
}
