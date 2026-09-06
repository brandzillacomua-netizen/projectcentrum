import React, { useState, useMemo } from 'react'
import { Plus, CheckSquare, Square, X, ChevronDown, ChevronUp, User, Calendar, Search } from 'lucide-react'
import { checklistProgress, getInitials, getChecklistAssignees } from '../utils/kanbanHelpers'

export const ChecklistMultiAssigneeSelector = ({ values = [], onChange, systemUsers }) => {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
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
            {values.length > 0 && (
              <div
                onClick={() => { onChange([]); setOpen(false); setSearch('') }}
                style={{ padding: '6px 10px', fontSize: '0.7rem', color: '#ef4444', cursor: 'pointer', borderBottom: '1px solid #1a1a1a', fontWeight: 700 }}
              >
                Зняти всіх
              </div>
            )}
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
