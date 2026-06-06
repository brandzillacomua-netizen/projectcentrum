import { supabase } from '../supabase'

/**
 * Warehouse / Supply chain actions
 * Returns all purchase request, reception doc, and inventory actions
 */
export function createWarehouseActions({
  inventory, nomenclatures, requests, tasks, orders,
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
    if (!error) refreshTable('purchase_requests')
    return { error }
  }

  const updatePurchaseRequestStatus = async (id, status, destWarehouse = 'production') => {
    const { error } = await supabase.from('purchase_requests')
      .update({ status, destination_warehouse: destWarehouse }).eq('id', id)
    if (!error) refreshTable('purchase_requests')
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
        const items = requestData.items || []
        const nomIds = items.map(it => it.nomenclature_id).filter(Boolean)
        const names = items.map(it => it.name || it.details || '').filter(Boolean)
        const orFilters = []
        if (nomIds.length > 0) {
          orFilters.push(`nomenclature_id.in.(${nomIds.join(',')})`)
        }
        if (names.length > 0) {
          const escapedNames = names.map(n => `"${n.replace(/"/g, '""')}"`).join(',')
          orFilters.push(`name.in.(${escapedNames})`)
        }

        let query = supabase.from('inventory').select('id,nomenclature_id,name,reserved_qty,total_qty').eq('warehouse', sourceWH)
        if (orFilters.length > 0) {
          query = query.or(orFilters.join(','))
        }

        const { data: invData } = await query
        const inv = invData || []

        // Collect all updates, then run in parallel
        const reserveUpdates = []
        for (const it of items) {
          const qty = Number(it.qty ?? it.quantity ?? it.needed ?? 0)
          if (qty <= 0) continue

          const nomId = it.nomenclature_id
          const itemName = it.name || it.details || ''

          let matches = []
          if (nomId) matches = inv.filter(i => String(i.nomenclature_id) === String(nomId))
          if (matches.length === 0 && itemName) {
            matches = inv.filter(i => i.name && i.name.toLowerCase().trim() === itemName.toLowerCase().trim())
          }

          if (matches.length > 0) {
            const best = matches.sort((a, b) => (Number(b.total_qty) || 0) - (Number(a.total_qty) || 0))[0]
            reserveUpdates.push(
              supabase.from('inventory').update({
                reserved_qty: (Number(best.reserved_qty) || 0) + qty
              }).eq('id', best.id)
            )
          }
        }
        if (reserveUpdates.length > 0) await Promise.all(reserveUpdates)
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

    refreshTable('purchase_requests')
    refreshTable('inventory')
    refreshTable('reception_docs')
    return { success: true }
  }

  // ── RECEPTION DOCS ─────────────────────────────────────────────────────────

  const createReceptionDoc = async (items, status = 'pending', orderId = null, taskId = null, targetWH = null, sourceWH = null) => {
    const { data, error } = await supabase.from('reception_docs').insert([{
      items, status, order_id: orderId, task_id: taskId,
      target_warehouse: targetWH, source_warehouse: sourceWH,
      created_at: new Date().toISOString()
    }]).select()
    if (!error) refreshTable('reception_docs')
    return { data: (data && data.length > 0) ? data[0] : null, error }
  }

  const sendDocToWarehouse = async (docId, newTarget = null, newSource = null) => {
    const updateData = { status: 'shipped' }
    if (newTarget) updateData.target_warehouse = newTarget
    if (newSource) updateData.source_warehouse = newSource
    
    const { error } = await supabase.from('reception_docs').update(updateData).eq('id', docId)
    if (!error) refreshTable('reception_docs')
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
        refreshTable('reception_docs')
        return
      }

      // ── Fetch both warehouse inventories IN PARALLEL, only needed columns ──
      const nomIds = items.map(it => it.nomenclature_id).filter(Boolean)
      const names = items.map(it => it.name || it.reqDetails || it.details || '').filter(Boolean)
      const orFilters = []
      if (nomIds.length > 0) {
        orFilters.push(`nomenclature_id.in.(${nomIds.join(',')})`)
      }
      if (names.length > 0) {
        const escapedNames = names.map(n => `"${n.replace(/"/g, '""')}"`).join(',')
        orFilters.push(`name.in.(${escapedNames})`)
      }

      let targetQuery = supabase.from('inventory')
        .select('id,nomenclature_id,name,type,total_qty,reserved_qty,unit,warehouse')
        .eq('warehouse', targetWarehouse)
      
      let sourceQuery = Promise.resolve({ data: [] })

      if (orFilters.length > 0) {
        targetQuery = targetQuery.or(orFilters.join(','))
        if (sourceWarehouse) {
          sourceQuery = supabase.from('inventory')
            .select('id,nomenclature_id,name,type,total_qty,reserved_qty,unit,warehouse')
            .eq('warehouse', sourceWarehouse)
            .or(orFilters.join(','))
        }
      } else {
        if (sourceWarehouse) {
          sourceQuery = supabase.from('inventory')
            .select('id,nomenclature_id,name,type,total_qty,reserved_qty,unit,warehouse')
            .eq('warehouse', sourceWarehouse)
        }
      }

      const [targetResult, sourceResult] = await Promise.all([
        targetQuery,
        sourceQuery
      ])

      if (targetResult.error) throw targetResult.error
      const targetInv = targetResult.data || []
      const sourceInv = sourceResult.data || []

      const updatesMap = new Map()
      const insertsMap = new Map()

      for (const it of items) {
        const qtyToAdd = Number(it.qty ?? it.missingAmount ?? it.quantity ?? it.needed ?? 0)
        if (isNaN(qtyToAdd) || qtyToAdd <= 0) continue

        const nomId = it.nomenclature_id
        const itemName = it.name || it.reqDetails || it.details || ''

        // Match by nomenclature_id first, then by normalized name
        let matches = []
        if (nomId) {
          matches = targetInv.filter(i => String(i.nomenclature_id) === String(nomId))
        }
        if (matches.length === 0 && itemName) {
          matches = targetInv.filter(i => normalize(i.name) === normalize(itemName))
        }
        // Last resort: exact name match (catches cases where normalize differs)
        if (matches.length === 0 && itemName) {
          matches = targetInv.filter(i => i.name === itemName)
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

      // Map helper to sanitize units
      const sanitizeUnit = (item) => {
        if (item.unit) return item.unit
        const nom = item.nomenclature_id ? nomenclatures.find(n => n.id === item.nomenclature_id) : null
        return nom?.unit || 'шт'
      }

      const finalUpdatesRaw = Array.from(updatesMap.values())
      let finalInsertsRaw = Array.from(insertsMap.values())

      // ── Safety: filter out inserts whose name already exists in targetInv ──
      // (covers edge cases where client-side matching was insufficient)
      finalInsertsRaw = finalInsertsRaw.filter(ins => {
        const clash = targetInv.find(e => e.name === ins.name && e.warehouse === ins.warehouse)
        if (clash) {
          // Merge into finalUpdatesRaw
          const existingUpd = finalUpdatesRaw.find(u => u.id === clash.id)
          if (existingUpd) {
            existingUpd.total_qty = (Number(existingUpd.total_qty) || 0) + (Number(ins.total_qty) || 0)
          } else {
            finalUpdatesRaw.push({ ...clash, total_qty: (Number(clash.total_qty) || 0) + (Number(ins.total_qty) || 0) })
          }
          return false
        }
        return true
      })

      const finalUpdates = finalUpdatesRaw.map(u => ({ ...u, unit: sanitizeUnit(u) }))
      const finalInserts = finalInsertsRaw.map(ins => ({ ...ins, unit: sanitizeUnit(ins) }))

      // ── Run all DB writes in parallel ──
      const writeOps = []
      if (finalUpdates.length > 0) writeOps.push(supabase.from('inventory').upsert(finalUpdates))
      if (finalInserts.length > 0) writeOps.push(supabase.from('inventory').insert(finalInserts))
      writeOps.push(supabase.from('reception_docs').update({ status: 'completed' }).eq('id', docId))

      const results = await Promise.all(writeOps)
      for (const r of results) {
        if (r.error) throw r.error
      }

      refreshTable('inventory')
      refreshTable('reception_docs')

      if (doc.task_id || doc.order_id) {
        let destWhToComplete = ''
        if (targetWarehouse === 'production') destWhToComplete = 'procurement'
        if (targetWarehouse === 'operational') destWhToComplete = 'production'
        if (destWhToComplete) {
          let q = supabase.from('purchase_requests').update({ status: 'completed' }).eq('destination_warehouse', destWhToComplete)
          if (doc.task_id) q = q.eq('task_id', doc.task_id)
          else q = q.eq('order_id', doc.order_id)
          q.then(() => {
            refreshTable('purchase_requests')
          }).catch(err => {
            console.error('Error updating purchase requests in background:', err)
          })
        }
      }
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

    const orFilters = []
    if (req.inventory_id) {
      orFilters.push(`id.eq.${req.inventory_id}`)
    }
    if (req.nomenclature_id) {
      orFilters.push(`nomenclature_id.eq.${req.nomenclature_id}`)
    }
    if (parsedName) {
      const escapedParsedName = `"${parsedName.replace(/"/g, '""')}"`
      orFilters.push(`name.eq.${escapedParsedName}`)
      const prepName = `${parsedName} [підготовлений]`
      orFilters.push(`name.eq."${prepName.replace(/"/g, '""')}"`)
    }

    let matchedInventory = []
    if (orFilters.length > 0) {
      const { data, error } = await supabase.from('inventory')
        .select('*')
        .or(orFilters.join(','))
      if (!error && data) {
        matchedInventory = data
      }
    }

    const invItem = matchedInventory.find(i => {
      if (i.id === req.inventory_id) return true
      if (req.nomenclature_id && String(i.nomenclature_id) === String(req.nomenclature_id)) return true
      if (parsedName) {
        const normName = normalize(i.name)
        const normParsed = normalize(parsedName)
        if (normName === normParsed) return true
        if (normName.includes('[підготовлений]') && normName.replace(' [підготовлений]', '').replace('[підготовлений]', '').trim() === normParsed) return true
        const normNameNoParens = normalize(i.name.replace(/\s*\([^)]*\)$/, ''))
        if (normNameNoParens === normParsed) return true
      }
      return false
    })

    if (invItem) {
      await supabase.from('inventory').update({ reserved_qty: (Number(invItem.reserved_qty) || 0) + Number(req.quantity) }).eq('id', invItem.id)
      await supabase.from('material_requests').update({ status: 'issued', inventory_id: invItem.id }).eq('id', requestId)
    } else {
      await supabase.from('material_requests').update({ status: 'issued' }).eq('id', requestId)
    }

    try {
      const taskIdToCheck = req.task_id
      if (taskIdToCheck) {
        const { data: pendingReqs } = await supabase
          .from('material_requests')
          .select('id')
          .eq('task_id', taskIdToCheck)
          .eq('status', 'pending')
        
         if (!pendingReqs || pendingReqs.length === 0) {
          await supabase
            .from('work_cards')
            .update({ status: 'new' })
            .eq('task_id', taskIdToCheck)
            .eq('status', 'waiting-materials')
        }
      }
    } catch (err) {
      console.error('Error updating work cards after material issuance:', err)
    }
  }

  const issueMaterialsBatch = async (requestIds, taskId = null) => {
    try {
      const relevantRequests = (requests || []).filter(r => requestIds.includes(r.id))
      const orFilters = []
      
      relevantRequests.forEach(req => {
        if (req.status === 'issued') return
        let parsedName = ''
        try { parsedName = req.details?.split(': ')[1]?.split(' — ')[0]?.trim() } catch (e) {}
        
        if (req.inventory_id) {
          orFilters.push(`id.eq.${req.inventory_id}`)
        }
        if (req.nomenclature_id) {
          orFilters.push(`nomenclature_id.eq.${req.nomenclature_id}`)
        }
        if (parsedName) {
          const escapedParsedName = `"${parsedName.replace(/"/g, '""')}"`
          orFilters.push(`name.eq.${escapedParsedName}`)
          const prepName = `${parsedName} [підготовлений]`
          orFilters.push(`name.eq."${prepName.replace(/"/g, '""')}"`)
        }
      })

      let matchedInventory = []
      if (orFilters.length > 0) {
        const { data, error } = await supabase.from('inventory')
          .select('*')
          .or(orFilters.join(','))
        if (error) throw error
        matchedInventory = data || []
      }

      const inventoryUpdateMap = {}
      const requestUpdateList = []

      relevantRequests.forEach(req => {
        if (req.status === 'issued') return
        let parsedName = ''
        try { parsedName = req.details?.split(': ')[1]?.split(' — ')[0]?.trim() } catch (e) {}
        const isSgpItem = (
          parsedName?.toLowerCase().startsWith('іп-') ||
          parsedName?.toLowerCase().startsWith('ip-') ||
          parsedName?.toLowerCase().startsWith('kr-') ||
          parsedName?.toLowerCase().startsWith('kh-') ||
          (parsedName?.toLowerCase().includes('іп') && !parsedName?.toLowerCase().includes('кріплення') && !parsedName?.toLowerCase().includes('друк') && !parsedName?.toLowerCase().includes('3д')) ||
          parsedName?.toLowerCase().includes('ip') ||
          (req.nomenclature_id && (() => {
            const t = nomenclatures.find(n => String(n.id) === String(req.nomenclature_id))?.type
            return t === 'part' || t === 'product'
          })())
        )
        const isPrepRequest = (req.details && (req.details.includes('ПІДГОТОВ') || req.details.includes('подготов'))) || 
          (parsedName && (parsedName.includes('[Непідготовлений]') || parsedName.includes('[неподготовленный]')))

        let invItem = matchedInventory.find(i => {
          const baseMatch = String(i.id) === String(req.inventory_id) ||
            (req.nomenclature_id && String(i.nomenclature_id) === String(req.nomenclature_id)) ||
            (parsedName && (
              normalize(i.name) === normalize(parsedName) ||
              (normalize(i.name).includes('[підготовлений]') && normalize(i.name).replace(' [підготовлений]', '').replace('[підготовлений]', '').trim() === normalize(parsedName)) ||
              normalize(i.name.replace(/\s*\([^)]*\)$/, '')) === normalize(parsedName)
            ))
          if (!baseMatch) return false
          
          if (isSgpItem) {
            return i.type === 'finished' || i.type === 'semi' || i.warehouse === 'sgp'
          } else if (isPrepRequest) {
            return i.warehouse === 'production'
          } else {
            // Prioritize operational warehouse for raw materials
            return i.warehouse === 'operational' || !i.warehouse
          }
        })

        if (!invItem) {
          invItem = matchedInventory.find(i => {
            if (String(i.id) === String(req.inventory_id)) return true
            if (req.nomenclature_id && String(i.nomenclature_id) === String(req.nomenclature_id)) return true
            if (parsedName) {
              const normName = normalize(i.name)
              const normParsed = normalize(parsedName)
              if (normName === normParsed) return true
              if (normName.includes('[підготовлений]') && normName.replace(' [підготовлений]', '').replace('[підготовлений]', '').trim() === normParsed) return true
            }
            return false
          })
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

      const invUpdates = Object.entries(inventoryUpdateMap).map(([id, addQty]) => {
        const item = matchedInventory.find(i => String(i.id) === String(id))
        if (!item) return null
        return {
          ...item,
          reserved_qty: (Number(item.reserved_qty) || 0) + addQty
        }
      }).filter(Boolean)

      const invPromises = invUpdates.length > 0
        ? [supabase.from('inventory').upsert(invUpdates)]
        : []

      const reqPromises = requestUpdateList.length > 0
        ? [supabase.from('material_requests').upsert(requestUpdateList.map(upd => ({
            id: upd.id,
            status: upd.status,
            inventory_id: upd.inventory_id
          })))]
        : []

      await Promise.all([...invPromises, ...reqPromises])

      // Auto-transition work cards for any task whose material requests are fully issued
      const uniqueTaskIds = [...new Set(relevantRequests.map(r => r.task_id).filter(Boolean))]
      if (uniqueTaskIds.length > 0) {
        try {
          const { data: allPending } = await supabase
            .from('material_requests')
            .select('id, task_id')
            .in('task_id', uniqueTaskIds)
            .eq('status', 'pending')

          const pendingTaskIds = new Set((allPending || []).map(r => r.task_id))
          const tasksToUpdate = uniqueTaskIds.filter(tId => !pendingTaskIds.has(tId))

          if (tasksToUpdate.length > 0) {
            await Promise.all(tasksToUpdate.map(tId =>
              supabase
                .from('work_cards')
                .update({ status: 'new' })
                .eq('task_id', tId)
                .eq('status', 'waiting-materials')
            ))
          }
        } catch (err) {
          console.error('Error updating work cards for tasks in batch:', err)
        }
      }

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
      refreshTable('inventory')
      refreshTable('material_requests')
      refreshTable('work_cards')
    } catch (err) {
      console.error('Batch issue error:', err)
      throw err
    }
  }

  const receiveInventory = async (inventoryId, qty) => {
    try {
      const { data: items, error: fetchErr } = await supabase
        .from('inventory')
        .select('total_qty')
        .eq('id', inventoryId)
      if (fetchErr || !items || items.length === 0) return { error: fetchErr || 'Item not found' }
      
      const invItem = items[0]
      const { error } = await supabase.from('inventory').update({
        total_qty: (Number(invItem.total_qty) || 0) + Number(qty)
      }).eq('id', inventoryId)
      if (!error) refreshTable('inventory')
      return { error }
    } catch (err) {
      console.error('receiveInventory error:', err)
      return { error: err }
    }
  }

  const fixInventoryTypes = async () => {
    const { error } = await supabase.from('inventory').update({ type: 'wip_bz' }).eq('type', 'bz')
    if (!error) refreshTable('inventory')
    return { error }
  }

  const deductIssuedMaterialsForTask = async (taskId) => {
    try {
      const { data: issuedReqs } = await supabase
        .from('material_requests')
        .select('inventory_id, quantity')
        .eq('task_id', taskId)
        .eq('status', 'issued')

      if (!issuedReqs || issuedReqs.length === 0) return

      // Aggregate deductions per inventory item in memory
      const deductionMap = {}
      for (const req of issuedReqs) {
        if (req.inventory_id) {
          deductionMap[req.inventory_id] = (deductionMap[req.inventory_id] || 0) + Number(req.quantity)
        }
      }

      const ids = Object.keys(deductionMap)
      if (ids.length === 0) return

      // Single batch SELECT instead of N individual selects
      const { data: items } = await supabase
        .from('inventory')
        .select('*')
        .in('id', ids)

      if (!items || items.length === 0) return

      // Compute all new values in memory, then single upsert
      const updates = items.map(item => ({
        ...item,
        total_qty: Math.max(0, (Number(item.total_qty) || 0) - (deductionMap[item.id] || 0)),
        reserved_qty: Math.max(0, (Number(item.reserved_qty) || 0) - (deductionMap[item.id] || 0))
      }))

      await Promise.all([
        supabase.from('inventory').upsert(updates),
        supabase.from('material_requests').update({ status: 'completed' }).eq('task_id', taskId).eq('status', 'issued')
      ])
    } catch (e) {
      console.error('Error deducting materials for task:', e)
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
        details: `ЗАПИТ НА КОМПЛЕКТУВАННЯ (СГП) (${order?.order_num || ''}${batchSuffix}): ${item.name} — ${neededQty} шт.`
      })
    }

    if (requestsToInsert.length > 0) {
      const { error } = await supabase.from('material_requests').insert(requestsToInsert)
      if (error) console.error("Picking Request Error:", error)
      refreshTable('material_requests')
    }
  }

  return {
    deductIssuedMaterialsForTask, submitPickingRequest,
    createPurchaseRequest, updatePurchaseRequestStatus, convertRequestToOrder,
    createReceptionDoc, sendDocToWarehouse, confirmReception,
    issueMaterials, issueMaterialsBatch, receiveInventory, fixInventoryTypes,
    
  }
}
