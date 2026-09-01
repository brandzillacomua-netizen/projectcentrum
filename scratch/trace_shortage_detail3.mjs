import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

async function traceShortage() {
  const taskId = '35c6045a-4da1-47d2-b73f-7d269ba1e3a3'
  const nomId3 = '5ecf63e5-802d-4f98-8291-aad9a52bfaa4'
  const unitsPerSheet = 30

  // Get flow totals for this task+nom
  const { data: flowTotals } = await supabase
    .from('work_card_flow_totals')
    .select('*')
    .eq('task_id', taskId)
    .eq('nomenclature_id', nomId3)

  // Simulate getBestKnownProducedFromFlow
  // It picks the max total_good + total_bz from all flow rows per card
  const byCard = {}
  flowTotals?.forEach(r => {
    const key = r.card_id
    const good = (Number(r.total_good)||0) + (Number(r.total_bz)||0)
    if (!byCard[key] || good > byCard[key]) byCard[key] = good
  })
  const flowProduced = Object.values(byCard).reduce((s, v) => s + v, 0)
  console.log('flowProduced (getBestKnownProducedFromFlow):', flowProduced)

  // Get actual produced from cards (at-buffer/completed/etc)
  const { data: cards } = await supabase.from('work_cards').select('*').eq('task_id', taskId).eq('nomenclature_id', nomId3)
  const sumProduced = cards.filter(c => ['completed','at-buffer','at-shop2-buffer','waiting-buffer'].includes(c.status)).reduce((s, c) => s + Number(c.quantity), 0)
  console.log('sumProduced (from card statuses):', sumProduced)
  
  const produced = flowProduced > 0 ? flowProduced : sumProduced
  console.log('produced (used in calc):', produced)

  // finalScrap from vkya_final_scrap_totals
  const { data: vfst } = await supabase.from('vkya_final_scrap_totals').select('*').eq('task_id', taskId).eq('nomenclature_id', nomId3)
  const finalScrap = vfst?.reduce((s, r) => s + Number(r.total_scrap), 0) || 0
  console.log('finalScrap (from vkya_final_scrap_totals):', finalScrap)

  // observedScrap from work_card_history
  const cardIds = cards.map(c => c.id)
  const { data: hist } = await supabase.from('work_card_history').select('*').in('card_id', cardIds).gt('scrap_qty', 0)
  const observedScrap = hist?.reduce((s, r) => s + Number(r.scrap_qty), 0) || 0
  console.log('observedScrap (from work_card_history):', observedScrap)

  // spareFromSheets
  const need = 10000
  const stock = 0
  const plannedSheets = 334
  // actualSheets from all cards
  const actualSheets = cards.reduce((s, c) => {
    const info = String(c.card_info || '')
    const reqMatch = info.match(/\[REQ:(\d+)\]/)
    const reqQty = reqMatch ? Number(reqMatch[1]) : Number(c.quantity)
    return s + Math.ceil(reqQty / unitsPerSheet)
  }, 0)
  const totalSheets = Math.max(plannedSheets, actualSheets)
  const spareFromSheets = totalSheets * unitsPerSheet + stock - need
  console.log('\nactualSheets:', actualSheets, 'plannedSheets:', plannedSheets, 'totalSheets:', totalSheets)
  console.log('spareFromSheets:', spareFromSheets, '= totalSheets*unitsPerSheet - need')

  // hasFinalScrapProjection - true if vkya_final_scrap_totals is available
  // If true: scrap = finalScrap, shortage = max(0, finalScrap - spareFromSheets)
  // If false: scrap = observedScrap, shortage = max(0, observedScrap - spareFromSheets)
  console.log('\n=== With hasFinalScrapProjection=true (VKYA data available) ===')
  const shortage_final = Math.max(0, finalScrap - spareFromSheets)
  console.log('shortage =', shortage_final, '= max(0,', finalScrap, '-', spareFromSheets, ')')

  console.log('\n=== With hasFinalScrapProjection=false ===')
  const shortage_obs = Math.max(0, observedScrap - spareFromSheets)
  console.log('shortage =', shortage_obs, '= max(0,', observedScrap, '-', spareFromSheets, ')')
}

traceShortage().catch(console.error)
