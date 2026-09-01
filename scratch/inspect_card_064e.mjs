import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

async function inspectCard064e() {
  const { data: cards } = await supabase.from('work_cards').select('*')
  const { data: orders } = await supabase.from('orders').select('*')
  const { data: tasks } = await supabase.from('tasks').select('*')

  const card = cards.find(c => c.id === '064e04f8-f08f-41bc-b688-d458902879eb')
  console.log('Card 064e:', card)

  const order = orders.find(o => o.id === card?.order_id)
  console.log('Card order:', order?.id, order?.order_num)

  const task = tasks.find(t => t.id === card?.task_id)
  console.log('Card task:', task?.id, task?.step, task?.order_id)
}

inspectCard064e().catch(console.error)
