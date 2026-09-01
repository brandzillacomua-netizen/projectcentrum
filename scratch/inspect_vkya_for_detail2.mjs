import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

async function inspectVkya() {
  const { data: orders } = await supabase.from('orders').select('*')
  const { data: tasks } = await supabase.from('tasks').select('*')
  const { data: workCards } = await supabase.from('work_cards').select('*')
  const { data: history } = await supabase.from('work_card_history').select('*')

  const targetOrder = orders.find(o => o.order_num === '260827-2')
  const targetTask = tasks.find(t => t.order_id === targetOrder.id && t.step?.includes('Розкрій'))

  const nomId = '50947afc-4e40-4165-a682-780275d5feda' // Detail 2 (Київ К-ІП9/10/31/36/37-9-10-11-Н-3-14)

  const cards = (workCards || []).filter(c =>
    (c.order_id === targetOrder.id || c.card_info?.includes('260827-2')) &&
    String(c.nomenclature_id) === String(nomId)
  )

  console.log('Cards count for Detail 2:', cards.length)

  // Find cards with VKYA or active scrap
  cards.forEach(c => {
    const info = c.card_info || ''
    if (c.status?.includes('vkya') || c.operation?.includes('ВКЯ') || info.includes('VKYA') || info.includes('ВКЯ') || c.scrap_qty > 0) {
      console.log(`Card ${c.id}: status=${c.status}, operation=${c.operation}, qty=${c.quantity}, scrap=${c.scrap_qty}, info=${c.card_info}`)
    }
  })

  // Check history for these cards
  const cardIds = new Set(cards.map(c => String(c.id)))
  const hist = (history || []).filter(h => cardIds.has(String(h.card_id)))

  console.log('\nHistory entries with scrap_qty > 0 or VKYA info:')
  hist.forEach(h => {
    const info = h.card_info || ''
    if (h.scrap_qty > 0 || info.includes('VKYA') || info.includes('ВКЯ') || h.stage_name?.includes('ВКЯ')) {
      console.log(`History ${h.id}: card_id=${h.card_id}, stage=${h.stage_name}, scrap_qty=${h.scrap_qty}, info=${h.card_info}, notes=${h.notes}`)
    }
  })
}

inspectVkya().catch(console.error)
