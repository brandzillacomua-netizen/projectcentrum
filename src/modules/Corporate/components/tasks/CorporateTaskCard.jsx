import React from 'react'
import {
  Calendar,
  Clock,
  User,
  Trash2,
  CheckCircle2,
  AlertCircle,
  CheckSquare,
  Square
} from 'lucide-react'
import { TASK_STATUSES, TASK_PRIORITIES } from '../../utils/corporateHelpers'
import { CorporateAvatar } from '../common/CorporateAvatar'

export function CorporateTaskCard({
  task,
  currentUser,
  users = [],
  onUpdateStatus,
  onToggleChecklistItem,
  onDelete
}) {
  const assignee = task.assignee
  const creator = task.creator
  const assigneeName = assignee ? `${assignee.first_name || ''} ${assignee.last_name || ''}`.trim() || assignee.login : 'Не призначено'
  const creatorName = creator ? `${creator.first_name || ''} ${creator.last_name || ''}`.trim() || creator.login : 'Автор'

  const statusConfig = TASK_STATUSES[task.status] || TASK_STATUSES.pending
  const priorityConfig = TASK_PRIORITIES[task.priority] || TASK_PRIORITIES.medium

  const isCreator = String(task.creator_id) === String(currentUser?.id)
  const isAssignee = String(task.assignee_id) === String(currentUser?.id)
  const isAdmin = currentUser?.login === 'admin@workshop.local' ||
    currentUser?.position === 'Адмін' ||
    currentUser?.access_rights?.director

  // Deadline calculation
  let deadlineLabel = null
  let isOverdue = false
  if (task.deadline) {
    const dDate = new Date(task.deadline)
    const now = new Date()
    isOverdue = dDate < now && task.status !== 'done'
    deadlineLabel = dDate.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  }

  const checklist = Array.isArray(task.checklist) ? task.checklist : []
  const completedChecklistCount = checklist.filter(c => c.completed).length

  return (
    <div
      className="corp-card"
      style={{
        padding: '18px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        borderLeft: isOverdue ? '4px solid #ef4444' : (task.status === 'done' ? '4px solid #10b981' : undefined)
      }}
    >
      {/* Top Header: Priority, Deadline, Status Selector */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Priority */}
          <span
            style={{
              fontSize: '0.7rem',
              fontWeight: 900,
              color: priorityConfig.color,
              background: `${priorityConfig.color}15`,
              border: `1px solid ${priorityConfig.color}35`,
              padding: '2px 8px',
              borderRadius: '6px'
            }}
          >
            {priorityConfig.label}
          </span>

          {/* Deadline */}
          {deadlineLabel && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '0.74rem',
                fontWeight: 800,
                color: isOverdue ? '#ef4444' : (task.status === 'done' ? 'var(--ch-text-dim)' : 'var(--ch-text-muted)'),
                background: isOverdue ? 'rgba(239, 68, 68, 0.12)' : 'var(--ch-surface-inset)',
                padding: '3px 8px',
                borderRadius: '6px',
                border: '1px solid var(--ch-border)'
              }}
            >
              <Calendar size={12} />
              <span>{isOverdue ? `Протерміновано: ${deadlineLabel}` : `Термін: ${deadlineLabel}`}</span>
            </div>
          )}
        </div>

        {/* Status Dropdown */}
        <select
          value={task.status}
          onChange={e => onUpdateStatus(task.id, e.target.value)}
          className="corp-select"
          style={{
            background: statusConfig.bg,
            color: statusConfig.color,
            borderColor: `${statusConfig.color}40`,
            fontWeight: 800
          }}
        >
          {Object.values(TASK_STATUSES).map(st => (
            <option key={st.id} value={st.id}>
              {st.label}
            </option>
          ))}
        </select>
      </div>

      {/* Task Title & Description */}
      <div>
        <h4
          style={{
            margin: 0,
            fontSize: '1.02rem',
            fontWeight: 800,
            color: task.status === 'done' ? 'var(--ch-text-dim)' : 'var(--ch-text-primary)',
            textDecoration: task.status === 'done' ? 'line-through' : 'none',
            lineHeight: 1.4
          }}
        >
          {task.title}
        </h4>
        {task.description && (
          <p style={{ margin: '6px 0 0 0', fontSize: '0.84rem', color: 'var(--ch-text-muted)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
            {task.description}
          </p>
        )}
      </div>

      {/* Checklist items if any */}
      {checklist.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'var(--ch-surface-inset)', padding: '12px 14px', borderRadius: '12px', border: '1px solid var(--ch-border)' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--ch-text-dim)', display: 'flex', justifyContent: 'space-between' }}>
            <span>Чек-лист виконання</span>
            <span>{completedChecklistCount} із {checklist.length}</span>
          </div>

          {/* Progress bar */}
          <div style={{ width: '100%', height: '5px', background: 'var(--ch-border)', borderRadius: '3px', overflow: 'hidden' }}>
            <div
              style={{
                width: `${(completedChecklistCount / checklist.length) * 100}%`,
                height: '100%',
                background: completedChecklistCount === checklist.length ? '#10b981' : 'var(--ch-accent)',
                transition: 'width 0.25s ease'
              }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
            {checklist.map((item, idx) => (
              <div
                key={idx}
                onClick={() => onToggleChecklistItem(task.id, idx)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  fontSize: '0.82rem',
                  color: item.completed ? 'var(--ch-text-dim)' : 'var(--ch-text-secondary)',
                  textDecoration: item.completed ? 'line-through' : 'none'
                }}
              >
                <div style={{ color: item.completed ? '#10b981' : 'var(--ch-text-dim)' }}>
                  {item.completed ? <CheckSquare size={16} /> : <Square size={16} />}
                </div>
                <span>{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer: Assignee, Creator & Delete */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '10px', borderTop: '1px solid var(--ch-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {/* Assignee */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CorporateAvatar
              user={assignee}
              size={24}
            />
            <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--ch-text-primary)' }}>
              {assigneeName}
            </div>
          </div>

          {/* Creator */}
          <div style={{ fontSize: '0.72rem', color: 'var(--ch-text-dim)' }}>
            від: {creatorName}
          </div>
        </div>

        {(isCreator || isAdmin) && (
          <button
            type="button"
            onClick={() => onDelete(task.id)}
            className="corp-footer-action-btn"
            style={{ padding: '4px 8px' }}
            onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--ch-text-dim)'}
            title="Видалити завдання"
          >
            <Trash2 size={15} />
          </button>
        )}
      </div>
    </div>
  )
}
