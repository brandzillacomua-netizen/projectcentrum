import { supabase } from '../../../supabase'
import { useMES } from '../../../MESContext'
import { translateCyrillic, CHAIN } from './useShop1Data'

const stripCuttersBreakdown = (value = '') => {
  let info = String(value || '')
  let markerIdx = info.indexOf('[CUTTERS_BREAKDOWN:')

  while (markerIdx !== -1) {
    const jsonStart = info.indexOf('{', markerIdx)
    if (jsonStart === -1) break

    let depth = 0
    let jsonEnd = -1
    for (let i = jsonStart; i < info.length; i++) {
      if (info[i] === '{') depth++
      else if (info[i] === '}') {
        depth--
        if (depth === 0) {
          jsonEnd = i
          break
        }
      }
    }

    if (jsonEnd === -1) break

    const markerEnd = info[jsonEnd + 1] === ']' ? jsonEnd + 2 : jsonEnd + 1
    info = `${info.slice(0, markerIdx)}${info.slice(markerEnd)}`.replace(/\s{2,}/g, ' ').trim()
    markerIdx = info.indexOf('[CUTTERS_BREAKDOWN:')
  }

  return info
}

export function useShop1Actions({
  currentCard,
  selectedOperator,
  setSelectedOperator,
  selectedShift,
  setSelectedShift,
  selectedMachine,
  setSelectedMachine,
  machineNumber,
  setMachineNumber,
  selectedManager,
  setSelectedManager,
  scrapCount,
  setScrapCount,
  reworkCount,
  setReworkCount,
  cuttersBreakdown,
  setCuttersBreakdown,
  galtPriority,
  setGaltPriority,
  qcScrapCount,
  setQcScrapCount,
  qcInspector,
  setQcInspector,
  qcReason,
  setQcReason,
  qcCustomReason,
  setQcCustomReason,
  scrapOperator,
  setScrapOperator,
  selectedCardId,
  setSelectedCardId,
  setScannedIds,
  scannedIds,
  setIsProcessing,
  isProcessing,
  setShowCompleteModal,
  setShowQCModal,
  setShowShiftChangeModal,
  setShiftChangeOperator,
  setShiftChangeShift,
  setShowPauseModal,
  setCustomPauseReason,
  showAlert,
  pauseReason,
  customPauseReason,
  finalOperator,
  setFinalOperator,
  setManualId
}) {
  const {
    workCards,
    nomenclatures,
    tasks,
    orders,
    machines,
    systemUsers,
    machineOperations,
    inventory,
    fetchData,
    formatUserName,
    createWorkCard,
    confirmBuffer,
    resolveCall,
    currentUser,
    requests
  } = useMES()

  const updateInventoryStock = async (nomId, qty, type = 'semi') => {
    if (!nomId || qty <= 0) return
    try {
      const { data: existing } = await supabase.from('inventory')
        .select('*')
        .eq('nomenclature_id', nomId)
        .eq('type', type)
        .limit(1).maybeSingle()

      if (existing) {
        await supabase.from('inventory').update({
          total_qty: (Number(existing.total_qty) || 0) + Number(qty),
          updated_at: new Date().toISOString()
        }).eq('id', existing.id)
      } else {
        const nom = nomenclatures.find(n => n.id === nomId)
        await supabase.from('inventory').insert([{
          name: nom?.name || 'Деталь',
          unit: nom?.unit || 'шт',
          total_qty: Number(qty),
          type: type,
          nomenclature_id: nomId
        }])
      }
    } catch (e) { console.warn(`Stock update failed for type ${type}:`, e) }
  }

  const handleCuttersInventoryDeduction = async (card, breakdown) => {
    if (card.operation !== 'Розкрій' || !breakdown || Object.keys(breakdown).length === 0) return

    const items = []
    for (const [cutterName, actualQtyVal] of Object.entries(breakdown)) {
      const actualQty = Number(actualQtyVal) || 0
      if (actualQty <= 0) continue

      const nom = nomenclatures?.find(n => n.name?.trim().toLowerCase() === cutterName.trim().toLowerCase() && n.type === 'consumable')
      if (!nom) throw new Error(`Не знайдено номенклатуру фрези «${cutterName}»`)
      items.push({ nomenclature_id: nom.id, quantity: actualQty })
    }

    if (items.length === 0) return
    const actorName = formatUserName(currentUser) || currentUser?.login || selectedOperator || 'Оператор терміналу'
    const { error } = await supabase.rpc('register_cutter_usage', {
      p_source_card_id: card.id,
      p_items: items,
      p_actor_id: currentUser?.id || null,
      p_actor_name: actorName,
      p_source_metadata: {
        operator_name: selectedOperator || card.operator_name || null,
        manager_name: card.manager_name || null,
        machine_name: card.machine || null
      }
    })
    if (error) throw error
  }

  const handleStart = async () => {
    if (!currentCard || !selectedOperator || !selectedShift) return
    setIsProcessing(true)
    try {
      const startOp = CHAIN.includes(currentCard.operation) ? currentCard.operation : CHAIN[0]
      const targetMachine = machineNumber ? `${selectedMachine} №${machineNumber}`.trim() : (selectedMachine?.trim() || 'Не вказано')

      if (startOp === 'Розкрій' && targetMachine && targetMachine !== 'Не вказано') {
        const cleanName = (selectedMachine || '').trim().toLowerCase()
        const cleanNum = (machineNumber || '').trim().toLowerCase()

        const machineExists = (machines || []).some(m => {
          const mName = String(m.name || '').trim().toLowerCase()
          const mInv = String(m.inventory_no || '').trim().toLowerCase()
          const mSeq = String(m.sequence_number || '').trim().toLowerCase()
          const mType = String(m.type || '').trim().toLowerCase()

          if (cleanName && cleanNum) {
            return (mName === cleanName || mType === cleanName || mName.includes(cleanName) || mType.includes(cleanName)) && (mInv === cleanNum || mSeq === cleanNum)
          }
          if (cleanName) {
            return mName === cleanName || mType === cleanName || mInv === cleanName || mSeq === cleanName || mName.includes(cleanName) || mType.includes(cleanName)
          }
          if (cleanNum) {
            return mInv === cleanNum || mSeq === cleanNum
          }
          return false
        })

        if (!machineExists) {
          setIsProcessing(false)
          showAlert(
            `Вказаного верстата "${targetMachine}" немає в списку обладнання.\n\nБудь ласка, введіть коректну назву або інвентарний номер верстата з наявних у системі.`,
            `❌ Помилка: верстат не знайдено`
          )
          return
        }

        const targetNorm = targetMachine.trim().toLowerCase()
        const targetNumMatch = targetNorm.match(/№\s*(\S+)/)

        const runningCard = (workCards || []).find(c => {
          if (c.status !== 'in-progress') return false
          if (c.id === currentCard.id) return false
          if (String(c.operation || '').trim().toLowerCase() !== 'розкрій') return false

          const cMachine = String(c.machine || '').trim().toLowerCase()
          if (!cMachine || cMachine === 'не вказано') return false
          if (cMachine === targetNorm) return true

          const cNumMatch = cMachine.match(/№\s*(\S+)/)
          if (cNumMatch && targetNumMatch && cNumMatch[1] === targetNumMatch[1]) return true

          return false
        })

        if (runningCard) {
          const nom = nomenclatures.find(n => n.id === runningCard.nomenclature_id)
          setIsProcessing(false)
          showAlert(
            `На ньому зараз виконується робота:\n\n` +
            `• Картка: #${runningCard.id.slice(-8).toUpperCase()} (${nom?.name || 'Деталь'})\n` +
            `• Operator: ${runningCard.operator_name || 'Не вказано'}\n\n` +
            `Будь ласка, оберіть інший вільний верстат або завершіть поточну картку на цьому верстаті.`,
            `⚠️ Помилка: Верстат "${targetMachine}" вже зайнятий!`
          )
          return
        }
      }

      await supabase.from('work_cards').update({
        status: 'in-progress',
        operation: startOp,
        started_at: new Date().toISOString(),
        operator_name: selectedOperator,
        manager_name: selectedManager || 'Не вказано',
        shift_name: selectedShift,
        machine: targetMachine,
        card_info: ((currentCard.card_info || '').replace('[SHOP:1]', '').trim() + ' [SHOP:1]').trim()
      }).eq('id', currentCard.id)
      
      fetchData(['work_cards', 'tasks']).catch(() => {})
      if (!scannedIds.includes(currentCard.id)) setScannedIds(prev => [...prev, currentCard.id])
    } catch (e) {
      setIsProcessing(false)
      alert('Помилка: ' + e.message)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleShiftChange = async () => {
    if (!currentCard || !shiftChangeOperator || !shiftChangeShift) return
    setIsProcessing(true)
    try {
      const now = new Date().toISOString()
      const shiftChangeInfo = `[REPLACED_BY:${shiftChangeOperator} (${shiftChangeShift})]`
      const historyCardInfo = ((currentCard.card_info || '') + ' ' + shiftChangeInfo).trim()

      await supabase.from('work_card_history').insert([{
        card_id: currentCard.id,
        nomenclature_id: currentCard.nomenclature_id,
        stage_name: 'Розкрій (перезмінка)',
        operator_name: currentCard.operator_name || 'Не вказано',
        qty_at_start: currentCard.quantity,
        // Перезмінка закриває лише часову сесію оператора. Виробіток
        // фіксується один раз під час фактичного завершення операції.
        qty_completed: 0,
        scrap_qty: 0,
        started_at: currentCard.started_at || now,
        completed_at: now,
        shift_name: currentCard.shift_name || 'Без зміни',
        manager_name: currentCard.manager_name,
        machine_name: currentCard.machine,
        card_info: historyCardInfo
      }])

      const originalStart = currentCard.card_info?.match(/\[ORIGINAL_START:([^\]]+)\]/)?.[1] || currentCard.started_at || now
      const updatedCardInfo = ((currentCard.card_info || '').replace(/\[ORIGINAL_START:[^\]]+\]/g, '').trim() + ` [ORIGINAL_START:${originalStart}]`).trim()

      await supabase.from('work_cards').update({
        operator_name: shiftChangeOperator,
        shift_name: shiftChangeShift,
        started_at: now,
        card_info: updatedCardInfo
      }).eq('id', currentCard.id)

      setShowShiftChangeModal(false)
      setShiftChangeOperator('')
      setShiftChangeShift('')
      fetchData(['work_cards', 'work_card_history']).catch(() => {})
    } catch (e) {
      setIsProcessing(false)
      alert('Помилка перезмінки: ' + e.message)
    } finally {
      setIsProcessing(false)
    }
  }

  const handlePauseCard = async () => {
    if (!currentCard || isProcessing) return
    const reasonText = (pauseReason === 'Інша причина (введіть нижче)' ? customPauseReason : pauseReason) || 'Без причини'
    setIsProcessing(true)
    try {
      const now = new Date().toISOString()
      
      await supabase.from('work_card_history').insert([{
        card_id: currentCard.id,
        nomenclature_id: currentCard.nomenclature_id,
        stage_name: 'Розкрій',
        operator_name: currentCard.operator_name || 'Не вказано',
        qty_at_start: currentCard.quantity || 0,
        qty_completed: 0,
        scrap_qty: 0,
        started_at: currentCard.started_at || now,
        completed_at: now,
        shift_name: currentCard.shift_name || 'Без зміни',
        manager_name: currentCard.manager_name || 'Не вказано',
        machine_name: currentCard.machine || 'Не вказано',
        card_info: `[PAUSED_WORK_LOG][REASON:${reasonText}]`
      }])

      const originalStart = currentCard.card_info?.match(/\[ORIGINAL_START:([^\]]+)\]/)?.[1] || currentCard.started_at || now
      let cleanCardInfo = (currentCard.card_info || '').replace(/\[ORIGINAL_START:[^\]]+\]/g, '').trim()
      cleanCardInfo = cleanCardInfo.replace(/\[PAUSED:[^\]]+\]/g, '').replace(/\[PAUSED_AT:[^\]]+\]/g, '').trim()

      const updatedCardInfo = `[PAUSED:${reasonText}][PAUSED_AT:${now}][ORIGINAL_START:${originalStart}] ${cleanCardInfo}`.trim()

      await supabase.from('work_cards').update({
        status: 'paused',
        card_info: updatedCardInfo
      }).eq('id', currentCard.id)

      setShowPauseModal(false)
      setCustomPauseReason('')
      fetchData(['work_cards', 'work_card_history']).catch(() => {})
    } catch (e) {
      alert('Помилка призупинення: ' + e.message)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleResumeCard = async () => {
    if (!currentCard || isProcessing) return
    setIsProcessing(true)
    try {
      const now = new Date().toISOString()
      const pausedAtStr = currentCard.card_info?.match(/\[PAUSED_AT:([^\]]+)\]/)?.[1]
      const reasonText = currentCard.card_info?.match(/\[PAUSED:([^\]]+)\]/)?.[1] || 'Без причини'
      const pausedAt = pausedAtStr ? new Date(pausedAtStr).toISOString() : now

      await supabase.from('work_card_history').insert([{
        card_id: currentCard.id,
        nomenclature_id: currentCard.nomenclature_id,
        stage_name: 'Розкрій (зупинка)',
        operator_name: currentCard.operator_name || 'Не вказано',
        qty_at_start: currentCard.quantity || 0,
        qty_completed: 0,
        scrap_qty: 0,
        started_at: pausedAt,
        completed_at: now,
        shift_name: currentCard.shift_name || 'Без зміни',
        manager_name: currentCard.manager_name || 'Не вказано',
        machine_name: currentCard.machine || 'Не вказано',
        card_info: `Причина зупинки: ${reasonText}`
      }])

      let cleanCardInfo = (currentCard.card_info || '')
        .replace(/\[PAUSED:[^\]]+\]/g, '')
        .replace(/\[PAUSED_AT:[^\]]+\]/g, '')
        .trim()

      await supabase.from('work_cards').update({
        status: 'in-progress',
        started_at: now,
        card_info: cleanCardInfo
      }).eq('id', currentCard.id)

      fetchData(['work_cards', 'work_card_history']).catch(() => {})
    } catch (e) {
      alert('Помилка відновлення роботи: ' + e.message)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleCompleteToBuffer = async () => {
    if (!currentCard) return
    setIsProcessing(true)
    try {
      const qtyDone = Math.max(0, (currentCard.quantity || 0) - scrapCount)
      const op = finalOperator || currentCard.operator_name || 'Не вказано'
      const activeShift = selectedShift || currentCard.shift_name || 'Без зміни'
      const isCuttingOperation = currentCard.operation === 'Розкрій'
      const cuttersQty = isCuttingOperation ? Object.values(cuttersBreakdown).reduce((sum, v) => sum + (Number(v) || 0), 0) : null
      const priorityVal = isCuttingOperation ? galtPriority : (currentCard.galt_priority || 2)

      let breakdownStr = ''
      if (isCuttingOperation && Object.keys(cuttersBreakdown).length > 0) {
        breakdownStr = ` [CUTTERS_BREAKDOWN:${JSON.stringify(cuttersBreakdown)}]`
      }
      const baseCardInfo = isCuttingOperation ? (currentCard.card_info || '') : stripCuttersBreakdown(currentCard.card_info)
      const historyCardInfo = (baseCardInfo + breakdownStr).trim()

      const promises = []

      if (scrapCount > 0 && scrapOperator && scrapOperator !== op) {
        if (qtyDone > 0) {
          promises.push(
            supabase.from('work_card_history').insert([{
              card_id: currentCard.id,
              nomenclature_id: currentCard.nomenclature_id,
              stage_name: currentCard.operation,
              operator_name: op,
              qty_at_start: currentCard.quantity - scrapCount,
              qty_completed: qtyDone,
              scrap_qty: 0,
              started_at: currentCard.started_at,
              completed_at: new Date().toISOString(),
              is_archived_scrap: false,
              shift_name: activeShift,
              manager_name: currentCard.manager_name,
              machine_name: currentCard.machine,
              cutters_used: cuttersQty,
              card_info: historyCardInfo
            }])
          )
        }
        let scrapShift = activeShift
        const scrapOpUser = systemUsers?.find(u => formatUserName(u) === scrapOperator)
        if (scrapOpUser?.shift) {
          scrapShift = scrapOpUser.shift
        }
        promises.push(
          supabase.from('work_card_history').insert([{
            card_id: currentCard.id,
            nomenclature_id: currentCard.nomenclature_id,
            stage_name: currentCard.operation,
            operator_name: scrapOperator,
            qty_at_start: scrapCount,
            qty_completed: 0,
            scrap_qty: scrapCount,
            started_at: currentCard.started_at,
            completed_at: new Date().toISOString(),
            is_archived_scrap: true,
            shift_name: scrapShift,
            manager_name: currentCard.manager_name,
            machine_name: currentCard.machine,
            cutters_used: cuttersQty,
            card_info: (historyCardInfo + ' [SCRAP_ASSIGNED]').trim()
          }])
        )
      } else {
        promises.push(
          supabase.from('work_card_history').insert([{
            card_id: currentCard.id,
            nomenclature_id: currentCard.nomenclature_id,
            stage_name: currentCard.operation,
            operator_name: op,
            qty_at_start: currentCard.quantity,
            qty_completed: qtyDone,
            scrap_qty: scrapCount,
            started_at: currentCard.started_at,
            completed_at: new Date().toISOString(),
            is_archived_scrap: scrapCount > 0,
            shift_name: activeShift,
            manager_name: currentCard.manager_name,
            machine_name: currentCard.machine,
            cutters_used: cuttersQty,
            card_info: historyCardInfo
          }])
        )
      }

      promises.push(
        supabase.from('work_cards').update({
          status: 'at-buffer',
          quantity: qtyDone,
          operator_name: op,
          shift_name: activeShift,
          cutters_used: cuttersQty,
          card_info: historyCardInfo,
          galt_priority: priorityVal,
          completed_at: new Date().toISOString()
        }).eq('id', currentCard.id)
      )

      if (scrapCount > 0) {
        promises.push(updateInventoryStock(currentCard.nomenclature_id, scrapCount, 'scrap_ready'))
      }

      if (isCuttingOperation) {
        promises.push(handleCuttersInventoryDeduction(currentCard, cuttersBreakdown))
      }

      const results = await Promise.all(promises)
      for (const res of results) {
        if (res && res.error) throw res.error
      }

      setShowCompleteModal(false)
      setScrapCount(0)
      setSelectedCardId(null)
      fetchData(['work_cards', 'work_card_history', 'inventory']).catch(() => {})
    } catch (e) {
      console.error('Buffer error:', e)
      setIsProcessing(false)
      alert('Помилка буфера: ' + e.message)
    } finally {
      setIsProcessing(false)
    }
  }

  const nextStageFor = (card) => {
    const op = card?.operation || ''
    if (op === 'Галтовка') return 'Прийомка'
    const i = CHAIN.indexOf(op)
    return i >= 0 && i < CHAIN.length - 1 ? CHAIN[i + 1] : null
  }

  const handleStartNext = async () => {
    if (!currentCard) return
    const next = nextStageFor(currentCard)
    if (!next) return

    if (next === 'Прийомка') {
      if (currentCard.status === 'at-buffer') {
        try {
          const bufferStart = currentCard.completed_at || currentCard.started_at || new Date().toISOString()
          const op = selectedOperator || currentCard.operator_name || 'Прийомка'
          await supabase.from('work_card_history').insert([{
            card_id: currentCard.id,
            nomenclature_id: currentCard.nomenclature_id,
            stage_name: `Буфер ${currentCard.operation}`,
            operator_name: op,
            qty_at_start: currentCard.quantity || 0,
            qty_completed: currentCard.quantity || 0,
            scrap_qty: 0,
            started_at: bufferStart,
            completed_at: new Date().toISOString(),
            shift_name: selectedShift || currentCard.shift_name || 'Без зміни',
            manager_name: currentCard.manager_name,
            machine_name: currentCard.machine
          }])
        } catch (err) {
          console.error('Error writing Tumbling Buffer history:', err)
        }
      }
      await handleAcceptToStock()
      return
    }

    if (!next?.startsWith('Галтовка') && !selectedOperator) return
    setIsProcessing(true)
    try {
      const op = next?.startsWith('Галтовка') ? 'Команда' : selectedOperator
      const writes = []

      if (currentCard.status === 'at-buffer') {
        const bufferStart = currentCard.completed_at || currentCard.started_at || new Date().toISOString()
        writes.push(
          supabase.from('work_card_history').insert([{
            card_id: currentCard.id,
            nomenclature_id: currentCard.nomenclature_id,
            stage_name: `Буфер ${currentCard.operation}`,
            operator_name: op || currentCard.operator_name || 'Не вказано',
            qty_at_start: currentCard.quantity || 0,
            qty_completed: currentCard.quantity || 0,
            scrap_qty: 0,
            started_at: bufferStart,
            completed_at: new Date().toISOString(),
            shift_name: selectedShift || currentCard.shift_name || 'Без зміни',
            manager_name: currentCard.manager_name,
            machine_name: currentCard.machine
          }])
        )
      }

      writes.push(
        supabase.from('work_cards').update({
          status: 'in-progress',
          operation: next,
          started_at: new Date().toISOString(),
          operator_name: op,
          shift_name: selectedShift,
          machine: currentCard.machine || 'Не вказано'
        }).eq('id', currentCard.id)
      )

      const results = await Promise.all(writes)
      for (const res of results) {
        if (res.error) throw res.error
      }

      fetchData(['work_cards', 'work_card_history']).catch(() => {})
      if (!scannedIds.includes(currentCard.id)) setScannedIds(prev => [...prev, currentCard.id])
    } catch (e) {
      setIsProcessing(false)
      alert('Помилка: ' + e.message)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleRequestRework = async () => {
    if (!currentCard || !createWorkCard) return
    setIsProcessing(true)
    try {
      const op = finalOperator || currentCard.operator_name || 'Брак'
      const activeShift = selectedShift || currentCard.shift_name || 'Без зміни'
      const isCuttingOperation = currentCard.operation === 'Розкрій'
      const cuttersQty = isCuttingOperation ? Object.values(cuttersBreakdown).reduce((sum, v) => sum + (Number(v) || 0), 0) : null

      let breakdownStr = ''
      if (isCuttingOperation && Object.keys(cuttersBreakdown).length > 0) {
        breakdownStr = ` [CUTTERS_BREAKDOWN:${JSON.stringify(cuttersBreakdown)}]`
      }
      const baseCardInfo = isCuttingOperation ? (currentCard.card_info || '') : stripCuttersBreakdown(currentCard.card_info)
      const historyCardInfo = (baseCardInfo + breakdownStr).trim()

      const promises = []

      let scrapOpToUse = op
      let scrapShiftToUse = activeShift
      if (scrapOperator) {
        scrapOpToUse = scrapOperator
        const scrapOpUser = systemUsers?.find(u => formatUserName(u) === scrapOperator)
        if (scrapOpUser?.shift) {
          scrapShiftToUse = scrapOpUser.shift
        }
      }

      promises.push(
        supabase.from('work_card_history').insert([{
          card_id: currentCard.id,
          nomenclature_id: currentCard.nomenclature_id,
          stage_name: currentCard.operation,
          operator_name: scrapOpToUse,
          qty_at_start: currentCard.quantity,
          qty_completed: 0,
          scrap_qty: currentCard.quantity,
          started_at: currentCard.started_at,
          completed_at: new Date().toISOString(),
          is_archived_scrap: true,
          shift_name: scrapShiftToUse,
          manager_name: currentCard.manager_name,
          machine_name: currentCard.machine,
          card_info: scrapOperator && scrapOperator !== op ? (historyCardInfo + ' [SCRAP_ASSIGNED]').trim() : historyCardInfo,
          cutters_used: cuttersQty
        }])
      )

      promises.push(
        supabase.from('work_cards').update({
          status: 'completed',
          quantity: 0,
          operator_name: op,
          shift_name: activeShift,
          card_info: historyCardInfo,
          cutters_used: cuttersQty
        }).eq('id', currentCard.id)
      )

      promises.push(updateInventoryStock(currentCard.nomenclature_id, currentCard.quantity, 'scrap_ready'))

      if (isCuttingOperation) {
        promises.push(handleCuttersInventoryDeduction(currentCard, cuttersBreakdown))
      }

      promises.push(
        createWorkCard(
          currentCard.task_id,
          currentCard.order_id,
          currentCard.nomenclature_id,
          CHAIN[0],
          null,
          0,
          `[REDO] після ${currentCard.operation}`,
          currentCard.quantity,
          0,
          true
        )
      )

      const results = await Promise.all(promises)
      for (const res of results) {
        if (res && res.error) throw res.error
      }

      fetchData(['work_cards', 'work_card_history', 'inventory', 'tasks']).catch(() => {})
      setShowCompleteModal(false)
      setSelectedCardId(null)
      setIsProcessing(false)
      alert('Запит на перевипуск створено успішно!')
    } catch (e) {
      console.error('Rework error:', e)
      setIsProcessing(false)
      alert('Помилка перевипуску: ' + e.message)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleFinishSortingActive = async () => {
    if (!currentCard) return
    setIsProcessing(true)
    try {
      await supabase.from('work_cards').update({
        status: 'at-buffer',
        completed_at: new Date().toISOString()
      }).eq('id', currentCard.id)

      fetchData(['work_cards', 'tasks']).catch(() => {})
    } catch (e) {
      console.error('Error completing sorting to buffer:', e)
      setIsProcessing(false)
      alert('Помилка завершення сортування: ' + e.message)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleSortToShop2 = async () => {
    if (!currentCard) return
    setIsProcessing(true)
    try {
      const goodQty = Math.max(0, (currentCard.quantity || 0) - scrapCount - reworkCount)
      const op = selectedOperator || currentCard.operator_name || 'Сортування'
      const activeShift = selectedShift || currentCard.shift_name || 'Без зміни'

      const generateUUID = () => {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
          return crypto.randomUUID()
        }
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
          const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8)
          return v.toString(16)
        })
      }

      const [existingInvResult, shop2TasksResult, s1TaskResult, bzCardsResult] = await Promise.all([
        supabase.from('inventory')
          .select('*')
          .eq('nomenclature_id', currentCard.nomenclature_id)
          .in('type', ['semi', 'wip_bz', 'bz', 'semi_shop2', 'bz_shop2', 'scrap_ready']),
        supabase.from('tasks')
          .select('*')
          .eq('order_id', currentCard.order_id)
          .ilike('step', '%ЦЕХ №2%')
          .neq('status', 'completed'),
        supabase.from('tasks')
          .select('*')
          .eq('id', currentCard.task_id)
          .maybeSingle(),
        supabase.from('work_cards')
          .select('nomenclature_id, quantity')
          .eq('task_id', currentCard.task_id)
          .eq('operation', 'Склад БЗ')
      ])

      const existingItems = existingInvResult.data || []
      const shop2Tasks = shop2TasksResult.data || []
      const s1TaskData = s1TaskResult.data
      const bzCards = bzCardsResult.data || []

      const cardBz = Number(currentCard.buffer_qty) || Number(currentCard.card_info?.match(/\[BZ:(\d+)\]/)?.[1]) || 0
      const cardNeed = Number(currentCard.card_info?.match(/\[REQ:(\d+)\]/)?.[1]) || Number(currentCard.card_info?.match(/\[NEED:(\d+)\]/)?.[1]) || (Math.max(0, Number(currentCard.quantity) - cardBz))
      const actualNeed = Math.min(goodQty, cardNeed)
      const actualBz = Math.max(0, goodQty - actualNeed)

      const invUpdates = []
      const invInserts = []
      const findItem = (type) => existingItems.find(i => i.type === type)

      if (actualNeed > 0) {
        const s1Semi = findItem('semi')
        if (s1Semi) {
          invUpdates.push({ ...s1Semi, total_qty: Math.max(0, (Number(s1Semi.total_qty) || 0) - actualNeed) })
        }
      }

      if (actualBz > 0) {
        let remainingBz = actualBz
        const s1Wip = findItem('wip_bz')
        if (s1Wip) {
          const take = Math.min(Number(s1Wip.total_qty) || 0, remainingBz)
          invUpdates.push({ ...s1Wip, total_qty: Math.max(0, (Number(s1Wip.total_qty) || 0) - take) })
          remainingBz -= take
        }
        if (remainingBz > 0) {
          const s1Bz = findItem('bz')
          if (s1Bz) {
            const take = Math.min(Number(s1Bz.total_qty) || 0, remainingBz)
            invUpdates.push({ ...s1Bz, total_qty: Math.max(0, (Number(s1Bz.total_qty) || 0) - take) })
          }
        }
      }

      if (actualNeed > 0) {
        const s2Semi = findItem('semi_shop2')
        if (s2Semi) {
          invUpdates.push({ ...s2Semi, total_qty: (Number(s2Semi.total_qty) || 0) + actualNeed })
        } else {
          const nom = nomenclatures.find(n => n.id === currentCard.nomenclature_id)
          invInserts.push({
            nomenclature_id: currentCard.nomenclature_id,
            name: nom?.name || 'Деталь',
            total_qty: actualNeed,
            reserved_qty: 0,
            type: 'semi_shop2',
            unit: nom?.unit || 'шт'
          })
        }
      }

      if (actualBz > 0) {
        const s2Bz = findItem('bz_shop2')
        if (s2Bz) {
          invUpdates.push({ ...s2Bz, total_qty: (Number(s2Bz.total_qty) || 0) + actualBz })
        } else {
          const nom = nomenclatures.find(n => n.id === currentCard.nomenclature_id)
          invInserts.push({
            nomenclature_id: currentCard.nomenclature_id,
            name: nom?.name || 'Деталь',
            total_qty: actualBz,
            reserved_qty: 0,
            type: 'bz_shop2',
            unit: nom?.unit || 'шт'
          })
        }
      }

      if (scrapCount > 0) {
        const scrapItem = findItem('scrap_ready')
        if (scrapItem) {
          invUpdates.push({ ...scrapItem, total_qty: (Number(scrapItem.total_qty) || 0) + scrapCount, updated_at: new Date().toISOString() })
        } else {
          const nom = nomenclatures.find(n => n.id === currentCard.nomenclature_id)
          invInserts.push({
            name: nom?.name || 'Деталь',
            unit: nom?.unit || 'шт',
            total_qty: scrapCount,
            type: 'scrap_ready',
            nomenclature_id: currentCard.nomenclature_id
          })
        }
      }

      const historyToInsert = []
      historyToInsert.push({
        card_id: currentCard.id,
        nomenclature_id: currentCard.nomenclature_id,
        stage_name: 'Сортування',
        operator_name: op,
        qty_at_start: currentCard.quantity,
        qty_completed: goodQty,
        scrap_qty: scrapCount,
        started_at: currentCard.started_at || new Date().toISOString(),
        completed_at: currentCard.completed_at || new Date().toISOString(),
        is_archived_scrap: scrapCount > 0,
        shift_name: activeShift,
        manager_name: currentCard.manager_name,
        machine_name: currentCard.machine
      })

      const bufferStart = currentCard.completed_at || currentCard.started_at || new Date().toISOString()
      historyToInsert.push({
        card_id: currentCard.id,
        nomenclature_id: currentCard.nomenclature_id,
        stage_name: 'Буфер Сортування',
        operator_name: op,
        qty_at_start: goodQty,
        qty_completed: goodQty,
        scrap_qty: 0,
        started_at: bufferStart,
        completed_at: new Date().toISOString(),
        shift_name: activeShift,
        manager_name: currentCard.manager_name,
        machine_name: currentCard.machine
      })

      let shop2TaskId = null
      const writePromises = []

      writePromises.push(
        supabase.from('work_cards').update({
          status: 'at-shop2-buffer',
          operation: 'Сортування',
          quantity: goodQty + reworkCount,
          used_in_shop2_qty: reworkCount,
          completed_at: new Date().toISOString()
        }).eq('id', currentCard.id)
      )

      let updatedArrivals = []
      const nom = nomenclatures.find(n => n.id === currentCard.nomenclature_id)

      if (!shop2Tasks || shop2Tasks.length === 0) {
        if (s1TaskData) {
          shop2TaskId = generateUUID()
          updatedArrivals = [{
            id: currentCard.nomenclature_id,
            name: nom?.name || 'Деталь',
            semi: actualNeed,
            bz: actualBz
          }]
          
          writePromises.push(
            supabase.from('tasks').insert([{
              id: shop2TaskId,
              order_id: currentCard.order_id,
              step: 'Пресування [ЦЕХ №2]',
              status: 'in-progress',
              planned_sets: s1TaskData.planned_sets || 0,
              estimated_time: s1TaskData.estimated_time || 0,
              engineer_conf: true,
              warehouse_conf: 'true',
              director_conf: true,
              batch_index: s1TaskData.batch_index || null,
              plan_snapshot: { ...(s1TaskData.plan_snapshot || {}), arrivals: updatedArrivals }
            }])
          )
        }
      } else {
        shop2TaskId = shop2Tasks[0].id
        const existingArrivals = shop2Tasks[0]?.plan_snapshot?.arrivals || []
        updatedArrivals = [...existingArrivals]
        const matchIdx = updatedArrivals.findIndex(a => String(a.id) === String(currentCard.nomenclature_id))
        if (matchIdx >= 0) {
          updatedArrivals[matchIdx] = {
            ...updatedArrivals[matchIdx],
            semi: (Number(updatedArrivals[matchIdx].semi) || 0) + actualNeed,
            bz: (Number(updatedArrivals[matchIdx].bz) || 0) + actualBz
          }
        } else {
          updatedArrivals.push({
            id: currentCard.nomenclature_id,
            name: nom?.name || 'Деталь',
            semi: actualNeed,
            bz: actualBz
          })
        }

        writePromises.push(
          supabase.from('tasks').update({
            status: 'in-progress',
            plan_snapshot: {
              ...(shop2Tasks[0].plan_snapshot || {}),
              arrivals: updatedArrivals
            }
          }).eq('id', shop2Tasks[0].id)
        )
      }

      if (reworkCount > 0) {
        writePromises.push(
          supabase.from('work_cards').insert([{
            task_id: shop2TaskId || currentCard.task_id,
            order_id: currentCard.order_id,
            nomenclature_id: currentCard.nomenclature_id,
            operation: 'Доопрацювання',
            quantity: reworkCount,
            status: 'new',
            card_info: `[ЦЕХ №2] Автоматично з Сортування`
          }])
        )
      }

      if (invUpdates.length > 0) writePromises.push(supabase.from('inventory').upsert(invUpdates))
      if (invInserts.length > 0) writePromises.push(supabase.from('inventory').insert(invInserts))
      writePromises.push(supabase.from('work_card_history').insert(historyToInsert))

      const results = await Promise.all(writePromises)
      for (const res of results) {
        if (res.error) throw res.error
      }

      setScrapCount(0)
      setReworkCount(0)
      setSelectedCardId(null)
      setScannedIds(prev => prev.filter(id => id !== currentCard.id))
      fetchData(['work_cards', 'work_card_history', 'inventory']).catch(() => {})
      setIsProcessing(false)
      alert(`✅ ${goodQty} шт відправлено в буфер Цеху №2!`)
    } catch (e) {
      console.error('Sort to shop2 error:', e)
      setIsProcessing(false)
      alert('Помилка сортування: ' + e.message)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleAcceptToStock = async () => {
    if (!currentCard) return
    setIsProcessing(true)
    try {
      const qtyDone = currentCard.quantity || 0
      const op = selectedOperator || currentCard.operator_name || 'Прийомка'
      const promises = []

      if (currentCard.status === 'at-buffer') {
        const bufferStart = currentCard.completed_at || currentCard.started_at || new Date().toISOString()
        promises.push(
          supabase.from('work_card_history').insert([{
            card_id: currentCard.id,
            nomenclature_id: currentCard.nomenclature_id,
            stage_name: 'Буфер Галтовки',
            operator_name: op,
            qty_at_start: qtyDone,
            qty_completed: qtyDone,
            scrap_qty: 0,
            started_at: bufferStart,
            completed_at: new Date().toISOString(),
            shift_name: currentCard.shift_name,
            manager_name: currentCard.manager_name,
            machine_name: currentCard.machine
          }])
        )
      }

      promises.push(
        supabase.from('work_card_history').insert([{
          card_id: currentCard.id,
          nomenclature_id: currentCard.nomenclature_id,
          stage_name: 'Прийомка',
          operator_name: op,
          qty_at_start: qtyDone,
          qty_completed: qtyDone,
          scrap_qty: 0,
          started_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
          is_archived_scrap: true,
          shift_name: currentCard.shift_name,
          manager_name: currentCard.manager_name,
          machine_name: currentCard.machine
        }])
      )

      promises.push(
        supabase.from('work_cards').update({
          status: 'at-buffer',
          operation: 'Прийомка',
          operator_name: op,
          completed_at: new Date().toISOString()
        }).eq('id', currentCard.id)
      )

      const results = await Promise.all(promises)
      for (const res of results) {
        if (res.error) throw res.error
      }

      setSelectedCardId(null)
      setScannedIds(prev => prev.filter(id => id !== currentCard.id))
      fetchData(['work_cards', 'work_card_history']).catch(() => {})
    } catch (e) {
      console.error('Acceptance error:', e)
      setIsProcessing(false)
      alert('Помилка прийомки: ' + (e.message || 'Невідома помилка'))
    } finally {
      setIsProcessing(false)
    }
  }

  const handleQCScrapOverride = async () => {
    if (!currentCard || qcScrapCount <= 0) return
    if (qcScrapCount > currentCard.quantity) {
      alert('Кількість браку не може перевищувати поточну кількість деталей у картці!')
      return
    }
    setIsProcessing(true)
    try {
      const reasonText = qcReason === 'Інше (коментар)'
        ? `Інше (${qcCustomReason || 'без коментаря'})`
        : qcReason
      const op = `ВКЯ (${qcInspector || 'відповідальний'}) — Причина: ${reasonText}`
      const newQty = Math.max(0, currentCard.quantity - qcScrapCount)

      const promises = []

      promises.push(
        supabase.from('work_card_history').insert([{
          card_id: currentCard.id,
          nomenclature_id: currentCard.nomenclature_id,
          stage_name: 'Контроль ВКЯ',
          operator_name: op,
          qty_at_start: currentCard.quantity,
          qty_completed: newQty,
          scrap_qty: qcScrapCount,
          started_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
          is_archived_scrap: true,
          shift_name: currentCard.shift_name,
          manager_name: currentCard.manager_name,
          machine_name: currentCard.machine,
          qc_scrap_reason: qcReason,
          qc_scrap_comment: qcReason === 'Інше (коментар)' ? qcCustomReason : null
        }])
      )

      const updatePayload = { quantity: newQty }
      if (newQty === 0) {
        updatePayload.status = 'completed'
      }
      promises.push(
        supabase.from('work_cards').update(updatePayload).eq('id', currentCard.id)
      )

      promises.push(
        updateInventoryStock(currentCard.nomenclature_id, qcScrapCount, 'scrap_ready')
      )

      const results = await Promise.all(promises)
      for (const res of results) {
        if (res.error) throw res.error
      }

      setShowQCModal(false)
      setQcScrapCount(0)
      setQcInspector('')
      setQcReason('Биття цанги')
      setQcCustomReason('')
      fetchData(['work_cards', 'work_card_history', 'inventory', 'tasks']).catch(() => {})
      if (newQty === 0) {
        setSelectedCardId(null)
        setScannedIds(prev => prev.filter(id => id !== currentCard.id))
      }
      setIsProcessing(false)
      alert(`✅ Успішно списано ${qcScrapCount} шт у брак за рішенням ВКЯ!`)
    } catch (e) {
      console.error('QC error:', e)
      setIsProcessing(false)
      alert('Помилка фіксації браку ВКЯ: ' + e.message)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleArchiveStageScrap = async (stage, nomId) => {
    const unarchivedScrap = workCardHistory.filter(h => (stage === 'Галтовка' ? h.stage_name?.startsWith('Галтовка') : h.stage_name === stage) && String(h.nomenclature_id) === String(nomId) && !h.is_archived_scrap && Number(h.scrap_qty) > 0)
    const totalQty = unarchivedScrap.reduce((acc, h) => acc + Number(h.scrap_qty), 0)

    if (totalQty === 0) return
    setIsProcessing(true)

    try {
      await updateInventoryStock(nomId, totalQty, 'scrap_ready')
      const idsToMark = unarchivedScrap.map(h => h.id)
      const { error } = await supabase.from('work_card_history').update({ is_archived_scrap: true }).in('id', idsToMark)
      if (error) throw error

      fetchData(['inventory', 'work_card_history']).catch(() => {})
    } catch (err) {
      console.error('Archive scrap error:', err)
      alert('Помилка архівації браку: ' + err.message)
    } finally {
      setIsProcessing(false)
    }
  }

  return {
    handleStart,
    handleShiftChange,
    handlePauseCard,
    handleResumeCard,
    handleCompleteToBuffer,
    handleStartNext,
    handleRequestRework,
    handleFinishSortingActive,
    handleSortToShop2,
    handleAcceptToStock,
    handleQCScrapOverride,
    handleArchiveStageScrap
  }
}
