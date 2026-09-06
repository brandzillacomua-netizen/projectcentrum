import React, { useState } from 'react'
import { Plus, Search, X } from 'lucide-react'

export const TaskProjectsSearchPicker = ({ label, placeholder, options, selected, onToggle }) => {
  const [search, setSearch] = useState('')
  const normalized = search.trim().toLocaleLowerCase('uk-UA')
  const chosen = options.filter(option => selected.includes(option.value))
  const results = normalized
    ? options.filter(option => !selected.includes(option.value) && `${option.label} ${option.meta || ''}`.toLocaleLowerCase('uk-UA').includes(normalized)).slice(0, 8)
    : []

  return (
    <div className="tp-picker">
      <span className="tp-label">{label}</span>
      {!!chosen.length && (
        <div className="tp-chips">
          {chosen.map(option => (
            <button type="button" key={option.value} onClick={() => onToggle(option.value)} title="Прибрати">
              <span>{option.label}</span>
              <X size={12} />
            </button>
          ))}
        </div>
      )}
      <div className="tp-picker-search">
        <Search size={15} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder={placeholder} />
      </div>
      {normalized && (
        <div className="tp-picker-results">
          {results.map(option => (
            <button type="button" key={option.value} onClick={() => { onToggle(option.value); setSearch('') }}>
              <span>{option.label}</span>
              {option.meta && <small>{option.meta}</small>}
              <Plus size={14} />
            </button>
          ))}
          {!results.length && <div>Нічого не знайдено</div>}
        </div>
      )}
    </div>
  )
}

export default TaskProjectsSearchPicker
