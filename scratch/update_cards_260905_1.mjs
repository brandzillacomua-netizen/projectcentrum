import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' }
  }
})

async function main() {
  console.log('--- UPDATING CARDS FOR ORDER 260905-1 ---')
  
  // Find order
  const { data: order } = await supabase
    .from('orders')
    .select('*')
    .ilike('order_num', '%260905-1%')
    .single()
  
  console.log('Order:', order.id, order.order_num)

  // Find cards in waiting-cutters
  const { data: cards, error: fErr } = await supabase
    .from('work_cards')
    .select('id, card_info, status, nomenclature_id')
    .eq('order_id', order.id)
    .eq('status', 'waiting-cutters')

  if (fErr) {
    console.error('Error finding cards:', fErr)
    return
  }

  console.log(`Found ${cards.length} cards in waiting-cutters`)

  if (cards.length === 0) {
    console.log('No cards to update.')
    return
  }

  const cardIds = cards.map(c => c.id)
  const { data: updated, error: uErr } = await supabase
    .from('work_cards')
    .update({ status: 'new' })
    .in('id', cardIds)
    .select('id, status')

  if (uErr) {
    console.error('Error updating cards:', uErr)
    return
  }

  console.log(`Successfully updated ${updated?.length || cardIds.length} cards to status 'new'!`)
}

main().catch(console.error)
