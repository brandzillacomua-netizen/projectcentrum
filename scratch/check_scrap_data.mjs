import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

async function checkScrap() {
  const { data: cards } = await supabase.from('work_cards').select('*')
  const { data: history } = await supabase.from('work_card_history').select('*')
  const { data: tasks } = await supabase.from('production_tasks').select('*')
  const { data: orders } = await supabase.from('orders').select('*')

  const targetOrder = (orders || []).find(o => o.order_num === '260827-2')
  console.log('Order 260827-2:', targetOrder?.id)

  const relatedTasks = (tasks || []).filter(t => t.order_id === targetOrder?.id || t.order_num === '260827-2')
  console.log('Related tasks:', relatedTasks.map(t => ({ id: t.id, step: t.step, status: t.status })))

  const taskIds = new Set(relatedTasks.map(t => String(t.id)))
  const relatedCards = (cards || []).filter(c => taskIds.has(String(c.task_id)) || c.card_info?.includes('260827-2'))
  console.log('Related cards count:', relatedCards.length)

  relatedCards.forEach(c => {
    if (c.scrap_qty > 0) {
      console.log('Card with scrap in work_cards:', c.id, c.nomenclature_id, c.scrap_qty, c.status)
    }
  })

  const cardIds = new Set(relatedCards.map(c => String(c.id)))
  const relatedHistory = (history || []).filter(h => cardIds.has(String(h.card_id)))
  console.log('Related history count:', relatedHistory.length)
  relatedHistory.forEach(h => {
    if (h.scrap_qty > 0 || h.action?.includes('scrap') || h.action?.includes('брак') || h.action?.includes('утиль')) {
      console.log('History record with scrap:', h.card_id, h.nomenclature_id, h.scrap_qty, h.action, h.notes)
    }
  })
}

checkScrap().catch(console.error)
