const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = 'https://hurzutjytlcvtbvihnry.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  global: {
    headers: {
      'x-mes-secret': 'CentrumMES2026SecretKey_a9f8'
    }
  }
})

async function run() {
  const { data: task } = await supabase.from('tasks').select('*').eq('id', '23ceb083-47f2-4f00-9922-339318478043').single()
  const { data: cards } = await supabase.from('work_cards').select('*').eq('task_id', task.id)
  const { data: noms } = await supabase.from('nomenclatures').select('*')

  console.log("=== TASK SNAPSHOT ===")
  console.log(task.plan_snapshot)

  const cardIds = cards.map(c => c.id)
  const { data: history } = await supabase.from('work_card_history').select('*').in('card_id', cardIds)

  // Calculate scrap per nomenclature
  const scrapByNom = {}
  history?.forEach(h => {
    const scrap = Number(h.scrap_qty) || Number(h.scrap) || 0
    if (scrap > 0 && h.nomenclature_id) {
      scrapByNom[h.nomenclature_id] = (scrapByNom[h.nomenclature_id] || 0) + scrap
    }
  })

  console.log("\n=== SCRAP BY NOM ===")
  console.log(scrapByNom)

  Object.entries(task.plan_snapshot || {}).forEach(([nomId, snap]) => {
    if (nomId.startsWith('_') || nomId === 'materialSummary') return
    const nom = noms.find(n => n.id === nomId)
    const nomCards = cards.filter(c => c.nomenclature_id === nomId)

    const unitsPerSheet = Number(snap.units_per_sheet || nom?.units_per_sheet) || 1
    const need = Number(snap.need) || 0
    const stockBZ = Number(snap.stock) || 0
    const plannedSheets = Number(snap.sheets) || 0

    // Sum actual sheets from ALL production cards (including redo)
    let actualSheets = 0
    let totalCardQty = 0
    let redoCardsCount = 0
    let redoQty = 0

    nomCards.forEach(c => {
      const q = Number(c.quantity) || 0
      totalCardQty += q
      const cSheets = Number(c.actual_sheets) || Math.ceil(q / unitsPerSheet)
      actualSheets += cSheets
      const info = String(c.card_info || '')
      if (c.is_rework || info.includes('[REDO]')) {
        redoCardsCount++
        redoQty += q
      }
    })

    const totalSheets = Math.max(plannedSheets, actualSheets)
    const spareFromSheets = (totalSheets * unitsPerSheet) + stockBZ - need
    const scrap = scrapByNom[nomId] || 0
    const shortage = Math.max(0, scrap - spareFromSheets)

    console.log(`\n--- PART: ${nom?.name} ---`)
    console.log(`Need: ${need} | StockBZ: ${stockBZ} | Units/Sheet: ${unitsPerSheet}`)
    console.log(`Planned sheets: ${plannedSheets} | Total actual sheets across ALL cards (${nomCards.length} cards, ${redoCardsCount} REDO): ${actualSheets}`)
    console.log(`SpareFromSheets: (${totalSheets} * ${unitsPerSheet}) + ${stockBZ} - ${need} = ${spareFromSheets}`)
    console.log(`Scrap: ${scrap} | Shortage: Math.max(0, ${scrap} - ${spareFromSheets}) = ${shortage}`)
  })
}

run()
