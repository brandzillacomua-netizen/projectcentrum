import React, { useState, useRef, useEffect } from 'react'
import { Plus, Search, X } from 'lucide-react'

export const TaskProjectsSearchPicker = ({ label, placeholder, options = [], selected = [], onToggle }) => {
  const [search, setSearch] = useState('')
  const [isFocused, setIsFocused] = useState(false)
  const containerRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsFocused(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const normalized = search.trim().toLocaleLowerCase('uk-UA')
  const chosen = (options || []).filter(option => (selected || []).includes(option.value))
  const results = normalized
    ? (options || []).filter(option => !(selected || []).includes(option.value) && `${option.label} ${option.meta || ''} ${option.value}`.toLocaleLowerCase('uk-UA').includes(normalized)).slice(0, 10)
    : (isFocused ? (options || []).filter(option => !(selected || []).includes(option.value)).slice(0, 8) : [])

  return (
    <div className="tp-picker" ref={containerRef}>
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
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          onFocus={() => setIsFocused(true)}
          placeholder={placeholder}
        />
      </div>
      {(normalized || isFocused) && (
        <div className="tp-picker-results">
          {results.map(option => (
            <button
              type="button"
              key={option.value}
              onMouseDown={e => e.preventDefault()}
              onClick={() => {
                onToggle(option.value)
                setSearch('')
              }}
            >
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
