import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import {
  KanbanSquare, ArrowLeft, Plus, Clock, User, Users, Search, CheckCircle2,
  AlertCircle, X, MessageSquare, CheckSquare, Square, Trash2, Edit3,
  ChevronRight, MoreHorizontal, Flag, Calendar, Tag, Layers, Filter,
  TrendingUp, Zap, Shield, Eye, EyeOff, Save, RotateCcw, Briefcase,
  ChevronDown, ChevronUp, ChevronLeft,
} from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { useMES } from '../MESContext'

// ─── Helpers ────────────────────────────────────────────────────────────────

export const genId = () => Math.random().toString(36).slice(2) + Date.now().toString(36)

const getLastName = (user) => {
  if (!user) return 'Не призначено'
  return user.last_name || user.first_name || user.login || '?'
}

const getInitials = (user) => {
  if (!user) return '?'
  const last = (user.last_name || '')[0] || ''
  const first = (user.first_name || '')[0] || ''
  return (last + first).toUpperCase() || (user.login || '?')[0].toUpperCase()
}

const COLUMNS = [
  { id: 'todo', title: 'В ЧЕРЗІ', color: '#8b5cf6', glow: 'rgba(139,92,246,0.3)' },
  { id: 'in_progress', title: 'В РОБОТІ', color: '#3b82f6', glow: 'rgba(59,130,246,0.3)' },
  { id: 'review', title: 'ПЕРЕВІРКА', color: '#f59e0b', glow: 'rgba(245,158,11,0.3)' },
  { id: 'done', title: 'ВИКОНАНО', color: '#10b981', glow: 'rgba(16,185,129,0.3)' },
]

