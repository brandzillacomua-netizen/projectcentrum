import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

// Find all work cards that might be test cards
const { data: cards, error: errCards } = await supabase
  .from('work_cards')
  .select('id, task_id, card_info, quantity, status, nomenclature_id, created_at')
  .order('created_at', { ascending: false })
  .limit(100)

if (errCards) {
  console.error(errCards)
  process.exit(1)
}

// Find nomenclatures to map names
const { data: noms } = await supabase.from('nomenclatures').select('id, name')
const nomMap = Object.fromEntries((noms || []).map(n => [String(n.id), n.name]))

console.log(`Checking ${cards?.length || 0} recent work_cards:`)
const testCards = (cards || []).filter(c => {
  const nomName = nomMap[String(c.nomenclature_id)] || ''
  const info = String(c.card_info || '')
  return nomName.toLowerCase().includes('тест') || info.toLowerCase().includes('тест')
})

console.log(`Found ${testCards.length} test work cards:`)
testCards.forEach(c => {
  console.log(`- ID: ${c.id} | Task: ${c.task_id} | Nom: ${nomMap[String(c.nomenclature_id)] || c.nomenclature_id} | Info: ${c.card_info}`)
})

if (testCards.length > 0) {
  const testCardIds = testCards.map(c => c.id)
  
  // 1. Delete history
  const { error: errHist } = await supabase.from('work_card_history').delete().in('card_id', testCardIds)
  if (errHist) console.error('Error deleting card history:', errHist)
  
  // 2. Delete material requests linked to these cards
  const { error: errReq } = await supabase.from('material_requests').delete().in('card_id', testCardIds)
  if (errReq) console.error('Error deleting material requests:', errReq)
  
  // 3. Delete work cards
  const { error: errDel } = await supabase.from('work_cards').delete().in('id', testCardIds)
  if (errDel) console.error('Error deleting work cards:', errDel)
  else console.log(`✅ Successfully deleted ${testCards.length} test work cards!`)
} else {
  console.log('No test work cards found to delete.')
}
