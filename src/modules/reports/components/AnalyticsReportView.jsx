import React from 'react'

export const AnalyticsReportView = ({ generalStats }) => {
  return (
    <div className="analytics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
      <div className="glass-panel" style={{ background: '#111', padding: '25px', borderRadius: '16px', border: '1px solid #222', borderTop: '4px solid #3b82f6' }}>
        <div style={{ fontSize: '0.7rem', color: '#666', textTransform: 'uppercase', fontWeight: 800, marginBottom: '10px' }}>Нові Замовлення</div>
        <div style={{ fontSize: '2.5rem', fontWeight: 900, color: '#fff' }}>{generalStats.totalOrders}</div>
        <div style={{ fontSize: '0.8rem', color: '#888', marginTop: '10px' }}>Активних: <strong style={{ color: '#3b82f6' }}>{generalStats.activeOrders}</strong></div>
      </div>

      <div className="glass-panel" style={{ background: '#111', padding: '25px', borderRadius: '16px', border: '1px solid #222', borderTop: '4px solid #ff9000' }}>
        <div style={{ fontSize: '0.7rem', color: '#666', textTransform: 'uppercase', fontWeight: 800, marginBottom: '10px' }}>Наряди (Партії)</div>
        <div style={{ fontSize: '2.5rem', fontWeight: 900, color: '#fff' }}>{generalStats.totalTasks}</div>
        <div style={{ fontSize: '0.8rem', color: '#888', marginTop: '10px' }}>Завершено: <strong style={{ color: '#22c55e' }}>{generalStats.completedTasks}</strong></div>
      </div>

      <div className="glass-panel" style={{ background: '#111', padding: '25px', borderRadius: '16px', border: '1px solid #222', borderTop: '4px solid #8b5cf6' }}>
        <div style={{ fontSize: '0.7rem', color: '#666', textTransform: 'uppercase', fontWeight: 800, marginBottom: '10px' }}>Заплановано комплектів</div>
        <div style={{ fontSize: '2.5rem', fontWeight: 900, color: '#fff' }}>{generalStats.totalSets}</div>
      </div>

      <div className="glass-panel" style={{ background: '#111', padding: '25px', borderRadius: '16px', border: '1px solid #222', borderTop: '4px solid #10b981' }}>
        <div style={{ fontSize: '0.7rem', color: '#666', textTransform: 'uppercase', fontWeight: 800, marginBottom: '10px' }}>Вироблено деталей</div>
        <div style={{ fontSize: '2.5rem', fontWeight: 900, color: '#fff' }}>{generalStats.producedParts}</div>
        <div style={{ fontSize: '0.8rem', color: '#888', marginTop: '10px' }}>Загалом по всіх етапах</div>
      </div>
    </div>
  )
}