const PRIORITY_CFG = {
  low: { label: 'НИЗЬКИЙ', color: '#34d399', bg: 'rgba(52,211,153,0.12)' },
  medium: { label: 'СЕРЕДНІЙ', color: '#60a5fa', bg: 'rgba(96,165,250,0.12)' },
  high: { label: 'ВИСОКИЙ', color: '#fbbf24', bg: 'rgba(251,191,36,0.12)' },
  urgent: { label: 'НАГАЛЬНО', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
}

const getUserDeptId = (deptName, companyStructure) => {
  if (!deptName) return ''
  const d = deptName.toLowerCase().trim()

  if (Array.isArray(companyStructure)) {
    const match = companyStructure.find(item => {
      const name = (item.name || item.label || '').toLowerCase().trim()
      return name === d || d.includes(name) || name.includes(d)
    })
    if (match) return String(match.id)
  }

  if (d.includes('цех №1') || d.includes('цех 1')) return 'shop1'
  if (d.includes('цех №2') || d.includes('цех 2')) return 'shop2'
  if (d.includes('пакув')) return 'packaging'
  if (d.includes('склад')) return 'warehouse'
  if (d.includes('постач') || d.includes('закуп')) return 'supply'
  if (d.includes('логіст')) return 'logistics'
  if (d.includes('вкя') || d.includes('контрол')) return 'qa'
  if (d.includes('менедж') || d.includes('керівн') || d.includes('адмін')) return 'manager'
  return ''
}

const getTaskDepartment = (task, systemUsers, companyStructure) => {
  if (task.is_collective) {
    return task.department || 'all'
  }
  const assignee = (systemUsers || []).find(u => u.login === task.assigned_to)
  if (assignee) {
    return getUserDeptId(assignee.department, companyStructure) || 'all'
  }
  return 'all'
}

const isOverdueTask = (task) =>
  task.deadline && new Date(task.deadline) < new Date() && task.status !== 'done'

// Сумісний з одиночним assigned_to та масивом assignees
const getAssignees = (task) => {
  if (Array.isArray(task?.assignees) && task.assignees.length > 0) return task.assignees
  if (task?.assigned_to) return [task.assigned_to]
  return []
}


const checklistProgress = (checklist = []) => {
  if (!checklist.length) return null
  const parentIds = new Set()
  checklist.forEach(item => {
    if (item.parent_id) parentIds.add(String(item.parent_id))
  })
  const leaves = checklist.filter(item => !parentIds.has(String(item.id)))
  if (!leaves.length) {
    const done = checklist.filter(i => i.done).length
    return { done, total: checklist.length, pct: Math.round((done / checklist.length) * 100) }
  }
  const done = leaves.filter(i => i.done).length
  return { done, total: leaves.length, pct: Math.round((done / leaves.length) * 100) }
}

const toggleChecklistItem = (checklist, itemId) => {
  const item = checklist.find(i => String(i.id) === String(itemId))
  if (!item) return checklist
  const nextDone = !item.done

  const isParent = (id) => checklist.some(i => String(i.parent_id) === String(id))

  const toggleDescendants = (list, parentId, doneVal) => {
    return list.map(i => {
      if (String(i.parent_id) === String(parentId)) {
        const updated = { ...i, done: doneVal }
        if (isParent(i.id)) {
          return updated // Will be processed recursively or we do it inline:
        }
        return updated
      }
      return i
    })
  }

  // Deep recursive check
  const setAllChildren = (list, pId, val) => {
    let nextList = list.map(i => String(i.parent_id) === String(pId) ? { ...i, done: val } : i)
    list.forEach(i => {
      if (String(i.parent_id) === String(pId)) {
        nextList = setAllChildren(nextList, i.id, val)
      }
    })
    return nextList
  }

  let list = checklist.map(i => String(i.id) === String(itemId) ? { ...i, done: nextDone } : i)
  if (isParent(itemId)) {
    list = setAllChildren(list, itemId, nextDone)
  }

  let changed = true
  let iterations = 0
  while (changed && iterations < 10) {
    changed = false
    list = list.map(i => {
      const hasChildren = list.some(child => String(child.parent_id) === String(i.id))
      if (hasChildren) {
        const children = list.filter(child => String(child.parent_id) === String(i.id))
        const allDone = children.every(child => child.done)
        if (i.done !== allDone) {
          changed = true
          return { ...i, done: allDone }
        }
      }
      return i
    })
    iterations++
  }
  return list
}

// ─── Sub-components ──────────────────────────────────────────────────────────

const UserAvatar = ({ user, size = 28, showName = false }) => {
  const initials = getInitials(user)
  const lastName = getLastName(user)

  const getGradient = (name) => {
    switch (name) {
      case 'purple': return 'linear-gradient(135deg, #a855f7, #6366f1)';
      case 'blue': return 'linear-gradient(135deg, #3b82f6, #06b6d4)';
      case 'emerald': return 'linear-gradient(135deg, #10b981, #059669)';
      case 'ruby': return 'linear-gradient(135deg, #f43f5e, #be123c)';
      case 'orange': return 'linear-gradient(135deg, #ff9000, #ff5500)';
      default: return 'linear-gradient(135deg, #333, #111)';
    }
  }

  const isImg = user?.avatar && user.avatar.startsWith('data:image/')
  const bgStyle = isImg ? {} : { background: getGradient(user?.avatar) }

  return (
    <div className="user-avatar-wrap" title={lastName}>
      <div className="user-avatar" style={{ width: size, height: size, fontSize: size * 0.35, ...bgStyle }}>
        {isImg
          ? <img src={user.avatar} alt={initials} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
          : initials}
      </div>
      {showName && <span className="avatar-name">{lastName}</span>}
    </div>
  )
}

const PriorityBadge = ({ priority }) => {
  const cfg = PRIORITY_CFG[priority] || PRIORITY_CFG.medium
  return (
    <span className="priority-badge" style={{ color: cfg.color, background: cfg.bg, borderColor: `${cfg.color}30` }}>
      <Flag size={9} />
      {cfg.label}
    </span>
  )
}

const ChecklistBar = ({ checklist }) => {
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

// ─── AssigneeSelector (TOP-LEVEL — не всередині компонента, щоб не ремонтувався) ───
const AssigneeSelector = ({ value, onSelect, searchVal, setSearchVal, systemUsers, canClear, label = 'Призначити виконавця' }) => {
  const filterUsers = (q) => {
    if (!q) return []
    const lq = q.toLowerCase()
    return (systemUsers || []).filter(u =>
      (u.first_name || '').toLowerCase().includes(lq) ||
      (u.last_name || '').toLowerCase().includes(lq) ||
      (u.login || '').toLowerCase().includes(lq)
    ).slice(0, 6)
  }
  const results = filterUsers(searchVal)
  const selected = (systemUsers || []).find(u => u.login === value)
  return (
    <div className="form-group">
      <label>{label}</label>
      <div className="assignee-selector">
        {selected ? (
          <div className="selected-assignee">
            <UserAvatar user={selected} size={24} showName />
            {canClear && <button type="button" className="clear-btn" onClick={() => onSelect('')}><X size={12} /></button>}
          </div>
        ) : (
          <div className="assignee-search-wrap">
            <Search size={13} />
            <input
              type="text"
              placeholder="Пошук за прізвищем..."
              value={searchVal}
              onChange={e => setSearchVal(e.target.value)}
              autoComplete="off"
            />
          </div>
        )}
        {searchVal.length > 0 && !selected && (
          <div className="assignee-dropdown">
            {results.length > 0 ? results.map(u => (
              <div key={u.login} className="assignee-option" onMouseDown={e => e.preventDefault()} onClick={() => { onSelect(u.login); setSearchVal('') }}>
                <div className="opt-avatar">{getInitials(u)}</div>
                <div className="opt-info">
                  <span className="opt-name">{u.last_name} {u.first_name}</span>
                  <span className="opt-pos">{u.position || u.department || ''}</span>
                </div>
              </div>
            )) : <div className="no-results">Нікого не знайдено</div>}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Card Color Picker ─────────────────────────────────────────────────────
const CARD_COLORS = [
  { id: '', label: 'Авто (від пріоритету)' },
  { id: '#ef4444', label: 'Червоний' },
  { id: '#f97316', label: 'Помаранчевий' },
  { id: '#eab308', label: 'Жовтий' },
  { id: '#22c55e', label: 'Зелений' },
  { id: '#06b6d4', label: 'Блакитний' },
  { id: '#3b82f6', label: 'Синій' },
  { id: '#8b5cf6', label: 'Фіолетовий' },
  { id: '#ec4899', label: 'Рожевий' },
  { id: '#6b7280', label: 'Сірий' },
]

export const ColorPicker = ({ value, onChange }) => (
  <div className="form-group">
    <label>Колір плашки (ліва смужка картки)</label>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px', alignItems: 'center' }}>
      {CARD_COLORS.map(c => (
        <button
          key={c.id}
          type="button"
          title={c.label}
          onClick={() => onChange(c.id)}
          style={{
            width: c.id ? '28px' : 'auto',
            height: '28px',
            padding: c.id ? 0 : '0 12px',
            borderRadius: c.id ? '50%' : '8px',
            background: c.id || '#1a1a1a',
            border: value === c.id ? '2.5px solid #fff' : '2px solid transparent',
            outline: value === c.id ? '2px solid rgba(255,255,255,0.2)' : 'none',
            outlineOffset: '2px',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.65rem', color: '#888', fontWeight: 800,
            boxShadow: value === c.id && c.id ? `0 0 10px ${c.id}66` : 'none',
            transition: 'all 0.15s',
          }}
        >
          {value === c.id && c.id && <span style={{ color: '#000', fontSize: '11px', fontWeight: 900 }}>✓</span>}
          {!c.id && (value === c.id ? '✓ Авто' : 'Авто')}
        </button>
      ))}
    </div>
  </div>
)

// ─── MultiAssigneeSelector ────────────────────────────────────────────────────
export const MultiAssigneeSelector = ({ values = [], onAdd, onRemove, systemUsers }) => {
  const [search, setSearch] = useState('')
  const results = React.useMemo(() => {
    if (!search) return []
    const lq = search.toLowerCase()
    return (systemUsers || [])
      .filter(u => !values.includes(u.login))
      .filter(u =>
        (u.first_name || '').toLowerCase().includes(lq) ||
        (u.last_name || '').toLowerCase().includes(lq) ||
        (u.login || '').toLowerCase().includes(lq)
      ).slice(0, 6)
  }, [search, values, systemUsers])

  const selectedUsers = (systemUsers || []).filter(u => values.includes(u.login))

  return (
    <div className="form-group">
      <label>
        <Users size={12} style={{ display: 'inline', marginRight: '4px' }} />
        Виконавці {selectedUsers.length > 0 && <span style={{ color: '#ff9000', fontWeight: 900 }}>({selectedUsers.length})</span>}
      </label>
      {selectedUsers.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
          {selectedUsers.map(u => (
            <div key={u.login} style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'rgba(255,144,0,0.08)', border: '1px solid rgba(255,144,0,0.2)', borderRadius: '20px', padding: '3px 8px 3px 4px' }}>
              <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#ff9000', color: '#000', fontSize: '0.6rem', fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {getInitials(u)}
              </div>
              <span style={{ fontSize: '0.73rem', color: '#ddd', fontWeight: 600 }}>{u.last_name} {u.first_name}</span>
              <button type="button" onClick={() => onRemove(u.login)} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', marginLeft: '2px' }}>
                <X size={11} />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="assignee-selector">
        <div className="assignee-search-wrap">
          <Search size={13} />
          <input
            type="text"
            placeholder="Пошук за прізвищем..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            autoComplete="off"
          />
          {search && <button type="button" onClick={() => setSearch('')} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', padding: 0, display: 'flex' }}><X size={12} /></button>}
        </div>
        {search.length > 0 && (
          <div className="assignee-dropdown">
            {results.length > 0 ? results.map(u => (
              <div key={u.login} className="assignee-option" onMouseDown={e => e.preventDefault()} onClick={() => { onAdd(u.login); setSearch('') }}>
                <div className="opt-avatar">{getInitials(u)}</div>
                <div className="opt-info">
                  <span className="opt-name">{u.last_name} {u.first_name}</span>
                  <span className="opt-pos">{u.position || u.department || ''}</span>
                </div>
              </div>
            )) : <div className="no-results">Нікого не знайдено</div>}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── DeadlinePicker ───────────────────────────────────────────────────────────
export const DeadlinePicker = ({ value, onChange, label = 'Дедлайн' }) => {
  const [open, setOpen] = useState(false)
  const [localDate, setLocalDate] = useState(value ? value.slice(0, 10) : '')
  const [localTime, setLocalTime] = useState(value && value.length > 10 ? value.slice(11, 16) : '09:00')

  React.useEffect(() => {
    setLocalDate(value ? value.slice(0, 10) : '')
    setLocalTime(value && value.length > 10 ? value.slice(11, 16) : '09:00')
  }, [value])

  const apply = (date, time) => {
    if (date) onChange(`${date}T${time || '09:00'}`)
    else onChange('')
  }

  const quickSet = (daysFromNow) => {
    const d = new Date()
    d.setDate(d.getDate() + daysFromNow)
    const date = d.toISOString().slice(0, 10)
    setLocalDate(date)
    apply(date, localTime || '09:00')
    setOpen(false)
  }

  const display = value
    ? new Date(value).toLocaleString('uk-UA', {
        day: 'numeric', month: 'short',
        ...(value.length > 10 ? { hour: '2-digit', minute: '2-digit' } : {})
      })
    : 'Не вказано'

  return (
    <div className="form-group" style={{ position: 'relative' }}>
      <label>{label}</label>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: '8px',
          background: value ? 'rgba(255,144,0,0.07)' : '#0d0d0d',
          border: value ? '1px solid rgba(255,144,0,0.25)' : '1px solid #1a1a1a',
          color: value ? '#ff9000' : '#444',
          padding: '9px 14px', borderRadius: '10px', cursor: 'pointer',
          fontSize: '0.82rem', fontWeight: 700, fontFamily: 'inherit', textAlign: 'left'
        }}
      >
        <Calendar size={14} />
        {display}
        {value && (
          <span
            onClick={e => { e.stopPropagation(); onChange(''); setLocalDate('') }}
            style={{ marginLeft: 'auto', color: '#555', cursor: 'pointer', lineHeight: 1, display: 'flex' }}
          >
            <X size={13} />
          </span>
        )}
      </button>
      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={() => setOpen(false)} />
          <div style={{
            position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 9999,
            background: '#0f0f0f', border: '1px solid #222', borderRadius: '14px',
            padding: '14px', boxShadow: '0 16px 50px rgba(0,0,0,0.7)'
          }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
              {[['Сьогодні', 0], ['Завтра', 1], ['+3 дні', 3], ['+7 днів', 7], ['+30 днів', 30]].map(([lbl, days]) => (
                <button
                  key={days}
                  type="button"
                  onClick={() => quickSet(days)}
                  style={{ background: 'rgba(255,144,0,0.08)', border: '1px solid rgba(255,144,0,0.2)', color: '#ff9000', padding: '5px 12px', borderRadius: '8px', fontSize: '0.72rem', fontWeight: 800, cursor: 'pointer' }}
                >
                  {lbl}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
              <input
                type="date"
                value={localDate}
                onChange={e => setLocalDate(e.target.value)}
                style={{ flex: 1, background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#fff', padding: '8px 10px', borderRadius: '8px', fontSize: '0.8rem', outline: 'none', fontFamily: 'inherit' }}
              />
              <input
                type="time"
                value={localTime}
                onChange={e => setLocalTime(e.target.value)}
                style={{ width: '100px', background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#fff', padding: '8px 10px', borderRadius: '8px', fontSize: '0.8rem', outline: 'none', fontFamily: 'inherit' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={() => { apply(localDate, localTime); setOpen(false) }}
                style={{ flex: 1, background: '#ff9000', border: 'none', color: '#000', padding: '8px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 900, cursor: 'pointer' }}
              >
                Зберегти
              </button>
              <button
                type="button"
                onClick={() => { onChange(''); setLocalDate(''); setOpen(false) }}
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid #2a2a2a', color: '#888', padding: '8px 14px', borderRadius: '8px', fontSize: '0.8rem', cursor: 'pointer' }}
              >
                Очистити
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// Сумісний зі старим item.assignee (string) і новим item.assignees (array)
const getChecklistAssignees = (item) => {
  if (Array.isArray(item?.assignees) && item.assignees.length > 0) return item.assignees
  if (item?.assignee) return [item.assignee]
  return []
}

// ─── ChecklistMultiAssigneeSelector ──────────────────────────────────────────
const ChecklistMultiAssigneeSelector = ({ values = [], onChange, systemUsers }) => {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const filtered = React.useMemo(() => {
    if (!search) return systemUsers || []
    const lq = search.toLowerCase()
    return (systemUsers || []).filter(u =>
      (u.first_name || '').toLowerCase().includes(lq) ||
      (u.last_name || '').toLowerCase().includes(lq) ||
      (u.login || '').toLowerCase().includes(lq)
    )
  }, [search, systemUsers])

  const selectedUsers = (systemUsers || []).filter(u => values.includes(u.login))

  const toggle = (login) => {
    onChange(values.includes(login) ? values.filter(l => l !== login) : [...values, login])
  }

  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
      <button
        type="button"
        onClick={e => { e.stopPropagation(); setOpen(o => !o) }}
        style={{
          background: selectedUsers.length > 0 ? 'rgba(255,144,0,0.1)' : 'rgba(255,255,255,0.03)',
          border: selectedUsers.length > 0 ? '1px solid rgba(255,144,0,0.3)' : '1px solid rgba(255,255,255,0.06)',
          borderRadius: '20px',
          padding: selectedUsers.length > 0 ? '3px 8px 3px 4px' : '0',
          width: selectedUsers.length > 0 ? 'auto' : '26px',
          height: '26px',
          display: 'flex', alignItems: 'center', gap: '3px',
          cursor: 'pointer', color: '#ff9000',
          fontSize: '0.62rem', fontWeight: 800,
        }}
      >
        {selectedUsers.length > 0 ? (
          <>
            {selectedUsers.slice(0, 2).map((u, i) => (
              <div key={u.login} style={{
                width: '18px', height: '18px', borderRadius: '50%',
                background: '#ff9000', color: '#000', fontSize: '0.55rem', fontWeight: 900,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginLeft: i > 0 ? '-4px' : 0, flexShrink: 0
              }}>
                {getInitials(u)}
              </div>
            ))}
            {selectedUsers.length > 2 && <span style={{ marginLeft: '2px' }}>+{selectedUsers.length - 2}</span>}
          </>
        ) : (
          <User size={13} color="#555" title="Призначити виконавця" />
        )}
      </button>
      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 10000 }} onClick={() => { setOpen(false); setSearch('') }} />
          <div style={{
            position: 'absolute', bottom: '30px', right: 0,
            background: '#111', border: '1px solid #222', borderRadius: '12px',
            zIndex: 10001, width: '210px', boxShadow: '0 10px 30px rgba(0,0,0,0.6)', overflow: 'hidden'
          }}>
            {/* Search */}
            <div style={{ padding: '8px 10px', borderBottom: '1px solid #1a1a1a', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Search size={12} color="#555" />
              <input
                autoFocus
                type="text"
                placeholder="Пошук..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                onClick={e => e.stopPropagation()}
                style={{ background: 'transparent', border: 'none', outline: 'none', color: '#fff', fontSize: '0.78rem', flex: 1, fontFamily: 'inherit' }}
              />
            </div>
            {/* Clear all */}
            {values.length > 0 && (
              <div
                onClick={() => { onChange([]); setOpen(false); setSearch('') }}
                style={{ padding: '6px 10px', fontSize: '0.7rem', color: '#ef4444', cursor: 'pointer', borderBottom: '1px solid #1a1a1a', fontWeight: 700 }}
              >
                Зняти всіх
              </div>
            )}
            {/* User list */}
            <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
              {filtered.length === 0 && (
                <div style={{ padding: '10px 12px', fontSize: '0.72rem', color: '#555', textAlign: 'center' }}>Нікого не знайдено</div>
              )}
              {filtered.map(u => {
                const sel = values.includes(u.login)
                return (
                  <div
                    key={u.login}
                    onClick={e => { e.stopPropagation(); toggle(u.login) }}
                    style={{
                      padding: '7px 10px', fontSize: '0.75rem',
                      color: sel ? '#ff9000' : '#fff',
                      background: sel ? 'rgba(255,144,0,0.08)' : 'transparent',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
                    }}
                    onMouseEnter={e => { if (!sel) e.currentTarget.style.background = '#ff900010' }}
                    onMouseLeave={e => { if (!sel) e.currentTarget.style.background = 'transparent' }}
                  >
                    <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: sel ? '#ff9000' : '#2a2a2a', color: sel ? '#000' : '#888', fontSize: '0.55rem', fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {getInitials(u)}
                    </div>
                    <span style={{ flex: 1 }}>{u.last_name} {u.first_name}</span>
                    {sel && <span style={{ fontSize: '11px', color: '#ff9000' }}>✓</span>}
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export const ChecklistEditor = ({ items, onToggle, newItem, setNewItem, onAdd, onRemove, canEdit, onAddSubItem, onUpdateDeadline, onUpdateAssignee, systemUsers }) => {
  const [activeAddId, setActiveAddId] = useState(null)
  const [subText, setSubText] = useState('')
  const [collapsedItems, setCollapsedItems] = useState({})
  const [isEditing, setIsEditing] = useState(false)
  const showEditControls = canEdit && isEditing

  const roots = items.filter(item => !item.parent_id || !items.some(parent => String(parent.id) === String(item.parent_id)))
  const getChildren = (parentId) => items.filter(item => String(item.parent_id) === String(parentId))

  const renderItem = (item, isChild = false) => {
    const children = getChildren(item.id)
    const hasChildren = children.length > 0
    const isAddingSub = activeAddId === item.id

    const isCollapsed = !!collapsedItems[item.id]
    const toggleCollapse = (e) => {
      e.stopPropagation()
      setCollapsedItems(prev => ({ ...prev, [item.id]: !prev[item.id] }))
    }
    const isChecked = hasChildren ? children.every(c => c.done) : item.done
    const clAssignees = getChecklistAssignees(item)
    const clAssigneeUsers = clAssignees.map(l => (systemUsers || []).find(u => u.login === l)).filter(Boolean)

    return (
      <div key={item.id} style={{ display: "flex", flexDirection: "column" }}>
        <div className={`checklist-item ${isChild ? 'child-item' : 'parent-item'} ${isChecked ? 'done' : ''}`}>
          <div
            onClick={(e) => {
              if (!hasChildren) {
                if (onToggle) onToggle(item.id)
              } else {
                toggleCollapse(e)
              }
            }}
            className="check-click-area"
            style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', flex: 1, minWidth: 0 }}
          >
            <button type="button" className="check-toggle" style={{ pointerEvents: 'none' }}>
              {isChecked ? <CheckSquare size={18} color="#10b981" /> : <Square size={18} color="#555" />}
            </button>
            <span className="check-text" style={isChild ? { fontSize: '0.82rem', color: isChecked ? '#666' : '#bbb' } : { fontWeight: hasChildren ? 700 : 500 }}>
              {item.text}
            </span>
            {hasChildren && !isChild && (
              <span className="subtasks-badge" style={{ fontSize: '0.62rem', color: '#ff9000', marginLeft: '8px', background: 'rgba(255,144,0,0.08)', padding: '2px 6px', borderRadius: '6px', border: '1px solid rgba(255,144,0,0.15)', fontWeight: 800, whiteSpace: 'nowrap' }}>
                містить {children.length} підзадач
              </span>
            )}
          </div>
          {hasChildren && !isChild && (
            <button
              type="button"
              onClick={toggleCollapse}
              style={{ background: 'rgba(255,144,0,0.05)', border: '1px solid rgba(255,144,0,0.1)', color: '#ff9000', cursor: 'pointer', padding: '3px 8px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.65rem', fontWeight: 800 }}
            >
              {isCollapsed ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
              <span>{isCollapsed ? 'Розгорнути' : 'Згорнути'}</span>
            </button>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto' }}>
            {showEditControls ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ChecklistMultiAssigneeSelector
                  values={clAssignees}
                  onChange={(assignees) => onUpdateAssignee && onUpdateAssignee(item.id, assignees)}
                  systemUsers={systemUsers}
                />
                <input
                  type="date"
                  value={item.deadline ? item.deadline.slice(0, 10) : ''}
                  onChange={(e) => {
                    const date = e.target.value
                    const time = item.deadline && item.deadline.length > 10 ? item.deadline.slice(11, 16) : ''
                    onUpdateDeadline && onUpdateDeadline(item.id, date ? (time ? `${date}T${time}` : date) : '')
                  }}
                  onClick={e => { try { e.target.showPicker() } catch (err) { } }}
                  style={{
                    background: item.deadline ? 'rgba(255,144,0,0.06)' : 'rgba(255,255,255,0.02)',
                    border: item.deadline ? '1px solid rgba(255,144,0,0.15)' : '1px solid rgba(255,255,255,0.05)',
                    color: item.deadline ? '#ff9000' : '#444',
                    borderRadius: '6px',
                    fontSize: '0.68rem',
                    padding: '3px 5px',
                    width: '95px',
                    cursor: 'pointer',
                    outline: 'none',
                    fontFamily: 'inherit'
                  }}
                />
                {item.deadline && (
                  <input
                    type="time"
                    value={item.deadline.length > 10 ? item.deadline.slice(11, 16) : ''}
                    onChange={(e) => {
                      const time = e.target.value
                      const date = item.deadline.slice(0, 10)
                      onUpdateDeadline && onUpdateDeadline(item.id, date ? (time ? `${date}T${time}` : date) : '')
                    }}
                    onClick={e => { try { e.target.showPicker() } catch (err) { } }}
                    style={{
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid rgba(255,255,255,0.05)',
                      color: '#bbb',
                      borderRadius: '6px',
                      fontSize: '0.68rem',
                      padding: '3px 4px',
                      width: '60px',
                      cursor: 'pointer',
                      outline: 'none',
                      fontFamily: 'inherit'
                    }}
                  />
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {clAssigneeUsers.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    {clAssigneeUsers.slice(0, 3).map((u, i) => (
                      <div
                        key={u.login}
                        title={`${u.last_name} ${u.first_name}`}
                        style={{
                          width: '22px', height: '22px', borderRadius: '50%',
                          background: '#ff900018', border: '1px solid rgba(255,144,0,0.3)',
                          color: '#ff9000', fontSize: '0.6rem', fontWeight: 900,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          marginLeft: i > 0 ? '-6px' : 0, cursor: 'default', flexShrink: 0
                        }}
                      >
                        {getInitials(u)}
                      </div>
                    ))}
                    {clAssigneeUsers.length > 3 && (
                      <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#1a1a1a', border: '1px solid #333', color: '#888', fontSize: '0.55rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: '-6px' }}>
                        +{clAssigneeUsers.length - 3}
                      </div>
                    )}
                  </div>
                )}
                {item.deadline && (
                  <span style={{ fontSize: '0.68rem', color: '#ff9000', display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(255,144,0,0.05)', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(255,144,0,0.1)' }}>
                    <Calendar size={11} />
                    {(() => {
                      const d = new Date(item.deadline)
                      const options = { day: 'numeric', month: 'short' }
                      if (d.getHours() !== 0 || d.getMinutes() !== 0) {
                        options.hour = '2-digit'
                        options.minute = '2-digit'
                      }
                      return d.toLocaleString('uk-UA', options)
                    })()}
                  </span>
                )}
              </div>
            )}
          </div>
          {showEditControls && !isChild && (
            <button
              type="button"
              title="Додати підпункт"
              onClick={() => {
                setActiveAddId(item.id)
                setSubText('')
              }}
              style={{ background: 'transparent', border: 'none', color: '#ff9000', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', opacity: 0.7 }}
              onMouseEnter={e => e.currentTarget.style.opacity = '1'}
              onMouseLeave={e => e.currentTarget.style.opacity = '0.7'}
            >
              <Plus size={14} />
              <span style={{ fontSize: '0.68rem', marginLeft: '2px' }}>підпункт</span>
            </button>
          )}
          {showEditControls && (
            <button type="button" className="check-remove" onClick={() => onRemove(item.id)}>
              <X size={11} />
            </button>
          )}
        </div>

        {!isCollapsed && isAddingSub && (
          <div style={{ display: 'flex', gap: '8px', marginLeft: '24px', padding: '6px 10px', alignItems: 'center' }}>
            <input
              autoFocus
              type="text"
              placeholder="Введіть назву підпункту..."
              value={subText}
              onChange={e => setSubText(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  if (subText.trim()) {
                    onAddSubItem && onAddSubItem(item.id, subText.trim())
                  }
                  setActiveAddId(null)
                  setSubText('')
                } else if (e.key === 'Escape') {
                  setActiveAddId(null)
                  setSubText('')
                }
              }}
              style={{
                background: '#0d0d0d',
                border: '1px solid #ff9000',
                borderRadius: '8px',
                padding: '6px 12px',
                color: '#fff',
                fontSize: '0.8rem',
                flex: 1
              }}
            />
            <button
              type="button"
              onClick={() => {
                if (subText.trim()) {
                  onAddSubItem && onAddSubItem(item.id, subText.trim())
                }
                setActiveAddId(null)
                setSubText('')
              }}
              style={{ background: '#ff9000', border: 'none', color: '#000', borderRadius: '8px', padding: '6px 12px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}
            >
              Додати
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveAddId(null)
                setSubText('')
              }}
              style={{ background: 'transparent', border: '1px solid #333', color: '#888', borderRadius: '8px', padding: '6px 12px', fontSize: '0.8rem', cursor: 'pointer' }}
            >
              ✕
            </button>
          </div>
        )}

        {!isCollapsed && children.map(child => renderItem(child, true))}
      </div>
    )
  }

  return (
    <div className="checklist-editor">
      {canEdit && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
          <button
            type="button"
            onClick={() => setIsEditing(!isEditing)}
            style={{
              background: isEditing ? '#ff9000' : 'rgba(255,255,255,0.05)',
              border: isEditing ? 'none' : '1px solid rgba(255,255,255,0.1)',
              color: isEditing ? '#000' : '#ff9000',
              padding: '6px 14px',
              borderRadius: '8px',
              fontSize: '0.75rem',
              fontWeight: 900,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s'
            }}
          >
            {isEditing ? '✓ Готово' : '⚙ Редагувати структуру'}
          </button>
        </div>
      )}
      {items.length > 0 && (
        <div className="checklist-progress-row">
          <div className="cl-track"><div className="cl-fill" style={{ width: `${checklistProgress(items)?.pct || 0}%`, background: checklistProgress(items)?.pct === 100 ? '#10b981' : '#3b82f6' }} /></div>
          <span className="cl-pct">{checklistProgress(items)?.pct || 0}%</span>
        </div>
      )}
      <div className="checklist-items">
        {roots.map(root => renderItem(root, false))}
        {items.length === 0 && <div className="checklist-empty">Немає пунктів. {showEditControls ? 'Додайте нижче.' : ''}</div>}
      </div>
      {showEditControls && (
        <div className="add-check-row">
          <input
            type="text"
            placeholder="Новий пункт чеклисту..."
            value={newItem}
            onChange={e => setNewItem(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), onAdd())}
          />
          <button type="button" className="add-check-btn" onClick={onAdd}><Plus size={14} /></button>
        </div>
      )}
    </div>
  )
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────

const KanbanModule = () => {
  const { managementTasks, systemUsers, addManagementTask, updateManagementTask, deleteManagementTask, currentUser, setManagementTasks, companyStructure, fetchCompletedManagementTasks, fetchCompletedManagementTasksCount } = useMES()

  const DEPARTMENTS = useMemo(() => {
    const list = [{ id: 'all', label: 'Усі відділи' }]
    const seenIds = new Set(['all'])

    if (Array.isArray(companyStructure)) {
      companyStructure.forEach(item => {
        const idStr = String(item.id)
        if (seenIds.has(idStr)) return
        seenIds.add(idStr)
        list.push({
          id: idStr,
          label: item.name || item.label || ''
        })
      })
    }

    const staticDepts = [
      { id: 'manager', label: 'Менеджмент' },
      { id: 'shop1', label: 'Цех №1' },
      { id: 'shop2', label: 'Цех №2' },
      { id: 'packaging', label: 'Пакування' },
      { id: 'warehouse', label: 'Склад' },
      { id: 'supply', label: 'Постачання' },
      { id: 'logistics', label: 'Логістика' },
      { id: 'qa', label: 'ВКЯ' },
    ]

    staticDepts.forEach(sd => {
      const nameNorm = sd.label.toLowerCase()
      const exists = list.some(item => (item.label || '').toLowerCase() === nameNorm || item.id === sd.id)
      if (!exists) {
        list.push(sd)
      }
    })

    return list
  }, [companyStructure])

  // ── Role detection ──────────────────────────────────────────────────────
  const isDirector = useMemo(() => {
    const pos = (currentUser?.position || '').toLowerCase()
    const rights = currentUser?.access_rights || {}
    return !!(rights.director || pos.includes('директор') || pos.includes('адмін') || pos.includes('керівник підприємства'))
  }, [currentUser])

  const isManager = useMemo(() => {
    const pos = (currentUser?.position || '').toLowerCase()
    const rights = currentUser?.access_rights || {}
    return isDirector || !!(rights.master || rights.foreman || rights.manager ||
      ['начальник', 'нач', 'майстер', 'менедж', 'керівник'].some(word => pos.includes(word)))
  }, [currentUser, isDirector])

  const isTaskRelevantToUser = useCallback((task, user) => {
    if (!user || !task) return false
    const login = user.login
    if (task.created_by === login) return true
    if (getAssignees(task).includes(login)) return true
    if (Array.isArray(task.checklist) && task.checklist.some(item => getChecklistAssignees(item).includes(login))) return true
    if (task.is_collective) {
      const userDept = getUserDeptId(user.department, companyStructure)
      if (task.department === 'all' || (userDept && task.department === userDept)) return true
    }
    return false
  }, [companyStructure])

  const canManageTask = useCallback((task) => {
    if (!task || !currentUser) return false
    const login = currentUser.login
    if (task.created_by === login) return true
    if (getAssignees(task).includes(login)) return true
    if (isDirector) return true
    return isManager
  }, [currentUser, isDirector, isManager])

  // ── Filters & Search ────────────────────────────────────────────────────
  const [filterMode, setFilterMode] = useState('all')
  const [selectedDeptFilter, setSelectedDeptFilter] = useState('all')
  const [statsFilter, setStatsFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [activeMobileColumn, setActiveMobileColumn] = useState('todo')
  const [showSearch, setShowSearch] = useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  // ── Completed Tasks On-Demand State ─────────────────────────────────────
  const [completedCount, setCompletedCount] = useState(0)
  const [completedTasks, setCompletedTasks] = useState([])
  const [completedPage, setCompletedPage] = useState(0)
  const [hasMoreCompleted, setHasMoreCompleted] = useState(true)
  const [isFetchingCompleted, setIsFetchingCompleted] = useState(false)

  useEffect(() => {
    if (typeof fetchCompletedManagementTasksCount === 'function') {
      fetchCompletedManagementTasksCount().then(cnt => setCompletedCount(cnt))
    }
    if (typeof fetchCompletedManagementTasks === 'function') {
      setIsFetchingCompleted(true)
      fetchCompletedManagementTasks(0, 20).then(res => {
        setCompletedTasks(res.data || [])
        if (res.count !== undefined) setCompletedCount(res.count)
        setHasMoreCompleted((res.data || []).length === 20)
        setIsFetchingCompleted(false)
      })
    }
  }, [])

  const loadMoreCompleted = async () => {
    if (isFetchingCompleted || !hasMoreCompleted || typeof fetchCompletedManagementTasks !== 'function') return
    const nextPage = completedPage + 1
    setIsFetchingCompleted(true)
    const res = await fetchCompletedManagementTasks(nextPage, 20)
    setCompletedTasks(prev => [...prev, ...(res.data || [])])
    setCompletedPage(nextPage)
    setHasMoreCompleted((res.data || []).length === 20)
    setIsFetchingCompleted(false)
  }

  // ── Modals ──────────────────────────────────────────────────────────────
  const [createOpen, setCreateOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [confirmModal, setConfirmModal] = useState(null)
  const [editOpen, setEditOpen] = useState(false)
  const [selectedTask, setSelectedTask] = useState(null)
  const [detailTab, setDetailTab] = useState('desc') // 'desc' | 'checklist' | 'comments'

  // ── Create form ─────────────────────────────────────────────────────────
  const blankForm = { title: '', description: '', priority: 'medium', color: '', assigned_to: '', assignees: [], is_collective: false, department: 'all', deadline: '', checklist: [] }
  const [form, setForm] = useState(blankForm)
  const [newCheckItem, setNewCheckItem] = useState('')
  const [assigneeSearch, setAssigneeSearch] = useState('')
  const [commentText, setCommentText] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // ── Edit form ───────────────────────────────────────────────────────────
  const [editForm, setEditForm] = useState(null)
  const [editCheckItem, setEditCheckItem] = useState('')
  const [editAssigneeSearch, setEditAssigneeSearch] = useState('')

  // ── Default filter by role ──────────────────────────────────────────────
  useEffect(() => {
    setFilterMode('all')
  }, [isDirector])

  // ── Stats ───────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    let list = (managementTasks || []).filter(t => !t.project_id)
    if (!isDirector) {
      list = list.filter(t => isTaskRelevantToUser(t, currentUser))
    }
    return {
      total: list.length,
      inProgress: list.filter(t => t.status === 'in_progress').length,
      done: completedCount,
      overdue: list.filter(t => isOverdueTask(t)).length,
    }
  }, [managementTasks, isDirector, currentUser, isTaskRelevantToUser])

  // ── Filtered tasks ──────────────────────────────────────────────────────
  const filteredTasks = useMemo(() => {
    let list = (managementTasks || []).filter(t => !t.project_id)
    if (!isDirector) {
      list = list.filter(t => isTaskRelevantToUser(t, currentUser))
    }
    if (filterMode === 'my') {
      list = list.filter(t => getAssignees(t).includes(currentUser?.login))
    } else if (filterMode === 'assigned_by_me') {
      list = list.filter(t => t.created_by === currentUser?.login)
    } else if (filterMode === 'department') {
      const deptId = getUserDeptId(currentUser?.department, companyStructure)
      list = list.filter(t => t.is_collective && (t.department === deptId || t.department === 'all'))
    } else if (filterMode === 'unassigned') {
      list = list.filter(t => getAssignees(t).length === 0 && !t.is_collective)
    }

    if (selectedDeptFilter !== 'all') {
      list = list.filter(t => getTaskDepartment(t, systemUsers, companyStructure) === selectedDeptFilter)
    }
    if (statsFilter === 'in_progress') list = list.filter(t => t.status === 'in_progress')
    else if (statsFilter === 'overdue') list = list.filter(t => isOverdueTask(t))
    else if (statsFilter === 'done') list = list.filter(t => t.status === 'done')
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      list = list.filter(t => (t.title || '').toLowerCase().includes(q) || (t.description || '').toLowerCase().includes(q))
    }
    return list
  }, [managementTasks, isManager, filterMode, statsFilter, searchQuery, currentUser, selectedDeptFilter, systemUsers, companyStructure])

  // ─── Comments helpers ───────────────────────────────────────────────────
  const parseComments = (desc) => {
    if (!desc) return { description: '', comments: [] }
    const lines = desc.split('\n')
    const comments = []
    const descLines = []
    const re = /^\[([^\]]+)\]\s*([^:]+):\s*(.*)$/
    lines.forEach(line => {
      const m = line.trim().match(re)
      if (m) comments.push({ time: m[1], author: m[2], text: m[3] })
      else descLines.push(line)
    })
    return { description: descLines.join('\n').trim(), comments }
  }

  const parsedSelectedTask = useMemo(() => {
    if (!selectedTask) return { description: '', comments: [] }
    return parseComments(selectedTask.description)
  }, [selectedTask?.description])

  const handleAddComment = async (e) => {
    e.preventDefault()
    if (!commentText.trim() || !selectedTask) return
    const timeStr = new Date().toLocaleString('uk-UA', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })
    const authorName = currentUser?.last_name || currentUser?.first_name || currentUser?.login || 'Користувач'
    const line = `\n[${timeStr}] ${authorName}: ${commentText}`
    const updated = (selectedTask.description || '') + line
    await updateManagementTask(selectedTask.id, { description: updated })
    setSelectedTask(prev => ({ ...prev, description: updated }))
    setCommentText('')
  }

  // ─── Drag & Drop ────────────────────────────────────────────────────────
  const handleDragStart = (e, taskId) => {
    e.dataTransfer.setData('taskId', String(taskId))
    e.currentTarget.classList.add('dragging')
  }
  const handleDragEnd = (e) => e.currentTarget.classList.remove('dragging')
  const handleDragOver = (e) => e.preventDefault()
  const handleDrop = async (e, newStatus) => {
    e.preventDefault()
    if (!isManager) return
    const taskId = e.dataTransfer.getData('taskId')
    if (taskId) await updateManagementTask(taskId, { status: newStatus })
  }

  // ─── Open task detail ───────────────────────────────────────────────────
  const handleOpenTask = (task) => {
    setSelectedTask(task)
    setDetailTab('desc')
    setDetailOpen(true)
  }

  // ─── Sync selectedTask when managementTasks changes ────────────────────
  useEffect(() => {
    if (selectedTask) {
      const fresh = managementTasks?.find(t => t.id === selectedTask.id)
      if (fresh) setSelectedTask(fresh)
    }
  }, [managementTasks])

  // ─── Create Task ────────────────────────────────────────────────────────
  const handleCreateTask = async (e) => {
    e.preventDefault()
    if (!form.title.trim() || isSubmitting) return
    setIsSubmitting(true)

    // ─ Optimistic: close modal & add temp task INSTANTLY ──────────────────────
    const tempId = '__temp_' + genId()
    const tempTask = {
      ...form,
      color: form.color || '',
      assignees: form.assignees || [],
      assigned_to: (form.assignees || [])[0] || form.assigned_to || '',
      id: tempId,
      status: 'todo',
      created_by: currentUser?.login || 'system',
      created_at: new Date().toISOString(),
      _isPending: true,
    }
    setManagementTasks(prev => [tempTask, ...prev])
    setCreateOpen(false)
    setForm(blankForm)
    setNewCheckItem('')
    setAssigneeSearch('')
    setIsSubmitting(false)

    // ─ Background save to DB ─────────────────────────────────────────
    try {
      const payload = {
        ...form,
        color: form.color || '',
        assignees: form.assignees || [],
        assigned_to: (form.assignees || [])[0] || form.assigned_to || '',
        status: 'todo'
      }
      const { data: saved, error } = await addManagementTask(payload)
      if (error) {
        // rollback temp on error
        setManagementTasks(prev => prev.filter(t => t.id !== tempId))
      } else if (saved) {
        // replace temp with real record
        setManagementTasks(prev => prev.map(t => t.id === tempId ? saved : t))
      }
    } catch {
      setManagementTasks(prev => prev.filter(t => t.id !== tempId))
    }
  }

  const addCheckItemToForm = () => {
    if (!newCheckItem.trim()) return
    setForm(f => ({ ...f, checklist: [...(f.checklist || []), { id: genId(), text: newCheckItem.trim(), done: false }] }))
    setNewCheckItem('')
  }

  const removeCheckItemFromForm = (id) => {
    setForm(f => ({ ...f, checklist: f.checklist.filter(i => String(i.id) !== String(id) && String(i.parent_id) !== String(id)) }))
  }

  // ─── Edit Task ──────────────────────────────────────────────────────────
  const handleOpenEdit = (task, e) => {
    e?.stopPropagation()
    const { description } = parseComments(task.description)
    setEditForm({
      id: task.id,
      title: task.title || '',
      description,
      priority: task.priority || 'medium',
      color: task.color || '',
      assigned_to: task.assigned_to || '',
      assignees: getAssignees(task),
      is_collective: task.is_collective || false,
      department: task.department || 'all',
      deadline: task.deadline ? task.deadline.slice(0, 16) : '',
      checklist: Array.isArray(task.checklist) ? [...task.checklist] : [],
    })
    setEditAssigneeSearch('')
    setEditCheckItem('')
    setEditOpen(true)
  }

  const handleSaveEdit = async (e) => {
    e.preventDefault()
    if (!editForm?.title?.trim() || isSubmitting) return
    setIsSubmitting(true)
    try {
      const { id, ...payload } = editForm
      // Sync assigned_to з першим у масиві assignees
      payload.assigned_to = (editForm.assignees || [])[0] || editForm.assigned_to || ''
      payload.assignees = editForm.assignees || []
      payload.color = editForm.color || ''
      // Rebuild description (keep old comments)
      const orig = managementTasks?.find(t => t.id === id)
      const { comments } = parseComments(orig?.description)
      const commentsStr = comments.map(c => `\n[${c.time}] ${c.author}: ${c.text}`).join('')
      payload.description = payload.description + commentsStr
      await updateManagementTask(id, payload)
      setEditOpen(false)
      setEditForm(null)
    } finally {
      setIsSubmitting(false)
    }
  }

  const addCheckItemToEdit = () => {
    if (!editCheckItem.trim()) return
    setEditForm(f => ({ ...f, checklist: [...(f.checklist || []), { id: genId(), text: editCheckItem.trim(), done: false }] }))
    setEditCheckItem('')
  }

  const removeCheckItemFromEdit = (id) => {
    setEditForm(f => ({ ...f, checklist: f.checklist.filter(i => String(i.id) !== String(id) && String(i.parent_id) !== String(id)) }))
  }

  // ─── Toggle checklist item ──────────────────────────────────────────────
  const handleToggleCheckItem = async (task, itemId) => {
    const checklist = Array.isArray(task.checklist) ? task.checklist : []
    const item = checklist.find(i => String(i.id) === String(itemId))
    if (!item) return
    const msg = item.done ? "Зняти відмітку про виконання для цього пункту?" : "Позначити цей пункт як виконаний?"
    setConfirmModal({
      message: msg,
      onConfirm: async () => {
        const updated = toggleChecklistItem(checklist, itemId)
        await updateManagementTask(task.id, { checklist: updated })
        if (selectedTask?.id === task.id) setSelectedTask(prev => ({ ...prev, checklist: updated }))
      }
    })
  }

  // ─── Status actions ─────────────────────────────────────────────────────
  const canAdvance = (task) => {
    if (task.status === 'done') return false
    return canManageTask(task)
  }

  // ─── Status change in detail modal ─────────────────────────────────────
  const handleStatusChange = async (newStatus) => {
    if (!selectedTask) return
    await updateManagementTask(selectedTask.id, { status: newStatus })
    setSelectedTask(prev => ({ ...prev, status: newStatus }))
  }

  // ─── Delete ─────────────────────────────────────────────────────────────
  const handleDelete = async (taskId, e) => {
    e?.stopPropagation()
    if (!confirm('Видалити задачу?')) return
    await deleteManagementTask(taskId)
    if (selectedTask?.id === taskId) setDetailOpen(false)
  }

  // ─── (AssigneeSelector and ChecklistEditor moved to top-level — no focus loss)

  // ─── Card actions inline ─────────────────────────────────────────────────
  const CardActions = ({ task }) => {
    if (!canAdvance(task)) return null
    const canApprove = canManageTask(task)
    return (
      <div className="card-actions" onClick={e => e.stopPropagation()}>
        {task.status === 'todo' && (
          <button className="ca-btn ca-start" onClick={async () => {
            await updateManagementTask(task.id, { status: 'in_progress', assigned_to: task.assigned_to || currentUser?.login })
          }}>▶ Почати</button>
        )}
        {task.status === 'in_progress' && (
          <button className="ca-btn ca-review" onClick={async () => {
            await updateManagementTask(task.id, { status: 'review' })
          }}>⚙ На перевірку</button>
        )}
        {task.status === 'review' && (
          <div className="ca-row">
            {canApprove ? (
              <>
                <button className="ca-btn ca-approve" onClick={async () => updateManagementTask(task.id, { status: 'done' })}>✓ Прийняти</button>
                <button className="ca-btn ca-reject" onClick={async () => updateManagementTask(task.id, { status: 'in_progress' })}>✕ Відхилити</button>
              </>
            ) : (
              <button className="ca-btn ca-reject" style={{ background: 'rgba(255,255,255,0.05)', color: '#888', border: '1px solid rgba(255,255,255,0.1)' }} onClick={async () => updateManagementTask(task.id, { status: 'in_progress' })}>↩ Скасувати перевірку</button>
            )}
          </div>
        )}
      </div>
    )
  }

  // ─── Column progress ─────────────────────────────────────────────────────
  const columnProgress = (colId) => {
    const col = filteredTasks.filter(t => t.status === colId)
    if (!col.length) return 0
    const doneItems = col.filter(t => t.status === 'done').length
    return Math.round((doneItems / col.length) * 100)
  }

  return (
    <div className="kb-root">
      {/* ── NAV ─────────────────────────────────────────────────────────── */}
      <nav className="kb-nav">
        <div className="kb-nav-left">
          <Link to="/" className="kb-back">
            <ArrowLeft size={16} />
            <span>НАЗАД</span>
          </Link>
          <div className="kb-brand">
            <div className="kb-brand-icon"><KanbanSquare size={20} /></div>
            <div className="kb-brand-text">
              <h1>ЗАДАЧІ</h1>
              <span>Внутрішні домовленості</span>
            </div>
          </div>
          {isDirector && (
            <div className="role-badge manager-badge"><Shield size={11} /> Керівник</div>
          )}
          <Link to="/tasks/projects" className="projects-nav-btn">
            <span className="projects-nav-icon"><Briefcase size={16} /></span>
            <span className="projects-nav-copy"><b>ПРОЄКТИ</b><small>Відкрити дошки</small></span>
            <ChevronRight size={16} className="projects-nav-arrow" />
          </Link>
        </div>
        <div className="kb-nav-right">
          <div className={`kb-search-wrap ${showSearch ? 'open' : ''}`}>
            <button className="icon-btn" onClick={() => setShowSearch(s => !s)}><Search size={16} /></button>
            {showSearch && (
              <input autoFocus type="text" placeholder="Пошук задач..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="kb-search-input" />
            )}
          </div>

          <div className="kb-filters">
            {isDirector ? (
              <>
                {[['all', 'УСІ ЗАДАЧІ'], ['my', 'Я ВИКОНАВЕЦЬ'], ['assigned_by_me', 'Я АВТОР'], ['unassigned', 'БЕЗ ВИКОНАВЦЯ']].map(([id, lbl]) => (
                  <button key={id} className={`kf-btn ${filterMode === id ? 'active' : ''}`} onClick={() => { setFilterMode(id); setStatsFilter('all') }}>{lbl}</button>
                ))}
              </>
            ) : (
              <>
                {[['all', 'МОЇ ТА ДОРУЧЕНІ'], ['my', 'Я ВИКОНАВЕЦЬ'], ['assigned_by_me', 'Я АВТОР'], ['department', 'ВІДДІЛ']].map(([id, lbl]) => (
                  <button key={id} className={`kf-btn ${filterMode === id ? 'active' : ''}`} onClick={() => { setFilterMode(id); setStatsFilter('all') }}>{lbl}</button>
                ))}
              </>
            )}
          </div>

        </div>
      </nav>

      {/* ── STATS ───────────────────────────────────────────────────────── */}
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

      {/* ── MOBILE TABS ─────────────────────────────────────────────────── */}
      <div className="kb-mobile-tabs">
        {COLUMNS.map(col => {
          const cnt = filteredTasks.filter(t => t.status === col.id).length
          return (
            <button key={col.id} className={`mob-tab ${activeMobileColumn === col.id ? 'active' : ''}`}
              style={{ '--cc': col.color }} onClick={() => setActiveMobileColumn(col.id)}>
              <span>{col.title}</span>
              <span className="mob-tab-cnt" style={{ background: `${col.color}20`, color: col.color }}>{cnt}</span>
            </button>
          )
        })}
      </div>

      <div className={`kb-body-container ${isSidebarOpen ? 'sidebar-open' : ''}`}>
        <main className="kb-board">
          {COLUMNS.map(column => {
            const columnTasks = column.id === 'done' ? completedTasks : filteredTasks.filter(t => t.status === column.id)
            const columnCount = column.id === 'done' ? completedCount : columnTasks.length
            return (
              <div key={column.id} className={`kb-col ${activeMobileColumn === column.id ? 'mob-active' : ''}`}
                onDragOver={handleDragOver} onDrop={e => handleDrop(e, column.id)}>
                <div className="col-head" style={{ borderTopColor: column.color }}>
                  <div className="col-head-left">
                    <h3 style={{ color: column.color }}>{column.title}</h3>
                    <span className="col-cnt" style={{ background: `${column.color}15`, color: column.color }}>{columnCount}</span>
                  </div>
                  {column.id === 'todo' && (
                    <button className="col-add-btn" onClick={() => setCreateOpen(true)} title="Нова задача">
                      <Plus size={14} />
                    </button>
                  )}
                </div>

                <div className="col-body">
                  {columnTasks.map(task => {
                    const taskAssignees = getAssignees(task).map(login => (systemUsers || []).find(u => u.login === login)).filter(Boolean)
                    const overdue = isOverdueTask(task)
                    const checklist = Array.isArray(task.checklist) ? task.checklist : []
                    const clp = checklistProgress(checklist)
                    const pcfg = PRIORITY_CFG[task.priority] || PRIORITY_CFG.medium
                    const accentColor = task.color || pcfg.color

                    return (
                      <div key={task.id} className={`kb-card ${overdue ? 'overdue' : ''}`}
                        style={{ '--pb': accentColor }}
                        draggable={canManageTask(task)}
                        onDragStart={e => handleDragStart(e, task.id)}
                        onDragEnd={handleDragEnd}
                        onClick={() => handleOpenTask(task)}>

                        {/* Priority bar — color set by task.color or priority */}
                        <div className="card-pbar" style={{ background: accentColor }} />

                        <div className="card-top">
                          <PriorityBadge priority={task.priority} />
                          {task.is_collective && (
                            <span className="collective-badge">
                              <Users size={10} /> {DEPARTMENTS.find(d => d.id === task.department)?.label || 'Колектив'}
                            </span>
                          )}
                          {overdue && <span className="overdue-badge pulse"><AlertCircle size={10} /> Прострочено</span>}
                        </div>

                        <h4 className="card-title">{task.title}</h4>

                        {/* Checklist mini bar */}
                        {clp && <ChecklistBar checklist={checklist} />}

                        <div className="card-footer">
                          <div className="card-meta">
                            {task.deadline && (
                              <span className="card-deadline" style={{ color: overdue ? '#ef4444' : '#555' }}>
                                <Calendar size={11} />
                                {(() => {
                                  const d = new Date(task.deadline)
                                  const options = { day: 'numeric', month: 'short' }
                                  if (d.getHours() !== 0 || d.getMinutes() !== 0) {
                                    options.hour = '2-digit'
                                    options.minute = '2-digit'
                                  }
                                  return d.toLocaleString('uk-UA', options)
                                })()}
                              </span>
                            )}
                            {clp && (
                              <span className="card-cl-count" style={{ color: clp.done === clp.total ? '#10b981' : '#555' }}>
                                <CheckSquare size={11} /> {clp.done}/{clp.total}
                              </span>
                            )}
                          </div>
                          <div className="card-users">
                            {!task.is_collective && taskAssignees.length > 0 && (
                              <div style={{ display: 'flex', alignItems: 'center' }}>
                                {taskAssignees.slice(0, 3).map((u, i) => (
                                  <div key={u.login} style={{ marginLeft: i > 0 ? '-8px' : 0, zIndex: 3 - i, position: 'relative' }}>
                                    <UserAvatar user={u} size={26} />
                                  </div>
                                ))}
                                {taskAssignees.length > 3 && (
                                  <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#1a1a1a', border: '1px solid #333', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', color: '#888', marginLeft: '-8px', fontWeight: 800 }}>
                                    +{taskAssignees.length - 3}
                                  </div>
                                )}
                              </div>
                            )}
                            {!task.is_collective && taskAssignees.length === 0 && (
                              <div className="ua-unassigned" title="Не призначено">?</div>
                            )}
                          </div>
                        </div>

                        <CardActions task={task} />

                        {/* Manager controls */}
                        {isDirector ? true : isTaskRelevantToUser(task, currentUser) && (
                          <div className="card-mgr-btns" onClick={e => e.stopPropagation()}>
                            <button className="mgr-btn edit-btn" onClick={e => handleOpenEdit(task, e)} title="Редагувати"><Edit3 size={12} /></button>
                            <button className="mgr-btn del-btn" onClick={e => handleDelete(task.id, e)} title="Видалити"><Trash2 size={12} /></button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                  {columnTasks.length === 0 && (
                    <div className="col-empty">
                      <KanbanSquare size={24} color="#1a1a1a" />
                      <span>Порожньо</span>
                    </div>
                  )}
                {column.id === 'done' && hasMoreCompleted && (
                    <button
                      className="btn-ghost"
                      style={{ width: '100%', marginTop: '10px', fontSize: '0.75rem', padding: '8px 12px' }}
                      disabled={isFetchingCompleted}
                      onClick={loadMoreCompleted}
                    >
                      {isFetchingCompleted ? 'Завантаження...' : 'Завантажити ще 20 виконаних'}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </main>

        {/* ══ RIGHT SIDEBAR ════════════════════════════════════════════════════ */}
        <aside className={`kb-sidebar ${isSidebarOpen ? 'open' : ''}`}>
          <button className="kb-sidebar-toggle-tab" onClick={() => setIsSidebarOpen(!isSidebarOpen)} title={isSidebarOpen ? "Сховати панель" : "Показати аналітику"}>
            <div className="tab-arrow-icon">
              {isSidebarOpen ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
            </div>
            <span className="tab-text">ІНФО</span>
            <div className="tab-indicator-dots" />
          </button>

          {/* ── DEPARTMENT TASKS ────────────────────────────────────────────── */}
          {(() => {
            const pos = (currentUser?.position || '').toLowerCase()
            const rights = currentUser?.access_rights || {}
            const isSuperOrProdDirector = rights.director || rights.master || rights.foreman ||
              pos.includes('адмін') || pos.includes('директор') || pos.includes('керівник')

            if (!isSuperOrProdDirector) return null

            return (
              <div className="sb-block">
                <div className="sb-block-head">
                  <Briefcase size={13} />
                  <span>ЗАВДАННЯ ВІДДІЛІВ</span>
                </div>
                <div className="sb-dept-list">
                  {DEPARTMENTS.map(d => {
                    // Calculate counts for this department
                    const deptTasks = (managementTasks || []).filter(t => !t.project_id).filter(t => {
                      if (d.id === 'all') return true
                      return getTaskDepartment(t, systemUsers, companyStructure) === d.id
                    })

                    const todoCnt = deptTasks.filter(t => t.status === 'todo').length
                    const progCnt = deptTasks.filter(t => t.status === 'in_progress').length
                    const reviewCnt = deptTasks.filter(t => t.status === 'review').length
                    const overdueCnt = deptTasks.filter(t => isOverdueTask(t)).length

                    const isSelected = selectedDeptFilter === d.id

                    return (
                      <div key={d.id} className={`sb-dept-item ${isSelected ? 'active' : ''}`}
                        onClick={() => setSelectedDeptFilter(isSelected ? 'all' : d.id)}>
                        <span className="sb-dept-name">{d.label}</span>
                        <div className="sb-dept-badges">
                          {todoCnt > 0 && <span className="sb-dbadge sb-dbadge-todo" title="Нові">{todoCnt}</span>}
                          {progCnt > 0 && <span className="sb-dbadge sb-dbadge-prog" title="В роботі">{progCnt}</span>}
                          {reviewCnt > 0 && <span className="sb-dbadge sb-dbadge-rev" title="Перевірка">{reviewCnt}</span>}
                          {overdueCnt > 0 && <span className="sb-dbadge sb-dbadge-over" title="Прострочено">{overdueCnt}</span>}
                          {todoCnt === 0 && progCnt === 0 && reviewCnt === 0 && overdueCnt === 0 && (
                            <span className="sb-dbadge sb-dbadge-empty">0</span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })()}

          {/* ── UPCOMING DEADLINES ───────────────────────────────────────── */}
          <div className="sb-block">
            <div className="sb-block-head">
              <Calendar size={13} />
              <span>ДЕДЛАЙНИ</span>
            </div>
            <div className="sb-deadline-list">
              {(() => {
                const now = new Date()
                const in7 = new Date(now.getTime() + 7 * 86400000)
                const allTasks = (managementTasks || []).filter(t => !t.project_id)
                // Tasks visible to current user
                const visibleTasks = isDirector ? allTasks : allTasks.filter(t => isTaskRelevantToUser(t, currentUser))
                const upcoming = visibleTasks
                  .filter(t => t.deadline && t.status !== 'done')
                  .map(t => ({ ...t, _dl: new Date(t.deadline) }))
                  .sort((a, b) => a._dl - b._dl)
                  .slice(0, 6)

                if (upcoming.length === 0) return (
                  <div className="sb-empty">Немає наступних дедлайнів</div>
                )
                return upcoming.map(task => {
                  const overdue = task._dl < now && task.status !== 'done'
                  const isToday = task._dl.toDateString() === now.toDateString()
                  const isSoon = task._dl <= in7 && !overdue
                  const assignee = (systemUsers || []).find(u => u.login === task.assigned_to)
                  const daysLeft = Math.ceil((task._dl - now) / 86400000)
                  return (
                    <div key={task.id} className={`sb-deadline-item ${overdue ? 'dl-overdue' : isSoon ? 'dl-soon' : ''}`}
                      onClick={() => handleOpenTask(task)}>
                      <div className="dl-left">
                        <div className="dl-date" style={{ color: overdue ? '#ef4444' : isSoon ? '#f59e0b' : '#888' }}>
                          {overdue ? `Простр. ${Math.abs(daysLeft)}д` : isToday ? 'Сьогодні' : `${daysLeft}д`}
                        </div>
                        <div className="dl-title">{task.title}</div>
                      </div>
                      {!task.is_collective && assignee && (
                        <UserAvatar user={assignee} size={22} />
                      )}
                    </div>
                  )
                })
              })()}
            </div>
          </div>

          {/* ── RECENT ACTIVITY ─────────────────────────────────────────────── */}
          <div className="sb-block">
            <div className="sb-block-head">
              <TrendingUp size={13} />
              <span>СТАТИСТИКА</span>
            </div>
            <div className="sb-stats-grid">
              {(() => {
                const all = (managementTasks || []).filter(t => !t.project_id)
                const visibleAll = isDirector ? all : all.filter(t => isTaskRelevantToUser(t, currentUser))
                const byStatus = COLUMNS.map(col => ({
                  ...col,
                  count: visibleAll.filter(t => t.status === col.id).length,
                  pct: visibleAll.length ? Math.round(visibleAll.filter(t => t.status === col.id).length / visibleAll.length * 100) : 0
                }))
                const urgent = visibleAll.filter(t => t.priority === 'urgent' && t.status !== 'done').length
                const withChecklist = visibleAll.filter(t => Array.isArray(t.checklist) && t.checklist.length > 0).length
                const checklistDone = visibleAll.filter(t => {
                  if (!Array.isArray(t.checklist) || !t.checklist.length) return false
                  return t.checklist.every(i => i.done)
                }).length
                return (
                  <>
                    {byStatus.map(col => (
                      <div key={col.id} className="sb-stat-row">
                        <div className="sb-stat-label" style={{ color: col.color }}>{col.title}</div>
                        <div className="sb-stat-bar-wrap">
                          <div className="sb-stat-bar">
                            <div style={{ width: `${col.pct}%`, background: col.color, height: '100%', borderRadius: 2, transition: 'width 0.5s ease' }} />
                          </div>
                          <span className="sb-stat-num" style={{ color: col.color }}>{col.count}</span>
                        </div>
                      </div>
                    ))}
                    <div className="sb-divider" />
                    <div className="sb-mini-stats">
                      <div className="sb-mini-stat">
                        <span className="sb-mini-label">Нагальних</span>
                        <span className="sb-mini-val" style={{ color: urgent > 0 ? '#ef4444' : '#555' }}>{urgent}</span>
                      </div>
                      <div className="sb-mini-stat">
                        <span className="sb-mini-label">З чеклістом</span>
                        <span className="sb-mini-val" style={{ color: '#60a5fa' }}>{withChecklist}</span>
                      </div>
                      <div className="sb-mini-stat">
                        <span className="sb-mini-label">Чекл. 100%</span>
                        <span className="sb-mini-val" style={{ color: '#10b981' }}>{checklistDone}</span>
                      </div>
                    </div>
                  </>
                )
              })()}
            </div>
          </div>

        </aside>
      </div>

      {/* Floating Chat-like Action Button for New Task */}
      <button className="kb-floating-add-btn" onClick={() => setCreateOpen(true)} title="Створити нову задачу">
        <Plus size={24} />
      </button>

      {/* ══════════════════════════════════════════════════════════════════
          DETAIL MODAL
      ══════════════════════════════════════════════════════════════════ */}
      {detailOpen && selectedTask && (
        <div className="modal-overlay" onClick={() => setDetailOpen(false)}>
          <div className="modal-box detail-modal" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="modal-head" style={{ borderBottomColor: (PRIORITY_CFG[selectedTask.priority] || PRIORITY_CFG.medium).color + '30' }}>
              <div className="modal-head-left">
                <span className="priority-dot" style={{ background: (PRIORITY_CFG[selectedTask.priority] || PRIORITY_CFG.medium).color }} />
                <h2>{selectedTask.title}</h2>
              </div>
              <div className="modal-head-right">
                {canManageTask(selectedTask) && (
                  <>
                    <button className="icon-btn" onClick={() => { setDetailOpen(false); handleOpenEdit(selectedTask) }} title="Редагувати"><Edit3 size={16} /></button>
                    <button className="icon-btn danger" onClick={e => handleDelete(selectedTask.id, e)} title="Видалити"><Trash2 size={16} /></button>
                  </>
                )}
                <button className="icon-btn" onClick={() => setDetailOpen(false)}><X size={18} /></button>
              </div>
            </div>

            <div className="detail-body">
              {/* Sidebar */}
              <aside className="detail-side">
                {/* Status */}
                <div className="side-block">
                  <label>СТАТУС</label>
                  {canManageTask(selectedTask) ? (
                    <select className="status-select" value={selectedTask.status}
                      onChange={async e => handleStatusChange(e.target.value)}>
                      {COLUMNS.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                    </select>
                  ) : (
                    <div className="side-val status-chip" style={{ color: COLUMNS.find(c => c.id === selectedTask.status)?.color }}>
                      {COLUMNS.find(c => c.id === selectedTask.status)?.title}
                    </div>
                  )}
                </div>

                {/* Assignees */}
                <div className="side-block">
                  <label>ВИКОНАВЦІ</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {getAssignees(selectedTask).length > 0
                      ? getAssignees(selectedTask).map(login => {
                          const u = (systemUsers || []).find(u => u.login === login)
                          return u ? (
                            <div key={login} className="side-val">
                              <UserAvatar user={u} size={22} showName />
                            </div>
                          ) : null
                        })
                      : <div className="side-val"><UserAvatar user={null} size={22} showName /></div>
                    }
                  </div>
                </div>

                {/* Deadline */}
                {selectedTask.deadline && (
                  <div className="side-block">
                    <label>ДЕДЛАЙН</label>
                    <div className="side-val" style={{ color: isOverdueTask(selectedTask) ? '#ef4444' : '#888' }}>
                      <Calendar size={13} />
                      {new Date(selectedTask.deadline).toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </div>
                  </div>
                )}

                {/* Creator */}
                <div className="side-block">
                  <label>ТВОРЕЦЬ</label>
                  <div className="side-val">
                    <UserAvatar user={(systemUsers || []).find(u => u.login === selectedTask.created_by)} size={22} showName />
                  </div>
                </div>

                {/* Priority */}
                <div className="side-block">
                  <label>ПРІОРИТЕТ</label>
                  <PriorityBadge priority={selectedTask.priority} />
                </div>

                {/* Quick actions */}
                {canAdvance(selectedTask) && selectedTask.status !== 'done' && (
                  <div className="side-block">
                    <label>ДІЇ</label>
                    <div className="side-actions">
                      {selectedTask.status === 'todo' && (
                        <button className="sa-btn sa-start" onClick={() => handleStatusChange('in_progress')}>▶ Почати роботу</button>
                      )}
                      {selectedTask.status === 'in_progress' && (
                        <button className="sa-btn sa-review" onClick={() => handleStatusChange('review')}>⚙ На перевірку</button>
                      )}
                      {selectedTask.status === 'review' && (
                        <>
                          {canManageTask(selectedTask) ? (
                            <>
                              <button className="sa-btn sa-approve" onClick={() => handleStatusChange('done')}>✓ Прийняти</button>
                              <button className="sa-btn sa-reject" onClick={() => handleStatusChange('in_progress')}>✕ Відхилити</button>
                            </>
                          ) : (
                            <button className="sa-btn sa-reject" style={{ background: 'rgba(255,255,255,0.05)', color: '#ccc', border: '1px solid rgba(255,255,255,0.1)' }} onClick={() => handleStatusChange('in_progress')}>↩ Скасувати перевірку</button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}
              </aside>

              {/* Main content */}
              <div className="detail-main">
                {/* Tabs */}
                <div className="detail-tabs">
                  {[
                    ['desc', 'Опис', <Eye size={13} />],
                    ['checklist', `Чеклист${Array.isArray(selectedTask.checklist) && selectedTask.checklist.length ? ` (${selectedTask.checklist.length})` : ''}`, <CheckSquare size={13} />],
                    ['comments', `Коментарі (${parsedSelectedTask.comments.length})`, <MessageSquare size={13} />],
                  ].map(([id, lbl, icon]) => (
                    <button key={id} className={`dtab ${detailTab === id ? 'active' : ''}`} onClick={() => setDetailTab(id)}>
                      {icon} {lbl}
                    </button>
                  ))}
                </div>

                {/* Tab content */}
                {detailTab === 'desc' && (
                  <div className="tab-content">
                    <div className="desc-box">
                      {parsedSelectedTask.description || <span className="dim-text">Опис відсутній</span>}
                    </div>
                  </div>
                )}

                {detailTab === 'checklist' && (
                  <div className="tab-content">
                    <ChecklistEditor
                      items={Array.isArray(selectedTask.checklist) ? selectedTask.checklist : []}
                      onToggle={(itemId) => handleToggleCheckItem(selectedTask, itemId)}
                      newItem={newCheckItem}
                      setNewItem={setNewCheckItem}
                      onAdd={async () => {
                        if (!newCheckItem.trim()) return
                        const updated = [...(Array.isArray(selectedTask.checklist) ? selectedTask.checklist : []), { id: genId(), text: newCheckItem.trim(), done: false }]
                        await updateManagementTask(selectedTask.id, { checklist: updated })
                        setSelectedTask(prev => ({ ...prev, checklist: updated }))
                        setNewCheckItem('')
                      }}
                      onAddSubItem={async (parentId, text) => {
                        const updated = [...(Array.isArray(selectedTask.checklist) ? selectedTask.checklist : []), { id: genId(), text, done: false, parent_id: parentId }]
                        await updateManagementTask(selectedTask.id, { checklist: updated })
                        setSelectedTask(prev => ({ ...prev, checklist: updated }))
                      }}
                      onRemove={async (itemId) => {
                        const updated = (Array.isArray(selectedTask.checklist) ? selectedTask.checklist : []).filter(i =>
                          String(i.id) !== String(itemId) && String(i.parent_id) !== String(itemId)
                        )
                        await updateManagementTask(selectedTask.id, { checklist: updated })
                        setSelectedTask(prev => ({ ...prev, checklist: updated }))
                      }}
                      canEdit={isManager || selectedTask?.created_by === currentUser?.login}
                      systemUsers={systemUsers}
                      onUpdateAssignee={async (itemId, assignees) => {
                        const updated = (Array.isArray(selectedTask.checklist) ? selectedTask.checklist : []).map(i =>
                          String(i.id) === String(itemId) ? { ...i, assignees: assignees, assignee: assignees[0] || null } : i
                        )
                        await updateManagementTask(selectedTask.id, { checklist: updated })
                        setSelectedTask(prev => ({ ...prev, checklist: updated }))
                      }}
                      onUpdateDeadline={async (itemId, dateStr) => {
                        const updated = (Array.isArray(selectedTask.checklist) ? selectedTask.checklist : []).map(i =>
                          String(i.id) === String(itemId) ? { ...i, deadline: dateStr || null } : i
                        )
                        await updateManagementTask(selectedTask.id, { checklist: updated })
                        setSelectedTask(prev => ({ ...prev, checklist: updated }))
                      }}
                    />
                  </div>
                )}

                {detailTab === 'comments' && (
                  <div className="tab-content comments-content">
                    <div className="comments-list">
                      {parsedSelectedTask.comments.map((c, i) => (
                        <div key={i} className="comment-item">
                          <div className="comment-meta">
                            <span className="comment-author">{c.author}</span>
                            <span className="comment-time">{c.time}</span>
                          </div>
                          <div className="comment-bubble">{c.text}</div>
                        </div>
                      ))}
                      {parsedSelectedTask.comments.length === 0 && (
                        <div className="comments-empty"><MessageSquare size={20} /><span>Немає коментарів</span></div>
                      )}
                    </div>
                    <form className="comment-form" onSubmit={handleAddComment}>
                      <input type="text" placeholder="Напишіть коментар..." value={commentText} onChange={e => setCommentText(e.target.value)} />
                      <button type="submit" className="comment-send">НАДІСЛАТИ</button>
                    </form>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          CREATE MODAL
      ══════════════════════════════════════════════════════════════════ */}
      {createOpen && (
        <div className="modal-overlay" onClick={() => setCreateOpen(false)}>
          <div className="modal-box create-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h2><Plus size={18} /> Нова задача</h2>
              <button className="icon-btn" onClick={() => setCreateOpen(false)}><X size={18} /></button>
            </div>
            <form className="modal-form" onSubmit={handleCreateTask}>
              <div className="form-group">
                <label>Назва задачі *</label>
                <input type="text" required placeholder="Коротко опишіть задачу..." value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Детальний опис</label>
                <textarea rows={3} placeholder="Що саме потрібно зробити..." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="form-row-2">
                <div className="form-group">
                  <label>Пріоритет</label>
                  <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                    <option value="low">Низький</option>
                    <option value="medium">Середній</option>
                    <option value="high">Високий</option>
                    <option value="urgent">НАГАЛЬНО!</option>
                  </select>
                </div>
                <DeadlinePicker
                  value={form.deadline}
                  onChange={dl => setForm(f => ({ ...f, deadline: dl }))}
                />
              </div>

              <ColorPicker value={form.color} onChange={c => setForm(f => ({ ...f, color: c }))} />

              <div className="collective-toggle">
                <label className="toggle-wrap">
                  <input type="checkbox" checked={form.is_collective} onChange={e => setForm(f => ({ ...f, is_collective: e.target.checked, assigned_to: e.target.checked ? '' : f.assigned_to }))} />
                  <span className="toggle-slider"></span>
                  <span>Колективна задача (для відділу)</span>
                </label>
              </div>

              {!form.is_collective ? (
                <MultiAssigneeSelector
                  values={form.assignees || []}
                  onAdd={login => setForm(f => ({ ...f, assignees: [...(f.assignees || []), login] }))}
                  onRemove={login => setForm(f => ({ ...f, assignees: (f.assignees || []).filter(l => l !== login) }))}
                  systemUsers={systemUsers}
                />
              ) : (
                <div className="form-group">
                  <label>Відділ</label>
                  <select value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))}>
                    {DEPARTMENTS.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
                  </select>
                </div>
              )}

              {/* Checklist builder */}
              <div className="form-group">
                <label><CheckSquare size={13} /> Чеклист (пункти)</label>
                <ChecklistEditor
                  items={form.checklist || []}
                  newItem={newCheckItem}
                  setNewItem={setNewCheckItem}
                  onAdd={addCheckItemToForm}
                  onAddSubItem={(parentId, text) => {
                    setForm(f => ({ ...f, checklist: [...(f.checklist || []), { id: genId(), text, done: false, parent_id: parentId }] }))
                  }}
                  onRemove={removeCheckItemFromForm}
                  canEdit={true}
                  systemUsers={systemUsers}
                  onUpdateAssignee={(itemId, assignees) => {
                    setForm(f => ({
                      ...f,
                      checklist: (f.checklist || []).map(i => String(i.id) === String(itemId) ? { ...i, assignees: assignees, assignee: assignees[0] || null } : i)
                    }))
                  }}
                  onUpdateDeadline={(itemId, dateStr) => {
                    setForm(f => ({
                      ...f,
                      checklist: (f.checklist || []).map(i => String(i.id) === String(itemId) ? { ...i, deadline: dateStr || null } : i)
                    }))
                  }}
                />
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-ghost" onClick={() => setCreateOpen(false)} disabled={isSubmitting}>Скасувати</button>
                <button type="submit" className="btn-primary-orange" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <><span className="btn-spinner" />СТВОРЕННЯ...</>
                  ) : 'СТВОРИТИ ЗАДАЧУ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          EDIT MODAL
      ══════════════════════════════════════════════════════════════════ */}
      {editOpen && editForm && isManager && (
        <div className="modal-overlay" onClick={() => setEditOpen(false)}>
          <div className="modal-box create-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h2><Edit3 size={16} /> Редагувати задачу</h2>
              <button className="icon-btn" onClick={() => setEditOpen(false)}><X size={18} /></button>
            </div>
            <form className="modal-form" onSubmit={handleSaveEdit}>
              <div className="form-group">
                <label>Назва задачі *</label>
                <input type="text" required value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Опис</label>
                <textarea rows={3} value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="form-row-2">
                <div className="form-group">
                  <label>Пріоритет</label>
                  <select value={editForm.priority} onChange={e => setEditForm(f => ({ ...f, priority: e.target.value }))}>
                    <option value="low">Низький</option>
                    <option value="medium">Середній</option>
                    <option value="high">Високий</option>
                    <option value="urgent">НАГАЛЬНО!</option>
                  </select>
                </div>
                <DeadlinePicker
                  value={editForm.deadline}
                  onChange={dl => setEditForm(f => ({ ...f, deadline: dl }))}
                />
              </div>
              <div className="form-row-2">
                <div className="form-group">
                  <label>Статус</label>
                  <select value={editForm.status || 'todo'} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}>
                    {COLUMNS.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                  </select>
                </div>
              </div>

              <ColorPicker value={editForm.color || ''} onChange={c => setEditForm(f => ({ ...f, color: c }))} />

              <div className="collective-toggle">
                <label className="toggle-wrap">
                  <input type="checkbox" checked={editForm.is_collective} onChange={e => setEditForm(f => ({ ...f, is_collective: e.target.checked, assigned_to: e.target.checked ? '' : f.assigned_to }))} />
                  <span className="toggle-slider"></span>
                  <span>Колективна задача</span>
                </label>
              </div>

              {!editForm.is_collective ? (
                <MultiAssigneeSelector
                  values={editForm.assignees || []}
                  onAdd={login => setEditForm(f => ({ ...f, assignees: [...(f.assignees || []), login] }))}
                  onRemove={login => setEditForm(f => ({ ...f, assignees: (f.assignees || []).filter(l => l !== login) }))}
                  systemUsers={systemUsers}
                />
              ) : (
                <div className="form-group">
                  <label>Відділ</label>
                  <select value={editForm.department} onChange={e => setEditForm(f => ({ ...f, department: e.target.value }))}>
                    {DEPARTMENTS.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
                  </select>
                </div>
              )}

              {/* Checklist editor */}
              <div className="form-group">
                <label><CheckSquare size={13} /> Чеклист</label>
                <ChecklistEditor
                  items={editForm.checklist || []}
                  newItem={editCheckItem}
                  setNewItem={setEditCheckItem}
                  onAdd={addCheckItemToEdit}
                  onToggle={(itemId) => {
                    setEditForm(f => ({ ...f, checklist: toggleChecklistItem(f.checklist, itemId) }))
                  }}
                  onAddSubItem={(parentId, text) => {
                    setEditForm(f => ({ ...f, checklist: [...(f.checklist || []), { id: genId(), text, done: false, parent_id: parentId }] }))
                  }}
                  onRemove={removeCheckItemFromEdit}
                  canEdit={true}
                  systemUsers={systemUsers}
                  onUpdateAssignee={(itemId, assignees) => {
                    setEditForm(f => ({
                      ...f,
                      checklist: (f.checklist || []).map(i => String(i.id) === String(itemId) ? { ...i, assignees: assignees, assignee: assignees[0] || null } : i)
                    }))
                  }}
                  onUpdateDeadline={(itemId, dateStr) => {
                    setEditForm(f => ({
                      ...f,
                      checklist: (f.checklist || []).map(i => String(i.id) === String(itemId) ? { ...i, deadline: dateStr || null } : i)
                    }))
                  }}
                />
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-ghost" onClick={() => setEditOpen(false)} disabled={isSubmitting}>Скасувати</button>
                <button type="submit" className="btn-primary-orange" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <><span className="btn-spinner" />ЗБЕРЕЖЕННЯ...</>
                  ) : <><Save size={14} /> ЗБЕРЕГТИ</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


      {/* ─── CONFIRMATION MODAL ─── */}
      {confirmModal && (
        <div className="modal-overlay" style={{ zIndex: 10050 }} onClick={() => setConfirmModal(null)}>
          <div className="modal-box" style={{ maxWidth: '400px', padding: '30px', textAlign: 'center', background: '#111', border: '1px solid #222', borderRadius: '24px', boxShadow: '0 20px 50px rgba(0,0,0,0.6)' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 15px 0', fontSize: '1.1rem', color: '#fff', fontWeight: 900, letterSpacing: '0.5px' }}>Підтвердження дії</h3>
            <p style={{ margin: '0 0 25px 0', fontSize: '0.85rem', color: '#aaa', lineHeight: '1.4' }}>{confirmModal.message}</p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', padding: '10px 20px', borderRadius: '10px', fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer' }}
              >
                Скасувати
              </button>
              <button
                type="button"
                onClick={() => {
                  confirmModal.onConfirm()
                  setConfirmModal(null)
                }}
                style={{ background: '#ff9000', border: 'none', color: '#000', padding: '10px 24px', borderRadius: '10px', fontSize: '0.8rem', fontWeight: 900, cursor: 'pointer' }}
              >
                Підтвердити
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── STYLES ───────────────────────────────────────────────────────── */}
      <KanbanStyles />
    </div>
  )
}



export const KanbanStyles = () => (
  <style dangerouslySetInnerHTML={{
        __html: `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; }

        .kb-root {
          background: #020202;
          min-height: 100vh; height: 100vh;
          color: #e8e8e8;
          display: flex; flex-direction: column;
          font-family: 'Inter', sans-serif;
          overflow: hidden;
        }

        /* ── NAV ── */
        .kb-nav {
          display: flex; justify-content: space-between; align-items: center;
          padding: 0 32px; height: 64px;
          background: rgba(8,8,8,0.95);
          border-bottom: 1px solid #111;
          flex-shrink: 0;
          backdrop-filter: blur(20px);
        }
        .kb-nav-left { display: flex; align-items: center; gap: 24px; }
        .kb-back { display: flex; align-items: center; gap: 6px; color: #444; text-decoration: none; font-weight: 800; font-size: 0.75rem; letter-spacing: 1px; transition: color 0.2s; }
        .kb-back:hover { color: #ff9000; }
        .kb-brand { display: flex; align-items: center; gap: 12px; }
        .kb-brand-icon { width: 36px; height: 36px; background: rgba(255,144,0,0.1); border-radius: 10px; display: flex; align-items: center; justify-content: center; color: #ff9000; border: 1px solid rgba(255,144,0,0.2); }
        .kb-brand-text h1 { margin: 0; font-size: 1rem; font-weight: 900; letter-spacing: 2px; color: #fff; }
        .kb-brand-text span { font-size: 0.65rem; color: #333; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; }
        .role-badge { display: flex; align-items: center; gap: 5px; padding: 4px 10px; border-radius: 20px; font-size: 0.65rem; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase; }
        .manager-badge { background: rgba(255,144,0,0.1); color: #ff9000; border: 1px solid rgba(255,144,0,0.25); }
        .projects-nav-btn { display: flex; align-items: center; gap: 9px; min-width: 154px; padding: 7px 10px 7px 7px; border-radius: 11px; text-decoration: none; background: linear-gradient(135deg, #ff9000, #ffab2e); color: #090909; border: 1px solid #ffc05a; box-shadow: 0 5px 18px rgba(255,144,0,0.2); transition: transform .2s, box-shadow .2s, filter .2s; }
        .projects-nav-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(255,144,0,0.38); filter: brightness(1.07); }
        .projects-nav-icon { width: 29px; height: 29px; border-radius: 8px; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,.14); }
        .projects-nav-copy { display: flex; flex: 1; flex-direction: column; line-height: 1.05; }
        .projects-nav-copy b { font-size: .72rem; letter-spacing: .7px; }
        .projects-nav-copy small { margin-top: 4px; font-size: .56rem; font-weight: 700; opacity: .62; }
        .projects-nav-arrow { transition: transform .2s; }
        .projects-nav-btn:hover .projects-nav-arrow { transform: translateX(3px); }

        .kb-nav-right { display: flex; align-items: center; gap: 12px; }
        .kb-search-wrap { display: flex; align-items: center; gap: 8px; }
        .kb-search-wrap.open { background: #0d0d0d; border: 1px solid #222; border-radius: 10px; padding: 4px 10px; }
        .kb-search-input { background: transparent; border: none; color: #fff; outline: none; font-family: inherit; font-size: 0.85rem; width: 180px; }
        .icon-btn { background: transparent; border: 1px solid #1a1a1a; color: #555; width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s; }
        .icon-btn:hover { background: #111; color: #fff; border-color: #333; }
        .icon-btn.danger:hover { background: rgba(239,68,68,0.1); color: #ef4444; border-color: rgba(239,68,68,0.3); }
        .kb-filters { display: flex; background: #0a0a0a; border: 1px solid #1a1a1a; border-radius: 10px; padding: 3px; gap: 2px; }
        .kf-btn { background: transparent; border: none; color: #444; padding: 5px 14px; border-radius: 7px; font-weight: 800; font-size: 0.68rem; cursor: pointer; transition: all 0.2s; white-space: nowrap; letter-spacing: 0.5px; }
        .kf-btn.active { background: #1a1a1a; color: #fff; }
        .kf-btn:hover:not(.active) { color: #888; }
        /* ── FLOATING ADD TASK BUTTON ── */
        .kb-floating-add-btn {
          position: fixed;
          bottom: 32px;
          right: 32px;
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background: linear-gradient(135deg, #ff9000 0%, #ff5500 100%);
          border: none;
          color: #000;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          box-shadow: 0 8px 24px rgba(255, 144, 0, 0.4), inset 0 2px 4px rgba(255, 255, 255, 0.2);
          z-index: 99999;
          transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          animation: float-btn-bounce 3s ease-in-out infinite;
        }
        .kb-floating-add-btn:hover {
          transform: scale(1.1) translateY(-3px);
          box-shadow: 0 12px 30px rgba(255, 144, 0, 0.6);
          background: linear-gradient(135deg, #ffaa33 0%, #ff6622 100%);
        }
        .kb-floating-add-btn:active {
          transform: scale(0.95);
        }
        @keyframes float-btn-bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }

        @media (max-width: 768px) {
          .kb-floating-add-btn {
            bottom: 24px;
            right: 24px;
            width: 50px;
            height: 50px;
          }
        }

        /* ── STATS ── */
        .kb-stats {
          display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px;
          padding: 12px 32px;
          background: #050505; border-bottom: 1px solid #0f0f0f;
          flex-shrink: 0;
        }
        .stat-tile {
          display: flex; align-items: center; gap: 14px;
          padding: 12px 18px;
          background: #080808; border: 1px solid #111; border-radius: 14px;
          cursor: pointer; transition: all 0.2s; position: relative; overflow: hidden;
        }
        .stat-tile::before { content: ''; position: absolute; inset: 0; background: var(--sc); opacity: 0; transition: opacity 0.2s; }
        .stat-tile:hover::before { opacity: 0.03; }
        .stat-tile.active { border-color: var(--sc); box-shadow: 0 0 0 1px var(--sc), 0 4px 20px rgba(0,0,0,0.5); }
        .stat-tile.active::before { opacity: 0.05; }
        .st-icon { width: 32px; height: 32px; border-radius: 8px; background: rgba(255,255,255,0.03); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .st-body { display: flex; flex-direction: column; }
        .st-num { font-size: 1.3rem; font-weight: 900; line-height: 1; }
        .st-label { font-size: 0.6rem; font-weight: 800; color: #333; letter-spacing: 1px; margin-top: 2px; }
        .st-alert-dot { position: absolute; top: 8px; right: 8px; width: 7px; height: 7px; background: #ef4444; border-radius: 50%; animation: pulse-dot 1.5s ease infinite; }
        @keyframes pulse-dot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.4;transform:scale(1.5)} }

        /* ── MOBILE TABS ── */
        .kb-mobile-tabs { display: none; }

        /* ── BODY CONTAINER ── */
        .kb-body-container {
          display: flex;
          flex-direction: row;
          flex: 1;
          min-height: 0;
          overflow: hidden;
        }

        /* ── BOARD ── */
        .kb-board {
          display: flex; gap: 16px; padding: 20px 20px; overflow-x: auto; flex: 1;
          align-items: stretch; min-height: 0;
          scrollbar-width: thin; scrollbar-color: #1a1a1a transparent;
          min-width: 0;
        }
        .kb-board::-webkit-scrollbar { height: 6px; }
        .kb-board::-webkit-scrollbar-track { background: transparent; }
        .kb-board::-webkit-scrollbar-thumb { background: #1a1a1a; border-radius: 3px; }

        /* ── SIDEBAR ── */
        .kb-sidebar {
          position: fixed;
          top: 73px;
          right: 0;
          bottom: 0;
          width: 280px; min-width: 280px; max-width: 280px;
          height: calc(100% - 73px);
          background: #060606; border-left: 1px solid #141414;
          overflow: visible; padding: 16px 14px;
          display: flex; flex-direction: column; gap: 12px;
          z-index: 9999;
          transform: translateX(100%);
          transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          scrollbar-width: thin; scrollbar-color: rgba(255, 144, 0, 0.2) transparent;
        }
        .kb-sidebar.open {
          transform: translateX(0);
          box-shadow: -10px 0 30px rgba(0,0,0,0.8);
        }
        .kb-sidebar::-webkit-scrollbar { width: 6px; }
        .kb-sidebar::-webkit-scrollbar-thumb { background: rgba(255, 144, 0, 0.2); border-radius: 3px; }
        .kb-sidebar::-webkit-scrollbar-thumb:hover { background: rgba(255, 144, 0, 0.4); }

        /* Sticky toggle tab pinned on the edge of the board screen */
        .kb-sidebar-toggle-tab {
          position: absolute;
          left: -32px;
          top: 180px;
          width: 32px;
          height: 120px;
          background: linear-gradient(180deg, #161616 0%, #0c0c0c 100%);
          border: 1px solid #ff900033;
          border-right: none;
          border-radius: 10px 0 0 10px;
          color: #ff9000;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          box-shadow: -8px 0 20px rgba(0,0,0,0.7);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          z-index: 10000;
          padding: 8px 0;
        }
        .kb-sidebar-toggle-tab:hover {
          background: linear-gradient(180deg, #ff9000 0%, #ff5500 100%);
          color: #000;
          border-color: transparent;
          width: 36px;
          left: -36px;
        }
        .kb-sidebar-toggle-tab:hover .tab-text {
          color: #000;
          text-shadow: none;
        }
        .kb-sidebar-toggle-tab:hover .tab-arrow-icon {
          color: #000;
        }
        .kb-sidebar-toggle-tab:hover .tab-indicator-dots {
          background: #000;
        }
        .tab-arrow-icon {
          color: #ff9000;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.2s;
        }
        .tab-text {
          writing-mode: vertical-rl;
          text-orient: mixed;
          transform: rotate(180deg);
          font-size: 0.62rem;
          font-weight: 900;
          letter-spacing: 2px;
          color: #fff;
          text-shadow: 0 1px 2px rgba(0,0,0,0.5);
          user-select: none;
          transition: color 0.2s;
        }
        .tab-indicator-dots {
          width: 4px;
          height: 4px;
          background: #ff9000;
          border-radius: 50%;
          box-shadow: 0 0 8px #ff9000;
          animation: pulse-tab-dot 2s ease infinite;
        }
        @keyframes pulse-tab-dot {
          0%, 100% { transform: scale(1); opacity: 0.7; }
          50% { transform: scale(1.3); opacity: 1; }
        }

        .sb-block { flex-shrink: 0; background: #080808; border: 1px solid #111; border-radius: 14px; overflow: hidden; }
        .sb-block-head { display: flex; align-items: center; gap: 7px; padding: 8px 12px; border-bottom: 1px solid #111; font-size: 0.6rem; font-weight: 900; color: #333; letter-spacing: 1.5px; text-transform: uppercase; }
        .sb-empty { padding: 12px 14px; font-size: 0.72rem; color: #282828; font-weight: 600; text-align: center; }

        /* Department list */
        .sb-dept-list { display: flex; flex-direction: column; gap: 4px; padding: 6px; }
        .sb-dept-item {
          display: flex; align-items: center; justify-content: space-between;
          padding: 6px 10px; border-radius: 8px; cursor: pointer;
          transition: all 0.2s; background: rgba(255,255,255,0.01);
          border: 1px solid transparent;
        }
        .sb-dept-item:hover { background: rgba(255,144,0,0.05); border-color: rgba(255,144,0,0.15); }
        .sb-dept-item.active { background: rgba(255,144,0,0.1); border-color: #ff9000; }
        .sb-dept-name { font-size: 0.8rem; font-weight: 700; color: #ccc; }
        .sb-dept-item.active .sb-dept-name { color: #fff; }
        .sb-dept-badges { display: flex; gap: 4px; align-items: center; }
        .sb-dbadge {
          font-size: 0.65rem; font-weight: 900; padding: 2px 6px; border-radius: 5px; min-width: 18px; text-align: center;
        }
        .sb-dbadge-todo { background: rgba(255,255,255,0.05); color: #888; }
        .sb-dbadge-prog { background: rgba(59,130,246,0.15); color: #3b82f6; }
        .sb-dbadge-rev { background: rgba(245,158,11,0.15); color: #f59e0b; }
        .sb-dbadge-over { background: rgba(239,68,68,0.15); color: #ef4444; }
        .sb-dbadge-empty { background: transparent; color: #222; }

        /* Deadlines */
        .sb-deadline-list { display: flex; flex-direction: column; gap: 1px; }
        .sb-deadline-item { display: flex; align-items: center; gap: 8px; padding: 7px 10px; cursor: pointer; border-bottom: 1px solid #0d0d0d; transition: background 0.15s; }
        .sb-deadline-item:last-child { border-bottom: none; }
        .sb-deadline-item:hover { background: rgba(255,255,255,0.015); }
        .sb-deadline-item.dl-overdue { background: rgba(239,68,68,0.03); }
        .sb-deadline-item.dl-soon { background: rgba(245,158,11,0.02); }
        .dl-left { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
        .dl-date { font-size: 0.68rem; font-weight: 900; margin-bottom: 2px; letter-spacing: 0.3px; white-space: nowrap; }
        .dl-title { font-size: 0.75rem; color: #aaa; white-space: normal; word-break: break-word; font-weight: 600; line-height: 1.25; }
        .dl-avatar { width: 22px; height: 22px; border-radius: 50%; background: linear-gradient(135deg,#ff9000,#ffb347); color: #000; display: flex; align-items: center; justify-content: center; font-size: 0.5rem; font-weight: 900; flex-shrink: 0; }

        /* Stats */
        .sb-stats-grid { padding: 12px; display: flex; flex-direction: column; gap: 8px; }
        .sb-stat-row { display: flex; flex-direction: column; gap: 4px; }
        .sb-stat-label { font-size: 0.6rem; font-weight: 900; letter-spacing: 0.5px; }
        .sb-stat-bar-wrap { display: flex; align-items: center; gap: 6px; }
        .sb-stat-bar { flex: 1; height: 4px; background: #111; border-radius: 2px; overflow: hidden; }
        .sb-stat-num { font-size: 0.7rem; font-weight: 900; min-width: 16px; text-align: right; }
        .sb-divider { height: 1px; background: #111; margin: 4px 0; }
        .sb-mini-stats { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px; }
        .sb-mini-stat { display: flex; flex-direction: column; align-items: center; gap: 2px; background: #0d0d0d; border-radius: 8px; padding: 8px 4px; border: 1px solid #111; }
        .sb-mini-label { font-size: 0.55rem; color: #333; font-weight: 800; text-align: center; letter-spacing: 0.3px; }
        .sb-mini-val { font-size: 1rem; font-weight: 900; }

        /* ── COLUMN ── */
        .kb-col {
          flex: 0 0 290px; display: flex; flex-direction: column;
          background: #070707; border: 1px solid #111; border-radius: 18px;
          overflow: hidden; min-height: 0;
        }
        .col-head {
          padding: 16px 18px 14px; border-top: 3px solid; border-bottom: 1px solid #111;
          display: flex; justify-content: space-between; align-items: center;
          background: #0a0a0a;
        }
        .col-head-left { display: flex; align-items: center; gap: 10px; }
        .col-head h3 { margin: 0; font-size: 0.8rem; font-weight: 900; letter-spacing: 1.5px; }
        .col-cnt { font-size: 0.75rem; font-weight: 900; padding: 3px 9px; border-radius: 20px; }
        .col-add-btn { width: 26px; height: 26px; border-radius: 7px; background: rgba(255,144,0,0.1); border: 1px solid rgba(255,144,0,0.2); color: #ff9000; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s; }
        .col-add-btn:hover { background: #ff9000; color: #000; }
        .col-body { padding: 14px 12px; flex: 1; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; scrollbar-width: thin; scrollbar-color: #1a1a1a transparent; }
        .col-body::-webkit-scrollbar { width: 4px; }
        .col-body::-webkit-scrollbar-thumb { background: #1a1a1a; border-radius: 2px; }
        .col-empty { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 30px 10px; border: 2px dashed #111; border-radius: 12px; color: #1d1d1d; font-size: 0.75rem; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; }

        /* ── CARD ── */
        .kb-card {
          flex-shrink: 0;
          background: #0d0d0d; border: 1px solid #1a1a1a; border-radius: 14px;
          padding: 14px; cursor: pointer; position: relative;
          transition: all 0.22s ease; overflow: hidden;
        }
        .kb-card::after { content:''; position:absolute; inset:0; background: rgba(255,255,255,0); transition: background 0.2s; border-radius: 14px; pointer-events:none; }
        .kb-card:hover { border-color: #2a2a2a; transform: translateY(-2px); box-shadow: 0 12px 28px rgba(0,0,0,0.6); }
        .kb-card:hover::after { background: rgba(255,255,255,0.008); }
        .kb-card.dragging { opacity: 0.4; transform: rotate(2deg); border-style: dashed; }
        .kb-card.overdue { border-color: rgba(239,68,68,0.25) !important; }

        .card-pbar { position: absolute; left: 0; top: 0; bottom: 0; width: 3px; opacity: 0.7; }
        .card-top { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; margin-bottom: 10px; }

        .priority-badge { display: flex; align-items: center; gap: 4px; font-size: 0.6rem; font-weight: 900; padding: 3px 8px; border-radius: 6px; border: 1px solid; letter-spacing: 0.5px; }
        .collective-badge { display: flex; align-items: center; gap: 4px; background: rgba(139,92,246,0.1); color: #8b5cf6; font-size: 0.6rem; font-weight: 800; padding: 3px 8px; border-radius: 6px; border: 1px solid rgba(139,92,246,0.2); }
        .overdue-badge { display: flex; align-items: center; gap: 4px; background: rgba(239,68,68,0.1); color: #ef4444; font-size: 0.6rem; font-weight: 800; padding: 3px 8px; border-radius: 6px; border: 1px solid rgba(239,68,68,0.2); }
        .pulse { animation: pulse-badge 2s ease infinite; }
        @keyframes pulse-badge { 0%,100%{opacity:1} 50%{opacity:0.5} }

        .card-title { margin: 0 0 10px; font-size: 0.88rem; font-weight: 700; line-height: 1.4; color: #ddd; }
        .card-footer { display: flex; justify-content: space-between; align-items: center; margin-top: 10px; padding-top: 10px; border-top: 1px solid #141414; }
        .card-meta { display: flex; align-items: center; gap: 10px; }
        .card-deadline { display: flex; align-items: center; gap: 4px; font-size: 0.7rem; font-weight: 700; }
        .card-cl-count { display: flex; align-items: center; gap: 3px; font-size: 0.7rem; font-weight: 700; }
        .card-users { display: flex; }

        .checklist-bar-wrap { display: flex; align-items: center; gap: 8px; margin: 8px 0; }
        .checklist-bar-track { flex: 1; height: 3px; background: #1a1a1a; border-radius: 2px; overflow: hidden; }
        .checklist-bar-fill { height: 100%; border-radius: 2px; transition: width 0.4s ease; }
        .checklist-bar-label { display: flex; align-items: center; gap: 3px; font-size: 0.65rem; font-weight: 800; white-space: nowrap; }

        /* ── CARD ACTIONS ── */
        .card-actions { display: flex; gap: 6px; margin-top: 10px; padding-top: 10px; border-top: 1px dashed #161616; }
        .ca-row { display: flex; gap: 6px; width: 100%; }
        .ca-btn { flex: 1; padding: 7px 10px; border-radius: 8px; border: 1px solid; font-size: 0.65rem; font-weight: 900; cursor: pointer; transition: all 0.2s; letter-spacing: 0.3px; }
        .ca-start { background: rgba(59,130,246,0.08); color: #3b82f6; border-color: rgba(59,130,246,0.2); }
        .ca-start:hover { background: #3b82f6; color: #fff; border-color: #3b82f6; }
        .ca-review { background: rgba(245,158,11,0.08); color: #f59e0b; border-color: rgba(245,158,11,0.2); }
        .ca-review:hover { background: #f59e0b; color: #000; border-color: #f59e0b; }
        .ca-approve { background: rgba(16,185,129,0.08); color: #10b981; border-color: rgba(16,185,129,0.2); }
        .ca-approve:hover { background: #10b981; color: #fff; }
        .ca-reject { background: rgba(239,68,68,0.08); color: #ef4444; border-color: rgba(239,68,68,0.2); }
        .ca-reject:hover { background: #ef4444; color: #fff; }

        .card-mgr-btns { position: absolute; top: 8px; right: 8px; display: flex; gap: 4px; opacity: 0; transition: opacity 0.2s; }
        .kb-card:hover .card-mgr-btns { opacity: 1; }
        .mgr-btn { width: 22px; height: 22px; border-radius: 5px; border: none; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s; }
        .edit-btn { background: rgba(59,130,246,0.12); color: #3b82f6; }
        .edit-btn:hover { background: #3b82f6; color: #fff; }
        .del-btn { background: rgba(239,68,68,0.12); color: #ef4444; }
        .del-btn:hover { background: #ef4444; color: #fff; }

        /* ── USER AVATAR ── */
        .user-avatar-wrap { display: flex; align-items: center; gap: 7px; }
        .user-avatar { border-radius: 50%; background: linear-gradient(135deg, #ff9000, #ffb347); color: #000; display: flex; align-items: center; justify-content: center; font-weight: 900; text-transform: uppercase; flex-shrink: 0; border: 2px solid #0d0d0d; }
        .avatar-name { font-size: 0.82rem; font-weight: 700; color: #ccc; }
        .ua-unassigned { width: 26px; height: 26px; border-radius: 50%; background: #111; color: #333; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; font-weight: 900; border: 2px dashed #222; }

        /* ── MODAL ── */
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.85); z-index: 1000; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(12px); animation: fade-in 0.2s ease; }
        @keyframes fade-in { from{opacity:0} to{opacity:1} }
        .modal-box { background: #080808; border: 1px solid #1a1a1a; border-radius: 22px; overflow: hidden; box-shadow: 0 40px 80px rgba(0,0,0,0.9); animation: modal-in 0.25s ease; }
        @keyframes modal-in { from{transform:scale(0.95) translateY(10px);opacity:0} to{transform:scale(1) translateY(0);opacity:1} }
        .modal-head { padding: 22px 28px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #111; }
        .modal-head h2 { margin: 0; font-size: 1.05rem; font-weight: 900; display: flex; align-items: center; gap: 10px; }
        .modal-head-left { display: flex; align-items: center; gap: 12px; flex: 1; min-width: 0; }
        .modal-head-left h2 { font-size: 1.05rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .modal-head-right { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
        .priority-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; box-shadow: 0 0 8px currentColor; }

        /* ── DETAIL MODAL ── */
        .detail-modal { width: 900px; max-width: 95vw; max-height: 90vh; display: flex; flex-direction: column; }
        .detail-body { display: grid; grid-template-columns: 220px 1fr; flex: 1; overflow: hidden; }
        .detail-side { padding: 22px 20px; border-right: 1px solid #111; overflow-y: auto; display: flex; flex-direction: column; gap: 18px; background: #060606; }
        .side-block { display: flex; flex-direction: column; gap: 6px; }
        .side-block label { font-size: 0.6rem; font-weight: 900; color: #333; text-transform: uppercase; letter-spacing: 1px; }
        .side-val { display: flex; align-items: center; gap: 7px; font-size: 0.82rem; font-weight: 600; color: #999; }
        .status-chip { font-weight: 900; font-size: 0.82rem; }
        .status-select { background: #0f0f0f; border: 1px solid #222; color: #fff; padding: 8px 10px; border-radius: 8px; font-family: inherit; font-weight: 800; font-size: 0.8rem; width: 100%; cursor: pointer; }
        .side-actions { display: flex; flex-direction: column; gap: 8px; }
        .sa-btn { padding: 9px 12px; border-radius: 9px; border: 1px solid; font-size: 0.7rem; font-weight: 900; cursor: pointer; transition: all 0.2s; text-align: center; }
        .sa-start { background: rgba(59,130,246,0.1); color: #3b82f6; border-color: rgba(59,130,246,0.25); }
        .sa-start:hover { background: #3b82f6; color: #fff; }
        .sa-review { background: rgba(245,158,11,0.1); color: #f59e0b; border-color: rgba(245,158,11,0.25); }
        .sa-review:hover { background: #f59e0b; color: #000; }
        .sa-approve { background: rgba(16,185,129,0.1); color: #10b981; border-color: rgba(16,185,129,0.25); }
        .sa-approve:hover { background: #10b981; color: #fff; }
        .sa-reject { background: rgba(239,68,68,0.1); color: #ef4444; border-color: rgba(239,68,68,0.25); }
        .sa-reject:hover { background: #ef4444; color: #fff; }

        .detail-main { display: flex; flex-direction: column; overflow: hidden; }
        .detail-tabs { display: flex; gap: 2px; padding: 16px 22px 0; border-bottom: 1px solid #111; background: #060606; }
        .dtab { display: flex; align-items: center; gap: 7px; background: transparent; border: none; color: #444; padding: 10px 16px; font-family: inherit; font-size: 0.75rem; font-weight: 800; cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -1px; transition: all 0.2s; letter-spacing: 0.3px; }
        .dtab.active { color: #ff9000; border-bottom-color: #ff9000; }
        .dtab:hover:not(.active) { color: #888; }
        .tab-content { flex: 1; padding: 22px; overflow-y: auto; }
        .desc-box { background: #060606; border: 1px solid #111; border-radius: 14px; padding: 20px; line-height: 1.7; color: #bbb; font-size: 0.88rem; white-space: pre-wrap; min-height: 100px; }
        .dim-text { color: #333; font-style: italic; }

        /* ── CHECKLIST ── */
        .checklist-editor { display: flex; flex-direction: column; gap: 12px; }
        .checklist-progress-row { display: flex; align-items: center; gap: 10px; }
        .cl-track { flex: 1; height: 5px; background: #111; border-radius: 3px; overflow: hidden; }
        .cl-fill { height: 100%; border-radius: 3px; transition: width 0.4s ease; }
        .cl-pct { font-size: 0.75rem; font-weight: 900; color: #888; min-width: 32px; text-align: right; }
        .checklist-items { display: flex; flex-direction: column; gap: 6px; }
        .check-click-area { transition: opacity 0.15s ease; }
        .check-click-area:hover { opacity: 0.85; }
        .check-click-area:active { opacity: 0.7; }
        .checklist-item.parent-item {
          background: #0d0d10 !important;
          border: 1px solid rgba(255, 255, 255, 0.04) !important;
          border-left: 3px solid #ff9000 !important;
          border-radius: 12px !important;
          padding: 12px 16px !important;
          margin-top: 10px !important;
          box-shadow: 0 4px 10px rgba(0,0,0,0.2);
        }
        .checklist-item.child-item {
          background: transparent !important;
          border: none !important;
          border-left: 2px solid rgba(255, 144, 0, 0.25) !important;
          border-radius: 0 !important;
          padding: 6px 12px 6px 16px !important;
          margin-left: 28px !important;
          margin-top: 2px !important;
          margin-bottom: 2px !important;
        }
        .checklist-item.child-item:hover {
          background: rgba(255, 255, 255, 0.02) !important;
          border-left-color: #ff9000 !important;
        }
        .checklist-item.child-item .check-text {
          font-size: 0.8rem !important;
          color: #aaa;
        }
        .checklist-item.child-item.done .check-text {
          color: #555 !important;
        }
        .checklist-item { display: flex; align-items: center; gap: 10px; padding: 9px 12px; background: #090909; border: 1px solid #141414; border-radius: 9px; transition: all 0.2s; }
        .checklist-item.done .check-text { text-decoration: line-through; color: #444; }
        .checklist-item:hover { border-color: #1e1e1e; }
        .check-toggle { background: none; border: none; cursor: pointer; padding: 0; display: flex; align-items: center; flex-shrink: 0; }
        .check-text { flex: 1; font-size: 0.85rem; color: #ccc; line-height: 1.4; }
        .check-remove { background: none; border: none; color: #333; cursor: pointer; padding: 2px; display: flex; align-items: center; opacity: 0; transition: opacity 0.2s; }
        .checklist-item:hover .check-remove { opacity: 1; }
        .check-remove:hover { color: #ef4444; }
        .checklist-empty { text-align: center; padding: 20px; color: #282828; font-size: 0.8rem; font-weight: 700; }
        .add-check-row { display: flex; gap: 8px; }
        .add-check-row input { flex: 1; background: #0d0d0d; border: 1px solid #1a1a1a; color: #fff; padding: 9px 14px; border-radius: 9px; font-family: inherit; font-size: 0.83rem; outline: none; transition: border-color 0.2s; }
        .add-check-row input:focus { border-color: #ff9000; }
        .add-check-btn { width: 36px; height: 36px; border-radius: 9px; background: rgba(255,144,0,0.1); border: 1px solid rgba(255,144,0,0.2); color: #ff9000; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s; }
        .add-check-btn:hover { background: #ff9000; color: #000; }

        /* ── COMMENTS ── */
        .comments-content { display: flex; flex-direction: column; height: 100%; }
        .comments-list { flex: 1; display: flex; flex-direction: column; gap: 10px; overflow-y: auto; margin-bottom: 16px; padding-right: 4px; }
        .comment-item { display: flex; flex-direction: column; gap: 5px; }
        .comment-meta { display: flex; justify-content: space-between; padding: 0 4px; }
        .comment-author { font-size: 0.72rem; font-weight: 900; color: #ff9000; }
        .comment-time { font-size: 0.65rem; color: #333; }
        .comment-bubble { background: #0d0d0d; border: 1px solid #141414; padding: 10px 14px; border-radius: 10px; font-size: 0.82rem; color: #ccc; line-height: 1.5; word-break: break-word; }
        .comments-empty { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 30px; color: #222; }
        .comment-form { display: flex; gap: 8px; padding: 12px; background: #060606; border: 1px solid #111; border-radius: 12px; margin-top: auto; }
        .comment-form input { flex: 1; background: transparent; border: none; color: #fff; outline: none; font-family: inherit; font-size: 0.83rem; }
        .comment-send { background: #ff9000; color: #000; border: none; padding: 8px 16px; border-radius: 8px; font-weight: 900; font-size: 0.7rem; cursor: pointer; white-space: nowrap; }

        /* ── CREATE / EDIT MODAL ── */
        .create-modal { width: 560px; max-width: 95vw; max-height: 90vh; overflow: hidden; display: flex; flex-direction: column; }
        .modal-form { padding: 24px 28px; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 18px; }
        .form-group { display: flex; flex-direction: column; gap: 6px; }
        .form-group label { font-size: 0.65rem; font-weight: 900; color: #444; text-transform: uppercase; letter-spacing: 0.8px; display: flex; align-items: center; gap: 5px; }
        .form-group input, .form-group textarea, .form-group select { background: #0d0d0d; border: 1px solid #1a1a1a; color: #fff; padding: 11px 14px; border-radius: 10px; font-family: inherit; font-size: 0.88rem; outline: none; transition: border-color 0.2s; width: 100%; }
        .form-group input:focus, .form-group textarea:focus, .form-group select:focus { border-color: #ff9000; }
        input[type="date"]::-webkit-calendar-picker-indicator,
        input[type="time"]::-webkit-calendar-picker-indicator { filter: invert(1); cursor: pointer; }
        .form-group textarea { resize: vertical; }
        .form-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }

        /* Toggle */
        .collective-toggle { padding: 12px 16px; background: rgba(255,144,0,0.04); border: 1px solid rgba(255,144,0,0.1); border-radius: 10px; }
        .toggle-wrap { display: flex; align-items: center; gap: 12px; cursor: pointer; font-size: 0.83rem; font-weight: 700; color: #888; }
        .toggle-wrap input[type=checkbox] { display: none; }
        .toggle-slider { position: relative; width: 38px; height: 20px; background: #1a1a1a; border-radius: 10px; transition: background 0.2s; flex-shrink: 0; }
        .toggle-slider::after { content: ''; position: absolute; top: 3px; left: 3px; width: 14px; height: 14px; border-radius: 50%; background: #444; transition: all 0.2s; }
        .toggle-wrap input:checked + .toggle-slider { background: #ff9000; }
        .toggle-wrap input:checked + .toggle-slider::after { left: 21px; background: #000; }

        /* Assignee */
        .assignee-selector { position: relative; }
        .selected-assignee { display: flex; align-items: center; gap: 10px; padding: 10px 14px; background: #0d0d0d; border: 1px solid #ff900030; border-radius: 10px; }
        .clear-btn { background: none; border: none; color: #555; cursor: pointer; margin-left: auto; }
        .clear-btn:hover { color: #ef4444; }
        .assignee-search-wrap { display: flex; align-items: center; gap: 8px; padding: 10px 14px; background: #0d0d0d; border: 1px solid #1a1a1a; border-radius: 10px; }
        .assignee-search-wrap input { flex: 1; background: transparent; border: none; color: #fff; outline: none; font-family: inherit; font-size: 0.88rem; }
        .assignee-search-wrap svg { color: #444; flex-shrink: 0; }
        .assignee-dropdown { position: absolute; top: calc(100% + 4px); left: 0; right: 0; background: #0d0d0d; border: 1px solid #1e1e1e; border-radius: 12px; z-index: 100; overflow: hidden; box-shadow: 0 12px 32px rgba(0,0,0,0.6); }
        .assignee-option { display: flex; align-items: center; gap: 12px; padding: 11px 14px; cursor: pointer; transition: background 0.15s; border-bottom: 1px solid #111; }
        .assignee-option:last-child { border-bottom: none; }
        .assignee-option:hover { background: #141414; }
        .opt-avatar { width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg,#ff9000,#ffb347); color: #000; display: flex; align-items: center; justify-content: center; font-size: 0.7rem; font-weight: 900; flex-shrink: 0; }
        .opt-info { display: flex; flex-direction: column; }
        .opt-name { font-size: 0.85rem; font-weight: 700; color: #ddd; }
        .opt-pos { font-size: 0.65rem; color: #444; text-transform: uppercase; }
        .no-results { padding: 14px; text-align: center; color: #333; font-size: 0.8rem; }

        /* Checklist builder in create form */
        .cl-builder { display: flex; flex-direction: column; gap: 6px; }
        .cl-build-item { display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: #0a0a0a; border: 1px solid #141414; border-radius: 8px; font-size: 0.82rem; color: #bbb; }
        .cl-build-item.done span { text-decoration: line-through; color: #444; }
        .cl-build-item button { background: none; border: none; color: #333; cursor: pointer; padding: 2px; display: flex; align-items: center; margin-left: auto; }
        .cl-build-item button:hover { color: #ef4444; }
        .cl-build-item > button:first-child { margin-left: 0; flex-shrink: 0; }

        /* Footer */
        .modal-footer { display: flex; justify-content: flex-end; gap: 10px; padding: 16px 28px; border-top: 1px solid #111; background: #060606; }
        .btn-ghost { background: transparent; border: 1px solid #1e1e1e; color: #555; padding: 9px 20px; border-radius: 9px; font-weight: 800; font-size: 0.8rem; cursor: pointer; transition: all 0.2s; }
        .btn-ghost:hover { background: #111; color: #888; }
        .btn-primary-orange { display: flex; align-items: center; gap: 7px; background: #ff9000; color: #000; border: none; padding: 9px 22px; border-radius: 9px; font-weight: 900; font-size: 0.8rem; cursor: pointer; transition: all 0.2s; }
        .btn-primary-orange:hover:not(:disabled) { background: #ffaa33; box-shadow: 0 4px 12px rgba(255,144,0,0.3); }
        .btn-primary-orange:disabled { background: #7a4400; color: #3a2000; cursor: not-allowed; opacity: 0.7; }
        .btn-ghost:disabled { opacity: 0.4; cursor: not-allowed; }
        .btn-spinner { display: inline-block; width: 13px; height: 13px; border: 2px solid rgba(0,0,0,0.3); border-top-color: #000; border-radius: 50%; animation: spin 0.7s linear infinite; flex-shrink: 0; }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* ── RESPONSIVE ── */
        @media (max-width: 1100px) {
          .kb-nav { padding: 0 20px; flex-wrap: wrap; height: auto; gap: 10px; padding-top: 12px; padding-bottom: 12px; }
          .kb-nav-right { flex-wrap: wrap; gap: 8px; }
          .projects-nav-btn { min-width: auto; }
          .projects-nav-copy small { display: none; }
          .kb-stats { grid-template-columns: repeat(2, 1fr); padding: 12px 20px; }
          .kb-board { padding: 16px 20px; }
        }
        @media (max-width: 768px) {
          .kb-body-container { display: block !important; overflow-y: auto; }
          .kb-sidebar {
            position: fixed !important;
            top: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
            width: 100% !important;
            min-width: 100% !important;
            max-width: 100% !important;
            height: 100% !important;
            z-index: 999999 !important;
            border-left: none !important;
            transform: translateX(100%) !important;
            transition: transform 0.3s ease !important;
            overflow-y: auto !important;
            padding: 24px 20px !important;
            background: #030303 !important;
          }
          .kb-sidebar.open {
            transform: translateX(0) !important;
          }
          .kb-sidebar-toggle-tab {
            left: -36px !important;
            top: 250px !important;
            width: 36px !important;
            height: 120px !important;
            border-radius: 10px 0 0 10px !important;
            box-shadow: -6px 0 15px rgba(0,0,0,0.8) !important;
            z-index: 1000000 !important;
          }
          /* Compact Statistics Block for mobile */
          .kb-stats {
            grid-template-columns: repeat(4, 1fr) !important;
            padding: 8px 10px !important;
            gap: 6px !important;
          }
          .stat-tile {
            padding: 6px 8px !important;
            gap: 6px !important;
            border-radius: 8px !important;
          }
          .st-icon {
            width: 20px !important;
            height: 20px !important;
            border-radius: 5px !important;
          }
          .st-icon svg {
            width: 11px !important;
            height: 11px !important;
          }
          .st-num {
            font-size: 0.9rem !important;
          }
          .st-label {
            font-size: 0.5rem !important;
            margin-top: 0px !important;
          }
          .kb-mobile-tabs { display: flex; background: #060606; border-bottom: 1px solid #111; overflow-x: auto; padding: 6px 12px; gap: 6px; flex-shrink: 0; }
          .mob-tab { display: flex; align-items: center; gap: 6px; background: transparent; border: none; border-bottom: 2px solid transparent; padding: 8px 12px; color: #444; font-weight: 800; font-size: 0.7rem; cursor: pointer; white-space: nowrap; transition: all 0.2s; letter-spacing: 0.5px; }
          .mob-tab.active { color: #fff; border-bottom-color: var(--cc); }
          .mob-tab-cnt { font-size: 0.65rem; font-weight: 900; padding: 2px 6px; border-radius: 5px; }
          .kb-board { display: block !important; height: auto !important; padding: 16px !important; }
          .kb-col { display: none !important; width: 100% !important; height: auto !important; margin-bottom: 20px; }
          .kb-col.mob-active { display: block !important; }
          .col-body { display: block !important; height: auto !important; }
          .detail-body { display: block !important; overflow-y: auto !important; height: auto !important; max-height: calc(95vh - 60px); }
          .detail-side { border-right: none; border-bottom: 1px solid #111; overflow: visible !important; height: auto !important; }
          .detail-main { overflow: visible !important; height: auto !important; }
          .detail-modal { max-height: 95vh; display: flex; flex-direction: column; overflow: hidden; }
          
          /* Checklist Mobile Improvements */
          .checklist-item {
            flex-wrap: wrap !important;
            gap: 6px 10px !important;
            align-items: flex-start !important;
          }
          .checklist-item .check-text {
            flex: 1;
            min-width: 180px;
          }
          .checklist-item > div {
            width: 100% !important;
            margin-left: 0 !important;
            padding-left: 26px !important;
            justify-content: flex-start !important;
            gap: 12px !important;
            flex-wrap: wrap;
          }
          .checklist-item > div input[type="date"] {
            width: 110px !important;
          }
          .checklist-item > div input[type="time"] {
            width: 70px !important;
          }
          .kb-filters { overflow-x: auto; }
          .kf-btn { font-size: 0.6rem; padding: 5px 10px; }
        }
      `}} />
)

export const KanbanTaskModal = ({ initialAssignee, onClose, onCreated }) => {
  const { currentUser, systemUsers, addManagementTask } = useMES()
  const blankForm = { title: '', description: '', priority: 'medium', color: '', assigned_to: initialAssignee || '', assignees: initialAssignee ? [initialAssignee] : [], is_collective: false, department: 'all', deadline: '', checklist: [] }
  const [form, setForm] = React.useState(blankForm)
  const [newCheckItem, setNewCheckItem] = React.useState('')
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const handleCreateTask = async (e) => {
    e.preventDefault()
    if (!form.title.trim() || isSubmitting) return
    setIsSubmitting(true)
    try {
      const payload = {
        ...form,
        color: form.color || '',
        assignees: form.assignees || [],
        assigned_to: (form.assignees || [])[0] || form.assigned_to || '',
        status: 'todo'
      }
      const { data, error } = await addManagementTask(payload)
      if (!error && onCreated) onCreated(data)
      onClose()
    } catch {
      setIsSubmitting(false)
    }
  }

  const addCheckItemToForm = () => {
    if (!newCheckItem.trim()) return
    setForm(f => ({ ...f, checklist: [...(f.checklist || []), { id: genId(), text: newCheckItem.trim(), done: false }] }))
    setNewCheckItem('')
  }
  
  const removeCheckItemFromForm = (id) => {
    setForm(f => ({ ...f, checklist: f.checklist.filter(i => String(i.id) !== String(id) && String(i.parent_id) !== String(id)) }))
  }

  return (
    <>
      <KanbanStyles />
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-box create-modal" onClick={e => e.stopPropagation()}>
          <div className="modal-head">
            <h2><Plus size={18} /> Нова задача</h2>
            <button className="icon-btn" onClick={onClose}><X size={18} /></button>
          </div>
          <form className="modal-form" onSubmit={handleCreateTask}>
            <div className="form-group">
              <label>Назва задачі *</label>
              <input type="text" required placeholder="Коротко опишіть задачу..." value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} autoFocus />
            </div>
            <div className="form-group">
              <label>Детальний опис</label>
              <textarea rows={3} placeholder="Що саме потрібно зробити..." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="form-row-2">
              <div className="form-group">
                <label>Пріоритет</label>
                <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                  <option value="low">Низький</option>
                  <option value="medium">Середній</option>
                  <option value="high">Високий</option>
                  <option value="urgent">НАГАЛЬНО!</option>
                </select>
              </div>
              <DeadlinePicker value={form.deadline} onChange={dl => setForm(f => ({ ...f, deadline: dl }))} />
            </div>
            <ColorPicker value={form.color} onChange={c => setForm(f => ({ ...f, color: c }))} />
            <div className="collective-toggle">
              <label className="toggle-wrap">
                <input type="checkbox" checked={form.is_collective} onChange={e => setForm(f => ({ ...f, is_collective: e.target.checked, assigned_to: e.target.checked ? '' : f.assigned_to }))} />
                <span className="toggle-slider"></span>
                <span>Колективна задача (для відділу)</span>
              </label>
            </div>
            {!form.is_collective ? (
              <MultiAssigneeSelector values={form.assignees || []} onAdd={login => setForm(f => ({ ...f, assignees: [...(f.assignees || []), login] }))} onRemove={login => setForm(f => ({ ...f, assignees: (f.assignees || []).filter(l => l !== login) }))} systemUsers={systemUsers} />
            ) : (
              <div className="form-group">
                <label>Відділ</label>
                <select value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))}>
                  {DEPARTMENTS.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
                </select>
              </div>
            )}
            <div className="form-group">
              <label><CheckSquare size={13} /> Чеклист (пункти)</label>
              <ChecklistEditor items={form.checklist || []} newItem={newCheckItem} setNewItem={setNewCheckItem} onAdd={addCheckItemToForm} onAddSubItem={(parentId, text) => { setForm(f => ({ ...f, checklist: [...(f.checklist || []), { id: genId(), text, done: false, parent_id: parentId }] })) }} onRemove={removeCheckItemFromForm} canEdit={true} systemUsers={systemUsers} onUpdateAssignee={(itemId, assignees) => { setForm(f => ({ ...f, checklist: (f.checklist || []).map(i => String(i.id) === String(itemId) ? { ...i, assignees: assignees, assignee: assignees[0] || null } : i) })) }} onUpdateDeadline={(itemId, dateStr) => { setForm(f => ({ ...f, checklist: (f.checklist || []).map(i => String(i.id) === String(itemId) ? { ...i, deadline: dateStr || null } : i) })) }} />
            </div>
            <div className="modal-footer">
              <button type="button" className="btn-ghost" onClick={onClose} disabled={isSubmitting}>Скасувати</button>
              <button type="submit" className="btn-primary-orange" disabled={isSubmitting}> {isSubmitting ? <><span className="btn-spinner" />СТВОРЕННЯ...</> : 'СТВОРИТИ ЗАДАЧУ'} </button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}


export default KanbanModule
