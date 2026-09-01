import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

async function checkVkyaDetails() {
  const { data: workCards } = await supabase.from('work_cards').select('*')
  const { data: history } = await supabase.from('work_card_history').select('*')
  const { data: orders } = await supabase.from('orders').select('*')

  const targetOrder = orders.find(o => o.order_num === '260827-2')
  const nomId = '50947afc-4e40-4165-a682-780275d5feda' // Detail 2

  const cards = (workCards || []).filter(c =>
    (c.order_id === targetOrder.id || c.card_info?.includes('260827-2')) &&
    String(c.nomenclature_id) === String(nomId)
  )

  console.log('Total cards:', cards.length)

  cards.forEach(c => {
    const info = c.card_info || ''
    if (c.status?.includes('vkya') || c.operation?.includes('ВКЯ') || info.includes('VKYA') || info.includes('ВКЯ')) {
      console.log(`Card ${c.id.slice(-8)}: status=${c.status}, op=${c.operation}, qty=${c.quantity}, info=${info}`)
    }
  })

  // How does ForemanTaskDetails calculate "НА ВКЯ"?
  // Let's check how vkya is calculated in ForemanTaskDetails.jsx
}

checkVkyaDetails().catch(console.error)
