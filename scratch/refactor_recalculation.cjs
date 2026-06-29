const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '../src/modules/ForemanWorkplace.jsx');
let content = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');

// 1. Оновлюємо handleChangeTaskMachine
const oldHandleChangeTaskMachine = `  const handleChangeTaskMachine = async (taskId, newMachine) => {
    const task = relevantTasks.find(t => t.id === taskId) || tasks.find(t => t.id === taskId)
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

      // Для кожної фрези, яка має статус 'issued' (вже зарезервована на складі), повертаємо її reserved_qty
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
          const cutterOps = opData.side2_cut_ops.filter(op => op.startsWith('__CUTTER__Reference:') || op.startsWith('__CUTTER__:') || op.startsWith('__CUTTER__Reference:') || op.startsWith('__CUTTER__Reference:'))
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
                const m1 = nl.match(/ф\\s*([0-9,.]+)/)
                const m2 = nl.match(/(?:кукурудза|двопера|однопера|спіральна|торцева|шарова|радіусна)?\\s*([0-9][0-9,]*)(?:\\s*[×xх×])/)
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

      // Визначаємо статус нових запитів:
      // Якщо наряд уже мав підтвердження (склад, інженер, директор), нові запити мають одразу статус 'issued' (і резервуються).
      // Інакше вони у статусі 'pending'.
      const shouldAutoReserve = task.warehouse_conf && task.engineer_conf && task.director_conf
      const newStatus = shouldAutoReserve ? 'issued' : 'pending'

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

        // Якщо треба забронювати фрези, додаємо в список оновлення інвентаря
        if (shouldAutoReserve && invItem) {
          const currentReserved = Number(invItem.reserved_qty) || 0
          newInventoryReservations.push(
            supabase.from('inventory').update({ reserved_qty: currentReserved + item.qty }).eq('id', invItem.id)
          )
        }
      }

      // Зберігаємо також листи (вони не міняються, але consumables наряду оновлюються)
      const totalSheets = Object.values(snapshot.materialSummary || {}).reduce((acc, m) => acc + (Number(m.sheets) || 0), 0)
      if (totalSheets > 0) {
        nomenclatures.filter(n => n.type === 'consumable' && (Number(n.consumption_per_sheet) || 0) > 0 && n.name.trim().toLowerCase() !== 'фреза' && (n.name.toLowerCase().startsWith('лист') || n.name.toLowerCase().includes('фреза'))).forEach(cons => {
          if (hasMachineSpecificCutters && cons.name.toLowerCase().includes('фреза')) return
          const neededQty = Math.ceil(totalSheets * Number(cons.consumption_per_sheet))
          newConsumablesSnapshot.push({ name: cons.name.trim(), total: neededQty })
        })
      }

      // Вставляємо нові material_requests
      if (requestsToInsert.length > 0) {
        const { error: insErr } = await supabase.from('material_requests').insert(requestsToInsert)
        if (insErr) throw insErr
      }

      // Виконуємо бронювання інвентаря якщо треба
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

      // 7. Оновлюємо невиконані картки наряду (work_cards)
      const { error: cardsUpdErr } = await supabase
        .from('work_cards')
        .update({ machine: newMachine })
        .eq('task_id', taskId)
        .neq('status', 'completed')

      if (cardsUpdErr) throw cardsUpdErr

      alert(\`✅ Верстат успішно змінено на \${newMachine}. Запити на фрези перераховано та перебронювано!\`)
      setChangeMachineTaskId(null)
      fetchData(['tasks', 'material_requests', 'inventory', 'work_cards']).catch(() => {})
    } catch (e) {
      console.error(e)
      alert(\`Помилка при зміні верстата: \${e.message}\`)
    } finally {
      setIsChangingMachine(false)
    }
  }`;

