import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

async function testScrapRetrieval() {
  const { data: workCards } = await supabase.from('work_cards').select('*')
  const { data: history } = await supabase.from('work_card_history').select('*')
  const { data: tasks } = await supabase.from('tasks').select('*')
  const { data: orders } = await supabase.from('orders').select('*')

  const targetOrder = orders.find(o => o.order_num === '260827-2')
  const targetTask = tasks.find(t => t.order_id === targetOrder.id && t.step?.includes('Пресування'))

  console.log('Order:', targetOrder.id)
  console.log('Task:', targetTask.id)

  const nomId = '343417a7-4a5c-4e31-8f44-18abb41defec' // Detail 1

  // Find all cards for this order and nomenclature in Shop 1 (cutting / sorting)
  const allCards = (workCards || []).filter(c =>
    (c.order_id === targetOrder.id || c.card_info?.includes('260827-2')) &&
    String(c.nomenclature_id) === String(nomId) &&
    (c.operation === 'Розкрій' || !c.card_info?.includes('[ЦЕХ №2]'))
  )

  console.log('Found Shop 1 cards count:', allCards.length)
  allCards.forEach(c => {
    if (c.scrap_qty > 0) console.log('Card with scrap:', c.id, c.scrap_qty)
  })

  const cardIds = new Set(allCards.map(c => String(c.id)))
  const hist = (history || []).filter(h => cardIds.has(String(h.card_id)))

  console.log('History count:', hist.length)
  hist.forEach(h => {
    if (h.scrap_qty > 0) console.log('History scrap:', h.card_id, h.scrap_qty, h.notes)
  })

  // Check all history where nomenclature_id === nomId
  const nomHist = (history || []).filter(h => String(h.nomenclature_id) === String(nomId))
  console.log('Total history records for nomId:', nomHist.length)
  nomHist.forEach(h => {
    if (h.scrap_qty > 0) console.log('Nom history scrap:', h.card_id, h.scrap_qty, h.notes)
  })
}

testScrapRetrieval().catch(console.error)
