import { confirmedRpc } from '../../services/confirmedRpc.js'
import { supabase } from '../../supabase.js'
import { resolveCanonicalNomId, getLegacyIdsForNomId } from '../../modules/Nomenclature/utils/nomenclatureHelpers.js'

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
      if (existingShop2 && existingShop2.status === 'waiting') {
        await supabase.from('tasks').update({ status: 'in-progress' }).eq('id', existingShop2.id)
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
    await confirmedRpc(supabase, 'rpc_handover_task_to_shop2_atomic', { p_task_id: taskId })
    // Keep the existing material workflow, but never conceal its failure.
    await deductIssuedMaterialsForTask(taskId)
    for (const table of ['inventory', 'tasks', 'reception_docs', 'material_requests']) refreshTable(table)
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
      const canonicalNomId = resolveCanonicalNomId(nomenclatureId, nomenclatures) || String(nomenclatureId || '')
      const legacyIds = getLegacyIdsForNomId(canonicalNomId, nomenclatures)
      const allNomIds = Array.from(new Set([canonicalNomId, ...legacyIds].filter(Boolean)))
      const nom = nomenclatures.find(n => String(n.id) === canonicalNomId)
      const order = orders.find(o => String(o.id) === String(task?.order_id))
      if (!task || !nom) return

      // Calculate sibling completed cards finished sum
      const { data: siblingCards } = await supabase.from('work_cards')
        .select('id, quantity, card_info, operation')
        .eq('task_id', taskId)
        .in('nomenclature_id', allNomIds)
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
      let taskNeed = Number(task.plan_snapshot?.[canonicalNomId]?.need)
      if (isNaN(taskNeed) && legacyIds.length > 0) {
        for (const legId of legacyIds) {
          const legNeed = Number(task.plan_snapshot?.[legId]?.need)
          if (!isNaN(legNeed)) { taskNeed = legNeed; break }
        }
      }
      if (taskNeed && !isNaN(taskNeed)) plannedNeed = taskNeed

      const remainingNeed = Math.max(0, plannedNeed - siblingFinishedSum)
      const finishedQty = Math.min(totalQty, remainingNeed)
      const actualBzQty = Math.max(0, totalQty - finishedQty)

      const { data: card, error: cardErr } = await supabase.from('work_cards').insert([{ task_id: taskId, order_id: task.order_id, nomenclature_id: canonicalNomId, quantity: totalQty, operation: 'Пакування/СГП', status: 'completed', operator_name: 'Система', completed_at: new Date().toISOString(), card_info: `[ЦЕХ №2] [NEED:${finishedQty}] [BZ:${actualBzQty}] Наряд №${order?.order_num || ''}${task.batch_index ? `/${task.batch_index}` : ''} [ПРЯМА ПЕРЕДАЧА]` }]).select().single()
      if (cardErr) throw cardErr

      // Оновлюємо used_in_shop2_qty на source-картках (розподіляємо по черзі)
      const { data: sourceCards } = await supabase.from('work_cards')
        .select('*')
        .eq('order_id', task.order_id)
        .in('nomenclature_id', allNomIds)
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
      const subFromS2Unified = async (nids, totalDeductQty) => {
        if (!totalDeductQty || totalDeductQty <= 0) return
        let remaining = totalDeductQty
        const { data: rows } = await supabase.from('inventory').select('*').in('nomenclature_id', nids).in('type', ['semi_shop2', 'bz_shop2'])
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
      await subFromS2Unified(allNomIds, totalQtyToDeduct)
      if (finishedQty > 0) {
        const { data: finishedItem } = await supabase.from('inventory').select('*').in('nomenclature_id', allNomIds).eq('type', 'finished').limit(1).maybeSingle()
        if (finishedItem) inventoryUpdates.push({ ...finishedItem, nomenclature_id: canonicalNomId, total_qty: (Number(finishedItem.total_qty) || 0) + finishedQty })
        else await supabase.from('inventory').insert([{ nomenclature_id: canonicalNomId, name: nom.name, unit: nom.unit || 'шт', total_qty: finishedQty, reserved_qty: 0, type: 'finished' }])
      }
      if (actualBzQty > 0) {
        const { data: bzItem } = await supabase.from('inventory').select('*').in('nomenclature_id', allNomIds).eq('type', 'bz').limit(1).maybeSingle()
        if (bzItem) inventoryUpdates.push({ ...bzItem, nomenclature_id: canonicalNomId, total_qty: (Number(bzItem.total_qty) || 0) + actualBzQty })
        else await supabase.from('inventory').insert([{ nomenclature_id: canonicalNomId, name: nom.name, unit: nom.unit || 'шт', total_qty: actualBzQty, reserved_qty: 0, type: 'bz', pocket_owner: null }])
      }
      if (inventoryUpdates.length > 0) await supabase.from('inventory').upsert(inventoryUpdates)
      await supabase.from('work_card_history').insert([{ card_id: card.id, nomenclature_id: canonicalNomId, stage_name: 'Пакування/СГП', operator_name: 'Система (ПРЯМА ПЕРЕДАЧА)', qty_at_start: totalQty, qty_completed: totalQty, scrap_qty: 0, completed_at: new Date().toISOString() }])
      refreshTable('inventory'); refreshTable('tasks')
      return { success: true }
    } catch (e) { console.error("Direct handover error:", e); throw e }
  }

  const handoverToSGP = async (cardId) => {
    try {
      await confirmedRpc(supabase, 'rpc_handover_to_sgp_atomic', { p_card_id: cardId })
      setWorkCards(prev => prev.filter(c => String(c.id) !== String(cardId)))
      refreshTable('work_cards')
      refreshTable('inventory')
      alert('Деталі успішно передані на Склад Готової Продукції!')
    } catch (error) {
      refreshTable('work_cards')
      refreshTable('inventory')
      alert('Передачу на СГП не підтверджено: ' + error.message)
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
