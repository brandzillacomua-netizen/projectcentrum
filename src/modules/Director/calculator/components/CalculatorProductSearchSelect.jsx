import React, { useState, useEffect, useRef, useMemo } from 'react'
import { Search, ChevronDown, X, Package, Check } from 'lucide-react'

export function CalculatorProductSearchSelect({
  products = [],
  value,
  onChange,
  disabled = false,
  placeholder = 'Швидкий пошук виробу (наприклад 610, KHARAК, назва або код)...'
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const containerRef = useRef(null)
  const inputRef = useRef(null)

  const selectedProduct = useMemo(() => {
    return products.find(p => String(p.id) === String(value)) || null
  }, [products, value])

  // Filter products by query (name, code, description)
  const filteredProducts = useMemo(() => {
    if (!query.trim()) return products
    const q = query.toLowerCase().trim()
    return products.filter(p => {
      const nameMatch = (p.name || '').toLowerCase().includes(q)
      const codeMatch = (p.nomenclature_code || p.code || '').toLowerCase().includes(q)
      const descMatch = (p.description || '').toLowerCase().includes(q)
      return nameMatch || codeMatch || descMatch
    })
  }, [products, query])

  // Reset highlighted index when filtered list changes
  useEffect(() => {
    setHighlightedIndex(0)
  }, [filteredProducts])

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = (product) => {
    if (!product) return
    onChange(product.id)
    setQuery('')
    setIsOpen(false)
    inputRef.current?.blur()
  }

  const handleKeyDown = (e) => {
    if (disabled) return

    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true)
        e.preventDefault()
      }
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightedIndex(prev => (prev + 1) % Math.max(1, filteredProducts.length))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightedIndex(prev => (prev - 1 + filteredProducts.length) % Math.max(1, filteredProducts.length))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filteredProducts[highlightedIndex]) {
        handleSelect(filteredProducts[highlightedIndex])
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false)
      setQuery('')
    }
  }

  const handleClear = (e) => {
    e.stopPropagation()
    setQuery('')
    inputRef.current?.focus()
    setIsOpen(true)
  }

  // Value shown in the input box
  const displayInputValue = isOpen
    ? query
    : (selectedProduct ? `${selectedProduct.name} ${selectedProduct.nomenclature_code ? `(${selectedProduct.nomenclature_code})` : ''}` : '')

  return (
    <div ref={containerRef} className="calc-search-select-container">
      <div
        className={`calc-search-select-box ${isOpen ? 'is-open' : ''} ${disabled ? 'is-disabled' : ''}`}
        onClick={() => {
          if (!disabled) {
            setIsOpen(true)
            inputRef.current?.focus()
          }
        }}
      >
        <Search size={16} className={`calc-search-icon ${selectedProduct ? 'active' : ''}`} />

        <input
          ref={inputRef}
          type="text"
          className="calc-search-select-input"
          value={displayInputValue}
          placeholder={selectedProduct ? selectedProduct.name : placeholder}
          disabled={disabled}
          onChange={(e) => {
            setQuery(e.target.value)
            if (!isOpen) setIsOpen(true)
          }}
          onFocus={() => {
            if (!isOpen) {
              setIsOpen(true)
            }
          }}
          onKeyDown={handleKeyDown}
        />

        {query && (
          <button
            type="button"
            className="calc-search-clear-btn"
            onClick={handleClear}
            title="Очистити пошук"
          >
            <X size={14} />
          </button>
        )}

        <button
          type="button"
          className="calc-search-chevron-btn"
          onClick={(e) => {
            e.stopPropagation()
            if (!disabled) setIsOpen(!isOpen)
          }}
          disabled={disabled}
        >
          <ChevronDown size={16} className={`calc-chevron-icon ${isOpen ? 'rotate' : ''}`} />
        </button>
      </div>

      {/* Floating Dropdown Results */}
      {isOpen && (
        <div className="calc-search-dropdown-menu">
          <div className="calc-search-dropdown-header">
            <span>Знайдено: {filteredProducts.length} з {products.length} виробів</span>
            {query && <span className="calc-search-query-tag">Фільтр: «{query}»</span>}
          </div>

          <div className="calc-search-dropdown-list">
            {filteredProducts.length === 0 ? (
              <div className="calc-search-empty-state">
                <span>Виробів за запитом «{query}» не знайдено</span>
              </div>
            ) : (
              filteredProducts.map((p, index) => {
                const isSelected = selectedProduct && String(selectedProduct.id) === String(p.id)
                const isHighlighted = index === highlightedIndex

                return (
                  <div
                    key={p.id}
                    className={`calc-search-dropdown-item ${isSelected ? 'is-selected' : ''} ${isHighlighted ? 'is-highlighted' : ''}`}
                    onClick={() => handleSelect(p)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                  >
                    <div className="calc-dropdown-item-left">
                      <div className="calc-dropdown-item-name">
                        {p.name}
                      </div>
                      <div className="calc-dropdown-item-meta">
                        {p.nomenclature_code && (
                          <span className="calc-code-tag">{p.nomenclature_code}</span>
                        )}
                        {p.material_type && (
                          <span className="calc-mat-tag">{p.material_type}</span>
                        )}
                      </div>
                    </div>

                    {isSelected && (
                      <div className="calc-dropdown-item-check">
                        <Check size={16} className="text-orange" />
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}

