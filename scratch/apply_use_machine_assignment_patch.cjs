const fs = require('fs');
const path = 'a:/centrum/src/modules/Foreman/hooks/useMachineAssignment.js';

let content = fs.readFileSync(path, 'utf8');

// 1. Remove task work_cards update in handleChangeTaskMachine
const targetCards1 = `      // 7. Оновлюємо невиконані картки наряду (work_cards)
      const { error: cardsUpdErr } = await supabase
        .from('work_cards')
        .update({ machine: newMachine })
        .eq('task_id', taskId)
        .neq('status', 'completed')

      if (cardsUpdErr) throw cardsUpdErr`;

const replacementCards1 = `      // [PRESERVE HISTORY] Do not retroactively update machine for already generated work cards.
      // New cards will use the new machine automatically when generated.`;

content = content.replace(targetCards1, replacementCards1);

// 2. Remove nomenclature work_cards update in handleUpdateNomenclatureMachineAndRecalculate
const targetCards2 = `      const cardMachine = newMachineName !== null ? newMachineName : (newSplits && newSplits[0]?.machine ? newSplits[0].machine : task.machine_name)
      await supabase
        .from('work_cards')
        .update({ machine: cardMachine })
        .eq('task_id', task.id)
        .eq('nomenclature_id', nomId)
        .neq('status', 'completed')`;

const replacementCards2 = `      // [PRESERVE HISTORY] Do not retroactively update machine for already generated work cards.`;

content = content.replace(targetCards2, replacementCards2);

// 3. Replace cutter requests recalculation in handleChangeTaskMachine
const targetCutters1 = `      // 3. Видаляємо старі запити на фрези
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
          details: \`ВИТРАТНІ МАТЕРІАЛИ ДЛЯ \${task.id}: \${item.name} — \${item.qty} од. (ПІСЛЯ ЗМІНИ ВЕРСТАТА)\`
        })

        newConsumablesSnapshot.push({ name: item.name, total: item.qty })

        if (shouldAutoReserve && invItem) {
          const currentReserved = Number(invItem.reserved_qty) || 0
          newInventoryReservations.push(
            supabase.from('inventory').update({ reserved_qty: currentReserved + item.qty }).eq('id', invItem.id)
          )
        }
      }`;

const replacementCutters1 = `      // 3. Видаляємо ТІЛЬКИ невидані (pending/processing) старі запити на фрези
      const cutterRequestsToDelete = cutterRequests.filter(r => r.status === 'pending' || r.status === 'processing')
      const cutterRequestIds = cutterRequestsToDelete.map(r => r.id)
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

      // 5. Створюємо нові запити на дефіцит фрез (material_requests)
      const requestsToInsert = []
      const newConsumablesSnapshot = []

      const shouldAutoReserve = task.warehouse_conf && task.engineer_conf && task.director_conf
      const newStatus = 'pending'

      const newInventoryReservations = []
      const customCutters = snapshot.selectedCutters || {}

      for (const item of Object.values(newMachineSpecificCutters)) {
        const isSynthetic = String(item.nomenclature_id).startsWith('__synthetic')
        
        let resolvedCutterNomId = item.nomenclature_id
        let resolvedCutterName = item.name
        let resolvedInvId = null
        let hasCutterOverride = false

        // Resolve to chosen specific cutter from selectedCutters
        const genericKey = item.name.trim()
        const customInvId = customCutters[genericKey] || customCutters[genericKey.toLowerCase()]
        if (customInvId) {
          const invItem = inventory.find(i => String(i.id) === String(customInvId))
          if (invItem) {
            resolvedCutterNomId = invItem.nomenclature_id
            resolvedCutterName = invItem.name
            resolvedInvId = invItem.id
            hasCutterOverride = true
          }
        }

        // Calculate already issued/completed qty for this nomenclature
        const issuedQty = cutterRequests
          .filter(r => (r.status === 'completed' || r.status === 'issued') && String(r.nomenclature_id) === String(resolvedCutterNomId))
          .reduce((sum, r) => sum + (Number(r.quantity) || 0), 0)

        // Calculate operational warehouse stock
        const operationalStock = inventory
          .filter(i => String(i.nomenclature_id) === String(resolvedCutterNomId) && i.warehouse === 'operational')
          .reduce((sum, i) => sum + Math.max(0, (Number(i.total_qty) || 0) - (Number(i.reserved_qty) || 0)), 0)

        const remainingNeeded = Math.max(0, item.qty - issuedQty)
        const deficit = Math.max(0, remainingNeeded - operationalStock)

        newConsumablesSnapshot.push({ name: resolvedCutterName, total: item.qty })

        if (deficit > 0) {
          const invItem = resolvedInvId ? null : (isSynthetic ? null : (
            inventory.find(i => String(i.nomenclature_id) === String(resolvedCutterNomId) && i.warehouse === 'operational') ||
            inventory.find(i => String(i.nomenclature_id) === String(resolvedCutterNomId))
          ))
          const finalInvId = resolvedInvId || invItem?.id || null
          const finalDetails = hasCutterOverride
            ? \`СКЛАД ОПЕРАТИВНИЙ (ОБРАНО ВРУЧНУ): \${resolvedCutterName} — \${deficit} шт.\`
            : \`ВИТРАТНІ МАТЕРІАЛИ ДЛЯ \${task.id}: \${resolvedCutterName} — \${deficit} од. (ПІСЛЯ ЗМІНИ ВЕРСТАТА)\`

          requestsToInsert.push({
            order_id: task.order_id,
            task_id: task.id,
            quantity: deficit,
            status: newStatus,
            inventory_id: finalInvId,
            nomenclature_id: isSynthetic ? null : resolvedCutterNomId,
            details: finalDetails
          })

          if (shouldAutoReserve && (resolvedInvId || invItem)) {
            const currentReserved = resolvedInvId
              ? (Number(inventory.find(i => String(i.id) === String(resolvedInvId))?.reserved_qty) || 0)
              : (Number(invItem?.reserved_qty) || 0)
            newInventoryReservations.push(
              supabase.from('inventory').update({ reserved_qty: currentReserved + deficit }).eq('id', finalInvId)
            )
          }
        }
      }`;

