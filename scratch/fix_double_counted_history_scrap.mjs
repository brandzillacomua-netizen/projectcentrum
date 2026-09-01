import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

async function checkDoubleCount() {
  const { data: history } = await supabase.from('work_card_history').select('*')
  const { data: cards } = await supabase.from('work_cards').select('*')
  const { data: tasks } = await supabase.from('tasks').select('*')
  const { data: orders } = await supabase.from('orders').select('*')

  const targetOrder = orders.find(o => o.order_num === '260827-2')
  const s1Task = tasks.find(t => t.order_id === targetOrder.id && t.step?.includes('Розкрій'))

  const nomId2 = '50947afc-4e40-4165-a682-780275d5feda' // Detail 2
  const nomId3 = '5ecf63e5-802d-4f98-8291-aad9a52bfaa4' // Detail 3

  console.log('=== DETAIL 2 HISTORY SCRAP ===')
  const h2 = history.filter(h => String(h.nomenclature_id) === nomId2 && (h.card_info?.includes('260827-2') || cards.some(c => c.id === h.card_id && c.task_id === s1Task.id)))
  h2.forEach(h => {
    if (h.scrap_qty > 0) console.log(`Hist ID: ${h.id}, card: ${h.card_id}, stage: ${h.stage_name}, scrap_qty: ${h.scrap_qty}, is_archived: ${h.is_archived_scrap}, comment: ${h.qc_scrap_comment}`)
  })

  console.log('\n=== DETAIL 3 HISTORY SCRAP ===')
  const h3 = history.filter(h => String(h.nomenclature_id) === nomId3 && (h.card_info?.includes('260827-2') || cards.some(c => c.id === h.card_id && c.task_id === s1Task.id)))
  h3.forEach(h => {
    if (h.scrap_qty > 0) console.log(`Hist ID: ${h.id}, card: ${h.card_id}, stage: ${h.stage_name}, scrap_qty: ${h.scrap_qty}, is_archived: ${h.is_archived_scrap}, comment: ${h.qc_scrap_comment}`)
  })
}

checkDoubleCount().catch(console.error)
