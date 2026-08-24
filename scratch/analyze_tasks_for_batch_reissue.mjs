import { createClient } from '../node_modules/@supabase/supabase-js/dist/main/index.js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

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

function countAsProduced(card) {
  if (card.status === 'completed') return true
  if (card.status === 'at-shop2-buffer') return true
  return false
}

async function run() {
  console.log("=== ANALYZING TASKS FOR BATCH REISSUE ===")
  
  const { data: tasks, error: tasksErr } = await supabase.from('tasks').select('*').neq('status', 'completed')
  if (tasksErr) {
    console.error("Error fetching tasks:", tasksErr)
    return
  }

  const { data: orders } = await supabase.from('orders').select('id, order_num, customer, nomenclature_id, order_items(id, nomenclature_id, quantity)')
  const { data: nomenclatures } = await supabase.from('nomenclatures').select('id, name, type, units_per_sheet, time_per_unit')
  const { data: workCards } = await supabase.from('work_cards').select('*')
  const { data: history } = await supabase.from('work_card_history').select('*')
  const { data: machines } = await supabase.from('machines').select('*')

  const ordersMap = new Map((orders || []).map(o => [String(o.id), o]))
  const nomMap = new Map((nomenclatures || []).map(n => [String(n.id), n]))

  console.log(`Found ${tasks.length} non-completed tasks in DB.\n`)

  const qualifyingTasks = []

  for (const task of tasks) {
    const order = ordersMap.get(String(task.order_id))
    const orderNum = order?.order_num || ''
    
    // Check exclusion list
    if (EXCLUDED_ORDER_NUMS.includes(orderNum)) {
      console.log(`[EXCLUDED] Task ${task.id} (Order #${orderNum}) is in explicit exclusion list.`)
      continue
    }

    // Check product name
    let productName = order?.order_items?.map(it => nomMap.get(String(it.nomenclature_id))?.name).filter(Boolean).join(', ')
    if (!productName && task.plan_snapshot) {
      productName = Object.values(task.plan_snapshot)
        .map(s => nomMap.get(String(s.id))?.name || s.name)
        .filter(Boolean)
        .join(', ')
    }

    if (!isAllowedProduct(productName)) {
      console.log(`[SKIPPED] Task ${task.id} (Order #${orderNum}, Product: "${productName}") is not in target product list.`)
      continue
    }

    console.log(`\n--------------------------------------------------`)
    console.log(`[QUALIFIED] Task ID: ${task.id} | Order #${orderNum} | Product: "${productName}"`)

    const snapshot = task.plan_snapshot || {}
    const taskCards = (workCards || []).filter(c => String(c.task_id) === String(task.id) && c.operation !== 'Склад БЗ')
    const taskHistory = (history || []).filter(h => taskCards.some(c => String(c.id) === String(h.card_id)))

    const partsNeedingReissue = []

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

      // Calculate scrap & returned
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

      console.log(`   Part: ${nom.name}`)
      console.log(`     Need: ${need} | Planned Total: ${plannedTotalQty} (Spare: +${spareFromSheets})`)
      console.log(`     Scrap: ${initialScrap} | Returned: ${safeReturned} | Util: ${utilScrap}`)
      console.log(`     --> SHORTAGE: ${shortage} pcs`)

      if (shortage > 0) {
        // Machine selection
        const activeCardMachine = activeCards[0]?.machine || snap?.machine
        const machineObj = (machines || []).find(m => m.name === activeCardMachine)
        const capacity = machineObj?.sheet_capacity || 4

        const sheetsNeeded = Math.ceil(shortage / unitsPerSheet)
        const cardsNeeded = Math.ceil(sheetsNeeded / capacity)

        partsNeedingReissue.push({
          nom,
          shortage,
          sheetsNeeded,
          cardsNeeded,
          capacity,
          machineName: activeCardMachine || 'CNC 3050(16)х16 - 3-12 листів (швидкісний)'
        })
      }
    }

    if (partsNeedingReissue.length > 0) {
      qualifyingTasks.push({
        task,
        order,
        orderNum,
        productName,
        partsNeedingReissue
      })
    }
  }

  console.log(`\n==================================================`)
  console.log(`SUMMARY: Found ${qualifyingTasks.length} tasks needing reissue card generation.`)
  for (const q of qualifyingTasks) {
    console.log(`\nOrder #${q.orderNum} (Task ID: ${q.task.id}, Product: "${q.productName}"):`)
    for (const p of q.partsNeedingReissue) {
      console.log(`  - ${p.nom.name}: Need ${p.shortage} pcs -> ${p.sheetsNeeded} sheets -> ${p.cardsNeeded} REDO cards (${p.capacity} sheets/card on ${p.machineName})`)
    }
  }
}

run()
