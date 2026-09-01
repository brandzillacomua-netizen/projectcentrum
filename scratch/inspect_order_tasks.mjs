import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

async function inspectOrderTasks() {
  const { data: orders } = await supabase.from('orders').select('*')
  const { data: tasks } = await supabase.from('tasks').select('*')

  const targetOrder = orders.find(o => o.order_num === '260827-2')
  console.log('Target Order:', targetOrder?.id, targetOrder?.order_num)

  const relatedTasks = tasks.filter(t => t.order_id === targetOrder?.id)
  console.log('Related Tasks Count:', relatedTasks.length)

  relatedTasks.forEach(t => {
    console.log(`\nTask ${t.id} (step: ${t.step}, status: ${t.status}):`)
    console.log('plan_snapshot:', JSON.stringify(t.plan_snapshot, null, 2))
  })
}

inspectOrderTasks().catch(console.error)
