import React, { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Search, Check, Users } from 'lucide-react'

/**
 * Dropdown or Inline multi-select with checkboxes for assigning one or more operators to a work card.
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
  compact = false,
  inline = false,
  maxHeight = '250px'
}) {
  const [isOpen, setIsOpen] = useState(inline)
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
    if (inline) {
      setIsOpen(true)
      return
    }
    if (!isOpen) return
    const handleOutsideClick = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [isOpen, inline])

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

  const renderListContent = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
      {visibleOperators.length > 5 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'var(--surface-1, #121216)',
          border: '1px solid var(--border-subtle, rgba(255,255,255,0.12))',
          borderRadius: '10px',
          padding: '8px 12px'
        }}>
          <Search size={15} color="var(--text-muted, #9ca3af)" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Пошук працівника..."
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--text-strong, #fff)',
              fontSize: '0.88rem',
              fontWeight: 600
            }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '12px' }}
            >
              ✕
            </button>
          )}
        </div>
      )}

      {filteredOperators.length === 0 ? (
        <div style={{
          padding: '16px',
          fontSize: '0.85rem',
          fontWeight: 700,
          color: 'var(--text-muted, #9ca3af)',
          textAlign: 'center',
          background: 'var(--surface-1, #121216)',
          borderRadius: '10px'
        }}>
          {visibleOperators.length === 0
            ? 'Сьогодні нікого не відмічено в табелі (натисніть «Показати всіх»)'
            : 'Нікого не знайдено'}
        </div>
      ) : (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          maxHeight,
          overflowY: 'auto',
          paddingRight: '4px'
        }}>
          {filteredOperators.map(name => {
            const isChecked = selectedList.includes(name)
            const isOnShift = onShiftOperators.includes(name)

            return (
              <label
                key={name}
                onClick={(e) => {
                  e.preventDefault()
                  toggleOperator(name)
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '10px 14px',
                  borderRadius: '12px',
                  background: isChecked ? `rgba(${accentRgb}, 0.16)` : 'var(--surface-1, #121216)',
                  border: isChecked
                    ? `1px solid rgba(${accentRgb}, 0.5)`
                    : '1px solid var(--border-subtle, rgba(255,255,255,0.06))',
                  color: isChecked ? 'var(--text-strong, #fff)' : 'var(--text, #ddd)',
                  cursor: 'pointer',
                  userSelect: 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '6px',
                  border: isChecked ? `2px solid ${accentColor}` : '2px solid rgba(255,255,255,0.3)',
                  background: isChecked ? accentColor : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  {isChecked && <Check size={14} color="#000" strokeWidth={3} />}
                </div>

                <span style={{
                  flex: 1,
                  fontSize: '0.92rem',
                  fontWeight: isChecked ? 900 : 600,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {name}
                </span>

                {isOnShift && (
                  <span style={{
                    fontSize: '0.62rem',
                    fontWeight: 800,
                    color: accentColor,
                    background: `rgba(${accentRgb}, 0.12)`,
                    padding: '2px 6px',
                    borderRadius: '6px',
                    flexShrink: 0
                  }}>
                    На зміні
                  </span>
                )}
              </label>
            )
          })}
        </div>
      )}
    </div>
  )

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      {/* Label and top actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', gap: '8px', flexWrap: 'wrap' }}>
        <label style={{ color: 'var(--text-dim, #9ca3af)', fontSize: compact ? '0.68rem' : '0.75rem', fontWeight: 900, textTransform: 'uppercase', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Users size={14} color={accentColor} />
          {label} {!showAllOperators ? `(На зміні: ${onShiftOperators.length})` : ''}
          {selectedList.length > 0 && (
            <span style={{ color: accentColor, marginLeft: '4px' }}>• Обрано: {selectedList.length}</span>
          )}
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {selectedList.length > 0 && (
            <button
              type="button"
              onClick={() => setSelectedOperator?.('')}
              style={{
                background: 'transparent',
                border: '1px solid var(--border-subtle, rgba(255,255,255,0.15))',
                color: 'var(--text-muted, #9ca3af)',
                padding: '4px 10px',
                borderRadius: '8px',
                fontSize: '0.68rem',
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
              background: showAllOperators ? `rgba(${accentRgb}, 0.18)` : 'var(--surface-1, #121216)',
              border: `1px solid ${showAllOperators ? accentColor : 'var(--border-subtle, rgba(255,255,255,0.12))'}`,
              color: showAllOperators ? accentColor : 'var(--text-muted, #9ca3af)',
              padding: '4px 10px',
              borderRadius: '8px',
              fontSize: '0.68rem',
              fontWeight: 800,
              cursor: 'pointer'
            }}
          >
            {showAllOperators ? 'Тільки на зміні' : `Показати всіх (${allStageOperators.length})`}
          </button>
        </div>
      </div>

      {inline ? (
        // INLINE MODE: directly inside the modal layout, no popovers, no clipping
        <div style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid var(--border-subtle, rgba(255,255,255,0.08))',
          borderRadius: '16px',
          padding: '12px'
        }}>
          {renderListContent()}
        </div>
      ) : (
        // DROPDOWN POPOVER MODE
        <>
          <button
            type="button"
            onClick={() => setIsOpen(prev => !prev)}
            style={{
              width: '100%',
              background: 'var(--surface-1, #121216)',
              border: `1px solid ${isOpen ? `rgba(${accentRgb}, 0.65)` : 'var(--border-subtle, rgba(255,255,255,0.12))'}`,
              color: selectedList.length > 0 ? 'var(--text-strong, #fff)' : 'var(--text-muted, #9ca3af)',
              padding: compact ? '10px 14px' : '14px 16px',
              borderRadius: '14px',
              fontSize: '0.92rem',
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
              size={18}
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
              zIndex: 9999,
              background: 'var(--card-bg, #141418)',
              border: `1px solid rgba(${accentRgb}, 0.35)`,
              borderRadius: '16px',
              boxShadow: '0 16px 40px rgba(0,0,0,0.7)',
              padding: '12px'
            }}>
              {renderListContent()}
              <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border-subtle, rgba(255,255,255,0.08))', paddingTop: '8px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  style={{
                    background: accentColor,
                    color: '#000',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '8px 18px',
                    fontSize: '0.8rem',
                    fontWeight: 900,
                    cursor: 'pointer'
                  }}
                >
                  Готово
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
