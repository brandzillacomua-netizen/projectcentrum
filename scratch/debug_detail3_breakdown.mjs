import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

// Third detail in 260827-2 – the one that shows Брак:157 Утиль:126 Нестача:46
// From previous analysis, Detail 3 = '5ecf63e5-802d-4f98-8291-aad9a52bfaa4'
// Let's figure out which task has this shortage

async function debugDetail3() {
  const { data: orders } = await supabase.from('orders').select('*')
  const { data: tasks } = await supabase.from('tasks').select('*')
  const { data: cards } = await supabase.from('work_cards').select('*')
  const { data: hist } = await supabase.from('work_card_history').select('*').gt('scrap_qty', 0)

  // Find which task has Прийнято:4163, Брак:157, Утиль:126
  // The nomId with that kind of scrap is Detail 3 from 260827-1 or similar
  // Let's look at ALL tasks with large scrap counts
  const nomId3 = '5ecf63e5-802d-4f98-8291-aad9a52bfaa4'

  const nomCards = cards.filter(c => String(c.nomenclature_id) === nomId3)
  const taskIds = [...new Set(nomCards.map(c => c.task_id))]
  console.log('Tasks with detail 3:', taskIds.length)

  for (const tid of taskIds) {
    const task = tasks.find(t => t.id === tid)
    const order = orders.find(o => o.id === task?.order_id)
    const taskCards = nomCards.filter(c => c.task_id === tid)
    
    // produced
    const produced = taskCards
      .filter(c => ['completed','at-buffer','at-shop2-buffer','waiting-buffer'].includes(c.status))
      .reduce((s, c) => s + (Number(c.quantity)||0), 0)
    
    // scrap
    const taskCardIds = new Set(taskCards.map(c => String(c.id)))
    const scrapRows = hist.filter(h => h.card_id && taskCardIds.has(String(h.card_id)))
    const totalScrap = scrapRows.reduce((s, h) => s + (Number(h.scrap_qty)||0), 0)
    
    // rework cards
    const reworkCards = taskCards.filter(c => c.is_rework)
    const reworkProduced = reworkCards
      .filter(c => ['completed','at-buffer','at-shop2-buffer','waiting-buffer'].includes(c.status))
      .reduce((s, c) => s + (Number(c.quantity)||0), 0)
    const reworkPending = reworkCards
      .filter(c => !['completed','at-buffer','at-shop2-buffer','waiting-buffer'].includes(c.status))
      .reduce((s, c) => s + (Number(c.quantity)||0), 0)

    console.log(`\nTask ${tid} | Order: ${order?.order_num} | Step: ${task?.step}`)
    console.log(`  Cards: ${taskCards.length}, Produced: ${produced}, TotalScrap: ${totalScrap}`)
    console.log(`  Rework cards: ${reworkCards.length} (produced: ${reworkProduced}, pending: ${reworkPending})`)
    console.log(`  Statuses:`, [...new Set(taskCards.map(c => c.status))].join(', '))
    scrapRows.forEach(h => console.log(`  Scrap hist: ${h.scrap_qty} ${h.stage_name} is_archived=${h.is_archived_scrap}`))
  }
}

debugDetail3().catch(console.error)
