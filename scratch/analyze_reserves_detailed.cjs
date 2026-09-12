const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')

const SUPABASE_URL = 'https://hurzutjytlcvtbvihnry.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  global: {
    headers: {
      'x-mes-secret': 'REVOKED_MES_SECRET_DO_NOT_USE'
    }
  }
})

async function analyze() {
  const report = []
  const log = (msg) => {
    report.push(msg)
    console.log(msg)
  }

  log("=================================================================")
  log("        ДЕТАЛЬНИЙ АНАЛІЗ РЕЗЕРВІВ ТА ЗАВИСЛИХ НАРЯДІВ")
  log("=================================================================")

  // 1. Tasks & Orders
  const { data: tasks } = await supabase.from('tasks').select('id,order_id,order_num,step,status,machine_name,warehouse_conf,created_at')
  const taskMap = new Map((tasks || []).map(t => [t.id, t]))

  const { data: orders } = await supabase.from('orders').select('id,order_number,status,client_name')
  const orderMap = new Map((orders || []).map(o => [o.id, o]))
  const orderNumMap = new Map((orders || []).map(o => [String(o.order_number).trim(), o]))

  // 2. Inventory (СО & СВ)
  const { data: invItems } = await supabase.from('inventory').select('*').gt('reserved_qty', 0)
  log(`\n1. СКЛАДИ СО ТА СВ (Таблиця inventory, де reserved_qty > 0):`)
  log(`Знайдено позицій з ненульовим резервом: ${invItems?.length || 0}`)
  
  if (invItems && invItems.length > 0) {
    invItems.forEach(i => {
      const wh = i.warehouse === 'operational' ? 'СО (Склад Оперативний)' : (i.warehouse === 'production' ? 'СВ (Склад Виробництва)' : i.warehouse)
      log(`   • [${wh}] "${i.name}": Всього=${i.total_qty}, В резерві=${i.reserved_qty} ${i.unit || 'шт'} (ID: ${i.id})`)
    })
  } else {
    log(`   ✅ На СО та СВ немає позицій із завислим статичним reserved_qty.`)
  }

  // 3. SGP (Склад готової продукції)
  const { data: sgpItems } = await supabase.from('warehouse_fgp_inventory').select('*').gt('reserved_qty', 0)
  log(`\n2. СГП (Таблиця warehouse_fgp_inventory, де reserved_qty > 0):`)
  log(`Знайдено позицій з ненульовим резервом: ${sgpItems?.length || 0}`)

  if (sgpItems && sgpItems.length > 0) {
    sgpItems.forEach(i => {
      log(`   • [СГП / ${i.type}] "${i.name}" (арт. ${i.article || '—'}): Всього=${i.total_qty}, В резерві=${i.reserved_qty} ${i.unit || 'шт'} (ID: ${i.id})`)
    })
  } else {
    log(`   ✅ На СГП немає позицій із ненульовим статичним reserved_qty.`)
  }

  // 4. Material Requests
  const { data: matReqs } = await supabase.from('material_requests').select('*').in('status', ['pending', 'approved', 'reserved'])
  log(`\n3. АКТИВНІ ЗАПИТИ МАТЕРІАЛІВ (Таблиця material_requests, статуси pending / approved / reserved):`)
  log(`Всього активних запитів: ${matReqs?.length || 0}`)

  const hangingReqs = []
  const activeReqs = []

  matReqs?.forEach(r => {
    const task = r.task_id ? taskMap.get(r.task_id) : null
    let order = r.order_id ? orderMap.get(r.order_id) : null
    if (!order && r.order_num) order = orderNumMap.get(String(r.order_num).trim())

    const isTaskDeleted = r.task_id && !task
    const isTaskDone = task && ['completed', 'cancelled'].includes(task.status)
    const isOrderDeleted = !order && (r.order_id || r.order_num)
    const isOrderDone = order && ['completed', 'delivered', 'shipped', 'cancelled'].includes(order.status)

    if (isTaskDeleted || isTaskDone || isOrderDeleted || isOrderDone) {
      hangingReqs.push({ req: r, task, order, reason: isTaskDeleted ? 'НАРЯД ВИДАЛЕНО' : (isTaskDone ? `НАРЯД ЗАВЕРШЕНО (${task.status})` : (isOrderDeleted ? 'ЗАМОВЛЕННЯ ВИДАЛЕНО' : `ЗАМОВЛЕННЯ ЗАКРИТО (${order.status})`)) })
    } else {
      activeReqs.push({ req: r, task, order })
    }
  })

  log(`   ⚠️ Завислих запитів (під видалені/завершені наряди або замовлення): ${hangingReqs.length}`)
  hangingReqs.forEach(h => {
    log(`      - Запит ID ${h.req.id}: "${h.req.material_name}" — ${h.req.quantity} ${h.req.unit || 'шт'} | Статус: ${h.req.status} | Замовлення: ${h.req.order_num || h.req.order_id} | Наряд ID: ${h.req.task_id || '—'} | ПРИЧИНА: ${h.reason}`)
  })

  log(`   ✅ Легітимних активних запитів: ${activeReqs.length}`)
  activeReqs.forEach(a => {
    log(`      - Запит ID ${a.req.id}: "${a.req.material_name}" — ${a.req.quantity} ${a.req.unit || 'шт'} | Статус: ${a.req.status} | Замовлення: ${a.req.order_num} | Наряд: ${a.task ? a.task.step + ' (' + a.task.status + ')' : 'без наряду'}`)
  })

  // 5. bz_inventory_reservations
  const { data: bzRes } = await supabase.from('bz_inventory_reservations').select('*')
  log(`\n4. РЕЗЕРВИ БЗ / СГП (Таблиця bz_inventory_reservations):`)
  log(`Всього записів у bz_inventory_reservations: ${bzRes?.length || 0}`)

  const hangingBz = []
  const validBz = []
  bzRes?.forEach(b => {
    const task = b.task_id ? taskMap.get(b.task_id) : null
    const order = b.order_id ? orderMap.get(b.order_id) : null

    const isTaskDeleted = b.task_id && !task
    const isTaskDone = task && ['completed', 'cancelled'].includes(task.status)
    const isOrderDeleted = b.order_id && !order

    if (isTaskDeleted || isTaskDone || isOrderDeleted || !b.task_id) {
      hangingBz.push({ bz: b, task, order, reason: !b.task_id ? 'БЕЗ НАРЯДУ (task_id is null)' : (isTaskDeleted ? 'НАРЯД ВИДАЛЕНО' : (isTaskDone ? `НАРЯД ЗАВЕРШЕНО (${task.status})` : 'ЗАМОВЛЕННЯ ВИДАЛЕНО')) })
    } else {
      validBz.push({ bz: b, task, order })
    }
  })

  log(`   ⚠️ Завислих/сирітських записів БЗ: ${hangingBz.length}`)
  hangingBz.slice(0, 15).forEach(h => {
    log(`      - БЗ Резерв ID ${h.bz.id}: Part: ${h.bz.part_id || h.bz.nomenclature_id} | Qty: ${h.bz.quantity || h.bz.qty || 'не вказано'} | Причина: ${h.reason}`)
  })
  if (hangingBz.length > 15) {
    log(`      ... та ще ${hangingBz.length - 15} записів`)
  }

  log(`   ✅ Активних прив'язаних до живих нарядів: ${validBz.length}`)

  // 6. Purchase requests
  const { data: purchReqs } = await supabase.from('purchase_requests').select('*').in('status', ['pending', 'ordered', 'partially_received'])
  log(`\n5. ЗАЯВКИ НА ЗАКУПІВЛЮ / ПЕРЕМІЩЕННЯ СВ ➔ СО (purchase_requests):`)
  log(`Всього активних: ${purchReqs?.length || 0}`)
  const hangingPurch = []
  purchReqs?.forEach(p => {
    const task = p.task_id ? taskMap.get(p.task_id) : null
    let order = p.order_id ? orderMap.get(p.order_id) : null
    if (!order && p.order_num) order = orderNumMap.get(String(p.order_num).trim())

    const isTaskDeleted = p.task_id && !task
    const isTaskDone = task && ['completed', 'cancelled'].includes(task.status)
    const isOrderDeleted = !order && (p.order_id || p.order_num)

    if (isTaskDeleted || isTaskDone || isOrderDeleted) {
      hangingPurch.push({ p, reason: isTaskDeleted ? 'НАРЯД ВИДАЛЕНО' : (isTaskDone ? `НАРЯД ЗАВЕРШЕНО (${task.status})` : 'ЗАМОВЛЕННЯ ВИДАЛЕНО') })
    }
  })
  log(`   ⚠️ Завислих заявок на закупівлю: ${hangingPurch.length}`)
  hangingPurch.forEach(hp => {
    log(`      - Заявка ID ${hp.p.id}: Замовлення ${hp.p.order_num} | Склад: ${hp.p.destination_warehouse} | ПРИЧИНА: ${hp.reason}`)
  })

  fs.writeFileSync('scratch/reserves_report.txt', report.join('\n'), 'utf8')
  log(`\nЗвіт збережено у scratch/reserves_report.txt`)
}

analyze().then(() => process.exit(0)).catch(err => {
  console.error(err)
  process.exit(1)
})
