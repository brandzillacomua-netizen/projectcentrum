import React, { useState, useEffect } from 'react'
import { X, Loader2 } from 'lucide-react'
import { findMachineByName, MACHINE_TYPES } from '../../../Foreman/utils/foremanHelpers.js'

export default function MachineChangeModal({
  isOpen,
  task,
  partId,
  partName,
  initialMachine,
  machines,
  machineOperations,
  nomenclatures,
  inventory,
  workCards,
  archiveCards,
  isChanging,
  onClose,
  onConfirm
}) {
  const [selectedMachine, setSelectedMachine] = useState(initialMachine || MACHINE_TYPES[0])
  const [selectedLoadCapacity, setSelectedLoadCapacity] = useState('')
  const [selectedCutterTypes, setSelectedCutterTypes] = useState({})

  useEffect(() => {
    if (isOpen) {
      setSelectedMachine(initialMachine || MACHINE_TYPES[0])
      setSelectedLoadCapacity('')
      setSelectedCutterTypes({})
    }
  }, [isOpen, initialMachine])

  if (!isOpen || !task || !partId) return null

  const snapshotEntry = task.plan_snapshot?.[String(partId)]
  const totalSheetsPlanned = snapshotEntry?.sheets || 0

  const unitsPerSheetForPart = Number(snapshotEntry?.units_per_sheet) || Number(nomenclatures?.find(n => String(n.id) === String(partId))?.units_per_sheet) || 1
  const knownCards = Array.from(new Map([...(workCards || []), ...(archiveCards || [])].map(card => [String(card.id), card])).values())
  const partCards = knownCards.filter(c =>
    String(c.task_id) === String(task.id) &&
    String(c.nomenclature_id) === String(partId) &&
    !c.is_rework &&
    c.operation !== 'Склад BZ' &&
    c.operation !== 'Склад БЗ'
  )

  const generatedSheets = Math.min(totalSheetsPlanned, partCards.reduce((sum, c) => {
    const cardSheets = Number(c.actual_sheets || c.actualSheets) || Math.ceil((Number(c.quantity) || 0) / unitsPerSheetForPart)
    return sum + cardSheets
  }, 0))
  const remainingSheets = Math.max(0, totalSheetsPlanned - generatedSheets)
  
  const targetMachineInfo = findMachineByName(selectedMachine, machines)
  const minLoadCapacity = targetMachineInfo?.min_capacity || 1
  const maxLoadCapacity = targetMachineInfo?.max_capacity || targetMachineInfo?.sheet_capacity || 1
  const safeNomLoadCapacity = Math.min(maxLoadCapacity, Math.max(minLoadCapacity, Number(selectedLoadCapacity) || maxLoadCapacity))
  const plannedRemainingLoads = remainingSheets > 0 ? Math.ceil(remainingSheets / safeNomLoadCapacity) : 0

  const opData = machineOperations?.find(o =>
    String(o.nomenclature_id) === String(partId) &&
    (o.machine_type === selectedMachine || o.machine_id === selectedMachine)
  )

  const cutters = []
  if (opData && opData.side2_cut_ops) {
    const cutterOps = opData.side2_cut_ops.filter(op => op.startsWith('__CUTTER__Reference:') || op.startsWith('__CUTTER__:'))
    cutterOps.forEach(op => {
      const parts = op.split(':')
      const cutterNomId = parts[1]
      const qtyPerSheet = parseFloat(parts[2]) || 0
      if (cutterNomId && qtyPerSheet > 0) {
        const nom = nomenclatures?.find(n => String(n.id) === String(cutterNomId))
        if (nom) {
          cutters.push({
            id: nom.id,
            name: nom.name,
            qtyPerSheet,
            totalNeeded: Math.ceil(remainingSheets * qtyPerSheet)
          })
        }
      }
    })
  }

  const extractCutterDiameter = (name) => {
    const value = String(name || '').toLowerCase()
    const explicit = value.match(/ф\s*([0-9][0-9,.]*)/)
    if (explicit) return Number.parseFloat(explicit[1].replace(',', '.'))
    const dimensions = value.match(/(?:кукурудза|двопера|однопера|спіральна|торцева|шарова|радіусна)?\s*([0-9][0-9,]*)(?:\s*[×xх])/)
    return dimensions ? Number.parseFloat(dimensions[1].replace(',', '.')) : null
  }
  
  const existingCutterSelections = snapshotEntry?.selected_cutters || task.plan_snapshot?.selectedCutters || {}
  
  const getCutterOptions = (cut) => {
    const requiredDiameter = extractCutterDiameter(cut.name)
    const currentSelection = selectedCutterTypes[String(cut.id)]
      || existingCutterSelections[String(cut.id)]
      || existingCutterSelections[cut.name]
      || existingCutterSelections[cut.name.toLowerCase()]
    return (inventory || []).filter(item => {
      const nom = nomenclatures?.find(n => String(n.id) === String(item.nomenclature_id))
      if (!nom || !String(nom.name || '').toLowerCase().startsWith('фреза')) return false
      if (item.type && item.type !== 'consumable') return false
      const available = Math.max(0, (Number(item.total_qty) || 0) - (Number(item.reserved_qty) || 0))
      if (available <= 0 && String(item.id) !== String(currentSelection || '')) return false
      const optionDiameter = extractCutterDiameter(nom.name)
      return requiredDiameter === null || (optionDiameter !== null && Math.abs(optionDiameter - requiredDiameter) < 0.01)
    })
  }
  
  const getSelectedCutterId = (cut) => {
    const val = selectedCutterTypes[String(cut.id)] !== undefined
      ? selectedCutterTypes[String(cut.id)]
      : (existingCutterSelections[String(cut.id)]
        || existingCutterSelections[cut.name]
        || existingCutterSelections[cut.name.toLowerCase()]
        || '')
    const options = getCutterOptions(cut)
    if (val && !options.some(opt => String(opt.id) === String(val))) {
      return ''
    }
    return val
  }
  
  const hasMissingCutterSelection = remainingSheets > 0 && cutters.some(cut => !getSelectedCutterId(cut))

  const handleConfirm = () => {
    const resolvedSelections = {}
    cutters.forEach(cut => { resolvedSelections[String(cut.id)] = getSelectedCutterId(cut) })
    onConfirm(selectedMachine, resolvedSelections, safeNomLoadCapacity)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(15px)', zIndex: 15500, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '10px', overflowY: 'auto' }}>
      <div style={{ background: '#111', width: '100%', maxWidth: '480px', maxHeight: '92vh', overflowY: 'auto', borderRadius: '24px', border: '1px solid #222', padding: '25px 20px', position: 'relative', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
        <button
          onClick={onClose}
          style={{ position: 'absolute', top: '25px', right: '25px', background: '#222', border: 'none', color: '#fff', cursor: 'pointer', width: '35px', height: '35px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <X size={20} />
        </button>

        <h2 style={{ fontSize: '1.3rem', fontWeight: 950, margin: '0 0 10px', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '1px', color: '#fff' }}>⚙️ Зміна верстата для деталі</h2>
        <div style={{ color: '#ef4444', fontWeight: 900, textAlign: 'center', fontSize: '0.85rem', marginBottom: '20px', wordBreak: 'break-all', background: 'rgba(239, 68, 68, 0.05)', padding: '10px', borderRadius: '12px', border: '1px solid rgba(239, 68, 68, 0.1)' }}>
          {partName}
        </div>

        <div style={{ background: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.15)', borderRadius: '14px', padding: '12px 16px', marginBottom: '20px', fontSize: '0.78rem', color: '#a1a1aa' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span>Всього заплановано листів:</span>
            <strong style={{ color: '#fff' }}>{totalSheetsPlanned} л.</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span>Вже згенеровано карт:</span>
            <strong style={{ color: '#fff' }}>{generatedSheets} л.</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #222', paddingTop: '4px', fontWeight: 800 }}>
            <span style={{ color: '#ff9000' }}>Залишилось згенерувати:</span>
            <strong style={{ color: '#ff9000' }}>{remainingSheets} л.</strong>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '30px' }}>
          <div>
            <label style={{ display: 'block', color: '#888', fontSize: '0.65rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '8px' }}>
              Оберіть новий верстат:
            </label>
            <select
              value={selectedMachine}
              onChange={(e) => {
                const nextMachine = e.target.value
                const nextMachineInfo = findMachineByName(nextMachine, machines)
                setSelectedMachine(nextMachine)
                setSelectedLoadCapacity(nextMachineInfo?.max_capacity || nextMachineInfo?.sheet_capacity || 1)
                setSelectedCutterTypes({})
              }}
              style={{ width: '100%', background: '#000', border: '1px solid #333', color: '#fff', padding: '15px', borderRadius: '15px', fontSize: '0.95rem', outline: 'none', fontWeight: 800 }}
            >
              {MACHINE_TYPES.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {remainingSheets > 0 && (
            <div style={{ background: '#09090c', border: '1px solid rgba(255, 144, 0, 0.22)', borderRadius: '16px', padding: '14px 16px' }}>
              <label style={{ display: 'block', color: '#ff9000', fontSize: '0.65rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '8px' }}>
                Листів за одне завантаження ({minLoadCapacity}-{maxLoadCapacity} л.)
              </label>
              <input
                type="number"
                value={selectedLoadCapacity}
                min={minLoadCapacity}
                max={maxLoadCapacity}
                onChange={(event) => setSelectedLoadCapacity(parseInt(event.target.value))}
                onBlur={(event) => {
                  let value = parseInt(event.target.value)
                  if (isNaN(value)) value = maxLoadCapacity
                  value = Math.min(maxLoadCapacity, Math.max(minLoadCapacity, value))
                  setSelectedLoadCapacity(value)
                }}
                style={{ width: '100%', background: '#000', border: '1px solid rgba(255,144,0,.45)', color: '#ff9000', padding: '12px', borderRadius: '12px', fontSize: '1.15rem', fontWeight: 950, textAlign: 'center', outline: 'none' }}
              />
              <div style={{ marginTop: '8px', color: '#777', fontSize: '0.72rem', fontWeight: 800, display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                <span>Зміна тільки для залишку</span>
                <strong style={{ color: '#fff' }}>{plannedRemainingLoads} завант.</strong>
              </div>
            </div>
          )}

          {remainingSheets > 0 && cutters.length > 0 && (
            <div style={{ background: '#09090c', padding: '16px', borderRadius: '16px', border: '1px solid #222' }}>
              <label style={{ display: 'block', color: '#888', fontSize: '0.65rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '10px' }}>
                Дозамовити фрези на СО (під {remainingSheets} листів):
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {cutters.map(cut => {
                  const options = getCutterOptions(cut)
                  const selectedInventoryId = getSelectedCutterId(cut)
                  return (
                    <div key={cut.id} style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '8px 0', borderBottom: '1px solid #181818' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem' }}>
                        <span style={{ color: '#888' }}>{cut.name}</span>
                        <strong style={{ color: '#ff9000' }}>{cut.totalNeeded} шт</strong>
                      </div>
                      <select
                        value={selectedInventoryId}
                        onChange={(event) => setSelectedCutterTypes(prev => ({ ...prev, [String(cut.id)]: event.target.value }))}
                        style={{ width: '100%', background: '#000', border: selectedInventoryId ? '1px solid rgba(255,144,0,.45)' : '1px solid #333', color: '#fff', padding: '10px', borderRadius: '9px', fontSize: '0.74rem', fontWeight: 700 }}
                      >
                        <option value="">— Оберіть конкретну фрезу —</option>
                        {options.map(item => {
                          const nom = nomenclatures?.find(n => String(n.id) === String(item.nomenclature_id))
                          const available = Math.max(0, (Number(item.total_qty) || 0) - (Number(item.reserved_qty) || 0))
                          return <option key={item.id} value={item.id}>{nom?.name || item.name} — вільно {available} шт</option>
                        })}
                        {options.length === 0 && <option value="" disabled>Немає відповідної фрези на складі</option>}
                      </select>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
        
        {hasMissingCutterSelection && (
          <div style={{ color: '#ef4444', fontSize: '0.76rem', fontWeight: 800, textAlign: 'center', background: 'rgba(239, 68, 68, 0.05)', padding: '12px', borderRadius: '14px', border: '1px solid rgba(239, 68, 68, 0.15)', marginBottom: '15px' }}>
            ⚠️ Будь ласка, оберіть конкретну фрезу зі списку для всіх позицій
          </div>
        )}

        <button
          onClick={handleConfirm}
          disabled={isChanging || hasMissingCutterSelection}
          style={{
            width: '100%',
            background: (isChanging || hasMissingCutterSelection) ? '#222' : '#3b82f6',
            color: (isChanging || hasMissingCutterSelection) ? '#555' : '#fff',
            padding: '18px',
            borderRadius: '16px', fontSize: '0.95rem', fontWeight: 950,
            cursor: (isChanging || hasMissingCutterSelection) ? 'not-allowed' : 'pointer',
            border: (isChanging || hasMissingCutterSelection) ? '1px solid #333' : 'none',
            textTransform: 'uppercase', letterSpacing: '1px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
            boxShadow: (isChanging || hasMissingCutterSelection) ? 'none' : '0 10px 20px -5px rgba(59, 130, 246, 0.4)',
            opacity: (isChanging || hasMissingCutterSelection) ? 0.6 : 1
          }}
        >
          {isChanging ? <Loader2 size={16} className="animate-spin" /> : 'ПІДТВЕРДИТИ ЗМІНУ'}
        </button>
      </div>
    </div>
  )
}
