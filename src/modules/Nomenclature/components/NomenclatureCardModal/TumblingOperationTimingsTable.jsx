import React, { useState, useEffect, useMemo } from 'react'
import { RotateCw, Save, Check, RefreshCw } from 'lucide-react'
import { formatMinutesToHours } from '../../../../utils/cuttingTimeUtils.js'

const DEFAULT_SHEETS = [1, 2, 3, 4, 8, 12, 16]

export const DEFAULT_TUMBLING_OPERATIONS = [
  {
    id: 'vibro',
    name: 'Галтовка (Вібростіл)',
    label: 'Вібростіл',
    icon: '🌊',
    badgeBg: '#cffafe',
    badgeColor: '#0e7490'
  },
  {
    id: 'wash',
    name: 'Галтовка (Мийка)',
    label: 'Мийка',
    icon: '🧼',
    badgeBg: '#dbeafe',
    badgeColor: '#1d4ed8'
  },
  {
    id: 'drum',
    name: 'Галтовка (Галтовка)',
    label: 'Барабан / Галтовка',
    icon: '🌀',
    badgeBg: '#ede9fe',
    badgeColor: '#6d28d9'
  },
  {
    id: 'dry',
    name: 'Галтовка (Сушка)',
    label: 'Сушка',
    icon: '💨',
    badgeBg: '#fef3c7',
    badgeColor: '#b45309'
  }
]

export const TumblingOperationTimingsTable = ({
  nomenclatureId,
  initialTimings = {}, // { [opName]: { [sheets]: minutes } }
  onSave,
  isLight = false,
  onTotalsChange
}) => {
  const [timings, setTimings] = useState({})
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  useEffect(() => {
    setTimings(initialTimings || {})
  }, [initialTimings])

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
      DEFAULT_TUMBLING_OPERATIONS.forEach(op => {
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
  }, [timings])

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
      console.error('Error saving tumbling timings:', err)
      alert(`Помилка збереження таймінгів галтовки: ${err.message || err}`)
    } finally {
      setIsSaving(false)
    }
  }

  const bgSubtle = isLight ? '#f8fafc' : 'rgba(255, 255, 255, 0.03)'
  const borderColor = isLight ? '#e2e8f0' : 'rgba(255, 255, 255, 0.1)'
  const textColor = isLight ? '#0f172a' : '#f8fafc'
  const textMuted = isLight ? '#64748b' : '#94a3b8'

  return (
    <div style={{
      background: isLight ? '#ffffff' : 'rgba(255, 255, 255, 0.02)',
      borderRadius: '14px',
      border: `1.5px solid rgba(6, 182, 212, 0.35)`,
      padding: '16px',
      marginTop: '16px',
      boxShadow: '0 4px 16px rgba(6, 182, 212, 0.06)'
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <RotateCw size={18} color="#06b6d4" />
          <div>
            <div style={{ fontWeight: 900, fontSize: '0.88rem', color: textColor, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>Планові таймінги операцій галтовки (хвилини)</span>
              <span style={{ background: 'rgba(6, 182, 212, 0.15)', color: '#0891b2', padding: '2px 7px', borderRadius: '6px', fontSize: '0.68rem', fontWeight: 900 }}>
                Ділянка Галтовки (Цех №1)
              </span>
            </div>
            <div style={{ fontSize: '0.72rem', color: textMuted }}>
              Загальний час галтовки на терміналі = сума введених хвилин (вібростіл, мийка, барабан, сушка)
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSaveClick}
          disabled={isSaving}
          style={{
            background: saveSuccess ? '#10b981' : '#0891b2',
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
            boxShadow: '0 2px 6px rgba(6, 182, 212, 0.2)'
          }}
        >
          {isSaving ? (
            <RefreshCw size={14} className="animate-spin" />
          ) : saveSuccess ? (
            <Check size={14} />
          ) : (
            <Save size={14} />
          )}
          <span>{saveSuccess ? 'Збережено!' : isSaving ? 'Збереження...' : 'Зберегти таймінги галтовки'}</span>
        </button>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
          <thead>
            <tr style={{ background: bgSubtle, borderBottom: `1.5px solid ${borderColor}` }}>
              <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 800, color: textMuted, minWidth: '220px' }}>
                Операція галтовки
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
            {DEFAULT_TUMBLING_OPERATIONS.map((op, idx) => {
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
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
                      <span style={{ fontWeight: 800, color: textColor }}>{op.name}</span>
                    </div>
                  </td>
                  {DEFAULT_SHEETS.map(sheets => {
                    const val = opTimings[sheets] ?? opTimings[String(sheets)] ?? ''
                    return (
                      <td key={sheets} style={{ padding: '4px 6px', textAlign: 'center' }}>
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          placeholder="—"
                          value={val}
                          onChange={(e) => handleTimingChange(op.name, sheets, e.target.value)}
                          style={{
                            width: '60px',
                            background: isLight ? '#ffffff' : 'rgba(255, 255, 255, 0.05)',
                            border: `1px solid ${val ? 'rgba(6, 182, 212, 0.5)' : borderColor}`,
                            color: val ? '#0891b2' : textColor,
                            borderRadius: '6px',
                            padding: '4px 6px',
                            fontSize: '0.78rem',
                            fontWeight: 900,
                            textAlign: 'center',
                            outline: 'none',
                            boxSizing: 'border-box'
                          }}
                        />
                      </td>
                    )
                  })}
                </tr>
              )
            })}

            {/* Subtotal Row */}
            <tr style={{
              background: 'rgba(6, 182, 212, 0.08)',
              borderTop: '2px solid rgba(6, 182, 212, 0.3)',
              fontWeight: 900
            }}>
              <td style={{ padding: '10px', color: '#0891b2', fontSize: '0.8rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>🌀</span>
                  <span>РАЗОМ ГАЛТОВКА (ПЛАН):</span>
                </div>
              </td>
              {DEFAULT_SHEETS.map(sheets => {
                const total = totalsPerSheet[sheets]?.sum || 0
                return (
                  <td key={sheets} style={{ padding: '8px 6px', textAlign: 'center', color: total > 0 ? '#0891b2' : textMuted }}>
                    <div style={{ fontWeight: 950, fontSize: '0.82rem' }}>
                      {total > 0 ? `${total} хв` : '—'}
                    </div>
                    {total > 0 && (
                      <div style={{ fontSize: '0.62rem', fontWeight: 800, opacity: 0.85 }}>
                        ({formatMinutesToHours(total)})
                      </div>
                    )}
                  </td>
                )
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

