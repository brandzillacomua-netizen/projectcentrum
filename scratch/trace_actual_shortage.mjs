import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

async function traceActualShortage() {
  const taskId = '35c6045a-4da1-47d2-b73f-7d269ba1e3a3'
  const nomId3 = '5ecf63e5-802d-4f98-8291-aad9a52bfaa4'
  const unitsPerSheet = 30
  const need = 10000
  const plannedSheets = 334
  const stock = 0

  // getBestKnownProducedFromFlow correctly
  const { data: flowTotals } = await supabase.from('work_card_flow_totals').select('*').eq('task_id', taskId).eq('nomenclature_id', nomId3)
  
  const latestByCard = {}
  flowTotals?.forEach(row => {
    const stage = String(row.stage_name || '').toLowerCase().replace(/\s+/g, '')
    if (stage.includes('буфер') || stage.includes('buffer')) return
    const cardId = String(row.card_id || 'unknown')
    const rowTime = new Date(row.last_event_at || row.updated_at || 0).getTime()
    const latestTime = latestByCard[cardId] ? new Date(latestByCard[cardId].last_event_at || latestByCard[cardId].updated_at || 0).getTime() : -1
    if (!latestByCard[cardId] || rowTime > latestTime) latestByCard[cardId] = row
  })
  const flowProduced = Object.values(latestByCard).reduce((s, r) => s + (Number(r.total_good)||0) + (Number(r.total_bz)||0), 0)
  console.log('flowProduced (correctly):', flowProduced)
  Object.entries(latestByCard).forEach(([cardId, r]) => {
    console.log(`  card ${cardId}: stage=${r.stage_name} total_good=${r.total_good} total_bz=${r.total_bz}`)
  })

  // getCardSheets for each production card
  const { data: cards } = await supabase.from('work_cards').select('*').eq('task_id', taskId).eq('nomenclature_id', nomId3)
  
  // Ignore buffer cards (operation='Склад БЗ' etc)
  const productionCards = cards.filter(c => {
    const op = String(c.operation || '').toLowerCase()
    return !op.includes('склад бз') && !op.includes('склад bz')
  })
  
  let actualSheets = 0
  productionCards.forEach(c => {
    const info = String(c.card_info || '')
    const reqMatch = info.match(/\[REQ:(\d+)\]/)
    const reqQty = reqMatch ? Number(reqMatch[1]) : Number(c.quantity)
    const sheets = Math.ceil(reqQty / unitsPerSheet)
    actualSheets += sheets
  })

  const totalSheets = Math.max(plannedSheets, actualSheets)
  const spareFromSheets = totalSheets * unitsPerSheet + stock - need
  console.log('\nactualSheets:', actualSheets, 'totalSheets:', totalSheets)
  console.log('spareFromSheets:', spareFromSheets)

  // vkya_final_scrap
  const { data: vfst, error: vfstErr } = await supabase.from('vkya_final_scrap_totals').select('*').eq('task_id', taskId).eq('nomenclature_id', nomId3)
  const finalScrap = vfst?.reduce((s, r) => s + Number(r.total_scrap), 0) || 0
  console.log('finalScrap:', finalScrap, vfstErr ? '(ERROR: ' + vfstErr.message + ')' : '')

  // observedScrap (all scrap history)
  const { data: hist } = await supabase.from('work_card_history').select('scrap_qty').in('card_id', cards.map(c => c.id)).gt('scrap_qty', 0)
  const observedScrap = hist?.reduce((s, r) => s + Number(r.scrap_qty), 0) || 0
  console.log('observedScrap:', observedScrap)

  const hasFinalProjection = !vfstErr && vfst?.length > 0
  const scrap = hasFinalProjection ? finalScrap : observedScrap
  const shortage = Math.max(0, scrap - spareFromSheets)

  console.log('\n=== FINAL ===')
  console.log('hasFinalScrapProjection:', hasFinalProjection)
  console.log('scrap used:', scrap)
  console.log('shortage:', shortage)
  console.log('Expected on screen: 46 — actual calc:', shortage)
}

traceActualShortage().catch(console.error)
