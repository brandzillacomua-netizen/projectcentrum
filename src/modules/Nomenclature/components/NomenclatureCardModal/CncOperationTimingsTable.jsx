import React, { useState, useEffect, useMemo } from 'react'
import { Clock, Save, Check, RefreshCw } from 'lucide-react'
import { formatMinutesToHours } from '../../../../utils/cuttingTimeUtils.js'

const DEFAULT_SHEETS = [1, 2, 3, 4, 8, 12, 16]

export const CncOperationTimingsTable = ({
  nomenclatureId,
  machineType,
  operations = [], // [{ name, side }]
  initialTimings = {}, // { [opName]: { [sheets]: minutes } }
  onSave,
  isLight = false,
  onTotalsChange
}) => {
  // Local timings state: { [opName]: { "1": 15, "2": 28, ... } }
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
      operations.forEach(op => {
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
  }, [timings, operations])

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
        await onSave(machineType, timings, totalsPerSheet)
      }
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err) {
      console.error('Error saving operation timings:', err)
      alert(`Помилка збереження: ${err.message || err}`)
    } finally {
      setIsSaving(false)
    }
  }

  if (!operations || operations.length === 0) {
    return null
  }

  const bgSubtle = isLight ? '#f8fafc' : 'rgba(255, 255, 255, 0.03)'
  const borderColor = isLight ? '#e2e8f0' : 'rgba(255, 255, 255, 0.1)'
  const textColor = isLight ? '#0f172a' : '#f8fafc'
  const textMuted = isLight ? '#64748b' : '#94a3b8'

  const getSideBadge = (side) => {
    if (side === 'side1') {
      return <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '2px 6px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 800 }}>Стор. 1</span>
    }
    if (side === 'side2') {
      return <span style={{ background: '#dcfce7', color: '#15803d', padding: '2px 6px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 800 }}>Стор. 2</span>
    }
    return <span style={{ background: '#fef3c7', color: '#b45309', padding: '2px 6px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 800 }}>Вирізка</span>
  }

  return (
    <div style={{
      background: isLight ? '#ffffff' : 'rgba(255, 255, 255, 0.02)',
      borderRadius: '14px',
      border: `1px solid ${borderColor}`,
      padding: '16px',
      marginTop: '12px'
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Clock size={18} color="#f59e0b" />
          <div>
            <div style={{ fontWeight: 900, fontSize: '0.88rem', color: textColor }}>
              Планові таймінги операцій розкрою (хвилини)
            </div>
            <div style={{ fontSize: '0.72rem', color: textMuted }}>
              Загальний час розкрою на терміналі = сума введених хвилин усіх операцій
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSaveClick}
          disabled={isSaving}
          style={{
            background: saveSuccess ? '#10b981' : '#f59e0b',
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
            boxShadow: '0 2px 6px rgba(245, 158, 11, 0.2)'
          }}
        >
          {isSaving ? (
            <RefreshCw size={14} className="animate-spin" />
          ) : saveSuccess ? (
            <Check size={14} />
          ) : (
            <Save size={14} />
          )}
          <span>{saveSuccess ? 'Збережено!' : isSaving ? 'Збереження...' : 'Зберегти таймінги'}</span>
        </button>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
          <thead>
            <tr style={{ background: bgSubtle, borderBottom: `1.5px solid ${borderColor}` }}>
              <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 800, color: textMuted, minWidth: '180px' }}>
                Операція
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
            {operations.map((op, idx) => {
              const opTimings = timings[op.name] || {}
              return (
                <tr 
                  key={idx}
                  style={{
                    borderBottom: `1px solid ${borderColor}`,
                    background: idx % 2 === 0 ? 'transparent' : bgSubtle
                  }}
                >
                  <td style={{ padding: '8px 10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      {getSideBadge(op.side)}
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
                            padding: '4px 6px',
                            textAlign: 'center',
                            borderRadius: '6px',
                            border: `1px solid ${val !== '' ? '#f59e0b' : borderColor}`,
                            background: val !== '' ? (isLight ? '#fffbeb' : 'rgba(245, 158, 11, 0.1)') : (isLight ? '#ffffff' : 'rgba(0, 0, 0, 0.2)'),
                            color: val !== '' ? '#d97706' : textColor,
                            fontWeight: 800,
                            fontSize: '0.78rem',
                            outline: 'none'
                          }}
                        />
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr style={{ background: isLight ? '#fef3c7' : 'rgba(245, 158, 11, 0.15)', borderTop: `2px solid #f59e0b` }}>
              <td style={{ padding: '10px 10px', fontWeight: 900, color: '#b45309' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>⏱️</span>
                  <span>РАЗОМ НА СТІЛ (ПЛАН):</span>
                </div>
              </td>
              {DEFAULT_SHEETS.map(sheets => {
                const { sum, count } = totalsPerSheet[sheets] || { sum: 0, count: 0 }
                return (
                  <td key={sheets} style={{ padding: '10px 6px', textAlign: 'center' }}>
                    {sum > 0 ? (
                      <div>
                        <div style={{ fontWeight: 1000, color: '#b45309', fontSize: '0.82rem' }}>
                          {formatMinutesToHours(sum)}
                        </div>
                        <div style={{ fontSize: '0.62rem', fontWeight: 800, color: '#d97706', opacity: 0.85 }}>
                          {sum} хв ({count} оп.)
                        </div>
                      </div>
                    ) : (
                      <span style={{ color: textMuted, fontSize: '0.72rem' }}>—</span>
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

