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
    if (error) throw error
    refreshTable('purchase_requests')
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
    const appliedReserveUpdates = []
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
            const previousReserved = Number(best.reserved_qty) || 0
            // Never let a retry inflate reserve above the physical stock.
            const nextReserved = Math.min(Number(best.total_qty) || 0, previousReserved + qty)
            if (nextReserved > previousReserved) {
              appliedReserveUpdates.push({ id: best.id, previousReserved })
              reserveUpdates.push(
                supabase.from('inventory').update({ reserved_qty: nextReserved }).eq('id', best.id)
              )
            }
          }
        }
        if (reserveUpdates.length > 0) {
          const reserveResults = await Promise.all(reserveUpdates)
          const reserveError = reserveResults.find(result => result.error)?.error
          if (reserveError) throw reserveError
        }
      } catch (err) {
        console.error('Error reserving items during transfer:', err)
        await supabase.from('purchase_requests').update({ status: 'accepted' }).eq('id', requestId)
        return { error: err }
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
      // Reservation and reception document form one logical operation.
      // If the document could not be created, restore every reserve changed above.
      if (appliedReserveUpdates.length > 0) {
        await Promise.all(appliedReserveUpdates.map(update =>
          supabase.from('inventory')
            .update({ reserved_qty: update.previousReserved })
            .eq('id', update.id)
        ))
      }
      await supabase.from('purchase_requests').update({ status: 'accepted' }).eq('id', requestId)
      return { error: recError }
    }

    refreshTable('purchase_requests')
    refreshTable('inventory')
    refreshTable('reception_docs')
    return { success: true }
  }

  // ── RECEPTION DOCS ─────────────────────────────────────────────────────────

  const createReceptionDoc = async (items, status = 'pending', orderId = null, taskId = null, targetWH = null, sourceWH = null, pocketOwner = null) => {
    const { data, error } = await supabase.from('reception_docs').insert([{
      items, status, order_id: orderId, task_id: taskId,
      target_warehouse: targetWH, source_warehouse: sourceWH,
      pocket_owner: pocketOwner,
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

  const confirmReception = async (docId, options = {}) => {
    try {
      const receptionOptions = options && typeof options === 'object' ? options : {}
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
      const actualItems = Array.isArray(receptionOptions.actualItems) ? receptionOptions.actualItems : []
      const actualByIndex = new Map(actualItems.map((actual, index) => [Number(actual.index ?? index), actual]))
      const getExpectedQty = (item) => Number(item.expected_qty ?? item.qty ?? item.missingAmount ?? item.quantity ?? item.needed ?? 0) || 0
      const getActualQty = (item, index) => {
        const actual = actualByIndex.get(index)
        if (!actual) return getExpectedQty(item)
        const qty = Number(actual.actual_qty ?? actual.qty ?? actual.received_qty ?? 0)
        return Number.isFinite(qty) ? Math.max(0, qty) : 0
      }
      const actNum = `ACT-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(docId).slice(0, 6).toUpperCase()}`
      const completedItems = items.map((item, index) => {
        const expectedQty = getExpectedQty(item)
        const actualQty = getActualQty(item, index)
        const discrepancyQty = actualQty - expectedQty
        const actualMeta = actualByIndex.get(index) || {}
        return {
          ...item,
          expected_qty: expectedQty,
          actual_qty: actualQty,
          accepted_qty: actualQty,
          discrepancy_qty: discrepancyQty,
          discrepancy_type: discrepancyQty < 0 ? 'shortage' : (discrepancyQty > 0 ? 'surplus' : 'matched'),
          discrepancy_note: actualMeta.note || '',
          discrepancy_act: discrepancyQty !== 0 ? {
            act_num: actNum,
            created_at: new Date().toISOString(),
            target_warehouse: targetWarehouse,
            source_warehouse: sourceWarehouse,
            expected_qty: expectedQty,
            actual_qty: actualQty,
            discrepancy_qty: discrepancyQty,
            reason: actualMeta.note || receptionOptions.note || 'Фактична кількість не збігається з документом прийомки'
          } : null
        }
      })

      if (items.length === 0) {
        await supabase.from('reception_docs').update({ status: 'completed' }).eq('id', docId)
        refreshTable('reception_docs')
        return
      }

      // ── Fetch both warehouse inventories IN PARALLEL, only needed columns ──
      const nomIds = completedItems.map(it => it.nomenclature_id).filter(Boolean)
      const names = completedItems.map(it => it.name || it.reqDetails || it.details || '').filter(Boolean)
      const orFilters = []
      if (nomIds.length > 0) {
        orFilters.push(`nomenclature_id.in.(${nomIds.join(',')})`)
      }
      if (names.length > 0) {
        const escapedNames = names.map(n => `"${n.replace(/"/g, '""')}"`).join(',')
        orFilters.push(`name.in.(${escapedNames})`)
      }

      let targetQuery = supabase.from('inventory')
        .select('id,nomenclature_id,name,type,total_qty,reserved_qty,unit,warehouse,pocket_owner')
        .eq('warehouse', targetWarehouse)
      if (targetWarehouse === 'pocket' && doc.pocket_owner) {
        targetQuery = targetQuery.eq('pocket_owner', doc.pocket_owner)
      }
      
      let sourceQuery = Promise.resolve({ data: [] })

      if (orFilters.length > 0) {
        targetQuery = targetQuery.or(orFilters.join(','))
        if (sourceWarehouse) {
          sourceQuery = supabase.from('inventory')
            .select('id,nomenclature_id,name,type,total_qty,reserved_qty,unit,warehouse,pocket_owner')
            .eq('warehouse', sourceWarehouse)
          if (sourceWarehouse === 'pocket' && doc.pocket_owner) {
            sourceQuery = sourceQuery.eq('pocket_owner', doc.pocket_owner)
          }
          sourceQuery = sourceQuery.or(orFilters.join(','))
        }
      } else {
        if (sourceWarehouse) {
          sourceQuery = supabase.from('inventory')
            .select('id,nomenclature_id,name,type,total_qty,reserved_qty,unit,warehouse,pocket_owner')
            .eq('warehouse', sourceWarehouse)
          if (sourceWarehouse === 'pocket' && doc.pocket_owner) {
            sourceQuery = sourceQuery.eq('pocket_owner', doc.pocket_owner)
          }
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

      for (const it of completedItems) {
        const qtyToAdd = Number(it.actual_qty ?? it.accepted_qty ?? it.qty ?? it.missingAmount ?? it.quantity ?? it.needed ?? 0)
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
            type: nom?.type || 'raw', warehouse: targetWarehouse, unit: nom?.unit || 'шт',
            pocket_owner: targetWarehouse === 'pocket' ? doc.pocket_owner : null
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
      writeOps.push(supabase.from('reception_docs').update({ status: 'completed', items: completedItems }).eq('id', docId))

      const results = await Promise.all(writeOps)
      for (const r of results) {
        if (r.error) throw r.error
      }

       // In-memory point-by-point update to inventory state to prevent refetching 3000 rows
      if (finalUpdates.length > 0) {
        setInventory(prev => prev.map(item => {
          const upd = finalUpdates.find(u => u.id === item.id)
          return upd ? { ...item, ...upd } : item
        }))
      }
      if (finalInserts.length > 0) {
        setInventory(prev => {
          const next = [...prev]
          finalInserts.forEach(ins => {
            if (!next.some(item => item.id === ins.id)) next.push(ins)
          })
          return next
        })
      }

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
      const wildcardName = `"${parsedName.replace(/"/g, '""')}%"`
      orFilters.push(`name.ilike.${wildcardName}`)
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

    const matchingItems = matchedInventory.filter(i => {
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

    const invItem = matchingItems.sort((a, b) => {
      const availA = (Number(a.total_qty) || 0) - (Number(a.reserved_qty) || 0)
      const availB = (Number(b.total_qty) || 0) - (Number(b.reserved_qty) || 0)
      return availB - availA
    })[0]

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
      // Always read the rows that are about to be issued from the database.
      // A partial issue inserts a new pending remainder; realtime can render that
      // row before the `requests` closure used by this callback is refreshed.
      // In that situation the old implementation silently processed an empty
      // array while the UI still reported success.
      const { data: freshRequests, error: requestsError } = await supabase
        .from('material_requests')
        .select('*')
        .in('id', requestIds)
      if (requestsError) throw requestsError

      const relevantRequests = freshRequests || []
      if (relevantRequests.length === 0) {
        throw new Error('Заявки для видачі не знайдено. Оновіть сторінку та повторіть спробу.')
      }
      const uniqueInventoryIds = new Set()
      const uniqueNomenclatureIds = new Set()
      const uniqueParsedNames = new Set()
      
      relevantRequests.forEach(req => {
        if (req.status === 'issued') return
        let parsedName = ''
        try { parsedName = req.details?.split(': ')[1]?.split(' — ')[0]?.trim() } catch (e) {}
        
        if (req.inventory_id) uniqueInventoryIds.add(req.inventory_id)
        if (req.nomenclature_id) uniqueNomenclatureIds.add(req.nomenclature_id)
        if (parsedName) uniqueParsedNames.add(parsedName)
      })

      const orFilters = []
      if (uniqueInventoryIds.size > 0) {
        orFilters.push(`id.in.(${Array.from(uniqueInventoryIds).join(',')})`)
      }
      if (uniqueNomenclatureIds.size > 0) {
        orFilters.push(`nomenclature_id.in.(${Array.from(uniqueNomenclatureIds).join(',')})`)
      }
      uniqueParsedNames.forEach(parsedName => {
        const escapedParsedName = `"${parsedName.replace(/"/g, '""')}"`
        orFilters.push(`name.eq.${escapedParsedName}`)
        const prepName = `${parsedName} [підготовлений]`
        orFilters.push(`name.eq."${prepName.replace(/"/g, '""')}"`)
        const wildcardName = `"${parsedName.replace(/"/g, '""')}%"`
        orFilters.push(`name.ilike.${wildcardName}`)
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
      const requestsToInsert = []

      relevantRequests.forEach(req => {
        if (req.status === 'issued') return
        let parsedName = ''
        try { parsedName = req.details?.split(': ')[1]?.split(' — ')[0]?.trim() } catch (e) {}
        const packagingSourceMatch = req.details?.match(/\[PACKAGING_SOURCE:(SGP|BZ|SO)\]/)
        const packagingSource = packagingSourceMatch?.[1] || null
        const inferredSgpItem = (
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
        const isSgpItem = packagingSource === 'SGP' || packagingSource === 'BZ' || (!packagingSource && inferredSgpItem)
        const isPrepRequest = (req.details && (req.details.includes('ПІДГОТОВ') || req.details.includes('подготов'))) || 
          (parsedName && (parsedName.includes('[Непідготовлений]') || parsedName.includes('[неподготовленный]')))

        const matches = matchedInventory.filter(i => {
          const baseMatch = String(i.id) === String(req.inventory_id) ||
            (req.nomenclature_id && String(i.nomenclature_id) === String(req.nomenclature_id)) ||
            (parsedName && (
              normalize(i.name) === normalize(parsedName) ||
              (normalize(i.name).includes('[підготовлений]') && normalize(i.name).replace(' [підготовлений]', '').replace('[підготовлений]', '').trim() === normalize(parsedName)) ||
              normalize(i.name.replace(/\s*\([^)]*\)$/, '')) === normalize(parsedName)
            ))
          if (!baseMatch) return false
          
          if (packagingSource === 'SGP') {
            // Planned packaging parts prefer SGP, but the same nomenclature
            // may physically remain in BZ. If SGP has no usable balance, BZ is
            // a valid fallback source.
            return i.warehouse === 'sgp' || i.type === 'finished' || i.type === 'semi' ||
              i.type === 'bz' || i.type === 'wip_bz'
          } else if (packagingSource === 'BZ') {
            return i.type === 'bz' || i.type === 'wip_bz'
          } else if (packagingSource === 'SO') {
            return i.warehouse === 'operational' || !i.warehouse
          } else if (isSgpItem) {
            // Compatibility for old requests without an explicit source marker.
            return i.type === 'finished' || i.type === 'semi' || i.type === 'part' ||
              i.type === 'bz' || i.type === 'wip_bz' || i.warehouse === 'sgp'
          } else if (isPrepRequest) {
            return i.warehouse === 'production'
          } else {
            // Prioritize operational warehouse for raw materials
            return i.warehouse === 'operational' || !i.warehouse
          }
        })

        let invItem = matches.sort((a, b) => {
          const availA = (Number(a.total_qty) || 0) - (Number(a.reserved_qty) || 0)
          const availB = (Number(b.total_qty) || 0) - (Number(b.reserved_qty) || 0)
          const needed = Number(req.quantity) || 0
          // First choose a row that can satisfy the request in full. This lets
          // a stocked BZ row beat an empty SGP placeholder.
          if ((availA >= needed) !== (availB >= needed)) return availB >= needed ? 1 : -1
          return availB - availA
        })[0]

        if (!invItem && !packagingSource) {
          const fallbackMatches = matchedInventory.filter(i => {
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
          invItem = fallbackMatches.sort((a, b) => {
            const availA = (Number(a.total_qty) || 0) - (Number(a.reserved_qty) || 0)
            const availB = (Number(b.total_qty) || 0) - (Number(b.reserved_qty) || 0)
            return availB - availA
          })[0]
        }

        if (invItem) {
          const available = Math.max(0, (Number(invItem.total_qty) || 0) - (Number(invItem.reserved_qty) || 0))
          const needed = Number(req.quantity) || 0
          
          if (available >= needed) {
            // Повне забезпечення
            inventoryUpdateMap[invItem.id] = (inventoryUpdateMap[invItem.id] || 0) + needed
            requestUpdateList.push({ id: req.id, status: 'issued', inventory_id: invItem.id })
          } else if (available > 0) {
            // Часткове забезпечення: розділяємо на два запити (виданий і дефіцитний)
            const shortage = needed - available
            inventoryUpdateMap[invItem.id] = (inventoryUpdateMap[invItem.id] || 0) + available
            
            // 1. Оновлюємо оригінальний запит на кількість, яка є в наявності, і ставимо status: 'issued'
            requestUpdateList.push({ id: req.id, status: 'issued', inventory_id: invItem.id, quantity: available })
            
            // 2. Додаємо новий запит на дефіцит у pending
            requestsToInsert.push({
              order_id: req.order_id,
              task_id: req.task_id,
              nomenclature_id: req.nomenclature_id,
              quantity: shortage,
              status: 'pending',
              details: req.details ? req.details.replace(` — ${needed} шт.`, ` — ${shortage} шт.`) : `Дефіцит: ${shortage} шт.`
            })
          } else {
            // Немає в наявності взагалі — запит залишається в pending
            // Але оскільки комірник його надіслав у пакеті, ми просто ігноруємо його переведення в issued,
            // щоб він чекав на Склад
          }
        } else {
          // Якщо немає зв'язку з інвентарем
          // Підготовлені листи — НЕ видаємо автоматично! Вони чекають поки підготовка їх виготовить.
          const isPreparedSheet = parsedName?.toLowerCase().includes('[підготовлений]') || 
            parsedName?.toLowerCase().includes('[підготовлений]')
          const isSheetItem = parsedName?.toLowerCase().includes('лист')
          
          if (packagingSource) {
            // Explicit packaging requests must remain pending until stock is
            // available in their declared warehouse. Never confirm them from
            // an unrelated warehouse or without an inventory row.
            console.log(`[issueMaterialsBatch] Waiting for ${packagingSource} stock: ${parsedName}`)
          } else if (isPreparedSheet || isSheetItem) {
            // Залишаємо в pending — видача відбудеться коли підготовка передасть листи на СО
            console.log(`[issueMaterialsBatch] Skipping prepared sheet (no inventory): ${parsedName}`)
          } else {
            // Для інших матеріалів без інвентарного запису (СГП тощо) — видаємо як раніше
            requestUpdateList.push({ id: req.id, status: 'issued' })
          }
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

      const reqPromises = []
      if (requestUpdateList.length > 0) {
        reqPromises.push(supabase.from('material_requests').upsert(requestUpdateList.map(upd => {
          const originalReq = relevantRequests.find(r => r.id === upd.id)
          const res = {
            id: upd.id,
            status: upd.status,
            inventory_id: upd.inventory_id,
            quantity: upd.quantity !== undefined ? upd.quantity : (originalReq ? originalReq.quantity : null)
          }
          return res
        })))
      }
      if (requestsToInsert.length > 0) {
        reqPromises.push(supabase.from('material_requests').insert(requestsToInsert))
      }

      const writeResults = await Promise.all([...invPromises, ...reqPromises])
      const writeError = writeResults.find(result => result?.error)?.error
      if (writeError) throw writeError

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
        const { data: updatedReqs } = await supabase
          .from('material_requests')
          .select('status')
          .eq('task_id', taskId)
        
        const reqList = updatedReqs || []
        const allCompletedOrIssued = reqList.length > 0 && reqList.every(r => r.status === 'issued' || r.status === 'completed')
        const someIssued = reqList.some(r => r.status === 'issued' || r.status === 'completed')
        
        const nextWhConf = allCompletedOrIssued ? 'true' : (someIssued ? 'partial' : 'false')
        
        await supabase.from('tasks').update({ warehouse_conf: nextWhConf }).eq('id', taskId)
        setTasks(prev => prev.map(t => t.id === taskId ? { ...t, warehouse_conf: nextWhConf } : t))
      } else {
        if (typeof fetchData === 'function') fetchData(['tasks'])
      }
      // In-memory point-by-point update to inventory state
      if (invUpdates.length > 0) {
        setInventory(prev => prev.map(item => {
          const upd = invUpdates.find(u => u.id === item.id)
          return upd ? { ...item, ...upd } : item
        }))
      }

      // In-memory point-by-point update to requests state
      if (requestUpdateList.length > 0) {
        setRequests(prev => prev.map(req => {
          const upd = requestUpdateList.find(u => u.id === req.id)
          if (upd) {
            const nextStatus = upd.status
            const nextQty = upd.quantity !== undefined ? upd.quantity : req.quantity
            return { ...req, status: nextStatus, quantity: nextQty }
          }
          return req
        }).filter(r => r.status !== 'completed'))
      }

      refreshTable('work_cards')
      refreshTable('material_requests')
      refreshTable('inventory')

      return {
        requestedCount: relevantRequests.filter(r => r.status !== 'issued').length,
        issuedCount: requestUpdateList.length,
        fullyIssued: relevantRequests
          .filter(r => r.status !== 'issued')
          .every(r => requestUpdateList.some(update => update.id === r.id && update.status === 'issued')) &&
          requestsToInsert.length === 0
      }
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

  const deductIssuedMaterialsForTask = async (taskId, options = {}) => {
    try {
      const { data: issuedReqs } = await supabase
        .from('material_requests')
        .select('id, inventory_id, quantity, details')
        .eq('task_id', taskId)
        .eq('status', 'issued')

      const requestsToDeduct = (issuedReqs || []).filter(req => {
        if (!options.packagingOnly) return true
        const details = (req.details || '').toLowerCase()
        return details.includes('запит на комплектування') &&
          !details.includes('лист') &&
          !details.includes('sheet') &&
          !details.includes('фрез')
      })

      if (requestsToDeduct.length === 0) return

      // Aggregate deductions per inventory item in memory
      const deductionMap = {}
      for (const req of requestsToDeduct) {
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
        supabase.from('material_requests').update({ status: 'completed' }).in('id', requestsToDeduct.map(req => req.id))
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
      const sourceCode = item.packagingSource === 'bz' ? 'BZ' : item.packagingSource === 'operational' ? 'SO' : 'SGP'
      const sourceMarker = `[PACKAGING_SOURCE:${sourceCode}]`
      const customMarker = item.isCustomPackaging ? ' [PACKAGING_CUSTOM]' : ''

      requestsToInsert.push({
        order_id: orderId,
        task_id: taskId,
        nomenclature_id: nomId,
        quantity: neededQty,
        status: 'pending',
        inventory_id: null,
        details: `ЗАПИТ НА КОМПЛЕКТУВАННЯ (${order?.order_num || ''}${batchSuffix}) ${sourceMarker}${customMarker}: ${item.name} — ${neededQty} шт.`
      })
    }

    if (requestsToInsert.length > 0) {
      const { error } = await supabase.from('material_requests').insert(requestsToInsert)
      if (error) {
        console.error("Picking Request Error:", error)
        throw error
      }
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
