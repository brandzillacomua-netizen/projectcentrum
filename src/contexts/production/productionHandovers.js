import { supabase } from '../../supabase.js'

export function createProductionHandoversActions({
  orders, tasks, inventory, nomenclatures, bomItems, workCards,
  machineOperations, machines, systemUsers, currentUser,
  setTasks, setWorkCards, setWorkCardHistory, setManagementTasks, setMachines,
  normalize, refreshTable, fetchData,
  deductIssuedMaterialsForTask,
  maintenanceCheckEnabled
}) {
  const approveWarehouse = async (taskId) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, warehouse_conf: 'true' } : t))
    await supabase.from('tasks').update({ warehouse_conf: 'true' }).eq('id', taskId)
  }
  const approveEngineer = async (taskId) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, engineer_conf: true } : t))
    await supabase.from('tasks').update({ engineer_conf: true }).eq('id', taskId)
  }
  const approveDirector = async (taskId) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, director_conf: true } : t))
    await supabase.from('tasks').update({ director_conf: true }).eq('id', taskId);
    
    // Fetch fresh task from Supabase to guarantee we copy the absolute latest database plan_snapshot
    const { data: targetTask, error: fetchErr } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .single();

    if (fetchErr || !targetTask) {
      console.error('Failed to fetch fresh task for Shop 2 initialization:', fetchErr);
      return;
    }

    if (targetTask && targetTask.order_id) {
      const existingShop2 = tasks.find(t =>
        String(t.order_id) === String(targetTask.order_id) &&
        t.step?.includes('Пресування') &&
        t.batch_index === targetTask.batch_index
      )
      if (!existingShop2) {
        const { data: newShop2 } = await supabase.from('tasks').insert([{
          order_id: targetTask.order_id,
          step: 'Пресування [ЦЕХ №2]',
          status: 'waiting',
          planned_sets: targetTask.planned_sets || 0,
          estimated_time: targetTask.estimated_time || 0,
          engineer_conf: true,
          warehouse_conf: 'true',
          director_conf: true,
          batch_index: targetTask.batch_index || null,
          plan_snapshot: { ...(targetTask.plan_snapshot || {}), arrivals: [] }
        }]).select()
        if (newShop2 && newShop2.length > 0) {
          setTasks(prev => [...prev, newShop2[0]])
        }
      }
    }
  }


  const completeTaskByMaster = async (taskId) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'completed', completed_at: new Date().toISOString() } : t))
    await deductIssuedMaterialsForTask(taskId)
    await supabase.from('tasks').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', taskId)
    refreshTable('inventory')
  }


  const handoverTaskToShop2 = async (taskId) => {
    try {
      const task = tasks.find(t => String(t.id) === String(taskId))
      if (!task) return

      // ── Крок 1: паралельно завершуємо завдання і завантажуємо дані ──
      await supabase.from('tasks').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', taskId)
      await deductIssuedMaterialsForTask(taskId)

      try {
        // ── Крок 2: паралельно завантажуємо картки і інвентар ──
        const [{ data: taskCards }, { data: freshInventory }] = await Promise.all([
          supabase.from('work_cards').select('id, nomenclature_id, quantity, operation').eq('task_id', taskId).eq('status', 'completed'),
          supabase.from('inventory').select('*')
        ])

        const currentInventory = freshInventory || inventory
        const snapshotPartsArr = Object.keys(task.plan_snapshot || {}).filter(k => !['_metadata', 'materialSummary'].includes(k))
        const arrivals = []

        // ── Крок 3: збираємо ВСІ зміни інвентарю в Map/Array ──
        // (замість N×5 окремих await UPDATE — потім один upsert і один insert)
        const updatesMap = new Map() // inventoryId → { ...row, total_qty: newQty }
        const insertsArr = []        // нові рядки для insert

        // Хелпер: отримати актуальне значення з урахуванням вже запланованих змін
        const getItem = (nomId, type) => {
          const fromMap = [...updatesMap.values()].find(i => String(i.nomenclature_id) === String(nomId) && i.type === type)
          if (fromMap) return fromMap
          return currentInventory.find(i => String(i.nomenclature_id) === String(nomId) && i.type === type)
        }

        // Хелпер: застосувати дельту до існуючого рядку
        const applyDelta = (item, delta) => {
          const current = updatesMap.get(item.id) || { ...item }
          current.total_qty = Math.max(0, (Number(current.total_qty) || 0) + delta)
          updatesMap.set(item.id, current)
        }

        for (const nomId of snapshotPartsArr) {
          const nom = nomenclatures.find(n => String(n.id) === String(nomId))
          const nomCards = (taskCards || []).filter(c => String(c.nomenclature_id) === String(nomId))
          const producedInShop1 = nomCards.filter(c => c.operation !== 'Склад БЗ').reduce((sum, c) => sum + (Number(c.quantity) || 0), 0)
          const fromStockAtStart = nomCards.filter(c => c.operation === 'Склад БЗ').reduce((sum, c) => sum + (Number(c.quantity) || 0), 0)
          const totalToMove = producedInShop1 + fromStockAtStart
          if (totalToMove <= 0) continue

          const snapshotNeed = Number(task.plan_snapshot[nomId]?.need) || 0
          const moveSemi = Math.min(totalToMove, snapshotNeed)
          const moveBz = Math.max(0, totalToMove - moveSemi)
          arrivals.push({ id: nomId, name: nom?.name || 'Деталь', semi: moveSemi, bz: moveBz })

          // Зменшити запаси Цеху №1
          if (producedInShop1 > 0) {
            const decSemi = Math.min(producedInShop1, snapshotNeed)
            const decWipBz = Math.max(0, producedInShop1 - decSemi)

            const s1Semi = getItem(nomId, 'semi')
            if (decSemi > 0 && s1Semi) applyDelta(s1Semi, -decSemi)

            if (decWipBz > 0) {
              let remaining = decWipBz
              const s1WipBz = getItem(nomId, 'wip_bz')
              if (s1WipBz) {
                const take = Math.min(Number(s1WipBz.total_qty) || 0, remaining)
                applyDelta(s1WipBz, -take)
                remaining -= take
              }
              if (remaining > 0) {
                const s1Bz = getItem(nomId, 'bz')
                if (s1Bz) applyDelta(s1Bz, -remaining)
              }
            }
          }

          // Додати запаси Цеху №2
          if (moveSemi > 0) {
            const s2Semi = getItem(nomId, 'semi_shop2')
            if (s2Semi) applyDelta(s2Semi, moveSemi)
            else insertsArr.push({ nomenclature_id: nomId, name: nom?.name || 'Деталь', total_qty: moveSemi, type: 'semi_shop2', unit: nom?.unit || 'шт', reserved_qty: 0 })
          }
          if (moveBz > 0) {
            const s2Bz = getItem(nomId, 'bz_shop2')
            if (s2Bz) applyDelta(s2Bz, moveBz)
            else insertsArr.push({ nomenclature_id: nomId, name: nom?.name || 'Деталь', total_qty: moveBz, type: 'bz_shop2', unit: nom?.unit || 'шт', reserved_qty: 0 })
          }
        }

        // ── Крок 4: виконати ВСІ зміни інвентарю двома запитами замість N×5 ──
        const finalUpdates = Array.from(updatesMap.values())
        await Promise.all([
          finalUpdates.length > 0 ? supabase.from('inventory').upsert(finalUpdates) : Promise.resolve(),
          insertsArr.length > 0 ? supabase.from('inventory').insert(insertsArr) : Promise.resolve(),
        ])

        // ── Крок 5: створити документ і оновити завдання Цеху №2 ──
        const { data: moveDoc } = await supabase.from('reception_docs').insert([{
          doc_num: `T-S1-S2-${Date.now().toString().slice(-6)}`,
          type: 'internal_transfer', status: 'completed',
          order_id: task.order_id, details: JSON.stringify(arrivals)
        }]).select().single()

        const existingShop2Task = tasks.find(t =>
          String(t.order_id) === String(task.order_id) &&
          t.step?.includes('Пресування') &&
          t.batch_index === task.batch_index
        )
        if (existingShop2Task) {
          await supabase.from('tasks').update({
            status: 'in-progress',
            plan_snapshot: { ...(existingShop2Task.plan_snapshot || {}), arrival_doc_id: moveDoc?.id || null, arrivals }
          }).eq('id', existingShop2Task.id)
        } else {
          await supabase.from('tasks').insert([{
            order_id: task.order_id,
            step: 'Пресування [ЦЕХ №2]',
            status: 'in-progress',
            planned_sets: task.planned_sets || 0,
            estimated_time: task.estimated_time || 0,
            engineer_conf: true,
            warehouse_conf: 'true',
            director_conf: true,
            batch_index: task.batch_index || null,
            plan_snapshot: { ...task.plan_snapshot, arrival_doc_id: moveDoc?.id || null, arrivals }
          }])
        }
      } catch (e) { console.error("BZ/Transfer error:", e) }

      refreshTable('inventory'); refreshTable('tasks'); refreshTable('reception_docs'); refreshTable('material_requests')
    } catch (err) { console.error('Handover error:', err); throw err }
  }

  const cancelHandoverToShop2 = async (taskId) => {
    try {
      const task = tasks.find(t => String(t.id) === String(taskId))
      if (!task) return
      const shop2Task = tasks.find(t => String(t.order_id) === String(task.order_id) && t.step === 'Пресування [ЦЕХ №2]' && t.batch_index === task.batch_index)
      const snapshotPartsArr = Object.keys(task.plan_snapshot || {})
      const { data: freshInventory } = await supabase.from('inventory').select('*')
      const currentInventory = freshInventory || inventory

      // ── Завантажуємо картки ОДИН РАЗ за межами циклу ──
      const { data: taskCards } = await supabase.from('work_cards')
        .select('nomenclature_id, quantity')
        .eq('task_id', taskId)
        .eq('status', 'completed')

      for (const nomId of snapshotPartsArr) {
        const nom = nomenclatures.find(n => String(n.id) === String(nomId))
        const nomCards = (taskCards || []).filter(c => String(c.nomenclature_id) === String(nomId))
        const totalToMoveBack = nomCards.reduce((sum, c) => sum + (Number(c.quantity) || 0), 0)
        const snapshotNeed = Number(task.plan_snapshot[nomId]?.need) || 0
        const moveBackSemi = Math.min(totalToMoveBack, snapshotNeed)
        const moveBackBz = Math.max(0, totalToMoveBack - moveBackSemi)
        const s2Semi = currentInventory.find(i => String(i.nomenclature_id) === String(nomId) && i.type === 'semi_shop2')
        if (s2Semi && moveBackSemi > 0) {
          const take = Math.min(Number(s2Semi.total_qty) || 0, moveBackSemi)
          await supabase.from('inventory').update({ total_qty: (Number(s2Semi.total_qty) || 0) - take }).eq('id', s2Semi.id)
          const s1Semi = currentInventory.find(i => String(i.nomenclature_id) === String(nomId) && i.type === 'semi')
          if (s1Semi) await supabase.from('inventory').update({ total_qty: (Number(s1Semi.total_qty) || 0) + take }).eq('id', s1Semi.id)
          else await supabase.from('inventory').insert([{ nomenclature_id: nomId, name: nom?.name || 'Деталь', total_qty: take, reserved_qty: 0, type: 'semi', unit: nom?.unit || 'шт' }])
        }
        const s2Bz = currentInventory.find(i => String(i.nomenclature_id) === String(nomId) && i.type === 'bz_shop2')
        if (s2Bz && moveBackBz > 0) {
          const take = Math.min(Number(s2Bz.total_qty) || 0, moveBackBz)
          await supabase.from('inventory').update({ total_qty: (Number(s2Bz.total_qty) || 0) - take }).eq('id', s2Bz.id)
          const s1WipBz = currentInventory.find(i => String(i.nomenclature_id) === String(nomId) && i.type === 'wip_bz')
          if (s1WipBz) await supabase.from('inventory').update({ total_qty: (Number(s1WipBz.total_qty) || 0) + take }).eq('id', s1WipBz.id)
          else await supabase.from('inventory').insert([{ nomenclature_id: nomId, name: nom?.name || 'Деталь', total_qty: take, reserved_qty: 0, type: 'wip_bz', unit: nom?.unit || 'шт' }])
        }
      }
      if (shop2Task) await supabase.from('tasks').delete().eq('id', shop2Task.id)
      await supabase.from('tasks').update({ status: 'in-progress', completed_at: null }).eq('id', taskId)
      refreshTable('tasks'); refreshTable('inventory')
    } catch (err) { console.error('Cancel handover error:', err); throw err }
  }

  const completeTaskShop2 = async (taskId) => {
    try {
      const task = tasks.find(t => String(t.id) === String(taskId))
      const order = orders.find(o => String(o.id) === String(task?.order_id))
      if (!task || !order) return
      await deductIssuedMaterialsForTask(taskId)
      await supabase.from('tasks').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', taskId)
      const itemNoms = (order.order_items || []).map(it => it.nomenclature_id)
      const childIds = bomItems.filter(b => itemNoms.map(String).includes(String(b.parent_id))).map(b => b.child_id)
      const allRelatedNoms = Array.from(new Set([...itemNoms, ...childIds]))
      for (const nomId of allRelatedNoms) {
        const shop2Stock = (inventory || []).filter(i => String(i.nomenclature_id) === String(nomId) && (i.type === 'wip_bz' || i.type === 'bz_shop2'))
        let totalToMove = 0
        for (const s of shop2Stock) totalToMove += (Number(s.total_qty) || 0)
        if (totalToMove > 0) {
          const { data: bzItem } = await supabase.from('inventory').select('*').eq('nomenclature_id', nomId).eq('type', 'bz').limit(1).maybeSingle()
          if (bzItem) await supabase.from('inventory').update({ total_qty: (Number(bzItem.total_qty) || 0) + totalToMove }).eq('id', bzItem.id)
          else { const nom = nomenclatures.find(n => n.id === nomId); await supabase.from('inventory').insert([{ nomenclature_id: nomId, name: nom?.name || 'BZ Item', unit: nom?.unit || 'шт', total_qty: totalToMove, reserved_qty: 0, type: 'bz', pocket_owner: null }]) }
          for (const s of shop2Stock) { if (s.type === 'bz_shop2') await supabase.from('inventory').update({ total_qty: 0 }).eq('id', s.id); else await supabase.from('inventory').delete().eq('id', s.id) }
        }
        
        // Also reset semi_shop2 to 0 for these nomenclatures
        const semiShop2Item = (inventory || []).find(i => String(i.nomenclature_id) === String(nomId) && i.type === 'semi_shop2')
        if (semiShop2Item && (Number(semiShop2Item.total_qty) || 0) > 0) {
          await supabase.from('inventory').update({ total_qty: 0 }).eq('id', semiShop2Item.id)
        }
      }

      // Also clean up any unconsumed at-shop2-buffer cards for this order and move leftover stock to BZ
      if (task.order_id) {
        const { data: unconsumedBufferCards } = await supabase
          .from('work_cards')
          .select('*')
          .eq('order_id', task.order_id)
          .eq('status', 'at-shop2-buffer')

        if (unconsumedBufferCards && unconsumedBufferCards.length > 0) {
          for (const bufCard of unconsumedBufferCards) {
            const bufQty = Number(bufCard.quantity) || 0
            const usedQty = Number(bufCard.used_in_shop2_qty) || 0
            const leftover = bufQty - usedQty
            if (leftover > 0) {
              await supabase.from('work_cards').update({ used_in_shop2_qty: bufQty }).eq('id', bufCard.id)
              const { data: bzItem } = await supabase.from('inventory').select('*').eq('nomenclature_id', bufCard.nomenclature_id).eq('type', 'bz').limit(1).maybeSingle()
              if (bzItem) {
                await supabase.from('inventory').update({ total_qty: (Number(bzItem.total_qty) || 0) + leftover }).eq('id', bzItem.id)
              } else {
                const nom = nomenclatures.find(n => String(n.id) === String(bufCard.nomenclature_id))
                await supabase.from('inventory').insert([{
                  nomenclature_id: bufCard.nomenclature_id,
                  name: nom?.name || 'Деталь',
                  unit: nom?.unit || 'шт',
                  total_qty: leftover,
                  reserved_qty: 0,
                  type: 'bz',
                  pocket_owner: null
                }])
              }
            }
          }
        }
      }

      refreshTable('inventory'); refreshTable('tasks'); refreshTable('work_cards')
    } catch (err) { console.error('Error completing Shop 2 task:', err); throw err }
  }

  const directHandoverToSGP = async (taskId, nomenclatureId, needQty, bzTotal) => {
    try {
      const task = tasks.find(t => String(t.id) === String(taskId))
      const nom = nomenclatures.find(n => String(n.id) === String(nomenclatureId))
      const order = orders.find(o => String(o.id) === String(task?.order_id))
      if (!task || !nom) return

      // Calculate sibling completed cards finished sum
      const { data: siblingCards } = await supabase.from('work_cards')
        .select('id, quantity, card_info, operation')
        .eq('task_id', taskId)
        .eq('nomenclature_id', nomenclatureId)
        .eq('status', 'completed')

      let siblingFinishedSum = 0
      for (const sib of (siblingCards || [])) {
        const sibTotal = Number(sib.quantity) || 0
        const sibBzTotal = Number(sib.card_info?.match(/\[BZ:(\d+)\]/)?.[1]) || 0
        const sibNeedQty = Number(sib.card_info?.match(/\[NEED:(\d+)\]/)?.[1]) || (Math.max(0, sibTotal - sibBzTotal))
        const sibIsRework = sib.card_info?.includes('[REWORK]') || sib.operation === 'Доопрацювання' || sib.card_info?.includes('Автоматично з Сортування')
        const sibFinished = sibIsRework ? 0 : Math.min(sibTotal, sibNeedQty)
        siblingFinishedSum += sibFinished
      }

      const totalQty = Number(needQty) + Number(bzTotal)

      let plannedNeed = Number(needQty)
      const taskNeed = Number(task.plan_snapshot?.[String(nomenclatureId)]?.need)
      if (taskNeed && !isNaN(taskNeed)) plannedNeed = taskNeed

      const remainingNeed = Math.max(0, plannedNeed - siblingFinishedSum)
      const finishedQty = Math.min(totalQty, remainingNeed)
      const actualBzQty = Math.max(0, totalQty - finishedQty)

      const { data: card, error: cardErr } = await supabase.from('work_cards').insert([{ task_id: taskId, order_id: task.order_id, nomenclature_id: nomenclatureId, quantity: totalQty, operation: 'Пакування/СГП', status: 'completed', operator_name: 'Система', completed_at: new Date().toISOString(), card_info: `[ЦЕХ №2] [NEED:${finishedQty}] [BZ:${actualBzQty}] Наряд №${order?.order_num || ''}${task.batch_index ? `/${task.batch_index}` : ''} [ПРЯМА ПЕРЕДАЧА]` }]).select().single()
      if (cardErr) throw cardErr

      // Оновлюємо used_in_shop2_qty на source-картках (розподіляємо по черзі)
      const { data: sourceCards } = await supabase.from('work_cards')
        .select('*')
        .eq('order_id', task.order_id)
        .eq('nomenclature_id', nomenclatureId)
        .eq('status', 'at-shop2-buffer')

      if (sourceCards && sourceCards.length > 0) {
        const sortedSource = sourceCards.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
        let remaining = totalQty
        for (const srcCard of sortedSource) {
          if (remaining <= 0) break
          const available = (Number(srcCard.quantity) || 0) - (Number(srcCard.used_in_shop2_qty) || 0)
          if (available <= 0) continue
          const toUse = Math.min(available, remaining)
          await supabase.from('work_cards')
            .update({ used_in_shop2_qty: (Number(srcCard.used_in_shop2_qty) || 0) + toUse })
            .eq('id', srcCard.id)
          remaining -= toUse
        }
      }

      const inventoryUpdates = []
      const subFromS2Unified = async (nid, totalDeductQty) => {
        if (!totalDeductQty || totalDeductQty <= 0) return
        let remaining = totalDeductQty
        const { data: rows } = await supabase.from('inventory').select('*').eq('nomenclature_id', nid).in('type', ['semi_shop2', 'bz_shop2'])
        const sortedRows = (rows || []).sort((a, b) => {
          if (a.type === 'semi_shop2' && b.type === 'bz_shop2') return -1
          if (a.type === 'bz_shop2' && b.type === 'semi_shop2') return 1
          return 0
        })
        for (const r of sortedRows) {
          const current = Number(r.total_qty) || 0
          const take = Math.min(current, remaining)
          if (take > 0) { inventoryUpdates.push({ ...r, total_qty: current - take }); remaining -= take }
          if (remaining <= 0) break
        }
      }
      const totalQtyToDeduct = finishedQty + actualBzQty
      await subFromS2Unified(nomenclatureId, totalQtyToDeduct)
      if (finishedQty > 0) {
        const { data: finishedItem } = await supabase.from('inventory').select('*').eq('nomenclature_id', nomenclatureId).eq('type', 'finished').limit(1).maybeSingle()
        if (finishedItem) inventoryUpdates.push({ ...finishedItem, total_qty: (Number(finishedItem.total_qty) || 0) + finishedQty })
        else await supabase.from('inventory').insert([{ nomenclature_id: nomenclatureId, name: nom.name, unit: nom.unit || 'шт', total_qty: finishedQty, reserved_qty: 0, type: 'finished' }])
      }
      if (actualBzQty > 0) {
        const { data: bzItem } = await supabase.from('inventory').select('*').eq('nomenclature_id', nomenclatureId).eq('type', 'bz').limit(1).maybeSingle()
        if (bzItem) inventoryUpdates.push({ ...bzItem, total_qty: (Number(bzItem.total_qty) || 0) + actualBzQty })
        else await supabase.from('inventory').insert([{ nomenclature_id: nomenclatureId, name: nom.name, unit: nom.unit || 'шт', total_qty: actualBzQty, reserved_qty: 0, type: 'bz', pocket_owner: null }])
      }
      if (inventoryUpdates.length > 0) await supabase.from('inventory').upsert(inventoryUpdates)
      await supabase.from('work_card_history').insert([{ card_id: card.id, nomenclature_id: nomenclatureId, stage_name: 'Пакування/СГП', operator_name: 'Система (ПРЯМА ПЕРЕДАЧА)', qty_at_start: totalQty, qty_completed: totalQty, scrap_qty: 0, completed_at: new Date().toISOString() }])
      refreshTable('inventory'); refreshTable('tasks')
      return { success: true }
    } catch (e) { console.error("Direct handover error:", e); throw e }
  }

  const handoverToSGP = async (cardId) => {
    try {
      const { data: freshCard } = await supabase.from('work_cards').select('id, status, nomenclature_id, quantity, card_info, order_id, task_id, operation').eq('id', cardId).single()
      if (!freshCard) return
      if (freshCard.status === 'completed') { alert('Ця картка вже передана на СГП і завершена. Повторна передача неможлива.'); return }
      const card = freshCard
      const nomId = card.nomenclature_id
      const totalQty = Number(card.quantity) || 0
      const isRework = card.card_info?.includes('[REWORK]') || card.card_info?.includes('[RESTORATION]') || card.operation === 'Доопрацювання' || card.card_info?.includes('Автоматично з Сортування')

      // Calculate plannedNeed from task plan_snapshot
      let plannedNeed = 0
      if (card.task_id) {
        const { data: tData } = await supabase.from('tasks').select('plan_snapshot').eq('id', card.task_id).maybeSingle()
        if (tData && tData.plan_snapshot) {
          const snap = tData.plan_snapshot
          plannedNeed = Number(snap[String(nomId)]?.need) || 0
          if (!plannedNeed && snap.arrivals) {
            const arrVal = snap.arrivals.find(a => String(a.id) === String(nomId))
            if (arrVal) plannedNeed = Number(arrVal.semi) || 0
          }
        }
      }
      if (!plannedNeed) {
        const order = orders.find(o => String(o.id) === String(card.order_id))
        const directItem = order?.order_items?.find(it => String(it.nomenclature_id) === String(nomId))
        if (directItem) plannedNeed = Number(directItem.quantity) || 0
      }

      // Calculate sibling completed cards finished sum
      const { data: siblingCards } = await supabase.from('work_cards')
        .select('id, quantity, card_info, operation')
        .eq('task_id', card.task_id)
        .eq('nomenclature_id', nomId)
        .eq('status', 'completed')

      let siblingFinishedSum = 0
      for (const sib of (siblingCards || [])) {
        if (sib.id === cardId) continue
        const sibTotal = Number(sib.quantity) || 0
        const sibBzTotal = Number(sib.card_info?.match(/\[BZ:(\d+)\]/)?.[1]) || 0
        const sibNeedQty = Number(sib.card_info?.match(/\[NEED:(\d+)\]/)?.[1]) || (Math.max(0, sibTotal - sibBzTotal))
        const sibIsRework = sib.card_info?.includes('[REWORK]') || sib.card_info?.includes('[RESTORATION]') || sib.operation === 'Доопрацювання' || sib.card_info?.includes('Автоматично з Сортування')
        const sibFinished = sibIsRework ? 0 : Math.min(sibTotal, sibNeedQty)
        siblingFinishedSum += sibFinished
      }

      const remainingNeed = Math.max(0, plannedNeed - siblingFinishedSum)
      const finishedQty = Math.min(totalQty, remainingNeed)
      const actualBzQty = Math.max(0, totalQty - finishedQty)
      const nomName = card.card_info?.split('\n')[0]?.trim()

      const typesToFetch = ['semi_shop2', 'bz_shop2', 'finished', 'bz']
      const orFilters = []
      if (nomId) orFilters.push(`nomenclature_id.eq.${nomId}`)
      if (nomName) orFilters.push(`name.eq."${nomName.replace(/"/g, '""')}"`)

      let query = supabase.from('inventory').select('*').in('type', typesToFetch)
      if (orFilters.length > 0) {
        query = query.or(orFilters.join(','))
      }
      const { data: existingInv } = await query

      const updates = []
      const inserts = []

      // Unified deduction of totalQty from semi_shop2 and bz_shop2
      if (!isRework && totalQty > 0) {
        let remaining = totalQty
        const s2Rows = existingInv?.filter(i => 
          (nomId && String(i.nomenclature_id) === String(nomId) || i.name === nomName) && 
          (i.type === 'semi_shop2' || i.type === 'bz_shop2')
        ) || []
        
        // Sort: semi_shop2 first, then bz_shop2
        const sortedS2Rows = [...s2Rows].sort((a, b) => {
          if (a.type === 'semi_shop2' && b.type === 'bz_shop2') return -1
          if (a.type === 'bz_shop2' && b.type === 'semi_shop2') return 1
          return 0
        })

        for (const r of sortedS2Rows) {
          const current = Number(r.total_qty) || 0
          const take = Math.min(current, remaining)
          if (take > 0) {
            updates.push({ ...r, total_qty: current - take })
            remaining -= take
          }
          if (remaining <= 0) break
        }
      }

      // 3. Add to finished
      if (finishedQty > 0) {
        const finishedItem = existingInv?.find(i => (nomId && String(i.nomenclature_id) === String(nomId) || i.name === nomName) && i.type === 'finished')
        if (finishedItem) {
          updates.push({ ...finishedItem, total_qty: (Number(finishedItem.total_qty) || 0) + finishedQty })
        } else {
          const nom = nomenclatures.find(n => n.id === nomId)
          inserts.push({ nomenclature_id: nomId, name: nom?.name || nomName || 'Готова продукція', unit: nom?.unit || 'шт', total_qty: finishedQty, reserved_qty: 0, type: 'finished' })
        }
      }

      // 4. Add to bz
      if (actualBzQty > 0) {
        const bzItem = existingInv?.find(i => (nomId && String(i.nomenclature_id) === String(nomId) || i.name === nomName) && i.type === 'bz')
        if (bzItem) {
          updates.push({ ...bzItem, total_qty: (Number(bzItem.total_qty) || 0) + actualBzQty })
        } else {
          const nom = nomenclatures.find(n => n.id === nomId)
          inserts.push({ nomenclature_id: nomId, name: nom?.name || nomName || 'Запас БЗ', unit: nom?.unit || 'шт', total_qty: actualBzQty, reserved_qty: 0, type: 'bz', pocket_owner: null })
        }
      }

      const updatedCardInfo = `[ЦЕХ №2] [NEED:${finishedQty}] [BZ:${actualBzQty}] ${card.card_info || ''}`.trim().slice(0, 500)

      const writeOps = [
        supabase.from('work_card_history').insert([{ card_id: cardId, nomenclature_id: nomId, stage_name: 'Пакування/СГП', operator_name: 'Система (ТЕРМІНАЛ)', qty_at_start: totalQty, qty_completed: totalQty, scrap_qty: 0, completed_at: new Date().toISOString() }]),
        supabase.from('work_cards').update({ status: 'completed', operation: 'Пакування/СГП', card_info: updatedCardInfo }).eq('id', cardId)
      ]
      if (updates.length > 0) writeOps.push(supabase.from('inventory').upsert(updates))
      if (inserts.length > 0) writeOps.push(supabase.from('inventory').insert(inserts))

      const results = await Promise.all(writeOps)
      for (const r of results) {
        if (r.error) throw r.error
      }

      setWorkCards(prev => prev.filter(c => c.id !== cardId))
      setWorkCardHistory(prev => [{ card_id: cardId, nomenclature_id: nomId, stage_name: 'Пакування/СГП', operator_name: 'Система (ТЕРМІНАЛ)', qty_at_start: totalQty, qty_completed: totalQty, scrap_qty: 0, completed_at: new Date().toISOString() }, ...prev])
      refreshTable('work_cards')
      refreshTable('inventory')
      alert("Деталі успішно передані на Склад Готової Продукції!")
    } catch (e) {
      console.error("Помилка передачі на СГП:", e)
      alert("Помилка передачі на СГП: " + e.message)
    }
  }

  const reserveBZForTask = async (taskId, orderId, nomenclatureId, qty) => {
    try {
      const { data: bz } = await supabase.from('inventory').select('*').eq('nomenclature_id', nomenclatureId).eq('type', 'bz').limit(1).maybeSingle()
      if (!bz) throw new Error("Товар не знайдено на складі БЗ")
      
      // 1. Decrease total_qty of the main BZ storage
      const nextTotal = Math.max(0, (Number(bz.total_qty) || 0) - Number(qty))
      await supabase.from('inventory').update({ total_qty: nextTotal }).eq('id', bz.id)

      // 2. Increase total_qty of SGP finished inventory
      const { data: sgpFinished } = await supabase.from('inventory').select('*').eq('nomenclature_id', nomenclatureId).eq('type', 'finished').limit(1).maybeSingle()
      if (sgpFinished) {
        await supabase.from('inventory').update({ total_qty: (Number(sgpFinished.total_qty) || 0) + Number(qty) }).eq('id', sgpFinished.id)
      } else {
        const nom = nomenclatures.find(n => n.id === nomenclatureId)
        await supabase.from('inventory').insert([{
          nomenclature_id: nomenclatureId,
          name: nom?.name || bz.name || 'Деталь',
          total_qty: qty,
          reserved_qty: 0,
          type: 'finished',
          unit: nom?.unit || bz.unit || 'шт'
        }])
      }

      // 3. Update stock/plan values in task plan_snapshot
      const { data: s2Tasks } = await supabase.from('tasks').select('*').eq('order_id', orderId)
      if (s2Tasks) {
        for (const t of s2Tasks) {
          if (t.plan_snapshot && t.plan_snapshot[String(nomenclatureId)]) {
            const entry = { ...t.plan_snapshot[String(nomenclatureId)] }
            entry.stock = (Number(entry.stock) || 0) + Number(qty)
            entry.plan = Math.max(0, (Number(entry.plan) || 0) - Number(qty))
            
            const nextSnapshot = {
              ...t.plan_snapshot,
              [String(nomenclatureId)]: entry
            }
            await supabase.from('tasks').update({ plan_snapshot: nextSnapshot }).eq('id', t.id)
          }
        }
      }

      // 4. Create work card in completed status
      const { data: newCards } = await supabase.from('work_cards').insert([{ 
        task_id: taskId, 
        order_id: orderId, 
        nomenclature_id: nomenclatureId, 
        quantity: qty, 
        status: 'completed', 
        operation: 'Склад БЗ', 
        card_info: '[ЗІ СКЛАДУ БЗ]' 
      }]).select()
      
      const newCard = newCards && newCards.length > 0 ? newCards[0] : null
      if (newCard) {
        await supabase.from('work_card_history').insert([{ 
          card_id: newCard.id,
          nomenclature_id: nomenclatureId, 
          stage_name: 'Склад БЗ', 
          operator_name: 'Система (БРОНЬ)', 
          qty_at_start: qty, 
          qty_completed: qty, 
          scrap_qty: 0, 
          completed_at: new Date().toISOString() 
        }])
      }
      
      refreshTable('inventory'); refreshTable('work_cards'); refreshTable('tasks'); return { success: true }
    } catch (err) { console.error(err); throw err }
  }

  const completePackaging = async (orderId) => {
    await supabase.from('orders').update({ status: 'packaged' }).eq('id', orderId)
    refreshTable('orders')
  }


  return {
    approveWarehouse,
    approveEngineer,
    approveDirector,
    completeTaskByMaster,
    handoverTaskToShop2,
    cancelHandoverToShop2,
    completeTaskShop2,
    directHandoverToSGP,
    handoverToSGP,
    reserveBZForTask,
    completePackaging
  }
}
