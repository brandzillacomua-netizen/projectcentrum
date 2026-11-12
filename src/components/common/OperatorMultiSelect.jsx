import React, { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Search } from 'lucide-react'

/**
 * Dropdown multi-select with checkboxes for assigning one or more operators to a work card.
 * Stores selection as a comma-separated string in `selectedOperator` for compatibility
 * with `work_cards.operator_name` and `work_card_history.operator_name`.
 */
export function OperatorMultiSelect({
  label = 'Відповідальний оператор',
  onShiftOperators = [],
  allStageOperators = [],
  selectedOperator = '',
  setSelectedOperator,
  accentColor = '#8b5cf6',
  accentRgb = '139,92,246',
  compact = false
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [showAllOperators, setShowAllOperators] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const containerRef = useRef(null)

  const selectedList = useMemo(
    () => String(selectedOperator || '').split(',').map(s => s.trim()).filter(Boolean),
    [selectedOperator]
  )

  const visibleOperators = useMemo(() => {
    const base = showAllOperators ? allStageOperators : onShiftOperators
    const merged = [...base]
    selectedList.forEach(name => {
      if (!merged.includes(name)) merged.push(name)
    })
    return merged
  }, [showAllOperators, allStageOperators, onShiftOperators, selectedList])

  const filteredOperators = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return visibleOperators
    return visibleOperators.filter(name => name.toLowerCase().includes(q))
  }, [visibleOperators, searchQuery])

  useEffect(() => {
    if (!isOpen) return
    const handleOutsideClick = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [isOpen])

  const toggleOperator = (name) => {
    const exists = selectedList.includes(name)
    const next = exists
      ? selectedList.filter(item => item !== name)
      : [...selectedList, name]
    setSelectedOperator?.(next.join(', '))
  }

  const triggerText = selectedList.length > 0
    ? selectedList.join(', ')
    : (!showAllOperators && onShiftOperators.length === 0)
      ? '— Сьогодні нікого не відмічено в табелі (натисніть «Показати всіх») —'
      : '— Оберіть операторів —'

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: compact ? '6px' : '10px', gap: '8px', flexWrap: 'wrap' }}>
        <label style={{ color: 'var(--text-dim, #9ca3af)', fontSize: compact ? '0.65rem' : '0.75rem', fontWeight: 900, textTransform: 'uppercase', margin: 0 }}>
          {label} {!showAllOperators ? `(На роботі сьогодні: ${onShiftOperators.length})` : ''}
          {selectedList.length > 0 && (
            <span style={{ color: accentColor, marginLeft: '6px' }}>• Обрано: {selectedList.length}</span>
          )}
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {selectedList.length > 0 && (
            <button
              type="button"
              onClick={() => setSelectedOperator?.('')}
              style={{
                background: 'transparent',
                border: '1px solid var(--border-subtle, rgba(255,255,255,0.1))',
                color: 'var(--text-muted, #9ca3af)',
                padding: compact ? '3px 8px' : '4px 10px',
                borderRadius: '8px',
                fontSize: compact ? '0.65rem' : '0.7rem',
                fontWeight: 800,
                cursor: 'pointer'
              }}
            >
              Очистити
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setShowAllOperators(prev => !prev)
              setSearchQuery('')
            }}
            style={{
              background: showAllOperators ? `rgba(${accentRgb}, 0.16)` : 'var(--surface-1, #121216)',
              border: '1px solid var(--border-subtle, rgba(255,255,255,0.1))',
              color: showAllOperators ? accentColor : 'var(--text-muted, #9ca3af)',
              padding: compact ? '3px 8px' : '4px 10px',
              borderRadius: '8px',
              fontSize: compact ? '0.65rem' : '0.7rem',
              fontWeight: 800,
              cursor: 'pointer'
            }}
          >
            {showAllOperators ? 'Тільки на роботі сьогодні' : `Показати всіх (${allStageOperators.length})`}
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        style={{
          width: '100%',
          background: 'var(--surface-1, #121216)',
          border: `1px solid ${isOpen ? `rgba(${accentRgb}, 0.65)` : 'var(--border-subtle, rgba(255,255,255,0.12))'}`,
          color: selectedList.length > 0 ? 'var(--text-strong, #fff)' : 'var(--text-muted, #9ca3af)',
          padding: compact ? '10px 12px' : '15px',
          borderRadius: compact ? '10px' : '15px',
          fontSize: compact ? '0.85rem' : '1.05rem',
          fontWeight: 700,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px',
          textAlign: 'left'
        }}
      >
        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {triggerText}
        </span>
        <ChevronDown
          size={compact ? 16 : 18}
          style={{
            flexShrink: 0,
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.15s ease'
          }}
        />
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 'calc(100% + 6px)',
          zIndex: 80,
          background: 'var(--card-bg, #141418)',
          border: `1px solid rgba(${accentRgb}, 0.35)`,
          borderRadius: compact ? '12px' : '15px',
          boxShadow: '0 16px 40px rgba(0,0,0,0.55)',
          padding: compact ? '8px' : '10px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          {visibleOperators.length > 6 && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'var(--surface-1, #121216)',
              border: '1px solid var(--border-subtle, rgba(255,255,255,0.08))',
              borderRadius: '10px',
              padding: '6px 10px'
            }}>
              <Search size={14} color="var(--text-muted, #6b7280)" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Пошук оператора..."
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: 'var(--text-strong, #fff)',
                  fontSize: '0.85rem',
                  fontWeight: 600
                }}
              />
            </div>
          )}

          {filteredOperators.length === 0 ? (
            <div style={{
              padding: '12px',
              fontSize: '0.85rem',
              fontWeight: 700,
              color: 'var(--text-muted, #9ca3af)',
              textAlign: 'center'
            }}>
              {visibleOperators.length === 0
                ? 'Сьогодні нікого не відмічено в табелі (натисніть «Показати всіх»)'
                : 'Нікого не знайдено'}
            </div>
          ) : (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              maxHeight: compact ? '190px' : '240px',
              overflowY: 'auto'
            }}>
              {filteredOperators.map(name => {
                const isChecked = selectedList.includes(name)
                return (
                  <label
                    key={name}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: compact ? '8px 10px' : '10px 12px',
                      borderRadius: '10px',
                      background: isChecked ? `rgba(${accentRgb}, 0.16)` : 'transparent',
                      border: `1px solid ${isChecked ? `rgba(${accentRgb}, 0.45)` : 'transparent'}`,
                      color: 'var(--text-strong, #fff)',
                      fontSize: compact ? '0.85rem' : '0.95rem',
                      fontWeight: isChecked ? 800 : 600,
                      cursor: 'pointer',
                      userSelect: 'none'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleOperator(name)}
                      style={{
                        width: '17px',
                        height: '17px',
                        accentColor,
                        cursor: 'pointer',
                        flexShrink: 0
                      }}
                    />
                    <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {name}
                    </span>
                  </label>
                )
              })}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border-subtle, rgba(255,255,255,0.08))', paddingTop: '6px' }}>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              style={{
                background: accentColor,
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                padding: '6px 14px',
                fontSize: '0.75rem',
                fontWeight: 900,
                cursor: 'pointer'
              }}
            >
              Готово
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
