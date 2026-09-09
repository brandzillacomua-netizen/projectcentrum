import React, { useState, useEffect, useMemo } from 'react'
import { X, Printer, Loader2 } from 'lucide-react'
import { calculateCuttersForBatch } from '../../../../utils/cutterCalculator.js'
import { CutterSelectorRow } from './components/CutterSelectorRow.jsx'
import { useMES } from '../../../../MESContext.jsx'

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
  const { task, part, isRepair } = config || {}
  const mes = useMES?.() || {}
  const isLight = mes.theme === 'light' || (typeof document !== 'undefined' && (document.body.classList.contains('light-theme') || document.documentElement.classList.contains('light-theme')))

  const findMachine = (mName) => {
    const baseName = (mName || '').split(' №')[0].trim()
    return machines.find(m => m.name === baseName) || machines.find(m => m.name === mName)
  }

  const getRequestQty = (req) => {
    return Number(req.qty) || Number(req.quantity) || 0
  }

  const getKittingSheets = (taskObj, partNom) => {
    if (!taskObj || !partNom) return { issuedSheets: 0, pendingSheets: 0, hasKittingReqs: false }
    const snapPart = (taskObj?.plan_snapshot || {})[String(partNom?.id)] || {}
    const snapMat = snapPart?.material
    const baseMat = snapMat || partNom?.material_type || ''
    const partName = partNom?.name || snapPart?.name || ''
    const partCode = partNom?.code || snapPart?.code || ''

    // Match material requests for this task OR the parent order (tasks under same order share raw sheet requests)
    const taskReqs = (materialRequests || []).filter(r => 
      String(r.task_id) === String(taskObj?.id) ||
      (r.order_id && taskObj?.order_id && String(r.order_id) === String(taskObj?.order_id))
    )

    const extractThickness = (str) => {
      const match = String(str || '').match(/(\d+(?:[.,]\d+)?)\s*мм/)
      return match ? parseFloat(match[1].replace(',', '.')) : null
    }
    const extractGrade = (str) => {
      const match = String(str || '').toLowerCase().match(/[tт]\s*(300|700)/)
      return match ? match[1] : null
    }
    const baseThickness = extractThickness(baseMat)
    let baseGrade = extractGrade(baseMat)
    // If the task specifically allocated T700 or T300 sheets for this part, use that grade
    if (Number(snapPart?.sheets_t700) > 0 && !Number(snapPart?.sheets_t300)) {
      baseGrade = '700'
    } else if (Number(snapPart?.sheets_t300) > 0 && !Number(snapPart?.sheets_t700)) {
      baseGrade = '300'
    }

    const matchesBaseMaterial = (candidate, reqObj) => {
      // 1. Direct explicit mention in request details: e.g. "(Для: Київ К-ІП9...: 100шт)"
      if (reqObj?.details) {
        if (partName && reqObj.details.includes(partName)) return true
        if (partCode && reqObj.details.includes(partCode)) return true
      }

      const candidateLower = String(candidate || '').toLowerCase()
      const candidateThickness = extractThickness(candidateLower)
      const candidateGrade = extractGrade(candidateLower)
      if (baseThickness !== null && candidateThickness !== null && baseThickness !== candidateThickness) return false
      if (baseGrade !== null && candidateGrade !== null && baseGrade !== candidateGrade) return false
      if (baseThickness !== null && candidateThickness !== null) return true
      const activeMaterials = baseMat.split('+').map(m => m.trim().toLowerCase()).filter(Boolean)
      return activeMaterials.some(act => candidateLower.includes(act) || act.includes(candidateLower))
    }

    const sheetReqs = taskReqs.filter(r => {
      const rNom = (nomenclatures || []).find(n => n.id === r.nomenclature_id)
      const rName = `${rNom?.name || ''} ${rNom?.material_type || ''} ${r.details || ''}`
      const lowerName = rName.toLowerCase()
      const isSheet = lowerName.includes('лист') || lowerName.includes('sheet')
      if (!isSheet) return false
      return matchesBaseMaterial(lowerName, r)
    })
    const issued = sheetReqs.filter(r => r.status === 'issued' || r.status === 'completed')
      .reduce((sum, r) => sum + getRequestQty(r), 0)
    const pending = sheetReqs.filter(r => r.status === 'pending')
      .reduce((sum, r) => sum + getRequestQty(r), 0)

    // Sheets already used by OTHER parts in this same task that share this sheet material
    const usedByOtherPartsAcrossTask = (workCards || []).filter(card => {
      if (String(card.task_id) !== String(taskObj?.id) || card.is_rework) return false
      if (String(card.nomenclature_id) === String(partNom?.id)) return false
      const operation = String(card.operation || '').toLowerCase()
      if (operation === 'склад бз' || operation.includes('склад bz')) return false
      const cardNom = (nomenclatures || []).find(n => String(n.id) === String(card.nomenclature_id))
      const cardEntry = (taskObj?.plan_snapshot || {})[String(card.nomenclature_id)]
      return matchesBaseMaterial(cardEntry?.material || cardNom?.material_type || cardNom?.name || '')
    }).reduce((sum, card) => {
      const cardNom = (nomenclatures || []).find(n => String(n.id) === String(card.nomenclature_id))
      const cardEntry = (taskObj?.plan_snapshot || {})[String(card.nomenclature_id)]
      const unitsPerSheet = Math.max(1, Number(cardNom?.units_per_sheet) || Number(cardEntry?.units_per_sheet) || 1)
      const cardSheets = Number(card.actualSheets || card.sheets)
      return sum + (cardSheets > 0 ? cardSheets : Math.ceil((Number(card.quantity) || 0) / unitsPerSheet))
    }, 0)

    const materialRequiresSheets = /(?:т|t)\s*(?:300|700)|лист|sheet/i.test(baseMat)
    return {
      issuedSheets: issued,
      pendingSheets: pending,
      usedByOtherPartsAcrossTask,
      hasKittingReqs: materialRequiresSheets || sheetReqs.length > 0
    }
  }

  const singleKitting = useMemo(() => {
    if (!task || !part?.nom || isRepair) return { issuedSheets: 0, pendingSheets: 0, usedByOtherPartsAcrossTask: 0, hasKittingReqs: false }
    return getKittingSheets(task, part.nom)
  }, [task, part, materialRequests, nomenclatures, workCards, isRepair])

  const alreadyGeneratedSheets = useMemo(() => {
    if (!part) return 0
    const unitsPerSheet = Math.max(1, Number(part?.unitsPerSheet) || 1)
    return (part?.productionCards || []).reduce((sum, c) => {
      const cardSheets = Number(c.actualSheets || c.sheets)
      return sum + (cardSheets > 0 ? cardSheets : Math.ceil((Number(c.quantity) || 0) / unitsPerSheet))
    }, 0)
  }, [part])

  const effectivePartSheets = Number(part?.plannedSheets) > 0
    ? Number(part.plannedSheets)
    : Math.ceil((Number(part?.plan) || Number(part?.need) || 0) / Math.max(1, Number(part?.unitsPerSheet) || 1))

  const remainingPlannedSheets = Number(config?.maxSheetsToGenerate) > 0
    ? Number(config.maxSheetsToGenerate)
    : Math.max(0, effectivePartSheets - alreadyGeneratedSheets)

  const poolIssuedRemaining = Math.max(0, singleKitting.issuedSheets - (singleKitting.usedByOtherPartsAcrossTask || 0) - alreadyGeneratedSheets)

  // A single part can NEVER consume more than its own remaining planned sheets, even if the warehouse issued extra for the whole task
  const targetSheets = remainingPlannedSheets

  const [capacity, setCapacity] = useState(config?.capacityOverride || config?.capacity || 1)
  const [total, setTotal] = useState(config?.count || 1)
  const [machineName, setMachineName] = useState('')
  
  const [customLoadingCapacities, setCustomLoadingCapacities] = useState({})
  const [partialCounts, setPartialCounts] = useState({})
  const [selectedCutters, setSelectedCutters] = useState({})

  useEffect(() => {
    if (config) {
      setMachineName('')
      setSelectedCutters({})
      const cap = config.capacityOverride || 1
      setCapacity(cap)
      const rec = Math.max(1, Math.ceil((targetSheets || 1) / cap))
      setTotal(config.count > 1 ? config.count : rec)
    }
  }, [config])

  // Recalculate total cards when targetSheets changes
  useEffect(() => {
    if (targetSheets > 0 && capacity > 0) {
      setTotal(Math.max(1, Math.ceil(targetSheets / (Number(capacity) || 1))))
    }
  }, [targetSheets])

  // Simulate per-card sheet distribution using targetSheets
  const batchCards = useMemo(() => {
    const cap = Number(capacity) || 1
    const cnt = Math.max(1, Number(total) || 1)
    let remainingSheets = targetSheets

    const cards = []
    for (let i = 0; i < cnt; i++) {
      const sheetsInThisCard = Math.min(remainingSheets, cap)
      if (sheetsInThisCard <= 0) break
      cards.push(sheetsInThisCard)
      remainingSheets -= sheetsInThisCard
    }
    return cards
  }, [targetSheets, total, capacity])

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

  const getMatchingCutters = (categoryName, noms = [], inv = [], cutterTypeId = null) => {
    const targetDia = extractCutterDiameter(categoryName)

    const cutterNoms = (noms || []).filter(n => {
      if (n.type === 'cutter_type') return false
      const nLower = (n.name || '').toLowerCase()
      if (nLower.startsWith('тип ф') || nLower.startsWith('тип f')) return false
      // Must contain 'фрез' in name — consumable alone is not enough (screws, bolts, etc. are also consumable)
      return nLower.includes('фрез')
    })

    const getStock = (nomId, nomName) => {
      // Only look at explicitly operational warehouse rows (exclude null/pocket/etc)
      const opItems = (inv || []).filter(i => {
        const w = (i.warehouse || '').toLowerCase().trim()
        const isOp = w === 'operational' || w === 'склад оперативний'
        if (!isOp) return false
        const idMatch = nomId && String(i.nomenclature_id) === String(nomId)
        const nameMatch = nomName && i.name && i.name.trim().toLowerCase() === String(nomName).trim().toLowerCase()
        return idMatch || nameMatch
      })
      if (opItems.length > 0) {
        return Math.max(0, opItems.reduce((sum, item) => sum + (Number(item.total_qty) || 0) - (Number(item.reserved_qty) || 0), 0))
      }
      return 0
    }

    const matching = []
    const others = []

    cutterNoms.forEach(n => {
      if (cutterTypeId && String(n.characteristic) === String(cutterTypeId)) {
        matching.push(n)
        return
      }
      const dia = extractCutterDiameter(n.name)
      if (targetDia && dia === targetDia) {
        matching.push(n)
      } else {
        others.push(n)
      }
    })

    matching.sort((a, b) => getStock(b.id, b.name) - getStock(a.id, a.name))
    others.sort((a, b) => getStock(b.id, b.name) - getStock(a.id, a.name))

    return { matching, others, targetDia }
  }

  const unselectedCuttersCount = useMemo(() => {
    return (cutterRows || []).filter(cutter => {
      const cutterKey = String(cutter.nomenclature_id || cutter.name)
      const categoryName = cutter.name
      const selected = selectedCutters[cutterKey] || selectedCutters[categoryName] || selectedCutters[categoryName.toLowerCase()]
      return !selected
    }).length
  }, [cutterRows, selectedCutters])

  const hasUnselectedCutters = (cutterRows || []).length > 0 && unselectedCuttersCount > 0

  const isSingleKittingBlocked = false

  const MACHINE_TYPES = [...new Set((machines || []).map(m => m.name))]

  if (!config || !part) return null

  return (
    <div style={{ position: 'fixed', inset: 0, background: isLight ? 'rgba(15,23,42,0.45)' : 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={onClose}>
      <div style={{ background: isLight ? '#ffffff' : '#111', width: '100%', maxWidth: '600px', borderRadius: '24px', padding: '40px', position: 'relative', border: isLight ? '1px solid #cbd5e1' : '1px solid #222', boxShadow: isLight ? '0 25px 50px -12px rgba(0,0,0,0.18)' : '0 25px 50px -12px rgba(0,0,0,0.5)', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <button
          onClick={onClose}
          style={{ position: 'absolute', top: '25px', right: '25px', background: isLight ? '#e2e8f0' : '#222', border: 'none', color: isLight ? '#0f172a' : '#fff', cursor: 'pointer', width: '35px', height: '35px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <X size={20} />
        </button>

        <h2 style={{ fontSize: '1.5rem', fontWeight: 950, margin: '0 0 10px', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '1px', color: isRepair ? '#f97316' : (isLight ? '#0f172a' : '#fff') }}>{isRepair ? '🔄 ДОВИПУСК' : 'Генерація карток'}</h2>
        <p style={{ color: isLight ? '#64748b' : '#555', textAlign: 'center', fontSize: '0.9rem', marginBottom: isRepair ? '10px' : '30px' }}>{part.nom?.name || part.name}</p>
        {isRepair && (
          <div style={{ background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.3)', borderRadius: '12px', padding: '10px 16px', marginBottom: '20px', fontSize: '0.72rem', color: '#f97316', fontWeight: 800, textAlign: 'center' }}>
            ⚠️ Для цієї деталі вже є картки. Нові картки будуть позначені як <strong>ДОВИПУСК</strong> (is_rework = true)
          </div>
        )}

        {part.isSplitMode ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div style={{ fontSize: '0.7rem', color: isLight ? '#475569' : '#444', fontWeight: 900, marginBottom: '5px' }}>ОБЕРІТЬ ПАРТІЮ ДЛЯ ДРУКУ:</div>
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

                const { issuedSheets, pendingSheets, usedByOtherPartsAcrossTask, hasKittingReqs } = getKittingSheets(task, part.nom)
                const generatedCount = cardsBelongingToThisSplitCount
                const isGenerated = sheetsUsedInThisSplit >= splitSheets
                const remainingCount = Math.max(0, splitLoadings - generatedCount)
                const splitRemainingSheets = Math.max(0, splitSheets - sheetsUsedInThisSplit)
                const poolRemainingForTask = Math.max(0, issuedSheets - (usedByOtherPartsAcrossTask || 0) - sheetsUsedInThisSplit)

                const maxAllowedToGen = hasKittingReqs 
                  ? Math.min(remainingCount, Math.floor(Math.min(splitRemainingSheets, poolRemainingForTask) / currentCapacity))
                  : remainingCount
                const isKittingBlocked = hasKittingReqs && maxAllowedToGen <= 0

                const splitGlobalOffsetForThisMachine = currentGlobalOffset
                currentGlobalOffset += splitLoadings
                const toGen = Math.min(maxAllowedToGen, partialCounts[`${part.nomId}_${sIdx}`] ?? remainingCount)

                return (
                  <div key={sIdx} style={{ background: isLight ? '#f8fafc' : '#080808', padding: '15px', borderRadius: '16px', border: isGenerated ? '1px solid #10b98133' : (isLight ? '1px solid #e2e8f0' : '1px solid #1a1a1a'), display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: isGenerated ? 0.8 : 1 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ fontWeight: 900, color: isGenerated ? '#10b981' : (isLight ? '#0f172a' : '#fff'), fontSize: '0.9rem' }}>{split.machine || '—'}</div>
                        <span style={{ fontSize: '0.65rem', background: isGenerated ? '#10b98133' : (isLight ? '#e2e8f0' : '#222'), color: isGenerated ? '#10b981' : (isLight ? '#64748b' : '#888'), padding: '2px 8px', borderRadius: '6px', fontWeight: 900 }}>
                          {generatedCount} / {splitLoadings} КАРТ.
                        </span>
                      </div>
                      <div style={{ fontSize: '0.65rem', color: isLight ? '#94a3b8' : '#555', marginTop: '4px' }}>
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
                            style={{ width: '45px', background: isLight ? '#fff' : '#000', border: '1px solid rgba(255,144,0,0.4)', color: '#ff9000', textAlign: 'center', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 900, padding: '4px 0' }}
                            title="Кількість листів на одну загрузку (картку)"
                          />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                          <span style={{ fontSize: '0.55rem', color: isLight ? '#64748b' : '#444', fontWeight: 900 }}>ДРУК</span>
                          <input
                            type="number"
                            min="1"
                            max={remainingCount}
                            value={toGen}
                            onChange={(e) => {
                              const val = Math.min(remainingCount, Math.max(1, parseInt(e.target.value) || 1))
                              setPartialCounts(prev => ({ ...prev, [`${part.nomId}_${sIdx}`]: val }))
                            }}
                            style={{ width: '45px', background: isLight ? '#fff' : '#000', border: isLight ? '1px solid #cbd5e1' : '1px solid #333', color: isLight ? '#0f172a' : '#fff', textAlign: 'center', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 900, padding: '4px 0' }}
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
                      <div style={{ color: isLight ? '#94a3b8' : '#444', fontSize: '0.7rem', fontWeight: 800 }}>ГОТОВО</div>
                    )}
                  </div>
                )
              })
            })()}
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '30px' }}>
              {/* Sheet & plan header indicator */}
              <div style={{ background: isLight ? '#f8fafc' : '#0a0a0a', border: isLight ? '1px solid #e2e8f0' : '1px solid #1e293b', borderRadius: '18px', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '0.68rem', fontWeight: 900, color: isLight ? '#64748b' : '#888', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    ПЛАН ДО ГЕНЕРАЦІЇ:
                  </span>
                  <div style={{ fontSize: '1.25rem', fontWeight: 950, color: '#ff9000' }}>
                    {remainingPlannedSheets} л. <span style={{ fontSize: '0.75rem', color: isLight ? '#94a3b8' : '#666', fontWeight: 700 }}>з {effectivePartSheets} л. плану деталі</span>
                  </div>
                </div>
                {singleKitting.hasKittingReqs && (
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ 
                      fontSize: '0.72rem', 
                      fontWeight: 900, 
                      padding: '6px 12px', 
                      borderRadius: '8px', 
                      background: (singleKitting.issuedSheets > 0 || task?.warehouse_conf === 'true' || task?.warehouse_conf === 'partial') ? 'rgba(16,185,129,0.12)' : 'rgba(234,179,8,0.12)', 
                      color: (singleKitting.issuedSheets > 0 || task?.warehouse_conf === 'true' || task?.warehouse_conf === 'partial') ? '#10b981' : '#eab308',
                      border: (singleKitting.issuedSheets > 0 || task?.warehouse_conf === 'true' || task?.warehouse_conf === 'partial') ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(234,179,8,0.3)'
                    }}>
                      {singleKitting.issuedSheets > 0 
                        ? `📦 Склад видав: ${singleKitting.issuedSheets} л.` 
                        : (task?.warehouse_conf === 'true' || task?.warehouse_conf === 'partial')
                          ? '📦 Склад видачу погодив'
                          : '⏳ Очікує видачі зі складу'}
                    </span>
                  </div>
                )}
              </div>

              <div>
                <label style={{ display: 'block', color: machineName ? (isLight ? '#64748b' : '#888') : '#eab308', fontSize: '0.65rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '8px' }}>
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
                    setTotal(Math.max(1, Math.ceil(targetSheets / newCapacity)))
                  }}
                  style={{ width: '100%', background: isLight ? '#ffffff' : '#000', border: machineName ? '1px solid #10b981' : '1px solid #eab308', color: machineName ? (isLight ? '#0f172a' : '#fff') : '#eab308', padding: '15px', borderRadius: '15px', fontSize: '0.95rem', outline: 'none', fontWeight: 800 }}
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
                <div style={{ background: isLight ? '#f1f5f9' : '#080808', padding: '18px', borderRadius: '20px', border: isLight ? '1px solid #e2e8f0' : '1px solid #1a1a1a' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <span style={{ color: isLight ? '#64748b' : '#555', fontSize: '0.75rem', fontWeight: 800 }}>ПРОГРЕС ВИПУСКУ:</span>
                    <span style={{ color: '#3b82f6', fontSize: '0.75rem', fontWeight: 900 }}>
                      Згенеровано {part.productionCards?.length || 0} з {config.targetTotal || (total + (part.productionCards?.length || 0))} карт.
                    </span>
                  </div>
                  <div style={{ height: '6px', background: isLight ? '#e2e8f0' : '#1a1a1a', borderRadius: '3px', overflow: 'hidden' }}>
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
                      const val = isNaN(newCap) ? '' : Math.min(maxC, Math.max(minC, newCap));
                      setCapacity(val);
                      if (typeof val === 'number' && val > 0) {
                        setTotal(Math.max(1, Math.ceil(targetSheets / val)));
                      }
                    }}
                    onBlur={(e) => {
                      const m = findMachine(machineName);
                      const minC = m?.min_capacity || 1;
                      const maxC = m?.max_capacity || m?.sheet_capacity || 99;
                      let v = parseInt(e.target.value);
                      if (isNaN(v)) v = minC;
                      else v = Math.min(maxC, Math.max(minC, v));
                      setCapacity(v);
                      if (v > 0) {
                        setTotal(Math.max(1, Math.ceil(targetSheets / v)));
                      }
                    }}
                    min="1"
                    style={{ width: '100%', background: isLight ? '#fff' : '#000', border: '1px solid rgba(255,144,0,0.5)', color: '#ff9000', fontSize: '1.5rem', fontWeight: 950, textAlign: 'center', padding: '10px', borderRadius: '15px', outline: 'none' }}
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
                    style={{ width: '100%', background: isLight ? '#fff' : '#000', border: '1px solid #10b98150', color: isLight ? '#0f172a' : '#fff', fontSize: '1.5rem', fontWeight: 950, textAlign: 'center', padding: '10px', borderRadius: '15px', outline: 'none' }}
                  />
                </div>
              </div>

              {/* Розрахунок матеріалів для порції */}
              <div style={{ background: isLight ? '#f8fafc' : '#090909', border: isLight ? '1px solid #e2e8f0' : '1px solid #1e293b', borderRadius: '18px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 900, color: isLight ? '#0284c7' : '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
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
                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', padding: '5px 10px', background: isLight ? '#ffffff' : '#0d1117', borderRadius: '8px', border: isLight ? '1px solid #e2e8f0' : '1px solid #1a2435' }}>
                            <span style={{ color: isLight ? '#64748b' : '#888' }}>📄 Картка {idx + 1}:</span>
                            <span style={{ color: sh < (Number(capacity) || 1) ? '#eab308' : (isLight ? '#0f172a' : '#fff'), fontWeight: 950 }}>{sh} л.{sh < (Number(capacity) || 1) ? ' ⚡ останній залишок' : ''}</span>
                          </div>
                        ))}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', padding: '7px 10px', background: isLight ? '#eff6ff' : '#0a0a18', borderRadius: '10px', border: isLight ? '1px solid #bfdbfe' : '1px solid #1e293b', marginTop: '2px' }}>
                          <span style={{ color: isLight ? '#0284c7' : '#38bdf8', fontWeight: 900 }}>📦 ВСЬОГО ЛИСТІВ:</span>
                          <span style={{ color: isLight ? '#0f172a' : '#fff', fontWeight: 950 }}>{actualTotalSheets} л.</span>
                        </div>
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.75rem', color: '#ef4444', padding: '6px 10px', background: 'rgba(239,68,68,0.06)', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.2)' }}>Немає залишку листів для генерації</div>
                    )}

                    {/* Фрези */}
                    {cutterRows.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
                        <div style={{ fontSize: '0.62rem', color: isLight ? '#64748b' : '#888', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '2px' }}>
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
                              isLight={isLight}
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
                      <div style={{ fontSize: '0.7rem', color: isLight ? '#94a3b8' : '#555', fontStyle: 'italic', textAlign: 'center', padding: '4px 0' }}>Фрези не визначено в плані обробки</div>
                    )}
                  </>
                )}

                <div style={{ fontSize: '0.78rem', color: '#10b981', background: 'rgba(16, 185, 129, 0.08)', padding: '10px 14px', borderRadius: '12px', border: '1px solid rgba(16, 185, 129, 0.25)', marginTop: '8px', fontWeight: 800 }}>
                  ✓ Буде сформовано {batchCards.length} карт(и) на {actualTotalSheets} листів (максимум для деталі: {remainingPlannedSheets} л.).
                  {singleKitting.hasKittingReqs && singleKitting.issuedSheets < remainingPlannedSheets && (
                    <div style={{ fontSize: '0.7rem', color: '#eab308', marginTop: '4px', fontWeight: 600 }}>
                      ⚠️ Фактично погоджено складом: {singleKitting.issuedSheets} з {effectivePartSheets} л.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <button
              disabled={isGenerating || !machineName || hasUnselectedCutters}
              onClick={() => {
                if (!machineName) {
                  alert('Будь ласка, спочатку оберіть верстат!')
                  return
                }
                if (hasUnselectedCutters) {
                  alert('Будь ласка, оберіть модель для кожної необхідної фрези!')
                  return
                }
                if (total > 0) {
                  const effectiveSheets = Number(part.plannedSheets) > 0
                    ? Number(part.plannedSheets)
                    : Math.ceil((Number(part.plan) || Number(part.need) || 0) / Math.max(1, Number(part.unitsPerSheet) || 1))

                  const allowedSheets = targetSheets

                  onGenerate(
                    task,
                    part,
                    effectiveSheets,
                    machineName,
                    total,
                    part.productionCards?.length || 0,
                    part.plan,
                    isRepair,
                    null,
                    0,
                    capacity,
                    allowedSheets,
                    null,
                    selectedCutters
                  )
                }
              }}
              style={{
                width: '100%',
                background: (machineName && !isSingleKittingBlocked && !hasUnselectedCutters) ? '#10b981' : (isLight ? '#f1f5f9' : '#222'),
                color: (machineName && !isSingleKittingBlocked && !hasUnselectedCutters) ? '#fff' : (hasUnselectedCutters ? '#eab308' : (isSingleKittingBlocked ? '#ef4444' : (isLight ? '#64748b' : '#666'))),
                padding: '20px',
                borderRadius: '20px',
                fontSize: '1rem',
                fontWeight: 950,
                cursor: (isGenerating || !machineName || isSingleKittingBlocked || hasUnselectedCutters) ? 'not-allowed' : 'pointer',
                border: (machineName && !isSingleKittingBlocked && !hasUnselectedCutters) ? 'none' : (hasUnselectedCutters ? '1px solid rgba(234, 179, 8, 0.4)' : (isLight ? '1px solid #cbd5e1' : '1px solid #333')),
                textTransform: 'uppercase',
                letterSpacing: '1px',
                boxShadow: (machineName && !isSingleKittingBlocked && !hasUnselectedCutters) ? '0 10px 20px -5px rgba(16, 185, 129, 0.4)' : 'none',
                opacity: (isGenerating || !machineName || isSingleKittingBlocked || hasUnselectedCutters) ? 0.6 : 1
              }}
            >
              {isGenerating ? 'ОБРОБКА ТА СТВОРЕННЯ ЗАПИТУ...' : (
                isSingleKittingBlocked ? `ОЧІКУЄМО ВИДАЧУ ${singleKitting.pendingSheets} ЛИСТІВ ЗІ СКЛАДУ` : (
                  !machineName ? 'ОБЕРІТЬ ВЕРСТАТ ДЛЯ ПРОДОВЖЕННЯ' : (
                    hasUnselectedCutters ? `ОБЕРІТЬ МОДЕЛЬ ФРЕЗИ (${unselectedCuttersCount})` : (
                      `ПІДТВЕРДИТИ ТА ЗГЕНЕРУВАТИ (${batchCards.length} КАРТ, ${actualTotalSheets} Л.)`
                    )
                  )
                )
              )}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
