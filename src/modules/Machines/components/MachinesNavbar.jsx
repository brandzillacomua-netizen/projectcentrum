import React from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Activity } from 'lucide-react'

export function MachinesNavbar({ stats }) {
  return (
    <nav className="module-nav machines-top-nav">
      <div className="machines-nav-left">
        <Link to="/" className="machines-nav-back">
          <ArrowLeft size={18} />
          <span>На головну</span>
        </Link>
        <div className="machines-nav-divider" />
        <div className="machines-nav-brand">
          <Activity className="text-orange" size={22} color="#ff9000" />
          <h1 className="machines-nav-title">Парк обладнання</h1>
        </div>
      </div>
      
      <div className="machines-nav-stats">
        <div className="stat-pill">
          <span className="stat-label">Всього:</span> <strong>{stats.total}</strong>
        </div>
        <div className="stat-pill stat-pill-busy">
          <span className="stat-label">Зайняті:</span> <strong style={{ color: '#ef4444' }}>{stats.busy}</strong>
        </div>
        <div className="stat-pill stat-pill-idle">
          <span className="stat-label">Вільні:</span> <strong style={{ color: '#10b981' }}>{stats.idle}</strong>
        </div>
        <div className="stat-pill stat-pill-repair">
          <span className="stat-label">В ремонті:</span> <strong style={{ color: '#eab308' }}>{stats.repair}</strong>
        </div>
      </div>
    </nav>
  )
}
