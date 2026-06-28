import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

async function main() {
  const taskId = '0940169f-6565-4d43-97b1-a3760fb7d3fb'
  const { data: task } = await supabase.from('tasks').select('*').eq('id', taskId).single()
  const { data: nomenclatures } = await supabase.from('nomenclatures').select('*')
  const { data: workCards } = await supabase.from('work_cards').select('*')
  const { data: history } = await supabase.from('work_card_history').select('*')

  const snapshot = task.plan_snapshot || {}
  
  // Compute cardScrapCache
  const cardScrapCache = {}
  history.forEach(h => {
    if (h.card_id) {
      cardScrapCache[h.card_id] = (cardScrapCache[h.card_id] || 0) + (Number(h.scrap_qty) || 0)
    }
  })

  // Compute scrapCache
  const scrapCache = {}
  history.forEach(h => {
    if (h.card_id) {
      const card = workCards.find(c => c.id === h.card_id)
      if (card && card.task_id) {
        if (!scrapCache[card.task_id]) scrapCache[card.task_id] = {}
        const nomId = String(card.nomenclature_id)
        scrapCache[card.task_id][nomId] = (scrapCache[card.task_id][nomId] || 0) + (Number(h.scrap_qty) || 0)
      }
    }
  })

  const taskCards = workCards.filter(c => c.task_id === taskId)
  const taskScrap = scrapCache[taskId] || {}

  console.log('--- taskShortageMap Simulation ---')
  Object.keys(snapshot).forEach(nomIdStr => {
    const nom = nomenclatures.find(n => String(n.id) === String(nomIdStr))
    if (!nom || nom.type !== 'part') return
    const snap = snapshot[nomIdStr]
    
    const need = snap.need || 0
    const stockBZ = snap.stock || 0
    const unitsPerSheet = snap.units_per_sheet || 1

    const activeCards = taskCards.filter(c => String(c.nomenclature_id) === String(nomIdStr))
    const activeProductionCards = activeCards.filter(c => c.operation !== 'Склад БЗ')
    
    // IF activeProductionCards.length === 0, it returns early!
    if (activeProductionCards.length === 0) {
      console.log(`Part: "${nom.name}" - NO active production cards, returning early!`)
      return
    }

    const totalSheets = activeCards.reduce((sum, c) => {
      if (c.operation === 'Склад БЗ') return sum
      const cardScrap = cardScrapCache[c.id] || 0
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
