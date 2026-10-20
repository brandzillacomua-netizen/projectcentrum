import React, { useState, useMemo, useRef, useEffect } from 'react'
import { ChevronDown, ChevronUp, Search, X } from 'lucide-react'

export const EmployeeMultiSelect = ({
  selected,
  onChange,
  options = []
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef(null)
  const searchInputRef = useRef(null)

  // Normalize selected to an array
  const selectedList = useMemo(() => {
    if (!selected || selected === 'all') return []
    if (Array.isArray(selected)) return selected.filter(s => s && s !== 'all')
    return [selected]
  }, [selected])

  // Close on outside click or Escape
  useEffect(() => {
    if (!isOpen) return
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  // Focus search input when opening
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [isOpen])

  // Filter options by search
  const filteredOptions = useMemo(() => {
    if (!search.trim()) return options
    const q = search.toLowerCase().trim()
    return options.filter(op => String(op || '').toLowerCase().includes(q))
  }, [options, search])

  const handleToggle = (op) => {
    let next
    if (selectedList.includes(op)) {
      next = selectedList.filter(item => item !== op)
    } else {
      next = [...selectedList, op]
    }
    onChange(next.length === 0 ? 'all' : next)
  }

  const handleSelectAll = () => {
    const next = Array.from(new Set([...selectedList, ...filteredOptions]))
    onChange(next)
  }

  const handleClearAll = (e) => {
    if (e) e.stopPropagation()
    onChange('all')
  }

  const getButtonLabel = () => {
    if (selectedList.length === 0) return '-- Всі працівники --'
    if (selectedList.length === 1) return selectedList[0]
    if (selectedList.length === 2) return `${selectedList[0]}, ${selectedList[1]}`
    return `Обрано: ${selectedList.length} працівників`
  }

  return (
    <div className="emp-multiselect-container" ref={containerRef}>
      <button
        type="button"
        className={`reports-filter-select emp-multiselect-trigger ${isOpen ? 'is-open' : ''} ${selectedList.length > 0 ? 'has-selection' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        title={selectedList.length > 0 ? selectedList.join(', ') : 'Всі працівники'}
      >
        <span className="emp-multiselect-label">
          {getButtonLabel()}
        </span>

        {selectedList.length > 0 && (
          <span
            className="emp-multiselect-clear-icon"
            onClick={handleClearAll}
            title="Скинути фільтр"
          >
            <X size={13} />
          </span>
        )}

        <span className="emp-multiselect-arrow">
          {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </span>
      </button>

      {isOpen && (
        <div className="emp-multiselect-dropdown">
          {/* Quick Search */}
          <div className="emp-multiselect-search-box">
            <Search size={14} className="emp-multiselect-search-icon" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Пошук працівника..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="emp-multiselect-search-input"
            />
            {search && (
              <button
                type="button"
                className="emp-multiselect-search-clear"
                onClick={() => setSearch('')}
                title="Очистити пошук"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Action Row */}
          <div className="emp-multiselect-actions">
            <span className="emp-multiselect-count">
              Обрано: <strong>{selectedList.length}</strong> із {options.length}
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={handleSelectAll}
                className="emp-multiselect-action-btn"
                disabled={filteredOptions.length === 0}
              >
                Обрати всіх
              </button>
              {selectedList.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="emp-multiselect-action-btn btn-reset"
                >
                  Скинути
                </button>
              )}
            </div>
          </div>

          {/* Checkboxes List */}
          <div className="emp-multiselect-list">
            {filteredOptions.length === 0 ? (
              <div className="emp-multiselect-empty">
                Не знайдено працівників за запитом «{search}»
              </div>
            ) : (
              filteredOptions.map((op) => {
                const isChecked = selectedList.includes(op)
                return (
                  <label
                    key={op}
                    className={`emp-multiselect-item ${isChecked ? 'is-checked' : ''}`}
                    onClick={(e) => {
                      if (e.target.tagName !== 'INPUT') {
                        e.preventDefault()
                        handleToggle(op)
                      }
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleToggle(op)}
                      className="emp-multiselect-checkbox"
                    />
                    <span className="emp-multiselect-item-name">{op}</span>
                  </label>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
