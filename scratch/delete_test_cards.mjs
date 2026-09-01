import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

// Only delete cards from the TEST task (Тест-Деталь В1 нові картки)
const TEST_TASK_ID = '99190e0a-91b0-4a44-ab5e-b1a1ec393ffe'

// 1. Find cards
const { data: cards, error: cardsErr } = await supabase
  .from('work_cards')
  .select('id, card_info, quantity, status')
  .eq('task_id', TEST_TASK_ID)

if (cardsErr) { console.error(cardsErr); process.exit(1) }
console.log(`Found ${cards?.length || 0} work cards for test task:`)
cards?.forEach(c => console.log(`  ${c.id} | ${c.card_info?.slice(0, 60)} | qty: ${c.quantity} | status: ${c.status}`))

// 2. Find material requests for this task
const { data: requests } = await supabase
  .from('material_requests')
  .select('id, card_id, quantity, status, details')
  .eq('task_id', TEST_TASK_ID)

console.log(`\nFound ${requests?.length || 0} material requests for test task:`)
requests?.forEach(r => console.log(`  ${r.id} | card_id: ${r.card_id} | qty: ${r.quantity} | ${r.details?.slice(0, 80)}`))

// 3. Delete material requests
if (requests && requests.length > 0) {
  const { error: delReqErr } = await supabase
    .from('material_requests')
    .delete()
    .eq('task_id', TEST_TASK_ID)
  if (delReqErr) console.error('Error deleting material requests:', delReqErr)
  else console.log(`\n✅ Deleted ${requests.length} material requests`)
}

// 4. Delete work cards
if (cards && cards.length > 0) {
  const cardIds = cards.map(c => c.id)
  const { error: delCardsErr } = await supabase
    .from('work_cards')
    .delete()
    .in('id', cardIds)
  if (delCardsErr) console.error('Error deleting work cards:', delCardsErr)
  else console.log(`✅ Deleted ${cards.length} work cards`)
}

console.log('\nDone! You can now regenerate cards for the test task.')
