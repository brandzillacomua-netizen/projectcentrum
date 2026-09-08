const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = 'https://hurzutjytlcvtbvihnry.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  global: {
    headers: {
      'x-mes-secret': 'CentrumMES2026SecretKey_a9f8'
    }
  }
})

async function inspectReserves() {
  console.log("=== INSPECTING RESERVES: СО, СВ, СГП ===")

  // 1. Fetch tasks and orders
  const { data: tasks, error: tErr } = await supabase.from('tasks').select('id,order_id,order_num,step,status,machine_name,warehouse_conf,plan_snapshot,created_at')
  if (tErr) console.error("Error fetching tasks:", tErr)
  const taskMap = new Map((tasks || []).map(t => [t.id, t]))

  const { data: orders, error: oErr } = await supabase.from('orders').select('id,order_number,status,client_name,created_at')
  if (oErr) console.error("Error fetching orders:", oErr)
  const orderMap = new Map((orders || []).map(o => [o.id, o]))
  const orderNumMap = new Map((orders || []).map(o => [String(o.order_number).trim(), o]))

  console.log(`Loaded ${tasks?.length || 0} tasks and ${orders?.length || 0} orders.`)

  // 2. Inventory (СО & СВ)
  const { data: invItems, error: invErr } = await supabase
    .from('inventory')
    .select('id,warehouse,name,total_qty,reserved_qty,unit,details,nomenclature_id')
    .gt('reserved_qty', 0)
  
  if (invErr) console.error("Error fetching inventory:", invErr)
  console.log(`\n--- INVENTORY (СО & СВ) with reserved_qty > 0: ${invItems?.length || 0} items ---`)
  if (invItems && invItems.length > 0) {
    invItems.forEach(item => {
      const whName = item.warehouse === 'operational' ? 'СО (Оперативний)' : (item.warehouse === 'production' ? 'СВ (Виробництва)' : item.warehouse)
      console.log(`- [${whName}] ID: ${item.id} | ${item.name}: ВСЬОГО=${item.total_qty}, РЕЗЕРВ=${item.reserved_qty} ${item.unit || 'шт'}`)
    })
  }

  // 3. Warehouse FGP Inventory (СГП)
  const { data: fgpItems, error: fgpErr } = await supabase
    .from('warehouse_fgp_inventory')
    .select('id,name,type,total_qty,reserved_qty,unit,article,nomenclature_id')
    .gt('reserved_qty', 0)

  if (fgpErr) console.error("Error fetching warehouse_fgp_inventory:", fgpErr)
  console.log(`\n--- SGP (СГП) with reserved_qty > 0: ${fgpItems?.length || 0} items ---`)
  if (fgpItems && fgpItems.length > 0) {
    fgpItems.forEach(item => {
      console.log(`- [СГП - ${item.type}] ID: ${item.id} | ${item.name}: ВСЬОГО=${item.total_qty}, РЕЗЕРВ=${item.reserved_qty} ${item.unit || 'шт'}`)
    })
  }

  // 4. Material Requests (Active: pending, approved, reserved)
  const { data: matReqs, error: mrErr } = await supabase
    .from('material_requests')
    .select('id,order_id,order_num,task_id,status,material_name,quantity,unit,type,created_at,note')
    .in('status', ['pending', 'approved', 'reserved'])
  
  if (mrErr) console.error("Error fetching material_requests:", mrErr)
  console.log(`\n--- ACTIVE MATERIAL REQUESTS (pending/approved/reserved): ${matReqs?.length || 0} requests ---`)
  if (matReqs && matReqs.length > 0) {
    matReqs.forEach(req => {
      const task = req.task_id ? taskMap.get(req.task_id) : null
      const taskStatus = task ? `Task: ${task.step} [${task.status}]` : (req.task_id ? 'TASK_DELETED / NOT FOUND' : 'NO_TASK')
      
      let order = req.order_id ? orderMap.get(req.order_id) : null
      if (!order && req.order_num) order = orderNumMap.get(String(req.order_num).trim())
      const orderStatus = order ? `Order: ${order.order_number} [${order.status}]` : 'ORDER_NOT_FOUND'

      const isHanging = (!task && req.task_id) || (task && ['completed', 'cancelled'].includes(task.status)) || (!order && !task)

      console.log(`- [REQ ${req.id}] Status: ${req.status} | ${req.material_name}: ${req.quantity} ${req.unit || 'шт'} | Order: ${req.order_num || req.order_id} (${orderStatus}) | Task: ${req.task_id} (${taskStatus}) ${isHanging ? '⚠️ HANGING / ORPHAN' : '✅ ACTIVE'}`)
    })
  }

  // 5. Purchase Requests (pending, ordered, partially_received)
  const { data: purchReqs, error: prErr } = await supabase
    .from('purchase_requests')
    .select('id,order_id,order_num,task_id,status,destination_warehouse,items,created_at')
    .in('status', ['pending', 'ordered', 'partially_received'])
  
  if (prErr) console.error("Error fetching purchase_requests:", prErr)
  console.log(`\n--- ACTIVE PURCHASE REQUESTS: ${purchReqs?.length || 0} requests ---`)
  if (purchReqs && purchReqs.length > 0) {
    purchReqs.forEach(pr => {
      const task = pr.task_id ? taskMap.get(pr.task_id) : null
      const taskStatus = task ? `Task [${task.status}]` : (pr.task_id ? 'TASK_NOT_FOUND' : 'NO_TASK')
      console.log(`- [PURCHASE ${pr.id}] Status: ${pr.status}, Dest: ${pr.destination_warehouse} | Order: ${pr.order_num} | Task: ${taskStatus}`)
    })
  }

  // 6. bz_inventory_reservations
  const { data: bzRes, error: bzErr } = await supabase
    .from('bz_inventory_reservations')
    .select('*')
  
  if (bzErr) console.log("bz_inventory_reservations query:", bzErr.message)
  else {
    console.log(`\n--- BZ INVENTORY RESERVATIONS: ${bzRes?.length || 0} rows ---`)
    bzRes?.forEach(b => {
      const task = b.task_id ? taskMap.get(b.task_id) : null
      const taskStatus = task ? `Task [${task.status}]` : (b.task_id ? 'TASK_NOT_FOUND' : 'NO_TASK')
      console.log(`- [BZ RES ${b.id}] Part: ${b.part_id || b.nomenclature_id}, Qty: ${b.quantity} | Order: ${b.order_id} | Task: ${b.task_id} (${taskStatus})`)
    })
  }

  // 7. Check Task plan_snapshots for stock deductions on tasks that are deleted or completed or cancelled
  console.log(`\n--- CHECKING TASKS PLAN SNAPSHOTS (stock_deducted / bz_allocations) ---`)
  let deductionsFound = 0
  tasks?.forEach(t => {
    if (!t.plan_snapshot) return
    const snapshot = typeof t.plan_snapshot === 'string' ? JSON.parse(t.plan_snapshot) : t.plan_snapshot
    if (snapshot.stock_deductions || snapshot.bz_stock_deductions) {
      deductionsFound++
      console.log(`- Task ${t.id} (${t.step}, status: ${t.status}, order: ${t.order_num}): has stock deductions in snapshot`)
    }
  })
  console.log(`Found ${deductionsFound} tasks with stock deductions in plan_snapshot.`)
}

inspectReserves().then(() => process.exit(0)).catch(err => {
  console.error(err)
  process.exit(1)
})
