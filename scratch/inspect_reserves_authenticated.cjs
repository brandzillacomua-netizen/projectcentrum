const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function run() {
  const lines = []
  const log = (msg) => {
    lines.push(msg)
    console.log(msg)
  }

  log("==================================================================")
  log("    ПОВНИЙ АНАЛІЗ РЕЗЕРВІВ НА СКЛАДАХ: СО, СВ, СГП")
  log("==================================================================")

  const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'vvv@centrum.local',
    password: 'vvv'
  })
  if (authErr) {
    log(`Auth error: ${authErr.message}`)
    return
  }

  // 1. Load all orders & tasks
  const { data: orders } = await supabase.from('orders').select('id,order_number,status,client_name,created_at')
  const orderMap = new Map((orders || []).map(o => [o.id, o]))
  const orderNumMap = new Map((orders || []).map(o => [String(o.order_number).trim(), o]))
  log(`Завантажено активних замовлень у системі: ${orders?.length || 0}`)

  const { data: tasks } = await supabase.from('tasks').select('id,order_id,order_num,step,status,machine_name,warehouse_conf,plan_snapshot,created_at')
  const taskMap = new Map((tasks || []).map(t => [t.id, t]))
  log(`Завантажено нарядів (tasks) у системі: ${tasks?.length || 0}`)

  // 2. Fetch all inventory
  let allInv = []
  let from = 0
  const pageSize = 1000
  while (true) {
    const { data, error } = await supabase.from('inventory').select('*').range(from, from + pageSize - 1)
    if (error) { log(`Error fetching inventory: ${error.message}`); break }
    if (!data || data.length === 0) break
    allInv = allInv.concat(data)
    if (data.length < pageSize) break
    from += pageSize
  }
  log(`Всього позицій на всіх складах (таблиця inventory): ${allInv.length}`)

  // 3. Filter items with reserved_qty > 0
  const reservedItems = allInv.filter(i => Number(i.reserved_qty) > 0)
  log(`Позицій із reserved_qty > 0: ${reservedItems.length}`)

  // Breakdown by warehouse / type:
  // СО: warehouse === 'operational'
  // СВ: warehouse === 'production'
  // СГП: warehouse === 'sgp' OR type in ['finished', 'bz', 'part']
  const soReserved = reservedItems.filter(i => i.warehouse === 'operational')
  const svReserved = reservedItems.filter(i => i.warehouse === 'production')
  const sgpReserved = reservedItems.filter(i => i.warehouse === 'sgp' || ['finished', 'bz', 'wip_bz', 'part'].includes(i.type))

  log(`\n------------------------------------------------------------------`)
  log(`  1. РЕЗЕРВИ НА СО (Склад Оперативний) — ${soReserved.length} позицій`)
  log(`------------------------------------------------------------------`)
  soReserved.forEach(i => {
    log(`• [СО] "${i.name}" (тип: ${i.type}): Всього = ${i.total_qty}, В РЕЗЕРВІ = ${i.reserved_qty} ${i.unit || 'шт'} (ID: ${i.id})`)
  })

  log(`\n------------------------------------------------------------------`)
  log(`  2. РЕЗЕРВИ НА СВ (Склад Виробництва) — ${svReserved.length} позицій`)
  log(`------------------------------------------------------------------`)
  svReserved.forEach(i => {
    log(`• [СВ] "${i.name}" (тип: ${i.type}): Всього = ${i.total_qty}, В РЕЗЕРВІ = ${i.reserved_qty} ${i.unit || 'шт'} (ID: ${i.id})`)
  })

  log(`\n------------------------------------------------------------------`)
  log(`  3. РЕЗЕРВИ НА СГП (Склад Готової Продукції) — ${sgpReserved.length} позицій`)
  log(`------------------------------------------------------------------`)
  sgpReserved.forEach(i => {
    log(`• [СГП / ${i.type}] "${i.name}": Всього = ${i.total_qty}, В РЕЗЕРВІ = ${i.reserved_qty} ${i.unit || 'шт'} (ID: ${i.id})`)
  })

  // 4. Check material_requests
  const { data: allReqs } = await supabase.from('material_requests').select('*')
  log(`\n------------------------------------------------------------------`)
  log(`  4. ЗАПИТИ МАТЕРІАЛІВ (material_requests) — Всього ${allReqs?.length || 0} рядків`)
  log(`------------------------------------------------------------------`)
  const activeReqs = (allReqs || []).filter(r => ['pending', 'approved', 'reserved', 'issued'].includes(r.status))
  log(`Активних запитів (pending/approved/reserved/issued): ${activeReqs.length}`)

  const hangingReqs = []
  activeReqs.forEach(r => {
    const task = r.task_id ? taskMap.get(r.task_id) : null
    let order = r.order_id ? orderMap.get(r.order_id) : null
    if (!order && r.order_num) order = orderNumMap.get(String(r.order_num).trim())

    const isTaskMissing = r.task_id && !task
    const isTaskClosed = task && ['completed', 'cancelled'].includes(task.status)
    const isOrderMissing = (r.order_id || r.order_num) && !order
    const isOrderClosed = order && ['completed', 'delivered', 'shipped', 'cancelled'].includes(order.status)

    if (isTaskMissing || isTaskClosed || isOrderMissing || isOrderClosed) {
      hangingReqs.push({
        req: r,
        task,
        order,
        reason: isTaskMissing ? 'НАРЯД ВИДАЛЕНО' : (isTaskClosed ? `НАРЯД ЗАВЕРШЕНО (${task.status})` : (isOrderMissing ? 'ЗАМОВЛЕННЯ ВИДАЛЕНО' : `ЗАМОВЛЕННЯ ЗАКРИТО (${order.status})`))
      })
    }
  })

  log(`⚠️ Завислих запитів на матеріали (під видалені/завершені наряди чи замовлення): ${hangingReqs.length}`)
  hangingReqs.forEach(h => {
    log(`   - Запит ID ${h.req.id}: "${h.req.material_name}" — ${h.req.quantity} ${h.req.unit || 'шт'} [${h.req.status}] | Замовлення: ${h.req.order_num || h.req.order_id} | Наряд: ${h.req.task_id || '—'} | ПРИЧИНА: ${h.reason}`)
  })

  // 5. Check bz_inventory_reservations
  const { data: bzRes } = await supabase.from('bz_inventory_reservations').select('*')
  log(`\n------------------------------------------------------------------`)
  log(`  5. БРОНІ БЗ/СГП (bz_inventory_reservations) — Всього ${bzRes?.length || 0} рядків`)
  log(`------------------------------------------------------------------`)
  const allocatedBz = (bzRes || []).filter(b => b.status === 'allocated')
  log(`Записів зі статусом 'allocated': ${allocatedBz.length}`)

  const hangingBz = []
  allocatedBz.forEach(b => {
    const task = b.task_id ? taskMap.get(b.task_id) : null
    const order = b.order_id ? orderMap.get(b.order_id) : null
    const isTaskMissing = b.task_id && !task
    const isTaskClosed = task && ['completed', 'cancelled'].includes(task.status)
    const isOrderMissing = b.order_id && !order
    const isOrderClosed = order && ['completed', 'delivered', 'shipped', 'cancelled'].includes(order.status)

    if (isTaskMissing || isTaskClosed || isOrderMissing || isOrderClosed || !b.task_id) {
      hangingBz.push({
        b,
        task,
        order,
        reason: !b.task_id ? 'БЕЗ НАРЯДУ (task_id=null)' : (isTaskMissing ? 'НАРЯД ВИДАЛЕНО' : (isTaskClosed ? `НАРЯД ЗАВЕРШЕНО (${task.status})` : (isOrderMissing ? 'ЗАМОВЛЕННЯ ВИДАЛЕНО' : `ЗАМОВЛЕННЯ ЗАКРИТО (${order.status})`)))
      })
    }
  })

  log(`⚠️ Завислих броней БЗ під видалені/завершені наряди: ${hangingBz.length}`)
  hangingBz.slice(0, 20).forEach(h => {
    log(`   - Бронь ID ${h.b.id}: Замовлення ${h.b.order_id} | Наряд ${h.b.task_id || '—'} | К-сть: ${h.b.allocated_qty || h.b.requested_qty} шт | ПРИЧИНА: ${h.reason}`)
  })
  if (hangingBz.length > 20) {
    log(`   ... і ще ${hangingBz.length - 20} таких записів`)
  }

  // 6. Cross-reference: which inventory items have reserved_qty > 0 but NO active requests or tasks?
  log(`\n------------------------------------------------------------------`)
  log(`  6. ЗВЕДЕНИЙ АНАЛІЗ РОЗБІЖНОСТЕЙ РЕЗЕРВІВ В INVENTORY`)
  log(`------------------------------------------------------------------`)
  let mismatchesCount = 0
  for (const inv of reservedItems) {
    // Check if there are active valid requests for this item
    const validRequestsForThisItem = activeReqs.filter(r => 
      (r.inventory_id && String(r.inventory_id) === String(inv.id)) ||
      (r.nomenclature_id && String(r.nomenclature_id) === String(inv.nomenclature_id))
    ).filter(r => !hangingReqs.some(h => h.req.id === r.id))

    // Check if there are valid active BZ reservations
    const validBzForThisItem = allocatedBz.filter(b =>
      String(b.nomenclature_id) === String(inv.nomenclature_id)
    ).filter(b => !hangingBz.some(h => h.b.id === b.id))

    const activeReqQty = validRequestsForThisItem.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0)
    const activeBzQty = validBzForThisItem.reduce((sum, b) => sum + (Number(b.allocated_qty || b.requested_qty) || 0), 0)
    const expectedReserve = activeReqQty + activeBzQty

    if (Number(inv.reserved_qty) !== expectedReserve) {
      mismatchesCount++
      const wh = inv.warehouse === 'operational' ? 'СО' : (inv.warehouse === 'production' ? 'СВ' : (inv.warehouse === 'sgp' ? 'СГП' : inv.type))
      log(`⚠️ РОЗБІЖНІСТЬ [${wh}] "${inv.name}": в базі reserved_qty = ${inv.reserved_qty}, але реальних активних нарядів/запитів = ${expectedReserve} (Фантомний резерв: ${Number(inv.reserved_qty) - expectedReserve})`)
    }
  }

  log(`\nВсього знайдено розбіжностей / фантомних резервів: ${mismatchesCount} із ${reservedItems.length}`)

  fs.writeFileSync('scratch/authenticated_reserves_report.txt', lines.join('\n'), 'utf8')
  log(`\nЗвіт записано у scratch/authenticated_reserves_report.txt`)
}

run().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); })
