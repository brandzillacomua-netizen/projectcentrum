import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

async function checkFlowTotals() {
  const taskId = '35c6045a-4da1-47d2-b73f-7d269ba1e3a3'
  const nomId3 = '5ecf63e5-802d-4f98-8291-aad9a52bfaa4'

  // Check work_card_flow_totals
  const { data: flowTotals, error } = await supabase
    .from('work_card_flow_totals')
    .select('*')
    .eq('task_id', taskId)
    .eq('nomenclature_id', nomId3)
  
  console.log('flow totals error:', error?.message)
  console.log('flow totals:', JSON.stringify(flowTotals, null, 2))

  // Also check work_card_scrap_totals
  const { data: scrapTotals } = await supabase
    .from('work_card_scrap_totals')
    .select('*')
    .eq('task_id', taskId)
    .eq('nomenclature_id', nomId3)
  
  console.log('\nscrap totals:', JSON.stringify(scrapTotals, null, 2))

  // Check vkya_final_scrap_totals
  const { data: vfst } = await supabase
    .from('vkya_final_scrap_totals')
    .select('*')
    .eq('task_id', taskId)
  
  console.log('\nvkya_final_scrap_totals:', JSON.stringify(vfst, null, 2))

  // Count cards with extra sheets (dovypusk=cards with REQ larger than plan)
  const { data: cards } = await supabase.from('work_cards').select('*').eq('task_id', taskId).eq('nomenclature_id', nomId3)
  
  const unitsPerSheet = 30
  let totalSheets = 0
  cards.forEach(c => {
    const info = String(c.card_info || '')
    const reqMatch = info.match(/\[REQ:(\d+)\]/)
    const reqQty = reqMatch ? Number(reqMatch[1]) : Number(c.quantity)
    const sheets = Math.ceil(reqQty / unitsPerSheet)
    totalSheets += sheets
  })
  console.log('\n=== Total sheets counted from ALL cards:', totalSheets, '×', unitsPerSheet, '=', totalSheets * unitsPerSheet)
  console.log('Cards:', cards.length)
  cards.filter(c => c.is_rework || String(c.card_info||'').includes('[REDO]') || String(c.card_info||'').includes('[REPAIR]')).forEach(c => {
    console.log('  REWORK/REDO card:', c.id, 'status:', c.status, 'qty:', c.quantity, 'info:', c.card_info?.substring(0, 100))
  })
}

checkFlowTotals().catch(console.error)
