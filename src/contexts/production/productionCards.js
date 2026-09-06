import { supabase } from '../../supabase.js'
import { sendPushToUsers } from '../../services/pushService.js'
import {
  CHAIN_SHOP1,
  CHAIN_GENERAL,
  getRequestQty,
  normalizeName,
  stripMaterialTags,
  isRawMaterialNom,
  findExplicitRawMaterialNom as findExplicitRawNom
} from './productionShared.js'

export function createProductionCardsActions({
  orders, tasks, inventory, nomenclatures, bomItems, workCards,
  machineOperations, machines, systemUsers, currentUser,
  setTasks, setWorkCards, setWorkCardHistory, setManagementTasks, setMachines,
  normalize, refreshTable, fetchData,
  deductIssuedMaterialsForTask,
  maintenanceCheckEnabled
}, externalActions = {}) {
  const createDovyпускMaterialRequests = externalActions.createDovyпускMaterialRequests ||
    (async () => { console.warn('[useProduction] createDovyпускMaterialRequests called before bound') })

  const findExplicitRawMaterialNom = (materialLabel) => findExplicitRawNom(materialLabel, nomenclatures)

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
              const match = (existing.details || '').match(/\(Картка\s+([^)]+)\)/i)
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


  return {
    createWorkCard,
    createWorkCardsBatch,
    startWorkCard,
    completeWorkCard,
    confirmBuffer,
    createNaryad
  }
}
