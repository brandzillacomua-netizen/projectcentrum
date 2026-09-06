import React from 'react'
import { Flag } from 'lucide-react'
import { PRIORITY_CFG } from '../utils/kanbanHelpers'

export const PriorityBadge = ({ priority }) => {
  const cfg = PRIORITY_CFG[priority] || PRIORITY_CFG.medium
  return (
    <span className="priority-badge" style={{ color: cfg.color, background: cfg.bg, borderColor: `${cfg.color}30` }}>
      <Flag size={9} />
      {cfg.label}
    </span>
  )
}
