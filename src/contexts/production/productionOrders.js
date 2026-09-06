import { supabase } from '../../supabase.js'
import { isMachineMatch } from '../../utils/cutterCalculator.js'
import {
  getRequestQty,
  normalizeName,
  stripMaterialTags,
  findExplicitRawMaterialNom as findExplicitRawNom
} from './productionShared.js'

export function createProductionOrdersActions({
  orders, tasks, inventory, nomenclatures, bomItems, workCards,
  machineOperations, machines, systemUsers, currentUser,
  setTasks, setWorkCards, setWorkCardHistory, setManagementTasks, setMachines,
  normalize, refreshTable, fetchData,
  deductIssuedMaterialsForTask,
  maintenanceCheckEnabled
}) {
  const findExplicitRawMaterialNom = (materialLabel) => findExplicitRawNom(materialLabel, nomenclatures)

  const updateOrder = async (orderId, header, items) => {
    if (header.customer) {
      const trimmedName = header.customer.trim()
      const { data: existing } = await supabase.from('customers').select('id').ilike('name', trimmedName).maybeSingle()
      if (!existing) await supabase.from('customers').insert([{ name: trimmedName, official_name: header.official_customer?.trim() || '' }])
    }

    let supaNomenclatureId = null;
    if (header.productName) {
      const { data: nomRow } = await supabase.from('nomenclatures').select('id').ilike('name', header.productName.trim()).maybeSingle();
      if (nomRow) {
        supaNomenclatureId = nomRow.id;
      } else {
        const normInput = normalizeName(header.productName);
        const match = (nomenclatures || []).find(n => normalizeName(n.name) === normInput);
        if (match) supaNomenclatureId = match.id;
      }
    }

    const orderedQty = items?.[0]?.quantity || header.quantity || 0;
    
    // Update order header
    const updatePayload = {
      customer: header.customer,
      official_customer: header.official_customer,
      deadline: header.deadline,
      nomenclature_id: supaNomenclatureId,
      quantity: Number(orderedQty),
      accessories: header.productName || '',
    };
    if (header.invoice_num !== undefined || header.invoiceNum !== undefined) {
      updatePayload.invoice_num = header.invoice_num || header.invoiceNum || null;
    }

    const { error } = await supabase.from('orders').update(updatePayload).eq('id', orderId)
    
    if (error) throw error

    // Re-sync order_items
    if (supaNomenclatureId) {
      await supabase.from('order_items').delete().eq('order_id', orderId)
      await supabase.from('order_items').insert([{
        order_id: orderId,
        nomenclature_id: supaNomenclatureId,
        quantity: Number(orderedQty)
      }])
    }

    refreshTable('orders')
  }

  const deleteOrder = async (orderId) => {
    try {
      const { data: tasks } = await supabase.from('tasks').select('id').eq('order_id', orderId)
      const taskIds = tasks ? tasks.map(t => t.id) : []

      let wcQuery = supabase.from('work_cards').select('id')
      if (taskIds.length > 0) {
        wcQuery = wcQuery.or(`order_id.eq.${orderId},task_id.in.(${taskIds.join(',')})`)
      } else {
        wcQuery = wcQuery.eq('order_id', orderId)
      }
      const { data: wcList } = await wcQuery
      const cardIds = wcList ? wcList.map(c => c.id) : []

      let crbQuery = supabase.from('cutter_restoration_batches').select('id')
      if (cardIds.length > 0 && taskIds.length > 0) {
        crbQuery = crbQuery.or(`order_id.eq.${orderId},source_card_id.in.(${cardIds.join(',')}),task_id.in.(${taskIds.join(',')})`)
      } else if (cardIds.length > 0) {
        crbQuery = crbQuery.or(`order_id.eq.${orderId},source_card_id.in.(${cardIds.join(',')})`)
      } else if (taskIds.length > 0) {
        crbQuery = crbQuery.or(`order_id.eq.${orderId},task_id.in.(${taskIds.join(',')})`)
      } else {
        crbQuery = crbQuery.eq('order_id', orderId)
      }
      const { data: crbList } = await crbQuery
      const crbIds = crbList ? crbList.map(b => b.id) : []

      let vrcQuery = supabase.from('vkya_restoration_cards').select('id')
      if (cardIds.length > 0 && taskIds.length > 0) {
        vrcQuery = vrcQuery.or(`source_order_id.eq.${orderId},source_card_id.in.(${cardIds.join(',')}),source_task_id.in.(${taskIds.join(',')}),route_card_id.in.(${cardIds.join(',')})`)
      } else if (cardIds.length > 0) {
        vrcQuery = vrcQuery.or(`source_order_id.eq.${orderId},source_card_id.in.(${cardIds.join(',')}),route_card_id.in.(${cardIds.join(',')})`)
      } else if (taskIds.length > 0) {
        vrcQuery = vrcQuery.or(`source_order_id.eq.${orderId},source_task_id.in.(${taskIds.join(',')})`)
      } else {
        vrcQuery = vrcQuery.eq('source_order_id', orderId)
      }
      const { data: vrcList } = await vrcQuery
      const vrcIds = vrcList ? vrcList.map(c => c.id) : []

      // Auto-release any allocated BZ reservations before deleting tasks
      try {
        const { data: bzRes } = await supabase.from('bz_inventory_reservations')
          .select('operation_id')
          .eq('status', 'allocated')
          .or(`order_id.eq.${orderId}${taskIds.length ? `,task_id.in.(${taskIds.join(',')})` : ''}`)
        if (bzRes && bzRes.length > 0) {
          const opIds = [...new Set(bzRes.map(r => r.operation_id).filter(Boolean))]
          for (const opId of opIds) {
            await supabase.rpc('release_bz_reservation', { p_operation_id: opId, p_reason: 'Авто-звільнення при видаленні замовлення' }).catch(() => {})
          }
        }
      } catch (e) {
        console.warn('BZ auto-release warning on order delete:', e)
      }

      // Phase 1: Deep leaf tables
      await Promise.allSettled([
        crbIds.length ? supabase.from('cutter_restoration_events').delete().in('batch_id', crbIds) : Promise.resolve(),
        vrcIds.length ? supabase.from('vkya_scrap_lot_allocations').delete().in('restoration_card_id', vrcIds) : Promise.resolve(),
        cardIds.length ? supabase.from('vkya_scrap_lot_allocations').delete().in('rework_card_id', cardIds) : Promise.resolve(),
        taskIds.length ? supabase.from('vkya_scrap_lot_allocations').delete().in('rework_task_id', taskIds) : Promise.resolve(),
        supabase.from('vkya_scrap_lot_allocations').delete().eq('rework_order_id', orderId),
        cardIds.length ? supabase.from('vkya_quality_resolutions').delete().in('source_card_id', cardIds) : Promise.resolve(),
        cardIds.length ? supabase.from('vkya_quality_resolutions').delete().in('route_card_id', cardIds) : Promise.resolve(),
        taskIds.length ? supabase.from('vkya_quality_resolutions').delete().in('task_id', taskIds) : Promise.resolve(),
        supabase.from('vkya_quality_resolutions').delete().eq('order_id', orderId)
      ])

      // Phase 2: Mid-level tables
      await Promise.allSettled([
        vrcIds.length ? supabase.from('vkya_restoration_cards').delete().in('id', vrcIds) : Promise.resolve(),
        crbIds.length ? supabase.from('cutter_restoration_batches').delete().in('id', crbIds) : Promise.resolve(),
        cardIds.length ? supabase.from('vkya_reclassification_queue').delete().in('source_card_id', cardIds) : Promise.resolve(),
        cardIds.length ? supabase.from('vkya_restoration_cards').delete().in('source_card_id', cardIds) : Promise.resolve(),
        cardIds.length ? supabase.from('vkya_restoration_cards').delete().in('route_card_id', cardIds) : Promise.resolve(),
        cardIds.length ? supabase.from('cutter_usage_events').delete().in('source_card_id', cardIds) : Promise.resolve(),
        cardIds.length ? supabase.from('work_card_scrap_totals').delete().in('card_id', cardIds) : Promise.resolve(),
        cardIds.length ? supabase.from('work_card_history').delete().in('card_id', cardIds) : Promise.resolve(),
        taskIds.length ? supabase.from('vkya_reclassification_queue').delete().in('source_task_id', taskIds) : Promise.resolve(),
        taskIds.length ? supabase.from('vkya_restoration_cards').delete().in('source_task_id', taskIds) : Promise.resolve(),
        taskIds.length ? supabase.from('cutter_restoration_batches').delete().in('task_id', taskIds) : Promise.resolve(),
        taskIds.length ? supabase.from('cutter_usage_events').delete().in('task_id', taskIds) : Promise.resolve(),
        taskIds.length ? supabase.from('material_requests').delete().in('task_id', taskIds) : Promise.resolve(),
        taskIds.length ? supabase.from('purchase_requests').delete().in('task_id', taskIds) : Promise.resolve(),
        taskIds.length ? supabase.from('reception_docs').delete().in('task_id', taskIds) : Promise.resolve(),
        taskIds.length ? supabase.from('work_card_scrap_totals').delete().in('task_id', taskIds) : Promise.resolve(),
        supabase.from('vkya_reclassification_queue').delete().eq('source_order_id', orderId),
        supabase.from('vkya_restoration_cards').delete().eq('source_order_id', orderId),
        supabase.from('cutter_restoration_batches').delete().eq('order_id', orderId),
        supabase.from('cutter_usage_events').delete().eq('order_id', orderId),
        supabase.from('material_requests').delete().eq('order_id', orderId),
        supabase.from('purchase_requests').delete().eq('order_id', orderId),
        supabase.from('reception_docs').delete().eq('order_id', orderId),
        supabase.from('work_card_scrap_totals').delete().eq('order_id', orderId)
      ])

      // Phase 3: Work Cards, Tasks & Order Items
      await Promise.allSettled([
        cardIds.length ? supabase.from('work_cards').delete().in('id', cardIds) : Promise.resolve(),
        taskIds.length ? supabase.from('tasks').delete().in('id', taskIds) : Promise.resolve(),
        supabase.from('work_cards').delete().eq('order_id', orderId),
        supabase.from('order_items').delete().eq('order_id', orderId)
      ])

      // Phase 4: Order row
      await supabase.from('orders').delete().eq('id', orderId)
    } catch (e) {
      console.warn('deleteOrder non-critical cleanup warning:', e)
    } finally {
      refreshTable('orders')
      refreshTable('work_cards')
      refreshTable('tasks')
    }
  }

  const superDeleteOrder = async (orderId) => {
    try {
      // 1. Fetch related objects
      const { data: orderTasks } = await supabase.from('tasks').select('id, step, status, planned_sets, plan_snapshot').eq('order_id', orderId)
      const taskIds = orderTasks ? orderTasks.map(t => t.id) : []

      // Fetch material requests related to order or tasks
      let requestsQuery = supabase.from('material_requests').select('*')
      if (taskIds.length > 0) {
        requestsQuery = requestsQuery.or(`order_id.eq.${orderId},task_id.in.(${taskIds.join(',')})`)
      } else {
        requestsQuery = requestsQuery.eq('order_id', orderId)
      }
      const { data: matRequests } = await requestsQuery

      // Fetch work cards related to order or tasks
      let cardsQuery = supabase.from('work_cards').select('*')
      if (taskIds.length > 0) {
        cardsQuery = cardsQuery.or(`order_id.eq.${orderId},task_id.in.(${taskIds.join(',')})`)
      } else {
        cardsQuery = cardsQuery.eq('order_id', orderId)
      }
      const { data: workCardsData } = await cardsQuery

      // Fetch reception docs related to order or tasks
      let recDocsQuery = supabase.from('reception_docs').select('*')
      if (taskIds.length > 0) {
        recDocsQuery = recDocsQuery.or(`order_id.eq.${orderId},task_id.in.(${taskIds.join(',')})`)
      } else {
        recDocsQuery = recDocsQuery.eq('order_id', orderId)
      }
      const { data: recDocs } = await recDocsQuery

      // 2. Fetch inventory items to optimize updates
      const allInventoryIds = new Set()
      const allNomenclatureIds = new Set()
      
      if (matRequests) {
        matRequests.forEach(r => {
          if (r.inventory_id) allInventoryIds.add(r.inventory_id)
          if (r.nomenclature_id) allNomenclatureIds.add(r.nomenclature_id)
        })
      }
      if (workCardsData) {
        workCardsData.forEach(c => {
          if (c.nomenclature_id) allNomenclatureIds.add(c.nomenclature_id)
        })
      }
      if (recDocs) {
        recDocs.forEach(d => {
          if (Array.isArray(d.items)) {
            d.items.forEach(it => {
              if (it.inventory_id) allInventoryIds.add(it.inventory_id)
              if (it.nomenclature_id) allNomenclatureIds.add(it.nomenclature_id)
            })
          }
        })
      }

      const invIdsArr = Array.from(allInventoryIds)
      const nomIdsArr = Array.from(allNomenclatureIds)

      let invItems = []
      if (invIdsArr.length > 0 || nomIdsArr.length > 0) {
        let invQuery = supabase.from('inventory').select('*')
        const filters = []
        if (invIdsArr.length > 0) filters.push(`id.in.(${invIdsArr.join(',')})`)
        if (nomIdsArr.length > 0) filters.push(`nomenclature_id.in.(${nomIdsArr.join(',')})`)
        const { data: invData } = await invQuery.or(filters.join(','))
        invItems = invData || []
      }

      const inventoryUpdatesMap = new Map()
      const getOrCreateUpdatedItem = (item) => {
        if (!inventoryUpdatesMap.has(item.id)) {
          inventoryUpdatesMap.set(item.id, { ...item })
        }
        return inventoryUpdatesMap.get(item.id)
      }

      // A. Revert Material Request Reserves and Used Stocks
      if (matRequests) {
        for (const req of matRequests) {
          const qty = getRequestQty(req)
          if (qty <= 0) continue

          if (req.status === 'issued') {
            const item = invItems.find(i => i.id === req.inventory_id)
            if (item) {
              const upd = getOrCreateUpdatedItem(item)
              upd.reserved_qty = Math.max(0, (Number(upd.reserved_qty) || 0) - qty)
            }
          } else if (req.status === 'completed') {
            const item = invItems.find(i => i.id === req.inventory_id)
            if (item) {
              const upd = getOrCreateUpdatedItem(item)
              upd.total_qty = (Number(upd.total_qty) || 0) + qty
            }
          }
        }
      }

      // B. Revert BZ Stock reservations / SGP finished transfers
      if (workCardsData) {
        for (const card of workCardsData) {
          const qty = Number(card.quantity) || 0
          if (qty <= 0) continue

          const isBZ = (card.card_info || '').includes('[ЗІ СКЛАДУ БЗ]')
          const isRework = (card.card_info || '').includes('[REWORK]') || card.is_rework

          if (isBZ) {
            const bzItem = invItems.find(i => String(i.nomenclature_id) === String(card.nomenclature_id) && i.type === 'bz')
            const sgpItem = invItems.find(i => String(i.nomenclature_id) === String(card.nomenclature_id) && i.type === 'finished')

            if (bzItem) {
              const upd = getOrCreateUpdatedItem(bzItem)
              upd.total_qty = (Number(upd.total_qty) || 0) + qty
            }
            if (sgpItem) {
              const upd = getOrCreateUpdatedItem(sgpItem)
              upd.total_qty = Math.max(0, (Number(upd.total_qty) || 0) - qty)
            }
          } else if (!isRework && (card.status === 'completed' || card.status === 'at-buffer')) {
            const isShop2 = (card.card_info || '').includes('[ЦЕХ №2]')
            const targetType = isShop2 ? 'wip_bz' : 'semi'
            
            const prodItem = invItems.find(i => String(i.nomenclature_id) === String(card.nomenclature_id) && i.type === targetType)
            if (prodItem) {
              const upd = getOrCreateUpdatedItem(prodItem)
              upd.total_qty = Math.max(0, (Number(upd.total_qty) || 0) - qty)
            }
          }
        }
      }

      // C. Cancel transfer reservations in reception_docs
      if (recDocs) {
        for (const doc of recDocs) {
          if ((doc.status === 'ordered' || doc.status === 'shipped') && doc.source_warehouse) {
            const items = Array.isArray(doc.items) ? doc.items : []
            for (const it of items) {
              const qty = Number(it.qty ?? it.quantity ?? it.needed ?? 0)
              if (qty <= 0) continue

              const nomId = it.nomenclature_id
              const item = invItems.find(i => 
                i.warehouse === doc.source_warehouse && 
                (
                  (nomId && String(i.nomenclature_id) === String(nomId)) || 
                  (it.inventory_id && String(i.id) === String(it.inventory_id))
                )
              )
              if (item) {
                const upd = getOrCreateUpdatedItem(item)
                upd.reserved_qty = Math.max(0, (Number(upd.reserved_qty) || 0) - qty)
              }
            }
          }
        }
      }

      // Save inventory updates
      const updates = Array.from(inventoryUpdatesMap.values())
      if (updates.length > 0) {
        const { error: invErr } = await supabase.from('inventory').upsert(updates)
        if (invErr) throw invErr
      }

      // Delete work card history and work cards
      let allWcQuery = supabase.from('work_cards').select('id')
      if (taskIds.length > 0) {
        allWcQuery = allWcQuery.or(`order_id.eq.${orderId},task_id.in.(${taskIds.join(',')})`)
      } else {
        allWcQuery = allWcQuery.eq('order_id', orderId)
      }
      const { data: allWcData } = await allWcQuery
      const cardIds = Array.from(new Set([
        ...(workCardsData ? workCardsData.map(c => c.id) : []),
        ...(allWcData ? allWcData.map(c => c.id) : [])
      ]))

      // Fetch linked cutter_restoration_batches
      let crbQuery = supabase.from('cutter_restoration_batches').select('id')
      if (cardIds.length > 0 && taskIds.length > 0) {
        crbQuery = crbQuery.or(`order_id.eq.${orderId},source_card_id.in.(${cardIds.join(',')}),task_id.in.(${taskIds.join(',')})`)
      } else if (cardIds.length > 0) {
        crbQuery = crbQuery.or(`order_id.eq.${orderId},source_card_id.in.(${cardIds.join(',')})`)
      } else if (taskIds.length > 0) {
        crbQuery = crbQuery.or(`order_id.eq.${orderId},task_id.in.(${taskIds.join(',')})`)
      } else {
        crbQuery = crbQuery.eq('order_id', orderId)
      }
      const { data: crbData } = await crbQuery
      const crbIds = crbData ? crbData.map(b => b.id) : []

      if (crbIds.length > 0) {
        await supabase.from('cutter_restoration_events').delete().in('batch_id', crbIds)
        await supabase.from('cutter_restoration_batches').delete().in('id', crbIds)
      }

      // Fetch linked vkya_restoration_cards
      let vrcQuery = supabase.from('vkya_restoration_cards').select('id')
      if (cardIds.length > 0 && taskIds.length > 0) {
        vrcQuery = vrcQuery.or(`source_order_id.eq.${orderId},source_card_id.in.(${cardIds.join(',')}),source_task_id.in.(${taskIds.join(',')}),route_card_id.in.(${cardIds.join(',')})`)
      } else if (cardIds.length > 0) {
        vrcQuery = vrcQuery.or(`source_order_id.eq.${orderId},source_card_id.in.(${cardIds.join(',')}),route_card_id.in.(${cardIds.join(',')})`)
      } else if (taskIds.length > 0) {
        vrcQuery = vrcQuery.or(`source_order_id.eq.${orderId},source_task_id.in.(${taskIds.join(',')})`)
      } else {
        vrcQuery = vrcQuery.eq('source_order_id', orderId)
      }
      const { data: vrcData } = await vrcQuery
      const vrcIds = vrcData ? vrcData.map(c => c.id) : []

      // Auto-release any allocated BZ reservations before deleting tasks/orders
      try {
        const { data: bzRes } = await supabase.from('bz_inventory_reservations')
          .select('operation_id')
          .eq('status', 'allocated')
          .or(`order_id.eq.${orderId}${taskIds.length ? `,task_id.in.(${taskIds.join(',')})` : ''}`)
        if (bzRes && bzRes.length > 0) {
          const opIds = [...new Set(bzRes.map(r => r.operation_id).filter(Boolean))]
          for (const opId of opIds) {
            await supabase.rpc('release_bz_reservation', { p_operation_id: opId, p_reason: 'Авто-звільнення при розширеному видаленні замовлення' }).catch(() => {})
          }
        }
      } catch (e) {
        console.warn('BZ auto-release warning on superDeleteOrder:', e)
      }

      // Phase 1: Deep leaf tables
      await Promise.allSettled([
        crbIds.length ? supabase.from('cutter_restoration_events').delete().in('batch_id', crbIds) : Promise.resolve(),
        vrcIds.length ? supabase.from('vkya_scrap_lot_allocations').delete().in('restoration_card_id', vrcIds) : Promise.resolve(),
        cardIds.length ? supabase.from('vkya_scrap_lot_allocations').delete().in('rework_card_id', cardIds) : Promise.resolve(),
        taskIds.length ? supabase.from('vkya_scrap_lot_allocations').delete().in('rework_task_id', taskIds) : Promise.resolve(),
        supabase.from('vkya_scrap_lot_allocations').delete().eq('rework_order_id', orderId),
        cardIds.length ? supabase.from('vkya_quality_resolutions').delete().in('source_card_id', cardIds) : Promise.resolve(),
        cardIds.length ? supabase.from('vkya_quality_resolutions').delete().in('route_card_id', cardIds) : Promise.resolve(),
        taskIds.length ? supabase.from('vkya_quality_resolutions').delete().in('task_id', taskIds) : Promise.resolve(),
        supabase.from('vkya_quality_resolutions').delete().eq('order_id', orderId)
      ])

      // Phase 2: Mid-level tables
      await Promise.allSettled([
        vrcIds.length ? supabase.from('vkya_restoration_cards').delete().in('id', vrcIds) : Promise.resolve(),
        crbIds.length ? supabase.from('cutter_restoration_batches').delete().in('id', crbIds) : Promise.resolve(),
        cardIds.length ? supabase.from('vkya_reclassification_queue').delete().in('source_card_id', cardIds) : Promise.resolve(),
        cardIds.length ? supabase.from('vkya_restoration_cards').delete().in('source_card_id', cardIds) : Promise.resolve(),
        cardIds.length ? supabase.from('vkya_restoration_cards').delete().in('route_card_id', cardIds) : Promise.resolve(),
        cardIds.length ? supabase.from('cutter_usage_events').delete().in('source_card_id', cardIds) : Promise.resolve(),
        cardIds.length ? supabase.from('work_card_scrap_totals').delete().in('card_id', cardIds) : Promise.resolve(),
        cardIds.length ? supabase.from('work_card_history').delete().in('card_id', cardIds) : Promise.resolve(),
        taskIds.length ? supabase.from('vkya_reclassification_queue').delete().in('source_task_id', taskIds) : Promise.resolve(),
        taskIds.length ? supabase.from('vkya_restoration_cards').delete().in('source_task_id', taskIds) : Promise.resolve(),
        taskIds.length ? supabase.from('cutter_restoration_batches').delete().in('task_id', taskIds) : Promise.resolve(),
        taskIds.length ? supabase.from('cutter_usage_events').delete().in('task_id', taskIds) : Promise.resolve(),
        taskIds.length ? supabase.from('material_requests').delete().in('task_id', taskIds) : Promise.resolve(),
        taskIds.length ? supabase.from('purchase_requests').delete().in('task_id', taskIds) : Promise.resolve(),
        taskIds.length ? supabase.from('reception_docs').delete().in('task_id', taskIds) : Promise.resolve(),
        taskIds.length ? supabase.from('work_card_scrap_totals').delete().in('task_id', taskIds) : Promise.resolve(),
        supabase.from('vkya_reclassification_queue').delete().eq('source_order_id', orderId),
        supabase.from('vkya_restoration_cards').delete().eq('source_order_id', orderId),
        supabase.from('cutter_restoration_batches').delete().eq('order_id', orderId),
        supabase.from('cutter_usage_events').delete().eq('order_id', orderId),
        supabase.from('material_requests').delete().eq('order_id', orderId),
        supabase.from('purchase_requests').delete().eq('order_id', orderId),
        supabase.from('reception_docs').delete().eq('order_id', orderId),
        supabase.from('work_card_scrap_totals').delete().eq('order_id', orderId)
      ])

      // Phase 3: Work Cards, Tasks & Order Items
      await Promise.allSettled([
        cardIds.length ? supabase.from('work_cards').delete().in('id', cardIds) : Promise.resolve(),
        taskIds.length ? supabase.from('tasks').delete().in('id', taskIds) : Promise.resolve(),
        supabase.from('work_cards').delete().eq('order_id', orderId),
        supabase.from('order_items').delete().eq('order_id', orderId)
      ])

      // Phase 4: Order row
      await supabase.from('orders').delete().eq('id', orderId)

      refreshTable('orders')
      refreshTable('inventory')
      refreshTable('work_cards')
      refreshTable('tasks')
      refreshTable('material_requests')
      refreshTable('purchase_requests')
      refreshTable('reception_docs')
    } catch (err) {
      console.error('Super Delete Order Error:', err)
      throw err
    }
  }


  const addOrder = async (header, items) => {
    if (header.customer) {
      const trimmedName = header.customer.trim()
      const { data: existing } = await supabase.from('customers').select('id').ilike('name', trimmedName).maybeSingle()
      if (!existing) await supabase.from('customers').insert([{ name: trimmedName, official_name: header.official_customer?.trim() || '' }])
    }

    let supaNomenclatureId = null;
    if (header.productName) {
      const { data: nomRow } = await supabase.from('nomenclatures').select('id').ilike('name', header.productName.trim()).maybeSingle();
      if (nomRow) {
        supaNomenclatureId = nomRow.id;
      } else {
        const normInput = normalizeName(header.productName);
        const match = (nomenclatures || []).find(n => normalizeName(n.name) === normInput);
        if (match) supaNomenclatureId = match.id;
      }
    }

    const orderedQty = items?.[0]?.quantity || header.quantity || 0;
    const { data, error } = await supabase.from('orders').insert([{
      order_num: header.orderNum,
      customer: header.customer,
      official_customer: header.official_customer,
      invoice_num: header.invoiceNum || header.invoice_num || null,
      deadline: header.deadline,
      status: 'pending',
      source: header.source || 'Виробництво',
      nomenclature_id: supaNomenclatureId,
      quantity: Number(orderedQty),
      accessories: header.productName || '',
    }]).select()
    if (error) throw error

    const newOrderId = data[0].id;
    if (supaNomenclatureId && items?.length > 0) {
      await supabase.from('order_items').insert(
        items.map(it => ({ order_id: newOrderId, nomenclature_id: supaNomenclatureId, quantity: Number(orderedQty) }))
      ).then(({ error: itemErr }) => {
        if (itemErr) console.warn('order_items insert skipped (non-critical):', itemErr.message);
      });
    }

    // Optimistic: add to orders state immediately, then refresh in background
    refreshTable('orders')
  }

  const createDovyпускMaterialRequests = async (taskId, orderId, partNom, sheets, quantity, selectedMachineName = null, cardId = null, requestMode = 'all', overrideSelectedCutters = null) => {
    // requestMode: 'all' (default) | 'sheets_only' | 'cutters_only'
    console.log('[DOVYPUSK_START]', { taskId, orderId, partNom, sheets, quantity, selectedMachineName, cardId, requestMode, hasOverrideCutters: !!overrideSelectedCutters })
    try {
      const order = orders.find(o => String(o.id) === String(orderId))

      const task = tasks.find(t => String(t.id) === String(taskId))
      const snapshot = task?.plan_snapshot?.[partNom?.id]

      let matKeyBase = (partNom?.material_type || partNom?.name || 'Інше').trim()
      if (snapshot) {
        const s300 = snapshot.sheets_t300 !== undefined ? Number(snapshot.sheets_t300) : 0
        const s700 = snapshot.sheets_t700 !== undefined ? Number(snapshot.sheets_t700) : 0
        if (s700 > 0 && s300 === 0) {
          const replaced = matKeyBase.replace(/т300/gi, 'Т700').replace(/t300/gi, 'Т700')
          matKeyBase = replaced === matKeyBase && /^лист\b/i.test(matKeyBase)
            ? matKeyBase.replace(/^лист\b/i, 'Лист Т700')
            : replaced
        } else if (s300 > 0 && s700 === 0) {
          const replaced = matKeyBase.replace(/т700/gi, 'Т300').replace(/t700/gi, 'Т300')
          matKeyBase = replaced === matKeyBase && /^лист\b/i.test(matKeyBase)
            ? matKeyBase.replace(/^лист\b/i, 'Лист Т300')
            : replaced
        }
      }
      const explicitRawNom = findExplicitRawMaterialNom(matKeyBase)
      const normalizedBase = normalizeName(stripMaterialTags(matKeyBase))

      // [Підготовлений] nom — ALWAYS used for main warehouse request
      const preparedNom = nomenclatures.find(n =>
        (n.type === 'raw' || n.type === 'material') &&
        n.name.toLowerCase().includes('підготовлений') &&
        !n.name.toLowerCase().includes('непідготовлений') &&
        normalizeName(stripMaterialTags(n.name)) === normalizedBase
      )

      // [Непідготовлений] nom — for prep order / СВ request only
      const unpreparedNom = nomenclatures.find(n =>
        (n.type === 'raw' || n.type === 'material') &&
        n.name.toLowerCase().includes('непідготовлений') &&
        normalizeName(stripMaterialTags(n.name)) === normalizedBase
      ) || nomenclatures.find(n =>
        (n.type === 'raw' || n.type === 'material') &&
        !n.name.toLowerCase().includes('підготовлений') &&
        normalizeName(n.name) === normalizedBase
      )

      const explicitPreparedNom = explicitRawNom &&
        String(explicitRawNom.name || '').toLowerCase().includes('підготовлений') &&
        !String(explicitRawNom.name || '').toLowerCase().includes('непідготовлений')
          ? explicitRawNom
          : null

      // Main warehouse request must point only to prepared sheets. Unprepared
      // material is requested separately through the preparation flow below.
      const finalPreparedNom = preparedNom || explicitPreparedNom

      const requestNomId = finalPreparedNom?.id || null
      const requestNomName = finalPreparedNom?.name ||
        (matKeyBase.toLowerCase().includes('підготовлений') && !matKeyBase.toLowerCase().includes('непідготовлений')
          ? matKeyBase
          : `${stripMaterialTags(matKeyBase)} [Підготовлений]`)

      const requestsToInsert = []

      if (sheets > 0 && requestMode !== 'cutters_only') {
        // Check СО stock of prepared sheets
        const preparedStock = requestNomId
          ? Math.max(0, inventory
            .filter(i => String(i.nomenclature_id) === String(requestNomId) && i.warehouse === 'operational')
            .reduce((sum, i) => sum + Math.max(0, (Number(i.total_qty) || 0) - (Number(i.reserved_qty) || 0)), 0))
          : 0

        const sheetsDeficit = Math.max(0, sheets - preparedStock)

        // Main warehouse request — always [Підготовлений]
        const invItem = requestNomId
          ? (inventory.find(i => String(i.nomenclature_id) === String(requestNomId) && i.warehouse === 'operational')
            || inventory.find(i => String(i.nomenclature_id) === String(requestNomId)))
          : null

        requestsToInsert.push({
          order_id: orderId,
          task_id: taskId,
          card_id: cardId,
          quantity: sheets,
          status: 'pending',
          inventory_id: invItem?.id || null,
          nomenclature_id: requestNomId,
          details: `ДОЗАПИТ (БРАК/НЕСТАЧА) для ${order?.order_num || '???'}: ${requestNomName} — ${sheets} л.`
        })

        // If СО doesn't have enough — create prep naiad + СВ request for deficit
        if (sheetsDeficit > 0) {
          const prepForNomId = unpreparedNom?.id || requestNomId
          const prepForNomName = unpreparedNom?.name
            || (requestNomName.includes('[Підготовлений]')
              ? requestNomName.replace('[Підготовлений]', '[Непідготовлений]')
              : requestNomName + ' [Непідготовлений]')

          try {
            const planSnapshot = {}
            planSnapshot[prepForNomId] = {
              name: prepForNomName,
              need: sheetsDeficit,
              stock: 0,
              plan: sheetsDeficit
            }

            const { count } = await supabase
              .from('tasks')
              .select('*', { count: 'exact', head: true })
              .eq('step', 'Підготовка')

            const nextNum = (count || 0) + 1
            const prepNum = `НП${String(nextNum).padStart(6, '0')}`
            planSnapshot._prep_num = prepNum

            const { data: newTask, error: errTask } = await supabase.from('tasks').insert({
              step: 'Підготовка',
              status: 'new',
              machine_name: 'PREP-TERM',
              planned_sets: sheetsDeficit,
              planned_deadline: order?.deadline || null,
              plan_snapshot: planSnapshot,
              engineer_conf: true,
              director_conf: true
            }).select().single()

            if (!errTask && newTask) {
              const svInvItem = prepForNomId
                ? inventory.find(i => String(i.nomenclature_id) === String(prepForNomId))
                : null
              await supabase.from('material_requests').insert({
                task_id: newTask.id,
                order_id: orderId,
                nomenclature_id: prepForNomId,
                quantity: sheetsDeficit,
                status: 'pending',
                inventory_id: svInvItem?.id || null,
                details: `ЗАПИТ НА ПІДГОТОВКУ (${prepNum}): ${prepForNomName} — ${sheetsDeficit} л. (для наряду ${order?.order_num || '???'})`
              })
            }
          } catch (e) {
            console.error('Error auto-creating prep order for dovypusk:', e)
          }
        }
      } // end sheets block

      // Consumables (фрези etc.)
      if (sheets > 0 && requestMode !== 'sheets_only') {
        const task = tasks.find(t => String(t.id) === String(taskId))
        const allOpsForPart = (machineOperations || []).filter(o => String(o.nomenclature_id) === String(partNom?.id))

        let opData = null
        if (selectedMachineName) {
          opData = allOpsForPart.find(o =>
            isMachineMatch(o.machine_type, selectedMachineName) ||
            isMachineMatch(o.machine_id, selectedMachineName)
          )
        }
        if (!opData && allOpsForPart.length > 0) {
          opData = allOpsForPart[0]
        }
        
        const machineSpecificCutters = {}
        
        if (opData && opData.side2_cut_ops) {
          const cutterOps = opData.side2_cut_ops.filter(op => op.startsWith('__CUTTER__Reference:') || op.startsWith('__CUTTER__:'))
          cutterOps.forEach(op => {
            const parts = op.split(':')
            const cutterNomId = parts[1]
            const qtyPerSheet = parseFloat(parts[2]) || 0
            if (cutterNomId && qtyPerSheet > 0) {
              const totalQty = Math.ceil(sheets * qtyPerSheet)
              const cutterNom = nomenclatures.find(n => String(n.id) === String(cutterNomId))
              if (cutterNom && cutterNom.name.trim().toLowerCase() !== 'фреза') {
                const cleanName = cutterNom.name.trim()
                
                let resolvedCutterNom = cutterNom
                const partSelectedCutters = overrideSelectedCutters
                  || task?.plan_snapshot?.[String(partNom?.id)]?.selected_cutters
                  || task?.plan_snapshot?.selectedCutters
                if (partSelectedCutters && typeof partSelectedCutters === 'object') {
                  const selectedVal = partSelectedCutters[cleanName]
                    || partSelectedCutters[cleanName.toLowerCase()]
                    || partSelectedCutters[String(cutterNomId)]
                    || partSelectedCutters[String(cutterNom?.id)]
                  if (selectedVal) {
                    const invItem = (inventory || []).find(i => String(i.id) === String(selectedVal))
                    const specNom = invItem
                      ? nomenclatures.find(n => String(n.id) === String(invItem.nomenclature_id))
                      : nomenclatures.find(n => String(n.id) === String(selectedVal))
                    if (specNom) resolvedCutterNom = specNom
                  }

                  // If still cutter_type, try matching by characteristic in partSelectedCutters
                  if (resolvedCutterNom.type === 'cutter_type') {
                    for (const [k, v] of Object.entries(partSelectedCutters)) {
                      const candidate = nomenclatures.find(n =>
                        (String(n.id) === String(v) || String(n.id) === String(k) || n.name.trim().toLowerCase() === String(k).trim().toLowerCase()) &&
                        n.type === 'consumable' &&
                        String(n.characteristic) === String(cutterNom.id)
                      )
                      if (candidate) {
                        resolvedCutterNom = candidate
                        break
                      }
                    }
                  }
                }

                // If still cutter_type, resolve by characteristic in nomenclatures
                if (resolvedCutterNom.type === 'cutter_type') {
                  const matchingConsumables = (nomenclatures || []).filter(n =>
                    n.type === 'consumable' && String(n.characteristic) === String(cutterNom.id)
                  )
                  if (matchingConsumables.length > 0) {
                    const sorted = [...matchingConsumables].sort((a, b) => {
                      const invA = (inventory || []).find(i => String(i.nomenclature_id) === String(a.id) && (i.warehouse === 'operational' || !i.warehouse))
                      const invB = (inventory || []).find(i => String(i.nomenclature_id) === String(b.id) && (i.warehouse === 'operational' || !i.warehouse))
                      return (Number(invB?.total_qty) || 0) - (Number(invA?.total_qty) || 0)
                    })
                    resolvedCutterNom = sorted[0]
                  }
                }

                // Fallback by diameter matching if still cutter_type
                if (resolvedCutterNom.type === 'cutter_type') {
                  const diaMatch = cleanName.match(/ф\s*([\d.,]+)/i)
                  if (diaMatch) {
                    const diaClean = diaMatch[1].replace(',', '.')
                    const byDia = (nomenclatures || []).filter(n => {
                      if (n.type !== 'consumable') return false
                      const nName = n.name.toLowerCase()
                      return nName.includes('фреза') && (nName.includes(`${diaClean}х`) || nName.includes(`${diaClean}x`))
                    })
                    if (byDia.length > 0) {
                      resolvedCutterNom = byDia[0]
                    }
                  }
                }

                // Strictly refuse to add cutter_type to material_requests
                if (resolvedCutterNom.type === 'cutter_type') {
                  console.warn('[DOVYPUSK] Cannot resolve cutter_type to consumable:', resolvedCutterNom)
                  return
                }

                const resolvedName = resolvedCutterNom.name.trim()
                const key = resolvedCutterNom.id.toString()
                if (!machineSpecificCutters[key]) {
                  machineSpecificCutters[key] = {
                    name: resolvedName,
                    qty: 0,
                    nomenclature_id: resolvedCutterNom.id
                  }
                }
                machineSpecificCutters[key].qty += totalQty
              }
            }
          })
        }

        // If no cutters found in machineOperations, look at plan_snapshot / overrideSelectedCutters
        if (Object.keys(machineSpecificCutters).length === 0 && (task?.plan_snapshot || overrideSelectedCutters)) {
          const activeSelectedCutters = overrideSelectedCutters || task?.plan_snapshot?.selectedCutters || task?.plan_snapshot?.[String(partNom?.id)]?.selected_cutters
          if (activeSelectedCutters && typeof activeSelectedCutters === 'object') {
            Object.values(activeSelectedCutters).forEach(selectedVal => {
              if (selectedVal) {
                const invItem = (inventory || []).find(i => String(i.id) === String(selectedVal))
                const nom = invItem
                  ? nomenclatures?.find(n => String(n.id) === String(invItem.nomenclature_id))
                  : nomenclatures?.find(n => String(n.id) === String(selectedVal))
                if (nom && nom.type === 'cutter_type') return // never accept cutter_type
                const name = nom ? nom.name : invItem?.name
                if (name && name.toLowerCase().includes('фреза') && name.toLowerCase() !== 'фреза') {
                  const cleanName = name.trim()
                  const key = (nom ? nom.id : cleanName).toString()
                  const qtyPerSheet = 1 // default fallback
                  const totalQty = Math.ceil(sheets * qtyPerSheet)
                  if (!machineSpecificCutters[key]) {
                    machineSpecificCutters[key] = {
                      name: cleanName,
                      qty: totalQty,
                      nomenclature_id: nom ? nom.id : invItem?.nomenclature_id
                    }
                  }
                }
              }
            })
          }
          
          if (Array.isArray(task?.plan_snapshot?.consumables)) {
            task.plan_snapshot.consumables.forEach(c => {
              if (c.name && c.name.toLowerCase().includes('фреза') && c.name.toLowerCase() !== 'фреза') {
                const cleanName = c.name.trim()
                const key = cleanName.toLowerCase()
                if (!machineSpecificCutters[key]) {
                  const consNom = nomenclatures.find(n => n.name.trim().toLowerCase() === key)
                  if (consNom && consNom.type !== 'cutter_type') {
                    const qtyPerSheet = Number(consNom.consumption_per_sheet) || 1
                    machineSpecificCutters[key] = {
                      name: cleanName,
                      qty: Math.ceil(sheets * qtyPerSheet),
                      nomenclature_id: consNom.id
                    }
                  }
                }
              }
            })
          }
        }

        Object.values(machineSpecificCutters).forEach(item => {
          const finalNom = nomenclatures.find(n => String(n.id) === String(item.nomenclature_id))
          if (finalNom && finalNom.type === 'cutter_type') {
            console.warn('[DOVYPUSK] Refusing to insert cutter_type item:', item)
            return
          }
          const consInvItem = inventory.find(i => String(i.nomenclature_id) === String(item.nomenclature_id) && (i.warehouse === 'operational' || !i.warehouse))
            || inventory.find(i => String(i.nomenclature_id) === String(item.nomenclature_id))
          requestsToInsert.push({
            order_id: orderId,
            task_id: taskId,
            card_id: null, // cutters are batch-level, not per-card
            quantity: item.qty,
            status: 'pending',
            inventory_id: consInvItem?.id || null,
            nomenclature_id: item.nomenclature_id,
            details: `ВИТРАТНІ МАТЕРІАЛИ ДЛЯ ДОВИПУСКУ ${order?.order_num || '???'}: ${item.name} — ${item.qty} од. (для ${partNom?.name || '???'})`
          })
        })
      } // end cutters block

      if (requestsToInsert.length > 0) {
        const { error: insertErr } = await supabase.from('material_requests').insert(requestsToInsert)
        if (insertErr) {
          console.error('[DOVYPUSK_INSERT_ERR]', insertErr)
          throw insertErr
        }
        if (typeof refreshTable === 'function') refreshTable('material_requests')
        if (typeof fetchData === 'function') fetchData(['material_requests'])
      }
    } catch (err) {
      console.error('Error creating dovypusk material requests:', err)
    }
  }

  const getOrderProductionProgress = (orderId) => {
    const order = orders.find(o => String(o.id) === String(orderId))
    if (!order) return { total: 0, planned: 0, produced: 0, packaged: 0, status: 'unknown' }
    const totalQty = order.order_items?.reduce((acc, it) => acc + (Number(it.quantity) || 0), 0) || 0
    const orderTasks = tasks.filter(t => String(t.order_id) === String(orderId))
    const batches = {}
    orderTasks.forEach(t => {
      const key = t.batch_index || 'default'
      const qty = Number(t.planned_sets) || 0
      const isPackaged = t.plan_snapshot?._metadata?.is_packaged === true
      const isProduced = t.status === 'completed' || t.step.includes('ЦЕХ №2') || t.step.includes('Паквання')
      const step = t.step || ''
      if (!batches[key]) batches[key] = { qty, isPackaged, isProduced, step, status: t.status }
      else {
        if (qty > batches[key].qty) batches[key].qty = qty
        if (isPackaged) batches[key].isPackaged = true
        if (isProduced) batches[key].isProduced = true
        if (t.status !== 'completed') batches[key].step = t.step
        if (t.status !== 'completed') batches[key].status = t.status
      }
    })
    const planned = Object.values(batches).reduce((acc, b) => acc + b.qty, 0)
    const packaged = Object.values(batches).filter(b => b.isPackaged).reduce((acc, b) => acc + b.qty, 0)
    const produced = Object.values(batches).filter(b => b.isProduced).reduce((acc, b) => acc + b.qty, 0)
    
    let status = order.status
    if (order.status === 'shipped' || order.status === 'completed') {
      status = 'shipped'
    } else if (packaged >= totalQty && totalQty > 0) {
      status = 'packaged' // Очікує відвантаження
    } else if (orderTasks.length > 0) {
      // Визначаємо за кроками активних нарядів
      const activeBatches = Object.values(batches)
      const hasUnpackaged = activeBatches.some(b => !b.isPackaged)
      
      if (hasUnpackaged) {
        // Якщо є наряди, які ще не запаковані
        const steps = activeBatches.map(b => b.step)
        
        // Перевіряємо чи вони на пакуванні
        const allProduced = activeBatches.every(b => b.isProduced)
        if (allProduced) {
          status = 'packaging' // На пакуванні
        } else {
          // Дивимося де саме в цехах
          const hasShop2 = steps.some(s => s.includes('ЦЕХ №2') || s.includes('Пресування') || s.includes('Фарбув'))
          if (hasShop2) {
            status = 'shop2' // Цех 2
          } else {
            status = 'shop1' // Цех 1
          }
        }
      } else {
        status = 'packaging'
      }
    }
    
    return { total: totalQty, planned, produced, packaged, isFullyPackaged: packaged >= totalQty && totalQty > 0, isFullyPlanned: planned >= totalQty && totalQty > 0, status }
  }


  return {
    addOrder,
    updateOrder,
    deleteOrder,
    superDeleteOrder,
    getOrderProductionProgress,
    createDovyпускMaterialRequests
  }
}
