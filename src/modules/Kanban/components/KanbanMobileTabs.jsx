import React from 'react'
import { COLUMNS } from '../utils/kanbanHelpers'

export const KanbanMobileTabs = ({
  activeMobileColumn,
  setActiveMobileColumn,
  filteredTasks,
  filteredCompletedTasks,
  completedCount,
  filterMode,
  selectedDeptFilter,
  searchQuery
}) => {
  const hasActiveFilters = filterMode !== 'all' || selectedDeptFilter !== 'all' || searchQuery

  return (
    <div className="kb-mobile-tabs">
      {COLUMNS.map(col => {
        const cnt = col.id === 'done'
          ? (hasActiveFilters ? filteredCompletedTasks.length : completedCount)
          : filteredTasks.filter(t => t.status === col.id).length
        return (
          <button key={col.id} className={`mob-tab ${activeMobileColumn === col.id ? 'active' : ''}`}
            style={{ '--cc': col.color }} onClick={() => setActiveMobileColumn(col.id)}>
            <span>{col.title}</span>
            <span className="mob-tab-cnt" style={{ background: `${col.color}20`, color: col.color }}>{cnt}</span>
          </button>
        )
      })}
    </div>
  )
}
