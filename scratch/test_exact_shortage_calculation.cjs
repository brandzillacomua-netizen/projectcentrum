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
  const cardIds = cards.map(c => c.id)

  const { data: history } = await supabase.from('work_card_history').select('*').in('card_id', cardIds)

  // Emulate buildScrapModel
  const cardById = new Map(cards.map(c => [c.id, c]))
  const cardScrap = {}
  const scrapByTask = {}

  history.forEach(row => {
    const scrapQty = Number(row.scrap_qty) || 0
    if (scrapQty <= 0) return

    const card = row.card_id ? cardById.get(row.card_id) : null
    const taskId = card?.task_id || row.task_id || task.id
    const nomId = row.nomenclature_id || card?.nomenclature_id
    if (!taskId || !nomId) return

    cardScrap[row.card_id] = (cardScrap[row.card_id] || 0) + scrapQty
    if (!scrapByTask[taskId]) scrapByTask[taskId] = {}
    scrapByTask[taskId][nomId] = (scrapByTask[taskId][nomId] || 0) + scrapQty
  })

  console.log("Card scrap map:", cardScrap)
  console.log("Scrap by task:", scrapByTask)

  // Emulate calculatePartShortage for each part in plan_snapshot
  const { data: noms } = await supabase.from('nomenclatures').select('*')

  Object.entries(task.plan_snapshot || {}).forEach(([nomId, snapshot]) => {
    if (nomId.startsWith('_') || nomId === 'materialSummary') return
    const nom = noms.find(n => n.id === nomId)
    const unitsPerSheet = Math.max(1, Number(snapshot.units_per_sheet || nom?.units_per_sheet || 1))
    const need = Number(snapshot.need) || 0
    const stockBZ = Number(snapshot.stock) || 0
    const plan = Number(snapshot.plan) || Math.max(0, need - stockBZ)
    const plannedSheets = Number(snapshot.sheets) || 0

    const nomCards = cards.filter(c => c.nomenclature_id === nomId)
    const productionCards = nomCards.filter(c => !String(c.operation || '').toLowerCase().includes('склад бз'))

    const actualSheets = productionCards.reduce((sum, card) => {
      const explicit = Number(card?.actual_sheets || card?.actualSheets)
      if (explicit > 0) return sum + explicit
      let cScrap = cardScrap[card.id] || 0
      let q = Number(card.quantity) || 0
      if (q === 0 && cScrap === 0 && card?.card_info) {
        const match = String(card.card_info).match(/\[REQ:(\d+)\]/)
        if (match) q = Number(match[1]) || 0
      }
      const origQty = q + cScrap
      return sum + Math.ceil(origQty / unitsPerSheet)
    }, 0)

    const totalSheets = productionCards.length > 0 ? Math.max(plannedSheets, actualSheets) : plannedSheets
    const spareFromSheets = (totalSheets * unitsPerSheet) + stockBZ - need
    const scrap = scrapByTask[task.id]?.[nomId] || 0
    const shortage = Math.max(0, scrap - spareFromSheets)

    console.log(`\n=== PART: ${nom?.name} ===`)
    console.log(`Need: ${need}, Stock: ${stockBZ}, Planned Sheets: ${plannedSheets}`)
    console.log(`Production cards count: ${productionCards.length}`)
    productionCards.forEach(c => {
      console.log(`  Card #${c.id.slice(-8)} | qty: ${c.quantity} | cardScrap: ${cardScrap[c.id] || 0} | is_rework: ${c.is_rework} | info: "${c.card_info}"`)
    })
    console.log(`Actual sheets sum: ${actualSheets}, Total Sheets: ${totalSheets}`)
    console.log(`Spare: ${spareFromSheets}, Scrap: ${scrap}, Shortage: ${shortage}`)
  })
}

run()
