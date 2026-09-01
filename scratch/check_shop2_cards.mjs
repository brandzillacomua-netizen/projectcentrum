import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

async function checkShop2WorkCards() {
  const { data: cards } = await supabase.from('work_cards').select('*')
  console.log('Total work cards count:', cards.length)

  const shop2Cards = cards.filter(c => c.card_info?.includes('[ЦЕХ №2]'))
  console.log('Shop 2 cards count:', shop2Cards.length)
  
  const statusCounts = {}
  shop2Cards.forEach(c => {
    statusCounts[c.status] = (statusCounts[c.status] || 0) + 1
  })
  console.log('Shop 2 card status counts:', statusCounts)

  const nonCompleted = shop2Cards.filter(c => c.status !== 'completed')
  console.log('Non-completed Shop 2 cards:', nonCompleted.map(c => ({ id: c.id.slice(-8), status: c.status, qty: c.quantity, info: c.card_info })))
}

checkShop2WorkCards().catch(console.error)
