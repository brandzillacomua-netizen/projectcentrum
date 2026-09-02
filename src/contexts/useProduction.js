import { supabase } from '../supabase'
import { isMachineMatch } from '../utils/cutterCalculator'
import { sendPushToUsers } from '../services/pushService'
const getRequestQty = (r) => {
  if (r.quantity !== null && r.quantity !== undefined) return Number(r.quantity);
  const match = (r.details || '').match(/—\s*(\d+)/);
  return match ? Number(match[1]) : 0;
};


const normalizeName = (s) => {
  if (!s) return '';
  const mapper = {
    'а': 'a', 'в': 'b', 'с': 'c', 'е': 'e', 'н': 'h', 'h': 'h',
    'к': 'k', 'м': 'm', 'о': 'o', 'р': 'p', 'т': 't', 'х': 'x',
    'у': 'y', 'і': 'i', 'ї': 'i', 'и': 'y', 'п': 'p'
  };
  return s.toLowerCase()
    .trim()
    .split('')
    .map(c => mapper[c] || c)
    .join('')
    .replace(/[^a-z0-9]/g, '');
};

export function createProductionActions({
  orders, tasks, inventory, nomenclatures, bomItems, workCards,
  machineOperations, machines, systemUsers, currentUser,
  setTasks, setWorkCards, setWorkCardHistory, setManagementTasks, setMachines,
  normalize, refreshTable, fetchData,
  deductIssuedMaterialsForTask,
  maintenanceCheckEnabled
}) {

  const stripMaterialTags = (s) => (s || '').toLowerCase()
    .replace(/\[\s*підготовлений\s*\]/gi, '')
    .replace(/\[\s*непідготовлений\s*\]/gi, '')
    .trim()

  const isRawMaterialNom = (n) => n && (n.type === 'raw' || n.type === 'material')

  const findExplicitRawMaterialNom = (materialLabel) => {
    const rawLabel = String(materialLabel || '').trim()
    if (!rawLabel) return null

    const lowerLabel = rawLabel.toLowerCase()
    const normalizedLabel = normalizeName(stripMaterialTags(rawLabel))

    return nomenclatures.find(n => {
      if (!isRawMaterialNom(n)) return false
      const name = String(n.name || '').trim()
      const materialType = String(n.material_type || '').trim()
      if (name.toLowerCase() === lowerLabel) return true
      if (materialType && materialType.toLowerCase() === lowerLabel) return true
      if (normalizeName(stripMaterialTags(name)) === normalizedLabel) return true
      if (materialType && normalizeName(stripMaterialTags(materialType)) === normalizedLabel) return true
      return normalizeName(stripMaterialTags(`${name} ${materialType}`)) === normalizedLabel
    }) || null
  }

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

  const upsertNomenclature = async (nom) => { await supabase.from('nomenclatures').upsert([nom]); refreshTable('nomenclatures') }
  const deleteNomenclature = async (id) => {
    try {
      await supabase.from('machine_operations').delete().eq('nomenclature_id', id)
      await supabase.from('bom_items').delete().eq('parent_id', id)
      await supabase.from('bom_items').delete().eq('child_id', id)
      await supabase.from('inventory').delete().eq('nomenclature_id', id)
      await supabase.from('order_items').delete().eq('nomenclature_id', id)
      await supabase.from('material_requests').delete().eq('nomenclature_id', id)
      await supabase.from('replenishment_requests').delete().eq('nomenclature_id', id)
      await supabase.from('nomenclature_catalog_profiles').delete().eq('nomenclature_id', id)
      const { error } = await supabase.from('nomenclatures').delete().eq('id', id)
      if (error) throw error
    } catch (err) {
      console.error("Failed to delete nomenclature cascades:", err)
      alert("Не вдалося видалити номенклатуру: " + err.message)
    }
    refreshTable('nomenclatures')
  }

  const saveBOM = async (parentId, childId, qty) => {
    await supabase.from('bom_items').upsert([{ parent_id: parentId, child_id: childId, quantity_per_parent: Number(qty) }], { onConflict: 'parent_id, child_id' })
    refreshTable('bom_items')
  }
  const removeBOM = async (bomId) => { await supabase.from('bom_items').delete().eq('id', bomId); refreshTable('bom_items') }
  const syncBOM = async (parentId, items) => {
    await supabase.from('bom_items').delete().eq('parent_id', parentId)
    if (items.length > 0) await supabase.from('bom_items').insert(items.map(it => ({ parent_id: parentId, child_id: it.child_id, quantity_per_parent: Number(it.qty) })))
    refreshTable('bom_items')
  }

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
                if (partSelectedCutters) {
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
                  if (consNom) {
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
          const consInvItem = inventory.find(i => String(i.nomenclature_id) === String(item.nomenclature_id) && i.warehouse === 'operational')
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
  const createWorkCard = async (taskId, orderId, nomenclatureId, operation, machine, estimatedTime, cardInfo, quantity, bufferQty, isRework = false) => {
    if (isRework && (Number(quantity) || 0) <= 0) {
      throw new Error('Довипуск з нульовою кількістю заблоковано.')
    }

    const status = isRework ? 'waiting-materials' : 'new'
    const baseCardInfo = String(cardInfo || '')
    const cardInfoText = `${baseCardInfo}${Number(bufferQty) > 0 && !baseCardInfo.includes('[BZ:') ? ` [BZ:${bufferQty}]` : ''}${isRework && !baseCardInfo.includes('[REDO]') ? ' [REDO]' : ''}`
    const { data: list, error } = await supabase.from('work_cards').insert([{
      task_id: taskId, order_id: orderId, nomenclature_id: nomenclatureId,
      operation: operation || 'Нова', machine, quantity: Number(quantity) || 0,
      estimated_time: Math.round(Number(estimatedTime) || 0), status, is_rework: isRework,
      card_info: cardInfoText
    }]).select()
    if (error) {
      console.error('Error inserting work_card:', error)
      throw new Error(error.message || 'Помилка при створенні картки')
    }
    const data = (list && list.length > 0) ? list[0] : null
    await supabase.from('tasks').update({ status: 'in-progress' }).eq('id', taskId)

    if (isRework) {
      const partNom = nomenclatures.find(n => n.id === nomenclatureId)
      const unitsPerSheet = partNom?.units_per_sheet || 1
      const sheets = Math.ceil(Number(quantity) / unitsPerSheet)
      await createDovyпускMaterialRequests(taskId, orderId, partNom, sheets, Number(quantity), machine, data?.id || null)
    }

    // Only refresh affected tables (work_cards + tasks), not everything
    refreshTable('work_cards')
    refreshTable('tasks')
    return data
  }

  const createWorkCardsBatch = async (taskId, orderId, nomenclatureId, cardsArray) => {
    const invalidReworkCards = (cardsArray || []).filter(c => c.is_rework && (Number(c.quantity) || 0) <= 0)
    if (invalidReworkCards.length > 0) {
      throw new Error('Довипуск з нульовими картками заблоковано.')
    }
    const isReworkBatch = (cardsArray || []).some(c => c.is_rework || String(c.cardInfo || '').includes('[REDO]'))
    // A regular production batch must keep the task-level material request
    // consolidated. Splitting it by every generated work card creates dozens
    // (sometimes hundreds) of duplicate-looking warehouse request tiles.
    // Card-scoped requests are created explicitly by the reissue / machine
    // change flows and must not be inferred from ordinary cards.
    const shouldSplitMaterialRequestsByCard = (cardsArray || []).some(c => c.splitMaterialRequests === true)

    const payloads = cardsArray.map(c => {
      const baseCardInfo = String(c.cardInfo || '')
      return {
        task_id: taskId,
        order_id: orderId,
        nomenclature_id: nomenclatureId,
        operation: c.operation || 'Нова',
        machine: c.machine,
        quantity: Number(c.quantity) || 0,
        estimated_time: Math.round(Number(c.estimatedTime) || 0),
        status: c.status || 'new',
        is_rework: c.is_rework || false,
        card_info: `${baseCardInfo}${Number(c.bufferQty) > 0 && !baseCardInfo.includes('[BZ:') ? ` [BZ:${c.bufferQty}]` : ''}`
      }
    })

    const { data, error } = await supabase.from('work_cards').insert(payloads).select()
    if (error) {
      console.error('Error inserting work_cards batch:', error)
      throw new Error(error.message || 'Помилка при створенні карток')
    }
    
    // Proportional splitting of material_requests for this task
    if (data && data.length > 0) {
      setWorkCards(prev => [...prev, ...data])

      if (isReworkBatch) {
        const { error: taskStatusError } = await supabase
          .from('tasks')
          .update({ status: 'in-progress' })
          .eq('id', taskId)
        if (taskStatusError) console.warn('Failed to update task status:', taskStatusError.message)
        setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'in-progress' } : t))
        await Promise.all([
          refreshTable('work_cards'),
          refreshTable('material_requests'),
          refreshTable('tasks')
        ])
        return data
      }
      
      if (shouldSplitMaterialRequestsByCard) try {
        // Fetch general material requests for this task that are not yet assigned to any card
        const { data: allTaskRequests } = await supabase
          .from('material_requests')
          .select('*')
          .eq('task_id', taskId)

        const generalRequests = (allTaskRequests || []).filter(req => !req.card_id)
        const assignedRequests = (allTaskRequests || []).filter(req => req.card_id)

        if (generalRequests && generalRequests.length > 0) {
          const task = (tasks || []).find(t => t.id === taskId)
          const snapshot = task?.plan_snapshot || {}
          const partSnapshot = snapshot[nomenclatureId] || {}
          const partNom = nomenclatures.find(n => n.id === nomenclatureId)
          const unitsPerSheet = Number(partSnapshot.units_per_sheet) || Number(partNom?.units_per_sheet) || 1
          const materialName = partSnapshot.material

          // Calculate total planned sheets for the whole task
          let totalTaskSheets = 0
          Object.entries(snapshot).forEach(([key, val]) => {
            if (val && typeof val === 'object' && val.sheets) {
              totalTaskSheets += Number(val.sheets) || 0
            }
          })
          if (totalTaskSheets <= 0) totalTaskSheets = 1

          const normalize = (s) => (s || '').toLowerCase().trim()
            .replace(/[тt]/g, 't').replace(/[аa]/g, 'a').replace(/[еe]/g, 'e')
            .replace(/[оo]/g, 'o').replace(/[рp]/g, 'p').replace(/[сc]/g, 'c')
            .replace(/[хx]/g, 'x')
            .replace(/[іi]/g, 'i')
            .replace(/[уy]/g, 'y')
            .replace(/[кk]/g, 'k')
            .replace(/[мm]/g, 'm')
            .replace(/[нn]/g, 'n')
            .replace(/[вv]/g, 'v')
            .replace(/[и]/g, 'y')
            .replace(/[зz]/g, 'z')
            .replace(/\s/g, '')

          const newRequests = []
          const updates = []
          const deletes = []

          for (const req of generalRequests) {
            const normDetails = normalize(req.details || '')
            const normMat = materialName ? normalize(materialName) : ''

            let isSheetForThisCard = false
            let isSheetForOtherParts = false
            let isGeneralConsumable = false

            if (normMat && normDetails.includes(normMat)) {
              isSheetForThisCard = true
            } else if (normDetails.includes('лyct')) {
              isSheetForOtherParts = true
            } else {
              isGeneralConsumable = true
            }

            if (isSheetForOtherParts) {
              continue
            }

            let totalDeduction = 0
            const existingAssignedForNom = assignedRequests.filter(existing =>
              String(existing.nomenclature_id) === String(req.nomenclature_id)
            )
            const existingLabels = new Set(existingAssignedForNom.map(existing => {
              const match = (existing.details || '').match(/\(Картка\s+([^\)]+)\)/i)
              return match?.[1]?.trim() || ''
            }).filter(Boolean))
            const existingAssignedQty = existingAssignedForNom.reduce((sum, existing) => sum + (Number(existing.quantity) || 0), 0)
            const declaredQtyMatch = (req.details || '').match(/—\s*(\d+(?:[.,]\d+)?)/)
            const declaredQty = declaredQtyMatch ? Number(declaredQtyMatch[1].replace(',', '.')) : getRequestQty(req)
            let remainingSheetBudget = Math.max(0, Math.max(getRequestQty(req), declaredQty) - existingAssignedQty)

            data.forEach((card, idx) => {
              const cardSheets = Math.ceil((Number(card.quantity) || 0) / unitsPerSheet)
              let cardQty = 0
              const cardLabel = (card.card_info || '').split(' ')[0] || `№${idx + 1}`

              if (isSheetForThisCard) {
                // A regenerated work-card batch can contain logical card labels
                // that were already issued earlier. Never create a second
                // material request for the same nomenclature + card label.
                if (existingLabels.has(cardLabel)) return
                cardQty = Math.min(cardSheets, remainingSheetBudget)
                remainingSheetBudget -= cardQty
              } else if (isGeneralConsumable) {
                let originalCutterQty = getRequestQty(req)
                const consumablesList = snapshot.consumables || []
                const foundCons = consumablesList.find(c => {
                  const nameLower = (c.name || '').toLowerCase()
                  return normDetails.includes(normalize(nameLower))
                })
                if (foundCons) {
                  originalCutterQty = Number(foundCons.total) || getRequestQty(req)
                }
                cardQty = Math.round(originalCutterQty * (cardSheets / totalTaskSheets))
              }

              if (cardQty > 0) {
                totalDeduction += cardQty
                const updatedDetails = req.details 
                  ? req.details.replace('СКЛАД ОПЕРАТИВНИЙ:', `СКЛАД ОПЕРАТИВНИЙ (Картка ${cardLabel}):`)
                               .replace('ВИТРАТНІ МАТЕРІАЛИ ДЛЯ', `ВИТРАТНІ МАТЕРІАЛИ (Картка ${cardLabel}) ДЛЯ`)
                               .replace('СКЛАД ОПЕРАТИВНИЙ (ОБРАНО ВРУЧНУ):', `СКЛАД ОПЕРАТИВНИЙ (Картка ${cardLabel}) (ОБРАНО ВРУЧНУ):`)
                  : `Матеріали для картки ${cardLabel}`

                newRequests.push({
                  order_id: req.order_id,
                  task_id: req.task_id,
                  nomenclature_id: req.nomenclature_id,
                  quantity: cardQty,
                  status: req.status,
                  inventory_id: req.inventory_id,
                  details: updatedDetails,
                  card_id: card.id
                })
              }
            })

            const nextReqQty = isSheetForThisCard
              ? remainingSheetBudget
              : Math.max(0, getRequestQty(req) - totalDeduction)
            if (nextReqQty <= 0) {
              deletes.push(req.id)
            } else {
              updates.push({ id: req.id, quantity: nextReqQty })
            }
          }

          if (newRequests.length > 0) {
            const { error: insertError } = await supabase.from('material_requests').insert(newRequests)
            if (insertError) throw insertError
          }
          if (updates.length > 0) {
            for (const upd of updates) {
              const { error: updateError } = await supabase.from('material_requests').update({ quantity: upd.quantity }).eq('id', upd.id)
              if (updateError) throw updateError
            }
          }
          if (deletes.length > 0) {
            const { error: deleteError } = await supabase.from('material_requests').delete().in('id', deletes)
            if (deleteError) throw deleteError
          }
        }
      } catch (err) {
        console.error('Error splitting material requests for cards:', err)
      }
    }

    const { error: taskStatusError } = await supabase
      .from('tasks')
      .update({ status: 'in-progress' })
      .eq('id', taskId)
    if (taskStatusError) console.warn('Failed to update task status:', taskStatusError.message)
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'in-progress' } : t))

    await Promise.all([
      refreshTable('work_cards'),
      refreshTable('material_requests'),
      refreshTable('tasks')
    ])

    return data
  }

  const startWorkCard = (taskId, cardId, operatorName, metadata = {}) => {
    const updateData = { status: 'in-progress', started_at: new Date().toISOString(), operator_name: operatorName }
    if (metadata.stage_name) updateData.operation = metadata.stage_name
    if (metadata.machine_id) updateData.machine_id = metadata.machine_id
    if (metadata.machine_name) updateData.machine = metadata.machine_name
    if (metadata.manager_name) updateData.manager_name = metadata.manager_name
    if (metadata.shift_name) updateData.shift_name = metadata.shift_name
    // Optimistic update — instant, no await
    setWorkCards(prev => prev.map(c => c.id === cardId ? { ...c, ...updateData } : c))
    // Fire DB write in background — does NOT block UI
    supabase.from('work_cards').update(updateData).eq('id', cardId).then(({ error }) => {
      if (error) { console.error('Error starting card:', error); refreshTable('work_cards') }
    })
  }

  const completeWorkCard = (taskId, cardId, operatorName) => {
    const updateData = { status: 'waiting-buffer', operator_name: operatorName, completed_at: new Date().toISOString() }
    // Optimistic update — instant
    setWorkCards(prev => prev.map(c => c.id === cardId ? { ...c, ...updateData } : c))
    // Fire DB write in background
    supabase.from('work_cards').update(updateData).eq('id', cardId).then(({ error }) => {
      if (error) { console.error('Error completing card:', error); refreshTable('work_cards') }
    })
  }

  const CHAIN_SHOP1 = ['Розкрій', 'Галтовка (Вібростіл)', 'Галтовка (Мийка)', 'Галтовка (Галтовка)', 'Галтовка (Сушка)', 'Прийомка']
  const CHAIN_GENERAL = ['Розкрій', 'Галтовка', 'Пресування', 'Фарбування', 'Паквання']

  const confirmBuffer = async (cardId, scrapData = {}, cuttersUsed = 0, cuttersBreakdown = null) => {
    const card = workCards.find(c => c.id === cardId)
    if (!card) throw new Error('Робочу картку не знайдено. Оновіть термінал і повторіть спробу.')
    const totalScrap = typeof scrapData === 'number' ? scrapData : Object.values(scrapData).reduce((acc, c) => acc + Number(c), 0)
    if (!Number.isFinite(totalScrap) || totalScrap < 0) {
      throw new Error('Вказано некоректну кількість браку.')
    }
    if (totalScrap > Number(card.quantity || 0)) {
      throw new Error(`Кількість браку (${totalScrap}) перевищує кількість у картці (${card.quantity || 0}).`)
    }
    const qtyCompleted = Math.max(0, (card.quantity || 0) - totalScrap)
    const isRework = (card.card_info || '').includes('[REWORK]')
    const currentOp = (card.operation || '').trim()
    const isShop1 = (card.card_info || '').includes('[SHOP:1]')
    const isShop2 = (card.card_info || '').includes('[ЦЕХ №2]')
    const chain = isShop1 ? CHAIN_SHOP1 : CHAIN_GENERAL
    const idx = chain.findIndex(s => s.toLowerCase() === currentOp.toLowerCase())
    const nextStage = idx >= 0 && idx < chain.length - 1 ? chain[idx + 1] : null
    let cardUpdate = {}
    if (isRework || (card.card_info || '').includes('[ADMIN_MANUAL]')) cardUpdate = { status: 'completed', quantity: qtyCompleted }
    else if (isShop2) cardUpdate = { status: 'at-buffer', quantity: qtyCompleted }
    else cardUpdate = nextStage
      ? { status: 'new', operation: nextStage, quantity: qtyCompleted, started_at: null, operator_name: null, machine: null, machine_id: null }
      : { status: 'completed', quantity: qtyCompleted, machine: null, machine_id: null }

    const machineTag = `[MACHINE_ID:${card.machine_id || ''}] [MACHINE_NAME:${card.machine || ''}]`
    let breakdownStr = ''
    if (cuttersBreakdown && Object.keys(cuttersBreakdown).length > 0) {
      breakdownStr = ` [CUTTERS_BREAKDOWN:${JSON.stringify(cuttersBreakdown)}]`
    }
    const historyCardInfo = (machineTag + ' ' + (card.card_info || '') + breakdownStr).trim()

    const writePromises = [
      supabase.from('work_card_history').insert([{
        card_id: cardId, nomenclature_id: card.nomenclature_id, stage_name: card.operation || 'Розкрій',
        operator_name: card.operator_name || 'Не вказано', card_info: historyCardInfo,
        qty_at_start: card.quantity, qty_completed: qtyCompleted, scrap_qty: totalScrap,
        cutters_used: Number(cuttersUsed) || 0, started_at: card.started_at, completed_at: new Date().toISOString(),
        // Брак з будь-якого виробничого етапу одразу потрапляє в чергу ВКЯ.
        is_archived_scrap: totalScrap > 0,
        shift_name: card.shift_name || null,
        manager_name: card.manager_name || null,
        machine_name: card.machine || null
      }]),
      supabase.from('work_cards').update({ ...cardUpdate, cutters_used: Number(cuttersUsed) || 0, card_info: historyCardInfo }).eq('id', cardId)
    ]

    if (totalScrap > 0) {
      // Автоматично відправляємо в 'scrap_ready' на склад для ВКЯ
      const nom = nomenclatures.find(n => n.id === card.nomenclature_id)
      writePromises.push(
        supabase.from('inventory').select('*')
          .eq('nomenclature_id', card.nomenclature_id)
          .eq('type', 'scrap_ready')
          .limit(1).maybeSingle()
          .then(async ({ data: existing, error: inventoryLookupError }) => {
            if (inventoryLookupError) throw inventoryLookupError
            if (existing) {
              const result = await supabase.from('inventory').update({
                total_qty: (Number(existing.total_qty) || 0) + totalScrap,
                updated_at: new Date().toISOString()
              }).eq('id', existing.id)
              if (result.error) throw result.error
              return result
            } else {
              const result = await supabase.from('inventory').insert([{
                nomenclature_id: card.nomenclature_id,
                name: nom?.name || 'Деталь',
                unit: nom?.unit || 'шт',
                total_qty: totalScrap,
                type: 'scrap_ready',
                updated_at: new Date().toISOString()
              }])
              if (result.error) throw result.error
              return result
            }
          })
      )
    }

    const writeResults = await Promise.all(writePromises)
    const writeError = writeResults.find(result => result?.error)?.error
    if (writeError) throw writeError

    // Increment completed cards count since maintenance for the machine
    if (maintenanceCheckEnabled && card.machine_id) {
      try {
        const machId = card.machine_id;
        const currentMach = (machines || []).find(m => String(m.id) === String(machId)) || { completed_cards_count_since_maintenance: 0 };
        const nextCount = (Number(currentMach.completed_cards_count_since_maintenance) || 0) + 1;
        
        let machUpdates = { completed_cards_count_since_maintenance: nextCount };
        if (nextCount >= 5) {
          const nowISO = new Date().toISOString();
          machUpdates.status = 'maintenance_required';
          machUpdates.maintenance_pending_since = nowISO;
          
          // 1. Create maintenance log row in DB
          await supabase.from('machine_maintenance_logs').insert([{
            machine_id: machId,
            triggered_at: nowISO,
            status: 'pending'
          }]);
          
          // 2. Trigger push notification to director, master, foreman
          if (systemUsers && systemUsers.length > 0) {
            const notifyIds = systemUsers.filter(u => {
              if (!u?.access_rights) return false;
              const settings = u.notification_settings || {};
              if (settings.maintenance === false) return false;
              
              const posLower = (u.position || '').toLowerCase();
              const hasRole = u.access_rights.director || u.access_rights.master || u.access_rights.foreman;
              const hasTitle = posLower.includes('директор') || posLower.includes('майстер') || posLower.includes('начальник') || posLower.includes('нач');
              return hasRole || hasTitle;
            }).map(u => u.id);
            
            if (notifyIds.length > 0) {
              const machineName = card.machine || currentMach.name || 'Верстат';
              sendPushToUsers(
                notifyIds,
                `🚨 Чистка стола: ${machineName}`,
                `Станок заблоковано! Завершено 5 карток. Потрібно очистити стіл.`,
                '/settings',
                { tag: `maintenance-req-${machId}` }
              ).catch(() => {});
            }
          }
        }
        
        await supabase.from('machines').update(machUpdates).eq('id', machId);
        refreshTable('machines');
      } catch (err) {
        console.error('Error handling machine maintenance threshold:', err);
      }
    }

    if (currentOp === 'Розкрій' && cuttersBreakdown && Object.keys(cuttersBreakdown).length > 0) {
      const isChamferCutter = (name) => {
        const n = String(name || '').toLowerCase()
        return n.includes('фасоч') || n.includes('фаска') || n.includes('chamfer')
      }

      const cutterUsageItems = []
      const task = tasks?.find(t => String(t.id) === String(card.task_id))

      for (const [cutterName, actualQtyVal] of Object.entries(cuttersBreakdown)) {
        const actualQty = Number(actualQtyVal) || 0
        if (actualQty <= 0) continue

        const nom = nomenclatures?.find(n => n.name?.trim().toLowerCase() === cutterName.trim().toLowerCase() && n.type === 'consumable')
        if (!nom) continue
        cutterUsageItems.push({ nomenclature_id: nom.id, quantity: actualQty })

        // 1. Calculate planned cutter quantity
        const plannedCutterItem = task?.plan_snapshot?.consumables?.find(c => String(c.name).toLowerCase().trim() === cutterName.toLowerCase().trim())
        const plannedQty = Number(plannedCutterItem?.total) || 0

        // 2. Adjust inventory total_qty and reserved_qty according to the 3 scenarios
        const invItem = inventory?.find(i => String(i.nomenclature_id) === String(nom.id) && (i.warehouse === 'operational' || i.type === 'consumable'))
        if (invItem) {
          const curTotal = Number(invItem.total_qty) || 0
          const curReserved = Number(invItem.reserved_qty) || 0
          const nextTotal = Math.max(0, curTotal - actualQty)
          const releaseReserved = Math.min(curReserved, plannedQty > 0 ? plannedQty : actualQty)
          const nextReserved = Math.max(0, curReserved - releaseReserved)

          await supabase.from('inventory').update({
            total_qty: nextTotal,
            reserved_qty: nextReserved
          }).eq('id', invItem.id)

          // 3. Scenario 3: If excess usage on a Chamfer cutter, add excess to restoration terminal queue
          if (actualQty > plannedQty && plannedQty > 0) {
            const excess = actualQty - plannedQty
            if (isChamferCutter(cutterName)) {
              await supabase.from('cutter_restoration_batches').insert([{
                batch_number: `BATCH-OVER-${Date.now().toString(36).toUpperCase()}`,
                nomenclature_id: nom.id,
                cutter_name: nom.name,
                received_qty: excess,
                status: 'pending',
                source_machine: card.machine || 'Не вказано',
                source_manager: card.manager_name || 'Не вказано',
                created_at: new Date().toISOString()
              }])
            }
          }
        }
      }

      if (cutterUsageItems.length > 0) {
        const actorName = [currentUser?.last_name, currentUser?.first_name].filter(Boolean).join(' ') || currentUser?.login || card.operator_name || 'system'
        const { error: cutterUsageError } = await supabase.rpc('register_cutter_usage', {
          p_source_card_id: cardId,
          p_items: cutterUsageItems,
          p_actor_id: currentUser?.id || null,
          p_actor_name: actorName,
          p_source_metadata: {
            operator_name: card.operator_name || null,
            manager_name: card.manager_name || null,
            machine_name: card.machine || null
          }
        })
        if (cutterUsageError && cutterUsageError.code !== 'PGRST202' && cutterUsageError.code !== '42883') {
          console.warn('register_cutter_usage RPC info:', cutterUsageError.message)
        }
      }
    }

    if (isRework || (card.card_info || '').includes('[ADMIN_MANUAL]')) {
      const nom = nomenclatures.find(n => n.id === card.nomenclature_id)
      if (nom && qtyCompleted > 0) {
        const { data: bzItem } = await supabase.from('inventory').select('*').eq('nomenclature_id', nom.id).eq('type', 'bz').limit(1).maybeSingle()
        if (bzItem) await supabase.from('inventory').update({ total_qty: (Number(bzItem.total_qty) || 0) + qtyCompleted }).eq('id', bzItem.id)
        else await supabase.from('inventory').insert([{ nomenclature_id: nom.id, name: nom.name, unit: nom.unit || 'шт', total_qty: qtyCompleted, reserved_qty: 0, type: 'bz', pocket_owner: null }])
      }
    } else if (!isShop2) {
      const nom = nomenclatures.find(n => n.id === card.nomenclature_id)
      if (nom) {
        let totalNeed = Number(card.card_info?.match(/\[NEED:(\d+)\]/)?.[1])
        const plannedReq = Number(card.card_info?.match(/\[REQ:(\d+)\]/)?.[1])
        if (!totalNeed && card.order_id) {
          const order = orders.find(o => String(o.id) === String(card.order_id))
          if (order) {
            const directItem = order.order_items?.find(it => String(it.nomenclature_id) === String(card.nomenclature_id))
            if (directItem) totalNeed = Number(directItem.quantity) || 0
            else order.order_items?.forEach(oi => {
              const bom = bomItems.filter(b => b.parent_id === oi.nomenclature_id)
              const match = bom.find(b => b.child_id === card.nomenclature_id)
              if (match) totalNeed += (Number(oi.quantity) || 0) * (Number(match.quantity_per_parent) || 1)
            })
          }
        }
        // REQ is the requirement of this exact loading/card. NEED is the
        // whole-detail requirement and must only be a legacy fallback.
        let effectiveReq = plannedReq || totalNeed
        if (!effectiveReq) effectiveReq = Math.max(0, Number(card.quantity) - (Number(card.buffer_qty) || 0))
        const netQtyForOrder = Math.min(qtyCompleted, effectiveReq)
        const actualBuffer = Math.max(0, qtyCompleted - netQtyForOrder)

        const typesToFetch = []
        if (netQtyForOrder > 0) typesToFetch.push('semi')
        if (actualBuffer > 0) typesToFetch.push('wip_bz')

        if (typesToFetch.length > 0) {
          const { data: existingItems } = await supabase.from('inventory')
            .select('*')
            .eq('nomenclature_id', nom.id)
            .in('type', typesToFetch)

          const updates = []
          const inserts = []

          if (netQtyForOrder > 0) {
            const match = existingItems?.find(i => i.type === 'semi')
            if (match) {
              updates.push({ ...match, total_qty: (Number(match.total_qty) || 0) + netQtyForOrder })
            } else {
              inserts.push({ nomenclature_id: nom.id, name: nom.name, unit: nom.unit || 'шт', total_qty: netQtyForOrder, reserved_qty: 0, type: 'semi' })
            }
          }
          if (actualBuffer > 0) {
            const match = existingItems?.find(i => i.type === 'wip_bz')
            if (match) {
              updates.push({ ...match, total_qty: (Number(match.total_qty) || 0) + actualBuffer })
            } else {
              inserts.push({ nomenclature_id: nom.id, name: nom.name, unit: nom.unit || 'шт', total_qty: actualBuffer, reserved_qty: 0, type: 'wip_bz' })
            }
          }

          const writeOps = []
          if (updates.length > 0) writeOps.push(supabase.from('inventory').upsert(updates))
          if (inserts.length > 0) writeOps.push(supabase.from('inventory').insert(inserts))
          await Promise.all(writeOps)
        }
      }
    }
    setWorkCards(prev => prev.map(c => c.id === cardId ? { ...c, ...cardUpdate } : c))
    setWorkCardHistory(prev => [{ card_id: cardId, nomenclature_id: card.nomenclature_id, stage_name: card.operation || 'Розкрій', operator_name: card.operator_name || 'Не вказано', card_info: historyCardInfo, qty_at_start: card.quantity, qty_completed: qtyCompleted, scrap_qty: totalScrap, started_at: card.started_at, completed_at: new Date().toISOString() }, ...prev])
    refreshTable('work_cards')
    if (totalScrap > 0) refreshTable('work_card_scrap_totals')
    refreshTable('inventory')
  }

  const completeTaskByMaster = async (taskId) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'completed', completed_at: new Date().toISOString() } : t))
    await deductIssuedMaterialsForTask(taskId)
    await supabase.from('tasks').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', taskId)
    refreshTable('inventory')
  }

  const addManagementTask = async (taskPayload, currentUserLogin) => {
    const allowedFields = [
      'title', 'description', 'priority', 'color', 'assigned_to', 'assignees',
      'is_collective', 'department', 'deadline', 'checklist', 'status', 'project_id'
    ]
    const cleanPayload = allowedFields.reduce((result, field) => {
      if (taskPayload[field] !== undefined) result[field] = taskPayload[field]
      return result
    }, {})
    cleanPayload.deadline = cleanPayload.deadline || null
    cleanPayload.assignees = Array.isArray(cleanPayload.assignees) ? cleanPayload.assignees : []
    cleanPayload.checklist = Array.isArray(cleanPayload.checklist) ? cleanPayload.checklist : []

    const newTaskObj = {
      id: 'task_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      ...cleanPayload,
      created_by: currentUserLogin || 'system',
      created_at: new Date().toISOString()
    }

    setManagementTasks(prev => [newTaskObj, ...prev])
    try {
      const saved = JSON.parse(localStorage.getItem('centrum_created_management_tasks') || '[]')
      localStorage.setItem('centrum_created_management_tasks', JSON.stringify([newTaskObj, ...saved.filter(t => t.id !== newTaskObj.id)]))
    } catch (e) {}

    try {
      const { data, error } = await supabase.from('management_tasks').insert([cleanPayload]).select()
      if (!error && data?.[0]) {
        setManagementTasks(prev => prev.map(t => t.id === newTaskObj.id ? data[0] : t))
        return { data: data[0], error: null }
      }
      return { data: newTaskObj, error }
    } catch (err) {
      return { data: newTaskObj, error: err }
    }
  }
  const updateManagementTask = async (taskId, updates) => {
    setManagementTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...updates } : t))
    try {
      const savedTasks = JSON.parse(localStorage.getItem('centrum_created_management_tasks') || '[]')
      const updatedTasks = savedTasks.map(t => t.id === taskId ? { ...t, ...updates } : t)
      localStorage.setItem('centrum_created_management_tasks', JSON.stringify(updatedTasks))
    } catch (e) {}

    if (updates.status || updates.project_id) {
      try {
        const saved = JSON.parse(localStorage.getItem('centrum_task_status_updates') || '{}')
        saved[taskId] = { ...(saved[taskId] || {}), ...updates }
        localStorage.setItem('centrum_task_status_updates', JSON.stringify(saved))
      } catch (e) {}
    }
    const { error } = await supabase.from('management_tasks').update(updates).eq('id', taskId)
    return { error }
  }
  const deleteManagementTask = async (taskId) => {
    setManagementTasks(prev => prev.filter(t => t.id !== taskId))
    try {
      const savedTasks = JSON.parse(localStorage.getItem('centrum_created_management_tasks') || '[]')
      localStorage.setItem('centrum_created_management_tasks', JSON.stringify(savedTasks.filter(t => t.id !== taskId)))

      const savedUpdates = JSON.parse(localStorage.getItem('centrum_task_status_updates') || '{}')
      delete savedUpdates[taskId]
      localStorage.setItem('centrum_task_status_updates', JSON.stringify(savedUpdates))
    } catch (e) {}

    const { error } = await supabase.from('management_tasks').delete().eq('id', taskId)
    return { error }
  }

  const addMachine = async (machineData) => {
    const { data, error } = await supabase.from('machines').insert([machineData]).select()
    if (!error && data?.[0]) setMachines(prev => [...prev, data[0]])
    return { data: data?.[0], error }
  }
  const updateMachine = async (id, updates) => {
    setMachines(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m))
    const { error } = await supabase.from('machines').update(updates).eq('id', id)
    return { error }
  }
  const deleteMachine = async (id) => {
    const { error } = await supabase.from('machines').delete().eq('id', id)
    if (!error) setMachines(prev => prev.filter(m => m.id !== id))
    return { error }
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

  const createNaryad = async (orderId, machineName, customQuantities = null, customDeadline = null, customRowMachines = null, customMaterialSplits = null, customCutters = null, customBOMParts = null, customCutterOverrides = null, customRowMachinesSplits = null, customUseStockBZ = true, customPartBZOverrides = null) => {
    const bzOperationId = crypto.randomUUID()
    let bzReservationCreated = false
    let bzReservationAttached = false
    try {
      const validOrderId = (orderId && /^[0-9a-fA-F-]{36}$/.test(String(orderId))) ? orderId : null
      let order = orders.find(o => String(o.id) === String(orderId))
      if (!order) {
        order = {
          id: validOrderId || `internal_${Date.now()}`,
          order_num: (orderId && String(orderId).startsWith('ВБ')) ? String(orderId) : 'ВБ-НАКОПИЧЕННЯ',
          customer: 'Власні потреби (Накопичення)',
          deadline: customDeadline || new Date(Date.now() + 86400000 * 7).toISOString().split('T')[0],
          order_items: []
        }
      }
      let totalMin = 0
      let totalPlanQty = 0
      const materialSummary = {}
      const bzStockDeductions = []
      const plan_snapshot = { _use_bz: customUseStockBZ, _part_bz_overrides: customPartBZOverrides || {} }

      const itemKeys = Object.keys(customQuantities || customBOMParts || {})
      const effectiveOrderItems = (order.order_items && order.order_items.length > 0)
        ? order.order_items
        : itemKeys.map(key => {
            const nom = nomenclatures.find(n => String(n.id) === String(key))
            return {
              id: key,
              nomenclature_id: nom ? nom.id : key,
              quantity: customQuantities?.[key] !== undefined ? Number(customQuantities[key]) : 1
            }
          })

      const getDisplayParts = (item) => customBOMParts && customBOMParts[item.id]
        ? customBOMParts[item.id].map(p => ({ nom: p.nom, qtyPer: p.quantity_per_parent }))
        : (() => {
            const parts = bomItems.filter(b => String(b.parent_id) === String(item.nomenclature_id))
            return parts.length > 0
              ? parts.map(b => ({ nom: nomenclatures.find(n => String(n.id) === String(b.child_id)), qtyPer: b.quantity_per_parent }))
              : [{ nom: nomenclatures.find(n => String(n.id) === String(item.nomenclature_id)), qtyPer: 1 }]
          })()

      const bzRequestedByNom = {}
      effectiveOrderItems.forEach(item => {
        const requestedQty = customQuantities && customQuantities[item.id] !== undefined
          ? Number(customQuantities[item.id])
          : Number(item.quantity)
        if (requestedQty <= 0) return
        getDisplayParts(item).forEach(part => {
          if (!part.nom) return
          const partId = String(part.nom.id)
          const isBZActiveForPart = (customPartBZOverrides && customPartBZOverrides[partId] !== undefined)
            ? Boolean(customPartBZOverrides[partId])
            : Boolean(customUseStockBZ)

          if (isBZActiveForPart) {
            const quantity = requestedQty * (Number(part.qtyPer) || 1)
            bzRequestedByNom[part.nom.id] = (bzRequestedByNom[part.nom.id] || 0) + quantity
          }
        })
      })

      const actorName = [currentUser?.last_name, currentUser?.first_name].filter(Boolean).join(' ') || currentUser?.login || 'system'
      const { data: bzReserveData, error: bzReserveError } = await supabase.rpc('reserve_bz_for_naryad', {
        p_operation_id: bzOperationId,
        p_order_id: validOrderId,
        p_items: Object.keys(bzRequestedByNom).length > 0
          ? Object.entries(bzRequestedByNom).map(([nomenclature_id, quantity]) => ({ nomenclature_id, quantity }))
          : [],
        p_actor_id: currentUser?.id || null,
        p_actor_name: actorName
      })
      if (bzReserveError) throw bzReserveError
      bzReservationCreated = true
      const bzReserveResult = bzReserveData

      const bzAllocationRemaining = Object.fromEntries(
        (bzReserveResult?.allocations || []).map(row => [
          String(row.nomenclature_id),
          Number(row.allocated_qty) || 0
        ])
      )

      effectiveOrderItems.forEach(item => {
        const requestedQty = customQuantities && customQuantities[item.id] !== undefined ? Number(customQuantities[item.id]) : Number(item.quantity)
        if (requestedQty <= 0) return
        
        const displayParts = getDisplayParts(item)
        displayParts.forEach(part => {
          if (!part.nom) return
          const totalNeeded = requestedQty * (Number(part.qtyPer) || 1)
          const allocationKey = String(part.nom.id)
          const allocatedRemaining = bzAllocationRemaining[allocationKey] || 0

          const isBZActiveForPart = (customPartBZOverrides && customPartBZOverrides[allocationKey] !== undefined)
            ? Boolean(customPartBZOverrides[allocationKey])
            : Boolean(customUseStockBZ)

          const usedFromStock = isBZActiveForPart ? Math.min(totalNeeded, allocatedRemaining) : 0
          bzAllocationRemaining[allocationKey] = Math.max(0, allocatedRemaining - usedFromStock)
          const totalToProduce = Math.max(0, totalNeeded - usedFromStock)
          const isManufactured = part.nom.type === 'part' || part.nom.type === 'raw' || !part.nom.type;
          if (isManufactured) {
            totalPlanQty += totalToProduce
          }
          const unitsPerSheet = Number(part.nom.units_per_sheet) || 1
          let sheets = Math.ceil(totalToProduce / unitsPerSheet)
          const splits = (customRowMachinesSplits && customRowMachinesSplits[part.nom.id]) || []
          const selectedMachine = splits.length > 0 ? (splits[0]?.machine || machineName) : ((customRowMachines && customRowMachines[part.nom.id]) || machineName);

          const split = customMaterialSplits && (customMaterialSplits[part.nom.id] !== undefined ? customMaterialSplits[part.nom.id] : customMaterialSplits[String(part.nom.id)])
          const sheets_t300 = split && split.t300 !== undefined ? Number(split.t300) : 0
          const sheets_t700 = split && split.t700 !== undefined ? Number(split.t700) : 0

          const cutterOverride = customCutterOverrides?.[part.nom.id] || '2';
          plan_snapshot[part.nom.id] = { 
            id: part.nom.id, 
            name: part.nom.name, 
            code: part.nom.nomenclature_code, 
            need: totalNeeded, 
            stock: usedFromStock,
            plan: totalToProduce, 
            units_per_sheet: unitsPerSheet, 
            sheets: sheets_t300 + sheets_t700, 
            sheets_t300,
            sheets_t700,
            material: part.nom.material_type, 
            order_item_id: item.id, 
            selected_machine: selectedMachine,
            machine: selectedMachine,
            cutter_override: cutterOverride,
            splits: splits
          }

          if (usedFromStock > 0) {
            const existingAllocation = bzStockDeductions.find(row => String(row.nomenclature_id) === allocationKey)
            if (existingAllocation) existingAllocation.quantity += usedFromStock
            else bzStockDeductions.push({ nomenclature_id: part.nom.id, quantity: usedFromStock })
          }
          if (totalToProduce <= 0) return

          const matKeyBase = (part.nom.material_type || part.nom.name || '').trim();
          const isSheet = matKeyBase.toLowerCase().includes('лист') ||
                          matKeyBase.toLowerCase().includes('sheet') ||
                          matKeyBase.toLowerCase().includes('карбон') ||
                          matKeyBase.toLowerCase().includes('carbon');

          if (isSheet) {
            const addMaterialToSummary = (typePrefix, qty) => {
              const matKeyBase = (part.nom.material_type || part.nom.name || 'Інше').trim()
              const explicitRawCandidate = findExplicitRawMaterialNom(matKeyBase)
              const explicitCandidateName = String(explicitRawCandidate?.name || '').toLowerCase()
              const requestedT700 = /(?:т|t)\s*700/i.test(typePrefix)
              const candidateIsT700 = /(?:т|t)\s*700/i.test(explicitCandidateName)
              const candidateIsT300 = /(?:т|t)\s*300/i.test(explicitCandidateName)
              const explicitCandidateMatchesGrade = requestedT700
                ? candidateIsT700
                : (candidateIsT300 || !candidateIsT700)
              const explicitRawNom = explicitRawCandidate &&
                String(explicitRawCandidate.name || '').toLowerCase().includes('підготовлений') &&
                !String(explicitRawCandidate.name || '').toLowerCase().includes('непідготовлений') &&
                explicitCandidateMatchesGrade
                  ? explicitRawCandidate
                  : null
              const thickMatch = matKeyBase.match(/\((\d+(?:\.\d+)?)мм\)/i)
              const thicknessClean = thickMatch ? `${thickMatch[1]}мм` : matKeyBase.toLowerCase().replace(' ', '')
              let rawNom = explicitRawNom || nomenclatures.find(n =>
                (n.type === 'raw' || n.type === 'material') &&
                n.name.includes('[Підготовлений]') &&
                (n.name.toLowerCase().includes(typePrefix.toLowerCase()) || (typePrefix === 'Т300' && !n.name.toLowerCase().includes('т700') && !n.name.toLowerCase().includes('t700'))) &&
                n.name.toLowerCase().replace(' ', '').includes(`(${thicknessClean})`)
              )

              if (!rawNom) {
                rawNom = nomenclatures.find(n =>
                  (n.type === 'raw' || n.type === 'material') &&
                  n.name.toLowerCase().includes(typePrefix.toLowerCase()) &&
                  (n.name.toLowerCase().includes(thicknessClean) || n.material_type?.toLowerCase() === thicknessClean)
                )
              }

              const matKeyName = rawNom
                ? (rawNom.name.includes(typePrefix) ? rawNom.name : rawNom.name.replace('[Підготовлений]', `${typePrefix} [Підготовлений]`))
                : `Лист ${typePrefix} (${matKeyBase}) [Підготовлений]`
              const matId = rawNom?.id ? `${rawNom.id}-${typePrefix}` : `virtual-${typePrefix}-${matKeyBase}`

              if (!materialSummary[matId]) {
                const unit = 'ЛИСТІВ'
                materialSummary[matId] = { 
                  matName: matKeyName, 
                  grade: typePrefix,
                  sheets: 0, 
                  totalUnits: 0, 
                  components: [], 
                  inventory_id: null, 
                  nomenclature_id: rawNom?.id || null, 
                  unit, 
                  partType: rawNom?.type || 'raw' 
                }

                if (rawNom?.id) {
                  const inv = inventory.find(i =>
                    String(i.nomenclature_id) === String(rawNom.id) &&
                    i.warehouse === 'operational'
                  ) || inventory.find(i =>
                    String(i.nomenclature_id) === String(rawNom.id)
                  )
                  materialSummary[matId].inventory_id = inv?.id || null
                }
              }

              materialSummary[matId].sheets += qty
              materialSummary[matId].totalUnits += totalToProduce
              materialSummary[matId].components.push(`${part.nom.name}: ${totalToProduce}шт`)
            }

            if (sheets_t300 > 0) {
              addMaterialToSummary('Т300', sheets_t300)
            }
            if (sheets_t700 > 0) {
              addMaterialToSummary('Т700', sheets_t700)
            }
            if (sheets_t300 === 0 && sheets_t700 === 0) {
              addMaterialToSummary('Т300', 0)
            }
          }

          totalMin += totalToProduce * (Number(part.nom.time_per_unit) || 0)
        })
      })

      if (Object.keys(plan_snapshot).length === 0) {
        await supabase.rpc('release_bz_reservation', {
          p_operation_id: bzOperationId,
          p_reason: 'Наряд не створено: порожній план'
        })
        return
      }
      const totalUnits = effectiveOrderItems.reduce((acc, it) => acc + (Number(it.quantity) || 0), 0) || 0;
      const thisNaryadTotalSets = customQuantities ? Math.max(...Object.values(customQuantities).map(v => Number(v) || 0)) : totalUnits;
      const alreadyPlannedSets = tasks.filter(t => t.order_id === validOrderId).reduce((acc, t) => acc + (Number(t.planned_sets) || 0), 0);
      const isPartial = (thisNaryadTotalSets < totalUnits) || (alreadyPlannedSets > 0);
      const orderTasks = tasks.filter(t => String(t.order_id) === String(validOrderId))
      const maxBatchIndex = orderTasks.reduce((max, t) => Math.max(max, Number(t.batch_index) || 0), 0)
      const nextBatchIndex = maxBatchIndex + 1;
      plan_snapshot._metadata = { planned_deadline: customDeadline || order.deadline, batch_index: isPartial ? nextBatchIndex : null }

      // A production task must never be created with fewer sheet requests than
      // the plan requires. This catches material matching/regression errors
      // before the task is inserted and the warehouse reservation is lost.
      const plannedSheetsByGrade = Object.values(plan_snapshot).reduce((totals, part) => {
        if (!part || typeof part !== 'object' || !part.id) return totals
        totals.t300 += Number(part.sheets_t300) || 0
        totals.t700 += Number(part.sheets_t700) || 0
        return totals
      }, { t300: 0, t700: 0 })
      const requestedSheetsByGrade = Object.values(materialSummary).reduce((totals, material) => {
        const name = String(material?.matName || '').toLowerCase()
        const grade = String(material?.grade || '').toLowerCase()
        const qty = Number(material?.sheets) || 0
        if (grade.includes('300') || /(?:т|t)\s*300/i.test(name)) totals.t300 += qty
        else if (grade.includes('700') || /(?:т|t)\s*700/i.test(name)) totals.t700 += qty
        return totals
      }, { t300: 0, t700: 0 })
      if (
        plannedSheetsByGrade.t300 !== requestedSheetsByGrade.t300 ||
        plannedSheetsByGrade.t700 !== requestedSheetsByGrade.t700
      ) {
        throw new Error(
          `Наряд не створено: заявки на листи не відповідають плану ` +
          `(Т300 ${requestedSheetsByGrade.t300}/${plannedSheetsByGrade.t300}, ` +
          `Т700 ${requestedSheetsByGrade.t700}/${plannedSheetsByGrade.t700}).`
        )
      }
      plan_snapshot.materialSummary = materialSummary

      // ── Pre-compute consumables & selectedCutters BEFORE first insert ────
      // This allows us to include a fully complete plan_snapshot in the INSERT,
      // avoiding the redundant second UPDATE round-trip.
      const _allMaterialsPreCompute = Object.values(materialSummary).map(info => ({ ...info, sheets: Number(info.sheets) || 0 }))
      const _totalSheetsPreCompute = _allMaterialsPreCompute.filter(m => m.unit === 'ЛИСТІВ').reduce((acc, m) => acc + (m.sheets || 0), 0)

      const _machineSpecificCutters = {}
      let _hasMachineSpecificCutters = false
      const _partIds = Object.keys(plan_snapshot).filter(k => !k.startsWith('_') && k !== 'materialSummary')
      _partIds.forEach(partId => {
        const partInfo = plan_snapshot[partId]
        const sheetsNeeded = Number(partInfo.sheets) || 0
        if (sheetsNeeded <= 0) return
        const targetMach = partInfo.selected_machine || machineName
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
              _hasMachineSpecificCutters = true
              const totalQty = Math.ceil(sheetsNeeded * qtyPerSheet)
              let cutterNom = nomenclatures.find(n => String(n.id) === String(cutterNomId))
              
              if (cutterNom) {
                const nl = cutterNom.name.toLowerCase()
                const m1 = nl.match(/ф\s*([0-9,.]+)/)
                const m2 = nl.match(/(?:кукурудза|двопера|однопера|спіральна|торцева|шарова|радіусна)?\s*([0-9][0-9,]*)(?:\s*[×xх×])/)
                const d = m1 ? parseFloat(m1[1].replace(',', '.')) : (m2 ? parseFloat(m2[1].replace(',', '.')) : null)
                
                if (partInfo.cutter_override === '1.5' && d && Math.abs(d - 2) < 0.01) {
                  // Override Ф2 with Ф1.5
                  cutterNom = { ...cutterNom, name: 'Фреза ф1.5', id: '__synthetic_f1.5__' }
                }
              }

              if (cutterNom) {
                const cleanName = cutterNom.name.trim()
                const key = cleanName.toLowerCase()
                if (!_machineSpecificCutters[key]) {
                  _machineSpecificCutters[key] = { name: cleanName, qty: 0, components: [], nomenclature_id: cutterNom.id }
                }
                _machineSpecificCutters[key].qty += totalQty
                _machineSpecificCutters[key].components.push(`${partInfo.name}: ${totalQty} шт (${sheetsNeeded} л.)`)
              }
            }
          })
        }
      })

      const _consumablesSnapshot = []
      Object.values(_machineSpecificCutters).forEach(item => {
        _consumablesSnapshot.push({ name: item.name, total: item.qty })
      })
      if (_totalSheetsPreCompute > 0) {
        nomenclatures.filter(n => n.type === 'consumable' && (Number(n.consumption_per_sheet) || 0) > 0 && n.name.trim().toLowerCase() !== 'фреза' && (n.name.toLowerCase().startsWith('лист') || n.name.toLowerCase().includes('фреза'))).forEach(cons => {
          if (_hasMachineSpecificCutters && cons.name.toLowerCase().includes('фреза')) return
          const neededQty = Math.ceil(_totalSheetsPreCompute * Number(cons.consumption_per_sheet))
          const customInvId = customCutters?.[cons.name.trim()] || customCutters?.[cons.name]
          const selectedInv = customInvId ? inventory.find(i => String(i.id) === String(customInvId)) : null
          const displayName = selectedInv ? selectedInv.name : cons.name.trim()
          _consumablesSnapshot.push({ name: displayName, total: neededQty })
        })
      }
      plan_snapshot.selectedCutters = customCutters || {}
      plan_snapshot.consumables = _consumablesSnapshot
      // ────────────────────────────────────────────────────────────────────

      const isAllFromBZ = totalPlanQty === 0;

      const nowISO = new Date().toISOString()
      const { data: taskData, error: taskError } = await supabase.from('tasks').insert([{
        order_id: validOrderId,
        step: 'Розкрій',
        status: isAllFromBZ ? 'completed' : 'waiting',
        completed_at: isAllFromBZ ? nowISO : null,
        machine_name: machineName || 'Не вказано',
        estimated_time: Math.round(totalMin),
        engineer_conf: isAllFromBZ ? true : false,
        warehouse_conf: isAllFromBZ ? 'true' : 'false',
        director_conf: isAllFromBZ ? true : false,
        plan_snapshot: plan_snapshot,
        planned_sets: thisNaryadTotalSets,
        batch_index: isPartial ? nextBatchIndex : null,
        planned_deadline: customDeadline || order.deadline
      }]).select()
      const tData = (taskData && taskData.length > 0) ? taskData[0] : null
      if (taskError) throw taskError

      // Створюємо завдання для Цеху №2 (Пресування [ЦЕХ №2])
      if (tData) {
        const { data: newShop2Task } = await supabase.from('tasks').insert([{
          order_id: validOrderId,
          step: 'Пресування [ЦЕХ №2]',
          status: isAllFromBZ ? 'completed' : 'waiting',
          completed_at: isAllFromBZ ? nowISO : null,
          machine_name: machineName || 'Не вказано',
          estimated_time: 0,
          engineer_conf: isAllFromBZ ? true : false,
          warehouse_conf: isAllFromBZ ? 'true' : 'false',
          director_conf: isAllFromBZ ? true : false,
          plan_snapshot: { ...(plan_snapshot || {}), arrivals: [] },
          planned_sets: thisNaryadTotalSets,
          batch_index: isPartial ? nextBatchIndex : null,
          planned_deadline: customDeadline || order.deadline
        }]).select()

        if (newShop2Task && newShop2Task.length > 0) {
          setTasks(prev => [...prev, newShop2Task[0]])
        }
      }

      if (bzReservationCreated) {
        const { error: attachError } = await supabase.rpc('attach_bz_reservation_to_task', {
          p_operation_id: bzOperationId,
          p_task_id: tData.id
        })
        if (attachError) throw attachError
        bzReservationAttached = true
      }

      if (bzStockDeductions.length > 0) {
        // Deduct allocated BZ stock from inventory table
        for (const allocation of bzStockDeductions) {
          try {
            const { data: bzItem } = await supabase
              .from('inventory')
              .select('*')
              .eq('nomenclature_id', allocation.nomenclature_id)
              .eq('type', 'bz')
              .limit(1)
              .maybeSingle()

            if (bzItem) {
              const nextQty = Math.max(0, (Number(bzItem.total_qty) || 0) - Number(allocation.quantity))
              await supabase
                .from('inventory')
                .update({ total_qty: nextQty })
                .eq('id', bzItem.id)
            }
          } catch (invErr) {
            console.warn('Failed to deduct BZ inventory:', invErr)
          }
        }

        const cardsToInsert = bzStockDeductions.map(allocation => ({
          task_id: tData.id,
          order_id: orderId,
          nomenclature_id: allocation.nomenclature_id,
          quantity: allocation.quantity,
          status: 'completed',
          operation: 'Склад БЗ',
          card_info: `[ЗІ СКЛАДУ БЗ] [BZ_RESERVATION:${bzOperationId}]`
        }))

        if (cardsToInsert.length > 0) {
          const { data: bzCardData, error: cardError } = await supabase
            .from('work_cards')
            .insert(cardsToInsert)
            .select()

          if (!cardError && bzCardData && bzCardData.length > 0) {
            const historyToInsert = bzCardData.map(bzCard => ({
              card_id: bzCard.id,
              nomenclature_id: bzCard.nomenclature_id,
              stage_name: 'Склад БЗ',
              operator_name: 'Склад (БРОНЬ)',
              qty_at_start: bzCard.quantity,
              qty_completed: bzCard.quantity,
              scrap_qty: 0,
              completed_at: new Date().toISOString()
            }))
            await supabase.from('work_card_history').insert(historyToInsert)
          }
        }
        refreshTable('inventory')
      }

      // ── Fire all remaining writes in parallel ────────────────────────────
      const allMaterials = Object.values(materialSummary).map(info => ({ ...info, sheets: Number(info.sheets) || 0 }))
      const requestsToInsert = allMaterials
        .filter(info => info.matName && info.sheets > 0 && (info.matName.toLowerCase().includes('лист') || info.matName.toLowerCase().includes('sheet') || info.unit === 'ЛИСТІВ'))
        .map(info => {
          const qtyToRequest = info.sheets
          return {
            order_id: orderId,
            task_id: tData.id,
            quantity: qtyToRequest,
            status: 'pending',
            inventory_id: info.inventory_id,
            nomenclature_id: info.nomenclature_id,
            details: `СКЛАД ОПЕРАТИВНИЙ: ${info.matName} — ${qtyToRequest} л. (Для: ${info.components.join(', ')})`
          }
        })

      // ── Run remaining DB writes in parallel (no sequential waits) ─────────
      const parallelWrites = [
        supabase.from('orders').update({ status: 'in-progress' }).eq('id', orderId)
      ]
      if (requestsToInsert.length > 0) parallelWrites.push(supabase.from('material_requests').insert(requestsToInsert))
      const writeResults = await Promise.all(parallelWrites)
      const writeError = writeResults.find(result => result?.error)?.error
      if (writeError) throw writeError

      // ── Optimistic state update — no DB refetch needed ────────────────────
      // Real-time subscription already handles INSERT events for tasks & material_requests.
      // We only need a local optimistic patch in case real-time is slow.
      if (tData) {
        setTasks(prev => prev.some(t => t.id === tData.id) ? prev : [tData, ...prev])
      }
      return tData
    } catch (err) {
      if (bzReservationCreated && !bzReservationAttached) {
        const { error: releaseError } = await supabase.rpc('release_bz_reservation', {
          p_operation_id: bzOperationId,
          p_reason: `Помилка створення наряду: ${err.message}`
        })
        if (releaseError) console.error('Error releasing BZ reservation:', releaseError.message)
      }
      console.error('Error creating naryad:', err.message)
      throw err
    }
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

  const disposeScrapItem = async (invId, qty) => {
    const item = inventory.find(i => i.id === invId)
    if (!item) return
    const nextQty = (Number(item.total_qty) || 0) - Number(qty)
    if (nextQty > 0) await supabase.from('inventory').update({ total_qty: nextQty }).eq('id', invId)
    else await supabase.from('inventory').delete().eq('id', invId)
    await supabase.from('reception_docs').insert([{ doc_num: `DIS-${Date.now().toString().slice(-6)}`, type: 'scrap_disposal', status: 'completed', items: JSON.stringify([{ name: item.name, qty: qty, nomenclature_id: item.nomenclature_id, disposed_at: new Date().toISOString() }]) }])
    refreshTable('inventory')
  }

  const createReworkNaryad = async (invId, qty, stage) => {
    const scrapItem = inventory.find(i => i.id === invId)
    if (!scrapItem) return
    const nomId = scrapItem.nomenclature_id
    const nom = nomenclatures.find(n => n.id === nomId)
    const vbOrders = (orders || []).filter(o => o.order_num && o.order_num.startsWith('ВБ'))
    const maxNum = vbOrders.reduce((max, o) => { const numPart = o.order_num.replace('ВБ', ''); const num = parseInt(numPart); return isNaN(num) ? max : Math.max(max, num) }, 0)
    const nextOrderNum = `ВБ${String(maxNum + 1).padStart(4, '0')}`

    // 1. Start inventory update/delete immediately in parallel
    const nextQty = (Number(scrapItem.total_qty) || 0) - Number(qty)
    const inventoryPromise = nextQty > 0
      ? supabase.from('inventory').update({ total_qty: nextQty }).eq('id', scrapItem.id)
      : supabase.from('inventory').delete().eq('id', scrapItem.id)

    // 2. Sequential path for inserts (Order -> Task -> Card)
    const { data: reworkOrder, error: orderErr } = await supabase
      .from('orders')
      .insert([{ order_num: nextOrderNum, customer: 'ВНУТРІШНЄ ДООПРАЦЮВАННЯ', status: 'in-progress' }])
      .select()
      .single()

    if (orderErr) {
      console.error("Error creating rework order:", orderErr)
      return
    }

    const orderId = reworkOrder?.id || null
    const plan_snapshot = { [nomId]: { id: nomId, name: nom?.name || scrapItem.name, code: nom?.nomenclature_code || '—', need: qty, stock: 0, plan: qty, is_rework: true } }

    const { data: taskData } = await supabase
      .from('tasks')
      .insert([{
        order_id: orderId,
        step: stage,
        status: 'waiting',
        machine_name: 'Доопрацювання',
        estimated_time: 0,
        engineer_conf: true,
        warehouse_conf: 'true',
        director_conf: true,
        plan_snapshot: plan_snapshot,
        planned_sets: 0
      }])
      .select()

    const newTask = taskData?.[0]
    let cardPromise = Promise.resolve()
    const isRestoration = stage.includes('Пресування') || stage.includes('Фарбування')
    const cardInfoText = isRestoration 
      ? `[RESTORATION] [ЦЕХ №2] ${nom?.name || scrapItem.name} — ВНУТРІШНЄ ВІДНОВЛЕННЯ ВКЯ`
      : `[REWORK] [ЦЕХ №2] ${nom?.name || scrapItem.name} — ДООПРАЦЮВАННЯ БРАКУ`

    if (newTask) {
      cardPromise = supabase
        .from('work_cards')
        .insert([{
          task_id: newTask.id,
          order_id: orderId,
          nomenclature_id: nomId,
          quantity: qty,
          status: 'new',
          operation: stage,
          card_info: cardInfoText
        }])
    }

    // 3. Await all inserts & updates in parallel
    await Promise.all([inventoryPromise, cardPromise])

    // 4. Refresh only affected tables in parallel (much faster than full fetchData(true))
    await Promise.all([
      refreshTable('orders'),
      refreshTable('tasks'),
      refreshTable('work_cards'),
      refreshTable('inventory')
    ])
  }

  return {
    createNaryad, handoverTaskToShop2, cancelHandoverToShop2, completeTaskShop2, directHandoverToSGP, handoverToSGP, reserveBZForTask, completePackaging, disposeScrapItem, createReworkNaryad,
    approveWarehouse, approveEngineer, approveDirector,
    upsertNomenclature, deleteNomenclature, saveBOM, removeBOM, syncBOM,
    addOrder, updateOrder, deleteOrder, superDeleteOrder, createWorkCard, createWorkCardsBatch, startWorkCard, completeWorkCard, confirmBuffer,
    completeTaskByMaster,
    addManagementTask, updateManagementTask, deleteManagementTask,
    addMachine, updateMachine, deleteMachine,
    getOrderProductionProgress,
    createDovyпускMaterialRequests
  }
}
