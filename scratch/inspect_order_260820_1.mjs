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
  const taskId = 'a5233ee9-eb06-4eee-9974-5c5bf0b17cdb'
  const allTasks = await apiFetchAll('tasks', `?select=*&id=eq.${taskId}`)
  const task = allTasks[0]

  const nomenclatures = await apiFetchAll('nomenclatures', '?select=*')
  const workCards = await apiFetchAll('work_cards', `?select=*&task_id=eq.${taskId}`)
  const history = await apiFetchAll('work_card_history', '?select=*')

  const nomMap = new Map((nomenclatures || []).map(n => [String(n.id), n]))

  console.log("=== INSPECTING TASK 260820-1 (Task ID: " + taskId + ") ===")
  console.log("Task Status:", task.status)
  console.log("Snapshot:", JSON.stringify(task.plan_snapshot, null, 2))

  const snapshot = task.plan_snapshot || {}
  const cardIdsStrings = workCards.map(c => String(c.id))
  const taskHistory = (history || []).filter(h => h.card_id && cardIdsStrings.includes(String(h.card_id)))

  const partIds = Object.keys(snapshot).filter(idStr => {
    if (idStr.startsWith('_') || ['materialSummary', 'arrivals', 'arrival_doc_id', 'arrival_doc', 'nomenclatures', 'selectedCutters', 'consumables'].includes(idStr)) return false
    const snap = snapshot[idStr]
    return snap && typeof snap === 'object' && Number(snap.need || 0) > 0
  })

  for (const nomIdStr of partIds) {
    const snap = snapshot[nomIdStr]
    const need = Number(snap?.need) || 0
    const nom = nomMap.get(String(nomIdStr)) || nomMap.get(String(snap?.id))

    const activeCards = workCards.filter(c => String(c.nomenclature_id) === String(nom?.id || nomIdStr))
    const groupHistory = taskHistory.filter(h => activeCards.some(c => String(c.id) === String(h.card_id)))
    const initialScrap = groupHistory.reduce((sum, h) => sum + (Number(h.scrap_qty) || 0), 0)

    console.log(`\nPart: ${nom?.name || nomIdStr}`)
    console.log(`  Need: ${need} | Plan: ${snap.plan} | Sheets: ${snap.sheets} | Stock: ${snap.stock}`)
    console.log(`  Active Cards Count: ${activeCards.length}`)
    activeCards.forEach(c => {
      console.log(`    Card ID: ${c.id} | Status: ${c.status} | Qty: ${c.quantity} | Operation: ${c.operation} | Info: ${c.card_info}`)
    })
    console.log(`  Scrap Qty in History: ${initialScrap}`)
  }
}

run().catch(err => console.error(err))
