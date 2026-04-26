import { supabase } from '../supabase'

/**
 * Warehouse / Supply chain actions
 * Returns all purchase request, reception doc, and inventory actions
 */
export function createWarehouseActions({
  inventory, nomenclatures, requests, tasks,
  setInventory, setRequests, setTasks,
  normalize, refreshTable, fetchData
}) {

  // ── PURCHASE REQUESTS ──────────────────────────────────────────────────────

  const createPurchaseRequest = async (orderId, orderNum, items, taskId = null) => {
    const processedItems = items.map(it => ({
      ...it,
      needed: Number(it.missingAmount ?? it.needed ?? it.quantity ?? 0),
      needs_procurement: false // СО just asks СВ, doesn't know if procurement is needed yet
    }))
    const { error } = await supabase.from('purchase_requests').insert([{
      order_id: orderId, task_id: taskId, order_num: orderNum,
      items: processedItems, status: 'pending', destination_warehouse: 'production'
    }])
    if (!error) fetchData()
    return { error }
  }

  const updatePurchaseRequestStatus = async (id, status, destWarehouse = 'production') => {
    const { error } = await supabase.from('purchase_requests')
      .update({ status, destination_warehouse: destWarehouse }).eq('id', id)
    if (!error) fetchData()
    return { error }
  }

  const convertRequestToOrder = async (requestId) => {
    const { data: lockedReqs, error: lockErr } = await supabase
      .from('purchase_requests')
      .update({ status: 'ordered' })
      .eq('id', requestId)
      .neq('status', 'ordered')
      .select()

    if (lockErr || !lockedReqs || lockedReqs.length === 0) {
      console.warn('Request already converted or lock failed:', requestId)
      return { error: 'Запит вже обробляється або завершений' }
    }

    const requestData = lockedReqs[0]
    let targetWH = 'production'
    let sourceWH = null

    if (requestData.destination_warehouse === 'production') {
      targetWH = 'operational'
      sourceWH = 'production'
    }

    // Бронювання на складі-відправнику якщо це переміщення СВ → СО
    if (sourceWH) {
      try {
        const { data: invData } = await supabase.from('inventory').select('*').eq('warehouse', sourceWH)
        const inv = invData || []

        for (const it of (requestData.items || [])) {
          const qty = Number(it.qty ?? it.quantity ?? it.needed ?? 0)
          if (qty <= 0) continue

          const nomId = it.nomenclature_id
          const itemName = it.name || it.details || ''

          let matches = []
          if (nomId) {
            matches = inv.filter(i => String(i.nomenclature_id) === String(nomId))
          }
          if (matches.length === 0 && itemName) {
            matches = inv.filter(i => i.name && i.name.toLowerCase().trim() === itemName.toLowerCase().trim())
          }

          if (matches.length > 0) {
            const best = matches.sort((a, b) => (Number(b.total_qty) || 0) - (Number(a.total_qty) || 0))[0]
            await supabase.from('inventory').update({
              reserved_qty: (Number(best.reserved_qty) || 0) + qty
            }).eq('id', best.id)
          }
        }
      } catch (err) {
        console.error('Error reserving items during transfer:', err)
      }
    }

    const { error: recError } = await supabase.from('reception_docs').insert([{
      items: requestData.items,
      order_id: requestData.order_id,
      task_id: requestData.task_id,
      status: targetWH === 'production' && !sourceWH ? 'shipped' : 'ordered',
      target_warehouse: targetWH,
      source_warehouse: sourceWH,
      created_at: new Date().toISOString()
    }])

    if (recError) {
      await supabase.from('purchase_requests').update({ status: 'accepted' }).eq('id', requestId)
      return { error: recError }
    }

    fetchData()
    return { success: true }
  }

  // ── RECEPTION DOCS ─────────────────────────────────────────────────────────

  const createReceptionDoc = async (items, status = 'pending', orderId = null, taskId = null, targetWH = null, sourceWH = null) => {
    const { data, error } = await supabase.from('reception_docs').insert([{
      items, status, order_id: orderId, task_id: taskId,
      target_warehouse: targetWH, source_warehouse: sourceWH,
      created_at: new Date().toISOString()
    }]).select()
    if (!error) fetchData()
    return { data: (data && data.length > 0) ? data[0] : null, error }
  }

  const sendDocToWarehouse = async (docId, newTarget = null, newSource = null) => {
    const updateData = { status: 'shipped' }
    if (newTarget) updateData.target_warehouse = newTarget
    if (newSource) updateData.source_warehouse = newSource
    
    const { error } = await supabase.from('reception_docs').update(updateData).eq('id', docId)
    if (!error) fetchData()
    return { error }
  }

  const confirmReception = async (docId) => {
    try {
      const { data: lockedDocs, error: lockErr } = await supabase
        .from('reception_docs')
        .update({ status: 'in-progress' })
        .eq('id', docId)
        .neq('status', 'completed')
        .neq('status', 'in-progress')
        .select()

      if (lockErr) throw new Error('Помилка блокування документа: ' + lockErr.message)
      if (!lockedDocs || lockedDocs.length === 0) {
        console.warn('Document already being processed or completed:', docId)
        return
      }

      const doc = lockedDocs[0]
      const targetWarehouse = doc.target_warehouse || 'production'
      const sourceWarehouse = doc.source_warehouse || null
      const items = doc.items || []

      if (items.length === 0) {
        await supabase.from('reception_docs').update({ status: 'completed' }).eq('id', docId)
        fetchData()
        return
      }

      const nomIds = items.map(it => it.nomenclature_id).filter(Boolean)
      const names = items.map(it => it.name || it.reqDetails || it.details || '').filter(Boolean)

      const buildInventoryQuery = (wh) => {
        let q = supabase.from('inventory').select('*').eq('warehouse', wh)
        const filters = []
        if (nomIds.length > 0) filters.push(`nomenclature_id.in.(${nomIds.join(',')})`)
        if (names.length > 0) {
          const escapedNames = names.map(n => n.replace(/"/g, '""'))
          filters.push(`name.in.("${escapedNames.join('","')}")`)
        }
        if (filters.length > 0) q = q.or(filters.join(','))
        return q
      }

      const { data: targetInv, error: tInvErr } = await buildInventoryQuery(targetWarehouse)
      if (tInvErr) throw tInvErr

      let sourceInv = []
      if (sourceWarehouse) {
        const { data: sInvData, error: sInvErr } = await buildInventoryQuery(sourceWarehouse)
        if (sInvErr) throw sInvErr
        sourceInv = sInvData || []
      }

      const updatesMap = new Map()
      const insertsMap = new Map()

      for (const it of items) {
        const qtyToAdd = Number(it.qty ?? it.missingAmount ?? it.quantity ?? it.needed ?? 0)
        if (isNaN(qtyToAdd) || qtyToAdd <= 0) continue

        const nomId = it.nomenclature_id
        const itemName = it.name || it.reqDetails || it.details || ''

        let matches = []
        if (nomId) {
          matches = (targetInv || []).filter(i => String(i.nomenclature_id) === String(nomId))
        }
        if (matches.length === 0 && itemName) {
          matches = (targetInv || []).filter(i => normalize(i.name) === normalize(itemName))
        }

        let existing = null
        if (matches.length > 0) {
          existing = matches.sort((a, b) => (Number(b.total_qty) || 0) - (Number(a.total_qty) || 0))[0]
        }

        if (existing) {
          const currentUpdate = updatesMap.get(existing.id) || { ...existing }
          currentUpdate.total_qty = (Number(currentUpdate.total_qty) || 0) + qtyToAdd
          updatesMap.set(existing.id, currentUpdate)
          existing.total_qty = currentUpdate.total_qty
        } else {
          const nom = nomId ? nomenclatures.find(n => n.id === nomId) : null
          const baseName = nom?.name || itemName || 'Прийнята позиція'
          const fullItemName = nom ? `${baseName}${nom.material_type ? ` (${nom.material_type})` : ''}` : baseName
          const insertKey = `${nomId || ''}_${normalize(fullItemName)}`
          const currentInsert = insertsMap.get(insertKey) || {
            nomenclature_id: nomId, name: fullItemName, total_qty: 0, reserved_qty: 0,
            type: nom?.type || 'raw', warehouse: targetWarehouse, unit: nom?.unit || 'шт'
          }
          currentInsert.total_qty += qtyToAdd
          insertsMap.set(insertKey, currentInsert)
        }

        if (sourceWarehouse) {
          let srcItem = sourceInv.find(i =>
            (nomId && String(i.nomenclature_id) === String(nomId)) ||
            (itemName && normalize(i.name) === normalize(itemName)) ||
            (it.inventory_id && String(i.id) === String(it.inventory_id))
          )
          if (srcItem) {
            const currentUpdate = updatesMap.get(srcItem.id) || { ...srcItem }
            currentUpdate.total_qty = Math.max(0, (Number(currentUpdate.total_qty) || 0) - qtyToAdd)
            currentUpdate.reserved_qty = Math.max(0, (Number(currentUpdate.reserved_qty) || 0) - qtyToAdd)
            updatesMap.set(srcItem.id, currentUpdate)
            srcItem.total_qty = currentUpdate.total_qty
            srcItem.reserved_qty = currentUpdate.reserved_qty
          }
        }
      }

      const finalUpdates = Array.from(updatesMap.values())
      const finalInserts = Array.from(insertsMap.values())

      if (finalUpdates.length > 0) {
        const { error: upErr } = await supabase.from('inventory').upsert(finalUpdates)
        if (upErr) throw upErr
      }
      if (finalInserts.length > 0) {
        const { error: insErr } = await supabase.from('inventory').insert(finalInserts)
        if (insErr) throw insErr
      }

      const { error: docFinalErr } = await supabase.from('reception_docs').update({ status: 'completed' }).eq('id', docId)
      if (docFinalErr) throw docFinalErr

      if (doc.task_id || doc.order_id) {
        let destWhToComplete = ''
        if (targetWarehouse === 'production') destWhToComplete = 'procurement'
        if (targetWarehouse === 'operational') destWhToComplete = 'production'
        if (destWhToComplete) {
          let q = supabase.from('purchase_requests').update({ status: 'completed' }).eq('destination_warehouse', destWhToComplete)
          if (doc.task_id) q = q.eq('task_id', doc.task_id)
          else q = q.eq('order_id', doc.order_id)
          await q
        }
      }

      refreshTable('inventory')
      refreshTable('reception_docs')
      refreshTable('purchase_requests')
      alert('Прийомку успішно завершено! Склад оновлено.')
    } catch (err) {
      console.error('CRITICAL: confirmReception crash:', err)
      await supabase.from('reception_docs').update({ status: 'shipped' }).eq('id', docId).neq('status', 'completed')
      alert('Помилка прийомки: ' + (err.message || 'Невідома помилка'))
    }
  }

  // ── MATERIAL ISSUANCE ──────────────────────────────────────────────────────

  const issueMaterials = async (requestId) => {
    const req = requests.find(r => r.id === requestId)
    if (!req) return
    let parsedName = ''
    try { parsedName = req.details?.split(': ')[1]?.split(' — ')[0]?.trim() } catch (e) {}
    const invItem = inventory.find(i =>
      i.id === req.inventory_id ||
      (req.nomenclature_id && String(i.nomenclature_id) === String(req.nomenclature_id)) ||
      (parsedName && normalize(i.name) === normalize(parsedName))
    )
    if (invItem) {
      await supabase.from('inventory').update({ reserved_qty: (Number(invItem.reserved_qty) || 0) + Number(req.quantity) }).eq('id', invItem.id)
      await supabase.from('material_requests').update({ status: 'issued', inventory_id: invItem.id }).eq('id', requestId)
    } else {
      await supabase.from('material_requests').update({ status: 'issued' }).eq('id', requestId)
    }
  }

  const issueMaterialsBatch = async (requestIds, taskId = null) => {
    try {
      const relevantRequests = (requests || []).filter(r => requestIds.includes(r.id))
      const inventoryUpdateMap = {}
      const requestUpdateList = []

      relevantRequests.forEach(req => {
        if (req.status === 'issued') return
        let parsedName = ''
        try { parsedName = req.details?.split(': ')[1]?.split(' — ')[0]?.trim() } catch (e) {}
        const isSgpItem = parsedName?.toLowerCase().startsWith('іп-') ||
          (req.nomenclature_id && nomenclatures.find(n => String(n.id) === String(req.nomenclature_id))?.type === 'part')

        let invItem = inventory.find(i => {
          const baseMatch = String(i.id) === String(req.inventory_id) ||
            (req.nomenclature_id && String(i.nomenclature_id) === String(req.nomenclature_id)) ||
            (parsedName && normalize(i.name) === normalize(parsedName))
          if (!baseMatch) return false
          
          if (isSgpItem) {
            return i.type === 'finished' || i.type === 'semi' || i.warehouse === 'sgp'
          } else {
            // Prioritize operational warehouse for raw materials
            return i.warehouse === 'operational' || !i.warehouse
          }
        })

        if (!invItem) {
          invItem = inventory.find(i =>
            String(i.id) === String(req.inventory_id) ||
            (req.nomenclature_id && String(i.nomenclature_id) === String(req.nomenclature_id)) ||
            (parsedName && normalize(i.name) === normalize(parsedName))
          )
        }

        if (invItem) {
          const available = (Number(invItem.total_qty) || 0) - (Number(invItem.reserved_qty) || 0)
          const toReserve = Math.min(available, Number(req.quantity))
          
          if (toReserve > 0) {
            inventoryUpdateMap[invItem.id] = (inventoryUpdateMap[invItem.id] || 0) + toReserve
          }
          requestUpdateList.push({ id: req.id, status: 'issued', inventory_id: invItem.id })
        } else {
          requestUpdateList.push({ id: req.id, status: 'issued' })
        }
      })

      const invPromises = Object.entries(inventoryUpdateMap).map(async ([id, addQty]) => {
        const item = inventory.find(i => String(i.id) === String(id))
        if (!item) return
        return supabase.from('inventory').update({
          reserved_qty: (Number(item.reserved_qty) || 0) + addQty
        }).eq('id', id)
      })

      const reqPromises = requestUpdateList.map(upd =>
        supabase.from('material_requests').update({ status: upd.status, inventory_id: upd.inventory_id }).eq('id', upd.id)
      )

      await Promise.all([...invPromises, ...reqPromises])

      if (taskId) {
        await supabase.from('tasks').update({ warehouse_conf: true }).eq('id', taskId)
      }

      setRequests(prev => prev.map(r => {
        const upd = requestUpdateList.find(u => u.id === r.id)
        if (upd) return { ...r, status: upd.status, inventory_id: upd.inventory_id }
        return r
      }))
      if (taskId) {
        setTasks(prev => prev.map(t => t.id === taskId ? { ...t, warehouse_conf: true } : t))
      }
      fetchData()
    } catch (err) {
      console.error('Batch issue error:', err)
      throw err
    }
  }

  const receiveInventory = async (inventoryId, qty) => {
    const invItem = inventory.find(i => i.id === inventoryId)
    if (!invItem) return
    const { error } = await supabase.from('inventory').update({
      total_qty: (Number(invItem.total_qty) || 0) + Number(qty)
    }).eq('id', inventoryId)
    if (!error) fetchData()
    return { error }
  }

  const fixInventoryTypes = async () => {
    const { error } = await supabase.from('inventory').update({ type: 'wip_bz' }).eq('type', 'bz')
    if (!error) fetchData()
    return { error }
  }




  const deductIssuedMaterialsForTask = async (taskId) => {
    try {
      const { data: issuedReqs } = await supabase
        .from('material_requests')
        .select('*')
        .eq('task_id', taskId)
        .eq('status', 'issued')

      if (!issuedReqs || issuedReqs.length === 0) return

      const updates = {}
      for (const req of issuedReqs) {
        if (req.inventory_id) {
          updates[req.inventory_id] = (updates[req.inventory_id] || 0) + Number(req.quantity)
        }
      }

      for (const [invId, qty] of Object.entries(updates)) {
        const { data: item } = await supabase.from('inventory').select('*').eq('id', invId).limit(1).maybeSingle()
        if (item) {
          const nextTotal = Math.max(0, (Number(item.total_qty) || 0) - qty)
          const nextReserved = Math.max(0, (Number(item.reserved_qty) || 0) - qty)
          await supabase.from('inventory').update({ 
            total_qty: nextTotal, 
            reserved_qty: nextReserved 
          }).eq('id', invId)
        }
      }

      await supabase.from('material_requests').update({ status: 'completed' }).eq('task_id', taskId).eq('status', 'issued')
    } catch (e) {
      console.error("Error deducting materials for task:", e)
    }
  }



  const submitPickingRequest = async (orderId, requiredItems, taskId = null) => {
    const order = orders.find(o => o.id === orderId)
    const task = (tasks || []).find(t => t.id === taskId)
    const batchSuffix = task?.batch_index ? `/${task.batch_index}` : ''
    const requestsToInsert = []

    for (const item of requiredItems) {
      const nomId = item.nomId || item.nomenclature_id
      const neededQty = Number(item.qty) || 0

      requestsToInsert.push({
        order_id: orderId,
        task_id: taskId,
        nomenclature_id: nomId,
        quantity: neededQty,
        status: 'pending',
        inventory_id: null,
        details: `ЗАПИТ НА КОМПЛЕКТУВАННЯ (${order?.order_num || ''}${batchSuffix}): ${item.name} — ${neededQty} шт.`
      })
    }

    if (requestsToInsert.length > 0) {
      const { error } = await supabase.from('material_requests').insert(requestsToInsert)
      if (error) console.error("Picking Request Error:", error)
      fetchData()
    }
  }


  


  return {
    deductIssuedMaterialsForTask, submitPickingRequest,
    createPurchaseRequest, updatePurchaseRequestStatus, convertRequestToOrder,
    createReceptionDoc, sendDocToWarehouse, confirmReception,
    issueMaterials, issueMaterialsBatch, receiveInventory, fixInventoryTypes,
    
  }
}
