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

async function apiInsert(table, body) {
  const res = await fetch(`${supabaseUrl}/rest/v1/${table}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  })
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`Failed to insert into ${table}: ${res.statusText} - ${txt}`)
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
  console.log("=== EXECUTING BATCH REISSUE CARD GENERATION ===")

  const allTasks = await apiFetchAll('tasks', '?select=*')
  const tasks = allTasks.filter(t => t.status !== 'completed')
  const orders = await apiFetchAll('orders', '?select=id,order_num,customer,nomenclature_id,order_items(id,nomenclature_id,quantity)')
  const nomenclatures = await apiFetchAll('nomenclatures', '?select=id,name,type,units_per_sheet,time_per_unit,material_type')
  const workCards = await apiFetchAll('work_cards', '?select=*')
  const history = await apiFetchAll('work_card_history', '?select=*')
  const machines = await apiFetchAll('machines', '?select=*')

  const ordersMap = new Map((orders || []).map(o => [String(o.id), o]))
  const nomMap = new Map((nomenclatures || []).map(n => [String(n.id), n]))

  let totalCardsCreated = 0

  for (const task of tasks) {
    const order = ordersMap.get(String(task.order_id))
    const orderNum = order?.order_num || ''
    
    if (EXCLUDED_ORDER_NUMS.includes(orderNum)) continue

    let productName = order?.order_items?.map(it => nomMap.get(String(it.nomenclature_id))?.name).filter(Boolean).join(', ')
    if (!productName && task.plan_snapshot) {
      productName = Object.values(task.plan_snapshot)
        .map(s => nomMap.get(String(s.id))?.name || s.name)
        .filter(Boolean)
        .join(', ')
    }

    if (!isAllowedProduct(productName)) continue

    const snapshot = task.plan_snapshot || {}
    const taskCards = (workCards || []).filter(c => String(c.task_id) === String(task.id) && c.operation !== 'Склад БЗ')
    const taskHistory = (history || []).filter(h => taskCards.some(c => String(c.id) === String(h.card_id)))

    const partIds = Object.keys(snapshot).filter(idStr => {
      if (idStr.startsWith('_') || ['materialSummary', 'arrivals', 'arrival_doc_id', 'arrival_doc', 'nomenclatures', 'selectedCutters', 'consumables'].includes(idStr)) return false
      const snap = snapshot[idStr]
      return snap && typeof snap === 'object' && Number(snap.need || 0) > 0
    })

    for (const nomIdStr of partIds) {
      const snap = snapshot[nomIdStr]
      const need = Number(snap?.need) || 0
      const nom = nomMap.get(String(nomIdStr)) || nomMap.get(String(snap?.id))
      if (!nom || nom.type !== 'part') continue

      const targetNomId = String(nom.id)
      const activeCards = taskCards.filter(c => String(c.nomenclature_id) === targetNomId)
      
      const unitsPerSheet = Number(nom.units_per_sheet) || 1
      const plan = Number(snap.plan || snap.need || need) || 0
      const sheets = Number(snap.sheets || snap.count || snap.sheets_count) || Math.ceil(plan / unitsPerSheet)
      const stockBZ = Number(snap.stock) || 0

      const plannedTotalQty = (sheets * unitsPerSheet) + stockBZ
      const spareFromSheets = plannedTotalQty - need

      const cardIdsStrings = activeCards.map(c => String(c.id))
      const groupHistory = taskHistory.filter(h => h.card_id && cardIdsStrings.includes(String(h.card_id)))
      const initialScrap = groupHistory.reduce((sum, h) => sum + (Number(h.scrap_qty) || 0), 0)

      let returned = 0
      activeCards.forEach(c => {
        const info = c.card_info || ''
        const matches = info.match(/\[VKYA_(?:RESTORED_)?RETURN:[^:]+:(\d+)\]/g)
        if (matches) {
          matches.forEach(m => {
            const q = m.match(/(\d+)\]$/)
            if (q) returned += parseInt(q[1])
          })
        }
      })

      const safeReturned = Math.min(initialScrap, returned)
      const utilScrap = Math.max(0, initialScrap - safeReturned)

      const shortage = Math.max(0, Math.ceil(utilScrap - spareFromSheets))

      if (shortage > 0) {
        const activeCardMachine = activeCards[0]?.machine || snap?.machine
        const machineObj = (machines || []).find(m => m.name === activeCardMachine)
        const capacity = machineObj?.sheet_capacity || 4

        const sheetsNeeded = Math.ceil(shortage / unitsPerSheet)
        const cardsNeeded = Math.ceil(sheetsNeeded / capacity)
        const machineName = activeCardMachine || 'CNC 3050(16)х16 - 3-12 листів (швидкісний)'

        console.log(`\nGenerating REDO Cards for Order #${orderNum} (${nom.name}):`)
        console.log(`  Shortage: ${shortage} pcs -> ${sheetsNeeded} sheets -> ${cardsNeeded} cards on ${machineName}`)

        let sheetsRemaining = sheetsNeeded
        let reqRemaining = shortage

        const cardsToInsert = []
        for (let i = 1; i <= cardsNeeded; i++) {
          const sheetsInCard = Math.min(sheetsRemaining, capacity)
          if (sheetsInCard <= 0) break
          const qtyInCard = Math.ceil(sheetsInCard * unitsPerSheet)
          const reqInCard = Math.min(qtyInCard, reqRemaining)
          const bzInCard = Math.max(0, qtyInCard - reqInCard)

          const cardRecord = {
            task_id: task.id,
            order_id: task.order_id,
            nomenclature_id: nom.id,
            operation: 'Розкрій',
            machine: machineName,
            estimated_time: (Number(nom.time_per_unit) || 0) * reqInCard * 60,
            card_info: `[REDO] ${i}/${cardsNeeded}${need > 0 ? ` [NEED:${need}]` : ''} [REQ:${reqInCard}] [BZ:${bzInCard}]`,
            quantity: qtyInCard,
            status: 'waiting-materials',
            is_rework: true
          }
          cardsToInsert.push(cardRecord)

          sheetsRemaining -= sheetsInCard
          reqRemaining -= reqInCard
          if (reqRemaining < 0) reqRemaining = 0
        }

        if (cardsToInsert.length > 0) {
          const inserted = await apiInsert('work_cards', cardsToInsert)
          console.log(`  --> Successfully inserted ${inserted.length} REDO work cards for ${nom.name}!`)
          totalCardsCreated += inserted.length
        }
      }
    }
  }

  console.log(`\n==================================================`)
  console.log(`SUCCESS: Total REDO work cards created: ${totalCardsCreated}`)
}

run().catch(err => console.error("EXECUTION ERROR:", err))
