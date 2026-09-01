import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

async function findOrder() {
  const { data: orders } = await supabase.from('orders').select('*')
  const { data: tasks } = await supabase.from('production_tasks').select('*')

  console.log('Orders with 260827:', orders.filter(o => o.order_num?.includes('260827')).map(o => ({ id: o.id, num: o.order_num })))
  console.log('Tasks with 260827:', tasks.filter(t => t.order_num?.includes('260827') || t.batch_index?.includes('260827')).map(t => ({ id: t.id, num: t.order_num, batch: t.batch_index })))
}

findOrder().catch(console.error)
