import { createClient } from '@supabase/supabase-js'

const url = 'https://hurzutjytlcvtbvihnry.supabase.co'
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'
const supabase = createClient(url, key)

async function main() {
  await supabase.auth.signInWithPassword({ email: 'vvv@centrum.local', password: 'vvv' })

  // Check the two tasks for order 77150d12
  const { data: tasks } = await supabase
    .from('tasks')
    .select('id, step, status, planned_sets, created_at')
    .eq('order_id', '77150d12-f973-4a8a-97e5-971412978f00')

  console.log('Tasks for 77150d12:', tasks)

  // Check which task request b7c0d30e (661 pcs) belongs to vs fb1dbe01 (2839 pcs)
  const { data: r1 } = await supabase.from('material_requests').select('id, task_id, quantity, status, details, created_at').eq('id', 'b7c0d30e-8f83-4f18-a710-6f67eb516c0e').single()
  console.log('Request 1 (661 pcs):', r1)

  const { data: r2 } = await supabase.from('material_requests').select('id, task_id, quantity, status, details, created_at').eq('id', 'fb1dbe01-a371-4837-a69e-447696cdb2e5').single()
  console.log('Request 2 (2839 pcs):', r2)
}

main().catch(console.error)
