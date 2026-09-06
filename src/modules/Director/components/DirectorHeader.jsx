import React from 'react'
import { ArrowLeft, LayoutDashboard, Bell, ChevronLeft, ChevronRight, Calendar, Layers } from 'lucide-react'
import { Link } from 'react-router-dom'

export const DirectorHeader = ({
  viewDate,
  changeMonth,
  setViewDate,
  viewMode,
  setViewMode,
  setIsApprovalsOpen,
  pendingTasksCount,
  totalPlannedSets
}) => {
  return (
    <div className="sticky-dashboard-header">
      <nav className="glass-nav-director">
        <div className="nav-left">
          <Link to="/" className="btn-back-director">
            <ArrowLeft size={18} /> <span>НАЗАД</span>
          </Link>
          <div className="brand-group">
            <LayoutDashboard className="text-orange" size={24} />
            <h1>DIRECTOR <span className="text-dim">DASHBOARD</span></h1>
          </div>
        </div>

        <div className="nav-right">
          <button className="btn-notifications" style={{ position: 'relative' }} onClick={() => setIsApprovalsOpen(true)}>
            <Bell size={20} />
            {pendingTasksCount > 0 && <span className="badge-count anim-pulse">{pendingTasksCount}</span>}
            <span className="btn-label">ПІДТВЕРДЖЕННЯ</span>
          </button>
        </div>
      </nav>

      <div className="strategic-header">
        <div className="month-selector-group">
          <button className="nav-btn" onClick={() => changeMonth(-1)}><ChevronLeft size={20} /></button>
          <div className="month-info-badge">
            <span className="month-name-compact">{viewDate.toLocaleDateString('uk-UA', { month: 'long' }).toUpperCase()}</span>
            <span className="year-divider">|</span>
            <span className="year-val-compact">{viewDate.getFullYear()}</span>
          </div>
          <button className="nav-btn" onClick={() => changeMonth(1)}><ChevronRight size={20} /></button>
        </div>

        <div className="header-meta-actions">
          <div className="gcal-view-toggle-group">
            <button
              className={`gcal-toggle-btn ${viewMode === 'calendar' ? 'active' : ''}`}
              onClick={() => setViewMode('calendar')}
            >
              <Calendar size={16} /> <span>КАЛЕНДАР</span>
            </button>
            <button
              className={`gcal-toggle-btn ${viewMode === 'matrix' ? 'active' : ''}`}
              onClick={() => setViewMode('matrix')}
            >
              <Layers size={16} /> <span>МАТРИЦЯ</span>
            </button>
          </div>

          <button onClick={() => setViewDate(new Date())} className="btn-jump-today">
            <Calendar size={16} />
            <span>СЬОГОДНІ</span>
          </button>
          <div className="analysis-summary-mini">
            <span className="meta-label">ЗАГАЛЬНИЙ ПЛАН:</span>
            <span className="meta-val text-orange">
              {totalPlannedSets} ШТ
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
