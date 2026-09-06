import React from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Activity } from 'lucide-react'

export function MachinesNavbar({ stats }) {
  return (
    <nav className="module-nav" style={{ 
      flexShrink: 0, padding: '0 30px', height: '70px', background: '#000', 
      borderBottom: '1px solid #1a1a1a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' 
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        <Link to="/" style={{ color: '#555', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', fontWeight: 700 }}>
          <ArrowLeft size={18} /> На головну
        </Link>
        <div style={{ width: '1px', height: '20px', background: '#222' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Activity className="text-orange" size={24} color="#ff9000" />
          <h1 style={{ fontSize: '1rem', fontWeight: 950, textTransform: 'uppercase', letterSpacing: '1px', margin: 0 }}>Парк обладнання</h1>
        </div>
      </div>
      
      <div style={{ display: 'flex', gap: '20px' }}>
        <div className="stat-pill">Всього: <strong>{stats.total}</strong></div>
        <div className="stat-pill">Зайняті: <strong style={{color: '#ef4444'}}>{stats.busy}</strong></div>
        <div className="stat-pill">Вільні: <strong style={{color: '#10b981'}}>{stats.idle}</strong></div>
        <div className="stat-pill">В ремонті: <strong style={{color: '#eab308'}}>{stats.repair}</strong></div>
      </div>
    </nav>
  )
}
