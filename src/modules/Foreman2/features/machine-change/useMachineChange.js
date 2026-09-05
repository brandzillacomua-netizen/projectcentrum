import { useState } from 'react'
import { supabase } from '../../../../supabase.js'
import { getNomUnitsPerSheet } from '../../../../utils/unitsHelper.js'

export function useMachineChange({
  tasks,
  relevantTasks,
  nomenclatures,
  machineOperations,
  inventory,
  fetchData,
  setCustomAlert
}) {
  const [isChangingMachine, setIsChangingMachine] = useState(false)
  const [changeMachineTaskId, setChangeMachineTaskId] = useState(null)
  
  const [changeNomMachineTaskId, setChangeNomMachineTaskId] = useState(null)
  const [changeNomMachineNomId, setChangeNomMachineNomId] = useState(null)
  const [changeNomMachineName, setChangeNomMachineName] = useState(null)
  const [selectedNomNewMachine, setSelectedNomNewMachine] = useState(null)

  const openMachineChange = (task, part) => {
    if (!task || !part) return
    const nomId = part.nomId || part.nom?.id || part.id
    const partName = part.name || part.nom?.name || 'Деталь'
    const machine = part.machine || part.selected_machine || part.rowMachineName || ''
    setChangeNomMachineTaskId(task.id)
    setChangeNomMachineNomId(nomId)
    setChangeNomMachineName(partName)
    setSelectedNomNewMachine(machine)
  }

  const handleUpdateNomenclatureMachineAndRecalculate = async (task, nomId, newMachineName, newSplits = null, cutterSelection = {}, loadCapacity = null) => {
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
        const key = selectedInventory?.id ? `inventory:${selectedInventory.id}` : `nom:${resolvedNom.id}`
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
      if (loadCapacity !== null) {
        const normalizedLoadCapacity = Math.max(1, Number(loadCapacity) || 1)
        targetEntry.load_capacity = normalizedLoadCapacity
        targetEntry.custom_capacity = normalizedLoadCapacity
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
      const partIds = nomId ? [String(nomId)] : Object.keys(updatedSnapshot).filter(key =>
        !key.startsWith('_') && !['materialSummary', 'selectedCutters', 'consumables', 'arrivals', 'nomenclatures'].includes(key)
      )

      for (const partId of partIds) {
        const partInfo = updatedSnapshot[partId]
        if (!partInfo || typeof partInfo !== 'object') continue
        const partNom = nomenclatures.find(n => String(n.id) === String(partId))
        if (partNom && partNom.type !== 'part') continue
        const unitsPerSheet = getNomUnitsPerSheet(partNom, partInfo)
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

      // Group desired cutters by nomenclature_id
      const desiredByNom = {}
      for (const [key, item] of Object.entries(desiredCutters)) {
        const nomId = String(item.nomenclature_id)
        if (!desiredByNom[nomId]) {
          desiredByNom[nomId] = {
            nomenclature_id: item.nomenclature_id,
            inventory_id: item.inventory_id,
            name: item.name,
            qty: 0
          }
        }
        desiredByNom[nomId].qty += item.qty
        if (item.inventory_id) desiredByNom[nomId].inventory_id = item.inventory_id
      }

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

      // Group active requests by nomenclature_id
      const requestsByNom = {}
      activeCutterRequests.forEach(request => {
        const nomId = String(request.nomenclature_id)
        if (!requestsByNom[nomId]) requestsByNom[nomId] = []
        requestsByNom[nomId].push(request)
      })

      const allNomIds = new Set([...Object.keys(requestsByNom), ...Object.keys(desiredByNom)])
      const writeOperations = []
      const inventoryReleaseById = {}

      for (const nomId of allNomIds) {
        const item = desiredByNom[nomId]
        const desired = item ? Math.max(0, Math.ceil(Number(item.qty) || 0)) : 0
        const existingRequests = requestsByNom[nomId] || []
        const existing = existingRequests.reduce((sum, request) => sum + (Number(request.quantity) || 0), 0)

        if (desired > existing) {
          const delta = desired - existing
          const invItem = (item?.inventory_id ? inventory.find(inv => String(inv.id) === String(item.inventory_id)) : null)
            || inventory.find(inv => String(inv.nomenclature_id) === String(nomId) && inv.warehouse === 'operational')
            || inventory.find(inv => String(inv.nomenclature_id) === String(nomId))
          const requestName = invItem?.name || item?.name || 'Фреза'

          const pendingReq = existingRequests.find(r => r.status === 'pending')
          if (pendingReq) {
            writeOperations.push(supabase.from('material_requests').update({
              quantity: (Number(pendingReq.quantity) || 0) + delta,
              inventory_id: invItem?.id || pendingReq.inventory_id
            }).eq('id', pendingReq.id))
          } else {
            writeOperations.push(supabase.from('material_requests').insert({
              order_id: task.order_id,
              task_id: task.id,
              quantity: delta,
              status: 'pending',
              inventory_id: invItem?.id || null,
              nomenclature_id: Number(nomId) || nomId,
              details: `ВИТРАТНІ МАТЕРІАЛИ ПІСЛЯ ЗМІНИ ВЕРСТАТА: ${requestName} — ${delta} од. [BALANCED_MACHINE_CHANGE]`
            }))
          }
        } else if (desired < existing) {
          let toRelease = existing - desired
          const reducible = [...existingRequests].sort((a, b) => {
            const aScore = a.status === 'pending' ? 0 : 10
            const bScore = b.status === 'pending' ? 0 : 10
            return aScore - bScore
          })

          for (const request of reducible) {
            if (toRelease <= 0) break
            if (request.status !== 'pending') continue

            const currentQty = Number(request.quantity) || 0
            const releaseQty = Math.min(currentQty, toRelease)
            const nextQty = currentQty - releaseQty

            if (nextQty <= 0) {
              writeOperations.push(supabase.from('material_requests').delete().eq('id', request.id))
            } else {
              writeOperations.push(supabase.from('material_requests').update({ quantity: nextQty }).eq('id', request.id))
            }
            toRelease -= releaseQty
          }
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

      if (setCustomAlert) {
        setCustomAlert({
          title: 'Верстат деталі змінено',
          message: `Новий верстат застосовано лише до залишку ${targetEntry.remaining_sheets} л. Уже згенеровані картки залишено без змін. Резерв фрез збалансовано.`
        })
      }
      
      setChangeNomMachineTaskId(null)
      fetchData(['tasks', 'material_requests', 'inventory', 'work_cards']).catch(() => {})
    } catch (error) {
      console.error(error)
      if (setCustomAlert) {
        setCustomAlert({ title: 'Помилка', message: `Помилка при перерахунку фрез: ${error.message}` })
      } else {
        alert(`Помилка при перерахунку фрез: ${error.message}`)
      }
    } finally {
      setIsChangingMachine(false)
    }
  }

  return {
    isChangingMachine,
    changeMachineTaskId,
    setChangeMachineTaskId,
    
    changeNomMachineTaskId,
    setChangeNomMachineTaskId,
    changeNomMachineNomId,
    setChangeNomMachineNomId,
    changeNomMachineName,
    setChangeNomMachineName,
    selectedNomNewMachine,
    setSelectedNomNewMachine,
    
    openMachineChange,
    handleUpdateNomenclatureMachineAndRecalculate
  }
}
