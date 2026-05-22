import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'
const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function checkTasksShort() {
  const { data: tasks } = await supabase.from('tasks').select('id, step, status, planned_sets, order_id, created_at')
  console.log('All Tasks:')
  for (const t of tasks || []) {
    const { data: order } = await supabase.from('orders').select('order_num').eq('id', t.order_id).single()
    console.log(`- ID: ${t.id}, Order #${order?.order_num} (ID: ${t.order_id}), Step: ${t.step}, Status: ${t.status}, Sets: ${t.planned_sets}, Created: ${t.created_at}`)
  }
}

checkTasksShort()
