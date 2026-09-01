import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

// 1. Find and delete all test work cards & history
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

if (testCards.length > 0) {
  const cardIds = testCards.map(c => c.id)
  await supabase.from('work_card_history').delete().in('card_id', cardIds)
  await supabase.from('material_requests').delete().in('card_id', cardIds)
  await supabase.from('work_cards').delete().in('id', cardIds)
  console.log(`✅ Deleted ${testCards.length} test work cards and their history!`)
} else {
  console.log('No test work cards found.')
}

// 2. Find and delete all material requests related to test tasks or test details
const { data: reqs } = await supabase
  .from('material_requests')
  .select('id, details')

const testReqs = (reqs || []).filter(r => {
  const d = (r.details || '').toLowerCase()
  return d.includes('тест') || d.includes('вафель')
})

if (testReqs.length > 0) {
  await supabase.from('material_requests').delete().in('id', testReqs.map(r => r.id))
  console.log(`✅ Deleted ${testReqs.length} test material requests!`)
} else {
  console.log('No test material requests found.')
}

// 3. Reset inventory reserved_qty to 0 for test cutters and ensure total_qty: 999
const nomIds = [
  'd23887da-d00a-45a3-bf56-6cc9b0c8cd4b',
  '74f0cdca-89ee-4063-9960-612e6612ae24',
  'b3f085a2-d2e2-4ece-905a-656e47024aab'
]

for (const nomId of nomIds) {
  await supabase
    .from('inventory')
    .update({ total_qty: 999, reserved_qty: 0 })
    .eq('nomenclature_id', nomId)
}

console.log('✅ Reset test cutter inventory stock & reserved_qty!')
