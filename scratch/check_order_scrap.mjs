import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

async function checkOrderScrap() {
  const orderId = '2c4f89bf-293d-4f5f-9ddc-5aedf692ff52'
  const { data: cards } = await supabase.from('work_cards').select('*')
  const { data: history } = await supabase.from('work_card_history').select('*')

  const orderCards = (cards || []).filter(c => c.order_id === orderId || c.card_info?.includes('260827-2'))
  console.log('Order cards count:', orderCards.length)

  orderCards.forEach(c => {
    console.log(`Card ${c.id}: qty=${c.quantity}, status=${c.status}, scrap=${c.scrap_qty}, info=${c.card_info}`)
  })

  const cardIds = new Set(orderCards.map(c => String(c.id)))
  const orderHistory = (history || []).filter(h => cardIds.has(String(h.card_id)))

  console.log('\nHistory records for order cards:', orderHistory.length)
  orderHistory.forEach(h => {
    console.log(`History ${h.id}: card=${h.card_id}, scrap=${h.scrap_qty}, action=${h.action}, notes=${h.notes}`)
  })
}

checkOrderScrap().catch(console.error)
