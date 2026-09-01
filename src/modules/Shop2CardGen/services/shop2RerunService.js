import { supabase } from '../../../supabase'

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

    // 1. Fetch parent Order if orderId is provided
    let parentOrder = null
    if (orderId) {
      const { data } = await supabase.from('orders').select('*').eq('id', orderId).maybeSingle()
      parentOrder = data
    }

    // 2. Determine Order Num and Child Suffix
    let parentNum = parentOrder?.order_num || 'ДОВИПУСК'
    parentNum = parentNum.split('-Д')[0] // strip existing suffix if any

    // Find existing child rerun orders for this parent
    const { data: existingChildOrders } = await supabase
      .from('orders')
      .select('order_num')
      .ilike('order_num', `${parentNum}-Д%`)

    const rerunCount = (existingChildOrders?.length || 0) + 1
    const rerunOrderNum = `${parentNum}-Д${rerunCount}`

    // 3. Create or reuse Rerun Order
    let rerunOrderObj = null
    const { data: newOrder, error: orderErr } = await supabase
      .from('orders')
      .insert([{
        order_num: rerunOrderNum,
        customer: parentOrder?.customer ? `${parentOrder.customer} (Довипуск)` : 'Довипуск Цех 1',
        status: 'in-progress',
        nomenclature_id: parentOrder?.nomenclature_id || nomenclatureId,
        planned_qty: qty,
        notes: `Довипуск через брак у Цеху №2 (${qty} шт). Батьківський наряд: ${parentNum}`
      }])
      .select()
      .single()

    if (orderErr) {
      console.error('[shop2RerunService] Error creating rerun order:', orderErr)
      throw new Error(`Помилка створення дочірнього наряду довипуску: ${orderErr.message}`)
    }
    rerunOrderObj = newOrder

    // 4. Create Task for Shop 1 (Laser Cutting)
    const { data: newNom } = await supabase.from('nomenclatures').select('*').eq('id', nomenclatureId).maybeSingle()
    const partName = newNom?.name || 'Деталь'

    const { data: newTask, error: taskErr } = await supabase
      .from('tasks')
      .insert([{
        order_id: rerunOrderObj.id,
        order_num: rerunOrderNum,
        step: 'Розкрій (Довипуск)',
        name: `Довипуск розкрою: ${partName} (${qty} шт)`,
        status: 'in-progress',
        planned_qty: qty
      }])
      .select()
      .single()

    if (taskErr) {
      console.error('[shop2RerunService] Error creating rerun task:', taskErr)
      throw new Error(`Помилка створення задачі довипуску: ${taskErr.message}`)
    }

    // 5. Create Work Card for Shop 1 Cutting Operator
    const cardInfoText = `[ДОВИПУСК / РЕВАЛІДАЦІЯ] [SHOP:1] [NEED:${qty}] Наряд №${rerunOrderNum} (${reason})`

    const { data: newCard, error: cardErr } = await supabase
      .from('work_cards')
      .insert([{
        task_id: newTask.id,
        order_id: rerunOrderObj.id,
        nomenclature_id: nomenclatureId,
        operation: 'Розкрій (Довипуск)',
        machine: '—',
        quantity: qty,
        actual_sheets: Math.ceil(qty / (newNom?.units_per_sheet || 1)),
        buffer_qty: 0,
        used_in_shop2_qty: 0,
        card_info: cardInfoText,
        status: 'new',
        is_rework: true
      }])
      .select()
      .single()

    if (cardErr) {
      console.error('[shop2RerunService] Error creating rerun work card:', cardErr)
      throw new Error(`Помилка створення картки довипуску: ${cardErr.message}`)
    }

    return {
      order: rerunOrderObj,
      task: newTask,
      card: newCard,
      rerunOrderNum
    }
  }
}
