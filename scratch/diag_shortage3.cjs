const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

async function diagnose() {
  // Get active tasks
  const { data: tasks } = await supabase
    .from('tasks')
    .select('id, status')
    .neq('status', 'completed')
  
  const taskIds = (tasks || []).map(t => t.id)
  
  // Simulate exactly what staticCompletedCards loader does (no .limit() = default 1000)
  const { data: cardsData, error: cardsError } = await supabase
    .from('work_cards')
    .select('id, task_id, nomenclature_id, quantity, operation, status, card_info')
    .in('task_id', taskIds)
  
  console.log(`Cards returned by static loader (default limit): ${(cardsData||[]).length}`)
  console.log(`Error: ${cardsError?.message || 'none'}`)
  
  // Does f374eeb0 appear?
  const targetCard = (cardsData||[]).find(c => c.id === 'f374eeb0-3e34-4651-97db-f8c20420fd42')
  console.log(`\nCard f374eeb0 (at-shop2-buffer with scrap=9) in static result: ${targetCard ? 'YES ✓' : 'NO ✗'}`)
  
  if (targetCard) {
    // Check if its history would be fetched
    // Simulate the chunked history fetch
    const cardIds = (cardsData||[]).map(c => c.id)
    const chunk = cardIds.slice(0, 500)
    const { data: hist1 } = await supabase
      .from('work_card_history')
      .select('id, card_id, scrap_qty, created_at')
      .in('card_id', chunk)
    
    const histForTarget = (hist1||[]).filter(h => h.card_id === 'f374eeb0-3e34-4651-97db-f8c20420fd42' && Number(h.scrap_qty) > 0)
    console.log(`History chunk 1 (first 500 cards): ${(hist1||[]).length} entries`)
    console.log(`Scrap entries for f374eeb0 in chunk 1: ${histForTarget.length}`)
    histForTarget.forEach(h => console.log(`  scrap=${h.scrap_qty} date=${h.created_at}`))
    
    if (cardIds.length > 500) {
      const chunk2 = cardIds.slice(500, 1000)
      const { data: hist2 } = await supabase
        .from('work_card_history')
        .select('id, card_id, scrap_qty, created_at')
        .in('card_id', chunk2)
      
      const histForTarget2 = (hist2||[]).filter(h => h.card_id === 'f374eeb0-3e34-4651-97db-f8c20420fd42' && Number(h.scrap_qty) > 0)
      console.log(`History chunk 2: ${(hist2||[]).length} entries, scrap entries for f374eeb0: ${histForTarget2.length}`)
    }
  }
  
  // Now check: what does the shortage calculation actually see?
  // task_id = a7f6ab43-9013-40d8-8e8e-8c371323695d
  const taskId = 'a7f6ab43-9013-40d8-8e8e-8c371323695d'
  const { data: t } = await supabase.from('tasks').select('id, plan_snapshot').eq('id', taskId).single()
  const snapshot = t?.plan_snapshot || {}
  
  // Find nomenclatures with type 'part' in snapshot
  const { data: noms } = await supabase.from('nomenclatures').select('id, name, type').in('id', Object.keys(snapshot))
  const partNoms = (noms||[]).filter(n => n.type === 'part')
  
  console.log(`\n\nPlan snapshot part nomenclatures: ${partNoms.length}`)
  
  // For each part nom, calculate shortage as taskShortageMap would
  const taskCards = (cardsData||[]).filter(c => c.task_id === taskId)
  const cardIds = taskCards.map(c => c.id)
  
  // Get full history for this task (as staticHistory would)
  const chunkSize = 500
  const promises = []
  for (let i = 0; i < cardIds.length; i += chunkSize) {
    const chunk = cardIds.slice(i, i + chunkSize)
    promises.push(supabase.from('work_card_history').select('id, card_id, nomenclature_id, scrap_qty').in('card_id', chunk))
  }
  const results = await Promise.all(promises)
  const staticHistory = results.flatMap(res => res.data || [])
  console.log(`staticHistory for task: ${staticHistory.length} entries, with scrap: ${staticHistory.filter(h=>h.scrap_qty>0).length}`)
  
  // Build scrapCache for this task
  const scrapByNomId = {}
  const cardScrapByCardId = {}
  staticHistory.forEach(h => {
    if (h.scrap_qty > 0) {
      const card = taskCards.find(c => c.id === h.card_id)
      if (card) {
        const nid = String(card.nomenclature_id)
        scrapByNomId[nid] = (scrapByNomId[nid] || 0) + Number(h.scrap_qty)
      }
      cardScrapByCardId[h.card_id] = (cardScrapByCardId[h.card_id] || 0) + Number(h.scrap_qty)
    }
  })
  
  console.log(`\nScrap per nom from staticHistory:`, scrapByNomId)
  
  for (const nom of partNoms) {
    const nomIdStr = String(nom.id)
    const snap = snapshot[nomIdStr]
    if (!snap) continue
    
    const need = snap.need || 0
    const stockBZ = snap.stock || 0
    const unitsPerSheet = snap.units_per_sheet || 1
    const plannedSheets = snap.sheets || 0
    
    const nomCards = taskCards.filter(c => String(c.nomenclature_id) === nomIdStr)
    const productionCards = nomCards.filter(c => c.operation !== 'Склад БЗ')
    
    if (nomCards.length === 0) continue
    
    const totalSheets = productionCards.reduce((sum, c) => {
      const cardScrap = cardScrapByCardId[c.id] || 0
      const originalQty = (Number(c.quantity) || 0) + cardScrap
      return sum + (c.actualSheets ? Number(c.actualSheets) : Math.ceil(originalQty / unitsPerSheet))
    }, 0)
    
    const totalSheetsMax = productionCards.length > 0 ? Math.max(plannedSheets, totalSheets) : plannedSheets
    const totalBZ = (totalSheetsMax * unitsPerSheet) + stockBZ - need
    const groupScrap = scrapByNomId[nomIdStr] || 0
    const shortage = (totalBZ - groupScrap) < 0 ? Math.abs(totalBZ - groupScrap) : 0
    
    if (shortage > 0 || groupScrap > 0) {
      console.log(`\n  Nom: ${nom.name} (${nomIdStr})`)
      console.log(`    need=${need}, stockBZ=${stockBZ}, plannedSheets=${plannedSheets}, unitsPerSheet=${unitsPerSheet}`)
      console.log(`    nomCards=${nomCards.length}, productionCards=${productionCards.length}`)
      console.log(`    totalSheets=${totalSheets}, totalSheetsMax=${totalSheetsMax}`)
      console.log(`    totalBZ=${totalBZ}, groupScrap=${groupScrap}, shortage=${shortage}`)
    }
  }
}

diagnose().catch(console.error)
