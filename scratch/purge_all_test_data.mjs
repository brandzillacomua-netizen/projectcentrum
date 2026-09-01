import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

// 1. Fetch work cards
const { data: cards } = await supabase
  .from('work_cards')
  .select('id, card_info, nomenclature_id')
  .order('created_at', { ascending: false })
  .limit(100)

const { data: noms } = await supabase.from('nomenclatures').select('id, name')
const nomMap = Object.fromEntries((noms || []).map(n => [String(n.id), n.name]))

const testCards = (cards || []).filter(c => {
  const nomName = nomMap[String(c.nomenclature_id)] || ''
  const info = String(c.card_info || '')
  return nomName.toLowerCase().includes('тест') || info.toLowerCase().includes('тест')
})

console.log(`Found ${testCards.length} test work cards to delete.`)
if (testCards.length > 0) {
  const cardIds = testCards.map(c => c.id)
  await supabase.from('work_card_history').delete().in('card_id', cardIds)
  await supabase.from('material_requests').delete().in('card_id', cardIds)
  await supabase.from('work_cards').delete().in('id', cardIds)
  console.log('✅ Deleted test work cards and their history!')
}

// 2. Fetch and delete any remaining material requests referencing test details or cutters
const { data: reqs } = await supabase
  .from('material_requests')
  .select('id, details')
  .or('details.ilike.%тест%,details.ilike.%фреза%')

if (reqs && reqs.length > 0) {
  const testReqs = reqs.filter(r => (r.details || '').toLowerCase().includes('тест'))
  if (testReqs.length > 0) {
    console.log(`Found ${testReqs.length} test material requests:`)
    testReqs.forEach(r => console.log(`- ${r.id} | ${r.details}`))
    await supabase.from('material_requests').delete().in('id', testReqs.map(r => r.id))
    console.log('✅ Deleted test material requests!')
  }
} else {
  console.log('No test material requests found.')
}
