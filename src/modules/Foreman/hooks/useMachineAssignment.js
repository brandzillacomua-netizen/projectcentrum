import { useState } from 'react'
import { supabase } from '../../../supabase'
import { useMES } from '../../../MESContext'

export function useMachineAssignment(setCustomAlert) {
  const {
    tasks,
    nomenclatures,
    machineOperations,
    inventory,
    fetchData
  } = useMES()

  const [isChangingMachine, setIsChangingMachine] = useState(false)

  const handleChangeTaskMachine = async (taskId, newMachine) => {
    const task = tasks.find(t => t.id === taskId)
    if (!task || !newMachine) return

    setIsChangingMachine(true)
    try {
      // 1. Отримуємо актуальні material_requests для наряду
      const { data: matReqs, error: fetchReqsErr } = await supabase
        .from('material_requests')
        .select('*')
        .eq('task_id', taskId)

      if (fetchReqsErr) throw fetchReqsErr

      // 2. Шукаємо старі запити на фрези, щоб зняти бронь
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

      // 3. Видаляємо старі запити на фрези
      const cutterRequestIds = cutterRequests.map(r => r.id)
      if (cutterRequestIds.length > 0) {
        const { error: delErr } = await supabase
          .from('material_requests')
          .delete()
          .in('id', cutterRequestIds)
        if (delErr) throw delErr
      }

      // 4. Розраховуємо нові фрези для нового типу верстата
      const snapshot = { ...(task.plan_snapshot || {}) }
      const newMachineSpecificCutters = {}
      let hasMachineSpecificCutters = false
      const partIds = Object.keys(snapshot).filter(k => !k.startsWith('_') && k !== 'materialSummary' && k !== 'selectedCutters' && k !== 'consumables')

      partIds.forEach(partId => {
        const partInfo = snapshot[partId]
        const sheetsNeeded = Number(partInfo.sheets) || 0
        if (sheetsNeeded <= 0) return

        // override selected_machine for all parts to new machine
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

      // 5. Створюємо нові запити на фрези (material_requests)
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

      if (newInventoryReservations.length > 0) {
        await Promise.all(newInventoryReservations)
      }

      // 6. Оновлюємо сам наряд (task)
      snapshot.consumables = newConsumablesSnapshot
      const { error: taskUpdErr } = await supabase
        .from('tasks')
        .update({
          machine_name: newMachine,
          plan_snapshot: snapshot
        })
        .eq('id', taskId)

      if (taskUpdErr) throw taskUpdErr

      // [PRESERVE HISTORY] Do not retroactively update machine for already generated work cards.
      // New cards will use the new machine automatically when generated.

      setCustomAlert({ title: 'Верстат наряду змінено', message: '✅ Верстат наряду успішно змінено. Бронь зі старих фрез знято. Надіслано новий запит на СО для видачі нових фрез!' })
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

      // [PRESERVE HISTORY] Do not retroactively update machine for already generated work cards.

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
          details: `ВИТРАТНІ МАТЕРІАЛИ ДЛЯ ${task.id}: ${item.name} — ${item.qty} од. (ДЕТАЛЬНА ЗМІНА ВЕРСТАТА)`
        })

        newConsumablesSnapshot.push({ name: item.name, total: item.qty })

        if (shouldAutoReserve && invItem) {
          const currentReserved = Number(invItem.reserved_qty) || 0
          newInventoryReservations.push(
            supabase.from('inventory').update({ reserved_qty: currentReserved + item.qty }).eq('id', invItem.id)
          )
        }
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

      if (newInventoryReservations.length > 0) {
        await Promise.all(newInventoryReservations)
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

  return {
    isChangingMachine,
    handleChangeTaskMachine,
    handleUpdateNomenclatureMachineAndRecalculate
  }
}
