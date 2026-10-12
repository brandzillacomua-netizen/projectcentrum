import { supabase } from '../../../supabase'
import { extractThickness, findWorkingSheetNom } from '../../Nomenclature/utils/nomenclatureHelpers'

/**
 * Service to handle Rerun / Extra Issue ("Довипуск") requests from Shop 2 to Shop 1
 */
export const shop2RerunService = {
  /**
   * Request a rerun for a part/order due to scrap or deficit in Shop 2
   */
  async createRerunRequest({
    orderId,
    nomenclatureId,
    qty,
    reason = 'Брак у Цеху №2',
    createdBy = 'Нач. Цеху №2'
  }) {
    if (!nomenclatureId || !qty || qty <= 0) {
      throw new Error('Вкажіть коректну кількість деталей для довипуску')
    }

    const { data: resolvedNomId, error: resolveError } = await supabase
      .rpc('resolve_nomenclature_v2_id', { p_id: nomenclatureId })
    const canonicalNomId = !resolveError && resolvedNomId ? resolvedNomId : nomenclatureId

    // 1. Fetch part nomenclature
    const { data: newNom } = await supabase
      .from('nomenclatures_v2')
      .select('*')
      .eq('id', canonicalNomId)
      .maybeSingle()
    const partName = newNom?.name || 'Деталь'

    // 2. Fetch parent Order and parent Cutting Task if orderId is provided
    let parentOrder = null
    let parentTask = null
    if (orderId) {
      const { data: oData } = await supabase.from('orders').select('*').eq('id', orderId).maybeSingle()
      parentOrder = oData

      const { data: tData } = await supabase
        .from('tasks')
        .select('*')
        .eq('order_id', orderId)
        .ilike('step', '%розкр%')
        .limit(1)
      if (tData && tData.length > 0) {
        parentTask = tData[0]
      }
    }

    // 3. Determine Order Num and Child Suffix
    let parentNum = parentOrder?.order_num || 'ДОВИПУСК'
    parentNum = parentNum.split('-Д')[0] // strip existing suffix if any

    const { data: existingChildOrders } = await supabase
      .from('orders')
      .select('order_num')
      .ilike('order_num', `${parentNum}-Д%`)

    const rerunCount = (existingChildOrders?.length || 0) + 1
    const rerunOrderNum = `${parentNum}-Д${rerunCount}`

    // 4. Create Rerun Order
    const { data: newOrder, error: orderErr } = await supabase
      .from('orders')
      .insert([{
        order_num: rerunOrderNum,
        customer: parentOrder?.customer ? `${parentOrder.customer} (Довипуск)` : 'Довипуск Цех 1',
        status: 'in-progress',
        nomenclature_id: parentOrder?.nomenclature_id || canonicalNomId,
        quantity: qty,
        accessories: `Довипуск через брак у Цеху №2 (${qty} шт). Батьківський наряд: ${parentNum}`
      }])
      .select()
      .single()

    if (orderErr) {
      console.error('[shop2RerunService] Error creating rerun order:', orderErr)
      throw new Error(`Помилка створення дочірнього наряду довипуску: ${orderErr.message}`)
    }

    // 5. Create Order Item (CRITICAL for MasterNaryadModal & Engineer queue)
    const { data: newOrderItem, error: itemErr } = await supabase
      .from('order_items')
      .insert([{
        order_id: newOrder.id,
        nomenclature_id: canonicalNomId,
        quantity: qty
      }])
      .select()
      .single()

    if (itemErr) {
      console.error('[shop2RerunService] Error creating rerun order item:', itemErr)
      throw new Error(`Помилка додавання деталі до наряду: ${itemErr.message}`)
    }

    // 6. Calculate Sheet Requirements & Material Grade
    const parentPartSnap = parentTask?.plan_snapshot?.[canonicalNomId]
    const unitsPerSheet = Number(parentPartSnap?.units_per_sheet || newNom?.rule_params?.unitsPerSheet || newNom?.units_per_sheet) || 1
    const sheets = Math.ceil(qty / unitsPerSheet)

    // Determine material thickness & grade
    const matLabel = parentPartSnap?.material || newNom?.rule_params?.rawSheet || newNom?.name || ''
    const thickness = extractThickness(matLabel) || extractThickness(newNom?.name) || '1'
    const isT700 = parentPartSnap?.sheets_t700 > 0 || /700/.test(matLabel) || /700/.test(newNom?.name || '')
    const grade = isT700 ? 'Т700' : 'Т300'

    // Fetch nomenclatures for working sheets
    const { data: allRawNoms } = await supabase
      .from('nomenclatures_v2')
      .select('*')
      .or(`name.ilike.%Лист ${grade}%,name.ilike.%Лист T${grade.slice(1)}%`)

    const workingSheetNom = findWorkingSheetNom(grade, `${thickness}мм`, allRawNoms || [])
    const sheetNomId = workingSheetNom?.id || null
    const sheetNomName = workingSheetNom?.name || `Лист ${grade} (${thickness}мм)`

    // Fetch operational inventory item for the sheet
    let sheetInvItem = null
    if (sheetNomId) {
      const { data: invRows } = await supabase
        .from('inventory')
        .select('*')
        .eq('nomenclature_id', sheetNomId)
        .eq('warehouse', 'operational')
        .limit(1)
      if (invRows && invRows.length > 0) {
        sheetInvItem = invRows[0]
      }
    }
    if (!sheetInvItem) {
      const { data: invRows } = await supabase
        .from('inventory')
        .select('*')
        .ilike('name', `%${grade}%${thickness}мм%`)
        .eq('warehouse', 'operational')
        .limit(1)
      if (invRows && invRows.length > 0) {
        sheetInvItem = invRows[0]
      }
    }

    // 7. Calculate Cutters (metadata for plan_snapshot)
    const selectedCuttersMap = {}
    const selectedCuttersByName = {}
    const consumablesList = []

    const { data: opsList } = await supabase
      .from('machine_operations')
      .select('*')
      .eq('nomenclature_id', canonicalNomId)

    const opData = opsList?.[0]
    if (opData?.side2_cut_ops && Array.isArray(opData.side2_cut_ops)) {
      const cutterOps = opData.side2_cut_ops.filter(op => op.startsWith('__CUTTER__:'))
      for (const op of cutterOps) {
        const parts = op.split(':')
        const cutterNomId = parts[1]
        const ratePerSheet = parseFloat(parts[2]) || 0
        if (cutterNomId && ratePerSheet > 0) {
          const neededQty = Math.ceil(sheets * ratePerSheet)

          const { data: cutterNom } = await supabase
            .from('nomenclatures_v2')
            .select('*')
            .eq('id', cutterNomId)
            .maybeSingle()

          let cutterInv = null
          if (cutterNom?.name) {
            const isF2 = /ф\s*2/i.test(cutterNom.name)
            const isF3 = /ф\s*3/i.test(cutterNom.name)
            const searchPattern = isF2 ? '%2х3,175%' : (isF3 ? '%3х3,175%' : `%${cutterNom.name}%`)
            const { data: cInvs } = await supabase
              .from('inventory')
              .select('*')
              .ilike('name', searchPattern)
              .eq('warehouse', 'operational')
              .limit(1)
            if (cInvs && cInvs.length > 0) {
              cutterInv = cInvs[0]
            }
          }

          const resolvedCutterName = cutterInv?.name || cutterNom?.name || 'Фреза'
          const resolvedNomId = cutterInv?.nomenclature_id || cutterNom?.id || cutterNomId

          selectedCuttersMap[cutterNomId] = cutterInv?.id || resolvedNomId
          if (cutterNom?.name) {
            selectedCuttersByName[cutterNom.name] = cutterInv?.id || resolvedNomId
          }
          consumablesList.push({ name: resolvedCutterName, total: neededQty })
        }
      }
    }

    // 8. Build complete plan_snapshot
    const matSummaryKey = `${sheetNomId || 'mat'}-${grade}`
    const planSnapshot = {
      _use_bz: false,
      _metadata: {
        batch_index: null,
        planned_deadline: null
      },
      [canonicalNomId]: {
        id: canonicalNomId,
        code: newNom?.code || newNom?.nomenclature_code || '',
        name: partName,
        need: qty,
        plan: qty,
        stock: 0,
        sheets: sheets,
        splits: [],
        machine: 'Не призначено',
        material: sheetNomName,
        sheets_t300: isT700 ? 0 : sheets,
        sheets_t700: isT700 ? sheets : 0,
        order_item_id: newOrderItem.id,
        cutter_override: '2',
        units_per_sheet: unitsPerSheet,
        selected_machine: 'Не призначено',
        selected_cutters: selectedCuttersMap
      },
      materialSummary: {
        [matSummaryKey]: {
          unit: 'ЛИСТІВ',
          grade,
          sheets,
          matName: sheetNomName,
          partType: 'raw',
          components: [`${partName}: ${qty}шт`],
          totalUnits: qty,
          inventory_id: sheetInvItem?.id || null,
          nomenclature_id: sheetNomId
        }
      },
      selectedCutters: selectedCuttersByName,
      consumables: consumablesList
    }

    // 9. Create Task for Shop 1 (Laser Cutting) with status: 'waiting'
    const { data: newTask, error: taskErr } = await supabase
      .from('tasks')
      .insert([{
        order_id: newOrder.id,
        step: 'Розкрій (Довипуск)',
        status: 'waiting',
        machine_name: 'Не призначено',
        engineer_conf: false,
        warehouse_conf: 'false',
        director_conf: false,
        planned_sets: qty,
        plan_snapshot: planSnapshot
      }])
      .select()
      .single()

    if (taskErr) {
      console.error('[shop2RerunService] Error creating rerun task:', taskErr)
      throw new Error(`Помилка створення задачі довипуску: ${taskErr.message}`)
    }

    // 10. Create Material Requests for Warehouse (ONLY Sheets at order creation; cutters are requested later during card generation)
    if (sheets > 0 && sheetNomId) {
      const materialRequestsToInsert = [
        {
          order_id: newOrder.id,
          task_id: newTask.id,
          quantity: sheets,
          status: 'pending',
          inventory_id: sheetInvItem?.id || null,
          nomenclature_id: sheetNomId,
          category: 'sheet',
          target_warehouse: 'operational',
          details: `СКЛАД ОПЕРАТИВНИЙ: ${sheetNomName} — ${sheets} л. (Для: ${partName}: ${qty}шт)`
        }
      ]

      const { error: reqsErr } = await supabase
        .from('material_requests')
        .insert(materialRequestsToInsert)

      if (reqsErr) {
        console.error('[shop2RerunService] Error creating material requests:', reqsErr)
      }
    }

    return {
      order: newOrder,
      task: newTask,
      card: null,
      rerunOrderNum
    }
  }
}
