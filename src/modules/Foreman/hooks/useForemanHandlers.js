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
  fetchModuleData,
  addLocalWorkCards
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
      // Completed requests are audit/history records and must never be rewritten
      // when only the remaining, not-yet-cut part of the task changes machine.
      const replaceableCutterRequests = cutterRequests.filter(r => r.status === 'pending' || r.status === 'issued')

      // --- Step 1: Fetch actual work cards to compute remaining sheets per part ---
      const { data: dbCards } = await supabase
        .from('work_cards')
        .select('nomenclature_id, quantity, is_rework, operation')
        .eq('task_id', taskId)

      const productionCards = (dbCards || []).filter(card => {
        const operation = String(card.operation || '').toLowerCase()
        return !card.is_rework && operation !== 'склад бз' && !operation.includes('склад bz')
      })

      const snapshot = { ...(task.plan_snapshot || {}) }
      const partIds = Object.keys(snapshot).filter(k => !k.startsWith('_') && k !== 'materialSummary' && k !== 'selectedCutters' && k !== 'consumables')
      const customCutters = snapshot.selectedCutters || {}

      // Build map: partId → already-generated sheets
      const generatedSheetsByPart = {}
      partIds.forEach(partId => {
        const partInfo = snapshot[partId]
        const unitsPerSheet = Number(partInfo?.units_per_sheet) || 1
        const cardsForPart = productionCards.filter(c => String(c.nomenclature_id) === String(partId))
        const generated = cardsForPart.reduce((sum, c) =>
          sum + Math.ceil((Number(c.quantity) || 0) / unitsPerSheet), 0)
        generatedSheetsByPart[partId] = generated
      })

      // --- Step 2: Release reservations on already-issued cutter requests ---
      const inventoryReleaseById = {}
      for (const req of replaceableCutterRequests.filter(r => r.status === 'issued')) {
        if (req.inventory_id) {
          inventoryReleaseById[req.inventory_id] = (inventoryReleaseById[req.inventory_id] || 0) + (Number(req.quantity) || 0)
        }
      }
      for (const [invId, releaseQty] of Object.entries(inventoryReleaseById)) {
        const { data: invRow, error: invFetchErr } = await supabase.from('inventory').select('id,reserved_qty').eq('id', invId).maybeSingle()
        if (invFetchErr) throw invFetchErr
        if (invRow) {
          const { error: releaseErr } = await supabase.from('inventory').update({ reserved_qty: Math.max(0, (Number(invRow.reserved_qty) || 0) - releaseQty) }).eq('id', invRow.id)
          if (releaseErr) throw releaseErr
        }
      }

      // --- Step 3: Delete all pending/issued cutter requests for clean recalculation ---
      const cutterRequestIds = replaceableCutterRequests.map(r => r.id)
      if (cutterRequestIds.length > 0) {
        const { error: delErr } = await supabase.from('material_requests').delete().in('id', cutterRequestIds)
        if (delErr) throw delErr
      }

      // --- Step 4: Compute cutter needs based on REMAINING sheets only ---
      const newMachineSpecificCutters = {}
      let hasMachineSpecificCutters = false

      partIds.forEach(partId => {
        const partInfo = snapshot[partId]
        const totalPlannedSheets = Number(partInfo.sheets) || 0
        const alreadyGenerated = generatedSheetsByPart[partId] || 0
        const remainingSheets = Math.max(0, totalPlannedSheets - alreadyGenerated)

        // Update snapshot machine for the part
        partInfo.selected_machine = newMachine

        if (remainingSheets <= 0) return  // nothing left to cut on new machine

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
              const neededQty = Math.ceil(remainingSheets * qtyPerSheet)
              let cutterNom = nomenclatures.find(n => String(n.id) === String(cutterNomId))

              if (cutterNom) {
                const nl = cutterNom.name.toLowerCase()
                const m1 = nl.match(/ф\s*([0-9,.]+)/)
                const m2 = nl.match(/(?:кукурудза|двопера|однопера|спіральна|торцева|шарова|радіусна)?\s*([0-9][0-9,]*)(?:\s*[×xх×])/)
                const d = m1 ? parseFloat(m1[1].replace(',', '.')) : (m2 ? parseFloat(m2[1].replace(',', '.')) : null)
                if (partInfo.cutter_override !== '1.5' && d && Math.abs(d - 1.5) < 0.01) return
                if (partInfo.cutter_override === '1.5' && d && Math.abs(d - 2) < 0.01) {
                  cutterNom = { ...cutterNom, name: 'Фреза ф1.5', id: '__synthetic_f1.5__' }
                }
              }

              if (cutterNom) {
                // Resolve generic cutter → specific inventory item from selectedCutters map
                let resolvedNomId = cutterNom.id
                let resolvedName = cutterNom.name.trim()
                const genericKey = cutterNom.name.trim()
                const customInvId = customCutters[genericKey] || customCutters[genericKey.toLowerCase()]
                if (customInvId) {
                  const inv = inventory.find(i => String(i.id) === String(customInvId))
                  if (inv) {
                    const specificNom = nomenclatures.find(n => String(n.id) === String(inv.nomenclature_id))
                    if (specificNom) { resolvedNomId = specificNom.id; resolvedName = specificNom.name.trim() }
                  }
                }

                const key = String(resolvedNomId)
                if (!newMachineSpecificCutters[key]) {
                  newMachineSpecificCutters[key] = { name: resolvedName, qty: 0, nomenclature_id: resolvedNomId }
                }
                newMachineSpecificCutters[key].qty += neededQty
              }
            }
          })
        }
      })

      // --- Step 5: Create requests for the FULL remaining need. If the task was
      // already warehouse-approved, reserve the available part immediately and
      // leave only the real deficit pending (yellow light).
      const requestsToInsert = []
      const newConsumablesSnapshot = []
      const shouldAutoReserve = (task.warehouse_conf === 'true' || task.warehouse_conf === 'partial') && task.engineer_conf === true && task.director_conf === true
      const reservationByInventoryId = {}

      for (const item of Object.values(newMachineSpecificCutters)) {
        const isSynthetic = String(item.nomenclature_id).startsWith('__synthetic')
        newConsumablesSnapshot.push({ name: item.name, total: item.qty })

        const stockRows = isSynthetic ? [] : inventory
          .filter(i => String(i.nomenclature_id) === String(item.nomenclature_id) && (i.warehouse === 'operational' || !i.warehouse))
          .map(i => ({
            ...i,
            free: Math.max(0, (Number(i.total_qty) || 0) - (Number(i.reserved_qty) || 0) + (Number(inventoryReleaseById[i.id]) || 0))
          }))
          .sort((a, b) => b.free - a.free)

        let remaining = item.qty
        if (shouldAutoReserve) {
          for (const invItem of stockRows) {
            if (remaining <= 0) break
            const take = Math.min(remaining, invItem.free)
            if (take <= 0) continue
            requestsToInsert.push({
              order_id: task.order_id,
              task_id: task.id,
              quantity: take,
              status: 'issued',
              inventory_id: invItem.id,
              nomenclature_id: item.nomenclature_id,
              details: `ВИТРАТНІ МАТЕРІАЛИ ДЛЯ ЗАЛИШКУ НАРЯДУ: ${item.name} — ${take} од. (ПІСЛЯ ЗМІНИ ВЕРСТАТА)`
            })
            reservationByInventoryId[invItem.id] = (reservationByInventoryId[invItem.id] || 0) + take
            remaining -= take
          }
        }

        if (remaining > 0) {
          const fallbackInv = stockRows[0] || null
          requestsToInsert.push({
            order_id: task.order_id,
            task_id: task.id,
            quantity: remaining,
            status: 'pending',
            inventory_id: fallbackInv?.id || null,
            nomenclature_id: isSynthetic ? null : item.nomenclature_id,
            details: `ВИТРАТНІ МАТЕРІАЛИ ДЛЯ ЗАЛИШКУ НАРЯДУ: ${item.name} — ${remaining} од. (ПІСЛЯ ЗМІНИ ВЕРСТАТА)`
          })
        }
      }

      const totalSheets = Object.values(snapshot.materialSummary || {}).reduce((acc, m) => acc + (Number(m.sheets) || 0), 0)
      if (totalSheets > 0) {
        nomenclatures
          .filter(n => n.type === 'consumable' && (Number(n.consumption_per_sheet) || 0) > 0 &&
            n.name.trim().toLowerCase() !== 'фреза' &&
            (n.name.toLowerCase().startsWith('лист') || n.name.toLowerCase().includes('фреза')))
          .forEach(cons => {
            if (hasMachineSpecificCutters && cons.name.toLowerCase().includes('фреза')) return
            newConsumablesSnapshot.push({ name: cons.name.trim(), total: Math.ceil(totalSheets * Number(cons.consumption_per_sheet)) })
          })
      }

      if (requestsToInsert.length > 0) {
        const { error: insErr } = await supabase.from('material_requests').insert(requestsToInsert)
        if (insErr) throw insErr
      }
      const newInventoryReservations = Object.entries(reservationByInventoryId).map(([inventoryId, qty]) => {
        const invItem = inventory.find(i => String(i.id) === String(inventoryId))
        const releasedOldQty = Number(inventoryReleaseById[inventoryId]) || 0
        const reservationBase = Math.max(0, (Number(invItem?.reserved_qty) || 0) - releasedOldQty)
        return supabase.from('inventory').update({ reserved_qty: reservationBase + qty }).eq('id', inventoryId)
      })
      if (newInventoryReservations.length > 0) {
        const reservationResults = await Promise.all(newInventoryReservations)
        const reservationError = reservationResults.find(result => result.error)?.error
        if (reservationError) throw reservationError
      }

      snapshot.consumables = newConsumablesSnapshot
      const { error: taskUpdErr } = await supabase
        .from('tasks')
        .update({ machine_name: newMachine, plan_snapshot: snapshot })
        .eq('id', taskId)
      if (taskUpdErr) throw taskUpdErr

      const { data: currentRequests, error: currentReqErr } = await supabase
        .from('material_requests')
        .select('status')
        .eq('task_id', taskId)
      if (currentReqErr) throw currentReqErr
      const allIssued = (currentRequests || []).length > 0 && currentRequests.every(r => r.status === 'issued' || r.status === 'completed')
      const someIssued = (currentRequests || []).some(r => r.status === 'issued' || r.status === 'completed')
      const nextWarehouseConf = allIssued ? 'true' : (someIssued ? 'partial' : 'false')
      const { error: whConfErr } = await supabase.from('tasks').update({ warehouse_conf: nextWarehouseConf }).eq('id', taskId)
      if (whConfErr) throw whConfErr

      // [PRESERVE HISTORY] Do NOT retroactively update machine on already-generated cards

      setCustomAlert({ title: 'Верстат наряду змінено', message: `✅ Верстат змінено. Запит на фрези відправлено лише для залишку невирізаних листів!` })
      setChangeMachineTaskId(null)
      fetchData(['tasks', 'material_requests', 'inventory', 'work_cards']).catch(() => {})
    } catch (e) {
      console.error(e)
      setCustomAlert({ title: 'Помилка', message: `Помилка при зміні верстата: ${e.message}` })
    } finally {
      setIsChangingMachine(false)
    }
  }


  const handleUpdateNomenclatureMachineAndRecalculate = async (task, nomId, newMachineName, newSplits = null, cutterSelection = {}) => {
    if (!task || !nomId) return
    setIsChangingMachine(true)

    const isCutterNom = (nom) => {
      const name = String(nom?.name || '').toLowerCase()
      return name.includes('фрез') || name.includes('cutter')
    }
    const findOperation = (partId, machineName) => {
      const target = String(machineName || '').toLowerCase().trim()
      return machineOperations?.find(op => {
        if (String(op.nomenclature_id) !== String(partId)) return false
        const type = String(op.machine_type || '').toLowerCase().trim()
        const id = String(op.machine_id || '').toLowerCase().trim()
        return type === target || id === target || (type && target.includes(type)) || (id && target.includes(id))
      })
    }
    const addRequirements = (map, partId, machineName, sheets, selectionMap = {}) => {
      const sheetCount = Number(sheets) || 0
      if (sheetCount <= 0 || !machineName) return
      const opData = findOperation(partId, machineName)
      const cutterOps = (opData?.side2_cut_ops || []).filter(op => op.startsWith('__CUTTER__Reference:') || op.startsWith('__CUTTER__:'))
      cutterOps.forEach(op => {
        const parts = op.split(':')
        const cutterNomId = parts[1]
        const qtyPerSheet = Number.parseFloat(parts[2]) || 0
        if (!cutterNomId || qtyPerSheet <= 0) return
        const genericNom = nomenclatures.find(n => String(n.id) === String(cutterNomId))
        if (!genericNom) return
        const selectedInventoryId = selectionMap[String(cutterNomId)]
          || selectionMap[genericNom.name]
          || selectionMap[genericNom.name.toLowerCase()]
        const selectedInventory = selectedInventoryId
          ? inventory.find(item => String(item.id) === String(selectedInventoryId))
          : null
        const selectedNom = selectedInventory
          ? nomenclatures.find(n => String(n.id) === String(selectedInventory.nomenclature_id))
          : null
        const resolvedNom = selectedNom || genericNom
        const key = String(resolvedNom.id)
        if (!map[key]) map[key] = {
          nomenclature_id: resolvedNom.id,
          inventory_id: selectedInventory?.id || null,
          name: resolvedNom.name,
          qty: 0
        }
        map[key].qty += Math.ceil(sheetCount * qtyPerSheet)
      })
    }

    try {
      const targetId = String(nomId)
      const currentSnapshot = task.plan_snapshot || {}
      const updatedSnapshot = { ...currentSnapshot }
      const targetEntry = { ...(currentSnapshot[targetId] || {}) }

      if (newMachineName !== null) {
        targetEntry.machine = newMachineName
        targetEntry.selected_machine = newMachineName
        targetEntry.splits = []
      }
      if (newSplits !== null) targetEntry.splits = newSplits
      const previousTargetSelections = currentSnapshot[targetId]?.selected_cutters || currentSnapshot.selectedCutters || {}
      targetEntry.selected_cutters = { ...previousTargetSelections }
      Object.entries(cutterSelection || {}).forEach(([genericId, inventoryId]) => {
        if (!inventoryId) return
        const genericNom = nomenclatures.find(n => String(n.id) === String(genericId))
        targetEntry.selected_cutters[String(genericId)] = inventoryId
        if (genericNom?.name) {
          targetEntry.selected_cutters[genericNom.name] = inventoryId
          targetEntry.selected_cutters[genericNom.name.toLowerCase()] = inventoryId
        }
      })
      updatedSnapshot[targetId] = targetEntry

      const { data: dbCards, error: cardsError } = await supabase
        .from('work_cards')
        .select('*')
        .eq('task_id', task.id)
      if (cardsError) throw cardsError

      const productionCards = (dbCards || []).filter(card => {
        const operation = String(card.operation || '').toLowerCase()
        return !card.is_rework && operation !== 'склад бз' && !operation.includes('склад bz')
      })

      const desiredCutters = {}
      const generatedSheetsByPart = {}
      const partIds = Object.keys(updatedSnapshot).filter(key =>
        !key.startsWith('_') && !['materialSummary', 'selectedCutters', 'consumables', 'arrivals', 'nomenclatures'].includes(key)
      )

      for (const partId of partIds) {
        const partInfo = updatedSnapshot[partId]
        if (!partInfo || typeof partInfo !== 'object') continue
        const partNom = nomenclatures.find(n => String(n.id) === String(partId))
        if (partNom && partNom.type !== 'part') continue
        const unitsPerSheet = Number(partInfo.units_per_sheet || partNom?.units_per_sheet) || 1
        const plannedSheets = Number(partInfo.sheets) || Math.ceil((Number(partInfo.plan) || 0) / unitsPerSheet)
        const cardsForPart = productionCards.filter(card => String(card.nomenclature_id) === String(partId))
        const existingSelections = currentSnapshot[partId]?.selected_cutters || currentSnapshot.selectedCutters || {}

        let generatedSheets = 0
        const generatedByMachine = {}
        cardsForPart.forEach(card => {
          const cardSheets = Number(card.actual_sheets || card.actualSheets) || Math.ceil((Number(card.quantity) || 0) / unitsPerSheet)
          if (cardSheets <= 0) return
          generatedSheets += cardSheets
          const machine = card.machine || partInfo.machine || partInfo.selected_machine || task.machine_name
          generatedByMachine[machine] = (generatedByMachine[machine] || 0) + cardSheets
          addRequirements(desiredCutters, partId, machine, cardSheets, existingSelections)
        })
        generatedSheetsByPart[String(partId)] = Math.min(plannedSheets, generatedSheets)

        const remainingSheets = Math.max(0, plannedSheets - generatedSheets)
        if (remainingSheets <= 0) continue

        const splits = Array.isArray(partInfo.splits) ? partInfo.splits.filter(split => split?.machine) : []
        if (splits.length > 0) {
          let sheetsLeft = remainingSheets
          splits.forEach((split, index) => {
            if (sheetsLeft <= 0) return
            const configured = Number(split.sheets) || 0
            const alreadyOnMachine = generatedByMachine[split.machine] || 0
            const splitRemaining = Math.max(0, configured - alreadyOnMachine)
            const allocated = index === splits.length - 1 ? sheetsLeft : Math.min(sheetsLeft, splitRemaining)
            addRequirements(desiredCutters, partId, split.machine, allocated, String(partId) === targetId ? targetEntry.selected_cutters : existingSelections)
            sheetsLeft -= allocated
          })
        } else {
          const machine = partInfo.selected_machine || partInfo.machine || task.machine_name
          addRequirements(desiredCutters, partId, machine, remainingSheets, String(partId) === targetId ? targetEntry.selected_cutters : existingSelections)
        }
      }

      targetEntry.generated_sheets = generatedSheetsByPart[targetId] || 0
      targetEntry.remaining_sheets = Math.max(0, (Number(targetEntry.sheets) || 0) - targetEntry.generated_sheets)

      const { data: requests, error: requestsError } = await supabase
        .from('material_requests')
        .select('*')
        .eq('task_id', task.id)
      if (requestsError) throw requestsError

      const activeCutterRequests = (requests || []).filter(request => {
        if (['completed', 'cancelled', 'rejected'].includes(request.status)) return false
        const requestNom = nomenclatures.find(n => String(n.id) === String(request.nomenclature_id))
        return isCutterNom(requestNom)
      })
      const requestsByNom = {}
      activeCutterRequests.forEach(request => {
        const key = String(request.nomenclature_id)
        if (!requestsByNom[key]) requestsByNom[key] = []
        requestsByNom[key].push(request)
      })

      const allCutterIds = new Set([...Object.keys(requestsByNom), ...Object.keys(desiredCutters)])
      const writeOperations = []
      const inventoryReleaseById = {}
      for (const cutterId of allCutterIds) {
        const desired = Math.max(0, Math.ceil(Number(desiredCutters[cutterId]?.qty) || 0))
        const existingRequests = requestsByNom[cutterId] || []
        const existing = existingRequests.reduce((sum, request) => sum + (Number(request.quantity) || 0), 0)

        if (desired > existing) {
          const item = desiredCutters[cutterId]
          const invItem = (item.inventory_id ? inventory.find(inv => String(inv.id) === String(item.inventory_id)) : null)
            || inventory.find(inv => String(inv.nomenclature_id) === cutterId && inv.warehouse === 'operational')
            || inventory.find(inv => String(inv.nomenclature_id) === cutterId)
          writeOperations.push(supabase.from('material_requests').insert({
            order_id: task.order_id,
            task_id: task.id,
            quantity: desired - existing,
            status: 'pending',
            inventory_id: invItem?.id || null,
            nomenclature_id: item.nomenclature_id,
            details: `ВИТРАТНІ МАТЕРІАЛИ ПІСЛЯ ЗМІНИ ВЕРСТАТА: ${item.name} — ${desired - existing} од. [BALANCED_MACHINE_CHANGE]`
          }))
          continue
        }

        let toRelease = existing - desired
        const reducible = [...existingRequests].sort((a, b) => {
          const aScore = (a.card_id ? 10 : 0) + (a.status === 'issued' ? 1 : 0)
          const bScore = (b.card_id ? 10 : 0) + (b.status === 'issued' ? 1 : 0)
          return aScore - bScore
        })
        for (const request of reducible) {
          if (toRelease <= 0) break
          const currentQty = Number(request.quantity) || 0
          const releaseQty = Math.min(currentQty, toRelease)
          const nextQty = currentQty - releaseQty

          if (request.status === 'issued' && request.inventory_id && releaseQty > 0) {
            inventoryReleaseById[request.inventory_id] = (inventoryReleaseById[request.inventory_id] || 0) + releaseQty
          }

          if (nextQty <= 0) writeOperations.push(supabase.from('material_requests').delete().eq('id', request.id))
          else writeOperations.push(supabase.from('material_requests').update({ quantity: nextQty }).eq('id', request.id))
          toRelease -= releaseQty
        }
      }

      for (const [inventoryId, releaseQty] of Object.entries(inventoryReleaseById)) {
        const { data: invRow, error: invError } = await supabase.from('inventory').select('id,reserved_qty').eq('id', inventoryId).maybeSingle()
        if (invError) throw invError
        if (invRow) {
          writeOperations.push(supabase.from('inventory').update({
            reserved_qty: Math.max(0, (Number(invRow.reserved_qty) || 0) - releaseQty)
          }).eq('id', invRow.id))
        }
      }
      if (writeOperations.length > 0) {
        const results = await Promise.all(writeOperations)
        const failed = results.find(result => result.error)
        if (failed?.error) throw failed.error
      }

      const nonCutterConsumables = (Array.isArray(updatedSnapshot.consumables) ? updatedSnapshot.consumables : [])
        .filter(item => !isCutterNom({ name: item?.name }))
      updatedSnapshot.consumables = [
        ...nonCutterConsumables,
        ...Object.values(desiredCutters).map(item => ({ name: item.name, total: Math.ceil(item.qty) }))
      ]

      const updateFields = { plan_snapshot: updatedSnapshot }
      if (task.status === 'completed' && targetEntry.remaining_sheets > 0) {
        updateFields.status = 'in-progress'
        updateFields.completed_at = null
      }
      const { error: taskError } = await supabase.from('tasks').update(updateFields).eq('id', task.id)
      if (taskError) throw taskError

      setCustomAlert({
        title: 'Верстат деталі змінено',
        message: `Новий верстат застосовано лише до залишку ${targetEntry.remaining_sheets} л. Уже згенеровані картки залишено без змін. Резерв фрез збалансовано.`
      })
      fetchData(['tasks', 'material_requests', 'inventory', 'work_cards']).catch(() => {})
    } catch (error) {
      console.error(error)
      setCustomAlert({ title: 'Помилка', message: `Помилка при перерахунку фрез: ${error.message}` })
    } finally {
      setIsChangingMachine(false)
    }
  }
  const handleGenerateFromWorksheet = async (task, part, sheets, selectedMachineName, count, localGeneratedCount = 0, totalToReach = 0, isRepair = false, globalTotalCards = null, globalSeqOffset = 0, customCapacity = null, maxSheetsToGenerate = null) => {
    if (generatingLockRef.current) {
      console.warn("[GEN] BLOCKED: Generation already in progress, ignoring duplicate call.")
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

    let dbCardsForRenumber = []
    if (!isRepair) {
      let dbCardsCount = 0
      try {
        const { data, error } = await supabase
          .from('work_cards')
          .select('id, is_rework, operation, card_info')
          .eq('task_id', task.id)
          .eq('nomenclature_id', part.nom?.id)
        if (!error && data) {
          dbCardsForRenumber = data.filter(c => !c.is_rework && c.operation !== 'Склад БЗ')
          dbCardsCount = dbCardsForRenumber.length
        }
      } catch (err) {
        console.error("Error fetching dbCardsCount:", err)
      }
      const allowedCount = displayTotal - dbCardsCount
      if (allowedCount > 0) {
        finalCount = Math.min(finalCount, allowedCount)
      } else {
        finalCount = 0
      }
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
    const cardsForSequence = !isRepair && dbCardsForRenumber.length > 0 ? dbCardsForRenumber : existingNomenclatureCards
    cardsForSequence.forEach(wc => {
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
      if (maxSheetsToGenerate !== null && maxSheetsToGenerate !== undefined) {
        sheetsRemainingForThisSplit = Math.min(sheetsRemainingForThisSplit, Math.max(0, Number(maxSheetsToGenerate) || 0))
      }

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

      // Генерація може виконуватися будь-якою кількістю пакетів. Після додавання
      // нового пакета оновлюємо знаменник усіх попередніх карток до спільного N.
      if (!isRepair && dbCardsForRenumber.length > 0) {
        const renumberUpdates = dbCardsForRenumber.map(card => {
          const currentInfo = String(card.card_info || '')
          const normalizedInfo = currentInfo.replace(/(\d+)\s*\/\s*(\d+)/, (_, sequence) => `${sequence}/${displayTotal}`)
          if (normalizedInfo === currentInfo) return null
          return supabase.from('work_cards').update({ card_info: normalizedInfo }).eq('id', card.id)
        }).filter(Boolean)
        if (renumberUpdates.length > 0) await Promise.all(renumberUpdates)
      }

      if (isRepair && sheets > 0) {
        const totalQty = finalCount * capacity * unitsPerSheet
        const reissueCardId = createdCards?.[0]?.id || null
        await createDovyпускMaterialRequests(task.id, task.order_id, part.nom, sheets, totalQty, selectedMachineName, reissueCardId)
      }

      if (createdCards && createdCards.length > 0) {
        if (typeof addLocalWorkCards === 'function') {
          addLocalWorkCards(createdCards)
        }
        fetchData(['work_cards', 'tasks', 'material_requests']).catch(() => {})

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