const newHandleChangeTaskMachine = `  const handleChangeTaskMachine = async (taskId, newMachine) => {
    const task = relevantTasks.find(t => t.id === taskId) || tasks.find(t => t.id === taskId)
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

      // Для кожної фрези, яка має статус 'issued' (вже зарезервована на складі), повертаємо її reserved_qty
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
          const cutterOps = opData.side2_cut_ops.filter(op => op.startsWith('__CUTTER__Reference:') || op.startsWith('__CUTTER__:') || op.startsWith('__CUTTER__Reference:') || op.startsWith('__CUTTER__Reference:'))
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
                const m1 = nl.match(/ф\\s*([0-9,.]+)/)
                const m2 = nl.match(/(?:кукурудза|двопера|однопера|спіральна|торцева|шарова|радіусна)?\\s*([0-9][0-9,]*)(?:\\s*[×xх×])/)
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
      // ПОПРАВКА: Запити на нові фрези створюються у статусі 'pending', бронь на складі не робиться автоматично
      const requestsToInsert = []
      const newConsumablesSnapshot = []

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
          status: 'pending',
          inventory_id: invItem?.id || null,
          nomenclature_id: isSynthetic ? null : item.nomenclature_id,
          details: \`ВИТРАТНІ МАТЕРІАЛИ ДЛЯ \${task.id}: \${item.name} — \${item.qty} од. (ПІСЛЯ ЗМІНИ ВЕРСТАТА)\`
        })

        newConsumablesSnapshot.push({ name: item.name, total: item.qty })
      }

      // Зберігаємо також листи (вони не міняються, але consumables наряду оновлюються)
      const totalSheets = Object.values(snapshot.materialSummary || {}).reduce((acc, m) => acc + (Number(m.sheets) || 0), 0)
      if (totalSheets > 0) {
        nomenclatures.filter(n => n.type === 'consumable' && (Number(n.consumption_per_sheet) || 0) > 0 && n.name.trim().toLowerCase() !== 'фреза' && (n.name.toLowerCase().startsWith('лист') || n.name.toLowerCase().includes('фреза'))).forEach(cons => {
          if (hasMachineSpecificCutters && cons.name.toLowerCase().includes('фреза')) return
          const neededQty = Math.ceil(totalSheets * Number(cons.consumption_per_sheet))
          newConsumablesSnapshot.push({ name: cons.name.trim(), total: neededQty })
        })
      }

      // Вставляємо нові material_requests
      if (requestsToInsert.length > 0) {
        const { error: insErr } = await supabase.from('material_requests').insert(requestsToInsert)
        if (insErr) throw insErr
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

      // 7. Оновлюємо невиконані картки наряду (work_cards)
      const { error: cardsUpdErr } = await supabase
        .from('work_cards')
        .update({ machine: newMachine })
        .eq('task_id', taskId)
        .neq('status', 'completed')

      if (cardsUpdErr) throw cardsUpdErr

      setCustomAlert({ 
        title: 'Успішно змінено верстат', 
        message: \`✅ Верстат успішно змінено на \${newMachine}. Бронь зі старих фрез знято. Надіслано новий запит на СО для видачі нових фрез!\` 
      })
      setChangeMachineTaskId(null)
      fetchData(['tasks', 'material_requests', 'inventory', 'work_cards']).catch(() => {})
    } catch (e) {
      console.error(e)
      setCustomAlert({ title: 'Помилка', message: \`Помилка при зміні верстата: \${e.message}\` })
    } finally {
      setIsChangingMachine(false)
    }
  }`;