content = content.replace(targetCutters1, replacementCutters1);

// 4. Replace cutter requests recalculation in handleUpdateNomenclatureMachineAndRecalculate
const targetCutters2 = `      const cutterRequestIds = cutterRequests.map(r => r.id)
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
                    return
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
          details: \`ВИТРАТНІ МАТЕРІАЛИ ДЛЯ \${task.id}: \${item.name} — \${item.qty} од. (ДЕТАЛЬНА ЗМІНА ВЕРСТАТА)\`
        })

        newConsumablesSnapshot.push({ name: item.name, total: item.qty })

        if (shouldAutoReserve && invItem) {
          const currentReserved = Number(invItem.reserved_qty) || 0
          newInventoryReservations.push(
            supabase.from('inventory').update({ reserved_qty: currentReserved + item.qty }).eq('id', invItem.id)
          )
        }
      }`;

const replacementCutters2 = `      // 3. Видаляємо ТІЛЬКИ невидані (pending/processing) запити на фрези
      const cutterRequestsToDelete = cutterRequests.filter(r => r.status === 'pending' || r.status === 'processing')
      const cutterRequestIds = cutterRequestsToDelete.map(r => r.id)
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
                    return
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

      const newInventoryReservations = []
      const customCutters = updatedSnapshot.selectedCutters || {}

      for (const item of Object.values(newMachineSpecificCutters)) {
        const isSynthetic = String(item.nomenclature_id).startsWith('__synthetic')
        
        let resolvedCutterNomId = item.nomenclature_id
        let resolvedCutterName = item.name
        let resolvedInvId = null
        let hasCutterOverride = false

        // Resolve to chosen specific cutter from selectedCutters
        const genericKey = item.name.trim()
        const customInvId = customCutters[genericKey] || customCutters[genericKey.toLowerCase()]
        if (customInvId) {
          const invItem = inventory.find(i => String(i.id) === String(customInvId))
          if (invItem) {
            resolvedCutterNomId = invItem.nomenclature_id
            resolvedCutterName = invItem.name
            resolvedInvId = invItem.id
            hasCutterOverride = true
          }
        }

        // Calculate already issued/completed qty for this nomenclature
        const issuedQty = cutterRequests
          .filter(r => (r.status === 'completed' || r.status === 'issued') && String(r.nomenclature_id) === String(resolvedCutterNomId))
          .reduce((sum, r) => sum + (Number(r.quantity) || 0), 0)

        // Calculate operational warehouse stock
        const operationalStock = inventory
          .filter(i => String(i.nomenclature_id) === String(resolvedCutterNomId) && i.warehouse === 'operational')
          .reduce((sum, i) => sum + Math.max(0, (Number(i.total_qty) || 0) - (Number(i.reserved_qty) || 0)), 0)

        const remainingNeeded = Math.max(0, item.qty - issuedQty)
        const deficit = Math.max(0, remainingNeeded - operationalStock)

        newConsumablesSnapshot.push({ name: resolvedCutterName, total: item.qty })

        if (deficit > 0) {
          const invItem = resolvedInvId ? null : (isSynthetic ? null : (
            inventory.find(i => String(i.nomenclature_id) === String(resolvedCutterNomId) && i.warehouse === 'operational') ||
            inventory.find(i => String(i.nomenclature_id) === String(resolvedCutterNomId))
          ))
          const finalInvId = resolvedInvId || invItem?.id || null
          const finalDetails = hasCutterOverride
            ? \`СКЛАД ОПЕРАТИВНИЙ (ОБРАНО ВРУЧНУ): \${resolvedCutterName} — \${deficit} шт.\`
            : \`ВИТРАТНІ МАТЕРІАЛИ ДЛЯ \${task.id}: \${resolvedCutterName} — \${deficit} од. (ДЕТАЛЬНА ЗМІНА ВЕРСТАТА)\`

          requestsToInsert.push({
            order_id: task.order_id,
            task_id: task.id,
            quantity: deficit,
            status: newStatus,
            inventory_id: finalInvId,
            nomenclature_id: isSynthetic ? null : resolvedCutterNomId,
            details: finalDetails
          })

          if (shouldAutoReserve && (resolvedInvId || invItem)) {
            const currentReserved = resolvedInvId
              ? (Number(inventory.find(i => String(i.id) === String(resolvedInvId))?.reserved_qty) || 0)
              : (Number(invItem?.reserved_qty) || 0)
            newInventoryReservations.push(
              supabase.from('inventory').update({ reserved_qty: currentReserved + deficit }).eq('id', finalInvId)
            )
          }
        }
      }`;

content = content.replace(targetCutters2, replacementCutters2);

fs.writeFileSync(path, content, 'utf8');
console.log('SUCCESS: useMachineAssignment.js patched successfully!');
