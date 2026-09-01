import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

async function debugTask260827_2_detail3() {
  const taskId = '35c6045a-4da1-47d2-b73f-7d269ba1e3a3'
  const nomId3 = '5ecf63e5-802d-4f98-8291-aad9a52bfaa4'

  const { data: task } = await supabase.from('tasks').select('*').eq('id', taskId).single()
  const { data: cards } = await supabase.from('work_cards').select('*').eq('task_id', taskId)
  const { data: histAll } = await supabase.from('work_card_history').select('*').gt('scrap_qty', 0)

  const nomCards = cards.filter(c => String(c.nomenclature_id) === nomId3)
  const cardIds = new Set(nomCards.map(c => String(c.id)))
  const scrapHist = histAll.filter(h => h.card_id && cardIds.has(String(h.card_id)))

  // plan snapshot
  const snap = task.plan_snapshot
  const nomSnap = snap && (snap[nomId3] || Object.values(snap).find(s => String(s?.nomenclature_id) === nomId3))
  
  console.log('=== plan_snapshot for detail 3 ===')
  console.log(JSON.stringify(nomSnap, null, 2))

  // Produced
  const produced = nomCards
    .filter(c => ['completed','at-buffer','at-shop2-buffer','waiting-buffer'].includes(c.status))
    .reduce((s, c) => s + (Number(c.quantity)||0), 0)
  const totalScrap = scrapHist.reduce((s, h) => s + (Number(h.scrap_qty)||0), 0)
  const finalScrap = scrapHist.filter(h => h.is_archived_scrap === true).reduce((s, h) => s + (Number(h.scrap_qty)||0), 0)

  console.log('\n=== Counts ===')
  console.log('Produced:', produced)
  console.log('TotalScrap (observed):', totalScrap)
  console.log('FinalScrap (archived):', finalScrap)
  console.log('Need (from snapshot):', nomSnap?.need)
  console.log('Sheets planned (from snapshot):', nomSnap?.sheets)
  console.log('Units per sheet:', nomSnap?.units_per_sheet)
  console.log('Stock BZ:', nomSnap?.stock)

  const unitsPerSheet = Number(nomSnap?.units_per_sheet) || 1
  const need = Number(nomSnap?.need) || 0
  const plannedSheets = Number(nomSnap?.sheets) || 0
  const stock = Number(nomSnap?.stock) || 0

  // Actual sheets from cards
  const actualSheets = nomCards.filter(c => !(['completed','at-buffer','at-shop2-buffer','waiting-buffer'].includes(c.status) === false && false)).reduce((s, c) => {
    const info = String(c.card_info || '')
    const reqMatch = info.match(/\[REQ:(\d+)\]/)
    const reqQty = reqMatch ? Number(reqMatch[1]) : Number(c.quantity)
    return s + Math.ceil(reqQty / unitsPerSheet)
  }, 0)

  const totalSheets = Math.max(plannedSheets, actualSheets)
  const spareFromSheets = totalSheets * unitsPerSheet + stock - need
  const shortage = Math.max(0, finalScrap - spareFromSheets)
  
  console.log('\n=== Shortage calculation ===')
  console.log('actual sheets:', actualSheets)
  console.log('totalSheets:', totalSheets, '= max(planned:', plannedSheets, ', actual:', actualSheets, ')')
  console.log('spareFromSheets:', spareFromSheets, '= totalSheets*', unitsPerSheet, '+', stock, '-', need)
  console.log('shortage:', shortage, '= max(0, finalScrap', finalScrap, '- spareFromSheets', spareFromSheets, ')')

  // Rework cards
  const reworkCards = nomCards.filter(c => c.is_rework || String(c.card_info||'').includes('[REDO]'))
  console.log('\n=== Rework cards ===', reworkCards.length)
  reworkCards.forEach(c => console.log(`  ${c.id}: status=${c.status}, qty=${c.quantity}, is_rework=${c.is_rework}`))
}

debugTask260827_2_detail3().catch(console.error)
