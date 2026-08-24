const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const headers = {
  'apikey': supabaseAnonKey,
  'Authorization': `Bearer ${supabaseAnonKey}`,
  'x-mes-secret': 'CentrumMES2026SecretKey_a9f8',
  'Content-Type': 'application/json',
  'Prefer': 'return=representation'
}

async function apiFetchAll(table, query = '') {
  let allRows = []
  let page = 0
  const pageSize = 1000
  while (true) {
    const rangeHeader = { ...headers, 'Range': `${page * pageSize}-${(page + 1) * pageSize - 1}` }
    const res = await fetch(`${supabaseUrl}/rest/v1/${table}${query}`, { headers: rangeHeader })
    if (!res.ok) {
      throw new Error(`Failed to fetch ${table}: ${res.statusText}`)
    }
    const rows = await res.json()
    allRows = allRows.concat(rows)
    if (rows.length < pageSize) break
    page++
  }
  return allRows
}

async function apiUpdate(table, query, body) {
  const res = await fetch(`${supabaseUrl}/rest/v1/${table}${query}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(body)
  })
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`Failed to update ${table}: ${res.statusText} - ${txt}`)
  }
  return res.json()
}

const EXCLUDED_ORDER_NUMS = [
  '14082026-01',
  '10082026-01',
  '260821-1'
]

const ALLOWED_PRODUCTS = [
  'F10',
  'Рама F10',
  'Рама KHARAK 10`(210)',
  'Рама KHARAK 10\'(210)',
  'Рама KHARAK 15" (325)'
]

function isAllowedProduct(productName) {
  if (!productName) return false
  const norm = productName.trim().toLowerCase()
  return ALLOWED_PRODUCTS.some(p => norm.includes(p.toLowerCase()) || p.toLowerCase().includes(norm))
}

async function run() {
  console.log("=== PROCESSING WAREHOUSE CONFIRMATION & SHOP 2 BUFFER TRANSFER ===")

  const allTasks = await apiFetchAll('tasks', '?select=*')
  const tasks = allTasks.filter(t => t.status !== 'completed')
  const orders = await apiFetchAll('orders', '?select=id,order_num,customer,nomenclature_id,order_items(id,nomenclature_id,quantity)')
  const nomenclatures = await apiFetchAll('nomenclatures', '?select=id,name,type,units_per_sheet,time_per_unit')
  const workCards = await apiFetchAll('work_cards', '?select=*')
  const materialRequests = await apiFetchAll('material_requests', '?select=*')

  const ordersMap = new Map((orders || []).map(o => [String(o.id), o]))
  const nomMap = new Map((nomenclatures || []).map(n => [String(n.id), n]))

  let tasksConfirmed = 0
  let matRequestsApproved = 0
  let cardsTransferred = 0

  for (const task of tasks) {
    const order = ordersMap.get(String(task.order_id))
    const orderNum = order?.order_num || ''
    
    if (EXCLUDED_ORDER_NUMS.includes(orderNum)) {
      console.log(`[EXCLUDED] Order #${orderNum} (Task ID: ${task.id}) is in exclusion list.`)
      continue
    }

    let productName = order?.order_items?.map(it => nomMap.get(String(it.nomenclature_id))?.name).filter(Boolean).join(', ')
    if (!productName && task.plan_snapshot) {
      productName = Object.values(task.plan_snapshot)
        .map(s => nomMap.get(String(s.id))?.name || s.name)
        .filter(Boolean)
        .join(', ')
    }

    if (!isAllowedProduct(productName)) {
      console.log(`[SKIPPED] Order #${orderNum} (Product: "${productName}") is not in target product list.`)
      continue
    }

    console.log(`\n--------------------------------------------------`)
    console.log(`[PROCESSING] Order #${orderNum} | Task ID: ${task.id} | Product: "${productName}"`)

    // 1. Confirm Warehouse on Task
    if (!task.warehouse_conf || task.warehouse_conf === 'false') {
      await apiUpdate('tasks', `?id=eq.${task.id}`, { warehouse_conf: true, engineer_conf: true, director_conf: true })
      console.log(`  --> Warehouse & Engineer confirmed for Task ID: ${task.id}`)
      tasksConfirmed++
    } else {
      console.log(`  --> Warehouse already confirmed for Task ID: ${task.id}`)
    }

    // 2. Approve Material Requests for Task
    const taskMatReqs = materialRequests.filter(r => String(r.task_id) === String(task.id) && r.status === 'pending')
    if (taskMatReqs.length > 0) {
      await apiUpdate('material_requests', `?task_id=eq.${task.id}&status=eq.pending`, { status: 'approved' })
      console.log(`  --> Approved ${taskMatReqs.length} pending material requests for Order #${orderNum}`)
      matRequestsApproved += taskMatReqs.length
    } else {
      console.log(`  --> No pending material requests for Order #${orderNum}`)
    }

    // 3. Transfer Work Cards to Shop 2 Buffer (at-shop2-buffer)
    const taskCardsToTransfer = workCards.filter(c => 
      String(c.task_id) === String(task.id) && 
      c.operation !== 'Склад БЗ' &&
      c.status !== 'completed' &&
      c.status !== 'at-shop2-buffer'
    )

    if (taskCardsToTransfer.length > 0) {
      await apiUpdate('work_cards', `?task_id=eq.${task.id}&status=neq.at-shop2-buffer&status=neq.completed&operation=neq.Склад БЗ`, { 
        status: 'at-shop2-buffer'
      })
      console.log(`  --> Transferred ${taskCardsToTransfer.length} work cards to Shop 2 Buffer (at-shop2-buffer) for Order #${orderNum}!`)
      cardsTransferred += taskCardsToTransfer.length
    } else {
      console.log(`  --> No work cards needed transfer for Order #${orderNum}`)
    }
  }

  console.log(`\n==================================================`)
  console.log(`SUCCESS:`)
  console.log(`  - Tasks Warehouse Confirmed: ${tasksConfirmed}`)
  console.log(`  - Material Requests Approved: ${matRequestsApproved}`)
  console.log(`  - Work Cards Transferred to Shop 2 Buffer: ${cardsTransferred}`)
}

run().catch(err => console.error("EXECUTION ERROR:", err))
