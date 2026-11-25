import React, { useState, useMemo, useEffect } from 'react'
import { X, Paintbrush, Plus, Trash2, AlertTriangle, Loader2, Play, Search } from 'lucide-react'
import {
  resolveShop2BufferRowRouting,
  getShop2OperationTimings,
  formatShop2PlannedMinutes,
  generateMixCassetteCode
} from '../../../utils/shop2RoutingUtils'

export function MixCassetteModal({
  rows = [],
  nomenclatures = [],
  orders = [],
  initialItem = null,
  isSubmitting = false,
  error = null,
  onClose,
  onGenerateMix
}) {
  const [cassetteCode, setCassetteCode] = useState(() => generateMixCassetteCode())
  const [searchTerm, setSearchTerm] = useState('')
  const [onlyPainting, setOnlyPainting] = useState(true)
  const [selectedItems, setSelectedItems] = useState([]) // [{ row, qty }]

  useEffect(() => {
    setCassetteCode(generateMixCassetteCode())
    setSearchTerm('')
    if (initialItem?.row) {
      const matchedRow =
        (rows || []).find(r => r.key === initialItem.row.key) || initialItem.row
      const avail = Math.max(0, Math.floor(Number(matchedRow?.availableQty) || 0))
      const qty = Math.min(avail, Math.max(1, Math.floor(Number(initialItem.qty) || avail)))
      setSelectedItems(avail > 0 ? [{ row: matchedRow, qty }] : [])
    } else {
      setSelectedItems([])
    }
  }, [initialItem])

  // Enrich available rows with Shop 2 routing & cassette capacity
  const enrichedRows = useMemo(() => {
    return (rows || [])
      .filter(r => Number(r?.availableQty) > 0)
      .map(row => {
        const routing = resolveShop2BufferRowRouting(row, nomenclatures, orders)
        const timings = getShop2OperationTimings(routing.nom)
        const shelfCap = routing.paintingUnitsPerShelf || 0
        const colorKey = (routing.paintingSpecs || [])
          .map(s => `${s.type}|${s.baseColor}|${s.edgeColor}`)
          .sort()
          .join(';')
        return {
          row,
          routing,
          shelfCap,
          paintingPerCassetteMin: timings.paintingPerCassette || 0,
          colorKey
        }
      })
      .sort((a, b) => {
        const aScore = (a.routing.requiresPainting ? 2 : 0) + (a.shelfCap > 0 ? 1 : 0)
        const bScore = (b.routing.requiresPainting ? 2 : 0) + (b.shelfCap > 0 ? 1 : 0)
        if (bScore !== aScore) return bScore - aScore
        return (b.row.availableQty || 0) - (a.row.availableQty || 0)
      })
  }, [rows, nomenclatures, orders])

  const selectedKeySet = useMemo(
    () => new Set(selectedItems.map(it => it.row.key)),
    [selectedItems]
  )

  const selectedEnriched = useMemo(() => {
    const byKey = new Map(enrichedRows.map(er => [er.row.key, er]))
    return selectedItems.map(it => {
      const meta = byKey.get(it.row.key)
      const shelfCap = meta?.shelfCap || 0
      const qty = Math.max(0, Math.floor(Number(it.qty) || 0))
      const fillPct = shelfCap > 0 ? (qty / shelfCap) * 100 : 0
      return {
        ...it,
        qty,
        meta,
        shelfCap,
        fillPct
      }
    })
  }, [selectedItems, enrichedRows])

  const totalFillPct = useMemo(() => {
    const known = selectedEnriched.filter(it => it.shelfCap > 0)
    if (known.length === 0) return 0
    return Math.round(known.reduce((sum, it) => sum + it.fillPct, 0) * 10) / 10
  }, [selectedEnriched])

  const totalPieces = useMemo(
    () => selectedEnriched.reduce((sum, it) => sum + it.qty, 0),
    [selectedEnriched]
  )

  const hasMissingCapacity = selectedEnriched.some(it => it.shelfCap <= 0)
  const isOverCapacity = totalFillPct > 100.5

  // Non-blocking warning if selected parts have differing painting colors/specs
  const hasColorMismatchWarning = useMemo(() => {
    if (selectedEnriched.length < 2) return false
    const colorKeys = new Set(selectedEnriched.map(it => it.meta?.colorKey || 'none'))
    return colorKeys.size > 1
  }, [selectedEnriched])

  const hasUnconfiguredPaintWarning = useMemo(
    () => selectedEnriched.some(it => !it.meta?.routing?.requiresPainting),
    [selectedEnriched]
  )

  const maxCassetteCycleMin = useMemo(() => {
    return selectedEnriched.reduce(
      (mx, it) => Math.max(mx, it.meta?.paintingPerCassetteMin || 0),
      0
    )
  }, [selectedEnriched])

  const filteredAvailable = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    return enrichedRows.filter(er => {
      if (selectedKeySet.has(er.row.key)) return false
      if (onlyPainting && !er.routing.requiresPainting) return false
      if (!q) return true
      const name = String(er.row.nomName || '').toLowerCase()
      const code = String(er.row.nomCode || '').toLowerCase()
      return name.includes(q) || code.includes(q)
    })
  }, [enrichedRows, selectedKeySet, onlyPainting, searchTerm])

  const handleAddRow = (er) => {
    const avail = Math.max(0, Math.floor(Number(er.row.availableQty) || 0))
    if (avail <= 0) return
    let defaultQty = avail
    if (er.shelfCap > 0) {
      const remainingPct = Math.max(0, 100 - totalFillPct)
      if (selectedItems.length > 0 && remainingPct > 0) {
        const fitQty = Math.max(1, Math.floor((er.shelfCap * remainingPct) / 100))
        defaultQty = Math.min(avail, fitQty)
      } else {
        defaultQty = Math.min(avail, er.shelfCap)
      }
    }
    setSelectedItems(prev => [...prev, { row: er.row, qty: defaultQty }])
  }

  const handleQtyChange = (rowKey, rawVal, maxAvail) => {
    const parsed = Math.max(1, Math.min(maxAvail, Math.floor(Number(rawVal) || 1)))
    setSelectedItems(prev =>
      prev.map(it => (it.row.key === rowKey ? { ...it, qty: parsed } : it))
    )
  }

  const handleRemoveRow = (rowKey) => {
    setSelectedItems(prev => prev.filter(it => it.row.key !== rowKey))
  }

  const isValid =
    selectedEnriched.length > 0 &&
    selectedEnriched.every(it => it.qty > 0 && it.qty <= it.row.availableQty) &&
    !isSubmitting

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!isValid) return
    onGenerateMix({
      items: selectedEnriched.map(it => ({ row: it.row, qty: it.qty })),
      cassetteCode
    })
  }

  const barPct = Math.min(100, Math.max(0, totalFillPct))
  const barColor = isOverCapacity ? '#ef4444' : totalFillPct >= 95 ? '#10b981' : '#8b5cf6'

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.75)',
        backdropFilter: 'blur(8px)',
        zIndex: 1050,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--card-bg, #0e0e0e)',
          width: '100%',
          maxWidth: '760px',
          maxHeight: '90vh',
          borderRadius: '22px',
          padding: '28px',
          position: 'relative',
          border: '1px solid var(--border, rgba(139,92,246,0.35))',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          overflow: 'hidden'
        }}
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '18px',
            right: '18px',
            background: 'var(--border, #1c1c1c)',
            border: 'none',
            color: 'var(--text-muted, #888)',
            cursor: 'pointer',
            width: '34px',
            height: '34px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <X size={18} />
        </button>

        {/* Header */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 900, color: '#a78bfa', background: 'rgba(139,92,246,0.14)', border: '1px solid rgba(139,92,246,0.35)', padding: '3px 10px', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
              <Paintbrush size={13} /> ЗБІРНА КАСЕТА (МІКС)
            </span>
            <span style={{ fontSize: '0.74rem', fontWeight: 900, color: 'var(--text-muted, #94a3b8)' }}>
              Код касети:
            </span>
            <input
              type="text"
              value={cassetteCode}
              onChange={e => setCassetteCode(e.target.value)}
              style={{
                width: '120px',
                background: 'var(--input-bg, #000)',
                border: '1px solid var(--border, #334155)',
                color: 'var(--text, #fff)',
                padding: '3px 8px',
                borderRadius: '7px',
                fontSize: '0.76rem',
                fontWeight: 900
              }}
            />
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 950, margin: 0, color: 'var(--text, #fff)' }}>
            Об’єднання залишків в одну касету на Фарбування
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: 'var(--text-muted, #94a3b8)', fontWeight: 700 }}>
            Для кожної деталі створиться окрема картка для точного обліку, об’єднана спільним тегом касети.
          </p>
        </div>

        {/* Cassette Fill Progress */}
        <div style={{
          background: 'var(--input-bg, rgba(255,255,255,0.03))',
          border: `1.5px solid ${isOverCapacity ? 'rgba(239,68,68,0.45)' : 'rgba(139,92,246,0.3)'}`,
          borderRadius: '14px',
          padding: '12px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 900, color: 'var(--text, #fff)' }}>
              Заповнення касети: <span style={{ color: barColor }}>{totalFillPct}%</span>
              {hasMissingCapacity && selectedEnriched.length > 0 && (
                <span style={{ fontSize: '0.7rem', color: '#f59e0b', marginLeft: '8px' }}>
                  (не у всіх позицій задана місткість касети)
                </span>
              )}
            </span>
            <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-muted, #94a3b8)' }}>
              Позицій: <strong style={{ color: 'var(--text, #fff)' }}>{selectedEnriched.length}</strong> · Разом: <strong style={{ color: '#38bdf8' }}>{totalPieces.toLocaleString()} шт</strong>
              {maxCassetteCycleMin > 0 && (
                <> · Цикл: <strong style={{ color: '#a78bfa' }}>{formatShop2PlannedMinutes(maxCassetteCycleMin)}</strong></>
              )}
            </span>
          </div>
          <div style={{ width: '100%', height: '8px', borderRadius: '999px', background: 'rgba(148,163,184,0.2)', overflow: 'hidden' }}>
            <div style={{ width: `${barPct}%`, height: '100%', background: barColor, transition: 'width 0.2s ease' }} />
          </div>
        </div>

        {/* Non-blocking Warnings */}
        {(hasColorMismatchWarning || hasUnconfiguredPaintWarning || isOverCapacity) && (
          <div style={{
            background: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid rgba(245, 158, 11, 0.35)',
            color: '#f59e0b',
            padding: '10px 12px',
            borderRadius: '12px',
            fontSize: '0.76rem',
            fontWeight: 800,
            display: 'flex',
            flexDirection: 'column',
            gap: '4px'
          }}>
            {hasColorMismatchWarning && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <AlertTriangle size={14} />
                <span>Увага: обрані позиції мають різні кольори або параметри фарбування в нарядах. Перевірте сумісність!</span>
              </div>
            )}
            {hasUnconfiguredPaintWarning && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <AlertTriangle size={14} />
                <span>Увага: частина позицій не має галочки «Фарбується» в номенклатурі.</span>
              </div>
            )}
            {isOverCapacity && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <AlertTriangle size={14} />
                <span>Заповнення перевищує 100% ({totalFillPct}%). Зменште кількість або залиште на ваш розсуд.</span>
              </div>
            )}
          </div>
        )}

        {error && (
          <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444', padding: '10px 14px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 800 }}>
            {error}
          </div>
        )}

        {/* Scrollable body */}
        <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px', paddingRight: '4px', flex: 1 }}>
          {/* Selected Items */}
          {selectedEnriched.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 900, color: '#a78bfa', textTransform: 'uppercase' }}>
                У цій касеті ({selectedEnriched.length}):
              </div>
              {selectedEnriched.map(it => (
                <div
                  key={it.row.key}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px',
                    flexWrap: 'wrap',
                    background: 'rgba(139, 92, 246, 0.08)',
                    border: '1px solid rgba(139, 92, 246, 0.3)',
                    borderRadius: '12px',
                    padding: '10px 12px'
                  }}
                >
                  <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                    <div style={{ fontSize: '0.84rem', fontWeight: 900, color: 'var(--text, #fff)' }}>
                      {it.row.nomName}
                    </div>
                    <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted, #94a3b8)', display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '2px' }}>
                      <span>Вільно: {it.row.availableQty} шт</span>
                      <span>· Касета: {it.shelfCap > 0 ? `${it.shelfCap} шт (${Math.round(it.fillPct * 10) / 10}%)` : 'не задано'}</span>
                      {it.meta?.routing?.paintingSpecs?.length > 0 && (
                        <span style={{ color: '#c4b5fd' }}>
                          · {it.meta.routing.paintingSpecs.map(s => s.summaryText).join(' / ')}
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="number"
                      min="1"
                      max={it.row.availableQty}
                      value={it.qty}
                      onChange={e => handleQtyChange(it.row.key, e.target.value, it.row.availableQty)}
                      style={{
                        width: '90px',
                        background: 'var(--input-bg, #000)',
                        border: '1px solid rgba(255,144,0,0.45)',
                        color: '#ff9000',
                        fontSize: '1rem',
                        fontWeight: 950,
                        textAlign: 'center',
                        padding: '6px 8px',
                        borderRadius: '10px'
                      }}
                    />
                    <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted, #94a3b8)' }}>шт</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveRow(it.row.key)}
                      style={{
                        background: 'rgba(239,68,68,0.12)',
                        border: '1px solid rgba(239,68,68,0.3)',
                        color: '#ef4444',
                        borderRadius: '8px',
                        padding: '6px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center'
                      }}
                      title="Прибрати з касети"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Available Buffer Picker */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 900, color: 'var(--text-muted, #94a3b8)', textTransform: 'uppercase' }}>
                Доступні деталі з буфера:
              </div>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.74rem', fontWeight: 800, color: 'var(--text-muted, #94a3b8)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={onlyPainting}
                  onChange={e => setOnlyPainting(e.target.checked)}
                />
                Тільки деталі з фарбуванням
              </label>
            </div>

            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted, #64748b)' }} />
              <input
                type="text"
                placeholder="Пошук деталі для додавання в касету..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                style={{
                  width: '100%',
                  background: 'var(--input-bg, #000)',
                  border: '1px solid var(--border, #334155)',
                  color: 'var(--text, #fff)',
                  padding: '8px 12px 8px 34px',
                  borderRadius: '10px',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '240px', overflowY: 'auto' }}>
              {filteredAvailable.length === 0 ? (
                <div style={{ padding: '18px', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted, #64748b)', fontWeight: 700 }}>
                  Немає доступних позицій за обраним фільтром.
                </div>
              ) : (
                filteredAvailable.map(er => (
                  <div
                    key={er.row.key}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '10px',
                      background: 'var(--input-bg, rgba(255,255,255,0.02))',
                      border: '1px solid var(--border, rgba(255,255,255,0.08))',
                      borderRadius: '10px',
                      padding: '8px 12px'
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: '0.82rem', fontWeight: 850, color: 'var(--text, #fff)' }}>
                        {er.row.nomName} {er.row.nomCode ? `(${er.row.nomCode})` : ''}
                      </div>
                      <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted, #94a3b8)', display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '2px' }}>
                        <span style={{ color: '#10b981' }}>Вільно: {er.row.availableQty} шт</span>
                        <span>· Касета: {er.shelfCap > 0 ? `${er.shelfCap} шт` : 'не задано'}</span>
                        {er.routing.paintingSpecs.length > 0 && (
                          <span style={{ color: '#a78bfa' }}>
                            · {er.routing.paintingSpecs.map(s => s.summaryText).join(' / ')}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAddRow(er)}
                      style={{
                        background: 'rgba(139, 92, 246, 0.16)',
                        border: '1px solid rgba(139, 92, 246, 0.4)',
                        color: '#c4b5fd',
                        borderRadius: '8px',
                        padding: '6px 12px',
                        fontSize: '0.75rem',
                        fontWeight: 900,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      <Plus size={14} /> Додати
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <form onSubmit={handleSubmit}>
          <button
            type="submit"
            disabled={!isValid}
            style={{
              width: '100%',
              background: isValid ? 'linear-gradient(135deg, #8b5cf6, #7c3aed)' : 'var(--border, #1f1f1f)',
              color: isValid ? '#ffffff' : 'var(--text-muted, #555)',
              padding: '15px',
              borderRadius: '14px',
              fontSize: '0.92rem',
              fontWeight: 950,
              cursor: isValid ? 'pointer' : 'not-allowed',
              border: 'none',
              textTransform: 'uppercase',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Play size={16} fill={isValid ? '#fff' : 'none'} />}
            {isSubmitting
              ? 'Створення...'
              : `Створити мікс-касету (${selectedEnriched.length} поз. · ${totalPieces.toLocaleString()} шт)`}
          </button>
        </form>
      </div>
    </div>
  )
}
