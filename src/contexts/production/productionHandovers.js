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
          else await supabase.from('inventory').insert([{ nomenclature_id: nomId, name: nom?.name || 'Деталь', total_qty: take, reserved_qty: 0, type: 'semi', unit: nom?.unit || 'шт', warehouse: 'production' }])
        }
        const s2Bz = currentInventory.find(i => String(i.nomenclature_id) === String(nomId) && i.type === 'bz_shop2')
        if (s2Bz && moveBackBz > 0) {
          const take = Math.min(Number(s2Bz.total_qty) || 0, moveBackBz)
          await supabase.from('inventory').update({ total_qty: (Number(s2Bz.total_qty) || 0) - take }).eq('id', s2Bz.id)
          const s1WipBz = currentInventory.find(i => String(i.nomenclature_id) === String(nomId) && i.type === 'wip_bz')
          if (s1WipBz) await supabase.from('inventory').update({ total_qty: (Number(s1WipBz.total_qty) || 0) + take }).eq('id', s1WipBz.id)
          else await supabase.from('inventory').insert([{ nomenclature_id: nomId, name: nom?.name || 'Деталь', total_qty: take, reserved_qty: 0, type: 'wip_bz', unit: nom?.unit || 'шт', warehouse: 'production' }])
        }
      }
      if (shop2Task) await supabase.from('tasks').delete().eq('id', shop2Task.id)
      await supabase.from('tasks').update({ status: 'in-progress', completed_at: null }).eq('id', taskId)
      refreshTable('tasks'); refreshTable('inventory')
    } catch (err) { console.error('Cancel handover error:', err); throw err }
  }

  const reserveShop2OutputForOrder = async ({ orderId, taskId, nomenclatureId, arrivedQty, sgpInvId = null }) => {
    try {
      const qtyArrived = Number(arrivedQty) || 0
      if (!orderId || qtyArrived <= 0 || !nomenclatureId) return

      const canonicalNomId = resolveCanonicalNomId(nomenclatureId, nomenclatures) || String(nomenclatureId)
      const legacyIds = getLegacyIdsForNomId(canonicalNomId, nomenclatures)
      const allNomIds = Array.from(new Set([canonicalNomId, ...legacyIds].filter(Boolean)))
      const nom = nomenclatures.find(n => String(n.id) === canonicalNomId)

      let order = orders.find(o => String(o.id) === String(orderId))
      if (!order) {
        const { data: dbOrder } = await supabase.from('orders').select('*, order_items(*)').eq('id', orderId).maybeSingle()
        order = dbOrder
      }
      if (!order) return
      if (['shipped', 'completed', 'cancelled', 'delivered'].includes(String(order.status || '').toLowerCase())) return
      if (String(order.order_num || '').startsWith('ВБ')) return // Internal accumulation order stays 100% free on SGP

      let task = taskId ? tasks.find(t => String(t.id) === String(taskId)) : null
      if (!task && taskId) {
        const { data: dbTask } = await supabase.from('tasks').select('*').eq('id', taskId).maybeSingle()
        task = dbTask
      }
      if (task?.plan_snapshot?._metadata?.is_packaged || task?.plan_snapshot?._metadata?.is_shipped) return

      // Determine total needed for this nomenclature in this batch/order
      let orderNeed = 0
      const snap = task?.plan_snapshot
      if (snap && typeof snap === 'object') {
        for (const nid of allNomIds) {
          const snapNeed = Number(snap[nid]?.need)
          if (Number.isFinite(snapNeed) && snapNeed > 0) {
            orderNeed = snapNeed
            break
          }
        }
      }
      if (orderNeed <= 0 && Array.isArray(order.order_items)) {
        for (const item of order.order_items) {
          if (allNomIds.includes(String(item.nomenclature_id))) {
            orderNeed += Number(item.quantity) || 0
          } else {
            const pBom = (bomItems || []).filter(b => String(b.parent_id) === String(item.nomenclature_id))
            for (const b of pBom) {
              if (allNomIds.includes(String(b.child_id))) {
                orderNeed += (Number(item.quantity) || 0) * (Number(b.quantity_per_parent) || 1)
              }
            }
          }
        }
      }
      if (orderNeed <= 0) return

      let targetInvId = sgpInvId
      if (!targetInvId) {
        const { data: sgpRow } = await supabase
          .from('inventory')
          .select('id')
          .in('nomenclature_id', allNomIds)
          .eq('warehouse', 'sgp')
          .eq('type', 'finished')
          .limit(1)
          .maybeSingle()
        targetInvId = sgpRow?.id || null
      }
      if (!targetInvId) return

      const { data: existingReqs } = await supabase
        .from('material_requests')
        .select('*')
        .eq('order_id', orderId)
        .in('nomenclature_id', allNomIds)
        .in('status', ['issued', 'completed', 'pending', 'processing'])

      const packagingReqs = (existingReqs || []).filter(r =>
        String(r.details || '').includes('ЗАПИТ НА КОМПЛЕКТУВАННЯ')
      )

      const alreadyIssuedOrCompleted = packagingReqs
        .filter(r => r.status === 'issued' || r.status === 'completed')
        .reduce((sum, r) => sum + (Number(r.quantity) || 0), 0)

      let remainingNeedToReserve = Math.min(qtyArrived, Math.max(0, orderNeed - alreadyIssuedOrCompleted))
      if (remainingNeedToReserve <= 0) return

      // 1. If Packaging already created a pending/processing request, promote it to issued
      const pendingReqs = packagingReqs.filter(r => r.status === 'pending' || r.status === 'processing')
      for (const pReq of pendingReqs) {
        if (remainingNeedToReserve <= 0) break
        const pQty = Number(pReq.quantity) || 0
        if (pQty <= remainingNeedToReserve) {
          await supabase
            .from('material_requests')
            .update({ status: 'issued', inventory_id: targetInvId })
            .eq('id', pReq.id)
          remainingNeedToReserve -= pQty
        }
      }

      if (remainingNeedToReserve <= 0) {
        refreshTable('material_requests')
        refreshTable('inventory')
        return
      }

      // 2. Otherwise upsert/insert an [AUTO_SHOP2_RESERVATION] issued request for this batch
      const existingAutoShop2 = packagingReqs.find(r =>
        r.status === 'issued' &&
        String(r.details || '').includes('[AUTO_SHOP2_RESERVATION]') &&
        (!taskId || String(r.task_id) === String(taskId))
      )
      const batchSuffix = task?.batch_index ? `/${task.batch_index}` : ''
      const orderNum = order.order_num || String(orderId)
      const partName = nom?.name || 'Деталь'

      const finalIssuedForOrder = alreadyIssuedOrCompleted + remainingNeedToReserve

      if (existingAutoShop2) {
        const nextQty = (Number(existingAutoShop2.quantity) || 0) + remainingNeedToReserve
        await supabase
          .from('material_requests')
          .update({
            quantity: nextQty,
            inventory_id: targetInvId,
            details: `ЗАПИТ НА КОМПЛЕКТУВАННЯ (${orderNum}${batchSuffix}) [PACKAGING_SOURCE:SGP] [AUTO_SHOP2_RESERVATION]: ${partName} — ${nextQty} шт.`
          })
          .eq('id', existingAutoShop2.id)
      } else {
        await supabase
          .from('material_requests')
          .insert([{
            order_id: orderId,
            task_id: taskId || null,
            nomenclature_id: canonicalNomId,
            inventory_id: targetInvId,
            quantity: remainingNeedToReserve,
            status: 'issued',
            category: 'packaging',
            target_warehouse: 'sgp',
            details: `ЗАПИТ НА КОМПЛЕКТУВАННЯ (${orderNum}${batchSuffix}) [PACKAGING_SOURCE:SGP] [AUTO_SHOP2_RESERVATION]: ${partName} — ${remainingNeedToReserve} шт.`
          }])
      }

      // If any pending packaging request is now fully covered by the issued reservation, cancel the duplicate pending row
      const coveredPendingIds = pendingReqs
        .filter(pReq => (Number(pReq.quantity) || 0) <= finalIssuedForOrder)
        .map(pReq => pReq.id)
        .filter(Boolean)
      if (coveredPendingIds.length > 0) {
        await supabase
          .from('material_requests')
          .update({ status: 'cancelled' })
          .in('id', coveredPendingIds)
      }
      refreshTable('material_requests')
      refreshTable('inventory')
    } catch (err) {
      console.warn('[Shop2->SGP Reserve] non-fatal warning:', err)
    }
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
          const { data: finItem } = await supabase.from('inventory').select('*').eq('nomenclature_id', nomId).eq('warehouse', 'sgp').eq('type', 'finished').limit(1).maybeSingle()
          if (finItem) await supabase.from('inventory').update({ total_qty: (Number(finItem.total_qty) || 0) + totalToMove }).eq('id', finItem.id)
          else { const nom = nomenclatures.find(n => n.id === nomId); await supabase.from('inventory').insert([{ nomenclature_id: nomId, name: nom?.name || 'Деталь', unit: nom?.unit || 'шт', total_qty: totalToMove, reserved_qty: 0, type: 'finished', pocket_owner: null, warehouse: 'sgp' }]) }
          for (const s of shop2Stock) { if (s.type === 'bz_shop2') await supabase.from('inventory').update({ total_qty: 0 }).eq('id', s.id); else await supabase.from('inventory').delete().eq('id', s.id) }
        }
        
        // Also reset semi_shop2 to 0 for these nomenclatures
        const semiShop2Item = (inventory || []).find(i => String(i.nomenclature_id) === String(nomId) && i.type === 'semi_shop2')
        if (semiShop2Item && (Number(semiShop2Item.total_qty) || 0) > 0) {
          await supabase.from('inventory').update({ total_qty: 0 }).eq('id', semiShop2Item.id)
        }
      }

      // Also clean up any unconsumed at-shop2-buffer cards for this order and move leftover stock to finished SGP
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
              const { data: finItem } = await supabase.from('inventory').select('*').eq('nomenclature_id', bufCard.nomenclature_id).eq('warehouse', 'sgp').eq('type', 'finished').limit(1).maybeSingle()
              if (finItem) {
                await supabase.from('inventory').update({ total_qty: (Number(finItem.total_qty) || 0) + leftover }).eq('id', finItem.id)
              } else {
                const nom = nomenclatures.find(n => String(n.id) === String(bufCard.nomenclature_id))
                await supabase.from('inventory').insert([{
                  nomenclature_id: bufCard.nomenclature_id,
                  name: nom?.name || 'Деталь',
                  unit: nom?.unit || 'шт',
                  total_qty: leftover,
                  reserved_qty: 0,
                  type: 'finished',
                  pocket_owner: null,
                  warehouse: 'sgp'
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

      // Both finishedQty (order need) and actualBzQty (sheet surplus) are finished parts on SGP!
      let sgpFinishedRowId = null
      if (totalQtyToDeduct > 0) {
        const { data: finishedItem } = await supabase.from('inventory').select('*').in('nomenclature_id', allNomIds).eq('warehouse', 'sgp').eq('type', 'finished').limit(1).maybeSingle()
        if (finishedItem) {
          sgpFinishedRowId = finishedItem.id
          inventoryUpdates.push({ ...finishedItem, nomenclature_id: canonicalNomId, total_qty: (Number(finishedItem.total_qty) || 0) + totalQtyToDeduct })
        } else {
          const { data: insertedFin } = await supabase.from('inventory').insert([{ nomenclature_id: canonicalNomId, name: nom.name, unit: nom.unit || 'шт', total_qty: totalQtyToDeduct, reserved_qty: 0, type: 'finished', warehouse: 'sgp' }]).select('id').single()
          sgpFinishedRowId = insertedFin?.id || null
        }
      }
      if (inventoryUpdates.length > 0) await supabase.from('inventory').upsert(inventoryUpdates)
      await supabase.from('work_card_history').insert([{ card_id: card.id, nomenclature_id: canonicalNomId, stage_name: 'Пакування/СГП', operator_name: 'Система (ПРЯМА ПЕРЕДАЧА)', qty_at_start: totalQty, qty_completed: totalQty, scrap_qty: 0, completed_at: new Date().toISOString() }])

      if (finishedQty > 0 && task.order_id) {
        await reserveShop2OutputForOrder({
          orderId: task.order_id,
          taskId: task.id,
          nomenclatureId: canonicalNomId,
          arrivedQty: finishedQty,
          sgpInvId: sgpFinishedRowId
        })
      }

      refreshTable('inventory'); refreshTable('tasks')
      return { success: true }
    } catch (e) { console.error("Direct handover error:", e); throw e }
  }

  const handoverToSGP = async (cardId) => {
    try {
      const cardObj = (workCards || []).find(c => String(c.id) === String(cardId))
      let cardMeta = cardObj
      if (!cardMeta) {
        const { data: dbCard } = await supabase.from('work_cards').select('id, task_id, order_id, nomenclature_id, quantity').eq('id', cardId).maybeSingle()
        cardMeta = dbCard
      }
      await confirmedRpc(supabase, 'rpc_handover_to_sgp_atomic', { p_card_id: cardId })
      if (cardMeta?.order_id && cardMeta?.nomenclature_id && Number(cardMeta?.quantity) > 0) {
        await reserveShop2OutputForOrder({
          orderId: cardMeta.order_id,
          taskId: cardMeta.task_id,
          nomenclatureId: cardMeta.nomenclature_id,
          arrivedQty: Number(cardMeta.quantity)
        })
      }
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
          unit: nom?.unit || bz.unit || 'шт',
          warehouse: 'sgp'
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
