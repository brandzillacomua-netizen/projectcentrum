import React, { useState, useEffect, useMemo } from 'react'
import { X, Printer, Loader2 } from 'lucide-react'
import { calculateCuttersForBatch } from '../../../../utils/cutterCalculator.js'
import { CutterSelectorRow } from './components/CutterSelectorRow.jsx'

export default function GenerateCardsModal({
  config,
  machines,
  nomenclatures,
  machineOperations = [],
  inventory = [],
  workCards,
  materialRequests,
  isGenerating,
  onClose,
  onGenerate
}) {
  const [capacity, setCapacity] = useState(config?.capacityOverride || config?.capacity || 1)
  const [total, setTotal] = useState(config?.count || 1)
  const [machineName, setMachineName] = useState('')
  
  const [customLoadingCapacities, setCustomLoadingCapacities] = useState({})
  const [partialCounts, setPartialCounts] = useState({})
  const [selectedCutters, setSelectedCutters] = useState({})

  useEffect(() => {
    if (config) {
      setMachineName('')
      setTotal(config.count || 1)
      setCapacity(config.capacityOverride || 1)
    }
  }, [config])

  // Simulate per-card sheet distribution (mirrors handleGenerateCards logic)
  const batchCards = useMemo(() => {
    const cap = Number(capacity) || 1
    const cnt = Math.max(1, Number(total) || 1)
    // maxSheetsToGenerate comes from getLoadProgress.remainingSheets which is 0 for brand-new tasks
    // In that case we fall back to part.plannedSheets (total planned sheets for this part)
    const maxSheets = Number(config?.maxSheetsToGenerate) > 0
      ? Number(config.maxSheetsToGenerate)
      : null
    const partSheets = Number(config?.part?.plannedSheets) > 0
      ? Number(config.part.plannedSheets)
      : null
    // Determine the cap on total sheets for this batch
    let remainingSheets = maxSheets !== null ? maxSheets : (partSheets !== null ? partSheets : cnt * cap)

    const cards = []
    for (let i = 0; i < cnt; i++) {
      const sheetsInThisCard = Math.min(remainingSheets, cap)
      if (sheetsInThisCard <= 0) break
      cards.push(sheetsInThisCard)
      remainingSheets -= sheetsInThisCard
    }
    return cards
  }, [config, total, capacity])

  const actualTotalSheets = useMemo(() => batchCards.reduce((s, v) => s + v, 0), [batchCards])

  // Live cutter calculation for this batch
  const cutterRows = useMemo(() => {
    if (!config || !config.part?.nom) return []
    return calculateCuttersForBatch({
      partNom: config.part.nom,
      machineName,
      sheets: actualTotalSheets,
      task: config.task,
      machineOperations,
      nomenclatures,
      inventory
    })
  }, [config, actualTotalSheets, machineName, machineOperations, nomenclatures, inventory])

  const extractCutterDiameter = (nameStr) => {
    if (!nameStr) return null
    const s = String(nameStr).toLowerCase()

    const fMatch = s.match(/ф\s*(\d+(?:[.,]\d+)?)/)
    if (fMatch) return fMatch[1].replace(',', '.')

    const mmMatch = s.match(/(\d+(?:[.,]\d+)?)\s*мм/)
    if (mmMatch) return mmMatch[1].replace(',', '.')

    const dimMatch = s.match(/(\d+(?:[.,]\d+)?)\s*[хx]/)
    if (dimMatch) return dimMatch[1].replace(',', '.')

    return null
  }

  // Helper to find specific cutter nomenclatures matching a diameter category
  const getMatchingCutters = (categoryName, noms = [], inv = []) => {
    const targetDia = extractCutterDiameter(categoryName)

    const cutterNoms = (noms || []).filter(n => {
      const nLower = (n.name || '').toLowerCase()
      return nLower.includes('фрез')
    })

    const getStock = (nomId) => {
      const item = (inv || []).find(i => (i.warehouse === 'operational' || !i.warehouse) && String(i.nomenclature_id) === String(nomId))
      return item ? Math.max(0, (Number(item.total_qty) || 0) - (Number(item.reserved_qty) || 0)) : 0
    }

    const matching = []
    const others = []

    cutterNoms.forEach(n => {
      const dia = extractCutterDiameter(n.name)
      if (targetDia && dia === targetDia) {
        matching.push(n)
      } else {
        others.push(n)
      }
    })

    matching.sort((a, b) => getStock(b.id) - getStock(a.id))
    others.sort((a, b) => getStock(b.id) - getStock(a.id))

    return { matching, others, targetDia }
  }

  // Pre-select matching cutters when cutterRows calculate
  useEffect(() => {
    if (cutterRows.length > 0) {
      setSelectedCutters(prev => {
        const next = { ...prev }
        let updated = false
        cutterRows.forEach(cutter => {
          const cutterKey = String(cutter.nomenclature_id || cutter.name)
          if (!next[cutterKey] && !next[cutter.name]) {
            const { matching, others } = getMatchingCutters(cutter.name, nomenclatures, inventory)
            const pool = matching.length > 0 ? matching : others
            if (pool.length > 0) {
              const defaultChoice = pool[0]
              if (defaultChoice) {
                next[cutterKey] = String(defaultChoice.id)
                next[cutter.name] = String(defaultChoice.id)
                next[cutter.name.toLowerCase()] = String(defaultChoice.id)
                updated = true
              }
            }
          }
        })
        return updated ? next : prev
      })
    }
  }, [cutterRows, nomenclatures, inventory])

  if (!config) return null

  const { task, part, isRepair } = config

  const findMachine = (mName) => {
    const baseName = (mName || '').split(' №')[0].trim()
    return machines.find(m => m.name === baseName) || machines.find(m => m.name === mName)
  }

  const getRequestQty = (req) => {
    return Number(req.qty) || Number(req.quantity) || 0
  }

  const MACHINE_TYPES = [...new Set(machines.map(m => m.name))]

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={onClose}>
      <div style={{ background: '#111', width: '100%', maxWidth: '600px', borderRadius: '24px', padding: '40px', position: 'relative', border: '1px solid #222', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <button
          onClick={onClose}
          style={{ position: 'absolute', top: '25px', right: '25px', background: '#222', border: 'none', color: '#fff', cursor: 'pointer', width: '35px', height: '35px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <X size={20} />
        </button>

        <h2 style={{ fontSize: '1.5rem', fontWeight: 950, margin: '0 0 10px', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '1px', color: isRepair ? '#f97316' : '#fff' }}>{isRepair ? '🔄 ДОВИПУСК' : 'Генерація карток'}</h2>
        <p style={{ color: '#555', textAlign: 'center', fontSize: '0.9rem', marginBottom: isRepair ? '10px' : '30px' }}>{part.nom?.name || part.name}</p>
        {isRepair && (
          <div style={{ background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.3)', borderRadius: '12px', padding: '10px 16px', marginBottom: '20px', fontSize: '0.72rem', color: '#f97316', fontWeight: 800, textAlign: 'center' }}>
            ⚠️ Для цієї деталі вже є картки. Нові картки будуть позначені як <strong>ДОВИПУСК</strong> (is_rework = true)
          </div>
        )}

        {part.isSplitMode ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div style={{ fontSize: '0.7rem', color: '#444', fontWeight: 900, marginBottom: '5px' }}>ОБЕРІТЬ ПАРТІЮ ДЛЯ ДРУКУ:</div>
            {(() => {
              const globalTotalLoadings = (part.splits || []).reduce((acc, s) => {
                const cap = findMachine(s.machine)?.sheet_capacity || 1
                const unitsPerSheet = part.unitsPerSheet || 1
                const sSheets = Number(s.sheets) || Math.ceil((s.qty || 0) / unitsPerSheet)
                return acc + Math.ceil(sSheets / cap)
              }, 0)

              let currentGlobalOffset = 0
              const existingNomenclatureCards = (workCards || []).filter(wc =>
                String(wc.task_id) === String(task.id) &&
                String(wc.nomenclature_id) === String(part.nomId)
              )

              return (part.splits || []).map((split, sIdx) => {
                const cap = findMachine(split.machine)?.sheet_capacity || 1
                const unitsPerSheet = part.unitsPerSheet || 1
                const splitSheets = Number(split.sheets) || Math.ceil((split.qty || 0) / unitsPerSheet)
                const capacityKey = `${part.nomId}_${sIdx}_cap`
                const currentCapacity = customLoadingCapacities[capacityKey] ?? cap
                const splitLoadings = Math.ceil(splitSheets / currentCapacity)
                const splitQty = split.qty || (splitSheets * unitsPerSheet)

                const machineCards = existingNomenclatureCards
                  .filter(wc => wc.machine === split.machine)
                  .sort((a, b) => a.id - b.id)

                const prevSplitsSameMachine = part.splits.slice(0, sIdx).filter(s => s.machine === split.machine)
                const sheetsSkipped = prevSplitsSameMachine.reduce((sum, s) => {
                  const sSheets = Number(s.sheets) || Math.ceil((s.qty || 0) / unitsPerSheet)
                  return sum + sSheets
                }, 0)

                let sheetsUsedInThisSplit = 0
                let cardsBelongingToThisSplitCount = 0
                let currentGlobalSheets = 0

                machineCards.forEach(wc => {
                  const cardSheets = Math.ceil((Number(wc.quantity) || 0) / unitsPerSheet)
                  const cardStart = currentGlobalSheets
                  const cardEnd = currentGlobalSheets + cardSheets

                  const splitStart = sheetsSkipped
                  const splitEnd = sheetsSkipped + splitSheets

                  if (cardEnd > splitStart && cardStart < splitEnd) {
                    cardsBelongingToThisSplitCount++
                    sheetsUsedInThisSplit += cardSheets
                  }

                  currentGlobalSheets += cardSheets
                })

                const getKittingSheets = (taskObj, partNom) => {
                  const snapMat = (taskObj.plan_snapshot || {})[String(partNom?.id)]?.material;
                  const baseMat = snapMat || partNom?.material_type || ''
                  const taskReqs = (materialRequests || []).filter(r => String(r.task_id) === String(taskObj.id))
                  const extractThickness = (str) => {
                    const match = str.match(/(\d+(?:\.\d+)?)\s*мм/)
                    return match ? match[1] + 'мм' : null
                  }
                  const baseThickness = extractThickness(baseMat)
                  const sheetReqs = taskReqs.filter(r => {
                    const rNom = nomenclatures.find(n => n.id === r.nomenclature_id)
                    const rName = rNom?.name || r.details || ''
                    const lowerName = rName.toLowerCase()
                    const isSheet = lowerName.includes('лист') || lowerName.includes('sheet')
                    if (!isSheet) return false
                    const reqThickness = extractThickness(lowerName)
                    if (baseThickness && reqThickness) {
                      return baseThickness === reqThickness
                    }
                    const activeMaterials = baseMat.split('+').map(m => m.trim().toLowerCase())
                    return activeMaterials.some(act => lowerName.includes(act) || act.includes(lowerName))
                  })
                  const issued = sheetReqs.filter(r => r.status === 'issued' || r.status === 'completed')
                    .reduce((sum, r) => sum + getRequestQty(r), 0)
                  const pending = sheetReqs.filter(r => r.status === 'pending')
                    .reduce((sum, r) => sum + getRequestQty(r), 0)
                  const materialRequiresSheets = /(?:т|t)\s*(?:300|700)|лист|sheet/i.test(baseMat)
                  return { issuedSheets: issued, pendingSheets: pending, hasKittingReqs: materialRequiresSheets || sheetReqs.length > 0 }
                }

                const { issuedSheets, pendingSheets, hasKittingReqs } = getKittingSheets(task, part.nom)
                const generatedCount = cardsBelongingToThisSplitCount
                const isGenerated = sheetsUsedInThisSplit >= splitSheets
                const remainingCount = Math.max(0, splitLoadings - generatedCount)

                const maxAllowedToGen = hasKittingReqs 
                  ? Math.min(remainingCount, Math.floor(Math.max(0, issuedSheets - sheetsUsedInThisSplit) / currentCapacity))
                  : remainingCount
                const isKittingBlocked = hasKittingReqs && maxAllowedToGen <= 0

                const splitGlobalOffsetForThisMachine = currentGlobalOffset
                currentGlobalOffset += splitLoadings
                const toGen = Math.min(maxAllowedToGen, partialCounts[`${part.nomId}_${sIdx}`] ?? remainingCount)

                return (
                  <div key={sIdx} style={{ background: '#080808', padding: '15px', borderRadius: '16px', border: isGenerated ? '1px solid #10b98133' : '1px solid #1a1a1a', display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: isGenerated ? 0.8 : 1 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ fontWeight: 900, color: isGenerated ? '#10b981' : '#fff', fontSize: '0.9rem' }}>{split.machine || '—'}</div>
                        <span style={{ fontSize: '0.65rem', background: isGenerated ? '#10b98133' : '#222', color: isGenerated ? '#10b981' : '#888', padding: '2px 8px', borderRadius: '6px', fontWeight: 900 }}>
                          {generatedCount} / {splitLoadings} КАРТ.
                        </span>
                      </div>
                      <div style={{ fontSize: '0.65rem', color: '#555', marginTop: '4px' }}>
                        Листів: {splitSheets} | Деталей: {splitQty}
                      </div>
                      {(() => {
                        if (isGenerated) {
                          return <div style={{ fontSize: '0.55rem', color: '#10b981', marginTop: '2px', fontWeight: 900 }}>Всі карти згенеровано ✅</div>
                        }
                        if (!hasKittingReqs) return null;
                        if (issuedSheets === 0) {
                          return (
                            <div style={{ fontSize: '0.6rem', color: '#ef4444', fontWeight: 900, marginTop: '4px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', padding: '2px 6px', borderRadius: '4px', display: 'inline-block' }}>
                              ⚠️ Очікуємо погодження складу (немає листів)
                            </div>
                          )
                        }
                        if (pendingSheets > 0) {
                          return (
                            <div style={{ fontSize: '0.6rem', color: '#eab308', fontWeight: 900, marginTop: '4px', background: 'rgba(234,179,8,0.06)', border: '1px solid rgba(234,179,8,0.15)', padding: '2px 6px', borderRadius: '4px', display: 'inline-block' }}>
                              ⏳ Видано: {issuedSheets} л. | Очікуємо видачу {pendingSheets} листів з СО
                            </div>
                          )
                        }
                        return (
                          <div style={{ fontSize: '0.6rem', color: '#10b981', fontWeight: 900, marginTop: '4px', background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)', padding: '2px 6px', borderRadius: '4px', display: 'inline-block' }}>
                            ✅ ГОТОВО ДО ЗАПУСКУ ({issuedSheets} л. видано)
                          </div>
                        )
                      })()}
                    </div>

                    {!isGenerated && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                          <span style={{ fontSize: '0.55rem', color: '#ff9000', fontWeight: 900 }}>ЗАГРУЗКА</span>
                          <input
                            type="number"
                            min="1"
                            max={splitSheets}
                            value={currentCapacity}
                            onChange={(e) => {
                              const val = Math.max(1, parseInt(e.target.value) || 1)
                              setCustomLoadingCapacities(prev => ({ ...prev, [capacityKey]: val }))
                            }}
                            style={{ width: '45px', background: '#000', border: '1px solid rgba(255,144,0,0.4)', color: '#ff9000', textAlign: 'center', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 900, padding: '4px 0' }}
                            title="Кількість листів на одну загрузку (картку)"
                          />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                          <span style={{ fontSize: '0.55rem', color: '#444', fontWeight: 900 }}>ДРУК</span>
                          <input
                            type="number"
                            min="1"
                            max={remainingCount}
                            value={toGen}
                            onChange={(e) => {
                              const val = Math.min(remainingCount, Math.max(1, parseInt(e.target.value) || 1))
                              setPartialCounts(prev => ({ ...prev, [`${part.nomId}_${sIdx}`]: val }))
                            }}
                            style={{ width: '45px', background: '#000', border: '1px solid #333', color: '#fff', textAlign: 'center', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 900, padding: '4px 0' }}
                          />
                        </div>
                        <button
                          disabled={isGenerating || isKittingBlocked}
                          onClick={() => {
                            const finalToGen = Math.min(toGen, remainingCount)
                            if (finalToGen <= 0) return

                            onGenerate(
                              task,
                              part,
                              splitSheets,
                              split.machine,
                              finalToGen,
                              generatedCount,
                              splitQty,
                              isRepair,
                              globalTotalLoadings,
                              splitGlobalOffsetForThisMachine,
                              currentCapacity
                            )
                          }}
                          style={{ 
                            background: isGenerating ? '#333' : (isKittingBlocked ? '#1e1b18' : '#10b981'), 
                            color: isKittingBlocked ? '#7f1d1d' : '#fff', 
                            border: isKittingBlocked ? '1px solid rgba(239,68,68,0.2)' : 'none',
                            padding: '10px 15px', 
                            borderRadius: '10px', 
                            fontSize: '0.7rem', 
                            fontWeight: 950, 
                            cursor: (isGenerating || isKittingBlocked) ? 'not-allowed' : 'pointer', 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '5px', 
                            pointerEvents: (isGenerating || isKittingBlocked) ? 'none' : 'auto' 
                          }}
                        >
                          {isGenerating ? <Loader2 size={12} className="animate-spin" /> : <Printer size={12} />}
                          {isGenerating ? 'ОБРОБКА...' : (isKittingBlocked ? 'НЕМАЄ ЛИСТІВ' : 'ГЕНЕРУВАТИ')}</button>
                      </div>
                    )}
                    {isGenerated && (
                      <div style={{ color: '#444', fontSize: '0.7rem', fontWeight: 800 }}>ГОТОВО</div>
                    )}
                  </div>
                )
              })
            })()}
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '30px' }}>
              <div>
                <label style={{ display: 'block', color: machineName ? '#888' : '#eab308', fontSize: '0.65rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '8px' }}>
                  {machineName ? 'Оберіть верстат для цієї партії:' : '⚠️ Оберіть верстат зі списку:'}
                </label>
                <select
                  value={machineName}
                  onChange={(e) => {
                    const newMachineName = e.target.value
                    const resolvedMachine = findMachine(newMachineName)
                    const newCapacity = Number(resolvedMachine?.sheet_capacity) || 1
                    setMachineName(newMachineName)
                    setCapacity(newCapacity)
                  }}
                  style={{ width: '100%', background: '#000', border: machineName ? '1px solid #10b981' : '1px solid #eab308', color: machineName ? '#fff' : '#eab308', padding: '15px', borderRadius: '15px', fontSize: '0.95rem', outline: 'none', fontWeight: 800 }}
                >
                  <option value="">-- Оберіть верстат --</option>
                  {MACHINE_TYPES.map(t => {
                    const cap = findMachine(t)?.sheet_capacity || 1
                    return (
                      <option key={t} value={t}>{t} (місткість за замовчуванням: {cap} л.)</option>
                    )
                  })}
                </select>
              </div>

              {!isRepair && (
                <div style={{ background: '#080808', padding: '18px', borderRadius: '20px', border: '1px solid #1a1a1a' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <span style={{ color: '#555', fontSize: '0.75rem', fontWeight: 800 }}>ПРОГРЕС ВИПУСКУ:</span>
                    <span style={{ color: '#3b82f6', fontSize: '0.75rem', fontWeight: 900 }}>
                      Згенеровано {part.productionCards?.length || 0} з {config.targetTotal || (total + (part.productionCards?.length || 0))} карт.
                    </span>
                  </div>
                  <div style={{ height: '6px', background: '#1a1a1a', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(100, ((part.productionCards?.length || 0) / (config.targetTotal || (total + (part.productionCards?.length || 0)))) * 100)}%`, height: '100%', background: '#3b82f6', transition: '0.3s' }} />
                  </div>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div>
                  <label style={{ display: 'block', color: '#ff9000', fontSize: '0.65rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '8px', textAlign: 'center' }}>
                    Місткість (листів / картка):
                  </label>
                  <input
                    type="number"
                    value={capacity}
                    onChange={(e) => {
                      const newCap = parseInt(e.target.value);
                      const m = findMachine(machineName);
                      const minC = m?.min_capacity || 1;
                      const maxC = m?.max_capacity || m?.sheet_capacity || 99;
                      setCapacity(isNaN(newCap) ? '' : Math.min(maxC, Math.max(minC, newCap)));
                    }}
                    onBlur={(e) => {
                      const m = findMachine(machineName);
                      const minC = m?.min_capacity || 1;
                      const maxC = m?.max_capacity || m?.sheet_capacity || 99;
                      let v = parseInt(e.target.value);
                      if (isNaN(v)) v = minC;
                      else v = Math.min(maxC, Math.max(minC, v));
                      setCapacity(v);
                    }}
                    min="1"
                    style={{ width: '100%', background: '#000', border: '1px solid rgba(255,144,0,0.5)', color: '#ff9000', fontSize: '1.5rem', fontWeight: 950, textAlign: 'center', padding: '10px', borderRadius: '15px', outline: 'none' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', color: '#10b981', fontSize: '0.65rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '8px', textAlign: 'center' }}>
                    Кількість карт партії:
                  </label>
                  <input
                    type="number"
                    value={total}
                    onChange={(e) => {
                      const val = Math.max(1, parseInt(e.target.value) || 1)
                      setTotal(val)
                    }}
                    min="1"
                    style={{ width: '100%', background: '#000', border: '1px solid #10b98150', color: '#fff', fontSize: '1.5rem', fontWeight: 950, textAlign: 'center', padding: '10px', borderRadius: '15px', outline: 'none' }}
                  />
                </div>
              </div>

              {/* Розрахунок матеріалів для порції */}
              <div style={{ background: '#090909', border: '1px solid #1e293b', borderRadius: '18px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  📦 РОЗРАХУНОК ДЛЯ СКЛАДУ ОПЕРАТИВНОГО (КИТТИНГ):
                </div>

                {!machineName ? (
                  <div style={{ fontSize: '0.78rem', color: '#eab308', padding: '12px 14px', background: 'rgba(234, 179, 8, 0.08)', borderRadius: '10px', border: '1px solid rgba(234, 179, 8, 0.2)', textAlign: 'center', fontWeight: 800 }}>
                    ⚠️ Оберіть верстат зі списку вище, щоб розрахувати листи та необхідні фрези
                  </div>
                ) : (
                  <>
                    {/* Листи — розкладка по картках */}
                    {batchCards.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {batchCards.map((sh, idx) => (
                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', padding: '5px 10px', background: '#0d1117', borderRadius: '8px', border: '1px solid #1a2435' }}>
                            <span style={{ color: '#888' }}>📄 Картка {idx + 1}:</span>
                            <span style={{ color: sh < (Number(capacity) || 1) ? '#eab308' : '#fff', fontWeight: 950 }}>{sh} л.{sh < (Number(capacity) || 1) ? ' ⚡ останній залишок' : ''}</span>
                          </div>
                        ))}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', padding: '7px 10px', background: '#0a0a18', borderRadius: '10px', border: '1px solid #1e293b', marginTop: '2px' }}>
                          <span style={{ color: '#38bdf8', fontWeight: 900 }}>📦 ВСЬОГО ЛИСТІВ:</span>
                          <span style={{ color: '#fff', fontWeight: 950 }}>{actualTotalSheets} л.</span>
                        </div>
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.75rem', color: '#ef4444', padding: '6px 10px', background: 'rgba(239,68,68,0.06)', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.2)' }}>Немає залишку листів для генерації</div>
                    )}

                    {/* Фрези */}
                    {cutterRows.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
                        <div style={{ fontSize: '0.62rem', color: '#888', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '2px' }}>
                          ✂️ ФРЕЗИ ДЛЯ ПАРТІЇ (ОБЕРІТЬ МОДЕЛЬ ФРЕЗИ):
                        </div>
                        {cutterRows.map((cutter, idx) => {
                          const cutterKey = String(cutter.nomenclature_id || cutter.name)
                          const categoryName = cutter.name
                          const selectedNomId = selectedCutters[cutterKey] || selectedCutters[categoryName] || selectedCutters[categoryName.toLowerCase()] || ''

                          return (
                            <CutterSelectorRow
                              key={idx}
                              cutter={cutter}
                              nomenclatures={nomenclatures}
                              inventory={inventory}
                              selectedNomId={selectedNomId}
                              getMatchingCutters={getMatchingCutters}
                              onSelectCutter={(key, name, val) => {
                                setSelectedCutters(prev => ({
                                  ...prev,
                                  [key]: val,
                                  [name]: val,
                                  [name.toLowerCase()]: val
                                }))
                              }}
                            />
                          )
                        })}
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.7rem', color: '#555', fontStyle: 'italic', textAlign: 'center', padding: '4px 0' }}>Фрези не визначено в плані обробки</div>
                    )}
                  </>
                )}

                <div style={{ fontSize: '0.65rem', color: '#eab308', background: 'rgba(234, 179, 8, 0.08)', padding: '8px 12px', borderRadius: '10px', border: '1px solid rgba(234, 179, 8, 0.2)', marginTop: '2px' }}>
                  ⏳ Запит на листи та фрези відправиться на Склад. Картки з'являться в Цеху №1 одразу після підтвердження складом!
                </div>
              </div>
            </div>

            <button
              disabled={isGenerating || !machineName}
              onClick={() => {
                if (!machineName) {
                  alert('Будь ласка, спочатку оберіть верстат!')
                  return
                }
                if (total > 0) {
                  onGenerate(
                    task,
                    part,
                    part.plannedSheets,
                    machineName,
                    total,
                    part.productionCards?.length || 0,
                    part.plan,
                    isRepair,
                    null,
                    0,
                    capacity,
                    // Pass null when maxSheetsToGenerate is 0 (new task, no cards yet),
                    // so handleGenerateCards doesn't cap sheetsRemaining to 0
                    Number(config.maxSheetsToGenerate) > 0 ? config.maxSheetsToGenerate : null,
                    null,
                    selectedCutters
                  )
                }
              }}
              style={{
                width: '100%',
                background: machineName ? '#10b981' : '#222',
                color: machineName ? '#fff' : '#666',
                padding: '20px',
                borderRadius: '20px',
                fontSize: '1rem',
                fontWeight: 950,
                cursor: (isGenerating || !machineName) ? 'not-allowed' : 'pointer',
                border: machineName ? 'none' : '1px solid #333',
                textTransform: 'uppercase',
                letterSpacing: '1px',
                boxShadow: machineName ? '0 10px 20px -5px rgba(16, 185, 129, 0.4)' : 'none',
                opacity: (isGenerating || !machineName) ? 0.5 : 1
              }}
            >
              {isGenerating ? 'ОБРОБКА ТА СТВОРЕННЯ ЗАПИТУ...' : (machineName ? 'ПІДТВЕРДИТИ ТА ЗГЕНЕРУВАТИ ПАРТІЮ' : 'ОБЕРІТЬ ВЕРСТАТ ДЛЯ ПРОДОВЖЕННЯ')}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
