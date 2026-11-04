import React, { useState, useEffect, useMemo } from 'react'
import { ClipboardCheck, Save, Check, RefreshCw, Plus, Trash2 } from 'lucide-react'
import { formatMinutesToHours } from '../../../../utils/cuttingTimeUtils.js'

const DEFAULT_SHEETS = [1, 2, 3, 4, 8, 12, 16]

export const DEFAULT_RECEPTION_OPERATIONS = [
  {
    id: 'reception_qc',
    name: 'Прийомка (Контроль якості та відбраковка)',
    label: 'Вхідний контроль',
    icon: '🔍',
    badgeBg: '#fef3c7',
    badgeColor: '#b45309'
  },
  {
    id: 'reception_count',
    name: 'Прийомка (Перерахунок та пакування)',
    label: 'Перерахунок',
    icon: '📋',
    badgeBg: '#e0e7ff',
    badgeColor: '#4338ca'
  }
]

export const ReceptionOperationTimingsTable = ({
  nomenclatureId,
  initialTimings = {}, // { [opName]: { [sheets]: minutes } }
  onSave,
  isLight = false,
  onTotalsChange
}) => {
  const [timings, setTimings] = useState({})
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [customOps, setCustomOps] = useState([])
  const [isAddingOp, setIsAddingOp] = useState(false)
  const [newOpName, setNewOpName] = useState('')

  useEffect(() => {
    const raw = initialTimings || {}
    setTimings(raw)

    // Discover any saved operations not in default list
    const defaultNames = new Set(DEFAULT_RECEPTION_OPERATIONS.map(d => d.name))
    const extras = Object.keys(raw).filter(k => !defaultNames.has(k))
    if (extras.length > 0) {
      setCustomOps(extras.map(name => ({
        id: `custom_${name}`,
        name,
        label: 'Операція',
        icon: '📌',
        badgeBg: '#f1f5f9',
        badgeColor: '#475569',
        isCustom: true
      })))
    }
  }, [initialTimings])

  const allOperations = useMemo(() => {
    return [...DEFAULT_RECEPTION_OPERATIONS, ...customOps]
  }, [customOps])

  const handleTimingChange = (opName, sheets, value) => {
    setTimings(prev => {
      const opObj = { ...(prev[opName] || {}) }
      if (value === '' || value === null || value === undefined) {
        delete opObj[sheets]
      } else {
        const num = parseFloat(value)
        if (isNaN(num)) {
          delete opObj[sheets]
        } else {
          opObj[sheets] = num
        }
      }
      return {
        ...prev,
        [opName]: opObj
      }
    })
    setSaveSuccess(false)
  }

  // Calculate totals per sheet column
  const totalsPerSheet = useMemo(() => {
    const totals = {}
    DEFAULT_SHEETS.forEach(sheets => {
      let sum = 0
      let count = 0
      allOperations.forEach(op => {
        const val = timings[op.name]?.[sheets] ?? timings[op.name]?.[String(sheets)]
        if (val !== undefined && val !== null && val !== '') {
          const num = Number(val)
          if (!isNaN(num) && num > 0) {
            sum += num
            count++
          }
        }
      })
      totals[sheets] = { sum, count }
    })
    return totals
  }, [timings, allOperations])

  useEffect(() => {
    if (typeof onTotalsChange === 'function') {
      onTotalsChange(totalsPerSheet)
    }
  }, [totalsPerSheet, onTotalsChange])

  const handleSaveClick = async () => {
    if (isSaving) return
    setIsSaving(true)
    try {
      if (typeof onSave === 'function') {
        await onSave(timings, totalsPerSheet)
      }
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err) {
      console.error('Error saving reception timings:', err)
      alert(`Помилка збереження таймінгів прийомки: ${err.message || err}`)
    } finally {
      setIsSaving(false)
    }
  }

  const handleAddCustomOp = () => {
    const trimmed = newOpName.trim()
    if (!trimmed) return
    if (allOperations.some(op => op.name.toLowerCase() === trimmed.toLowerCase())) {
      alert('Така операція вже існує в таблиці')
      return
    }
    setCustomOps(prev => [
      ...prev,
      {
        id: `custom_${Date.now()}`,
        name: trimmed,
        label: 'Операція',
        icon: '📌',
        badgeBg: '#f1f5f9',
        badgeColor: '#475569',
        isCustom: true
      }
    ])
    setNewOpName('')
    setIsAddingOp(false)
  }

  const handleRemoveCustomOp = (nameToRemove) => {
    setCustomOps(prev => prev.filter(op => op.name !== nameToRemove))
    setTimings(prev => {
      const copy = { ...prev }
      delete copy[nameToRemove]
      return copy
    })
  }

  const bgSubtle = isLight ? '#f8fafc' : 'rgba(255, 255, 255, 0.03)'
  const borderColor = isLight ? '#e2e8f0' : 'rgba(255, 255, 255, 0.1)'
  const textColor = isLight ? '#0f172a' : '#f8fafc'
  const textMuted = isLight ? '#64748b' : '#94a3b8'

  return (
    <div style={{
      background: isLight ? '#ffffff' : 'rgba(255, 255, 255, 0.02)',
      borderRadius: '14px',
      border: `1.5px solid rgba(167, 139, 250, 0.35)`,
      padding: '16px',
      marginTop: '16px',
      boxShadow: '0 4px 16px rgba(167, 139, 250, 0.06)'
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ClipboardCheck size={18} color="#8b5cf6" />
          <div>
            <div style={{ fontWeight: 900, fontSize: '0.88rem', color: textColor, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>Планові таймінги прийомки (хвилини)</span>
              <span style={{ background: 'rgba(167, 139, 250, 0.15)', color: '#7c3aed', padding: '2px 7px', borderRadius: '6px', fontSize: '0.68rem', fontWeight: 900 }}>
                Ділянка Прийомки (Цех №1)
              </span>
            </div>
            <div style={{ fontSize: '0.72rem', color: textMuted }}>
              Загальний час прийомки на терміналі = сума введених хвилин (вхідний контроль, перевірка кількості та браку)
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {!isAddingOp ? (
            <button
              type="button"
              onClick={() => setIsAddingOp(true)}
              style={{
                background: 'rgba(167, 139, 250, 0.1)',
                color: '#7c3aed',
                border: '1px solid rgba(167, 139, 250, 0.25)',
                borderRadius: '8px',
                padding: '6px 10px',
                fontWeight: 800,
                fontSize: '0.74rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <Plus size={14} />
              <span>Додати операцію</span>
            </button>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <input
                type="text"
                placeholder="Назва операції..."
                value={newOpName}
                onChange={e => setNewOpName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddCustomOp()}
                style={{
                  padding: '5px 8px',
                  fontSize: '0.76rem',
                  borderRadius: '6px',
                  border: '1px solid #a78bfa',
                  background: isLight ? '#ffffff' : '#1e1e24',
                  color: textColor,
                  outline: 'none',
                  minWidth: '150px'
                }}
              />
              <button
                type="button"
                onClick={handleAddCustomOp}
                style={{
                  background: '#8b5cf6',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '5px 10px',
                  fontWeight: 800,
                  fontSize: '0.74rem',
                  cursor: 'pointer'
                }}
              >
                ОК
              </button>
              <button
                type="button"
                onClick={() => { setIsAddingOp(false); setNewOpName('') }}
                style={{
                  background: 'transparent',
                  color: textMuted,
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.74rem'
                }}
              >
                Скасувати
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={handleSaveClick}
            disabled={isSaving}
            style={{
              background: saveSuccess ? '#10b981' : '#7c3aed',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              padding: '6px 14px',
              fontWeight: 800,
              fontSize: '0.78rem',
              cursor: isSaving ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s ease',
              boxShadow: '0 2px 6px rgba(124, 58, 237, 0.2)'
            }}
          >
            {isSaving ? (
              <RefreshCw size={14} className="animate-spin" />
            ) : saveSuccess ? (
              <Check size={14} />
            ) : (
              <Save size={14} />
            )}
            <span>{saveSuccess ? 'Збережено!' : isSaving ? 'Збереження...' : 'Зберегти таймінги прийомки'}</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
          <thead>
            <tr style={{ background: bgSubtle, borderBottom: `1.5px solid ${borderColor}` }}>
              <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 800, color: textMuted, minWidth: '220px' }}>
                Операція прийомки
              </th>
              {DEFAULT_SHEETS.map(sheets => (
                <th key={sheets} style={{ textAlign: 'center', padding: '8px 6px', fontWeight: 900, color: textMuted, minWidth: '70px' }}>
                  <div>{sheets} {sheets === 1 ? 'л.' : (sheets < 5 ? 'л.' : 'л.')}</div>
                  <div style={{ fontSize: '0.62rem', fontWeight: 700, opacity: 0.7 }}>({sheets} {sheets === 1 ? 'лист' : (sheets < 5 ? 'листи' : 'листів')})</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {allOperations.map((op, idx) => {
              const opTimings = timings[op.name] || {}
              return (
                <tr 
                  key={op.id}
                  style={{
                    borderBottom: `1px solid ${borderColor}`,
                    background: idx % 2 === 0 ? 'transparent' : bgSubtle
                  }}
                >
                  <td style={{ padding: '8px 10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{
                          background: op.badgeBg,
                          color: op.badgeColor,
                          padding: '2px 8px',
                          borderRadius: '6px',
                          fontSize: '0.72rem',
                          fontWeight: 900,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          <span>{op.icon}</span>
                          <span>{op.label}</span>
                        </span>
                        <span style={{ fontWeight: 800, color: textColor }}>
                          {op.name}
                        </span>
                      </div>
                      {op.isCustom && (
                        <button
                          type="button"
                          onClick={() => handleRemoveCustomOp(op.name)}
                          title="Видалити операцію"
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#ef4444',
                            cursor: 'pointer',
                            padding: '2px 4px'
                          }}
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </td>

                  {DEFAULT_SHEETS.map(sheets => {
                    const rawVal = opTimings[sheets] ?? opTimings[String(sheets)] ?? ''
                    return (
                      <td key={sheets} style={{ padding: '6px 4px', textAlign: 'center' }}>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          placeholder="—"
                          value={rawVal}
                          onChange={e => handleTimingChange(op.name, sheets, e.target.value)}
                          style={{
                            width: '100%',
                            maxWidth: '72px',
                            padding: '5px 4px',
                            textAlign: 'center',
                            borderRadius: '8px',
                            border: rawVal ? '1.5px solid #8b5cf6' : `1px solid ${borderColor}`,
                            background: rawVal ? (isLight ? '#f5f3ff' : 'rgba(139, 92, 246, 0.12)') : (isLight ? '#ffffff' : 'rgba(0, 0, 0, 0.2)'),
                            color: textColor,
                            fontSize: '0.78rem',
                            fontWeight: rawVal ? 900 : 500,
                            outline: 'none',
                            transition: 'border-color 0.15s ease'
                          }}
                        />
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>

          {/* Subtotal Footer */}
          <tfoot>
            <tr style={{ background: isLight ? '#f5f3ff' : 'rgba(139, 92, 246, 0.08)', borderTop: '2px solid #8b5cf6' }}>
              <td style={{ padding: '10px', fontWeight: 900, color: '#6d28d9' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>📋</span>
                  <span>РАЗОМ ПРИЙОМКА (ПЛАН):</span>
                </div>
              </td>
              {DEFAULT_SHEETS.map(sheets => {
                const totalM = totalsPerSheet[sheets]?.sum || 0
                return (
                  <td key={sheets} style={{ padding: '10px 4px', textAlign: 'center' }}>
                    {totalM > 0 ? (
                      <div>
                        <div style={{ fontWeight: 900, color: '#6d28d9', fontSize: '0.85rem' }}>
                          {totalM} хв
                        </div>
                        <div style={{ fontSize: '0.64rem', color: textMuted, fontWeight: 700 }}>
                          ≈ {formatMinutesToHours(totalM)}
                        </div>
                      </div>
                    ) : (
                      <span style={{ color: textMuted, opacity: 0.5 }}>—</span>
                    )}
                  </td>
                )
              })}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

