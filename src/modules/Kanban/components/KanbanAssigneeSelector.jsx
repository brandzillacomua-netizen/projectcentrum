import React, { useState, useMemo } from 'react'
import { Search, X, Users } from 'lucide-react'
import { UserAvatar } from './KanbanUserAvatar'
import { getInitials } from '../utils/kanbanHelpers'

export const AssigneeSelector = ({ value, onSelect, searchVal, setSearchVal, systemUsers, canClear, label = 'Призначити виконавця' }) => {
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

export const MultiAssigneeSelector = ({ values = [], onAdd, onRemove, systemUsers }) => {
  const [search, setSearch] = useState('')
  const results = useMemo(() => {
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
