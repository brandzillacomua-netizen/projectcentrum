import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

async function main() {
  const taskId = 'a7f6ab43-9013-40d8-8e8e-8c371323695d'
  const { data: tasks } = await supabase.from('tasks').select('*')
  const { data: nomenclatures } = await supabase.from('nomenclatures').select('*')
  const { data: workCards } = await supabase.from('work_cards').select('*')
  const { data: history } = await supabase.from('work_card_history').select('*')

  const task = tasks.find(t => t.id === taskId)
  const activeTaskIds = new Set(tasks.filter(t => t.status !== 'completed').map(t => t.id))
  
  // activeCards (from workCards state in frontend, which has only active cards)
  const activeCards = workCards.filter(c => c.status !== 'completed' && activeTaskIds.has(c.task_id))
  
  // staticCompletedCards (completed cards for active tasks)
  const taskIds = tasks.filter(t => t.status !== 'completed').map(t => t.id)
  const completedCards = workCards.filter(c => c.status === 'completed' && taskIds.includes(c.task_id))
  
  const allCards = [...activeCards, ...completedCards]

  // cardScrapCache & sCache computation in Frontend
  const activeCardIds = new Set(activeCards.map(c => c.id))
  const activeHistory = history.filter(h => h.card_id && activeCardIds.has(h.card_id))
  
  // staticHistory
  const cardIdsForStatic = completedCards.map(c => c.id)
  const staticHistory = history.filter(h => h.card_id && cardIdsForStatic.includes(h.card_id))
  
  const allHistory = [...staticHistory, ...activeHistory]

  const csCache = {}
  const sCache = {}
  allHistory.forEach(h => {
    csCache[h.card_id] = (csCache[h.card_id] || 0) + (Number(h.scrap_qty) || 0)
    const card = allCards.find(c => c.id === h.card_id)
    if (card) {
      const tid = card.task_id
      const nid = String(card.nomenclature_id)
      if (!sCache[tid]) sCache[tid] = {}
      sCache[tid][nid] = (sCache[tid][nid] || 0) + (Number(h.scrap_qty) || 0)
    }
  })

  // taskCards
  const activeTaskCards = activeCards.filter(c => c.task_id === task.id)
  const completedTaskCards = completedCards.filter(c => c.task_id === task.id)
  const taskCards = [...activeTaskCards, ...completedTaskCards]

  console.log(`Simulating row loop for task ${task.id} (Order ${task.plan_snapshot?._metadata?.batch_index || '25062026-02'}):`)

  const snapshot = task.plan_snapshot || {}
  Object.keys(snapshot).forEach(nomIdStr => {
    const nom = nomenclatures.find(n => String(n.id) === String(nomIdStr))
    if (!nom || nom.type !== 'part') return
    const snap = snapshot[nomIdStr]

    const need = snap.need || 0
    const stockBZ = snap.stock || 0
    const unitsPerSheet = snap.units_per_sheet || 1

    const activeCardsForNom = taskCards.filter(c => String(c.nomenclature_id) === String(nomIdStr))
    const groupHistory = allHistory.filter(h => h.card_id && activeCardsForNom.some(c => c.id === h.card_id))

    // TotalSheets
    const totalSheets = activeCardsForNom.reduce((sum, c) => {
      if (c.operation === 'Склад БЗ') return sum
      const cardScrap = csCache[c.id] || 0
      const originalQty = (Number(c.quantity) || 0) + cardScrap
      return sum + (c.actualSheets ? Number(c.actualSheets) : Math.ceil(originalQty / unitsPerSheet))
    }, 0)

    const plannedSheets = snap.sheets || 0
    const totalSheetsMax = Math.max(plannedSheets, totalSheets)
    const totalBZ = (totalSheetsMax * unitsPerSheet) + stockBZ - need
    const groupScrap = groupHistory.reduce((sum, h) => sum + (Number(h.scrap_qty) || 0), 0)
    const shortage = (totalBZ - groupScrap) < 0 ? Math.abs(totalBZ - groupScrap) : 0

    console.log(`Part: "${nom.name}":`)
    console.log(`  need: ${need}, plannedSheets: ${plannedSheets}, totalSheets: ${totalSheets}`)
    console.log(`  totalBZ: ${totalBZ}, groupScrap: ${groupScrap} -> shortage: ${shortage}`)
  })
}

main().catch(console.error)
