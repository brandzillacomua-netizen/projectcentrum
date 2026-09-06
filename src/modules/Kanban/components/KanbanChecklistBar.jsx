import React from 'react'
import { CheckSquare } from 'lucide-react'
import { checklistProgress } from '../utils/kanbanHelpers'

export const ChecklistBar = ({ checklist }) => {
  const p = checklistProgress(checklist)
  if (!p) return null
  return (
    <div className="checklist-bar-wrap">
      <div className="checklist-bar-track">
        <div className="checklist-bar-fill" style={{ width: `${p.pct}%`, background: p.pct === 100 ? '#10b981' : '#3b82f6' }} />
      </div>
      <span className="checklist-bar-label" style={{ color: p.pct === 100 ? '#10b981' : '#888' }}>
        <CheckSquare size={10} /> {p.done}/{p.total}
      </span>
    </div>
  )
}
