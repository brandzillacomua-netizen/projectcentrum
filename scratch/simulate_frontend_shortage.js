import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

async function main() {
  const taskId = 'c7055204-cbad-4f74-bae6-4a8a79c14b7e'
  const { data: task } = await supabase.from('tasks').select('*').eq('id', taskId).single()
  const { data: nomenclatures } = await supabase.from('nomenclatures').select('*')
  
  // Simulate frontend state where only active cards and history are loaded
  const { data: activeCards } = await supabase.from('work_cards').select('*').neq('status', 'completed')
  const { data: activeHistory } = await supabase.from('work_card_history').select('*') // we will filter below

  const activeCardIds = new Set(activeCards.map(c => c.id))
  const filteredHistory = activeHistory.filter(h => h.card_id && activeCardIds.has(h.card_id))

  const sCache = {}
  const csCache = {}
  
  filteredHistory.forEach(h => {
    csCache[h.card_id] = (csCache[h.card_id] || 0) + (Number(h.scrap_qty) || 0)
    const card = activeCards.find(c => c.id === h.card_id)
    if (card) {
      const tid = card.task_id;
      const nid = String(card.nomenclature_id);
      if (!sCache[tid]) sCache[tid] = {};
      sCache[tid][nid] = (sCache[tid][nid] || 0) + (Number(h.scrap_qty) || 0)
    }
  })

  const taskCards = activeCards.filter(c => c.task_id === taskId)
  const taskScrap = sCache[taskId] || {}

  console.log('--- Simulated Frontend taskShortageMap for c7055204-cbad-4f74-bae6-4a8a79c14b7e ---')
  const snapshot = task.plan_snapshot || {}
  
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
      console.log(`Part: "${nom.name}" - NO active production cards in frontend, returning early!`)
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

    console.log(`Part: "${nom.name}"`)
    console.log(`  need: ${need}, stockBZ: ${stockBZ}, unitsPerSheet: ${unitsPerSheet}`)
    console.log(`  plannedSheets: ${plannedSheets}, totalSheets: ${totalSheets}`)
    console.log(`  totalBZ: ${totalBZ}, groupScrap: ${groupScrap} -> shortage: ${shortage}`)
  })
}

main().catch(console.error)
