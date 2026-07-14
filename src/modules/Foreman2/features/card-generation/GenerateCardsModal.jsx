import React, { useState, useEffect } from 'react'
import { X, Printer, Loader2 } from 'lucide-react'

export default function GenerateCardsModal({
  config,
  machines,
  nomenclatures,
  workCards,
  materialRequests,
  isGenerating,
  onClose,
  onGenerate
}) {
  const [capacity, setCapacity] = useState(config?.capacityOverride || config?.capacity || 1)
  const [total, setTotal] = useState(config?.count || 1)
  const [machineName, setMachineName] = useState(config?.part?.machine || '')
  
  const [customLoadingCapacities, setCustomLoadingCapacities] = useState({})
  const [partialCounts, setPartialCounts] = useState({})

  useEffect(() => {
    if (config) {
      setMachineName(config.part?.machine || '')
      setTotal(config.count || 1)
      const m = machines.find(m => m.name === (config.part?.machine || '').split(' №')[0].trim())
      setCapacity(config.capacityOverride || m?.sheet_capacity || 1)
    }
  }, [config, machines])

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

        <h2 style={{ fontSize: '1.5rem', fontWeight: 950, margin: '0 0 10px', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '1px' }}>Генерація карток</h2>
        <p style={{ color: '#555', textAlign: 'center', fontSize: '0.9rem', marginBottom: '30px' }}>{part.nom?.name || part.name}</p>

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
            {isRepair ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '30px' }}>
                <div>
                  <label style={{ display: 'block', color: '#888', fontSize: '0.65rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '8px' }}>
                    Оберіть верстат для довипуску:
                  </label>
                  <select
                    value={machineName}
                    onChange={(e) => {
                      const newMachineName = e.target.value
                      const resolvedMachine = findMachine(newMachineName)
                      const newCapacity = Number(resolvedMachine?.sheet_capacity) || 1
                      const newCardsNeeded = Math.ceil(part.plannedSheets / newCapacity)
                      setMachineName(newMachineName)
                      setTotal(Math.max(1, newCardsNeeded - (part.productionCards?.length || 0)))
                    }}
                    style={{ width: '100%', background: '#000', border: '1px solid #333', color: '#fff', padding: '15px', borderRadius: '15px', fontSize: '0.95rem', outline: 'none', fontWeight: 800 }}
                  >
                    {MACHINE_TYPES.map(t => {
                      const cap = findMachine(t)?.sheet_capacity || 1
                      return (
                        <option key={t} value={t}>{t} (місткість: {cap} л.)</option>
                      )
                    })}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  <div style={{ background: '#080808', padding: '15px', borderRadius: '15px', border: '1px solid #1a1a1a', textAlign: 'center' }}>
                    <div style={{ color: '#555', fontSize: '0.65rem', fontWeight: 800 }}>НЕОБХІДНО ЛИСТІВ:</div>
                    <div style={{ color: '#fff', fontSize: '1.2rem', fontWeight: 950, marginTop: '4px' }}>{part.plannedSheets} л.</div>
                  </div>
                  <div style={{ background: '#080808', padding: '15px', borderRadius: '15px', border: '1px solid #1a1a1a', textAlign: 'center' }}>
                    <div style={{ color: '#555', fontSize: '0.65rem', fontWeight: 800 }}>КІЛЬКІСТЬ КАРТ:</div>
                    <div style={{ color: '#ff9000', fontSize: '1.2rem', fontWeight: 950, marginTop: '4px' }}>{total} шт.</div>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ background: '#080808', padding: '20px', borderRadius: '20px', border: '1px solid #1a1a1a', marginBottom: '30px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
                  <span style={{ color: '#555', fontSize: '0.75rem', fontWeight: 800 }}>СТАТУС:</span>
                  <span style={{ color: '#3b82f6', fontSize: '0.75rem', fontWeight: 900 }}>Згенеровано {part.productionCards?.length || 0} з {config.targetTotal || (total + (part.productionCards?.length || 0))}</span>
                </div>
                <div style={{ height: '6px', background: '#1a1a1a', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: `${((part.productionCards?.length || 0) / (config.targetTotal || (total + (part.productionCards?.length || 0)))) * 100}%`, height: '100%', background: '#3b82f6', transition: '0.3s' }} />
                </div>
              </div>
            )}

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', color: '#ff9000', fontSize: '0.65rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '10px', textAlign: 'center' }}>
                Завантаження (від {findMachine(machineName)?.min_capacity || 1} до {findMachine(machineName)?.max_capacity || findMachine(machineName)?.sheet_capacity || 1} л.)
              </label>
              <input
                type="number"
                value={capacity}
                onChange={(e) => {
                  const newCap = parseInt(e.target.value);
                  const m = findMachine(machineName);
                  const minC = m?.min_capacity || 1;
                  const maxC = m?.max_capacity || m?.sheet_capacity || 1;
                  const safeCap = isNaN(newCap) ? 1 : Math.min(maxC, Math.max(minC, newCap));
                  const newTargetTotal = Math.ceil(part.plannedSheets / safeCap);
                  setCapacity(isNaN(newCap) ? '' : newCap);
                  setTotal(Math.max(1, newTargetTotal - (part.productionCards?.length || 0)));
                }}
                onBlur={(e) => {
                  const m = findMachine(machineName);
                  const minC = m?.min_capacity || 1;
                  const maxC = m?.max_capacity || m?.sheet_capacity || 1;
                  let v = parseInt(e.target.value);
                  if (isNaN(v)) v = minC;
                  else v = Math.min(maxC, Math.max(minC, v));
                  const newTargetTotal = Math.ceil(part.plannedSheets / v);
                  setCapacity(v);
                  setTotal(Math.max(1, newTargetTotal - (part.productionCards?.length || 0)));
                }}
                min={findMachine(machineName)?.min_capacity || 1}
                max={findMachine(machineName)?.max_capacity || findMachine(machineName)?.sheet_capacity || 1}
                style={{ width: '100%', background: '#000', border: '1px solid rgba(255,144,0,0.5)', color: '#ff9000', fontSize: '1.5rem', fontWeight: 950, textAlign: 'center', padding: '10px', borderRadius: '15px', outline: 'none' }}
              />
            </div>

            <div style={{ marginBottom: '30px' }}>
              <label style={{ display: 'block', color: '#888', fontSize: '0.65rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '10px', textAlign: 'center' }}>
                {isRepair ? 'Кількість карт до друку' : 'Скільки ще карт згенерувати?'}
              </label>
              <input
                type="number"
                value={total}
                onChange={(e) => {
                  const val = Math.max(1, parseInt(e.target.value) || 1)
                  setTotal(val)
                }}
                min="1"
                style={{ width: '100%', background: '#000', border: '1px solid #333', color: '#fff', fontSize: '2.5rem', fontWeight: 950, textAlign: 'center', padding: '15px', borderRadius: '20px', outline: 'none', borderInline: '4px solid #10b981' }}
              />
            </div>

            <button
              disabled={isGenerating}
              onClick={() => {
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
                    config.maxSheetsToGenerate
                  )
                }
              }}
              style={{ width: '100%', background: '#10b981', color: '#fff', padding: '22px', borderRadius: '22px', fontSize: '1rem', fontWeight: 950, cursor: isGenerating ? 'not-allowed' : 'pointer', border: 'none', textTransform: 'uppercase', letterSpacing: '1px', boxShadow: '0 10px 20px -5px rgba(16, 185, 129, 0.4)', opacity: isGenerating ? 0.6 : 1 }}
            >
              {isGenerating ? 'ГЕНЕРАЦІЯ...' : 'ПІДТВЕРДИТИ ТА ДРУКУВАТИ'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
