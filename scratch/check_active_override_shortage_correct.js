import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

async function main() {
  const taskId = 'a7f6ab43-9013-40d8-8e8e-8c371323695d'
  const { data: task } = await supabase.from('tasks').select('*').eq('id', taskId).single()
  const { data: nomenclatures } = await supabase.from('nomenclatures').select('*')
  const { data: workCards } = await supabase.from('work_cards').select('*').eq('task_id', taskId)
  
  const cardIds = workCards.map(c => c.id)
  const { data: taskHistory } = await supabase.from('work_card_history').select('*').in('card_id', cardIds)

  const snapshot = task.plan_snapshot || {}
  
  let hasShortage = false

  console.log('--- CORRECT activeTaskShortageOverride Simulation for 25062026-02 ---')
  Object.keys(snapshot).forEach(nomIdStr => {
    const nom = nomenclatures.find(n => String(n.id) === String(nomIdStr))
    if (!nom || nom.type !== 'part') return
    const snap = snapshot[nomIdStr]

    const need = snap.need || 0
    const stockBZ = snap.stock || 0
    const unitsPerSheet = snap.units_per_sheet || 1

    const nomCards = workCards.filter(c => String(c.nomenclature_id) === String(nomIdStr))
    const productionCards = nomCards.filter(c => c.operation !== 'Склад БЗ')

    // groupScrap
    const groupScrap = taskHistory
      .filter(h => h.card_id && nomCards.some(c => c.id === h.card_id))
      .reduce((sum, h) => sum + (Number(h.scrap_qty) || 0), 0)

    // totalSheets
    const totalSheets = productionCards.reduce((sum, c) => {
      const cardScrap = taskHistory
        .filter(h => String(h.card_id) === String(c.id))
        .reduce((s, h) => s + (Number(h.scrap_qty) || 0), 0)
      const originalQty = (Number(c.quantity) || 0) + cardScrap
      return sum + (c.actualSheets ? Number(c.actualSheets) : Math.ceil(originalQty / unitsPerSheet))
    }, 0)

    const plannedSheets = snap.sheets || 0
    const totalSheetsMax = Math.max(plannedSheets, totalSheets)
    const totalBZ = (totalSheetsMax * unitsPerSheet) + stockBZ - need
    const shortage = (totalBZ - groupScrap) < 0 ? Math.abs(totalBZ - groupScrap) : 0

    if (shortage > 0) hasShortage = true

    console.log(`Part: "${nom.name}"`)
    console.log(`  need: ${need}, stockBZ: ${stockBZ}, unitsPerSheet: ${unitsPerSheet}`)
    console.log(`  plannedSheets: ${plannedSheets}, totalSheets: ${totalSheets}, totalSheetsMax: ${totalSheetsMax}`)
    console.log(`  totalBZ: ${totalBZ}, groupScrap: ${groupScrap} -> shortage: ${shortage}`)
  })

  console.log('Result activeTaskShortageOverride:', hasShortage)
}

main().catch(console.error)
