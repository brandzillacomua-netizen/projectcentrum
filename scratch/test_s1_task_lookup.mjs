import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

async function testS1Lookup() {
  const { data: tasks } = await supabase.from('tasks').select('*')
  const { data: orders } = await supabase.from('orders').select('*')
  const { data: workCards } = await supabase.from('work_cards').select('*')
  const { data: history } = await supabase.from('work_card_history').select('*')

  const targetOrder = orders.find(o => o.order_num === '260827-2')
  const shop2Task = tasks.find(t => t.order_id === targetOrder.id && t.step?.includes('Пресування'))

  console.log('Shop2 Task:', shop2Task.id, shop2Task.step, shop2Task.batch_index)

  const s1Task = tasks.find(t =>
    String(t.order_id) === String(shop2Task.order_id) &&
    t.batch_index === shop2Task.batch_index &&
    !(t.step?.includes('Пресування') || t.step?.includes('ЦЕХ №2') || t.step?.includes('Доопрацювання'))
  )

  console.log('Found S1 Task:', s1Task?.id, s1Task?.step, s1Task?.batch_index)

  const nomId = '343417a7-4a5c-4e31-8f44-18abb41defec' // Detail 1
  const snapEntry = s1Task?.plan_snapshot?.[nomId] || shop2Task?.plan_snapshot?.[nomId]
  console.log('SnapEntry:', snapEntry)

  // Find all cards in Shop 1
  const s1Cards = workCards.filter(c => String(c.task_id) === String(s1Task?.id) && String(c.nomenclature_id) === String(nomId))
  console.log('s1Cards count:', s1Cards.length)

  const cardIds = new Set(s1Cards.map(c => String(c.id)))
  const hist = (history || []).filter(h => cardIds.has(String(h.card_id)))
  console.log('hist count for s1Cards:', hist.length)

  const utilScrap = hist.reduce((sum, h) => sum + (Number(h.scrap_qty) || 0), 0)
  console.log('utilScrap:', utilScrap)

  // Also check if any card for this order has scrap
  const allOrderCards = workCards.filter(c => c.order_id === targetOrder.id && String(c.nomenclature_id) === String(nomId))
  const allOrderCardIds = new Set(allOrderCards.map(c => String(c.id)))
  const allOrderHist = (history || []).filter(h => allOrderCardIds.has(String(h.card_id)))
  console.log('allOrderHist scrap sum:', allOrderHist.reduce((s, h) => s + (Number(h.scrap_qty) || 0), 0))
}

testS1Lookup().catch(console.error)
