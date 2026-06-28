import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

async function main() {
  const { data: tasks } = await supabase.from('tasks').select('*')
  const { data: nomenclatures } = await supabase.from('nomenclatures').select('*')
  const { data: workCards } = await supabase.from('work_cards').select('*')
  const { data: history } = await supabase.from('work_card_history').select('*')

  // Simulate activeTaskId is a DIFFERENT task (so c7055204-cbad-4f74-bae6-4a8a79c14b7e is NOT active)
  // This means staticCompletedCards and staticHistory for c7055204... are NOT loaded
  const activeTaskIds = new Set(tasks.filter(t => t.status !== 'completed').map(t => t.id))
  
  // activeCards contains only non-completed cards
  const activeCards = workCards.filter(c => c.status !== 'completed' && activeTaskIds.has(c.task_id))
  
  // Since c7055204 is NOT active, staticCompletedCards for it is empty in allCardsCache
  const allCardsCache = activeCards // no staticCompletedCards for c7055204!

  const activeCardIds = new Set(activeCards.map(c => c.id))
  const activeHistory = history.filter(h => h.card_id && activeCardIds.has(h.card_id))
  const allHistory = activeHistory // no staticHistory for c7055204!

  const csCache = {}
  const sCache = {}
  allHistory.forEach(h => {
    csCache[h.card_id] = (csCache[h.card_id] || 0) + (Number(h.scrap_qty) || 0)
    const card = allCardsCache.find(c => c.id === h.card_id)
    if (card) {
      const tid = card.task_id
      const nid = String(card.nomenclature_id)
      if (!sCache[tid]) sCache[tid] = {}
      sCache[tid][nid] = (sCache[tid][nid] || 0) + (Number(h.scrap_qty) || 0)
    }
  })

  // Let's run taskShortageMap for task c7055204-cbad-4f74-bae6-4a8a79c14b7e
  const task = tasks.find(t => t.id === 'c7055204-cbad-4f74-bae6-4a8a79c14b7e')
  const snapshot = task.plan_snapshot || {}
  const taskScrap = sCache[task.id] || {}
  const taskCards = allCardsCache.filter(c => c.task_id === task.id)

  console.log('--- taskShortageMap simulation for c7055204-cbad-4f74-bae6-4a8a79c14b7e in sidebar ---')
  
  Object.keys(snapshot).forEach(nomIdStr => {
    const nom = nomenclatures.find(n => String(n.id) === String(nomIdStr))
    if (!nom || nom.type !== 'part') return
    const snap = snapshot[nomIdStr]
    
    const need = snap.need || 0
    const stockBZ = snap.stock || 0
    const unitsPerSheet = snap.units_per_sheet || 1

    const activeCardsForNom = taskCards.filter(c => String(c.nomenclature_id) === String(nomIdStr))
    const activeProductionCards = activeCardsForNom.filter(c => c.operation !== 'Склад БЗ')
    
    if (activeProductionCards.length === 0) {
      console.log(`Part: "${nom.name}" - activeProductionCards.length is 0 -> skipped`)
      return
    }

    const totalSheets = activeCardsForNom.reduce((sum, c) => {
      if (c.operation === 'Склад БЗ') return sum
      const cardScrap = csCache[c.id] || 0
      const originalQty = (Number(c.quantity) || 0) + cardScrap
      return sum + (c.actualSheets ? Number(c.actualSheets) : Math.ceil(originalQty / unitsPerSheet))
    }, 0)

    const plannedSheets = snap.sheets || 0
    const totalSheetsMax = Math.max(plannedSheets, totalSheets)
    const totalBZ = (totalSheetsMax * unitsPerSheet) + stockBZ - need
    const groupScrap = taskScrap[nomIdStr] || 0
    const shortage = (totalBZ - groupScrap) < 0 ? Math.abs(totalBZ - groupScrap) : 0

    console.log(`Part: "${nom.name}":`)
    console.log(`  need: ${need}, stockBZ: ${stockBZ}, unitsPerSheet: ${unitsPerSheet}`)
    console.log(`  plannedSheets: ${plannedSheets}, totalSheets: ${totalSheets}`)
    console.log(`  totalBZ: ${totalBZ}, groupScrap: ${groupScrap} -> shortage: ${shortage}`)
  })
}

main().catch(console.error)
