import React from 'react'
import { Layers, TrendingUp, AlertCircle, CheckCircle2 } from 'lucide-react'

export const KanbanStats = ({ stats, statsFilter, setStatsFilter }) => {
  return (
    <div className="kb-stats">
      {[
        { key: 'all', icon: <Layers size={16} />, val: stats.total, label: 'ВСЬОГО', color: '#ff9000' },
        { key: 'in_progress', icon: <TrendingUp size={16} />, val: stats.inProgress, label: 'В РОБОТІ', color: '#3b82f6' },
        { key: 'overdue', icon: <AlertCircle size={16} />, val: stats.overdue, label: 'ПРОСТРОЧЕНО', color: '#ef4444' },
        { key: 'done', icon: <CheckCircle2 size={16} />, val: stats.done, label: 'ВИКОНАНО', color: '#10b981' },
      ].map(s => (
        <div key={s.key} className={`stat-tile ${statsFilter === s.key ? 'active' : ''}`} style={{ '--sc': s.color }}
          onClick={() => setStatsFilter(prev => prev === s.key ? 'all' : s.key)}>
          <div className="st-icon" style={{ color: s.color }}>{s.icon}</div>
          <div className="st-body">
            <div className="st-num" style={{ color: s.color }}>{s.val}</div>
            <div className="st-label">{s.label}</div>
          </div>
          {s.key === 'overdue' && s.val > 0 && <div className="st-alert-dot" />}
        </div>
      ))}
    </div>
  )
}
