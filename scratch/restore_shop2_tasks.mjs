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

async function run() {
  console.log("=== RESTORING SHOP 2 TASKS FOR UNFINISHED SHOP 1 ORDERS ===")

  const allTasks = await apiFetchAll('tasks', '?select=*')
  const orders = await apiFetchAll('orders', '?select=*')
  const ordersMap = new Map((orders || []).map(o => [String(o.id), o]))

  const shop1Tasks = allTasks.filter(t => t.step === 'Розкрій')
  const shop2Tasks = allTasks.filter(t => t.step?.includes('Пресування') || t.step?.includes('ЦЕХ №2'))

  let restoredCount = 0

  for (const s2Task of shop2Tasks) {
    const s1Task = shop1Tasks.find(t => String(t.order_id) === String(s2Task.order_id) && t.batch_index === s2Task.batch_index)
    
    // If Shop 1 task exists and is NOT completed, but Shop 2 task was completed -> Revert Shop 2 task to active!
    if (s1Task && s1Task.status !== 'completed' && s2Task.status === 'completed') {
      const order = ordersMap.get(String(s2Task.order_id))
      console.log(`[RESTORING SHOP 2 TASK] Order #${order?.order_num} | Shop 2 Task ID: ${s2Task.id} (Shop 1 status: ${s1Task.status})`)
      
      await apiUpdate('tasks', `?id=eq.${s2Task.id}`, {
        status: 'in-progress',
        completed_at: null
      })
      restoredCount++
    }
  }

  console.log(`\n==================================================`)
  console.log(`SUCCESS: Restored ${restoredCount} Shop 2 tasks back to active ("В РОБОТІ").`)
}

run().catch(err => console.error("RESTORE ERROR:", err))