// 2. Оновлюємо handleUpdateNomenclatureMachineAndRecalculate
const oldHandleUpdateNomenclatureMachineAndRecalculate = `  const handleUpdateNomenclatureMachineAndRecalculate = async (task, nomId, newMachineName, newSplits = null) => {
    if (!task || !nomId) return
    setIsChangingMachine(true)

    try {
      const sId = String(nomId)
      const currentSnapshot = task.plan_snapshot || {}
      const entry = { ...(currentSnapshot[sId] || {}) }

      if (newMachineName !== null) {
        entry.machine = newMachineName
        entry.selected_machine = newMachineName
        entry.splits = [] // clear splits if we chosen a single machine
      }
      if (newSplits !== null) {
        entry.splits = newSplits
      }

      const updatedSnapshot = {
        ...currentSnapshot,
        [sId]: entry
      }

      // 1. Оновлюємо невиконані картки цієї номенклатури у наряді на новий верстат
      const cardMachine = newMachineName !== null ? newMachineName : (newSplits && newSplits[0]?.machine ? newSplits[0].machine : task.machine_name)
      await supabase
        .from('work_cards')
        .update({ machine: cardMachine })
        .eq('task_id', task.id)
        .eq('nomenclature_id', nomId)
        .neq('status', 'completed')

      // 2. Отримуємо актуальні material_requests для наряду
      const { data: matReqs, error: fetchReqsErr } = await supabase
        .from('material_requests')
        .select('*')
        .eq('task_id', task.id)

      if (fetchReqsErr) throw fetchReqsErr

      // 3. Шукаємо старі запити на фрези, щоб зняти бронь
      const cutterRequests = (matReqs || []).filter(r => {
        if (!r.nomenclature_id) return false
        const nom = nomenclatures.find(n => n.id === r.nomenclature_id)
        return nom?.name?.toLowerCase()?.includes('фреза')
      })

      // Повертаємо reserved_qty на склад
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

      // 4. Видаляємо старі запити на фрези
      const cutterRequestIds = cutterRequests.map(r => r.id)
      if (cutterRequestIds.length > 0) {
        const { error: delErr } = await supabase
          .from('material_requests')
          .delete()
          .in('id', cutterRequestIds)
        if (delErr) throw delErr
      }

      // 5. Розраховуємо нові фрези для ВСІХ деталей наряду з урахуванням оновленого snapshot
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
                  const m1 = nl.match(/ф\\s*([0-9,.]+)/)
                  const m2 = nl.match(/(?:кукурудза|двопера|однопера|спіральна|торцева|шарова|радіусна)?\\s*([0-9][0-9,]*)(?:\\s*[×xх×])/)
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

      // 6. Створюємо нові запити на фрези
      const requestsToInsert = []
      const newConsumablesSnapshot = []

      const shouldAutoReserve = task.warehouse_conf && task.engineer_conf && task.director_conf
      const newStatus = shouldAutoReserve ? 'issued' : 'pending'

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
      }

      // Зберігаємо також листи
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

      // 7. Оновлюємо сам наряд (task) з новим plan_snapshot
      updatedSnapshot.consumables = newConsumablesSnapshot
      const { error: taskUpdErr } = await supabase
        .from('tasks')
        .update({
          plan_snapshot: updatedSnapshot
        })
        .eq('id', task.id)

      if (taskUpdErr) throw taskUpdErr

      alert(\`✅ Верстат/розподіл для деталі успішно змінено. Запити на фрези перераховано та зарезервовано на складі!\`)
      fetchData(['tasks', 'material_requests', 'inventory', 'work_cards']).catch(() => {})
    } catch (e) {
      console.error(e)
      alert(\`Помилка при перерахунку фрез: \${e.message}\`)
    } finally {
      setIsChangingMachine(false)
    }
  }`;

