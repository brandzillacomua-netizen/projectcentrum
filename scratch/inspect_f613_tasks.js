import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'
const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function run() {
  const { data: tasks } = await supabase.from('tasks').select('*')
  console.log(`Total tasks: ${tasks?.length || 0}`)
  for (const t of tasks || []) {
    const { data: order } = await supabase.from('orders').select('order_num, accessories').eq('id', t.order_id).maybeSingle()
    console.log(`- Task ID: ${t.id}\n  Order: #${order?.order_num} ("${order?.accessories}")\n  Step: ${t.step}\n  Status: ${t.status}`)
  }
}

run()
