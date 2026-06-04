import { supabase } from '../supabase'

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
  machineOperations,
  setTasks, setWorkCards, setWorkCardHistory, setManagementTasks, setMachines,
  normalize, refreshTable, fetchData,
  deductIssuedMaterialsForTask
}) {

  const approveWarehouse = async (taskId) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, warehouse_conf: true } : t))
    await supabase.from('tasks').update({ warehouse_conf: true }).eq('id', taskId)
  }
  const approveEngineer = async (taskId) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, engineer_conf: true } : t))
    await supabase.from('tasks').update({ engineer_conf: true }).eq('id', taskId)
  }
  const approveDirector = async (taskId) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, director_conf: true } : t))
    await supabase.from('tasks').update({ director_conf: true }).eq('id', taskId);
    const targetTask = tasks.find(t => String(t.id) === String(taskId))
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
          warehouse_conf: true,
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
  const deleteNomenclature = async (id) => { await supabase.from('nomenclatures').delete().eq('id', id); refreshTable('nomenclatures') }

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

  const createDovyпускMaterialRequests = async (taskId, orderId, partNom, sheets, quantity) => {
    try {
      const order = orders.find(o => String(o.id) === String(orderId))

      // Strip tag variants for name matching
      const stripTags = (s) => (s || '').toLowerCase()
        .replace(/\[\s*підготовлений\s*\]/gi, '')
        .replace(/\[\s*непідготовлений\s*\]/gi, '')
        .trim()

      const matKeyBase = (partNom?.material_type || partNom?.name || 'Інше').trim()
      const normalizedBase = normalizeName(stripTags(matKeyBase))

      // [Підготовлений] nom — ALWAYS used for main warehouse request
      const preparedNom = nomenclatures.find(n =>
        (n.type === 'raw' || n.type === 'material') &&
        n.name.toLowerCase().includes('підготовлений') &&
        !n.name.toLowerCase().includes('непідготовлений') &&
        normalizeName(stripTags(n.name)) === normalizedBase
      )

      // [Непідготовлений] nom — for prep order / СВ request only
      const unpreparedNom = nomenclatures.find(n =>
        (n.type === 'raw' || n.type === 'material') &&
        n.name.toLowerCase().includes('непідготовлений') &&
        normalizeName(stripTags(n.name)) === normalizedBase
      ) || nomenclatures.find(n =>
        (n.type === 'raw' || n.type === 'material') &&
        !n.name.toLowerCase().includes('підготовлений') &&
        normalizeName(n.name) === normalizedBase
      )

      // Fallback: generic match if no prepared nom found
      const finalPreparedNom = preparedNom || nomenclatures.find(n =>
        (n.type === 'raw' || n.type === 'material') &&
        normalizeName(n.name) === normalizedBase
      )

      const requestNomId = finalPreparedNom?.id || partNom?.id || null
      const requestNomName = finalPreparedNom?.name || matKeyBase

      const requestsToInsert = []

      if (sheets > 0) {
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

        // Consumables (фрези etc.)
        let hasMachineSpecificCutters = false
        const task = tasks.find(t => String(t.id) === String(taskId))
        const targetMachine = task?.machine_name || ''
        
        const opData = machineOperations?.find(o => 
          String(o.nomenclature_id) === String(partNom?.id) &&
          (o.machine_type === targetMachine || o.machine_id === targetMachine)
        )
        
        if (opData && opData.side2_cut_ops) {
          const cutterOps = opData.side2_cut_ops.filter(op => op.startsWith('__CUTTER__Reference:') || op.startsWith('__CUTTER__:'))
          const machineSpecificCutters = {}
          cutterOps.forEach(op => {
            const parts = op.split(':')
            const cutterNomId = parts[1]
            const qtyPerSheet = parseFloat(parts[2]) || 0
            if (cutterNomId && qtyPerSheet > 0) {
              const totalQty = Math.ceil(sheets * qtyPerSheet)
              const cutterNom = nomenclatures.find(n => String(n.id) === String(cutterNomId))
              if (cutterNom && cutterNom.name.trim().toLowerCase() !== 'фреза') {
                hasMachineSpecificCutters = true
                const cleanName = cutterNom.name.trim()
                const key = cleanName.toLowerCase()
                if (!machineSpecificCutters[key]) {
                  machineSpecificCutters[key] = {
                    name: cleanName,
                    qty: 0,
                    nomenclature_id: cutterNom.id
                  }
                }
                machineSpecificCutters[key].qty += totalQty
              }
            }
          })

          Object.values(machineSpecificCutters).forEach(item => {
            const consInvItem = inventory.find(i => String(i.nomenclature_id) === String(item.nomenclature_id) && i.warehouse === 'operational')
              || inventory.find(i => String(i.nomenclature_id) === String(item.nomenclature_id))
            requestsToInsert.push({
              order_id: orderId,
              task_id: taskId,
              quantity: item.qty,
              status: 'pending',
              inventory_id: consInvItem?.id || null,
              nomenclature_id: item.nomenclature_id,
              details: `ВИТРАТНІ МАТЕРІАЛИ ДЛЯ ДОВИПУСКУ ${order?.order_num || '???'}: ${item.name} — ${item.qty} од. (для ${partNom?.name || '???'})`
            })
          })
        }

        const fallbackCons = {}
        nomenclatures
          .filter(n =>
            n.type === 'consumable' &&
            (Number(n.consumption_per_sheet) || 0) > 0 &&
            n.name.trim().toLowerCase() !== 'фреза' &&
            !n.name.toLowerCase().includes('лист')
          )
          .forEach(cons => {
            if (hasMachineSpecificCutters && cons.name.toLowerCase().includes('фреза')) {
              return
            }
            const cleanName = cons.name.trim()
            const key = cleanName.toLowerCase()
            const totalQty = Math.ceil(sheets * Number(cons.consumption_per_sheet))
            if (!fallbackCons[key]) {
              fallbackCons[key] = {
                name: cleanName,
                qty: 0,
                nomenclature_id: cons.id
              }
            }
            fallbackCons[key].qty += totalQty
          })

        Object.values(fallbackCons).forEach(item => {
          const consInvItem = inventory.find(i => String(i.nomenclature_id) === String(item.nomenclature_id) && i.warehouse === 'operational')
            || inventory.find(i => String(i.nomenclature_id) === String(item.nomenclature_id))
          requestsToInsert.push({
            order_id: orderId,
            task_id: taskId,
            quantity: item.qty,
            status: 'pending',
            inventory_id: consInvItem?.id || null,
            nomenclature_id: item.nomenclature_id,
            details: `ВИТРАТНІ МАТЕРІАЛИ ДЛЯ ДОВИПУСКУ ${order?.order_num || '???'}: ${item.name} — ${item.qty} од.`
          })
        })
      }

      if (requestsToInsert.length > 0) {
        await supabase.from('material_requests').insert(requestsToInsert)
      }
    } catch (err) {
      console.error('Error creating dovypusk material requests:', err)
    }
  }
  const createWorkCard = async (taskId, orderId, nomenclatureId, operation, machine, estimatedTime, cardInfo, quantity, bufferQty, isRework = false) => {
    const status = isRework ? 'waiting-materials' : 'new'
    const { data: list } = await supabase.from('work_cards').insert([{
      task_id: taskId, order_id: orderId, nomenclature_id: nomenclatureId,
      operation: operation || 'Нова', machine, quantity: Number(quantity) || 0,
      estimated_time: Number(estimatedTime) || 0, status, is_rework: isRework,
      card_info: `${cardInfo || ''}${Number(bufferQty) > 0 ? ` [BZ:${bufferQty}]` : ''}${isRework ? ' [REDO]' : ''}`
    }]).select()
    const data = (list && list.length > 0) ? list[0] : null
    await supabase.from('tasks').update({ status: 'in-progress' }).eq('id', taskId)

    if (isRework) {
      const partNom = nomenclatures.find(n => n.id === nomenclatureId)
      const unitsPerSheet = partNom?.units_per_sheet || 1
      const sheets = Math.ceil(Number(quantity) / unitsPerSheet)
      await createDovyпускMaterialRequests(taskId, orderId, partNom, sheets, Number(quantity))
    }

    // Only refresh affected tables (work_cards + tasks), not everything
    refreshTable('work_cards')
    refreshTable('tasks')
    return data
  }

  const createWorkCardsBatch = async (taskId, orderId, nomenclatureId, cardsArray) => {
    const payloads = cardsArray.map(c => ({
      task_id: taskId, order_id: orderId, nomenclature_id: nomenclatureId,
      operation: c.operation || 'Нова', machine: c.machine, quantity: Number(c.quantity) || 0,
      estimated_time: Number(c.estimatedTime) || 0, status: c.status || 'new', is_rework: c.is_rework || false,
      card_info: `${c.cardInfo || ''}${Number(c.bufferQty) > 0 ? ` [BZ:${c.bufferQty}]` : ''}`
    }))

    const { data } = await supabase.from('work_cards').insert(payloads).select()
    // Optimistic update: append new cards to local state immediately (no full fetchData)
    if (data && data.length > 0) {
      setWorkCards(prev => [...prev, ...data])
    }
    // Update task status in background (non-blocking)
    supabase.from('tasks').update({ status: 'in-progress' }).eq('id', taskId).then(() => {
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'in-progress' } : t))
    })
    return data
  }

  const startWorkCard = async (taskId, cardId, operatorName, metadata = {}) => {
    const updateData = { status: 'in-progress', started_at: new Date().toISOString(), operator_name: operatorName }
    if (metadata.stage_name) updateData.operation = metadata.stage_name
    if (metadata.machine_id) updateData.machine_id = metadata.machine_id
    if (metadata.machine_name) updateData.machine = metadata.machine_name
    setWorkCards(prev => prev.map(c => c.id === cardId ? { ...c, ...updateData } : c))
    const { error } = await supabase.from('work_cards').update(updateData).eq('id', cardId)
    if (error) { console.error('Error starting card:', error); refreshTable('work_cards') }
  }

  const completeWorkCard = async (taskId, cardId, operatorName) => {
    const updateData = { status: 'waiting-buffer', operator_name: operatorName, completed_at: new Date().toISOString() }
    setWorkCards(prev => prev.map(c => c.id === cardId ? { ...c, ...updateData } : c))
    const { error } = await supabase.from('work_cards').update(updateData).eq('id', cardId)
    if (error) { console.error('Error completing card:', error); refreshTable('work_cards') }
  }

  const CHAIN_SHOP1 = ['Розкрій', 'Галтовка', 'Прийомка']
  const CHAIN_GENERAL = ['Розкрій', 'Галтовка', 'Пресування', 'Фарбування', 'Паквання']

  const confirmBuffer = async (cardId, scrapData = {}, cuttersUsed = 0, cuttersBreakdown = null) => {
    const card = workCards.find(c => c.id === cardId)
    if (!card) return
    const totalScrap = typeof scrapData === 'number' ? scrapData : Object.values(scrapData).reduce((acc, c) => acc + Number(c), 0)
    const qtyCompleted = Math.max(0, (card.quantity || 0) - totalScrap)
    const isRework = (card.card_info || '').includes('[REWORK]')
    const currentOp = (card.operation || '').trim()
    const isShop1 = (card.card_info || '').includes('[SHOP:1]')
    const isShop2 = (card.card_info || '').includes('[ЦЕХ №2]')
    const chain = isShop1 ? CHAIN_SHOP1 : CHAIN_GENERAL
    const idx = chain.findIndex(s => s.toLowerCase() === currentOp.toLowerCase())
    const nextStage = idx >= 0 && idx < chain.length - 1 ? chain[idx + 1] : null
    let cardUpdate = {}
    if (isRework) cardUpdate = { status: 'completed', quantity: qtyCompleted }
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

    await Promise.all([
      supabase.from('work_card_history').insert([{
        card_id: cardId, nomenclature_id: card.nomenclature_id, stage_name: card.operation || 'Розкрій',
        operator_name: card.operator_name || 'Не вказано', card_info: historyCardInfo,
        qty_at_start: card.quantity, qty_completed: qtyCompleted, scrap_qty: totalScrap,
        cutters_used: Number(cuttersUsed) || 0, started_at: card.started_at, completed_at: new Date().toISOString()
      }]),
      supabase.from('work_cards').update({ ...cardUpdate, cutters_used: Number(cuttersUsed) || 0, card_info: historyCardInfo }).eq('id', cardId)
    ])

    if (isRework) {
      const nom = nomenclatures.find(n => n.id === card.nomenclature_id)
      if (nom && qtyCompleted > 0) {
        const { data: bzItem } = await supabase.from('inventory').select('*').eq('nomenclature_id', nom.id).eq('type', 'bz').limit(1).maybeSingle()
        if (bzItem) await supabase.from('inventory').update({ total_qty: (Number(bzItem.total_qty) || 0) + qtyCompleted }).eq('id', bzItem.id)
        else await supabase.from('inventory').insert([{ nomenclature_id: nom.id, name: nom.name, unit: nom.unit || 'шт', total_qty: qtyCompleted, reserved_qty: 0, type: 'bz' }])
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
        let effectiveReq = totalNeed || plannedReq
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
    refreshTable('inventory')
  }

  const completeTaskByMaster = async (taskId) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'completed', completed_at: new Date().toISOString() } : t))
    await deductIssuedMaterialsForTask(taskId)
    await supabase.from('tasks').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', taskId)
    refreshTable('inventory')
  }

  const addManagementTask = async (taskPayload, currentUserLogin) => {
    const { data, error } = await supabase.from('management_tasks').insert([{ ...taskPayload, created_by: currentUserLogin || 'system', created_at: new Date().toISOString() }]).select()
    if (!error && data?.[0]) setManagementTasks(prev => [data[0], ...prev])
    return { data: data?.[0], error }
  }
  const updateManagementTask = async (taskId, updates) => {
    setManagementTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...updates } : t))
    const { error } = await supabase.from('management_tasks').update(updates).eq('id', taskId)
    return { error }
  }
  const deleteManagementTask = async (taskId) => {
    const { error } = await supabase.from('management_tasks').delete().eq('id', taskId)
    if (!error) setManagementTasks(prev => prev.filter(t => t.id !== taskId))
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
      const key = t.batch_index || `task_${t.id}`
      const qty = Number(t.planned_sets) || 0
      const isPackaged = t.plan_snapshot?._metadata?.is_packaged === true
      const isProduced = t.status === 'completed' || t.step.includes('ЦЕХ №2') || t.step.includes('Паквання')
      if (!batches[key]) batches[key] = { qty, isPackaged, isProduced }
      else { if (qty > batches[key].qty) batches[key].qty = qty; if (isPackaged) batches[key].isPackaged = true; if (isProduced) batches[key].isProduced = true }
    })
    const planned = Object.values(batches).reduce((acc, b) => acc + b.qty, 0)
    const packaged = Object.values(batches).filter(b => b.isPackaged).reduce((acc, b) => acc + b.qty, 0)
    const produced = Object.values(batches).filter(b => b.isProduced).reduce((acc, b) => acc + b.qty, 0)
    let status = order.status
    if (packaged >= totalQty && totalQty > 0) status = 'packaged'
    else if (produced > 0 || planned > 0) { if (status !== 'shipped' && status !== 'completed') status = 'in-progress' }
    return { total: totalQty, planned, produced, packaged, isFullyPackaged: packaged >= totalQty && totalQty > 0, isFullyPlanned: planned >= totalQty && totalQty > 0, status }
  }

  const createNaryad = async (orderId, machineName, customQuantities = null, customDeadline = null, customRowMachines = null) => {
    try {
      const order = orders.find(o => o.id === orderId)
      if (!order) return
      let totalMin = 0
      const materialSummary = {}
      const bzStockDeductions = []
      const plan_snapshot = {}

      order.order_items?.forEach(item => {
        const requestedQty = customQuantities && customQuantities[item.id] !== undefined ? Number(customQuantities[item.id]) : Number(item.quantity)
        if (requestedQty <= 0) return
        const parts = bomItems.filter(b => String(b.parent_id) === String(item.nomenclature_id))
        const displayParts = parts.length > 0 ? parts.map(b => ({ nom: nomenclatures.find(n => String(n.id) === String(b.child_id)), qtyPer: b.quantity_per_parent })) : [{ nom: nomenclatures.find(n => String(n.id) === String(item.nomenclature_id)), qtyPer: 1 }]
        displayParts.forEach(part => {
          if (!part.nom) return
          const totalNeeded = requestedQty * (Number(part.qtyPer) || 1)
          const invItem = inventory.find(i => String(i.nomenclature_id) === String(part.nom.id) && i.type === 'bz')
          const inStockQty = invItem ? Math.max(0, (Number(invItem.total_qty) || 0) - (Number(invItem.reserved_qty) || 0)) : 0
          const usedFromStock = Math.min(totalNeeded, inStockQty)
          const totalToProduce = Math.max(0, totalNeeded - inStockQty)
          const unitsPerSheet = Number(part.nom.units_per_sheet) || 1
          let sheets = Math.ceil(totalToProduce / unitsPerSheet)
          const selectedMachine = (customRowMachines && customRowMachines[part.nom.id]) || machineName;
          plan_snapshot[part.nom.id] = { id: part.nom.id, name: part.nom.name, code: part.nom.nomenclature_code, need: totalNeeded, stock: inStockQty, plan: totalToProduce, units_per_sheet: unitsPerSheet, sheets: sheets, material: part.nom.material_type, order_item_id: item.id, selected_machine: selectedMachine }
          if (usedFromStock > 0 && invItem) bzStockDeductions.push({ id: invItem.id, next_qty: (Number(invItem.total_qty) || 0) - usedFromStock })
          if (totalToProduce <= 0) return
          const matKeyBase = (part.nom.material_type || part.nom.name || 'Інше').trim()
          const matKey = normalize(matKeyBase)

          // Look up prepared nomenclature first
          const normalizedBase = normalizeName(matKeyBase.toLowerCase().replace(' [непідготовлений]', '').replace('[непідготовлений]', '').trim())
          let rawNom = nomenclatures.find(n =>
            (n.type === 'raw' || n.type === 'material') &&
            n.name.includes('[Підготовлений]') &&
            (normalize(n.name.replace(' [Підготовлений]', '')) === matKey ||
              normalize(n.name.replace('[Підготовлений]', '')) === matKey ||
              normalizeName(n.name.replace(' [Підготовлений]', '')) === normalizedBase ||
              normalizeName(n.name.replace('[Підготовлений]', '')) === normalizedBase)
          )

          // Fallback to original lookup (non-prepared sheets) if prep sheet nomenclature not found
          if (!rawNom) {
            rawNom = nomenclatures.find(n =>
              (n.type === 'raw' || n.type === 'material') &&
              (normalize(n.name) === matKey ||
                normalize(n.material_type) === matKey ||
                normalizeName(n.name) === normalizeName(matKeyBase))
            )
          }

          const matId = rawNom?.id || (part.nom.type === 'raw' ? part.nom.id : 'unknown-' + matKey)
          if (!materialSummary[matId]) {
            const unit = (part.nom.type === 'hardware' || part.nom.type === 'fastener') ? 'шт' : 'ЛИСТІВ'
            materialSummary[matId] = { matName: rawNom?.name || matKeyBase, sheets: 0, totalUnits: 0, components: [], inventory_id: null, nomenclature_id: rawNom?.id || (part.nom.type === 'raw' ? part.nom.id : null), unit, partType: rawNom?.type || (part.nom.type === 'raw' ? 'raw' : 'unknown') }
            if (materialSummary[matId].nomenclature_id) {
              const inv = inventory.find(i =>
                String(i.nomenclature_id) === String(materialSummary[matId].nomenclature_id) &&
                i.warehouse === 'operational'
              ) || inventory.find(i =>
                String(i.nomenclature_id) === String(materialSummary[matId].nomenclature_id)
              )
              materialSummary[matId].inventory_id = inv?.id || null
            }
          }
          materialSummary[matId].sheets += sheets
          materialSummary[matId].totalUnits += totalToProduce
          materialSummary[matId].components.push(`${part.nom.name}: ${totalToProduce}шт`)
          totalMin += totalToProduce * (Number(part.nom.time_per_unit) || 0)
        })
      })

      if (Object.keys(plan_snapshot).length === 0) return
      const totalUnits = order.order_items?.reduce((acc, it) => acc + (Number(it.quantity) || 0), 0) || 0;
      const thisNaryadTotalSets = customQuantities ? Math.max(...Object.values(customQuantities).map(v => Number(v) || 0)) : totalUnits;
      const alreadyPlannedSets = tasks.filter(t => t.order_id === orderId).reduce((acc, t) => acc + (Number(t.planned_sets) || 0), 0);
      const isPartial = (thisNaryadTotalSets < totalUnits) || (alreadyPlannedSets > 0);
      const orderTasks = tasks.filter(t => String(t.order_id) === String(orderId))
      const maxBatchIndex = orderTasks.reduce((max, t) => Math.max(max, Number(t.batch_index) || 0), 0)
      const nextBatchIndex = maxBatchIndex + 1;
      plan_snapshot._metadata = { planned_deadline: customDeadline || order.deadline, batch_index: isPartial ? nextBatchIndex : null }
      plan_snapshot.materialSummary = materialSummary

      const { data: taskData, error: taskError } = await supabase.from('tasks').insert([{ order_id: orderId, step: 'Розкрій', status: 'waiting', machine_name: machineName || 'Не вказано', estimated_time: Math.round(totalMin), engineer_conf: false, warehouse_conf: false, director_conf: false, plan_snapshot: plan_snapshot, planned_sets: thisNaryadTotalSets, batch_index: isPartial ? nextBatchIndex : null, planned_deadline: customDeadline || order.deadline }]).select()
      const tData = (taskData && taskData.length > 0) ? taskData[0] : null
      if (taskError) throw taskError

      if (bzStockDeductions.length > 0) {
        const s2InventoryUpdates = []
        const s2InventoryInserts = []

        bzStockDeductions.forEach(upd => {
          const invItem = inventory.find(i => i.id === upd.id)
          if (invItem) {
            const usedQty = (Number(invItem.total_qty) || 0) - upd.next_qty
            if (usedQty > 0) {
              const sgpFinished = inventory.find(i => String(i.nomenclature_id) === String(invItem.nomenclature_id) && i.type === 'finished')
              if (sgpFinished) {
                s2InventoryUpdates.push({
                  ...sgpFinished,
                  total_qty: (Number(sgpFinished.total_qty) || 0) + usedQty
                })
              } else {
                const nom = nomenclatures.find(n => n.id === invItem.nomenclature_id)
                s2InventoryInserts.push({
                  nomenclature_id: invItem.nomenclature_id,
                  name: nom?.name || invItem.name || 'Деталь',
                  total_qty: usedQty,
                  reserved_qty: 0,
                  type: 'finished',
                  unit: nom?.unit || invItem.unit || 'шт'
                })
              }
            }
          }
        })

        const bzWriteOps = [
          ...bzStockDeductions.map(upd =>
            supabase.from('inventory').update({ total_qty: upd.next_qty }).eq('id', upd.id)
          )
        ]
        if (s2InventoryUpdates.length > 0) {
          bzWriteOps.push(supabase.from('inventory').upsert(s2InventoryUpdates))
        }
        if (s2InventoryInserts.length > 0) {
          bzWriteOps.push(supabase.from('inventory').insert(s2InventoryInserts))
        }
        await Promise.all(bzWriteOps)

        const cardsToInsert = []
        bzStockDeductions.forEach(upd => {
          const invItem = inventory.find(i => i.id === upd.id)
          if (invItem && tData) {
            const usedQty = (Number(invItem.total_qty) || 0) - upd.next_qty
            if (usedQty > 0) {
              cardsToInsert.push({
                task_id: tData.id,
                order_id: orderId,
                nomenclature_id: invItem.nomenclature_id,
                quantity: usedQty,
                status: 'completed',
                operation: 'Склад БЗ',
                card_info: '[ЗІ СКЛАДУ БЗ]'
              })
            }
          }
        })

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
      }

      await supabase.from('orders').update({ status: 'in-progress' }).eq('id', orderId)
      const allMaterials = Object.values(materialSummary).map(info => ({ ...info, sheets: Number(info.sheets) || 0 }))
      const requestsToInsert = allMaterials.filter(info => info.matName && (info.matName.toLowerCase().startsWith('лист') || info.matName.toLowerCase().includes('фреза'))).map(info => {
        const qtyToRequest = info.unit === 'ЛИСТІВ' ? info.sheets : info.totalUnits;
        const unitLabel = info.unit === 'ЛИСТІВ' ? 'л.' : 'од.';
        return { order_id: orderId, task_id: tData.id, quantity: qtyToRequest, status: 'pending', inventory_id: info.inventory_id, nomenclature_id: info.nomenclature_id, details: `СКЛАД ОПЕРАТИВНИЙ: ${info.matName} — ${qtyToRequest} ${unitLabel} (Разом: ${info.totalUnits} шт | Для: ${info.components.join(', ')})` }
      })

      // Add machine-specific cutters
      const machineSpecificCutters = {}
      let hasMachineSpecificCutters = false
      const partIds = Object.keys(plan_snapshot).filter(k => !k.startsWith('_') && k !== 'materialSummary')
      
      partIds.forEach(partId => {
        const partInfo = plan_snapshot[partId]
        const sheetsNeeded = Number(partInfo.sheets) || 0
        if (sheetsNeeded <= 0) return

        // Find matching machine operation
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
              hasMachineSpecificCutters = true
              const totalQty = Math.ceil(sheetsNeeded * qtyPerSheet)
              const cutterNom = nomenclatures.find(n => String(n.id) === String(cutterNomId))
              if (cutterNom) {
                const cleanName = cutterNom.name.trim()
                const key = cleanName.toLowerCase()
                if (!machineSpecificCutters[key]) {
                  machineSpecificCutters[key] = {
                    name: cleanName,
                    qty: 0,
                    components: [],
                    nomenclature_id: cutterNom.id
                  }
                }
                machineSpecificCutters[key].qty += totalQty
                machineSpecificCutters[key].components.push(`${partInfo.name}: ${totalQty} шт (${sheetsNeeded} л.)`)
              }
            }
          })
        }
      })

      Object.values(machineSpecificCutters).forEach(item => {
        const invItem = inventory.find(i => String(i.nomenclature_id) === String(item.nomenclature_id) && i.warehouse === 'operational')
          || inventory.find(i => String(i.nomenclature_id) === String(item.nomenclature_id))
        requestsToInsert.push({
          order_id: orderId,
          task_id: tData.id,
          quantity: item.qty,
          status: 'pending',
          inventory_id: invItem?.id || null,
          nomenclature_id: item.nomenclature_id,
          details: `ВИТРАТНІ МАТЕРІАЛИ ДЛЯ ${order.order_num}: ${item.name} — ${item.qty} од. (Для: ${item.components.join(', ')})`
        })
      })

      const totalActualSheets = allMaterials.filter(m => m.unit === 'ЛИСТІВ').reduce((acc, m) => acc + (m.sheets || 0), 0)
      if (totalActualSheets > 0) {
        nomenclatures.filter(n => n.type === 'consumable' && (Number(n.consumption_per_sheet) || 0) > 0 && n.name.trim().toLowerCase() !== 'фреза' && (n.name.toLowerCase().startsWith('лист') || n.name.toLowerCase().includes('фреза'))).forEach(cons => {
          if (hasMachineSpecificCutters && cons.name.toLowerCase().includes('фреза')) {
            return
          }
          const neededQty = Math.ceil(totalActualSheets * Number(cons.consumption_per_sheet))
          const invItem = inventory.find(i => i.nomenclature_id === cons.id)
          requestsToInsert.push({ order_id: orderId, task_id: tData.id, quantity: neededQty, status: 'pending', inventory_id: invItem?.id || null, nomenclature_id: cons.id, details: `ВИТРАТНІ МАТЕРІАЛИ ДЛЯ ${order.order_num}: ${cons.name} — ${neededQty} од.` })
        })
      }
      if (requestsToInsert.length > 0) await supabase.from('material_requests').insert(requestsToInsert)
      
      const consumablesSnapshot = []
      Object.values(machineSpecificCutters).forEach(item => {
        consumablesSnapshot.push({ name: item.name, total: item.qty })
      })
      if (totalActualSheets > 0) {
        nomenclatures.filter(n => n.type === 'consumable' && (Number(n.consumption_per_sheet) || 0) > 0 && n.name.trim().toLowerCase() !== 'фреза' && (n.name.toLowerCase().startsWith('лист') || n.name.toLowerCase().includes('фреза'))).forEach(cons => {
          if (hasMachineSpecificCutters && cons.name.toLowerCase().includes('фреза')) {
            return
          }
          const neededQty = Math.ceil(totalActualSheets * Number(cons.consumption_per_sheet))
          consumablesSnapshot.push({ name: cons.name.trim(), total: neededQty })
        })
      }
      plan_snapshot.consumables = consumablesSnapshot
      if (tData) {
        await supabase.from('tasks').update({ plan_snapshot }).eq('id', tData.id)
      }

      // Refresh only what was changed: tasks + material_requests
      await Promise.all([refreshTable('tasks'), refreshTable('material_requests')])
    } catch (err) { console.error('Error creating naryad:', err.message) }
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
            warehouse_conf: true,
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
          else { const nom = nomenclatures.find(n => n.id === nomId); await supabase.from('inventory').insert([{ nomenclature_id: nomId, name: nom?.name || 'BZ Item', unit: nom?.unit || 'шт', total_qty: totalToMove, reserved_qty: 0, type: 'bz' }]) }
          for (const s of shop2Stock) { if (s.type === 'bz_shop2') await supabase.from('inventory').update({ total_qty: 0 }).eq('id', s.id); else await supabase.from('inventory').delete().eq('id', s.id) }
        }
        
        // Also reset semi_shop2 to 0 for these nomenclatures
        const semiShop2Item = (inventory || []).find(i => String(i.nomenclature_id) === String(nomId) && i.type === 'semi_shop2')
        if (semiShop2Item && (Number(semiShop2Item.total_qty) || 0) > 0) {
          await supabase.from('inventory').update({ total_qty: 0 }).eq('id', semiShop2Item.id)
        }
      }
      refreshTable('inventory'); refreshTable('tasks')
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
        else await supabase.from('inventory').insert([{ nomenclature_id: nomenclatureId, name: nom.name, unit: nom.unit || 'шт', total_qty: actualBzQty, reserved_qty: 0, type: 'bz' }])
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
      const isRework = card.card_info?.includes('[REWORK]') || card.operation === 'Доопрацювання' || card.card_info?.includes('Автоматично з Сортування')

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
        const sibIsRework = sib.card_info?.includes('[REWORK]') || sib.operation === 'Доопрацювання' || sib.card_info?.includes('Автоматично з Сортування')
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
          inserts.push({ nomenclature_id: nomId, name: nom?.name || nomName || 'Запас БЗ', unit: nom?.unit || 'шт', total_qty: actualBzQty, reserved_qty: 0, type: 'bz' })
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
        warehouse_conf: true,
        director_conf: true,
        plan_snapshot: plan_snapshot,
        planned_sets: 0
      }])
      .select()

    const newTask = taskData?.[0]
    let cardPromise = Promise.resolve()
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
          card_info: `[REWORK] [ЦЕХ №2] ${nom?.name || scrapItem.name} — ДООПРАЦЮВАННЯ БРАКУ`
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
    addOrder, createWorkCard, createWorkCardsBatch, startWorkCard, completeWorkCard, confirmBuffer,
    completeTaskByMaster,
    addManagementTask, updateManagementTask, deleteManagementTask,
    addMachine, updateMachine, deleteMachine,
    getOrderProductionProgress,
    createDovyпускMaterialRequests
  }
}
