import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

async function checkRestorationStatus() {
  const taskId = '35c6045a-4da1-47d2-b73f-7d269ba1e3a3'
  const nomId = '50947afc-4e40-4165-a682-780275d5feda' // Н-3-14

  // Check work_cards for this task+nom
  const { data: cards } = await supabase.from('work_cards').select('*').eq('task_id', taskId).eq('nomenclature_id', nomId)
  
  console.log('=== WORK CARDS STATUSES ===')
  cards.forEach(c => {
    const info = String(c.card_info || '')
    if (c.status === 'quality-hold' || c.is_rework || info.includes('VKYA') || info.includes('REDO') || info.includes('REPAIR') || info.includes('RETURN')) {
      console.log(`Card ${c.id}: status=${c.status} op=${c.operation} qty=${c.quantity} info=${info.substring(0, 150)}`)
    }
  })

  // Check work_card_history entries for these 10 items
  const cardIds = cards.map(c => c.id)
  const { data: hist } = await supabase.from('work_card_history').select('*').in('card_id', cardIds).gt('scrap_qty', 0)
  
  console.log('\n=== 10 CAT1 SCRAP HISTORY RECORDS ===')
  hist.filter(h => h.qc_scrap_comment?.includes('"cat1":')).forEach(h => {
    console.log(`History ID: ${h.id}`)
    console.log(`  card_id: ${h.card_id}`)
    console.log(`  scrap_qty: ${h.scrap_qty}`)
    console.log(`  stage_name: ${h.stage_name}`)
    console.log(`  is_archived_scrap: ${h.is_archived_scrap}`)
    console.log(`  qc_scrap_comment: ${h.qc_scrap_comment}`)
    console.log(`  qc_scrap_reason: ${h.qc_scrap_reason}`)
    console.log(`  created_at: ${h.created_at}`)
  })

  // Check if there are any repair/restoration tasks or tables
  const { data: tables } = await supabase.rpc('get_tables').catch(() => ({ data: null }))
  console.log('\n=== TABLES IN DB ===')
  console.log(tables)
}

checkRestorationStatus().catch(console.error)
