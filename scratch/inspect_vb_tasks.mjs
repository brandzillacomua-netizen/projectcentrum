const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const headers = {
  'apikey': supabaseAnonKey,
  'Authorization': `Bearer ${supabaseAnonKey}`,
  'x-mes-secret': 'CentrumMES2026SecretKey_a9f8',
  'Content-Type': 'application/json'
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

async function run() {
  console.log("=== INSPECTING VB ORDERS AND TASKS ===")
  const orders = await apiFetchAll('orders', '?select=*')
  const vbOrders = orders.filter(o => o.order_num?.startsWith('ВБ'))
  const vbOrderIds = vbOrders.map(o => String(o.id))

  const tasks = await apiFetchAll('tasks', '?select=*')
  const vbTasks = tasks.filter(t => vbOrderIds.includes(String(t.order_id)))

  console.log(`Found ${vbOrders.length} VB orders. Tasks:`)
  for (const t of vbTasks) {
    const order = vbOrders.find(o => String(o.id) === String(t.order_id))
    console.log(`Task ID: ${t.id} | Order #${order?.order_num} | Step: "${t.step}" | Status: ${t.status}`)
  }
}

run().catch(err => console.error(err))
