import React from 'react'
import { isShop1Task } from '../utils/masterHelpers'

export function MasterAnalytics({
  totalProduced = 0,
  totalScrapCount = 0,
  tasks = [],
  theme = 'dark'
}) {
  const isLight = theme === 'light'
  const inProgressCount = (tasks || []).filter(t => t.status === 'in-progress' && isShop1Task(t)).length

  return (
    <div className="analytics-scroll" style={{ overflowX: 'auto', marginBottom: '25px', display: 'flex', gap: '15px', paddingBottom: '10px' }}>
      <div className="ana-card-v2" style={{ minWidth: '140px', flex: 1, background: isLight ? '#ffffff' : '#111111', padding: '15px', borderRadius: '16px', border: isLight ? '1px solid #e2e8f0' : '1px solid #222222', boxShadow: isLight ? '0 1px 3px rgba(0,0,0,0.05)' : 'none' }}>
        <div style={{ color: isLight ? '#64748b' : '#555555', fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase' }}>Виконано</div>
        <div style={{ fontSize: '1.2rem', fontWeight: 900, color: isLight ? '#ea580c' : '#ff9000' }}>{(Number(totalProduced) || 0).toString()}</div>
      </div>
      <div className="ana-card-v2" style={{ minWidth: '140px', flex: 1, background: isLight ? '#ffffff' : '#111111', padding: '15px', borderRadius: '16px', border: isLight ? '1px solid #e2e8f0' : '1px solid #222222', boxShadow: isLight ? '0 1px 3px rgba(0,0,0,0.05)' : 'none' }}>
        <div style={{ color: isLight ? '#64748b' : '#555555', fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase' }}>Брак</div>
        <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#ef4444' }}>{(Number(totalScrapCount) || 0).toString()} <small style={{ fontSize: '0.7rem' }}>шт</small></div>
      </div>
      <div className="ana-card-v2" style={{ minWidth: '140px', flex: 1, background: isLight ? '#ffffff' : '#111111', padding: '15px', borderRadius: '16px', border: isLight ? '1px solid #e2e8f0' : '1px solid #222222', boxShadow: isLight ? '0 1px 3px rgba(0,0,0,0.05)' : 'none' }}>
        <div style={{ color: isLight ? '#64748b' : '#555555', fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase' }}>В роботі</div>
        <div style={{ fontSize: '1.2rem', fontWeight: 900, color: isLight ? '#0284c7' : '#3b82f6' }}>{inProgressCount}</div>
      </div>
    </div>
  )
}
