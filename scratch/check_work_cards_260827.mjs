import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

async function checkWorkCards260827() {
  const { data: orders } = await supabase.from('orders').select('*')
  const { data: tasks } = await supabase.from('tasks').select('*')
  const { data: cards } = await supabase.from('work_cards').select('*')
  const { data: hist } = await supabase.from('work_card_history').select('*').gt('scrap_qty', 0)

  const order = orders.find(o => o.order_num === '260827-2')
  const s1Task = tasks.find(t => t.order_id === order.id && t.step?.includes('Розкрій'))

  const s1Cards = cards.filter(c => c.task_id === s1Task.id)

  // For Detail 2 (nomId2)
  const nomId2 = '50947afc-4e40-4165-a682-780275d5feda'
  const nomCards = s1Cards.filter(c => String(c.nomenclature_id) === nomId2)

  console.log('=== Detail 2 cards ===')
  nomCards.forEach(c => {
    console.log(`card ${c.id}: status=${c.status}, qty=${c.quantity}`)
  })

  const cardIds = new Set(nomCards.map(c => String(c.id)))
  const nomHist = hist.filter(h => h.card_id && cardIds.has(String(h.card_id)))

  console.log('\n=== Detail 2 scrap history ===')
  nomHist.forEach(h => {
    console.log(`hist ${h.id}: scrap=${h.scrap_qty}, is_archived_scrap=${h.is_archived_scrap}, stage=${h.stage_name}, card_id=${h.card_id}`)
  })

  // ALSO: check work cards status directly - which cards have status 'quality-hold' or similar
  const qhCards = s1Cards.filter(c => c.status?.includes('quality') || c.status?.includes('vkya') || c.status?.includes('hold'))
  console.log('\n=== Quality-hold status cards in 260827-2 task ===')
  qhCards.forEach(c => console.log(`card ${c.id}: status=${c.status}, qty=${c.quantity}, nom=${c.nomenclature_id}`))

  // The key question: what cards with nom2 are NOT completed/at-buffer?
  const incompleteNomCards = nomCards.filter(c => !['completed','at-buffer','at-shop2-buffer','waiting-buffer'].includes(c.status))
  console.log('\n=== Detail 2 INCOMPLETE cards (not produced) ===')
  incompleteNomCards.forEach(c => console.log(`card ${c.id}: status=${c.status}, qty=${c.quantity}`))
}

checkWorkCards260827().catch(console.error)
