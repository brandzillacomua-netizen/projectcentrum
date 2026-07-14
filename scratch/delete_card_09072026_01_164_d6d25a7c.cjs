const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

const ORDER_NUM = '09072026-01'
const SYSTEM_SUFFIX = 'D6D25A7C'
const SAFE_STATUSES = new Set(['new', 'waiting-materials', 'waiting-machines'])

const must = (condition, message) => {
  if (!condition) throw new Error(message)
}

const deleteByCardId = async (table, cardId) => {
  const { error } = await supabase.from(table).delete().eq('card_id', cardId)
  if (error && !/does not exist|schema cache|Could not find|column .* does not exist/i.test(String(error.message || error.details || ''))) {
    throw error
  }
}

async function main() {
  const { data: orders, error: orderError } = await supabase
    .from('orders')
    .select('id,order_num')
    .eq('order_num', ORDER_NUM)
  if (orderError) throw orderError
  must((orders || []).length === 1, `Expected exactly one order ${ORDER_NUM}, found ${(orders || []).length}`)

  const order = orders[0]
  const { data: tasks, error: taskError } = await supabase
    .from('tasks')
    .select('id,order_id,status,step')
    .eq('order_id', order.id)
  if (taskError) throw taskError
  must((tasks || []).length > 0, `No tasks found for order ${ORDER_NUM}`)

  const taskIds = tasks.map(task => task.id)
  const { data: cards, error: cardsError } = await supabase
    .from('work_cards')
    .select('id,task_id,order_id,nomenclature_id,quantity,operation,status,card_info,machine,is_rework,created_at')
    .in('task_id', taskIds)
    .limit(5000)
  if (cardsError) throw cardsError

  const matches = (cards || []).filter(card => {
    const suffixMatches = String(card.id || '').toUpperCase().endsWith(SYSTEM_SUFFIX)
    const seqMatches = /^164\s*\//.test(String(card.card_info || '').trim())
    return suffixMatches && seqMatches
  })

  console.log(`Found candidates: ${matches.length}`)
  matches.forEach(card => {
    console.log(`  ${card.id} | qty=${card.quantity} | status=${card.status} | op=${card.operation} | info=${card.card_info}`)
  })

  must(matches.length === 1, `Safety stop: expected exactly one card ending ${SYSTEM_SUFFIX} and seq 164, found ${matches.length}`)
  const card = matches[0]
  must(String(card.order_id) === String(order.id), 'Safety stop: card order_id does not match target order')
  must(SAFE_STATUSES.has(String(card.status || '')), `Safety stop: card status "${card.status}" is not safe to delete`)

  const { data: requests, error: requestsError } = await supabase
    .from('material_requests')
    .select('id,card_id,status,quantity,details')
    .eq('card_id', card.id)
  if (requestsError) throw requestsError

  console.log(`Deleting card ${card.id} (${card.card_info})`)
  console.log(`Linked material_requests: ${(requests || []).length}`)

  await deleteByCardId('scrap_classifications', card.id)
  await deleteByCardId('material_requests', card.id)
  await deleteByCardId('work_card_history', card.id)

  const { error: deleteCardError } = await supabase
    .from('work_cards')
    .delete()
    .eq('id', card.id)
  if (deleteCardError) throw deleteCardError

  const { data: remainingCards, error: verifyCardError } = await supabase
    .from('work_cards')
    .select('id')
    .eq('id', card.id)
  if (verifyCardError) throw verifyCardError

  const { data: remainingRequests, error: verifyRequestsError } = await supabase
    .from('material_requests')
    .select('id')
    .eq('card_id', card.id)
  if (verifyRequestsError) throw verifyRequestsError

  console.log(`Done. Remaining cards=${remainingCards?.length || 0}, remaining requests=${remainingRequests?.length || 0}`)
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
