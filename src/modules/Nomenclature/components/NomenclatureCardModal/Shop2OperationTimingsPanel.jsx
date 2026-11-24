import React, { useState, useEffect } from 'react'
import { Save, Clock, CheckCircle2 } from 'lucide-react'
import {
  SHOP2_TIMING_STAGES,
  getShop2OperationTimings,
  formatShop2PlannedMinutes
} from '../../../../utils/shop2RoutingUtils'
import { getPartShop2RoutingFlags } from '../../utils/nomenclatureHelpers'

export function Shop2OperationTimingsPanel({ item, onSave }) {
  const [timings, setTimings] = useState({ pressing: '', paintingPerCassette: '', rework: '', notes: '' })
  const [paintingUnitsPerShelf, setPaintingUnitsPerShelf] = useState('')
  const [flags, setFlags] = useState({ requiresPressing: false, requiresPainting: false })
  const [saving, setSaving] = useState(false)
  const [savedOk, setSavedOk] = useState(false)

  useEffect(() => {
    const parsed = getShop2OperationTimings(item)
    const partFlags = getPartShop2RoutingFlags(item)
    const shelfCap = partFlags.paintingUnitsPerShelf || 0
    const initialPaintingCassette =
      parsed.paintingPerCassette > 0
        ? parsed.paintingPerCassette
        : (parsed.painting > 0 && shelfCap > 0 ? Math.round(parsed.painting * shelfCap * 100) / 100 : 0)

    setTimings({
      pressing: parsed.pressing > 0 ? String(parsed.pressing) : '',
      paintingPerCassette: initialPaintingCassette > 0 ? String(initialPaintingCassette) : '',
      rework: parsed.rework > 0 ? String(parsed.rework) : '',
      notes: parsed.notes || ''
    })
    setPaintingUnitsPerShelf(shelfCap > 0 ? String(shelfCap) : '')
    setFlags({
      requiresPressing: partFlags.requiresPressing,
      requiresPainting: partFlags.requiresPainting
    })
    setSavedOk(false)
  }, [item])

  const parseNum = (val) => {
    if (val === '' || val === null || val === undefined) return 0
    const n = Number(String(val).replace(',', '.'))
    return Number.isFinite(n) && n > 0 ? n : 0
  }

  const shelfCapNum = Math.floor(parseNum(paintingUnitsPerShelf))
  const pressingPerUnit = parseNum(timings.pressing)
  const paintingPerCassette = parseNum(timings.paintingPerCassette)
  const paintingPerUnit =
    paintingPerCassette > 0 && shelfCapNum > 0
      ? Math.round((paintingPerCassette / shelfCapNum) * 10000) / 10000
      : 0
  const reworkPerUnit = parseNum(timings.rework)
  const totalPerUnit = Math.round((pressingPerUnit + paintingPerUnit + reworkPerUnit) * 10000) / 10000

  const handleTimingChange = (key, rawVal, flagKey) => {
    setTimings(prev => ({ ...prev, [key]: rawVal }))
    setSavedOk(false)
    const numeric = parseNum(rawVal)
    if (numeric > 0 && flagKey) {
      setFlags(prev => ({ ...prev, [flagKey]: true }))
    }
  }

  const handleShelfChange = (rawVal) => {
    const cleaned = rawVal.replace(/[^0-9]/g, '')
    setPaintingUnitsPerShelf(cleaned)
    setSavedOk(false)
    if (Number(cleaned) > 0) {
      setFlags(prev => ({ ...prev, requiresPainting: true }))
    }
  }

  const handleSaveClick = async () => {
    if (!onSave || saving) return
    setSaving(true)
    setSavedOk(false)
    try {
      await onSave({
        shop2_operation_timings: {
          pressing: pressingPerUnit,
          painting: paintingPerUnit,
          painting_per_cassette: paintingPerCassette,
          rework: reworkPerUnit,
          notes: timings.notes || ''
        },
        requiresPressing: Boolean(flags.requiresPressing),
        requiresPainting: Boolean(flags.requiresPainting),
        paintingUnitsPerShelf: flags.requiresPainting && shelfCapNum > 0 ? shelfCapNum : null
      })
      setSavedOk(true)
      setTimeout(() => setSavedOk(false), 3000)
    } finally {
      setSaving(false)
    }
  }

  const sampleQuantities = [1, 10, 50, 100]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* TOP SUMMARY CARD: Цех №2 Total Planned Timing */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(236, 72, 153, 0.08) 50%, rgba(249, 115, 22, 0.07) 100%)',
        borderRadius: '16px',
        padding: '18px 22px',
        border: '1.5px solid rgba(139, 92, 246, 0.4)',
        boxShadow: '0 6px 20px rgba(139, 92, 246, 0.09)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.4rem' }}>⏱️</span>
            <div>
              <div style={{ fontSize: '0.95rem', fontWeight: 900, color: 'var(--text, #0f172a)', letterSpacing: '0.01em' }}>
                РАЗОМ ЦЕХ №2: ПРЕСУВАННЯ + ФАРБУВАННЯ + ДООПРАЦЮВАННЯ
              </div>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted, #64748b)' }}>
                Плановий час обробки в Цеху №2 (автоматично підставляється в робочі картки при запуску партії)
              </div>
            </div>
          </div>
          <span style={{
            fontSize: '0.76rem',
            fontWeight: 900,
            padding: '4px 12px',
            borderRadius: '20px',
            background: 'rgba(139, 92, 246, 0.16)',
            color: '#7c3aed',
            border: '1px solid rgba(139, 92, 246, 0.35)'
          }}>
            Цех №2 • Норма часу на 1 деталь
          </span>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))',
          gap: '10px'
        }}>
          {sampleQuantities.map(qty => {
            const totalForQty = Math.round(totalPerUnit * qty * 100) / 100
            const hasAny = totalForQty > 0
            return (
              <div
                key={qty}
                style={{
                  background: hasAny ? 'var(--card-bg, #ffffff)' : 'rgba(0, 0, 0, 0.02)',
                  borderRadius: '10px',
                  padding: '10px 12px',
                  border: hasAny ? '1.5px solid #8b5cf6' : '1px dashed var(--border-color, #cbd5e1)',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '3px'
                }}
              >
                <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#7c3aed' }}>
                  {qty === 1 ? '1 деталь' : `${qty} деталей`}
                </div>
                <div style={{ fontSize: '0.98rem', fontWeight: 900, color: hasAny ? 'var(--text, #0f172a)' : 'var(--text-muted, #94a3b8)' }}>
                  {hasAny ? `${totalForQty} хв` : '—'}
                </div>
                {hasAny && totalForQty >= 60 && (
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#0284c7' }}>
                    ≈ {formatShop2PlannedMinutes(totalForQty)}
                  </div>
                )}
                {hasAny && (
                  <div style={{ fontSize: '0.64rem', color: 'var(--text-muted, #64748b)', borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: '3px' }}>
                    🔩{Math.round(pressingPerUnit * qty * 10) / 10} · 🎨{Math.round(paintingPerUnit * qty * 10) / 10} · 🛠️{Math.round(reworkPerUnit * qty * 10) / 10}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* OPERATIONS & PER-UNIT TIMINGS EDITOR */}
      <div style={{
        background: 'var(--card-bg, #ffffff)',
        borderRadius: '16px',
        padding: '20px 24px',
        border: '1.5px solid rgba(139, 92, 246, 0.28)',
        boxShadow: '0 4px 18px rgba(0, 0, 0, 0.04)',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ fontSize: '0.95rem', fontWeight: 900, color: 'var(--text, #0f172a)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={17} color="#7c3aed" />
              <span>Операції та планові таймінги Цеху №2</span>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #64748b)', marginTop: '3px' }}>
              Для пресування й доопрацювання вказується час на 1 деталь (хв), а для фарбування — кількість на касету (шт) та час на 1 касету (хв).
            </div>
          </div>

          <button
            type="button"
            onClick={handleSaveClick}
            disabled={saving}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 18px',
              borderRadius: '10px',
              border: 'none',
              background: savedOk ? '#059669' : '#7c3aed',
              color: '#ffffff',
              fontWeight: 900,
              fontSize: '0.84rem',
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.7 : 1,
              boxShadow: '0 4px 12px rgba(124, 58, 237, 0.25)'
            }}
          >
            {savedOk ? <CheckCircle2 size={16} /> : <Save size={16} />}
            <span>{saving ? 'Збереження...' : savedOk ? 'Збережено!' : 'Зберегти таймінги Цеху №2'}</span>
          </button>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '540px' }}>
            <thead>
              <tr style={{ borderBottom: '1.5px solid var(--border-color, #e2e8f0)', fontSize: '0.72rem', color: 'var(--text-muted, #64748b)', textTransform: 'uppercase' }}>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 900 }}>Операція Цеху №2</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 900 }}>У маршруті / Касета</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 900 }}>План (хв)</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 900 }}>Розрахунок / Приклад</th>
              </tr>
            </thead>
            <tbody>
              {SHOP2_TIMING_STAGES.map(st => {
                const isPainting = st.key === 'painting'
                const inputKey = isPainting ? 'paintingPerCassette' : st.key
                const inputVal = timings[inputKey]
                const numericVal = parseNum(inputVal)
                const for100 = Math.round(parseNum(st.key === 'painting' ? paintingPerUnit : timings[st.key]) * 100 * 100) / 100
                const hasFlag = st.flagKey ? Boolean(flags[st.flagKey]) : null

                return (
                  <tr key={st.key} style={{ borderBottom: '1px solid var(--border-color, #f1f5f9)' }}>
                    <td style={{ padding: '14px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 900, fontSize: '0.9rem', color: 'var(--text, #0f172a)' }}>
                        <span>{st.icon}</span>
                        <span>{st.stage}</span>
                      </div>
                    </td>
                    <td style={{ padding: '14px 12px', textAlign: 'center' }}>
                      {st.flagKey ? (
                        <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                          <label style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '5px 10px',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '0.78rem',
                            fontWeight: 800,
                            background: hasFlag ? 'rgba(139, 92, 246, 0.12)' : 'rgba(100, 116, 139, 0.08)',
                            border: hasFlag ? `1px solid ${st.color}` : '1px solid var(--border-color, #cbd5e1)',
                            color: hasFlag ? st.color : 'var(--text-muted, #64748b)'
                          }}>
                            <input
                              type="checkbox"
                              checked={Boolean(hasFlag)}
                              onChange={e => {
                                setFlags(prev => ({ ...prev, [st.flagKey]: e.target.checked }))
                                setSavedOk(false)
                              }}
                            />
                            <span>{hasFlag ? 'Активна' : 'Не потрібно'}</span>
                          </label>
                          {isPainting && hasFlag && (
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                              <input
                                type="number"
                                min="1"
                                step="1"
                                placeholder="шт/касета"
                                value={paintingUnitsPerShelf}
                                onChange={e => handleShelfChange(e.target.value)}
                                style={{
                                  width: '92px',
                                  padding: '5px 8px',
                                  borderRadius: '7px',
                                  border: '1.5px solid rgba(124, 58, 237, 0.45)',
                                  background: 'var(--input-bg, #ffffff)',
                                  color: 'var(--text, #0f172a)',
                                  textAlign: 'center',
                                  fontWeight: 900,
                                  fontSize: '0.82rem'
                                }}
                              />
                              <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#7c3aed' }}>
                                шт/касета
                              </span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <span style={{ fontSize: '0.74rem', color: 'var(--text-muted, #64748b)', fontWeight: 700 }}>
                          За потребою
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '14px 12px', textAlign: 'center' }}>
                      <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                        <input
                          type="number"
                          min="0"
                          step="0.1"
                          placeholder="0"
                          value={inputVal}
                          onChange={e => handleTimingChange(inputKey, e.target.value, st.flagKey)}
                          style={{
                            width: '110px',
                            padding: '8px 10px',
                            borderRadius: '8px',
                            border: '1.5px solid var(--border-color, #cbd5e1)',
                            background: 'var(--input-bg, #ffffff)',
                            color: 'var(--text, #0f172a)',
                            textAlign: 'center',
                            fontWeight: 900,
                            fontSize: '0.92rem'
                          }}
                        />
                        <span style={{ fontSize: '0.68rem', fontWeight: 800, color: isPainting ? '#7c3aed' : 'var(--text-muted, #64748b)' }}>
                          {isPainting ? 'хв / 1 касету' : 'хв / 1 деталь'}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: '14px 12px', textAlign: 'right', fontWeight: 900, fontSize: '0.86rem', color: (isPainting ? numericVal > 0 : for100 > 0) ? st.color : 'var(--text-muted, #94a3b8)' }}>
                      {isPainting ? (
                        numericVal > 0 ? (
                          shelfCapNum > 0 ? (
                            <div>
                              <div>1 касета ({shelfCapNum} шт): {numericVal} хв ({formatShop2PlannedMinutes(numericVal)})</div>
                              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted, #64748b)' }}>
                                ≈ {paintingPerUnit} хв/шт · 100 шт: {for100} хв
                              </div>
                            </div>
                          ) : (
                            <div>
                              <div>1 касета: {numericVal} хв</div>
                              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#d97706' }}>
                                Вкажіть шт/касета для розрахунку на деталь
                              </div>
                            </div>
                          )
                        ) : '—'
                      ) : (
                        for100 > 0 ? `100 шт: ${for100} хв (${formatShop2PlannedMinutes(for100)})` : '—'
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div>
          <label style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748b)', fontWeight: 900, display: 'block', marginBottom: '6px' }}>
            ПРИМІТКА ДО ОПЕРАЦІЙ ЦЕХУ №2 (ОПЦІОНАЛЬНО)
          </label>
          <input
            type="text"
            placeholder="Наприклад: прогрів перед пресуванням або сушка після фарбування..."
            value={timings.notes}
            onChange={e => {
              setTimings(prev => ({ ...prev, notes: e.target.value }))
              setSavedOk(false)
            }}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: '10px',
              border: '1px solid var(--border-color, #cbd5e1)',
              background: 'var(--input-bg, #ffffff)',
              color: 'var(--text, #0f172a)',
              fontSize: '0.84rem',
              boxSizing: 'border-box'
            }}
          />
        </div>
      </div>
    </div>
  )
}

