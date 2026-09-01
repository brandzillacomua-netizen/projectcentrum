import { createClient } from '@supabase/supabase-js'
import { calculateTaskParts } from '../src/modules/Foreman2/features/shortage/shortageCalculations.js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

async function debugShortage() {
  const { data: orders } = await supabase.from('orders').select('*')
  const { data: tasks } = await supabase.from('tasks').select('*')
  const { data: cards } = await supabase.from('work_cards').select('*')
  const { data: history } = await supabase.from('work_card_history').select('*')
  const { data: nomenclatures } = await supabase.from('nomenclatures').select('*')

  const targetOrder = orders.find(o => o.order_num === '260827-2')
  const s1Task = tasks.find(t => t.order_id === targetOrder.id && t.step?.includes('Розкрій'))

  // Build scrapModel as in Foreman2
  const scrapByNom = {}
  cards.filter(c => c.task_id === s1Task.id).forEach(c => {
    // Check how scrapByNom is computed in Foreman2
  })

  // Let's inspect useForeman2Data to see how scrapModel is constructed
}

debugShortage().catch(console.error)
