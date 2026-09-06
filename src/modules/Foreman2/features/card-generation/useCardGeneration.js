import { useRef, useState } from 'react'
import { supabase } from '../../../../supabase.js'
import { apiService } from '../../../../services/apiDispatcher.js'

export function useCardGeneration({ mes }) {
  const [isGenerating, setIsGenerating] = useState(false)
  const [genModalConfig, setGenModalConfig] = useState(null)
  const [printQueue, setPrintQueue] = useState(null)
  const generatingLockRef = useRef(false)

  const {
    machines = [],
    workCards = [],
    createWorkCardsBatch,
    fetchData
  } = mes
  const createDovypuskMaterialRequests = mes.createDovypuskMaterialRequests || mes.createDovyпускMaterialRequests

  const handleGenerateCards = async (
    task, part, sheets, selectedMachineName, count, localGeneratedCount = 0, totalToReach = 0, isRepair = false, globalTotalCards = null, globalSeqOffset = 0, customCapacity = null, maxSheetsToGenerate = null, onCardsGenerated = null, selectedCutters = null
  ) => {
    if (generatingLockRef.current) {
      console.warn("[GEN] BLOCKED: Generation already in progress, ignoring duplicate call.")
      return
    }
    generatingLockRef.current = true

    const isWarehouseReady = task?.warehouse_conf === 'true' || task?.warehouse_conf === 'partial'
    const isEngineerReady = task?.engineer_conf === true
    const isDirectorReady = task?.director_conf === true

    if (!isWarehouseReady || !isEngineerReady || !isDirectorReady) {
      generatingLockRef.current = false
      const missing = []
      if (!isWarehouseReady) missing.push('Склад')
      if (!isEngineerReady) missing.push('Інженер')
      if (!isDirectorReady) missing.push('Директор')
      alert(`Генерація карток заблокована! Наряд має отримати погодження: ${missing.join(', ')}.`)
      return
    }

    const targetNomId = part?.nomId || part?.id || part?.nom?.id
    const resolvedPartNom = part?.nom || (mes.nomenclatures || []).find(n => String(n.id) === String(targetNomId)) || { id: targetNomId, name: part?.name, material_type: part?.material }
    const nomId = resolvedPartNom?.id || targetNomId

    // Persist selectedCutters to task plan_snapshot if provided
    if (selectedCutters && Object.keys(selectedCutters).length > 0) {
      try {
        const nomKey = String(nomId)
        const existingSnap = task.plan_snapshot || {}
        const partSnap = existingSnap[nomKey] || {}
        const updatedSnap = {
          ...existingSnap,
          selectedCutters: { ...(existingSnap.selectedCutters || {}), ...selectedCutters },
          [nomKey]: {
            ...partSnap,
            selected_cutters: { ...(partSnap.selected_cutters || {}), ...selectedCutters }
          }
        }
        task.plan_snapshot = updatedSnap
        await supabase.from('tasks').update({ plan_snapshot: updatedSnap }).eq('id', task.id)
      } catch (snapErr) {
        console.warn('[CARD_GEN] Could not persist selectedCutters to task plan_snapshot:', snapErr)
      }
    }

    const baseName = (selectedMachineName || '').split(' №')[0].trim()
    let machineObj = machines.find(m => m.name === baseName) || machines.find(m => m.name === selectedMachineName)
    
    const capacity = customCapacity !== null ? Number(customCapacity) : (Number(machineObj?.sheet_capacity) || 1)
    const unitsPerSheet = Number(resolvedPartNom?.units_per_sheet || part?.unitsPerSheet) || 1

    const maxCardsForThisSplit = Math.ceil(sheets / capacity)
    const displayTotal = globalTotalCards || maxCardsForThisSplit

    // Existing cards may have been produced with another machine capacity.
    // Limit the new batch by the remaining sheets, not by the old card count.
    let finalCount = Math.max(0, Number(count) || 0)
    if (finalCount <= 0) {
      generatingLockRef.current = false
      alert('Немає карток для генерації. Оновіть наряд і перевірте залишок листів.')
      return
    }

    let dbCardsForRenumber = []
    if (!isRepair) {
      try {
        const { data, error } = await supabase
          .from('work_cards')
          .select('id, is_rework, operation, card_info, quantity')
          .eq('task_id', task.id)
          .eq('nomenclature_id', nomId)
        if (!error && data) {
          dbCardsForRenumber = data.filter(c => !c.is_rework && c.operation !== 'Склад БЗ')
        }
      } catch (err) {
        console.error("Error fetching existing work cards:", err)
      }
    }

    const existingNomenclatureCards = (workCards || []).filter(wc =>
      String(wc.task_id) === String(task.id) &&
      String(wc.nomenclature_id) === String(nomId)
    )

    let maxExistingSeq = 0
    const cardsForSequence = !isRepair && dbCardsForRenumber.length > 0 ? dbCardsForRenumber : existingNomenclatureCards
    cardsForSequence.forEach(wc => {
      const match = (wc.card_info || '').match(/(\d+)\/(\d+)/) || (wc.card_info || '').match(/№(\d+)/)
      if (match) {
        const seq = parseInt(match[1])
        if (seq > maxExistingSeq) maxExistingSeq = seq
      }
    })

    const startSeqForThisBatch = isRepair ? ((Number(globalSeqOffset) || 0) + 1) : (maxExistingSeq + 1)

    setIsGenerating(true)
    try {
      const cardsBatch = []
      const activeCards = isRepair ? [] : cardsForSequence.filter(c => !(c.card_info || '').includes('[REDO]'))
      const activeCardsForSelectedMachine = selectedMachineName
        ? activeCards.filter(c => String(c.machine || '') === String(selectedMachineName))
        : activeCards
      let actualGeneratedSheets = 0
      let actualGeneratedRequiredQty = 0
      activeCardsForSelectedMachine.forEach(c => {
        const cardQty = Number(c.quantity) || 0
        actualGeneratedSheets += Math.ceil(cardQty / unitsPerSheet)
      })
      activeCards.forEach(c => {
        const cardQty = Number(c.quantity) || 0
        const reqMatch = String(c.card_info || '').match(/\[REQ:(\d+)\]/)
        actualGeneratedRequiredQty += reqMatch ? (Number(reqMatch[1]) || 0) : cardQty
      })

      let sheetsRemainingForThisSplit = Math.max(0, sheets - actualGeneratedSheets)
      if (maxSheetsToGenerate !== null && maxSheetsToGenerate !== undefined) {
        sheetsRemainingForThisSplit = Math.min(sheetsRemainingForThisSplit, Math.max(0, Number(maxSheetsToGenerate) || 0))
      }
      const snapshotEntry = task.plan_snapshot?.[String(nomId)]
      const originalNeed = snapshotEntry?.need || totalToReach || 0

      let reqRemainingForThisSplit = isRepair
        ? Number(totalToReach) || (Number(sheets) * unitsPerSheet)
        : originalNeed - actualGeneratedRequiredQty
      if (reqRemainingForThisSplit < 0) reqRemainingForThisSplit = 0

      const totalCardsForTask = Math.max(startSeqForThisBatch + finalCount - 1, 1)

      for (let i = 1; i <= finalCount; i++) {
        const currentSeqNum = startSeqForThisBatch + (i - 1)
        const currentSeq = `${currentSeqNum}/${totalCardsForTask}`
        const sheetsInThisLoading = Math.min(sheetsRemainingForThisSplit, capacity)
        if (sheetsInThisLoading <= 0) break
        const qtyInThisLoading = Math.ceil(sheetsInThisLoading * unitsPerSheet)
        const reqInThisLoading = Math.min(qtyInThisLoading, reqRemainingForThisSplit)
        const bzInThisLoading = Math.max(0, qtyInThisLoading - reqInThisLoading)

        const prefix = isRepair ? '[REDO] ' : ''
        const hasCutterNeeds = Array.isArray(selectedCutters) && selectedCutters.length > 0
        const initialStatus = isRepair ? 'waiting-materials' : (hasCutterNeeds ? 'waiting-cutters' : 'new')
        cardsBatch.push({
          operation: 'Розкрій',
          machine: selectedMachineName || 'Не вказано',
          estimatedTime: Math.round((Number(resolvedPartNom?.time_per_unit) || 0) * reqInThisLoading * 60),
          cardInfo: `${prefix}№${currentSeq}${originalNeed > 0 ? ` [NEED:${originalNeed}]` : ''} [REQ:${reqInThisLoading}] [BZ:${bzInThisLoading}]`,
          quantity: qtyInThisLoading,
          bufferQty: bzInThisLoading,
          actualSheets: sheetsInThisLoading,
          status: initialStatus,
          is_rework: isRepair
        })

        sheetsRemainingForThisSplit -= sheetsInThisLoading
        reqRemainingForThisSplit -= reqInThisLoading
        if (reqRemainingForThisSplit < 0) reqRemainingForThisSplit = 0
      }

      if (cardsBatch.length === 0) {
        throw new Error('Немає листів для довипуску. Перевірте розрахунок нестачі.')
      }

      const createdCards = await apiService.submitCreateWorkCardsBatch(task.id, task.order_id, nomId, cardsBatch, createWorkCardsBatch)

      const createDovypuskFn = mes.createDovypuskMaterialRequests || mes.createDovyпускMaterialRequests || mes['createDovyпускMaterialRequests']
      console.log('[CARD_GEN_REQ_DEBUG]', { hasFn: typeof createDovypuskFn === 'function', sheets, cardsBatchCount: cardsBatch.length, createdCardsCount: createdCards?.length })

      // Send ONE consolidated cutter request for the whole batch.
      // Sheet requests are created at task creation time — not here.
      if (typeof createDovypuskFn === 'function') {
        const totalSheetsForBatch = cardsBatch.reduce((sum, batchItem) => {
          const cardSheets = Number(batchItem.actualSheets || batchItem.sheets)
          return sum + (cardSheets > 0 ? cardSheets : Math.ceil((Number(batchItem.quantity) || 0) / unitsPerSheet))
        }, 0)
        const totalQtyForBatch = cardsBatch.reduce((sum, batchItem) => sum + (Number(batchItem.quantity) || 0), 0)

        if (totalSheetsForBatch > 0 && totalQtyForBatch > 0) {
          try {
            console.log('[CARD_GEN] Sending consolidated cutter request for batch, sheets:', totalSheetsForBatch, 'selectedCutters:', selectedCutters)
            await createDovypuskFn(task.id, task.order_id, resolvedPartNom, totalSheetsForBatch, totalQtyForBatch, selectedMachineName, null, 'cutters_only', selectedCutters)
          } catch (reqErr) {
            console.error('[CARD_GEN] Error in createDovypuskFn (cutters):', reqErr)
            alert('Помилка генерації запиту на фрези: ' + reqErr.message)
          }
        }
      }

      if (createdCards && createdCards.length > 0) {
        fetchData(['work_cards', 'tasks', 'material_requests']).catch(() => {})

        if (typeof onCardsGenerated === 'function') {
          onCardsGenerated({
            task,
            part,
            total: displayTotal,
            created: startSeqForThisBatch,
            metadata: createdCards.map((c, idx) => {
              const batchItem = cardsBatch[idx]
              return {
                id: c.id,
                loading: c.card_info,
                qty: batchItem ? batchItem.quantity : 0,
                estimatedTime: (Number(part.nom?.time_per_unit) || 0) * (batchItem ? batchItem.quantity : 0) * 60,
                totalLoadings: displayTotal,
                sheetsPerLoading: batchItem ? batchItem.actualSheets : capacity,
                machine: selectedMachineName
              }
            })
          })
        } else {
          setPrintQueue({
            task,
            part,
            total: displayTotal,
            created: startSeqForThisBatch,
            metadata: createdCards.map((c, idx) => {
              const batchItem = cardsBatch[idx]
              return {
                id: c.id,
                loading: c.card_info,
                qty: batchItem ? batchItem.quantity : 0,
                estimatedTime: (Number(part.nom?.time_per_unit) || 0) * (batchItem ? batchItem.quantity : 0) * 60,
                totalLoadings: displayTotal,
                sheetsPerLoading: batchItem ? batchItem.actualSheets : capacity,
                machine: selectedMachineName
              }
            })
          })
        }
      }
    } catch (err) {
      alert('Помилка генерації: ' + err.message)
    } finally {
      setTimeout(() => {
        setIsGenerating(false)
        setGenModalConfig(null)
        generatingLockRef.current = false
      }, 500)
    }
  }

  const openGenModal = (config) => {
    setGenModalConfig(config)
  }

  const closeGenModal = () => {
    setGenModalConfig(null)
  }

  return {
    isGenerating,
    genModalConfig,
    setGenModalConfig,
    printQueue,
    setPrintQueue,
    openGenModal,
    closeGenModal,
    handleGenerateCards
  }
}
