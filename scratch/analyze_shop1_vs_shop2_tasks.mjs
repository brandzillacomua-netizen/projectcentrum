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
  console.log("=== ANALYZING SHOP 1 VS SHOP 2 TASKS FOR 260820-3, 260820-2, 260819-2 ===")

  const orderNums = ['260820-3', '260820-2', '260819-2']
  const orders = await apiFetchAll('orders', '?select=*')
  const matchedOrders = orders.filter(o => orderNums.includes(o.order_num))
  const matchedOrderIds = matchedOrders.map(o => String(o.id))

  const tasks = await apiFetchAll('tasks', '?select=*')
  const matchedTasks = tasks.filter(t => matchedOrderIds.includes(String(t.order_id)))

  for (const o of matchedOrders) {
    console.log(`\nOrder #${o.order_num} (Order ID: ${o.id}) | Customer: ${o.customer}`)
    const oTasks = matchedTasks.filter(t => String(t.order_id) === String(o.id))
    for (const t of oTasks) {
      console.log(`  Task ID: ${t.id} | Step: "${t.step}" | Status: ${t.status} | CreatedAt: ${t.created_at}`)
    }
  }
}

run().catch(err => console.error(err))
