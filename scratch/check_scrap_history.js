import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'REVOKED_MES_SECRET_DO_NOT_USE' } }
})

async function main() {
  const taskId = 'a7f6ab43-9013-40d8-8e8e-8c371323695d'
  const { data: cards } = await supabase.from('work_cards').select('id, card_info').eq('task_id', taskId)
  const cardIds = cards.map(c => c.id)
  
  const { data: hist } = await supabase.from('work_card_history').select('*').in('card_id', cardIds)
  console.log(`History for cards of task ${taskId}:`)
  hist?.forEach(h => {
    if (Number(h.scrap_qty) > 0) {
      console.log(`- Card ID: ${h.card_id} | Scrap Qty: ${h.scrap_qty} | Completed At: ${h.completed_at}`)
    }
  })
}

main().catch(console.error)
