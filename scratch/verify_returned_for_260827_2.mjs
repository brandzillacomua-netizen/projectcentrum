import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

async function checkReturnsForOrder() {
  const { data: cards } = await supabase.from('work_cards').select('*')
  const { data: history } = await supabase.from('work_card_history').select('*')
  const { data: orders } = await supabase.from('orders').select('*')

  const targetOrder = orders.find(o => o.order_num === '260827-2')

  const orderCards = cards.filter(c => c.order_id === targetOrder.id || c.card_info?.includes('260827-2'))
  console.log('Order cards count:', orderCards.length)

  let totalReturnedFound = 0
  orderCards.forEach(c => {
    const info = c.card_info || ''
    if (info.includes('RETURN') || info.includes('ПОВЕРНУТО') || info.includes('VKYA')) {
      console.log('Card with return info:', c.id, info)
      totalReturnedFound++
    }
  })

  const cardIds = new Set(orderCards.map(c => String(c.id)))
  const orderHist = history.filter(h => cardIds.has(String(h.card_id)))

  orderHist.forEach(h => {
    const info = h.card_info || ''
    const notes = h.notes || ''
    if (info.includes('RETURN') || notes.includes('RETURN') || notes.includes('поверн')) {
      console.log('History with return info:', h.id, info, notes)
      totalReturnedFound++
    }
  })

  console.log('Total return entries found for 260827-2:', totalReturnedFound)
}

checkReturnsForOrder().catch(console.error)