const newHandleUpdateNomenclatureMachineAndRecalculate = `  const handleUpdateNomenclatureMachineAndRecalculate = async (task, nomId, newMachineName, newSplits = null) => {
    if (!task || !nomId) return
    setIsChangingMachine(true)

    try {
      const sId = String(nomId)
      const currentSnapshot = task.plan_snapshot || {}
      const entry = { ...(currentSnapshot[sId] || {}) }

      if (newMachineName !== null) {
        entry.machine = newMachineName
        entry.selected_machine = newMachineName
        entry.splits = [] // clear splits if we chosen a single machine
      }
      if (newSplits !== null) {
        entry.splits = newSplits
      }

      const updatedSnapshot = {
        ...currentSnapshot,
        [sId]: entry
      }

      // 1. Оновлюємо невиконані картки цієї номенклатури у наряді на новий верстат
      const cardMachine = newMachineName !== null ? newMachineName : (newSplits && newSplits[0]?.machine ? newSplits[0].machine : task.machine_name)
      await supabase
        .from('work_cards')
        .update({ machine: cardMachine })
        .eq('task_id', task.id)
        .eq('nomenclature_id', nomId)
        .neq('status', 'completed')

      // 2. Отримуємо актуальні material_requests для наряду
      const { data: matReqs, error: fetchReqsErr } = await supabase
        .from('material_requests')
        .select('*')
        .eq('task_id', task.id)

      if (fetchReqsErr) throw fetchReqsErr

      // 3. Шукаємо старі запити на фрези, щоб зняти бронь
      const cutterRequests = (matReqs || []).filter(r => {
        if (!r.nomenclature_id) return false
        const nom = nomenclatures.find(n => n.id === r.nomenclature_id)
        return nom?.name?.toLowerCase()?.includes('фреза')
      })

      // Повертаємо reserved_qty на склад
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

      // 4. Видаляємо старі запити на фрези
      const cutterRequestIds = cutterRequests.map(r => r.id)
      if (cutterRequestIds.length > 0) {
        const { error: delErr } = await supabase
          .from('material_requests')
          .delete()
          .in('id', cutterRequestIds)
        if (delErr) throw delErr
      }

      // 5. Розраховуємо нові фрези для ВСІХ деталей наряду з урахуванням оновленого snapshot
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
                  const m1 = nl.match(/ф\\s*([0-9,.]+)/)
                  const m2 = nl.match(/(?:кукурудза|двопера|однопера|спіральна|торцева|шарова|радіусна)?\\s*([0-9][0-9,]*)(?:\\s*[×xх×])/)
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

      // 6. Створюємо нові запити на фрези
      // ПОПРАВКА: Запити на нові фрези створюються у статусі 'pending', бронь на складі не робиться автоматично
      const requestsToInsert = []
      const newConsumablesSnapshot = []

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
          status: 'pending',
          inventory_id: invItem?.id || null,
          nomenclature_id: isSynthetic ? null : item.nomenclature_id,
          details: \`ВИТРАТНІ МАТЕРІАЛИ ДЛЯ \${task.id}: \${item.name} — \${item.qty} од. (ДЕТАЛЬНА ЗМІНА ВЕРСТАТА)\`
        })

        newConsumablesSnapshot.push({ name: item.name, total: item.qty })
      }

      // Зберігаємо також листи
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

      // 7. Оновлюємо сам наряд (task) з новим plan_snapshot
      updatedSnapshot.consumables = newConsumablesSnapshot
      const { error: taskUpdErr } = await supabase
        .from('tasks')
        .update({
          plan_snapshot: updatedSnapshot
        })
        .eq('id', task.id)

      if (taskUpdErr) throw taskUpdErr

      setCustomAlert({
        title: 'Верстат деталі змінено',
        message: \`✅ Верстат/розподіл для деталі успішно змінено. Бронь зі старих фрез знято. Надіслано новий запит на СО для видачі нових фрез!\`
      })
      fetchData(['tasks', 'material_requests', 'inventory', 'work_cards']).catch(() => {})
    } catch (e) {
      console.error(e)
      setCustomAlert({ title: 'Помилка', message: \`Помилка при перерахунку фрез: \${e.message}\` })
    } finally {
      setIsChangingMachine(false)
    }
  }`;

// Виконуємо заміни у ForemanWorkplace.jsx
if (content.includes(oldHandleChangeTaskMachine) && content.includes(oldHandleUpdateNomenclatureMachineAndRecalculate)) {
  content = content.replace(oldHandleChangeTaskMachine, newHandleChangeTaskMachine);
  content = content.replace(oldHandleUpdateNomenclatureMachineAndRecalculate, newHandleUpdateNomenclatureMachineAndRecalculate);
  fs.writeFileSync(filePath, content.replace(/\n/g, '\r\n'), 'utf8');
  console.log("REFACTOR_RECALCULATION_SUCCESS");
} else {
  // Якщо точного збігу не знайдено, спробуємо знайти частково
  console.log("REFACTOR_RECALCULATION_FAILED: Exact source blocks not found.");
}
