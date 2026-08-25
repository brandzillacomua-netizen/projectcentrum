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
  console.log("=== CHECKING AND SYNCING BZ INVENTORY DEDUCTIONS ===")

  // 1. Fetch all work_cards with operation 'Склад БЗ'
  const bzCards = await apiFetchAll('work_cards', '?operation=eq.Склад БЗ&select=*')
  console.log(`Found ${bzCards.length} BZ work cards in system.`)

  // 2. Group total BZ quantities allocated per nomenclature_id
  const allocatedByNom = {}
  bzCards.forEach(c => {
    const nomId = String(c.nomenclature_id)
    const qty = Number(c.quantity) || 0
    allocatedByNom[nomId] = (allocatedByNom[nomId] || 0) + qty
  })

  console.log("Total BZ allocated per nomenclature_id:", allocatedByNom)

  // 3. Fetch current inventory items of type 'bz'
  const bzInventory = await apiFetchAll('inventory', '?type=eq.bz&select=*')
  console.log(`Found ${bzInventory.length} inventory records of type 'bz'.`)

  // Check specific item for "Рама (інд.проект 27), F415, Київ К" parts
  const nomenclatures = await apiFetchAll('nomenclatures', '?select=id,name')
  const nomMap = new Map(nomenclatures.map(n => [String(n.id), n]))

  let totalUpdated = 0

  for (const inv of bzInventory) {
    const nomId = String(inv.nomenclature_id)
    const nom = nomMap.get(nomId)
    const allocated = allocatedByNom[nomId] || 0
    const currentQty = Number(inv.total_qty) || 0

    console.log(`Nom: ${nom?.name || inv.name || nomId} | Current BZ Inventory: ${currentQty} | BZ Cards Allocated: ${allocated}`)

    // If there is allocated BZ stock in work cards and inventory total_qty > 0
    if (allocated > 0 && currentQty > 0) {
      // Deduct the allocated quantity
      const newQty = Math.max(0, currentQty - allocated)
      console.log(`   -> Updating BZ inventory from ${currentQty} to ${newQty} (deducted ${allocated} pcs)`)
      await apiUpdate('inventory', `?id=eq.${inv.id}`, { total_qty: newQty })
      totalUpdated++
    }
  }

  console.log(`=== DONE. Updated ${totalUpdated} BZ inventory items. ===`)
}

run().catch(err => console.error("SYNC ERROR:", err))
