import React, { useState, useEffect, useMemo } from 'react'
import { X, Layers, CheckCircle2, AlertCircle, RotateCw } from 'lucide-react'
import { useStore } from '../../../../store/index.js'
import { supabase } from '../../../../supabase'

const SIDE_OPTIONS = [
  { id: 'side1', label: 'Операція (1 сторона)' },
  { id: 'side2', label: 'Операція (2 сторона)' },
  { id: 'side2_cut', label: 'Операція (2 сторона вирізка)' }
]

export function Shop1ShiftChangeModal({
  showShiftChangeModal,
  onClose,
  currentCard,
  shiftChangeShift,
  setShiftChangeShift,
  shiftChangeOperator,
  setShiftChangeOperator,
  getFilteredOperators,
  handleShiftChange,
  isProcessing,
  selectStyle = {},
  labelStyle = {}
}) {
  const machines = useStore(state => state.machines) || []
  const machineOperations = useStore(state => state.machineOperations) || []

  const [localOpConfig, setLocalOpConfig] = useState(null)
  const [selectedSide, setSelectedSide] = useState('')
  const [selectedOp, setSelectedOp] = useState('')
  const [customOp, setCustomOp] = useState('')
  const [selectedSheet, setSelectedSheet] = useState('')

  // Check if current machine is a small CNC (12x8 / 1200x800 / Малий / 1.)
  const isSmallMachine = useMemo(() => {
    const machineName = currentCard?.machine || ''
    const norm = machineName.toLowerCase().replace(/х/g, 'x')
    return (
      norm.includes('12x8') ||
      norm.includes('12*8') ||
      norm.includes('1200x800') ||
      norm.includes('1200') ||
      norm.includes('малий') ||
      norm.includes('1.')
    )
  }, [currentCard?.machine])

  // Clean operation string helper (removes cutter metadata and takes clean name)
  const cleanOp = (op) => {
    if (!op || typeof op !== 'string') return ''
    if (op.startsWith('__CUTTER__:')) return ''
    if (op.includes('|')) return op.split('|')[0].trim()
    return op.trim()
  }

  // Resolve operation configuration for this card and machine
  const opConfig = useMemo(() => {
    if (!currentCard?.nomenclature_id) return null
    const nomId = String(currentCard.nomenclature_id)
    const macName = currentCard.machine || ''
    const macId = currentCard.machine_id

    // 1. Try exact machine_id or machine_name match
    const match = machineOperations.find(o =>
      String(o.nomenclature_id) === nomId &&
      (
        (macId && String(o.machine_id) === String(macId)) ||
        (macName && o.machine_type === macName)
      )
    )
    if (match) return match

    // 2. Try normalized machine type
    const normMac = macName.toLowerCase().replace(/х/g, 'x')
    const matchType = machineOperations.find(o => {
      if (String(o.nomenclature_id) !== nomId) return false
      const typeLower = (o.machine_type || '').toLowerCase().replace(/х/g, 'x')
      if (isSmallMachine && (typeLower.includes('1200') || typeLower.includes('12x8') || typeLower.includes('малий'))) return true
      if (normMac.includes('3050') && typeLower.includes('3050')) return true
      if (normMac.includes('3060') && typeLower.includes('3060')) return true
      if (normMac.includes('6000') && (typeLower.includes('6000') || typeLower.includes('дракон'))) return true
      if (normMac.includes('ke xin') && (typeLower.includes('ke xin') || typeLower.includes('фея'))) return true
      return false
    })
    if (matchType) return matchType

    // 3. Fallback: any operations config for this nomenclature
    return machineOperations.find(o => String(o.nomenclature_id) === nomId) || null
  }, [currentCard?.nomenclature_id, currentCard?.machine, currentCard?.machine_id, machineOperations, isSmallMachine])

  // Direct fetch fallback if not in store
  useEffect(() => {
    if (showShiftChangeModal && currentCard?.nomenclature_id && (!opConfig || machineOperations.length === 0)) {
      supabase
        .from('machine_operations')
        .select('*')
        .eq('nomenclature_id', currentCard.nomenclature_id)
        .then(({ data }) => {
          if (data && data.length > 0) {
            const found = data.find(d => {
              const t = (d.machine_type || '').toLowerCase().replace(/х/g, 'x')
              return isSmallMachine ? (t.includes('1200') || t.includes('12x8') || t.includes('малий')) : true
            }) || data[0]
            setLocalOpConfig(found)
          }
        })
        .catch(console.error)
    }
  }, [showShiftChangeModal, currentCard?.nomenclature_id, opConfig, machineOperations.length, isSmallMachine])

  const activeConfig = opConfig || localOpConfig

  // Pre-populate or reset fields when modal opens
  useEffect(() => {
    if (showShiftChangeModal && currentCard) {
      const existingLastOp = currentCard.card_info?.match(/\[LAST_OP:([^\]]+)\]/)?.[1]
      if (existingLastOp) {
        const sideMatch = existingLastOp.match(/Сторона:\s*([^•\]]+)/)?.[1]?.trim()
        const opMatch = existingLastOp.match(/Операція:\s*([^•\]]+)/)?.[1]?.trim()
        const sheetMatch = existingLastOp.match(/Листи:\s*([^•\]]+)/)?.[1]?.trim()

        if (sideMatch) {
          if (sideMatch.includes('1 сторона')) setSelectedSide('side1')
          else if (sideMatch.includes('2 сторона вирізка') || sideMatch.includes('вирізка')) setSelectedSide('side2_cut')
          else if (sideMatch.includes('2 сторона')) setSelectedSide('side2')
        }
        if (opMatch) setSelectedOp(opMatch)
        if (sheetMatch) setSelectedSheet(sheetMatch)
      } else {
        setSelectedSide('')
        setSelectedOp('')
        setCustomOp('')
        setSelectedSheet('')
      }
    }
  }, [showShiftChangeModal, currentCard?.id])

  // Operations list for the currently selected side
  const sideOpsList = useMemo(() => {
    if (!activeConfig || !selectedSide) return []
    let rawList = []
    if (selectedSide === 'side1') rawList = activeConfig.side1_ops || []
    else if (selectedSide === 'side2') rawList = activeConfig.side2_ops || []
    else if (selectedSide === 'side2_cut') rawList = activeConfig.side2_cut_ops || []

    return rawList.map(cleanOp).filter(Boolean)
  }, [activeConfig, selectedSide])

  // Only small machines divide sheet progress into Sheet 1,2 and Sheet 3,4 for sides 1 and 2
  const showSheetsSelector = Boolean(isSmallMachine && (selectedSide === 'side1' || selectedSide === 'side2'))

  // Validation: shift, operator, cutting side, operation, sheet status (if small CNC)
  const isOpValid = Boolean(
    selectedSide &&
    (selectedOp === '__CUSTOM__' ? customOp?.trim() : selectedOp)
  )
  const isSheetValid = !showSheetsSelector || Boolean(selectedSheet)
  const canSubmit = Boolean(
    shiftChangeShift &&
    shiftChangeOperator &&
    isOpValid &&
    isSheetValid &&
    !isProcessing
  )

  if (!showShiftChangeModal || !currentCard) return null

  const handleConfirmShiftChange = () => {
    if (!canSubmit) return
    const sideObj = SIDE_OPTIONS.find(s => s.id === selectedSide)
    const finalOp = selectedOp === '__CUSTOM__' ? customOp.trim() : selectedOp
    handleShiftChange({
      side: sideObj?.label || '',
      operation: finalOp || '',
      sheet: showSheetsSelector ? (selectedSheet || '') : ''
    })
  }

  const existingLastOp = currentCard.card_info?.match(/\[LAST_OP:([^\]]+)\]/)?.[1]
  const defaultLabelStyle = {
    display: 'block',
    fontSize: '0.66rem',
    color: 'var(--text-muted, #94a3b8)',
    fontWeight: 900,
    textTransform: 'uppercase',
    marginBottom: '6px',
    letterSpacing: '0.5px'
  }
  const defaultSelectStyle = {
    width: '100%',
    background: 'var(--surface-inset, #f8fafc)',
    border: '1.5px solid var(--border-subtle, #cbd5e1)',
    color: 'var(--text-strong, #0f172a)',
    padding: '13px 14px',
    borderRadius: '14px',
    fontSize: '0.92rem',
    fontWeight: 700,
    boxSizing: 'border-box',
    outline: 'none',
    transition: 'border-color 0.2s'
  }

  const activeLabelStyle = Object.keys(labelStyle).length ? labelStyle : defaultLabelStyle
  const activeSelectStyle = Object.keys(selectStyle).length ? selectStyle : defaultSelectStyle

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 10030, padding: '40px 20px', overflowY: 'auto' }}>
      <div style={{ background: 'var(--surface-1)', width: '100%', maxWidth: '460px', borderRadius: '28px', border: '1.5px solid rgba(245, 158, 11, 0.35)', overflow: 'hidden', boxShadow: '0 24px 64px rgba(0, 0, 0, 0.35), 0 8px 32px rgba(245, 158, 11, 0.15)', margin: 'auto 0' }}>
        {/* Header */}
        <div style={{ padding: '20px 22px', background: 'var(--surface-2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(245, 158, 11, 0.2)' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 950, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <RotateCw size={18} strokeWidth={2.8} />
              <span>ПЕРЕЗМІНКА · РОЗКРІЙ</span>
            </h3>
            <div style={{ fontSize: '0.64rem', color: 'var(--text-dim)', marginTop: '3px', fontWeight: 700 }}>
              Картка продовжує роботу — змінюється виконавець
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: '4px', borderRadius: '8px', display: 'flex', alignItems: 'center' }}>
            <X size={22} />
          </button>
        </div>

        <div style={{ padding: '24px 22px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Поточний оператор */}
          <div style={{ background: 'var(--surface-inset)', borderRadius: '14px', padding: '12px 16px', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '0.55rem', color: 'var(--text-dim)', fontWeight: 900, textTransform: 'uppercase', marginBottom: '4px' }}>Поточний виконавець</div>
            <div style={{ fontSize: '0.92rem', fontWeight: 900, color: 'var(--text-strong)' }}>{currentCard.operator_name || '—'}</div>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '2px', fontWeight: 700 }}>
              {currentCard.shift_name || '—'} {currentCard.machine ? `• ${currentCard.machine}` : ''}
            </div>
            {existingLastOp && (
              <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--border-subtle)', fontSize: '0.68rem', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>📍</span>
                <span><strong>Попередня відмітка:</strong> {existingLastOp}</span>
              </div>
            )}
          </div>

          {/* Нова зміна */}
          <div>
            <label style={activeLabelStyle}>Нова зміна</label>
            <select value={shiftChangeShift} onChange={e => setShiftChangeShift(e.target.value)} style={activeSelectStyle}>
              <option value="">— Оберіть зміну —</option>
              <option value="Зміна 1">Зміна 1</option>
              <option value="Зміна 2">Зміна 2</option>
              <option value="Зміна 3">Зміна 3</option>
              <option value="Зміна 4">Зміна 4</option>
              <option value="Без зміни">Без зміни</option>
            </select>
          </div>

          {/* Новий оператор */}
          <div>
            <label style={activeLabelStyle}>Новий виконавець</label>
            <select
              value={shiftChangeOperator}
              onChange={e => setShiftChangeOperator(e.target.value)}
              disabled={!shiftChangeShift}
              style={{ ...activeSelectStyle, opacity: shiftChangeShift ? 1 : 0.5, cursor: shiftChangeShift ? 'pointer' : 'not-allowed' }}
            >
              <option value="">{shiftChangeShift ? '— Оберіть оператора —' : '— Спочатку оберіть зміну —'}</option>
              {getFilteredOperators && getFilteredOperators('Цех №1', shiftChangeShift, 'Розкрій').map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>

          {/* Блок фіксації поточної операції при перезмінці */}
          <div style={{
            background: 'rgba(245, 158, 11, 0.05)',
            border: '1.5px solid rgba(245, 158, 11, 0.25)',
            borderRadius: '16px',
            padding: '14px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.85rem' }}>📍</span>
                <span style={{ fontSize: '0.68rem', color: '#f59e0b', fontWeight: 950, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                  На чому закінчили розкрій <span style={{ color: '#ef4444' }}>*</span>
                </span>
              </div>
              {isSmallMachine && (
                <span style={{ fontSize: '0.58rem', background: '#f59e0b20', color: '#f59e0b', padding: '2px 8px', borderRadius: '6px', fontWeight: 900 }}>
                  Малий станок (12×8)
                </span>
              )}
            </div>

            {/* 1. Вибір сторони (Операція 1 сторона / Операція 2 сторона / Операція 2 сторона вирізка) */}
            <div>
              <label style={activeLabelStyle}>
                1. Сторона / Етап розкрою <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <select
                value={selectedSide}
                onChange={e => {
                  setSelectedSide(e.target.value)
                  setSelectedOp('')
                  setCustomOp('')
                  if (e.target.value === 'side2_cut') {
                    setSelectedSheet('')
                  }
                }}
                style={activeSelectStyle}
              >
                <option value="">— Оберіть сторону —</option>
                {SIDE_OPTIONS.map(opt => (
                  <option key={opt.id} value={opt.id}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* 2. Конкретна операція з переліку згідно робочої карти */}
            {selectedSide && (
              <div>
                <label style={activeLabelStyle}>
                  2. Конкретна операція (зі списку карти) <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select
                  value={selectedOp}
                  onChange={e => setSelectedOp(e.target.value)}
                  style={activeSelectStyle}
                >
                  <option value="">— Оберіть операцію зі списку —</option>
                  {sideOpsList.map((op, idx) => (
                    <option key={idx} value={op}>{op}</option>
                  ))}
                  {sideOpsList.length === 0 && (
                    <option value="В роботі">В роботі</option>
                  )}
                  <option value="__CUSTOM__">✏️ Вказати іншу операцію вручну</option>
                </select>

                {selectedOp === '__CUSTOM__' && (
                  <input
                    type="text"
                    value={customOp}
                    onChange={e => setCustomOp(e.target.value)}
                    placeholder="Введіть назву операції або коментар..."
                    style={{
                      ...activeSelectStyle,
                      marginTop: '8px',
                      fontSize: '0.85rem'
                    }}
                  />
                )}
              </div>
            )}

            {/* 3. Вибір листів для малого станка (тільки для 1 і 2 сторони, НЕ для вирізки) */}
            {showSheetsSelector && (
              <div>
                <label style={activeLabelStyle}>
                  3. Листи (статус виконання на малому станку) <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select
                  value={selectedSheet}
                  onChange={e => setSelectedSheet(e.target.value)}
                  style={activeSelectStyle}
                >
                  <option value="">— Оберіть листи —</option>
                  <option value="Лист 1, 2">Лист 1, 2</option>
                  <option value="Лист 3, 4">Лист 3, 4</option>
                  <option value="Листи 1, 2, 3, 4 (всі)">Листи 1, 2, 3, 4 (всі)</option>
                </select>
              </div>
            )}
          </div>

          {/* Validation Hint when incomplete */}
          {!canSubmit && !isProcessing && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '7px',
              fontSize: '0.72rem',
              fontWeight: 800,
              color: '#d97706',
              background: 'rgba(245, 158, 11, 0.08)',
              border: '1px solid rgba(245, 158, 11, 0.25)',
              borderRadius: '12px',
              padding: '9px 14px',
              textAlign: 'center'
            }}>
              <AlertCircle size={15} style={{ flexShrink: 0 }} />
              <span>
                {!shiftChangeShift
                  ? 'Оберіть нову зміну'
                  : !shiftChangeOperator
                  ? 'Оберіть нового виконавця'
                  : !selectedSide
                  ? 'Оберіть сторону / етап розкрою'
                  : !isOpValid
                  ? 'Оберіть операцію розкрою зі списку'
                  : !isSheetValid
                  ? 'Вкажіть листи для малого станка'
                  : 'Заповніть усі обов’язкові поля'}
              </span>
            </div>
          )}

          {/* Кнопка підтвердження */}
          <button
            onClick={handleConfirmShiftChange}
            disabled={!canSubmit}
            style={{
              width: '100%',
              background: canSubmit
                ? 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)'
                : 'var(--surface-3)',
              color: canSubmit ? '#ffffff' : 'var(--text-dim)',
              border: canSubmit ? 'none' : '1.5px solid var(--border-subtle)',
              padding: '16px 22px',
              borderRadius: '16px',
              fontSize: '0.98rem',
              fontWeight: 950,
              cursor: canSubmit ? 'pointer' : 'not-allowed',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
              boxShadow: canSubmit
                ? '0 8px 24px -4px rgba(245, 158, 11, 0.5), 0 4px 12px rgba(234, 88, 12, 0.35)'
                : 'none',
              opacity: canSubmit ? 1 : 0.65,
              textShadow: canSubmit ? '0 1px 2px rgba(0,0,0,0.25)' : 'none'
            }}
          >
            <RotateCw size={19} strokeWidth={2.8} className={isProcessing ? 'spin' : ''} />
            <span>{isProcessing ? 'ЗБЕРЕЖЕННЯ...' : 'ПІДТВЕРДИТИ ПЕРЕЗМІНКУ'}</span>
          </button>

          <div style={{ textAlign: 'center', fontSize: '0.62rem', color: 'var(--text-dim)', fontWeight: 700 }}>
            Картка залишається в роботі · Таймер зміни почнеться для нового оператора
          </div>
        </div>
      </div>
    </div>
  )
}
