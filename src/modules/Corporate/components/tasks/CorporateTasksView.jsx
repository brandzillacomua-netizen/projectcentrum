import React, { useState, useMemo } from 'react'
import {
  CheckSquare,
  Plus,
  Search,
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  User,
  Edit3,
  Trash2,
  RotateCcw,
  LayoutGrid,
  List,
  Sparkles,
  Layers,
  ArrowRight
} from 'lucide-react'
import { useMES } from '../../../../MESContext'
import { CorporateAvatar } from '../common/CorporateAvatar'
import { KanbanTaskModal } from '../../../Kanban/components/modals/KanbanTaskModal'
import KanbanModule from '../../../KanbanModule'
import {
  COLUMNS,
  PRIORITY_CFG,
  isOverdueTask,
  getAssignees,
  checklistProgress,
  toggleChecklistItem
} from '../../../Kanban/utils/kanbanHelpers'

export function CorporateTasksView({
  onOpenNewTaskModal
}) {
  const {
    managementTasks = [],
    currentUser,
    systemUsers = [],
    updateManagementTask,
    deleteManagementTask,
    companyStructure = []
  } = useMES()

  // View presentation mode: 'stream' (псевдосписок) | 'kanban' (повна дошка)
  const [viewMode, setViewMode] = useState('stream')

  // Filters
  const [scopeFilter, setScopeFilter] = useState('all') // 'all', 'my', 'created_by_me'
  const [statusFilter, setStatusFilter] = useState('active') // 'active', 'all', 'todo', 'in_progress', 'review', 'done', 'overdue'
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedChecklists, setExpandedChecklists] = useState({}) // { [taskId]: boolean }

  // Task modal editing
  const [editingTask, setEditingTask] = useState(null)
  const [isNewTaskModalOpen, setIsNewTaskModalOpen] = useState(false)

  const currentLogin = currentUser?.login || ''
  const isDirector = useMemo(() => {
    const pos = (currentUser?.position || '').toLowerCase()
    const rights = currentUser?.access_rights || {}
    return !!(rights.director || pos.includes('директор') || pos.includes('адмін') || pos.includes('керівник підприємства'))
  }, [currentUser])

  // Helper map for users by login
  const usersByLogin = useMemo(() => {
    const map = {}
    ;(systemUsers || []).forEach(u => {
      if (u.login) map[u.login] = u
    })
    return map
  }, [systemUsers])

  // Metrics calculation
  const metrics = useMemo(() => {
    const total = managementTasks.length
    const active = managementTasks.filter(t => t.status !== 'done').length
    const todo = managementTasks.filter(t => t.status === 'todo').length
    const inProgress = managementTasks.filter(t => t.status === 'in_progress').length
    const review = managementTasks.filter(t => t.status === 'review').length
    const done = managementTasks.filter(t => t.status === 'done').length
    const overdue = managementTasks.filter(t => isOverdueTask(t)).length

    return { total, active, todo, inProgress, review, done, overdue }
  }, [managementTasks])

  // Filtered task stream
  const filteredTasks = useMemo(() => {
    return managementTasks.filter(task => {
      const assignees = getAssignees(task)
      const isAssignedToMe = assignees.includes(currentLogin)
      const isCreatedByMe = task.created_by === currentLogin

      // Scope filter
      if (scopeFilter === 'my' && !isAssignedToMe) return false
      if (scopeFilter === 'created_by_me' && !isCreatedByMe) return false

      // Status filter
      if (statusFilter === 'active' && task.status === 'done') return false
      if (statusFilter === 'overdue' && !isOverdueTask(task)) return false
      if (['todo', 'in_progress', 'review', 'done'].includes(statusFilter) && task.status !== statusFilter) {
        return false
      }

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const titleMatch = (task.title || '').toLowerCase().includes(q)
        const descMatch = (task.description || '').toLowerCase().includes(q)
        const assigneeMatch = assignees.some(login => {
          const u = usersByLogin[login]
          if (!u) return login.toLowerCase().includes(q)
          const name = `${u.first_name || ''} ${u.last_name || ''} ${u.login || ''}`.toLowerCase()
          return name.includes(q)
        })
        if (!titleMatch && !descMatch && !assigneeMatch) return false
      }

      return true
    })
  }, [managementTasks, scopeFilter, statusFilter, searchQuery, currentLogin, usersByLogin])

  // Action helpers
  const handleAdvanceStatus = async (task, newStatus) => {
    if (!updateManagementTask) return
    const updates = { status: newStatus }
    if (newStatus === 'in_progress' && !task.assigned_to) {
      updates.assigned_to = currentLogin
    }
    await updateManagementTask(task.id, updates)
  }

  const handleToggleChecklist = (taskId) => {
    setExpandedChecklists(prev => ({
      ...prev,
      [taskId]: !prev[taskId]
    }))
  }

  const handleChecklistTick = async (task, itemId, e) => {
    e.stopPropagation()
    if (!updateManagementTask) return
    const currentList = Array.isArray(task.checklist) ? task.checklist : []
    const updated = toggleChecklistItem(currentList, itemId)
    await updateManagementTask(task.id, { checklist: updated })
  }

  const handleDeleteTask = async (taskId, e) => {
    e.stopPropagation()
    if (!window.confirm('Ви впевнені, що хочете видалити це завдання?')) return
    if (deleteManagementTask) {
      await deleteManagementTask(taskId)
    }
  }

  const canDeleteTask = (task) => {
    return isDirector || task.created_by === currentLogin || currentUser?.login === 'admin@workshop.local'
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
      {/* ── TOP ACTION & VIEW MODE BAR ────────────────────────────────────────── */}
      <div className="corp-card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* View mode toggle */}
          <div className="corp-tabs-group" style={{ background: 'var(--ch-surface-inset)', padding: '3px' }}>
            <button
              type="button"
              className={`corp-tab-btn ${viewMode === 'stream' ? 'active' : ''}`}
              onClick={() => setViewMode('stream')}
              style={{ padding: '6px 14px', fontSize: '0.8rem' }}
            >
              <List size={15} />
              <span>Псевдосписок (Стрічка)</span>
            </button>

            <button
              type="button"
              className={`corp-tab-btn ${viewMode === 'kanban' ? 'active' : ''}`}
              onClick={() => setViewMode('kanban')}
              style={{ padding: '6px 14px', fontSize: '0.8rem' }}
            >
              <LayoutGrid size={15} />
              <span>Повна дошка Канбан</span>
            </button>
          </div>
        </div>

        {/* Create Task button */}
        <button
          type="button"
          onClick={() => (onOpenNewTaskModal ? onOpenNewTaskModal() : setIsNewTaskModalOpen(true))}
          className="corp-btn-primary"
          style={{ padding: '8px 16px', fontSize: '0.82rem' }}
        >
          <Plus size={16} />
          <span>Створити задачу</span>
        </button>
      </div>

      {/* ── CONDITIONAL RENDERING: FULL KANBAN BOARD OR RESPONSIVE STREAM ─────── */}
      {viewMode === 'kanban' ? (
        <div style={{ width: '100%', overflowX: 'auto' }}>
          <KanbanModule />
        </div>
      ) : (
        <>
          {/* ── QUICK METRICS COUNTERS ──────────────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
            {/* Active total */}
            <div
              className="corp-card"
              onClick={() => setStatusFilter('active')}
              style={{
                padding: '12px 14px',
                cursor: 'pointer',
                borderLeft: statusFilter === 'active' ? '3px solid var(--ch-accent)' : undefined,
                background: statusFilter === 'active' ? 'var(--ch-accent-subtle)' : undefined
              }}
            >
              <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--ch-text-dim)', textTransform: 'uppercase' }}>
                В роботі & черзі
              </div>
              <div style={{ fontSize: '1.35rem', fontWeight: 900, color: 'var(--ch-text-primary)', marginTop: '4px' }}>
                {metrics.active}
              </div>
            </div>

            {/* In progress */}
            <div
              className="corp-card"
              onClick={() => setStatusFilter('in_progress')}
              style={{
                padding: '12px 14px',
                cursor: 'pointer',
                borderLeft: statusFilter === 'in_progress' ? '3px solid #3b82f6' : undefined,
                background: statusFilter === 'in_progress' ? 'rgba(59, 130, 246, 0.1)' : undefined
              }}
            >
              <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#3b82f6', textTransform: 'uppercase' }}>
                В роботі
              </div>
              <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#3b82f6', marginTop: '4px' }}>
                {metrics.inProgress}
              </div>
            </div>

            {/* Todo */}
            <div
              className="corp-card"
              onClick={() => setStatusFilter('todo')}
              style={{
                padding: '12px 14px',
                cursor: 'pointer',
                borderLeft: statusFilter === 'todo' ? '3px solid #8b5cf6' : undefined,
                background: statusFilter === 'todo' ? 'rgba(139, 92, 246, 0.1)' : undefined
              }}
            >
              <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#8b5cf6', textTransform: 'uppercase' }}>
                В черзі
              </div>
              <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#8b5cf6', marginTop: '4px' }}>
                {metrics.todo}
              </div>
            </div>

            {/* Review */}
            <div
              className="corp-card"
              onClick={() => setStatusFilter('review')}
              style={{
                padding: '12px 14px',
                cursor: 'pointer',
                borderLeft: statusFilter === 'review' ? '3px solid #f59e0b' : undefined,
                background: statusFilter === 'review' ? 'rgba(245, 158, 11, 0.1)' : undefined
              }}
            >
              <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#f59e0b', textTransform: 'uppercase' }}>
                На перевірці
              </div>
              <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#f59e0b', marginTop: '4px' }}>
                {metrics.review}
              </div>
            </div>

            {/* Overdue */}
            <div
              className="corp-card"
              onClick={() => setStatusFilter('overdue')}
              style={{
                padding: '12px 14px',
                cursor: 'pointer',
                borderLeft: statusFilter === 'overdue' ? '3px solid #ef4444' : undefined,
                background: statusFilter === 'overdue' ? 'rgba(239, 68, 68, 0.1)' : undefined
              }}
            >
              <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#ef4444', textTransform: 'uppercase' }}>
                Прострочено
              </div>
              <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#ef4444', marginTop: '4px' }}>
                {metrics.overdue}
              </div>
            </div>

            {/* Done */}
            <div
              className="corp-card"
              onClick={() => setStatusFilter('done')}
              style={{
                padding: '12px 14px',
                cursor: 'pointer',
                borderLeft: statusFilter === 'done' ? '3px solid #10b981' : undefined,
                background: statusFilter === 'done' ? 'rgba(16, 185, 129, 0.1)' : undefined
              }}
            >
              <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#10b981', textTransform: 'uppercase' }}>
                Виконано
              </div>
              <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#10b981', marginTop: '4px' }}>
                {metrics.done}
              </div>
            </div>
          </div>

          {/* ── FILTER & SEARCH TOOLBAR ──────────────────────────────────────── */}
          <div className="corp-card" style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Top row: Scope & Search */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
              {/* Scope filter pills */}
              <div className="corp-filter-chips">
                <button
                  type="button"
                  className={`corp-chip ${scopeFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setScopeFilter('all')}
                >
                  <span>Усі завдання ({managementTasks.length})</span>
                </button>

                <button
                  type="button"
                  className={`corp-chip ${scopeFilter === 'my' ? 'active' : ''}`}
                  onClick={() => setScopeFilter('my')}
                >
                  <User size={13} />
                  <span>Мої завдання ({managementTasks.filter(t => getAssignees(t).includes(currentLogin)).length})</span>
                </button>

                <button
                  type="button"
                  className={`corp-chip ${scopeFilter === 'created_by_me' ? 'active' : ''}`}
                  onClick={() => setScopeFilter('created_by_me')}
                >
                  <span>Доручено мною ({managementTasks.filter(t => t.created_by === currentLogin).length})</span>
                </button>
              </div>

              {/* Search */}
              <div className="corp-search-box" style={{ maxWidth: '280px', width: '100%' }}>
                <Search size={14} color="var(--ch-text-dim)" />
                <input
                  type="text"
                  className="corp-search-input"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Пошук завдання або виконавця..."
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    style={{ background: 'none', border: 'none', color: 'var(--ch-text-dim)', cursor: 'pointer', padding: 0 }}
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* Bottom row: Status selector pills */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--ch-text-dim)', textTransform: 'uppercase' }}>
                Статус:
              </span>

              <button
                type="button"
                className={`corp-btn-subtle ${statusFilter === 'active' ? 'active' : ''}`}
                onClick={() => setStatusFilter('active')}
                style={{ padding: '4px 10px', fontSize: '0.74rem' }}
              >
                Активні ({metrics.active})
              </button>

              <button
                type="button"
                className={`corp-btn-subtle ${statusFilter === 'in_progress' ? 'active' : ''}`}
                onClick={() => setStatusFilter('in_progress')}
                style={{ padding: '4px 10px', fontSize: '0.74rem', color: '#3b82f6' }}
              >
                В роботі ({metrics.inProgress})
              </button>

              <button
                type="button"
                className={`corp-btn-subtle ${statusFilter === 'todo' ? 'active' : ''}`}
                onClick={() => setStatusFilter('todo')}
                style={{ padding: '4px 10px', fontSize: '0.74rem', color: '#8b5cf6' }}
              >
                В черзі ({metrics.todo})
              </button>

              <button
                type="button"
                className={`corp-btn-subtle ${statusFilter === 'review' ? 'active' : ''}`}
                onClick={() => setStatusFilter('review')}
                style={{ padding: '4px 10px', fontSize: '0.74rem', color: '#f59e0b' }}
              >
                На перевірці ({metrics.review})
              </button>

              <button
                type="button"
                className={`corp-btn-subtle ${statusFilter === 'done' ? 'active' : ''}`}
                onClick={() => setStatusFilter('done')}
                style={{ padding: '4px 10px', fontSize: '0.74rem', color: '#10b981' }}
              >
                Виконані ({metrics.done})
              </button>

              <button
                type="button"
                className={`corp-btn-subtle ${statusFilter === 'all' ? 'active' : ''}`}
                onClick={() => setStatusFilter('all')}
                style={{ padding: '4px 10px', fontSize: '0.74rem' }}
              >
                Усі без фільтру ({metrics.total})
              </button>
            </div>
          </div>

          {/* ── VERTICAL TASK PSEUDO-LIST STREAM ─────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
            {filteredTasks.map(task => {
              const priority = PRIORITY_CFG[task.priority] || PRIORITY_CFG.medium
              const isOverdue = isOverdueTask(task)
              const assignees = getAssignees(task)
              const checklist = Array.isArray(task.checklist) ? task.checklist : []
              const chProgress = checklistProgress(checklist)
              const isExpanded = !!expandedChecklists[task.id]

              // Border indicator color
              const leftColor = task.color || (isOverdue ? '#ef4444' : (task.status === 'done' ? '#10b981' : priority.color))

              // Status presentation
              const statusCfg = {
                todo: { label: 'В ЧЕРЗІ', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.12)' },
                in_progress: { label: 'В РОБОТІ', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.12)' },
                review: { label: 'ПЕРЕВІРКА', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)' },
                done: { label: 'ВИКОНАНО', color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)' }
              }[task.status] || { label: task.status, color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.12)' }

              return (
                <div
                  key={task.id}
                  className="corp-card"
                  style={{
                    padding: '16px 20px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    borderLeft: `4px solid ${leftColor}`,
                    transition: 'all 0.15s ease'
                  }}
                >
                  {/* Card Header: Badges & Edit actions */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      {/* Status badge */}
                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 900,
                          color: statusCfg.color,
                          background: statusCfg.bg,
                          border: `1px solid ${statusCfg.color}35`,
                          padding: '3px 9px',
                          borderRadius: '6px',
                          letterSpacing: '0.03em'
                        }}
                      >
                        {statusCfg.label}
                      </span>

                      {/* Priority badge */}
                      <span
                        style={{
                          fontSize: '0.7rem',
                          fontWeight: 800,
                          color: priority.color,
                          background: priority.bg,
                          border: `1px solid ${priority.color}35`,
                          padding: '2px 8px',
                          borderRadius: '6px'
                        }}
                      >
                        {priority.label}
                      </span>

                      {/* Collective / Department */}
                      {task.is_collective && (
                        <span
                          style={{
                            fontSize: '0.7rem',
                            fontWeight: 800,
                            color: '#a855f7',
                            background: 'rgba(168, 85, 247, 0.1)',
                            border: '1px solid rgba(168, 85, 247, 0.25)',
                            padding: '2px 8px',
                            borderRadius: '6px'
                          }}
                        >
                          Колективна ({task.department || 'Усі'})
                        </span>
                      )}
                    </div>

                    {/* Right actions: Edit & Delete */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <button
                        type="button"
                        onClick={() => setEditingTask(task)}
                        className="corp-btn-subtle"
                        style={{ padding: '4px 8px', fontSize: '0.72rem' }}
                        title="Редагувати задачу в системній модалці"
                      >
                        <Edit3 size={13} />
                        <span>Редагувати</span>
                      </button>

                      {canDeleteTask(task) && (
                        <button
                          type="button"
                          onClick={(e) => handleDeleteTask(task.id, e)}
                          className="corp-btn-subtle"
                          style={{ padding: '4px 8px', fontSize: '0.72rem', color: '#ef4444' }}
                          title="Видалити завдання"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Title & Description */}
                  <div>
                    <h3
                      onClick={() => setEditingTask(task)}
                      style={{
                        margin: 0,
                        fontSize: '1rem',
                        fontWeight: 800,
                        color: 'var(--ch-text-primary)',
                        cursor: 'pointer',
                        lineHeight: 1.4
                      }}
                      title="Натисніть для перегляду та редагування"
                    >
                      {task.title}
                    </h3>

                    {task.description && (
                      <p
                        style={{
                          margin: '6px 0 0 0',
                          fontSize: '0.84rem',
                          color: 'var(--ch-text-secondary)',
                          lineHeight: 1.5,
                          whiteSpace: 'pre-line'
                        }}
                      >
                        {task.description}
                      </p>
                    )}
                  </div>

                  {/* Checklist Bar & Collapsible Items */}
                  {checklist.length > 0 && (
                    <div style={{ background: 'var(--ch-surface-inset)', borderRadius: '10px', padding: '10px 12px', border: '1px solid var(--ch-border)' }}>
                      <div
                        onClick={() => handleToggleChecklist(task.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          cursor: 'pointer',
                          userSelect: 'none'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <CheckSquare size={14} color="var(--ch-accent)" />
                          <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--ch-text-primary)' }}>
                            Чек-лист: {chProgress ? `${chProgress.done}/${chProgress.total} (${chProgress.pct}%)` : `${checklist.length} пунктів`}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', color: 'var(--ch-text-dim)' }}>
                          <span>{isExpanded ? 'Згорнути' : 'Розгорнути'}</span>
                          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </div>
                      </div>

                      {/* Progress line */}
                      {chProgress && (
                        <div style={{ height: '5px', width: '100%', background: 'rgba(255,255,255,0.08)', borderRadius: '4px', overflow: 'hidden', marginTop: '8px' }}>
                          <div
                            style={{
                              height: '100%',
                              width: `${chProgress.pct}%`,
                              background: chProgress.pct === 100 ? '#10b981' : 'var(--ch-accent)',
                              transition: 'width 0.25s ease'
                            }}
                          />
                        </div>
                      )}

                      {/* Interactive checkboxes list */}
                      {isExpanded && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '10px', paddingTop: '8px', borderTop: '1px solid var(--ch-border)' }}>
                          {checklist.map(item => (
                            <label
                              key={item.id}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '9px',
                                fontSize: '0.8rem',
                                color: item.done ? 'var(--ch-text-dim)' : 'var(--ch-text-primary)',
                                textDecoration: item.done ? 'line-through' : 'none',
                                cursor: 'pointer',
                                padding: '4px 6px',
                                borderRadius: '6px',
                                background: item.done ? 'rgba(0,0,0,0.05)' : 'transparent'
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={!!item.done}
                                onChange={(e) => handleChecklistTick(task, item.id, e)}
                                style={{ cursor: 'pointer', accentColor: 'var(--ch-accent)', width: '15px', height: '15px' }}
                              />
                              <span>{item.text}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Card Footer: Assignees, Deadline & Action Buttons */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', paddingTop: '4px' }}>
                    {/* Left: Assignees & Deadline */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                      {/* Assignees avatars */}
                      {assignees.length > 0 ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', marginLeft: '4px' }}>
                            {assignees.slice(0, 3).map((login, idx) => {
                              const userObj = usersByLogin[login]
                              return (
                                <div
                                  key={login}
                                  style={{
                                    marginLeft: idx > 0 ? '-8px' : 0,
                                    zIndex: 5 - idx
                                  }}
                                  title={userObj ? `${userObj.first_name || ''} ${userObj.last_name || ''}`.trim() || login : login}
                                >
                                  <CorporateAvatar
                                    user={userObj || { login }}
                                    size={28}
                                    borderRadius="50%"
                                  />
                                </div>
                              )
                            })}
                          </div>
                          <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--ch-text-secondary)' }}>
                            {assignees.length === 1
                              ? (usersByLogin[assignees[0]] ? `${usersByLogin[assignees[0]].first_name || ''} ${usersByLogin[assignees[0]].last_name || ''}`.trim() || assignees[0] : assignees[0])
                              : `${assignees.length} виконавців`}
                          </span>
                        </div>
                      ) : (
                        <span style={{ fontSize: '0.72rem', color: 'var(--ch-text-dim)', fontStyle: 'italic' }}>
                          Виконавця не призначено
                        </span>
                      )}

                      {/* Deadline badge */}
                      {task.deadline ? (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                            fontSize: '0.74rem',
                            fontWeight: 800,
                            color: isOverdue ? '#ef4444' : 'var(--ch-text-muted)',
                            background: isOverdue ? 'rgba(239, 68, 68, 0.12)' : 'var(--ch-surface-inset)',
                            border: `1px solid ${isOverdue ? 'rgba(239, 68, 68, 0.3)' : 'var(--ch-border)'}`,
                            padding: '3px 8px',
                            borderRadius: '6px'
                          }}
                        >
                          <Calendar size={12} />
                          <span>
                            {isOverdue ? 'Протерміновано: ' : 'Термін: '}
                            {new Date(task.deadline).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      ) : (
                        <span style={{ fontSize: '0.72rem', color: 'var(--ch-text-dim)' }}>
                          Без терміну
                        </span>
                      )}
                    </div>

                    {/* Right: Quick Action Buttons */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {task.status === 'todo' && (
                        <button
                          type="button"
                          onClick={() => handleAdvanceStatus(task, 'in_progress')}
                          className="corp-btn-primary"
                          style={{ padding: '6px 12px', fontSize: '0.78rem' }}
                        >
                          <span>▶ Почати</span>
                        </button>
                      )}

                      {task.status === 'in_progress' && (
                        <button
                          type="button"
                          onClick={() => handleAdvanceStatus(task, 'review')}
                          style={{
                            background: '#f59e0b',
                            border: 'none',
                            color: '#ffffff',
                            borderRadius: '8px',
                            padding: '6px 12px',
                            fontSize: '0.78rem',
                            fontWeight: 800,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px'
                          }}
                        >
                          <span>⚙ На перевірку</span>
                        </button>
                      )}

                      {task.status === 'review' && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleAdvanceStatus(task, 'done')}
                            style={{
                              background: '#10b981',
                              border: 'none',
                              color: '#ffffff',
                              borderRadius: '8px',
                              padding: '6px 12px',
                              fontSize: '0.78rem',
                              fontWeight: 800,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <CheckCircle2 size={13} />
                            <span>Прийняти</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleAdvanceStatus(task, 'in_progress')}
                            className="corp-btn-subtle"
                            style={{ padding: '6px 10px', fontSize: '0.78rem' }}
                          >
                            <span>Відхилити</span>
                          </button>
                        </>
                      )}

                      {task.status === 'done' && (
                        <button
                          type="button"
                          onClick={() => handleAdvanceStatus(task, 'in_progress')}
                          className="corp-btn-subtle"
                          style={{ padding: '6px 10px', fontSize: '0.78rem' }}
                          title="Повернути задачу в роботу"
                        >
                          <RotateCcw size={12} />
                          <span>Повернути</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}

            {/* Empty state */}
            {filteredTasks.length === 0 && (
              <div
                className="corp-card"
                style={{
                  padding: '50px 20px',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '12px'
                }}
              >
                <div
                  style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '16px',
                    background: 'var(--ch-surface-inset)',
                    border: '1px solid var(--ch-border)',
                    color: 'var(--ch-text-dim)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <CheckSquare size={26} strokeWidth={1.75} />
                </div>
                <div>
                  <h3 style={{ margin: '0 0 6px 0', fontSize: '1.05rem', fontWeight: 800, color: 'var(--ch-text-primary)' }}>
                    {searchQuery ? 'Завдань за запитом не знайдено' : 'Немає завдань у цьому фільтрі'}
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--ch-text-muted)', maxWidth: '400px' }}>
                    Створіть нову задачу для команди або оберіть інший статус у фільтрах вище.
                  </p>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── UNIFIED EDIT TASK MODAL (SYSTEM KANBAN TASK MODAL) ────────────────── */}
      {editingTask && (
        <KanbanTaskModal
          editTask={editingTask}
          onClose={() => setEditingTask(null)}
        />
      )}

      {/* ── UNIFIED NEW TASK MODAL (SYSTEM KANBAN TASK MODAL) ────────────────── */}
      {isNewTaskModalOpen && (
        <KanbanTaskModal
          onClose={() => setIsNewTaskModalOpen(false)}
        />
      )}
    </div>
  )
}
