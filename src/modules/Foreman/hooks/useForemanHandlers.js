import { useEffect } from 'react'
import { findMachineByName } from '../utils/foremanHelpers'

export function useForemanHandlers({
  // From useMES
  createWorkCard,
  createWorkCardsBatch,
  completeTaskByMaster,
  confirmBuffer,
  reserveBZForTask,
  createDovyпускMaterialRequests,
  tasks,
  orders,
  workCards,
  inventory,
  nomenclatures,
  bomItems,
  machines,
  machineOperations,
  workCardHistory,

  // From useForemanData / State
  relevantTasks,
  allOrdersMap,
  setAllOrdersMap,
  setReportTaskId,
  setShowReportModal,
  setReportStageFilter,
  setReportNomFilter,
  setReportSortBy,
  setReportOperatorFilter,
  setReportData,
  setReportLoading,
  setPrintNaryadQueue,
  setNaryadPrintLoading,
  setIsChangingMachine,
  setCustomAlert,
  setChangeMachineTaskId,
  setIsGenerating,
  setGenModal,
  setPrintQueue,
  setBufferScrapModal,
  setBufferScrapCounts,
  bufferScrapModal,
  bufferScrapCounts,
  saveTimeoutRef,
  setEditingSplits,

  // Refs & Cache
  generatingLockRef,
  cardScrapCache,

  // API & Supabase
  supabase,
  apiService,

  // Methods
  fetchData,
  fetchModuleData
}) {

  const handleResolveCall = async (callId, currentUser) => {
    const resolverName = currentUser ? `${currentUser.first_name || ''} ${currentUser.last_name || ''}`.trim() : 'Майстер зміни'
    const { error } = await supabase
      .from('machine_calls')
      .update({
        status: 'resolved',
        resolved_at: new Date().toISOString(),
        resolved_by: resolverName
      })
      .eq('id', callId)
    if (error) {
      alert('Помилка при вирішенні виклику: ' + error.message)
    }
  }

  const handleOpenReport = async (task, order, taskCards, forceRefresh = false) => {
    setReportTaskId(task.id)
    setShowReportModal(true)
    setReportStageFilter('All')
    setReportNomFilter('All')
    setReportSortBy('date')
    setReportOperatorFilter('All')

    const cached = task?.plan_snapshot?._report_snapshot
    if (cached && !forceRefresh) {
      setReportData(cached)
      if (task.status === 'completed') {
        setReportLoading(false)
        return
      }
    }

    setReportLoading(true)
    if (!cached || forceRefresh) {
      setReportData(null)
    }

    try {
      const { data: materialRequests, error: reqError } = await supabase
        .from('material_requests')
        .select('*, nomenclature:nomenclatures(*)')
        .eq('task_id', task.id)

      if (reqError) console.warn('Error fetching material requests:', reqError.message)

      const { data: allTaskCardsDB } = await supabase
        .from('work_cards')
        .select('id')
        .eq('task_id', task.id)
        .limit(10000)

      const stateCardIds = taskCards.map(c => c.id)
      const dbCardIds = (allTaskCardsDB || []).map(c => c.id)
      const allCardIds = [...new Set([...stateCardIds, ...dbCardIds])]

      if (allCardIds.length === 0) {
        const finalData = { historyRows: [], taskCards, materialRequests: materialRequests || [] }
        setReportData(finalData)
        setReportLoading(false)
        return
      }

      let historyRows = []
      for (let i = 0; i < allCardIds.length; i += 100) {
        const chunk = allCardIds.slice(i, i + 100)
        const { data: histChunk, error: histErr } = await supabase
          .from('work_card_history')
          .select('*')
          .in('card_id', chunk)
          .limit(10000)

        if (histErr) throw histErr
        if (histChunk) {
          historyRows = historyRows.concat(histChunk)
        }
      }

      historyRows.sort((a, b) => new Date(a.completed_at || 0) - new Date(b.completed_at || 0))

      const finalData = { historyRows: historyRows || [], taskCards, materialRequests: materialRequests || [] }
      setReportData(finalData)

      const updatedSnapshot = {
        ...(task.plan_snapshot || {}),
        _report_snapshot: finalData
      }

      await supabase.from('tasks').update({ plan_snapshot: updatedSnapshot }).eq('id', task.id)
    } catch (e) {
      console.error(e)
      if (!cached) {
        alert('Помилка завантаження звіту: ' + e.message)
      }
    } finally {
      setReportLoading(false)
    }
  }

  const handleOpenNaryadPrint = async (task, order) => {
    setNaryadPrintLoading(true)
    try {
      const { data: materialRequests, error: reqError } = await supabase
        .from('material_requests')
        .select('*, nomenclature:nomenclatures(*)')
        .eq('task_id', task.id)

      if (reqError) console.warn('Error fetching material requests:', reqError.message)

      setPrintNaryadQueue({
        task,
        order,
        materialRequests: materialRequests || []
      })
    } catch (e) {
      console.error(e)
      alert('Помилка завантаження даних наряду: ' + e.message)
    } finally {
      setNaryadPrintLoading(false)
    }
  }

  const handleChangeTaskMachine = async (taskId, newMachine) => {
    const task = relevantTasks.find(t => t.id === taskId) || tasks.find(t => t.id === taskId)
    if (!task || !newMachine) return

    setIsChangingMachine(true)
    try {
      const { data: matReqs, error: fetchReqsErr } = await supabase
        .from('material_requests')
        .select('*')
        .eq('task_id', taskId)

      if (fetchReqsErr) throw fetchReqsErr

      const cutterRequests = (matReqs || []).filter(r => {
        if (!r.nomenclature_id) return false
        const nom = nomenclatures.find(n => n.id === r.nomenclature_id)
        return nom?.name?.toLowerCase()?.includes('фреза')
      })

      const inventoryUpdates = []
      for (const req of cutterRequests) {
        if (req.inventory_id && req.status === 'issued') {
          const { data: invItem } = await supabase
            .from('inventory')
            .select('*')
            .eq('id', req.inventory_id)
            .maybeSingle()

          if (invItem) {
            const newReserved = Math.max(0, (Number(invItem.reserved_qty) || 0) - Number(req.quantity))
            inventoryUpdates.push(
              supabase.from('inventory').update({ reserved_qty: newReserved }).eq('id', invItem.id)
            )
          }
        }
      }

      if (inventoryUpdates.length > 0) {
        await Promise.all(inventoryUpdates)
      }

      const cutterRequestIds = cutterRequests.map(r => r.id)
      if (cutterRequestIds.length > 0) {
        const { error: delErr } = await supabase
          .from('material_requests')
          .delete()
          .in('id', cutterRequestIds)
        if (delErr) throw delErr
      }

      const snapshot = { ...(task.plan_snapshot || {}) }
      const newMachineSpecificCutters = {}
      let hasMachineSpecificCutters = false
      const partIds = Object.keys(snapshot).filter(k => !k.startsWith('_') && k !== 'materialSummary' && k !== 'selectedCutters' && k !== 'consumables')

      partIds.forEach(partId => {
        const partInfo = snapshot[partId]
        const sheetsNeeded = Number(partInfo.sheets) || 0
        if (sheetsNeeded <= 0) return

        partInfo.selected_machine = newMachine

        const opData = machineOperations?.find(o =>
          String(o.nomenclature_id) === String(partId) &&
          (o.machine_type === newMachine || o.machine_id === newMachine)
        )

        if (opData && opData.side2_cut_ops) {
          const cutterOps = opData.side2_cut_ops.filter(op => op.startsWith('__CUTTER__Reference:') || op.startsWith('__CUTTER__:'))
          cutterOps.forEach(op => {
            const parts = op.split(':')
            const cutterNomId = parts[1]
            const qtyPerSheet = parseFloat(parts[2]) || 0
            if (cutterNomId && qtyPerSheet > 0) {
              hasMachineSpecificCutters = true
              const totalQty = Math.ceil(sheetsNeeded * qtyPerSheet)
              let cutterNom = nomenclatures.find(n => String(n.id) === String(cutterNomId))

              if (cutterNom) {
                const nl = cutterNom.name.toLowerCase()
                const m1 = nl.match(/ф\s*([0-9,.]+)/)
                const m2 = nl.match(/(?:кукурудза|двопера|однопера|спіральна|торцева|шарова|радіусна)?\s*([0-9][0-9,]*)(?:\s*[×xх×])/)
                const d = m1 ? parseFloat(m1[1].replace(',', '.')) : (m2 ? parseFloat(m2[1].replace(',', '.')) : null)

                if (partInfo.cutter_override !== '1.5' && d && Math.abs(d - 1.5) < 0.01) {
                  return // skip
                }
                if (partInfo.cutter_override === '1.5' && d && Math.abs(d - 2) < 0.01) {
                  cutterNom = { ...cutterNom, name: 'Фреза ф1.5', id: '__synthetic_f1.5__' }
                }
              }

              if (cutterNom) {
                const cleanName = cutterNom.name.trim()
                const key = cleanName.toLowerCase()
                if (!newMachineSpecificCutters[key]) {
                  newMachineSpecificCutters[key] = { name: cleanName, qty: 0, nomenclature_id: cutterNom.id }
                }
                newMachineSpecificCutters[key].qty += totalQty
              }
            }
          })
        }
      })

      const requestsToInsert = []
      const newConsumablesSnapshot = []

      const shouldAutoReserve = task.warehouse_conf && task.engineer_conf && task.director_conf
      const newStatus = 'pending'

      const newInventoryReservations = []

      for (const item of Object.values(newMachineSpecificCutters)) {
        const isSynthetic = String(item.nomenclature_id).startsWith('__synthetic')
        const invItem = isSynthetic ? null : (
          inventory.find(i => String(i.nomenclature_id) === String(item.nomenclature_id) && i.warehouse === 'operational') ||
          inventory.find(i => String(i.nomenclature_id) === String(item.nomenclature_id))
        )

        requestsToInsert.push({
          order_id: task.order_id,
          task_id: task.id,
          quantity: item.qty,
          status: newStatus,
          inventory_id: invItem?.id || null,
          nomenclature_id: isSynthetic ? null : item.nomenclature_id,
          details: `ВИТРАТНІ МАТЕРІАЛИ ДЛЯ ${task.id}: ${item.name} — ${item.qty} од. (ПІСЛЯ ЗМІНИ ВЕРСТАТА)`
        })

        newConsumablesSnapshot.push({ name: item.name, total: item.qty })

        if (shouldAutoReserve && invItem) {
          const currentReserved = Number(invItem.reserved_qty) || 0
          newInventoryReservations.push(
            supabase.from('inventory').update({ reserved_qty: currentReserved + item.qty }).eq('id', invItem.id)
          )
        }
      }

      const totalSheets = Object.values(snapshot.materialSummary || {}).reduce((acc, m) => acc + (Number(m.sheets) || 0), 0)
      if (totalSheets > 0) {
        nomenclatures.filter(n => n.type === 'consumable' && (Number(n.consumption_per_sheet) || 0) > 0 && n.name.trim().toLowerCase() !== 'фреза' && (n.name.toLowerCase().startsWith('лист') || n.name.toLowerCase().includes('фреза'))).forEach(cons => {
          if (hasMachineSpecificCutters && cons.name.toLowerCase().includes('фреза')) return
          const neededQty = Math.ceil(totalSheets * Number(cons.consumption_per_sheet))
          newConsumablesSnapshot.push({ name: cons.name.trim(), total: neededQty })
        })
      }

      if (requestsToInsert.length > 0) {
        const { error: insErr } = await supabase.from('material_requests').insert(requestsToInsert)
        if (insErr) throw insErr
      }

      snapshot.consumables = newConsumablesSnapshot
      const { error: taskUpdErr } = await supabase
        .from('tasks')
        .update({
          machine_name: newMachine,
          plan_snapshot: snapshot
        })
        .eq('id', taskId)

      if (taskUpdErr) throw taskUpdErr

      const { error: cardsUpdErr } = await supabase
        .from('work_cards')
        .update({ machine: newMachine })
        .eq('task_id', taskId)
        .neq('status', 'completed')

      if (cardsUpdErr) throw cardsUpdErr

      setCustomAlert({ title: 'Верстат наряду змінено', message: '✅ Верстат наряду успішно змінено. Бронь зі старих фрез знято. Надіслано новий запит на СО для видачі нових фрез!' })
      setChangeMachineTaskId(null)
      fetchData(['tasks', 'material_requests', 'inventory', 'work_cards']).catch(() => {})
    } catch (e) {
      console.error(e)
      setCustomAlert({ title: 'Помилка', message: `Помилка при зміні верстата: ${e.message}` })
    } finally {
      setIsChangingMachine(false)
    }
  }

  const handleUpdateNomenclatureMachineAndRecalculate = async (task, nomId, newMachineName, newSplits = null) => {
    if (!task || !nomId) return
    setIsChangingMachine(true)

    try {
      const sId = String(nomId)
      const currentSnapshot = task.plan_snapshot || {}
      const entry = { ...(currentSnapshot[sId] || {}) }

      if (newMachineName !== null) {
        entry.machine = newMachineName
        entry.selected_machine = newMachineName
        entry.splits = []
      }
      if (newSplits !== null) {
        entry.splits = newSplits
      }

      const bzInv = (inventory || []).find(i => String(i.nomenclature_id) === String(nomId) && i.type === 'bz' && String(i.pocket_owner) === String(task.order_id))
      const stockBZ = bzInv ? Math.max(0, (Number(bzInv.total_qty) || 0) - (Number(bzInv.reserved_qty) || 0)) : 0
      entry.stock = stockBZ
      entry.plan = Math.max(0, (entry.need || 0) - stockBZ)

      const snapshotPartNom = nomenclatures.find(n => String(n.id) === String(nomId))
      const unitsPerSheet = Number(entry.units_per_sheet || snapshotPartNom?.units_per_sheet) || 1
      entry.sheets = Math.ceil(entry.plan / unitsPerSheet)

      const updatedSnapshot = {
        ...currentSnapshot,
        [sId]: entry
      }

      const cardMachine = newMachineName !== null ? newMachineName : (newSplits && newSplits[0]?.machine ? newSplits[0].machine : task.machine_name)
      await supabase
        .from('work_cards')
        .update({ machine: cardMachine })
        .eq('task_id', task.id)
        .eq('nomenclature_id', nomId)
        .neq('status', 'completed')

      const { data: matReqs, error: fetchReqsErr } = await supabase
        .from('material_requests')
        .select('*')
        .eq('task_id', task.id)

      if (fetchReqsErr) throw fetchReqsErr

      const cutterRequests = (matReqs || []).filter(r => {
        if (!r.nomenclature_id) return false
        const nom = nomenclatures.find(n => n.id === r.nomenclature_id)
        return nom?.name?.toLowerCase()?.includes('фреза')
      })

      const inventoryUpdates = []
      for (const req of cutterRequests) {
        if (req.inventory_id && req.status === 'issued') {
          const { data: invItem } = await supabase
            .from('inventory')
            .select('*')
            .eq('id', req.inventory_id)
            .maybeSingle()

          if (invItem) {
            const newReserved = Math.max(0, (Number(invItem.reserved_qty) || 0) - Number(req.quantity))
            inventoryUpdates.push(
              supabase.from('inventory').update({ reserved_qty: newReserved }).eq('id', invItem.id)
            )
          }
        }
      }

      if (inventoryUpdates.length > 0) {
        await Promise.all(inventoryUpdates)
      }

      const cutterRequestIds = cutterRequests.map(r => r.id)
      if (cutterRequestIds.length > 0) {
        const { error: delErr } = await supabase
          .from('material_requests')
          .delete()
          .in('id', cutterRequestIds)
        if (delErr) throw delErr
      }

      const newMachineSpecificCutters = {}
      let hasMachineSpecificCutters = false
      const partIds = Object.keys(updatedSnapshot).filter(k => !k.startsWith('_') && k !== 'materialSummary' && k !== 'selectedCutters' && k !== 'consumables')

      partIds.forEach(partId => {
        const partInfo = updatedSnapshot[partId]
        const sheetsNeeded = Number(partInfo.sheets) || 0
        if (sheetsNeeded <= 0) return

        const pSplits = partInfo.splits || []
        const isPartSplit = pSplits.length > 0

        const processCutterOps = (targetMach, sheetsForMachine) => {
          const opData = machineOperations?.find(o =>
            String(o.nomenclature_id) === String(partId) &&
            (o.machine_type === targetMach || o.machine_id === targetMach)
          )

          if (opData && opData.side2_cut_ops) {
            const cutterOps = opData.side2_cut_ops.filter(op => op.startsWith('__CUTTER__Reference:') || op.startsWith('__CUTTER__:'))
            cutterOps.forEach(op => {
              const parts = op.split(':')
              const cutterNomId = parts[1]
              const qtyPerSheet = parseFloat(parts[2]) || 0
              if (cutterNomId && qtyPerSheet > 0) {
                hasMachineSpecificCutters = true
                const totalQty = Math.ceil(sheetsForMachine * qtyPerSheet)
                let cutterNom = nomenclatures.find(n => String(n.id) === String(cutterNomId))

                if (cutterNom) {
                  const nl = cutterNom.name.toLowerCase()
                  const m1 = nl.match(/ф\s*([0-9,.]+)/)
                  const m2 = nl.match(/(?:кукурудза|двопера|однопера|спіральна|торцева|шарова|радіусна)?\s*([0-9][0-9,]*)(?:\s*[×xх×])/)
                  const d = m1 ? parseFloat(m1[1].replace(',', '.')) : (m2 ? parseFloat(m2[1].replace(',', '.')) : null)

                  if (partInfo.cutter_override !== '1.5' && d && Math.abs(d - 1.5) < 0.01) {
                    return // skip
                  }
                  if (partInfo.cutter_override === '1.5' && d && Math.abs(d - 2) < 0.01) {
                    cutterNom = { ...cutterNom, name: 'Фреза ф1.5', id: '__synthetic_f1.5__' }
                  }
                }

                if (cutterNom) {
                  const cleanName = cutterNom.name.trim()
                  const key = cleanName.toLowerCase()
                  if (!newMachineSpecificCutters[key]) {
                    newMachineSpecificCutters[key] = { name: cleanName, qty: 0, nomenclature_id: cutterNom.id }
                  }
                  newMachineSpecificCutters[key].qty += totalQty
                }
              }
            })
          }
        }

        if (isPartSplit) {
          pSplits.forEach(s => {
            const sSheets = Number(s.sheets) || 0
            if (sSheets > 0 && s.machine) {
              processCutterOps(s.machine, sSheets)
            }
          })
        } else {
          const targetMach = partInfo.selected_machine || partInfo.machine || task.machine_name
          processCutterOps(targetMach, sheetsNeeded)
        }
      })

      const requestsToInsert = []
      const newConsumablesSnapshot = []

      const shouldAutoReserve = task.warehouse_conf && task.engineer_conf && task.director_conf
      const newStatus = 'pending'

      for (const item of Object.values(newMachineSpecificCutters)) {
        const isSynthetic = String(item.nomenclature_id).startsWith('__synthetic')
        const invItem = isSynthetic ? null : (
          inventory.find(i => String(i.nomenclature_id) === String(item.nomenclature_id) && i.warehouse === 'operational') ||
          inventory.find(i => String(i.nomenclature_id) === String(item.nomenclature_id))
        )

        requestsToInsert.push({
          order_id: task.order_id,
          task_id: task.id,
          quantity: item.qty,
          status: newStatus,
          inventory_id: invItem?.id || null,
          nomenclature_id: isSynthetic ? null : item.nomenclature_id,
          details: `ВИТРАТНІ МАТЕРІАЛИ ДЛЯ ${task.id}: ${item.name} — ${item.qty} од. (ДЕТАЛЬНА ЗМІНА ВЕРСТАТА)`
        })

        newConsumablesSnapshot.push({ name: item.name, total: item.qty })
      }

      const totalSheets = Object.values(updatedSnapshot.materialSummary || {}).reduce((acc, m) => acc + (Number(m.sheets) || 0), 0)
      if (totalSheets > 0) {
        nomenclatures.filter(n => n.type === 'consumable' && (Number(n.consumption_per_sheet) || 0) > 0 && n.name.trim().toLowerCase() !== 'фреза' && (n.name.toLowerCase().startsWith('лист') || n.name.toLowerCase().includes('фреза'))).forEach(cons => {
          if (hasMachineSpecificCutters && cons.name.toLowerCase().includes('фреза')) return
          const neededQty = Math.ceil(totalSheets * Number(cons.consumption_per_sheet))
          newConsumablesSnapshot.push({ name: cons.name.trim(), total: neededQty })
        })
      }

      if (requestsToInsert.length > 0) {
        const { error: insErr } = await supabase.from('material_requests').insert(requestsToInsert)
        if (insErr) throw insErr
      }

      updatedSnapshot.consumables = newConsumablesSnapshot
      
      let hasPlan = false
      Object.keys(updatedSnapshot).forEach(k => {
        if (!k.startsWith('_') && k !== 'materialSummary' && k !== 'selectedCutters' && k !== 'consumables') {
          if ((Number(updatedSnapshot[k]?.plan) || 0) > 0) hasPlan = true
        }
      })

      const updateFields = {
        plan_snapshot: updatedSnapshot
      }
      if (hasPlan && task.status === 'completed') {
        updateFields.status = 'in-progress'
        updateFields.completed_at = null
      }

      const { error: taskUpdErr } = await supabase
        .from('tasks')
        .update(updateFields)
        .eq('id', task.id)

      if (taskUpdErr) throw taskUpdErr

      setCustomAlert({ title: 'Верстат деталі змінено', message: '✅ Верстат/розподіл для деталі успішно змінено. Бронь зі старих фрез знято. Надіслано новий запит на СО для видачі нових фрез!' })
      fetchData(['tasks', 'material_requests', 'inventory', 'work_cards']).catch(() => {})
    } catch (e) {
      console.error(e)
      setCustomAlert({ title: 'Помилка', message: `Помилка при перерахунку фрез: ${e.message}` })
    } finally {
      setIsChangingMachine(false)
    }
  }

  const handleGenerateFromWorksheet = async (task, part, sheets, selectedMachineName, count, localGeneratedCount = 0, totalToReach = 0, isRepair = false, globalTotalCards = null, globalSeqOffset = 0, customCapacity = null) => {
    if (generatingLockRef.current) {
      console.warn("Generation already in progress, ignoring duplicate call.")
      return
    }
    generatingLockRef.current = true

    const machinesList = machines || []
    const baseName = (selectedMachineName || '').split(' №')[0].trim()
    let machineObj = machinesList.find(m => m.name === baseName) || machinesList.find(m => m.name === selectedMachineName)
    
    const capacity = customCapacity !== null ? Number(customCapacity) : (Number(machineObj?.sheet_capacity) || 1)
    const unitsPerSheet = Number(part.nom?.units_per_sheet) || 1

    const maxCardsForThisSplit = Math.ceil(sheets / capacity)
    const displayTotal = globalTotalCards || maxCardsForThisSplit

    let finalCount = Math.min(count, maxCardsForThisSplit - localGeneratedCount)
    if (finalCount <= 0) {
      generatingLockRef.current = false
      return
    }

    if (!isRepair) {
      let dbCardsCount = 0
      try {
        const { data, error } = await supabase
          .from('work_cards')
          .select('id, is_rework, operation')
          .eq('task_id', task.id)
          .eq('nomenclature_id', part.nom?.id)
        if (!error && data) {
          dbCardsCount = data.filter(c => !c.is_rework && c.operation !== 'Склад БЗ').length
        }
      } catch (err) {
        console.error("Error fetching dbCardsCount:", err)
      }
      finalCount = Math.min(finalCount, displayTotal - dbCardsCount)
    }

    if (finalCount <= 0) {
      generatingLockRef.current = false
      return
    }

    const existingNomenclatureCards = (workCards || []).filter(wc =>
      String(wc.task_id) === String(task.id) &&
      String(wc.nomenclature_id) === String(part.nom?.id)
    )

    let maxExistingSeq = 0
    existingNomenclatureCards.forEach(wc => {
      const match = (wc.card_info || '').match(/(\d+)\/(\d+)/)
      if (match) {
        const seq = parseInt(match[1])
        if (seq > maxExistingSeq) maxExistingSeq = seq
      }
    })

    const startSeqForThisBatch = maxExistingSeq + 1

    setIsGenerating(true)
    try {
      const cardsBatch = []
      let sheetsRemainingForThisSplit = sheets - (localGeneratedCount * capacity)

      const snapshotEntry = task.plan_snapshot?.[String(part.nom?.id)]
      const originalNeed = snapshotEntry?.need || totalToReach || 0

      let reqRemainingForThisSplit = originalNeed - (localGeneratedCount * capacity * unitsPerSheet)
      if (reqRemainingForThisSplit < 0) reqRemainingForThisSplit = 0

      for (let i = 1; i <= finalCount; i++) {
        const currentSeq = startSeqForThisBatch + (i - 1)
        const sheetsInThisLoading = Math.min(sheetsRemainingForThisSplit, capacity)
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

      const createdCards = await apiService.submitCreateWorkCardsBatch(task.id, task.order_id, part.nom.id, cardsBatch, createWorkCardsBatch)

      if (isRepair && sheets > 0) {
        const totalQty = finalCount * capacity * unitsPerSheet
        await createDovyпускMaterialRequests(task.id, task.order_id, part.nom, sheets, totalQty, selectedMachineName)
      }

      if (createdCards && createdCards.length > 0) {
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
    } catch (err) {
      alert('Помилка: ' + err.message)
    } finally {
      setTimeout(() => {
        setIsGenerating(false)
        setGenModal(null)
        generatingLockRef.current = false
      }, 500)
    }
  }

  const handleBufferReception = async (cardId) => {
    const card = workCards.find(c => String(c.id) === String(cardId))
    if (!card) { alert("Картку не знайдено!"); return }
    setBufferScrapModal({ cardId: card.id, nomenclature_id: card.nomenclature_id })
    setBufferScrapCounts({ [card.nomenclature_id]: 0 })
  }

  const submitBufferReception = async () => {
    if (!bufferScrapModal) return
    const scrap = bufferScrapCounts[bufferScrapModal.nomenclature_id] || 0
    try {
      await confirmBuffer(bufferScrapModal.cardId, scrap)
      setBufferScrapModal(null)
      fetchData(['work_cards', 'work_card_history', 'inventory', 'tasks'])
    } catch (err) {
      alert("Помилка: " + err.message)
    }
  }

  const handleReserveBZ = async (taskId, orderId, nomId, qty) => {
    if (!window.confirm(`Забронювати ${qty} шт. зі складу БЗ?`)) return
    try {
      await reserveBZForTask(taskId, orderId, nomId, qty)
      alert("Деталі заброньовано!")
    } catch (err) {
      alert("Помилка: " + err.message)
    }
  }

  const handleUpdateMachineInSnapshot = async (task, nomId, machineName = null, splits = null) => {
    if (!task || !nomId) return
    const sId = String(nomId)
    const currentSnapshot = task.plan_snapshot || {}

    const entry = { ...(currentSnapshot[sId] || {}) }
    if (machineName !== null) entry.machine = machineName
    if (splits !== null) entry.splits = splits

    const updatedSnapshot = {
      ...currentSnapshot,
      [sId]: entry
    }
    try {
      const { error } = await supabase.from('tasks').update({ plan_snapshot: updatedSnapshot }).eq('id', task.id)
      if (error) throw error
      if (!saveTimeoutRef.current) fetchData('tasks')
    } catch (err) { console.error("Snapshot error:", err) }
  }

  const debouncedUpdateSplits = (task, nomId, newSplits) => {
    setEditingSplits(prev => ({ ...prev, [nomId]: newSplits }))
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)

    saveTimeoutRef.current = setTimeout(() => {
      handleUpdateNomenclatureMachineAndRecalculate(task, nomId, null, newSplits)
      saveTimeoutRef.current = null
    }, 1000)
  }

  return {
    handleResolveCall,
    handleOpenReport,
    handleOpenNaryadPrint,
    handleChangeTaskMachine,
    handleUpdateNomenclatureMachineAndRecalculate,
    handleGenerateFromWorksheet,
    handleBufferReception,
    submitBufferReception,
    handleReserveBZ,
    handleUpdateMachineInSnapshot,
    debouncedUpdateSplits
  }
}
