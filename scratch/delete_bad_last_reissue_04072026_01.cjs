const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

const orderId = 'a8e83dc0-79b2-4c0d-aade-8af7b9500cb1'
const taskId = '4cf750d0-8c07-4885-88ce-33066569e426'
const badCardIds = [
  '929248c7-8725-47ca-9f38-ad087fa5c7ca',
  '024e34ef-bb06-40c0-b5c1-aacbc9a66cd6',
  '03beac9c-e580-437f-b4be-afcfa4445c1f',
  '01a98dac-66d8-4eab-910d-a6bdea1220e8'
]

async function main() {
  const { data: cards, error: cardsError } = await supabase
    .from('work_cards')
    .select('id,order_id,task_id,quantity,card_info,is_rework,status,created_at')
    .in('id', badCardIds)
  if (cardsError) throw cardsError

  const unsafe = badCardIds.filter(id => {
    const card = (cards || []).find(row => String(row.id) === String(id))
    return !card
      || String(card.order_id) !== orderId
      || String(card.task_id) !== taskId
      || Number(card.quantity) !== 0
      || !(card.is_rework || String(card.card_info || '').includes('[REDO]'))
  })

  if (unsafe.length > 0) {
    throw new Error(`Safety check failed. Refusing to delete cards: ${unsafe.join(', ')}`)
  }

  const { data: requests, error: requestsError } = await supabase
    .from('material_requests')
    .select('id,card_id,order_id,task_id,quantity,status,details')
    .in('card_id', badCardIds)
  if (requestsError) throw requestsError

  const requestIds = (requests || []).map(req => req.id)

  console.log(`Deleting bad zero-qty REDO cards: ${badCardIds.length}`)
  cards
    .sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0))
    .forEach(card => console.log(`  CARD ${card.id} | qty=${card.quantity} | status=${card.status} | ${card.card_info}`))

  console.log(`Deleting linked material_requests: ${requestIds.length}`)
  ;(requests || []).forEach(req => console.log(`  REQ ${req.id} | card=${req.card_id} | qty=${req.quantity} | status=${req.status} | ${req.details}`))

  if (requestIds.length > 0) {
    const { error } = await supabase.from('material_requests').delete().in('id', requestIds)
    if (error) throw error
  }

  const { error: deleteCardsError } = await supabase.from('work_cards').delete().in('id', badCardIds)
  if (deleteCardsError) throw deleteCardsError

  const { data: remainingCards, error: verifyCardsError } = await supabase
    .from('work_cards')
    .select('id')
    .in('id', badCardIds)
  if (verifyCardsError) throw verifyCardsError

  const { data: remainingRequests, error: verifyRequestsError } = requestIds.length > 0
    ? await supabase.from('material_requests').select('id').in('id', requestIds)
    : { data: [], error: null }
  if (verifyRequestsError) throw verifyRequestsError

  console.log(`Done. Remaining cards=${remainingCards?.length || 0}, remaining requests=${remainingRequests?.length || 0}`)
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
