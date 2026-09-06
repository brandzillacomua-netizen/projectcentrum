import React, { useState, useEffect, useRef } from 'react'
import { Layers, Search, X, Plus } from 'lucide-react'

export const ProductSearchSelect = ({
  products = [],
  value,
  onChange,
  onCreateNewProduct,
  placeholder = 'Введіть назву або код виробу...'
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef(null)

  const selectedProduct = products.find(p => String(p.id) === String(value))

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filteredProducts = products.filter(p => {
    if (!query.trim()) return true
    const q = query.toLowerCase().trim()
    const nameMatch = (p.name || '').toLowerCase().includes(q)
    const codeMatch = (p.code || '').toLowerCase().includes(q)
    const descMatch = (p.description || '').toLowerCase().includes(q)
    return nameMatch || codeMatch || descMatch
  })

  const handleSelect = (product) => {
    onChange(product.id)
    setQuery('')
    setIsOpen(false)
  }

  const handleClear = (e) => {
    e.stopPropagation()
    onChange('')
    setQuery('')
    setIsOpen(true)
  }

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <div
        className="input-wrapper"
        style={{
          borderColor: isOpen ? '#ff9000' : (value ? 'rgba(255,144,0,0.3)' : 'var(--glass-border, rgba(255,255,255,0.1))'),
          background: value ? 'rgba(255,144,0,0.03)' : 'var(--card-bg, rgba(0,0,0,0.3))',
        }}
      >
        <Layers size={16} style={{ color: value ? '#ff9000' : '#888' }} />
        <input
          type="text"
          value={isOpen ? query : (selectedProduct ? `${selectedProduct.name}${selectedProduct.code ? ` (${selectedProduct.code})` : ''}` : query)}
          onChange={(e) => {
            setQuery(e.target.value)
            if (!isOpen) setIsOpen(true)
          }}
          onFocus={() => {
            setIsOpen(true)
          }}
          placeholder={selectedProduct ? `${selectedProduct.name}${selectedProduct.code ? ` (${selectedProduct.code})` : ''}` : placeholder}
          style={{ paddingRight: '32px' }}
        />
        {value ? (
          <button
            type="button"
            onClick={handleClear}
            title="Очистити вибір"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#888',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'absolute',
              right: '10px'
            }}
            onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
            onMouseLeave={e => e.currentTarget.style.color = '#888'}
          >
            <X size={15} />
          </button>
        ) : (
          <Search size={15} style={{ position: 'absolute', right: '12px', color: isOpen ? '#ff9000' : '#888', pointerEvents: 'none' }} />
        )}
      </div>

      {isOpen && (
        <div
          className="hints-dropdown"
          style={{
            maxHeight: '280px',
            overflowY: 'auto',
            boxShadow: '0 12px 30px rgba(0,0,0,0.25)',
            border: '1px solid rgba(255,144,0,0.3)',
            background: 'var(--card-bg, #ffffff)',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {filteredProducts.length > 0 ? (
              filteredProducts.map(p => {
                const isSelected = String(p.id) === String(value)
                return (
                  <div
                    key={p.id}
                    onClick={() => handleSelect(p)}
                    className="hint-item"
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      background: isSelected ? 'rgba(255,144,0,0.12)' : undefined,
                      color: isSelected ? '#ff9000' : '#fff',
                      fontWeight: isSelected ? 800 : 400
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span>{p.name}</span>
                      {p.code && <span style={{ fontSize: '0.72rem', color: '#888' }}>Код / Арт: {p.code}</span>}
                    </div>
                    {isSelected && <span style={{ fontSize: '0.8rem', color: '#ff9000', fontWeight: 900 }}>✓</span>}
                  </div>
                )
              })
            ) : (
              <div style={{ padding: '14px', fontSize: '0.82rem', color: '#666', textAlign: 'center' }}>
                Нічого не знайдено за запитом &quot;{query}&quot;
              </div>
            )}
          </div>

          {onCreateNewProduct && (
            <div
              onClick={() => {
                setIsOpen(false)
                onCreateNewProduct(query)
              }}
              style={{
                padding: '12px 16px',
                background: 'rgba(255,144,0,0.08)',
                borderTop: '1px solid rgba(255,144,0,0.2)',
                color: '#ff9000',
                fontWeight: 900,
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s'
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,144,0,0.2)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,144,0,0.08)'}
            >
              <Plus size={16} />
              <span>+ Створити новий готовий виріб</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
