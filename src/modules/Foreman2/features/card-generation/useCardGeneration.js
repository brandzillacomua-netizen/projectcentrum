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
    fetchData,
    createDovypuskMaterialRequests
  } = mes

  const handleGenerateCards = async (
    task, part, sheets, selectedMachineName, count, localGeneratedCount = 0, totalToReach = 0, isRepair = false, globalTotalCards = null, globalSeqOffset = 0, customCapacity = null, maxSheetsToGenerate = null, onCardsGenerated = null
  ) => {
    if (generatingLockRef.current) {
      console.warn("[GEN] BLOCKED: Generation already in progress, ignoring duplicate call.")
      return
    }
    generatingLockRef.current = true

    const baseName = (selectedMachineName || '').split(' №')[0].trim()
    let machineObj = machines.find(m => m.name === baseName) || machines.find(m => m.name === selectedMachineName)
    
    const capacity = customCapacity !== null ? Number(customCapacity) : (Number(machineObj?.sheet_capacity) || 1)
    const unitsPerSheet = Number(part.nom?.units_per_sheet) || 1

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
          .eq('nomenclature_id', part.nom?.id)
        if (!error && data) {
          dbCardsForRenumber = data.filter(c => !c.is_rework && c.operation !== 'Склад БЗ')
        }
      } catch (err) {
        console.error("Error fetching existing work cards:", err)
      }
    }

    const existingNomenclatureCards = (workCards || []).filter(wc =>
      String(wc.task_id) === String(task.id) &&
      String(wc.nomenclature_id) === String(part.nom?.id)
    )

    let maxExistingSeq = 0
    const cardsForSequence = !isRepair && dbCardsForRenumber.length > 0 ? dbCardsForRenumber : existingNomenclatureCards
    cardsForSequence.forEach(wc => {
      const match = (wc.card_info || '').match(/(\d+)\/(\d+)/)
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
      const snapshotEntry = task.plan_snapshot?.[String(part.nom?.id)]
      const originalNeed = snapshotEntry?.need || totalToReach || 0

      let reqRemainingForThisSplit = isRepair
        ? Number(totalToReach) || (Number(sheets) * unitsPerSheet)
        : originalNeed - actualGeneratedRequiredQty
      if (reqRemainingForThisSplit < 0) reqRemainingForThisSplit = 0

      for (let i = 1; i <= finalCount; i++) {
        const currentSeq = startSeqForThisBatch + (i - 1)
        const sheetsInThisLoading = Math.min(sheetsRemainingForThisSplit, capacity)
        if (sheetsInThisLoading <= 0) break
        const qtyInThisLoading = Math.ceil(sheetsInThisLoading * unitsPerSheet)
        const reqInThisLoading = Math.min(qtyInThisLoading, reqRemainingForThisSplit)
        const bzInThisLoading = Math.max(0, qtyInThisLoading - reqInThisLoading)

        const prefix = isRepair ? '[REDO] ' : ''
        cardsBatch.push({
          operation: 'Розкрій',
          machine: selectedMachineName || 'Не вказано',
          estimatedTime: (Number(part.nom?.time_per_unit) || 0) * reqInThisLoading * 60,
          cardInfo: `${prefix}${currentSeq}/${displayTotal}${originalNeed > 0 ? ` [NEED:${originalNeed}]` : ''} [REQ:${reqInThisLoading}] [BZ:${bzInThisLoading}]`,
          quantity: qtyInThisLoading,
          bufferQty: bzInThisLoading,
          actualSheets: sheetsInThisLoading,
          status: isRepair ? 'waiting-materials' : 'new',
          is_rework: isRepair
        })

        sheetsRemainingForThisSplit -= sheetsInThisLoading
        reqRemainingForThisSplit -= reqInThisLoading
        if (reqRemainingForThisSplit < 0) reqRemainingForThisSplit = 0
      }

      if (cardsBatch.length === 0) {
        throw new Error('Немає листів для довипуску. Перевірте розрахунок нестачі.')
      }

      const createdCards = await apiService.submitCreateWorkCardsBatch(task.id, task.order_id, part.nom.id, cardsBatch, createWorkCardsBatch)

      if (!isRepair && dbCardsForRenumber.length > 0) {
        const renumberUpdates = dbCardsForRenumber.map(card => {
          const currentInfo = String(card.card_info || '')
          const normalizedInfo = currentInfo.replace(/(\d+)\s*\/\s*(\d+)/, (_, sequence) => `${sequence}/${displayTotal}`)
          if (normalizedInfo === currentInfo) return null
          return supabase.from('work_cards').update({ card_info: normalizedInfo }).eq('id', card.id)
        }).filter(Boolean)
        if (renumberUpdates.length > 0) await Promise.all(renumberUpdates)
      }

      if (isRepair && sheets > 0 && typeof createDovypuskMaterialRequests === 'function') {
        for (let idx = 0; idx < cardsBatch.length; idx += 1) {
          const batchItem = cardsBatch[idx]
          const createdCard = createdCards?.[idx]
          const cardSheets = Number(batchItem.actualSheets || batchItem.sheets)
          const sheetsForCard = cardSheets > 0 ? cardSheets : Math.ceil((Number(batchItem.quantity) || 0) / unitsPerSheet)
          const qtyForCard = Number(batchItem.quantity) || 0
          if (sheetsForCard <= 0 || qtyForCard <= 0) continue
          await createDovypuskMaterialRequests(task.id, task.order_id, part.nom, sheetsForCard, qtyForCard, batchItem.machine || selectedMachineName, createdCard?.id || null)
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
